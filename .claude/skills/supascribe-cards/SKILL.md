---
name: supascribe-cards
description: "Invoke for any operation on the user's Supascribe index card system: create, write, log, audit, or review cards, and any reference to the index-card knowledge system. Mandatory whenever cards are involved."
---

Call `write_cards` only when every gate holds:

1. Pre-flight ran this session.
2. The user confirmed every proposed title and fact in chat.
3. Every category is in `lookup_categories` output.
4. Every lvl0/lvl1 tag is in `lookup_tags` output.
5. Every card passes the decision test and the fact constraints.
6. No fact names its own virtue.
7. Every claim traces to a user turn, not an assistant's summary.

Never call `write_cards` during an audit. Reporting zero cards is a valid result.

## Reader

- Write every field for a recruiter, hiring manager, or technical peer with no context beyond the card.
- Never card resume material: tenure, role progression, employer achievements, certifications. The About page owns it.
- Never card blog content. The blog is indexed separately.

## Pre-flight — parallel, every session

| Call                | Rule                                                                      |
| ------------------- | ------------------------------------------------------------------------- |
| `lookup_projects`   | Project key must exist verbatim. Absent → stop and ask. Never invent one. |
| `lookup_categories` | Only legal category values. Re-read every session; the registry changes.  |
| `lookup_tags`       | Only legal lvl0/lvl1 values. Needed tag absent → surface it and stop.     |
| `search_cards`      | Sample 5–10 live cards per target category for calibration.               |

Discard every row with non-null `deleted_at` from calibration, duplicate checks, and audits.

## Decision test

Pass only if something was decided and the card says why, backed by pointable evidence: an incident, artifact, number, named alternative, or dated event. Naming the project is not evidence — "In SupaScribe Notes MCP, I avoid workarounds" fails.

Draft each card as fork (what was on the table) → call (which way the user went) → cost (why the rejected path lost). No fork → no card. Never invent a fork. Never label the slots in the fact.

### Accept

- A choice with a named alternative that lost for a technical reason: measurement, failure mode, mechanism, or hard limit.
- A reversal tied to an incident: what happened, what changed after.
- A milestone with measurable scale: a number, a before/after.
- A constraint with a reason.
- A constraint kept when relaxing it was cheap. Name both easy outs and why neither was taken.
- A lesson from a concrete failure, especially one where the user admits being wrong.
- Fact of experience: a named project AND a named tool, framework, or domain. No decision required.

### Reject

- Dispositions and self-description: "I challenge assumptions instinctively", "guardrails are necessary".
- Restated rules from `AGENTS.md`, `PRD.md`, `CONTRIBUTING.md`, or README policy sections.
- Tutorials on how a domain works.
- Workflow minutiae any practitioner does by default.
- What a tool does instead of what the user decided.
- Biographical filler with no project, tool, domain, or decision: birthplace, relocation, place sentiment, music, aptitude tests.
- Routine product calls, even with a fork: scope or deadline cuts, UI copy, warning wording, dismiss/timeout behavior, compliance disclosures, playtest reversals, test-scaffolding framing, naming.
- Taste iteration: color, layout, font, or visual direction picked by elimination; attempt counts ("ten versions"). Cardable only as a constraint collision with a named resolution, or a tool that demonstrably failed to solve it.
- Slogan titles with no decision attached.
- Status notes, except as below.

### Edge cases

- Status note: at most one per project, signal ≤ 2, and only when it stops a reader assuming the project is dead or finished ("design-only", "originated as a hackathon build").
- Experience vs filler: can the reader point at something? "Carbon Trace exposed me to GSAP, Howler, Canvas2D, and PixiJS" passes. "Earlier work lived on internal systems" fails, yet the user keeps it as the one card explaining a decade-long gap in public GitHub history. Send calls like that to the user.
- Borderline → surface it. Never include silently.

### Zero cards

- No fork in the material → say so and stop.
- Never reframe rejected material until it passes, downgrade it to a status note, or offer a weaker card as consolation.
- Apply a user's rejection to the neighbouring candidates. Three rejections in a row means the source has no fork.

## Fields

### title

- A complete claim that transmits the lesson alone. It is the only free-text keyword surface.
- Accept: "DATA_LICENSES.md collapsed from 1,844 lines to 273" · "Stopped guessing emails after two same-day bounces" · "I raised the model's temperature from 0 to 0.4 and moved the guardrails into SQL" · "The model wrote 'fifty-six commits after midnight' about forty-seven".
- Reject: labels ("Stack: SvelteKit + Tailwind"), meta ("About the project"), slogans ("Restraint is a deliberate engineering choice").
- If the title needs a second sentence to make sense, rewrite the title.

### blurb — retired

- Never author one. Omit the field on create and update. Dropping a legacy blurb on update is fine.
- A legacy blurb is not a defect and never grounds for demotion.

### fact

- 30–50 words. Under 30 → reject.
- 1–3 sentences: claim → reasoning → stop. A fourth sentence means two cards; split.
- First person, past tense. No `I` → re-check that it is a decision, not a system description.
- Never third person ("Ashley reframed it", "the author is a perfectionist").
- No repo paths, "source of truth lives in", "see file X", or "rejected: A, B, C" lists.
- No pitch: "the moat", "the differentiator", "deliberately rejects", "this is the advantage", or arguing with a skeptic ("Web search confirms the pattern is novel").
- `fact` is not keyword-searchable. Write it for a model that already retrieved the card.

Accept:

> "Registries publish full physical addresses. I store first name, last name, state, and country, and drop the street address — republishing home addresses at dataset scale is PII I don't want to carry and a lawsuit surface I don't want to defend."

Reject, too thin: "Satisfaction comes from knowing the work is directionally correct rather than fully complete."

Reject, system voice: "The index operates under a closed-world assumption and explicitly avoids inferring information not present in canonical entries."

Voice to match: "I separated telemetry from identity data." · "I capped the agent at one lookup, then removed the cap." · "The crawler worked. I did not need it and the search tool both."

### Virtue rule

- State the decision and why the alternative lost. Never name the virtue it embodies.
- Test: delete every abstract noun (predictability, quality, restraint, responsibility, performance, reuse, autonomy, privacy, epistemics, ownership). If nothing remains, the card was a label.
- Reject: "I believe linters, formatters, and guardrails are necessary to keep systems stable and predictable."
- Accept: "I moved lint config into a shared package after the third repo diverged on import ordering. Every project now inherits rules it cannot locally override, which costs flexibility I decided nobody was using well."

### url

Public URLs only: standards, articles, registry sites, DEV announcement posts.

## Index behavior

| Field       | Searchable | Facet |
| ----------- | ---------- | ----- |
| `title`     | ordered    | —     |
| `projects`  | unordered  | ✅    |
| `category`  | unordered  | ✅    |
| `tags.lvl1` | unordered  | ✅    |
| `tags.lvl0` | ❌         | ✅    |
| `fact`      | ❌         | —     |

- `signal` is a hidden sort key, descending. `created_at_epoch` breaks ties.
- `title`, `blurb`, and `fact` are UNIQUE. Near-duplicates differing by one word exist to dodge it; differing text never proves two cards distinct.

## Atomicity and duplication

- One claim per card. Decision + rationale + rejected alternative + footnote = 3–4 cards. Default to splitting.
- Same claim twice in one project → cut one.
- Same claim across projects → keep both; repetition across projects is the proof. Rewrite each with its own project's specifics. Never demote or delete for cross-project repetition.
- Before drafting, count live cards in the same project carrying the claim. One or more → the candidate needs a different claim. A user restating a familiar trait wants emphasis; card the occasion that trait was contradicted instead.

## Dated truth

Judge every card against the day it was written, never against today.

| Card is                                          | Action                                      |
| ------------------------------------------------ | ------------------------------------------- |
| Wrong — never happened                           | Delete                                      |
| Superseded — true then, decision later changed   | Demote, keep live, write a new card         |
| Stale config — recorded a value that later moved | Demote; it recorded a setting, not a reason |

- Record what was weighed, not the setting's value. Values rot; reasons don't.
- A changed claim is a new card with a new ID and date. Keep the old card live and demote it via signal. No `supersedes` field exists.
- Edit in place only for typos, tag fixes, category moves, and voice fixes that keep the claim.
- "Make the old cards reflect the change" means write the new card. Say so, ask for the fork behind the change, and never bulk-edit a project's cards for it.

## Signal — 1 to 10, a sort key

|        | Meaning                     | Test                                                       |
| ------ | --------------------------- | ---------------------------------------------------------- |
| **10** | Proven outcome              | External, competitive validation — award, competitive win  |
| **9**  | Position with a cost        | The user would defend it in an interview and name the cost |
| **8**  | Decision, alternative named | The rejected option appears in the text                    |
| **7**  | Decision with a reason      | Alternative implied, not stated                            |
| **6**  | Decision, thin reasoning    | Something was chosen; the why is weak                      |
| **5**  | Lesson from an event        | Something happened and the user learned from it            |
| **4**  | Fact of experience          | Named tool, named project, no decision                     |
| **3**  | Description                 | What the system does                                       |
| **2**  | Status or participation     | "I entered X", "currently design-only"                     |
| **1**  | Label                       | Names a virtue, contains no decision                       |

- 8 vs 7 is the line that matters: is the rejected option written in the fact?
- Awards from the user's own employer cap at 4–6.
- Target a pyramid; no bucket over ~20% of the corpus.
- Signal 1 → propose deletion.
- Vary signal. Never bulk-assign.
- `write_cards` and the database both accept 1–10.

## Categories

Use only `lookup_categories` output; names drift between singular and plural and get retired. Intent guide:

| Category               | Use for                                                                           |
| ---------------------- | --------------------------------------------------------------------------------- |
| About                  | Project-level introduction. Rare. Never biography.                                |
| Decisions              | Specific choices. Most common.                                                    |
| Constraints            | What the system won't do.                                                         |
| Principle / Principles | Invariants the user follows.                                                      |
| Philosophy             | Deeper values driving the work.                                                   |
| Practice / Process     | How work gets done.                                                               |
| Architecture           | Structural design, including how an agent or index the user built behaves.        |
| Experience             | External truths treated as load-bearing.                                          |
| Experimentation        | Open-ended exploratory choices.                                                   |
| Work Style             | How the user works — never how the user's systems work. Check Architecture first. |

## Tags

- 1–4 lvl0 and 2–5 lvl1 per card.
- Exactly one `Principle > *` per card. A card that genuinely serves two → ask the user.
- `Principle > Restraint` is the most over-applied tag. Use it only when the card is about declining to do something AND no row below names the reason:

| Card is about                                                    | Tag                   |
| ---------------------------------------------------------------- | --------------------- |
| Speed, latency, responsiveness, avoiding recalculation           | Performance           |
| Refusing to guess, closed-world assumptions, not fabricating     | Epistemics            |
| Attribution, disclosure, accountability, who authored what       | Responsibility        |
| Stability, repeatability, deterministic behavior, guardrails     | Predictability        |
| PII, legal exposure, dropping sensitive fields                   | Privacy               |
| Packaging patterns, shared config, encode-once                   | Reuse                 |
| Observability, health checks, inspectable runtime state          | Operational Ownership |
| Local control, licensing, self-direction, no external dependency | Autonomy              |
| Contrast, screen readers, WCAG, color-blind safety               | Accessibility         |

- A card naming an employer or institution with a matching `Issuer > *` tag gets that tag. Cards with no project and no issuer are unreachable by every facet.

## Write protocol

1. Pre-flight.
2. Drop routine calls, then list candidates as short titles. The user picks; expect cuts, possibly all.
3. Confirm the project key. New → ask for it verbatim.
4. Show titles + facts in chat. No blurbs.
5. Call `write_cards` after explicit confirmation. Batch ≤ 8; the schema allows 50.
6. Report the returned IDs.

### Update

- Fetch the full record and resend `objectID`, `title`, `fact`, `tags`, `category`, `signal`, `projects`, and `url`. Omitted fields are not preserved. Omit `blurb`.
- Without `objectID`, `write_cards` creates a new card instead of updating; an unchanged title or fact then fails the UNIQUE check.
- Use only UUIDs returned by a tool call this session. A UUID missing from a lookup → find the card by content search; never retry the ID.

### Bulk metadata — `signal`, `deleted_at`, tags only

- Prefer direct SQL; retyping facts through `write_cards` risks silent corruption.
- Tell the user first that SQL bypasses `card_revisions` and leaves no audit trail.
- Never apply DDL without asking. Migrations live in the repository.

### Delete

- Soft delete by setting `deleted_at` to an ISO-8601 UTC timestamp. Only on the user's decision; propose, never execute unasked.
- The site's Algolia index updates only on a manual push. Report deletes as pending until it runs.

### Verify payloads

`write_cards` and `save_skill` save any string. Before sending, confirm the payload is the composed text, not a placeholder, summary, or file reference.

## Audit

1. Group by cohort first — creation date, category, project, signal distribution, word count. Quality tracks write date.
2. Fetch per project or tag via `search_cards`. Skip deleted rows.
3. Apply the decision test, fact constraints, virtue rule, dated truth, and Restraint rule.
4. Report violators grouped by project: title + objectID + one-line reason.
5. List close calls separately with both readings. Never resolve them.
6. Before calling a card false, check whether it was true when written.
7. Never call `write_cards`.

## Fuzzy requests

- "Card this up" or "log this" with no target → ask which thread, project, or decision.
- A request naming a thing ("card the redesign", "log the new page") → ask what was on the table and why the other option lost before drafting.

## Sourcing

| Source                                                           | Rule                                                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Chat history                                                     | Mine pivots, corrections, "stop doing X" moments, milestones, failure lessons.            |
| Repository                                                       | Mine code comments explaining a choice, trade-off config, CHANGELOG reversals.            |
| `AGENTS.md`, `PRD.md`, `CONTRIBUTING.md`, README policy sections | Never.                                                                                    |
| Blog posts and blog-drafting sessions                            | Never. The user's own asides inside a drafting session are allowed; label which is which. |

- Quote or paraphrase user turns only. Assistant turns — research summaries, web findings, inferences — are context, never evidence. One card claimed the user ran a tool an assistant had only researched.
- A user's paraphrase of a tool's or model's output is a feeling, not a finding.
- Flag in the proposal when evidence came from another session's transcript.
- Other sessions' transcripts are readable; their files (screenshots, drafts, outputs) are not. Never claim to have reviewed what you cannot open, never accept blame for another session's decisions, and ask for missing material.
