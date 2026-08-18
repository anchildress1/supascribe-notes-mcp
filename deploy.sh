#!/bin/bash
set -e

# Configuration
SERVICE_NAME="supascribe-notes"
DIVIDER="=================================================="
REGION="us-east1"
PORT="8080"
# Dedicated runtime SA — created once via migration; holds no project-level IAM roles.
# Granted roles/secretmanager.secretAccessor on SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY only.
SA_NAME="supascribe-notes-sa"

# Check dependencies
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed." >&2
    exit 1
fi

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [[ "$PROJECT_ID" == "(unset)" ]] || [[ -z "$PROJECT_ID" ]]; then
    echo "Error: No Google Cloud Project ID set. Run: gcloud config set project <PROJECT_ID>" >&2
    exit 1
fi

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

echo "$DIVIDER"
echo "DEPLOYMENT: $SERVICE_NAME"
echo "$DIVIDER"
echo "Project: $PROJECT_ID ($PROJECT_NUMBER)"
echo "Region:  $REGION"
echo "SA:      $SA_EMAIL"
echo "$DIVIDER"

# Load environment variables
for env_file in ".env" ".env.local"; do
    if [[ -f "$env_file" ]]; then
        set -a
        # shellcheck disable=SC1090
        . "$env_file"
        set +a
    fi
done

require_env() {
    local name=$1
    if [[ -z "${!name}" ]]; then
        echo "Error: Required env var '$name' is missing or empty." >&2
        exit 1
    fi
    return 0
}

require_secret() {
    local name=$1
    if ! gcloud secrets describe "$name" --project "$PROJECT_ID" --quiet &>/dev/null; then
        echo "Error: Secret '$name' not found in Secret Manager for project '$PROJECT_ID'." >&2
        echo "       Create it with: gcloud secrets create $name --project $PROJECT_ID --data-file=-" >&2
        exit 1
    fi
}

require_env "SUPABASE_URL"

# Enable required services before anything that calls the Secret Manager API.
echo "Enabling required Google Cloud APIs..."
gcloud services enable \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    secretmanager.googleapis.com \
    --project "$PROJECT_ID" --quiet

# Secrets must exist in Secret Manager — deploy no longer accepts them as local env vars.
require_secret "SUPABASE_SERVICE_ROLE_KEY"
require_secret "SUPABASE_ANON_KEY"

# SERVER_VERSION is used to bust client caches (e.g., ChatGPT tool metadata).
# If not explicitly set, default to the current git commit SHA.
if [[ -n "$SERVER_VERSION" ]]; then
    SERVER_VERSION_VALUE="$SERVER_VERSION"
elif command -v git &> /dev/null && git rev-parse --is-inside-work-tree &> /dev/null; then
    SERVER_VERSION_VALUE="$(git rev-parse --short HEAD)"
else
    SERVER_VERSION_VALUE="1.0.0"
fi

# Verify or create SA
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" --quiet &>/dev/null; then
    echo "Creating service account: $SA_EMAIL..."
    gcloud iam service-accounts create "$SA_NAME" \
        --project "$PROJECT_ID" \
        --display-name "Supascribe Notes Cloud Run runtime SA"
fi

# Always ensure IAM bindings are present — gcloud is a no-op if the binding already exists.
for secret in SUPABASE_SERVICE_ROLE_KEY SUPABASE_ANON_KEY; do
    gcloud secrets add-iam-policy-binding "$secret" \
        --project "$PROJECT_ID" \
        --member "serviceAccount:$SA_EMAIL" \
        --role "roles/secretmanager.secretAccessor" --quiet
done

# Create Artifact Registry repo if needed
if ! gcloud artifacts repositories describe "$SERVICE_NAME" \
    --location="$REGION" --project "$PROJECT_ID" --quiet &>/dev/null; then
    echo "Creating Artifact Registry repository: $SERVICE_NAME..."
    gcloud artifacts repositories create "$SERVICE_NAME" \
        --repository-format=docker \
        --location="$REGION" \
        --project "$PROJECT_ID" \
        --description="Docker repository for $SERVICE_NAME"
fi

# Build and push image
IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT_ID/$SERVICE_NAME/$SERVICE_NAME:latest"
echo "Building: $IMAGE_URI"
gcloud beta builds submit --tag "$IMAGE_URI" . --project "$PROJECT_ID"

# Deploy to Cloud Run
# Check if service exists and get URL to set PUBLIC_URL
EXISTING_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" --project "$PROJECT_ID" --format 'value(status.url)' 2>/dev/null || true)

if [[ -n "$PUBLIC_URL" ]]; then
    echo "Using configured PUBLIC_URL: $PUBLIC_URL"
    ENV_VARS="SUPABASE_URL=$SUPABASE_URL,PUBLIC_URL=$PUBLIC_URL,SERVER_VERSION=$SERVER_VERSION_VALUE"
elif [[ -n "$EXISTING_URL" ]]; then
    echo "Found existing service URL: $EXISTING_URL"
    ENV_VARS="SUPABASE_URL=$SUPABASE_URL,PUBLIC_URL=$EXISTING_URL,SERVER_VERSION=$SERVER_VERSION_VALUE"
else
    echo "First deployment (or service not found)..."
    ENV_VARS="SUPABASE_URL=$SUPABASE_URL,SERVER_VERSION=$SERVER_VERSION_VALUE"
fi

# Deploy to Cloud Run — secrets are resolved at runtime from Secret Manager, never passed via CLI.
echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_URI" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --allow-unauthenticated \
    --port "$PORT" \
    --timeout=600 \
    --max-instances=1 \
    --service-account "$SA_EMAIL" \
    --set-env-vars "$ENV_VARS" \
    --set-secrets "SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,SUPABASE_ANON_KEY=SUPABASE_ANON_KEY:latest"

# If it was a first deploy (or URL changed, unlikely), and we didn't set PUBLIC_URL, update it now
if [[ -z "$EXISTING_URL" && -z "$PUBLIC_URL" ]]; then
    NEW_URL=$(gcloud run services describe "$SERVICE_NAME" \
        --region "$REGION" --project "$PROJECT_ID" --format 'value(status.url)')

    echo "Updating new service with PUBLIC_URL=$NEW_URL..."
    gcloud run services update "$SERVICE_NAME" \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --update-env-vars "PUBLIC_URL=$NEW_URL"
fi

read -r SERVICE_URL ACTIVE_REVISION < <(
    gcloud run services describe "$SERVICE_NAME" \
        --region "$REGION" --project "$PROJECT_ID" \
        --format='value(status.url,status.latestReadyRevisionName)'
)

# Delete all revisions not currently serving traffic
echo "Cleaning up old revisions..."

if [[ -z "$ACTIVE_REVISION" ]]; then
    echo "  Could not determine the active revision — skipping cleanup to avoid deleting a serving revision." >&2
else
    # Read into an array with a loop rather than `mapfile`: mapfile is a bash 4.0
    # builtin and macOS ships bash 3.2, where this step aborts the whole deploy
    # after the service has already rolled out.
    STALE_REVISIONS=()
    while IFS= read -r revision; do
        [[ -n "$revision" ]] && STALE_REVISIONS+=("$revision")
    done < <(
        gcloud run revisions list \
            --service "$SERVICE_NAME" \
            --region "$REGION" \
            --project "$PROJECT_ID" \
            --format='value(metadata.name)' \
            | grep -Fvx "$ACTIVE_REVISION"
    )

    if [[ ${#STALE_REVISIONS[@]} -eq 0 ]]; then
        echo "  No stale revisions to delete."
    else
        echo "  Deleting ${#STALE_REVISIONS[@]} revision(s): ${STALE_REVISIONS[*]}"
        # One call per revision: `gcloud run revisions delete` accepts a single
        # revision and rejects the whole invocation with "unrecognized arguments"
        # when handed more, which `|| true` then swallows — so passing the array
        # deleted nothing at all whenever there was more than one stale revision.
        for revision in "${STALE_REVISIONS[@]}"; do
            gcloud run revisions delete "$revision" \
                --region "$REGION" --project "$PROJECT_ID" --quiet 2>&1 \
                || echo "  Warning: failed to delete $revision" >&2
        done
    fi
fi

echo ""
echo "$DIVIDER"
echo "DEPLOYMENT COMPLETE"
echo "$DIVIDER"
echo "Service URL: $SERVICE_URL"
echo ""
echo "Smoke test:"
echo "  curl $SERVICE_URL/status"
echo "$DIVIDER"
