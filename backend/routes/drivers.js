import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all drivers
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    let queryText = 'SELECT * FROM drivers';
    const params = [];

    if (status) {
      queryText += ' WHERE status = $1';
      params.push(status);
    }

    queryText += ' ORDER BY name';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get driver by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM drivers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create driver
router.post('/',
  authorizeRoles('admin', 'manager'),
  [
    body('name').notEmpty().trim(),
    body('phone').optional().trim(),
    body('license_number').optional().trim()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        name, phone, license_number, license_expiry,
        address, joining_date, salary_amount, status, notes
      } = req.body;

      const result = await query(
        `INSERT INTO drivers (name, phone, license_number, license_expiry, address, joining_date, salary_amount, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [name, phone, license_number, license_expiry, address, joining_date, salary_amount, status || 'active', notes]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Update driver
router.put('/:id',
  authorizeRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const {
        name, phone, license_number, license_expiry,
        address, joining_date, salary_amount, status, notes
      } = req.body;

      const result = await query(
        `UPDATE drivers 
         SET name = $1, phone = $2, license_number = $3, license_expiry = $4,
             address = $5, joining_date = $6, salary_amount = $7, status = $8, notes = $9
         WHERE id = $10
         RETURNING *`,
        [name, phone, license_number, license_expiry, address, joining_date, salary_amount, status, notes, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Driver not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Delete driver
router.delete('/:id',
  authorizeRoles('admin'),
  async (req, res, next) => {
    try {
      const result = await query('DELETE FROM drivers WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Driver not found' });
      }
      res.json({ message: 'Driver deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
