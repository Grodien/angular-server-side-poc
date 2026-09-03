import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { requireApiKey } from './middleware/apiKey.js';
import { companyRouter } from './routes/company.js';

const app = express();

app.use(cors());
app.use(express.json());

// Public health check (no API key required)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// All routes below require a valid API key
app.use('/companies', requireApiKey, companyRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Central error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Bind explicitly to IPv4 loopback so clients using 127.0.0.1 (e.g. Node's
// fetch, which may resolve "localhost" to IPv6) can reach the API reliably.
const host = process.env.HOST ?? '127.0.0.1';
app.listen(config.port, host, () => {
  console.log(`API listening on http://${host}:${config.port}`);
});
