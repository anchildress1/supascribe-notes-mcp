import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  WriteCardsInputSchema,
  CardIdInputSchema,
  EmptyInputSchema,
  SearchCardsInputSchema,
} from './schemas/card.js';
import type { WriteCardsInput, CardIdInput, SearchCardsInput } from './schemas/card.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from './lib/supabase.js';
import type { Config } from './config.js';
import { handleHealth } from './tools/health.js';
import { handleWriteCards } from './tools/write-cards.js';
import {
  handleLookupCardsById,
  handleLookupCategories,
  handleLookupProjects,
  handleLookupTags,
  handleSearchCards,
} from './tools/lookup-tools.js';
import { logger } from './lib/logger.js';
import { requestLogger } from './middleware/request-logger.js';
import { SupabaseTokenVerifier } from './lib/auth-provider.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { renderAuthPage } from './views/auth-view.js';
import { renderHelpPage } from './views/help-view.js';
import { createOpenApiSpec } from './lib/openapi.js';
import cors from 'cors';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { AnySchema, ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { randomUUID } from 'node:crypto';
import type { CorsOptions } from 'cors';

export function stripJsonSchemaKeywords(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripJsonSchemaKeywords);

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === '$schema' || k === 'default') continue;
    out[k] = stripJsonSchemaKeywords(v);
  }
  return out;
}

function sendToolResult(res: express.Response, result: CallToolResult): void {
  if (result.isError) {
    const errorText = result.content[0].type === 'text' ? result.content[0].text : 'Unknown error';
    try {
      res.status(500).json(JSON.parse(errorText));
    } catch {
      res.status(500).json({ error: errorText });
    }
    return;
  }

  const successText = result.content[0].type === 'text' ? result.content[0].text : '{}';
  try {
    res.json(JSON.parse(successText));
  } catch {
    res.json({ result: successText });
  }
}

export function createApp(config: Config): express.Express {
  const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  const allowedCorsOrigins = new Set<string>();
  const addAllowedOrigin = (origin: string, source: 'PUBLIC_URL' | 'CORS_ORIGINS'): void => {
    try {
      allowedCorsOrigins.add(new URL(origin).origin);
    } catch {
      logger.warn({ origin, source }, 'Ignoring invalid CORS origin');
    }
  };

  addAllowedOrigin(config.publicUrl, 'PUBLIC_URL');

  const extraCorsOrigins = (process.env['CORS_ORIGINS'] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  for (const origin of extraCorsOrigins) {
    addAllowedOrigin(origin, 'CORS_ORIGINS');
  }

  const app = express();
  app.set('trust proxy', 1);

  // Health check
  app.get('/status', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: config.serverVersion,
    });
  });

  // Restrict CORS to explicit origins; allow requests without Origin header.
  const corsOptions: CorsOptions = {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      try {
        const normalizedOrigin = new URL(origin).origin;
        callback(null, allowedCorsOrigins.has(normalizedOrigin));
      } catch {
        callback(null, false);
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Mcp-Session-Id', 'MCP-Protocol-Version'],
  };

  app.locals.allowedCorsOrigins = allowedCorsOrigins;
  app.locals.corsOptions = corsOptions;
  app.use(cors(corsOptions));

  app.use(express.json());

  // Request logging middleware
  app.use(requestLogger);

  const authVerifier = new SupabaseTokenVerifier(supabase);

  // OAuth Authorization UI endpoint
  app.get('/auth/authorize', (req, res) => {
    res.type('text/html').send(renderAuthPage(config));
  });

  // OpenAPI Spec
  app.get('/openapi.json', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    const spec = createOpenApiSpec(config.publicUrl, config.serverVersion);
    res.json(spec);
  });

  // REST Health Check (matches /status)
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Root endpoint - User facing help page
  app.get('/', (req, res) => {
    // Redirect to MCP endpoint if client prefers text/event-stream
    // This helps MCP clients that are configured with the root URL
    const preferred = req.accepts(['html', 'text/event-stream']);
    if (preferred === 'text/event-stream') {
      res.redirect(307, '/mcp');
      return;
    }

    res.type('text/html').send(renderHelpPage());
  });

  // OAuth Discovery Endpoint
  app.get('/.well-known/oauth-authorization-server', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.json({
      issuer: `${config.supabaseUrl}/auth/v1`,
      authorization_endpoint: `${config.supabaseUrl}/auth/v1/oauth/authorize`,
      token_endpoint: `${config.supabaseUrl}/auth/v1/oauth/token`,
      jwks_uri: `${config.supabaseUrl}/auth/v1/.well-known/jwks.json`,
      scopes_supported: [],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
      pkce_required: true,
    });
  });

  // OAuth Protected Resource Metadata
  app.get('/.well-known/oauth-protected-resource', (_req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.json({
      resource: config.supabaseUrl,
      authorization_servers: [`${config.supabaseUrl}/auth/v1`],
      scopes_supported: [],
      bearer_methods_supported: ['header'],
    });
  });

  app.get('/.well-known/oauth-protected-resource/mcp', (_req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.json({
      resource: config.supabaseUrl,
      authorization_servers: [`${config.supabaseUrl}/auth/v1`],
      scopes_supported: [],
      bearer_methods_supported: ['header'],
    });
  });

  // Handle incorrect path appended by ChatGPT.
  // Only `authorization_id` (validated as UUID) is forwarded; all other params are dropped.
  app.get('/mcp/auth/authorize', (req, res) => {
    const raw = req.query['authorization_id'];
    const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
    const authId = typeof raw === 'string' && UUID_RE.test(raw) ? raw : null;
    const target =
      authId != null ? `/auth/authorize?authorization_id=${authId}` : '/auth/authorize';
    res.redirect(307, target); // nosemgrep: javascript.express.web.tainted-redirect-express.tainted-redirect-express
  });

  // Auth Middleware
  const authenticate = createAuthMiddleware(authVerifier, config.publicUrl);

  // Store active streamable HTTP transports by MCP session ID.
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const createStreamableTransport = async (): Promise<StreamableHTTPServerTransport> => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      onsessioninitialized: (sessionId) => {
        transports.set(sessionId, transport);
        logger.info({ sessionId }, 'MCP session initialized');
      },
      onsessionclosed: (sessionId) => {
        transports.delete(sessionId);
        logger.info({ sessionId }, 'MCP session closed');
      },
    });
    const server = createMcpServer(supabase, config.serverVersion);
    try {
      await server.connect(transport);
      return transport;
    } catch (error) {
      try {
        await transport.close();
      } catch (closeError) {
        logger.warn(
          { error: closeError },
          'Failed to close transport after server.connect failure',
        );
      }
      throw error;
    }
  };

  const handleMcpRequest = async (req: express.Request, res: express.Response) => {
    const sessionIdHeader = req.header('mcp-session-id');
    let transport = sessionIdHeader ? transports.get(sessionIdHeader) : undefined;
    const isNewTransport = !transport;

    if (sessionIdHeader && !transport) {
      logger.warn(
        { sessionId: sessionIdHeader, method: req.method },
        'MCP request for unknown session',
      );
      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session not found' },
        id: null,
      });
      return;
    }

    try {
      if (!transport) {
        transport = await createStreamableTransport();
      }
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error(
        { error, sessionId: sessionIdHeader, method: req.method },
        'Failed to handle MCP request',
      );
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error' },
          id: null,
        });
      }
    } finally {
      // Invalid pre-init requests use a one-off transport and should not linger.
      if (isNewTransport && transport && !transport.sessionId) {
        await transport.close();
      }
    }
  };

  // Streamable HTTP MCP endpoint.
  app.all('/mcp', authenticate, handleMcpRequest);

  // ChatGPT Apps Action: Write Cards
  app.post('/api/write-cards', authenticate, async (req, res) => {
    try {
      logger.info('Received write-cards request from ChatGPT/App');
      const bodyResult = WriteCardsInputSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: 'Validation failed', details: bodyResult.error });
        return;
      }

      // Reuse the MCP tool logic
      const result = await handleWriteCards(supabase, bodyResult.data.cards);
      sendToolResult(res, result);
    } catch (err) {
      logger.error({ error: err }, 'REST write-cards failed');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/lookup-card-by-id', authenticate, async (req, res) => {
    try {
      logger.info('Received lookup-card-by-id request from ChatGPT/App');
      const bodyResult = CardIdInputSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: 'Validation failed', details: bodyResult.error });
        return;
      }

      const result = await handleLookupCardsById(
        supabase,
        bodyResult.data.ids,
        bodyResult.data.include_deleted,
      );
      sendToolResult(res, result);
    } catch (err) {
      logger.error({ error: err }, 'REST lookup-card-by-id failed');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/lookup-categories', authenticate, async (_req, res) => {
    try {
      logger.info('Received lookup-categories request from ChatGPT/App');
      const result = await handleLookupCategories(supabase);
      sendToolResult(res, result);
    } catch (err) {
      logger.error({ error: err }, 'REST lookup-categories failed');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/lookup-projects', authenticate, async (_req, res) => {
    try {
      logger.info('Received lookup-projects request from ChatGPT/App');
      const result = await handleLookupProjects(supabase);
      sendToolResult(res, result);
    } catch (err) {
      logger.error({ error: err }, 'REST lookup-projects failed');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/lookup-tags', authenticate, async (_req, res) => {
    try {
      logger.info('Received lookup-tags request from ChatGPT/App');
      const result = await handleLookupTags(supabase);
      sendToolResult(res, result);
    } catch (err) {
      logger.error({ error: err }, 'REST lookup-tags failed');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/search-cards', authenticate, async (req, res) => {
    try {
      logger.info('Received search-cards request from ChatGPT/App');
      const bodyResult = SearchCardsInputSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: 'Validation failed', details: bodyResult.error });
        return;
      }

      const result = await handleSearchCards(supabase, bodyResult.data);
      sendToolResult(res, result);
    } catch (err) {
      logger.error({ error: err }, 'REST search-cards failed');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app;
}

export function createMcpServer(supabase: SupabaseClient, serverVersion = '1.0.0'): McpServer {
  const server = new McpServer({
    name: 'supascribe-notes-mcp',
    version: serverVersion,
  });

  const toolListForChatGPT: Array<Record<string, unknown>> = [];
  const recordToolForChatGPT = (tool: {
    name: string;
    title?: string;
    description?: string;
    inputSchema?: unknown;
    annotations?: unknown;
    _meta?: unknown;
  }) => {
    if (!tool.title || !tool.description) {
      logger.warn(
        { toolName: tool.name },
        'Skipping tool in ChatGPT tools/list output: missing title or description',
      );
      return;
    }
    if (!tool.inputSchema) {
      logger.warn(
        { toolName: tool.name },
        'Skipping tool in ChatGPT tools/list output: missing inputSchema',
      );
      return;
    }

    const inputSchema = stripJsonSchemaKeywords(
      zodToJsonSchema(tool.inputSchema as never, {
        target: 'openApi3',
        $refStrategy: 'none',
        pipeStrategy: 'input',
        strictUnions: true,
      }),
    );

    toolListForChatGPT.push({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema,
      annotations: tool.annotations,
      _meta: tool._meta,
    });
  };

  const registerToolAndRecord = <TArgs, TResult>(
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: AnySchema | ZodRawShapeCompat;
      annotations?: ToolAnnotations;
      _meta?: Record<string, unknown>;
    },
    cb: (args: TArgs) => Promise<TResult>,
  ) => {
    server.registerTool(name, config, cb as never);
    recordToolForChatGPT({ name, ...config });
  };

  registerToolAndRecord(
    'health',
    {
      title: 'Health Check',
      description: 'Check server and Supabase connectivity status',
      inputSchema: EmptyInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ['model', 'app'] },
      },
    },
    async () => handleHealth(supabase),
  );

  registerToolAndRecord(
    'write_cards',
    {
      title: 'Write Index Cards',
      description:
        'Validate and upsert index cards to Supabase with revision history. tags must include explicit tags.lvl0 and tags.lvl1 arrays.',
      inputSchema: WriteCardsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ['model', 'app'] },
      },
    },
    async ({ cards }: WriteCardsInput) => handleWriteCards(supabase, cards),
  );

  registerToolAndRecord(
    'lookup_card_by_id',
    {
      title: 'Lookup Cards by ID',
      description: 'Find specific index cards by UUID list.',
      inputSchema: CardIdInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ['model', 'app'] },
      },
    },
    async ({ ids, include_deleted }: CardIdInput) =>
      handleLookupCardsById(supabase, ids, include_deleted),
  );

  registerToolAndRecord(
    'lookup_categories',
    {
      title: 'Lookup Categories',
      description: 'Get a list of all unique categories used across all index cards',
      inputSchema: EmptyInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ['model', 'app'] },
      },
    },
    async () => handleLookupCategories(supabase),
  );

  registerToolAndRecord(
    'lookup_projects',
    {
      title: 'Lookup Projects',
      description: 'Get a list of all unique project identifiers used across all index cards',
      inputSchema: EmptyInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ['model', 'app'] },
      },
    },
    async () => handleLookupProjects(supabase),
  );

  registerToolAndRecord(
    'lookup_tags',
    {
      title: 'Lookup Tags',
      description: 'Get a list of all unique lvl0 and lvl1 tags used across all index cards',
      inputSchema: EmptyInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ['model', 'app'] },
      },
    },
    async () => handleLookupTags(supabase),
  );

  registerToolAndRecord(
    'search_cards',
    {
      title: 'Search Cards',
      description:
        'Search cards with keyword filters for category, tag, project, or fact. Use short keywords only, not full sentences.',
      inputSchema: SearchCardsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ['model', 'app'] },
      },
    },
    async (filters: SearchCardsInput) => handleSearchCards(supabase, filters),
  );

  // Replace `tools/list` with a schema-sanitized version for ChatGPT compatibility.
  // In unit tests, McpServer is mocked and may not expose `.server`.
  type ProtocolServer = {
    setRequestHandler: (
      requestSchema: typeof ListToolsRequestSchema,
      handler: () => { tools: Array<Record<string, unknown>> },
    ) => void;
  };

  const protocolServer = (server as unknown as { server?: ProtocolServer }).server;
  if (protocolServer?.setRequestHandler) {
    protocolServer.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: toolListForChatGPT,
    }));
  } else {
    logger.warn(
      'MCP tools/list override could not be installed; MCP SDK internals may have changed',
    );
  }

  return server;
}
