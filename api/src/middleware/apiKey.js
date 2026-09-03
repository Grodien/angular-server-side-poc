import { config } from '../config.js';

/**
 * Protects routes by requiring a valid API key.
 *
 * The key may be provided either via the `x-api-key` header (preferred) or as
 * the `apiKey` query parameter (e.g. /companies?apiKey=DUMMY123).
 *
 * Note: passing the key in the URL is less secure than the header, since it can
 * end up in server logs, browser history and referrer headers.
 */
export function requireApiKey(req, res, next) {
  const provided = req.get('x-api-key') ?? req.query.apiKey;

  if (!provided || provided !== config.apiKey) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing API key' });
  }

  next();
}
