import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all trip payments with optional filters
router.get('/', async (req, res, next) => {
  try {
    const { trip_id, consigner_id, from_date, to_date } = req.query;
    
    let queryText = `
      SELECT tp.*, t.trip_number, t.freight_amount, t.consigner_id,
             p.name as consigner_name
      FROM trip_payments tp
      JOIN trips t ON tp.trip_id = t.id
      LEFT JOIN parties p ON t.consigner_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (trip_id) {
      paramCount++;
      queryText += ` AND tp.trip_id = $${paramCount}`;
      params.push(trip_id);
    }

    if (consigner_id) {
      paramCount++;
      queryText += ` AND t.consigner_id = $${paramCount}`;
      params.push(consigner_id);
    }

    if (from_date) {
      paramCount++;
      queryText += ` AND tp.payment_date >= $${paramCount}`;
      params.push(from_date);
    }

    if (to_date) {
      paramCount++;
      queryText += ` AND tp.payment_date <= $${paramCount}`;
      params.push(to_date);
    }

    queryText += ' ORDER BY tp.payment_date DESC, tp.created_at DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Record a payment for a trip
router.post('/',
  authorizeRoles('admin', 'manager'),
  [
    body('trip_id').isInt(),
    body('amount').isDecimal({ min: 0.01 }),
    body('payment_date').isDate(),
    body('payment_mode').optional().trim(),
    body('reference_number').optional().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { trip_id, amount, payment_date, payment_mode, reference_number, notes } = req.body;
      const paymentAmount = parseFloat(amount);

      // Get trip details
      const tripResult = await query('SELECT * FROM trips WHERE id = $1', [trip_id]);
      if (tripResult.rows.length === 0) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      const trip = tripResult.rows[0];
      const currentDue = parseFloat(trip.amount_due) || parseFloat(trip.freight_amount) || 0;

      if (paymentAmount > currentDue) {
        return res.status(400).json({ error: `Payment amount (₹${paymentAmount}) exceeds due amount (₹${currentDue})` });
      }

      // Start transaction
      await query('BEGIN');

      try {
        // 1. Record the payment
        const paymentResult = await query(
          `INSERT INTO trip_payments (trip_id, amount, payment_date, payment_mode, reference_number, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [trip_id, paymentAmount, payment_date, payment_mode || 'cash', reference_number, notes, req.user.id]
        );

        // 2. Update trip payment status
        const newAmountPaid = (parseFloat(trip.amount_paid) || 0) + paymentAmount;
        const newAmountDue = currentDue - paymentAmount;
        const newStatus = newAmountDue <= 0 ? 'completed' : 'partial';

        await query(
          `UPDATE trips SET amount_paid = $1, amount_due = $2, payment_status = $3 WHERE id = $4`,
          [newAmountPaid, newAmountDue, newStatus, trip_id]
        );

        // 3. Update consigner ledger if consigner exists
        if (trip.consigner_id) {
          // Get current balance
          const balanceResult = await query(
            'SELECT outstanding_balance FROM consigner_balance WHERE consigner_id = $1',
            [trip.consigner_id]
          );

          let currentBalance = balanceResult.rows.length > 0 
            ? parseFloat(balanceResult.rows[0].outstanding_balance) 
            : 0;
          
          const newBalance = currentBalance - paymentAmount;

          // Record in ledger
          await query(
            `INSERT INTO consigner_ledger (consigner_id, trip_id, transaction_type, amount, balance_after, description, transaction_date, created_by)
             VALUES ($1, $2, 'debit', $3, $4, $5, $6, $7)`,
            [trip.consigner_id, trip_id, paymentAmount, newBalance, `Payment received for Trip ${trip.trip_number}`, payment_date, req.user.id]
          );

          // Update consigner balance
          await query(
            `INSERT INTO consigner_balance (consigner_id, outstanding_balance, total_paid, last_payment_date)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (consigner_id) 
             DO UPDATE SET 
               outstanding_balance = $2,
               total_paid = consigner_balance.total_paid + $3,
               last_payment_date = $4,
               updated_at = CURRENT_TIMESTAMP`,
            [trip.consigner_id, newBalance, paymentAmount, payment_date]
          );
        }

        await query('COMMIT');

        res.status(201).json({
          payment: paymentResult.rows[0],
          trip_status: newStatus,
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
          message: newStatus === 'completed' ? 'Payment completed!' : 'Partial payment recorded'
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

// Get payment history for a specific trip
router.get('/trip/:tripId', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT tp.*, u.username as recorded_by
       FROM trip_payments tp
       LEFT JOIN users u ON tp.created_by = u.id
       WHERE tp.trip_id = $1
       ORDER BY tp.payment_date DESC, tp.created_at DESC`,
      [req.params.tripId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get trips with pending/overdue payments
router.get('/pending', async (req, res, next) => {
  try {
    // First update overdue status
    await query('SELECT update_overdue_payments()');

    const result = await query(`
      SELECT t.*, 
             p.name as consigner_name,
             tr.truck_number,
             d.name as driver_name,
             CASE 
               WHEN t.payment_due_date < CURRENT_DATE AND t.payment_status != 'completed' THEN 'overdue'
               WHEN t.payment_due_date = CURRENT_DATE THEN 'due_today'
               WHEN t.payment_due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
               ELSE 'normal'
             END as urgency
      FROM trips t
      LEFT JOIN parties p ON t.consigner_id = p.id
      LEFT JOIN trucks tr ON t.truck_id = tr.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      WHERE t.payment_status IN ('pending', 'partial', 'overdue')
        AND t.amount_due > 0
      ORDER BY 
        CASE 
          WHEN t.payment_status = 'overdue' THEN 1
          WHEN t.payment_due_date <= CURRENT_DATE THEN 2
          ELSE 3
        END,
        t.payment_due_date ASC NULLS LAST
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get payment summary/stats
router.get('/summary', async (req, res, next) => {
  try {
    const { from_date, to_date } = req.query;

    // Update overdue status first
    await query('SELECT update_overdue_payments()');

    let dateFilter = '';
    const params = [];

    if (from_date && to_date) {
      dateFilter = 'AND t.start_date BETWEEN $1 AND $2';
      params.push(from_date, to_date);
    }

    const summaryResult = await query(`
      SELECT 
        COUNT(*) as total_trips,
        COALESCE(SUM(freight_amount), 0) as total_freight,
        COALESCE(SUM(amount_paid), 0) as total_collected,
        COALESCE(SUM(amount_due), 0) as total_pending,
        COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as paid_trips,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_trips,
        COUNT(CASE WHEN payment_status = 'partial' THEN 1 END) as partial_trips,
        COUNT(CASE WHEN payment_status = 'overdue' THEN 1 END) as overdue_trips
      FROM trips t
      WHERE freight_amount > 0 ${dateFilter}
    `, params);

    const overdueResult = await query(`
      SELECT COALESCE(SUM(amount_due), 0) as overdue_amount
      FROM trips
      WHERE payment_status = 'overdue'
    `);

    res.json({
      ...summaryResult.rows[0],
      overdue_amount: overdueResult.rows[0].overdue_amount
    });
  } catch (error) {
    next(error);
  }
});

// Delete a payment (with ledger reversal)
router.delete('/:id',
  authorizeRoles('admin'),
  async (req, res, next) => {
    try {
      // Get payment details
      const paymentResult = await query(
        `SELECT tp.*, t.consigner_id, t.trip_number, t.amount_paid, t.amount_due, t.freight_amount
         FROM trip_payments tp
         JOIN trips t ON tp.trip_id = t.id
         WHERE tp.id = $1`,
        [req.params.id]
      );

      if (paymentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      const payment = paymentResult.rows[0];
      const paymentAmount = parseFloat(payment.amount);

      await query('BEGIN');

      try {
        // 1. Delete the payment
        await query('DELETE FROM trip_payments WHERE id = $1', [req.params.id]);

        // 2. Update trip amounts
        const newAmountPaid = parseFloat(payment.amount_paid) - paymentAmount;
        const newAmountDue = parseFloat(payment.amount_due) + paymentAmount;
        const newStatus = newAmountPaid <= 0 ? 'pending' : 'partial';

        await query(
          `UPDATE trips SET amount_paid = $1, amount_due = $2, payment_status = $3 WHERE id = $4`,
          [newAmountPaid, newAmountDue, newStatus, payment.trip_id]
        );

        // 3. Reverse consigner ledger entry
        if (payment.consigner_id) {
          const balanceResult = await query(
            'SELECT outstanding_balance FROM consigner_balance WHERE consigner_id = $1',
            [payment.consigner_id]
          );

          const currentBalance = balanceResult.rows.length > 0 
            ? parseFloat(balanceResult.rows[0].outstanding_balance) 
            : 0;
          const newBalance = currentBalance + paymentAmount;

          // Record reversal in ledger
          await query(
            `INSERT INTO consigner_ledger (consigner_id, trip_id, transaction_type, amount, balance_after, description, created_by)
             VALUES ($1, $2, 'adjustment', $3, $4, $5, $6)`,
            [payment.consigner_id, payment.trip_id, paymentAmount, newBalance, `Payment reversal for Trip ${payment.trip_number}`, req.user.id]
          );

          // Update consigner balance
          await query(
            `UPDATE consigner_balance 
             SET outstanding_balance = $1, total_paid = total_paid - $2, updated_at = CURRENT_TIMESTAMP
             WHERE consigner_id = $3`,
            [newBalance, paymentAmount, payment.consigner_id]
          );
        }

        await query('COMMIT');
        res.json({ message: 'Payment deleted and ledger updated' });

      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      next(error);
    }
  }
);

export default router;
