import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();

// Hosts allowed to reach the SSR engine (SSRF protection).
// Configurable via NG_ALLOWED_HOSTS (comma-separated) with sensible local defaults.
const allowedHosts = (process.env['NG_ALLOWED_HOSTS'] ?? 'localhost,127.0.0.1')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

const angularApp = new AngularNodeAppEngine({ allowedHosts });

/**
 * Backend API configuration.
 * The API key is read from the server environment and NEVER sent to the browser.
 * There is intentionally NO public JSON proxy: the backend API is only reached
 * from within this SSR process (reads during render, writes via the form
 * handlers below). The browser never talks to the API directly.
 */
const API_BASE_URL = process.env['API_BASE_URL'] || 'http://127.0.0.1:3000';
const API_KEY = process.env['API_KEY'] || 'DUMMY123';

function apiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };
}

/**
 * Transparent pass-through proxy to the backend API.
 *
 * Unlike the form handlers below, this endpoint does NOT inject the API key.
 * Everything the client sends (headers such as `x-api-key`, query parameters
 * such as `?apiKey=`, method and body) is forwarded unchanged to the backend.
 * The caller is responsible for supplying a valid API key themselves.
 *
 * Example: GET /api/companies?apiKey=DUMMY123
 *          GET /api/companies  with header  x-api-key: DUMMY123
 *
 * The raw body parser keeps the payload untouched so any content type passes
 * through faithfully. This must be registered before the form body parser.
 */
app.use('/api', express.raw({ type: '*/*', limit: '5mb' }));

app.all('/api/{*path}', async (req, res) => {
  // Strip the leading "/api" prefix and keep the original query string.
  const subPath = req.originalUrl.replace(/^\/api/, '') || '/';
  const target = `${API_BASE_URL}${subPath}`;

  // Forward the client's headers as-is (no key injection). Drop hop-by-hop and
  // host headers that must not be forwarded.
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    const lower = name.toLowerCase();
    if (lower === 'host' || lower === 'connection' || lower === 'content-length') {
      continue;
    }
    if (typeof value === 'string') {
      headers[name] = value;
    }
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const body =
    hasBody && Buffer.isBuffer(req.body) && req.body.length > 0
      ? new Uint8Array(req.body)
      : undefined;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
    });

    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    if (upstream.status === 204) {
      res.end();
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    console.error('API proxy request failed:', error);
    res.status(502).json({ error: 'Bad gateway: backend API unreachable' });
  }
});

// Parse HTML form submissions (application/x-www-form-urlencoded).
app.use(express.urlencoded({ extended: false }));

/**
 * Server-side form handlers (Post/Redirect/Get).
 *
 * These endpoints accept classic HTML form posts from the rendered page,
 * perform the write against the backend API with the secret key, and then
 * redirect back to "/" so the Angular app re-renders with fresh data.
 *
 * They return no JSON and expose no data, so they cannot be used as a generic
 * API proxy from the browser.
 */
app.post('/companies/create', async (req, res) => {
  try {
    const upstream = await fetch(`${API_BASE_URL}/companies`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({
        code: req.body.code,
        short_name: req.body.short_name || null,
        tenant_id: req.body.tenant_id ? Number(req.body.tenant_id) : null,
      }),
    });
    if (!upstream.ok) {
      console.error('Create failed:', upstream.status, await upstream.text());
    }
  } catch (error) {
    console.error('Create request failed:', error);
  }
  res.redirect('/');
});

app.post('/companies/:id/update', async (req, res) => {
  try {
    const upstream = await fetch(`${API_BASE_URL}/companies/${req.params['id']}`, {
      method: 'PUT',
      headers: apiHeaders(),
      body: JSON.stringify({
        code: req.body.code,
        short_name: req.body.short_name || null,
        tenant_id: req.body.tenant_id ? Number(req.body.tenant_id) : null,
      }),
    });
    if (!upstream.ok) {
      console.error('Update failed:', upstream.status, await upstream.text());
    }
  } catch (error) {
    console.error('Update request failed:', error);
  }
  res.redirect('/');
});

app.post('/companies/:id/delete', async (req, res) => {
  try {
    const upstream = await fetch(`${API_BASE_URL}/companies/${req.params['id']}`, {
      method: 'DELETE',
      headers: apiHeaders(),
    });
    if (!upstream.ok && upstream.status !== 204) {
      console.error('Delete failed:', upstream.status, await upstream.text());
    }
  } catch (error) {
    console.error('Delete request failed:', error);
  }
  res.redirect('/');
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
