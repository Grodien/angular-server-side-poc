import { Router } from 'express';
import { query } from '../db/pool.js';

export const companyRouter = Router();

// Fields that clients are allowed to write.
const WRITABLE_FIELDS = ['code', 'short_name', 'tenant_id'];

function pickBody(body) {
  const result = {};
  for (const field of WRITABLE_FIELDS) {
    if (body[field] !== undefined) {
      result[field] = body[field];
    }
  }
  return result;
}

// GET /companies - list all companies
companyRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM company ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /companies/:id - get a single company
companyRouter.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM company WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /companies - create a company
// The "company" table has no sequence on "id", so we derive the next id.
companyRouter.post('/', async (req, res, next) => {
  try {
    const data = pickBody(req.body);
    if (!data.code) {
      return res.status(400).json({ error: 'Field "code" is required' });
    }

    const { rows } = await query(
      `INSERT INTO company (id, code, short_name, tenant_id)
       VALUES (
         (SELECT COALESCE(MAX(id), 0) + 1 FROM company),
         $1, $2, $3
       )
       RETURNING *`,
      [data.code, data.short_name ?? null, data.tenant_id ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /companies/:id - update a company
companyRouter.put('/:id', async (req, res, next) => {
  try {
    const data = pickBody(req.body);
    const fields = Object.keys(data);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    const setClauses = fields.map((field, index) => `${field} = $${index + 1}`);
    const values = fields.map((field) => data[field]);
    values.push(req.params.id);

    const { rows } = await query(
      `UPDATE company SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /companies/:id - delete a company
companyRouter.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM company WHERE id = $1', [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
