import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all consigners with their outstanding balances
router.get('/balances', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        p.id,
        p.name,
        p.phone,
        p.email,
        p.type,
        COALESCE(cb.outstanding_balance, 0) as outstanding_balance,
        COALESCE(cb.total_trips, 0) as total_trips,
        COALESCE(cb.total_freight, 0) as total_freight,
        COALESCE(cb.total_paid, 0) as total_paid,
        cb.last_payment_date,
        cb.last_trip_date
      FROM parties p
      LEFT JOIN consigner_balance cb ON p.id = cb.consigner_id
      WHERE p.type IN ('consigner', 'both')
      ORDER BY cb.outstanding_balance DESC NULLS LAST
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get ledger entries for a specific consigner
router.get('/:consignerId', async (req, res, next) => {
  try {
    const { from_date, to_date, limit } = req.query;
    
    let queryText = `
      SELECT 
        cl.*,
        t.trip_number,
        t.from_location,
        t.to_location
      FROM consigner_ledger cl
      LEFT JOIN trips t ON cl.trip_id = t.id
      WHERE cl.consigner_id = $1
    `;
    const params = [req.params.consignerId];
    let paramCount = 1;

    if (from_date) {
      paramCount++;
      queryText += ` AND cl.transaction_date >= $${paramCount}`;
      params.push(from_date);
    }

    if (to_date) {
      paramCount++;
      queryText += ` AND cl.transaction_date <= $${paramCount}`;
      params.push(to_date);
    }

    queryText += ' ORDER BY cl.transaction_date DESC, cl.created_at DESC';

    if (limit) {
      paramCount++;
      queryText += ` LIMIT $${paramCount}`;
      params.push(parseInt(limit));
    }

    const result = await query(queryText, params);

    // Get consigner details
    const consignerResult = await query(`
      SELECT p.*, 
             COALESCE(cb.outstanding_balance, 0) as outstanding_balance,
             COALESCE(cb.total_trips, 0) as total_trips,
             COALESCE(cb.total_freight, 0) as total_freight,
             COALESCE(cb.total_paid, 0) as total_paid
      FROM parties p
      LEFT JOIN consigner_balance cb ON p.id = cb.consigner_id
      WHERE p.id = $1
    `, [req.params.consignerId]);

    res.json({
      consigner: consignerResult.rows[0] || null,
      ledger: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Add manual adjustment to consigner ledger
router.post('/adjustment',
  authorizeRoles('admin'),
  [
    body('consigner_id').isInt(),
    body('amount').isDecimal(),
    body('transaction_type').isIn(['credit', 'debit', 'adjustment']),
    body('description').notEmpty().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { consigner_id, amount, transaction_type, description, transaction_date } = req.body;
      const adjustmentAmount = parseFloat(amount);

      await query('BEGIN');

      try {
        // Get current balance
        const balanceResult = await query(
          'SELECT outstanding_balance FROM consigner_balance WHERE consigner_id = $1',
          [consigner_id]
        );

        let currentBalance = balanceResult.rows.length > 0 
          ? parseFloat(balanceResult.rows[0].outstanding_balance) 
          : 0;

        // Calculate new balance based on transaction type
        let newBalance;
        if (transaction_type === 'credit') {
          newBalance = currentBalance + adjustmentAmount; // Add to outstanding
        } else if (transaction_type === 'debit') {
          newBalance = currentBalance - adjustmentAmount; // Payment received
        } else {
          newBalance = currentBalance + adjustmentAmount; // Can be positive or negative
        }

        // Record in ledger
        const ledgerResult = await query(
          `INSERT INTO consigner_ledger (consigner_id, transaction_type, amount, balance_after, description, transaction_date, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [consigner_id, transaction_type, Math.abs(adjustmentAmount), newBalance, description, transaction_date || new Date(), req.user.id]
        );

        // Update balance
        if (balanceResult.rows.length > 0) {
          await query(
            `UPDATE consigner_balance 
             SET outstanding_balance = $1, updated_at = CURRENT_TIMESTAMP
             WHERE consigner_id = $2`,
            [newBalance, consigner_id]
          );
        } else {
          await query(
            `INSERT INTO consigner_balance (consigner_id, outstanding_balance)
             VALUES ($1, $2)`,
            [consigner_id, newBalance]
          );
        }

        await query('COMMIT');

        res.status(201).json({
          ledger_entry: ledgerResult.rows[0],
          new_balance: newBalance
        });

      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      next(error);
    }
  }
);

// Get consigner summary with all their trips
router.get('/:consignerId/trips', async (req, res, next) => {
  try {
    const { status } = req.query;
    
    let queryText = `
      SELECT t.*, 
             tr.truck_number,
             d.name as driver_name
      FROM trips t
      LEFT JOIN trucks tr ON t.truck_id = tr.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      WHERE t.consigner_id = $1
    `;
    const params = [req.params.consignerId];

    if (status) {
      queryText += ` AND t.payment_status = $2`;
      params.push(status);
    }

    queryText += ' ORDER BY t.start_date DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get overall udhari summary
router.get('/summary/overall', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(DISTINCT cb.consigner_id) as total_consigners_with_balance,
        COALESCE(SUM(cb.outstanding_balance), 0) as total_outstanding,
        COALESCE(SUM(CASE WHEN cb.outstanding_balance > 0 THEN cb.outstanding_balance ELSE 0 END), 0) as total_receivable,
        COALESCE(SUM(CASE WHEN cb.outstanding_balance < 0 THEN ABS(cb.outstanding_balance) ELSE 0 END), 0) as total_advance,
        COUNT(CASE WHEN cb.outstanding_balance > 0 THEN 1 END) as consigners_with_dues,
        MAX(cb.outstanding_balance) as highest_outstanding
      FROM consigner_balance cb
    `);

    // Get top 5 consigners with highest outstanding
    const topConsigners = await query(`
      SELECT p.name, cb.outstanding_balance
      FROM consigner_balance cb
      JOIN parties p ON cb.consigner_id = p.id
      WHERE cb.outstanding_balance > 0
      ORDER BY cb.outstanding_balance DESC
      LIMIT 5
    `);

    res.json({
      ...result.rows[0],
      top_outstanding_consigners: topConsigners.rows
    });
  } catch (error) {
    next(error);
  }
});

export default router;
