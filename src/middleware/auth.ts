import type { Request, Response, NextFunction } from 'express';
import type { SupabaseTokenVerifier } from '../lib/auth-provider.js';
import { logger } from '../lib/logger.js';

interface AuthenticatedRequest extends Request {
  /**
   * The authenticated user info from Supabase
   */
  user?: {
    id: string;
  };
}

export interface AuthMiddlewareOptions {
  /**
   * When true, never send the browser-friendly HTML 401 page — always send a
   * plain-text 401 with a WWW-Authenticate challenge. Required for the MCP
   * protocol endpoint, which must let clients discover the OAuth flow
   * regardless of what Accept header they happen to send.
   */
  suppressHtml?: boolean;
}

export function createAuthMiddleware(
  authVerifier: SupabaseTokenVerifier,
  publicUrl: string,
  options: AuthMiddlewareOptions = {},
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    let token: string | undefined;
    const bearerPrefix = 'bearer ';

    // 1. Try Authorization header (case-insensitive)
    const normalizedAuthHeader = authHeader?.trim();
    if (normalizedAuthHeader?.toLowerCase().startsWith(bearerPrefix)) {
      const extractedToken = normalizedAuthHeader.slice(bearerPrefix.length).trim();
      if (extractedToken.length > 0) {
        token = extractedToken;
      }
    } else if (normalizedAuthHeader) {
      logger.warn(
        { authHeader: normalizedAuthHeader.substring(0, 10) + '...' },
        'Authorization header present but invalid format',
      );
    }

    if (!token) {
      // Check for browser navigation (Accept header includes text/html).
      // Callers that must always get a machine-readable 401 (e.g. the MCP
      // protocol endpoint) pass suppressHtml so clients can discover the
      // OAuth flow via the WWW-Authenticate challenge below.
      if (req.accepts('html') && !options.suppressHtml) {
        res.status(401).type('text/html').send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Authentication Required</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  max-width: 600px;
                  margin: 40px auto;
                  padding: 20px;
                  text-align: center;
                  line-height: 1.6;
                  color: #333;
                }
                h1 {
                  font-size: 24px;
                  margin-bottom: 20px;
                }
                p {
                  margin-bottom: 10px;
                  font-size: 16px;
                }
                .logo {
                  font-size: 48px;
                  margin-bottom: 20px;
                }
              </style>
            </head>
            <body>
              <div class="logo">🔐</div>
              <h1>Authentication Required</h1>
              <p>This is a Supabase MCP Server. It requires a valid authorization token to access.</p>
              <p>Please return to your MCP Client (e.g. ChatGPT) to verify your credentials and finish linking.</p>
            </body>
          </html>
        `);
        return;
      }

      const resourceMetadataUrl = `${publicUrl}/.well-known/oauth-protected-resource`;

      res.set('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadataUrl}"`);
      res.type('text/plain').status(401).send('Unauthorized');
      return;
    }

    // Check OAuth Token
    try {
      const authInfo = await authVerifier.verifyAccessToken(token);
      (req as AuthenticatedRequest).user = { id: authInfo.clientId };
      next();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn({ error: errorMessage }, 'Authentication failed');
      // If the token is invalid, we can technically also send the challenge,
      // but a 401 with "Invalid token" is also acceptable.
      // To be safe and help clients discover the config, let's include the header here too.
      const resourceMetadataUrl = `${publicUrl}/.well-known/oauth-protected-resource`;

      res.set(
        'WWW-Authenticate',
        `Bearer resource_metadata="${resourceMetadataUrl}", error="invalid_token"`,
      );
      return res.type('text/plain').status(401).send('Invalid token');
    }
  };
}
