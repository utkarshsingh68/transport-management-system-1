import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get salary payments for a driver or all
router.get('/salaries', async (req, res, next) => {
  try {
    const { driver_id, month } = req.query;
    let queryText = `
      SELECT sp.*, d.name as driver_name
      FROM salary_payments sp
      JOIN drivers d ON sp.driver_id = d.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (driver_id) {
      queryText += ` AND sp.driver_id = $${paramIndex}`;
      params.push(driver_id);
      paramIndex++;
    }

    if (month) {
      queryText += ` AND sp.month = $${paramIndex}`;
      params.push(month);
      paramIndex++;
    }

    queryText += ' ORDER BY sp.payment_date DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Create salary payment
router.post('/salaries',
  authorizeRoles('admin', 'manager', 'accountant'),
  [
    body('driver_id').isInt(),
    body('payment_date').isDate(),
    body('month').notEmpty(),
    body('basic_salary').isDecimal()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { driver_id, payment_date, month, basic_salary, allowances, deductions, advance_adjusted, notes, payment_mode } = req.body;
      
      const net_amount = parseFloat(basic_salary) + parseFloat(allowances || 0) - parseFloat(deductions || 0) - parseFloat(advance_adjusted || 0);

      const result = await query(
        `INSERT INTO salary_payments (driver_id, payment_date, month, basic_salary, allowances, deductions, advance_adjusted, net_amount, payment_mode, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [driver_id, payment_date, month, basic_salary, allowances || 0, deductions || 0, advance_adjusted || 0, net_amount, payment_mode, notes, req.user.id]
      );

      // Mark advances as adjusted if any
      if (advance_adjusted > 0) {
        await query(
          `UPDATE advance_payments SET is_adjusted = true, adjusted_in_salary = $1 
           WHERE driver_id = $2 AND is_adjusted = false`,
          [result.rows[0].id, driver_id]
        );
      }

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Get advances for a driver
router.get('/advances', async (req, res, next) => {
  try {
    const { driver_id, is_adjusted } = req.query;
    let queryText = `
      SELECT ap.*, d.name as driver_name
      FROM advance_payments ap
      JOIN drivers d ON ap.driver_id = d.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (driver_id) {
      queryText += ` AND ap.driver_id = $${paramIndex}`;
      params.push(driver_id);
      paramIndex++;
    }

    if (is_adjusted !== undefined) {
      queryText += ` AND ap.is_adjusted = $${paramIndex}`;
      params.push(is_adjusted === 'true');
      paramIndex++;
    }

    queryText += ' ORDER BY ap.advance_date DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Create advance payment
router.post('/advances',
  authorizeRoles('admin', 'manager', 'accountant'),
  [
    body('driver_id').isInt(),
    body('advance_date').isDate(),
    body('amount').isDecimal()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { driver_id, advance_date, amount, purpose, payment_mode, notes } = req.body;

      const result = await query(
        `INSERT INTO advance_payments (driver_id, advance_date, amount, purpose, payment_mode, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [driver_id, advance_date, amount, purpose, payment_mode, notes, req.user.id]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Get driver salary summary
router.get('/driver-summary/:driver_id', async (req, res, next) => {
  try {
    const { driver_id } = req.params;

    const driverResult = await query('SELECT * FROM drivers WHERE id = $1', [driver_id]);
    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const salaryResult = await query(`
      SELECT COALESCE(SUM(net_amount), 0) as total_paid
      FROM salary_payments WHERE driver_id = $1
    `, [driver_id]);

    const advanceResult = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN is_adjusted = false THEN amount ELSE 0 END), 0) as pending_advances,
        COALESCE(SUM(amount), 0) as total_advances
      FROM advance_payments WHERE driver_id = $1
    `, [driver_id]);

    const tripsResult = await query(`
      SELECT COUNT(*) as total_trips, COALESCE(SUM(actual_income), 0) as total_income
      FROM trips WHERE driver_id = $1 AND status = 'completed'
    `, [driver_id]);

    res.json({
      driver: driverResult.rows[0],
      ...salaryResult.rows[0],
      ...advanceResult.rows[0],
      ...tripsResult.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

export default router;
