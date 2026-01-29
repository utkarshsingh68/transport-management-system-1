import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all fuel entries
router.get('/', async (req, res, next) => {
  try {
    const { truck_id, start_date, end_date } = req.query;
    let queryText = `
      SELECT f.*, t.truck_number
      FROM fuel_entries f
      LEFT JOIN trucks t ON f.truck_id = t.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (truck_id) {
      queryText += ` AND f.truck_id = $${paramIndex}`;
      params.push(truck_id);
      paramIndex++;
    }

    if (start_date) {
      queryText += ` AND f.date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      queryText += ` AND f.date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    queryText += ' ORDER BY f.date DESC, f.id DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get fuel analytics per truck
router.get('/analytics/truck/:truck_id', async (req, res, next) => {
  try {
    const { truck_id } = req.params;
    const { start_date, end_date } = req.query;

    let queryText = `
      SELECT 
        COUNT(*) as total_entries,
        SUM(quantity_liters) as total_liters,
        SUM(total_amount) as total_cost,
        AVG(price_per_liter) as avg_price_per_liter,
        MIN(date) as first_entry,
        MAX(date) as last_entry
      FROM fuel_entries
      WHERE truck_id = $1
    `;
    const params = [truck_id];
    let paramIndex = 2;

    if (start_date) {
      queryText += ` AND date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      queryText += ` AND date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    const result = await query(queryText, params);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create fuel entry
router.post('/',
  authorizeRoles('admin', 'manager', 'accountant'),
  [
    body('truck_id').isInt(),
    body('date').isDate(),
    body('quantity_liters').isDecimal(),
    body('price_per_liter').isDecimal()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        truck_id, trip_id, date, fuel_station, quantity_liters,
        price_per_liter, odometer_reading, payment_mode, bill_number, notes
      } = req.body;

      const total_amount = parseFloat(quantity_liters) * parseFloat(price_per_liter);

      const result = await query(
        `INSERT INTO fuel_entries (
          truck_id, trip_id, date, fuel_station, quantity_liters,
          price_per_liter, total_amount, odometer_reading, payment_mode, bill_number, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          truck_id, trip_id, date, fuel_station, quantity_liters,
          price_per_liter, total_amount, odometer_reading, payment_mode, bill_number, notes, req.user.id
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Update fuel entry
router.put('/:id',
  authorizeRoles('admin', 'manager', 'accountant'),
  async (req, res, next) => {
    try {
      const {
        truck_id, trip_id, date, fuel_station, quantity_liters,
        price_per_liter, odometer_reading, payment_mode, bill_number, notes
      } = req.body;

      const total_amount = parseFloat(quantity_liters) * parseFloat(price_per_liter);

      const result = await query(
        `UPDATE fuel_entries SET
          truck_id = $1, trip_id = $2, date = $3, fuel_station = $4, quantity_liters = $5,
          price_per_liter = $6, total_amount = $7, odometer_reading = $8, payment_mode = $9,
          bill_number = $10, notes = $11
        WHERE id = $12
        RETURNING *`,
        [
          truck_id, trip_id, date, fuel_station, quantity_liters,
          price_per_liter, total_amount, odometer_reading, payment_mode, bill_number, notes, req.params.id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fuel entry not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Delete fuel entry
router.delete('/:id',
  authorizeRoles('admin'),
  async (req, res, next) => {
    try {
      const result = await query('DELETE FROM fuel_entries WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fuel entry not found' });
      }
      res.json({ message: 'Fuel entry deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
