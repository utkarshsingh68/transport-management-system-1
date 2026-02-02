import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all parties with outstanding udhari
router.get('/', async (req, res, next) => {
  try {
    // Get all trips with pending dues - group by consigner name or ID
    const result = await query(`
      SELECT 
        COALESCE(p.id, 0) as id,
        COALESCE(p.name, t.consignor_name, 'Unknown Party') as name,
        p.phone,
        p.address,
        COUNT(t.id) as pending_trips,
        COALESCE(SUM(t.amount_due), 0) as total_due,
        MIN(t.start_date) as oldest_trip_date,
        MAX(t.start_date) as latest_trip_date
      FROM trips t
      LEFT JOIN transporters p ON t.consigner_id = p.id
      WHERE t.amount_due > 0 
        AND t.payment_status IN ('pending', 'partial', 'overdue')
      GROUP BY COALESCE(p.id, 0), COALESCE(p.name, t.consignor_name, 'Unknown Party'), p.phone, p.address
      HAVING SUM(t.amount_due) > 0
      ORDER BY total_due DESC
    `);

    // Calculate summary
    const totalUdhari = result.rows.reduce((sum, p) => sum + parseFloat(p.total_due || 0), 0);
    const totalParties = result.rows.length;
    const totalTrips = result.rows.reduce((sum, p) => sum + parseInt(p.pending_trips || 0), 0);

    res.json({
      parties: result.rows.map(row => ({
        ...row,
        total_due: parseFloat(row.total_due) || 0,
        pending_trips: parseInt(row.pending_trips) || 0
      })),
      summary: {
        totalUdhari,
        totalParties,
        totalTrips
      }
    });
  } catch (error) {
    console.error('Udhari fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get trip-wise udhari for a specific party
router.get('/party/:partyId/trips', async (req, res, next) => {
  try {
    const { partyId } = req.params;

    let result;
    if (partyId === '0' || partyId === 'null') {
      // Get trips without consigner_id
      result = await query(`
        SELECT 
          t.id,
          t.trip_number,
          t.from_location,
          t.to_location,
          t.start_date,
          t.freight_amount,
          t.amount_paid,
          t.amount_due,
          t.payment_status,
          t.payment_due_date,
          t.consigner_id,
          t.consignor_name,
          tr.truck_number,
          d.name as driver_name,
          CASE 
            WHEN t.amount_paid = 0 THEN 'Payment Left with Party'
            WHEN t.amount_paid > 0 AND t.amount_due > 0 THEN 'Partial Payment'
            ELSE 'Pending'
          END as udhari_reason
        FROM trips t
        LEFT JOIN trucks tr ON t.truck_id = tr.id
        LEFT JOIN drivers d ON t.driver_id = d.id
        WHERE t.consigner_id IS NULL
          AND t.amount_due > 0
          AND t.payment_status IN ('pending', 'partial', 'overdue')
        ORDER BY t.start_date DESC
      `);
    } else {
      result = await query(`
        SELECT 
          t.id,
          t.trip_number,
          t.from_location,
          t.to_location,
          t.start_date,
          t.freight_amount,
          t.amount_paid,
          t.amount_due,
          t.payment_status,
          t.payment_due_date,
          t.consigner_id,
          t.consignor_name,
          tr.truck_number,
          d.name as driver_name,
          CASE 
            WHEN t.amount_paid = 0 THEN 'Payment Left with Party'
            WHEN t.amount_paid > 0 AND t.amount_due > 0 THEN 'Partial Payment'
            ELSE 'Pending'
          END as udhari_reason
        FROM trips t
        LEFT JOIN trucks tr ON t.truck_id = tr.id
        LEFT JOIN drivers d ON t.driver_id = d.id
        WHERE t.consigner_id = $1
          AND t.amount_due > 0
          AND t.payment_status IN ('pending', 'partial', 'overdue')
        ORDER BY t.start_date DESC
      `, [partyId]);
    }

    res.json(result.rows.map(row => ({
      ...row,
      freight_amount: parseFloat(row.freight_amount) || 0,
      amount_paid: parseFloat(row.amount_paid) || 0,
      amount_due: parseFloat(row.amount_due) || 0
    })));
  } catch (error) {
    console.error('Party trips fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Record payment for a trip udhari
router.post('/payment',
  authorizeRoles('admin', 'manager', 'accountant'),
  [
    body('trip_id').notEmpty(),
    body('amount').notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { trip_id, consigner_id, amount, payment_date, payment_mode, reference_number, notes } = req.body;
      const paymentAmount = parseFloat(amount);

      // Get current trip details
      const tripResult = await query('SELECT * FROM trips WHERE id = $1', [trip_id]);
      if (tripResult.rows.length === 0) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      const trip = tripResult.rows[0];
      const currentDue = parseFloat(trip.amount_due) || 0;
      const currentPaid = parseFloat(trip.amount_paid) || 0;

      if (paymentAmount > currentDue) {
        return res.status(400).json({ error: 'Payment amount exceeds due amount' });
      }

      const newAmountPaid = currentPaid + paymentAmount;
      const newAmountDue = currentDue - paymentAmount;
      const newStatus = newAmountDue <= 0 ? 'completed' : 'partial';

      // Update trip
      await query(`
        UPDATE trips 
        SET amount_paid = $1, amount_due = $2, payment_status = $3 
        WHERE id = $4
      `, [newAmountPaid, newAmountDue, newStatus, trip_id]);

      // Record in trip_payments
      try {
        await query(`
          INSERT INTO trip_payments (trip_id, amount, payment_date, payment_mode, reference_number, notes, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [trip_id, paymentAmount, payment_date, payment_mode || 'cash', reference_number, notes, req.user.id]);
      } catch (err) {
        console.log('trip_payments insert error:', err.message);
      }

      // Update consigner ledger - only if consigner_id is valid
      if (consigner_id && consigner_id > 0) {
        try {
          // Get current balance
          const balanceResult = await query(
            'SELECT outstanding_balance FROM consigner_balance WHERE consigner_id = $1',
            [consigner_id]
          );

        const currentBalance = balanceResult.rows.length > 0 
          ? parseFloat(balanceResult.rows[0].outstanding_balance) 
          : 0;
        
        const newBalance = currentBalance - paymentAmount;

        // Record payment in ledger
        await query(`
          INSERT INTO consigner_ledger (consigner_id, trip_id, transaction_type, amount, balance_after, description, transaction_date, created_by)
          VALUES ($1, $2, 'debit', $3, $4, $5, $6, $7)
        `, [consigner_id, trip_id, paymentAmount, newBalance, `Payment received: ${notes || 'Udhari payment'}`, payment_date, req.user.id]);

        // Update consigner balance
        await query(`
          UPDATE consigner_balance 
          SET outstanding_balance = outstanding_balance - $1,
              total_paid = total_paid + $1,
              last_payment_date = $2,
              last_updated = CURRENT_TIMESTAMP
          WHERE consigner_id = $3
        `, [paymentAmount, payment_date || new Date().toISOString().split('T')[0], consigner_id]);

        } catch (err) {
          console.log('Ledger update error:', err.message);
        }
      }

      res.json({ 
        success: true, 
        message: newStatus === 'completed' ? 'Payment completed! Udhari cleared.' : 'Partial payment recorded.',
        newAmountDue,
        newStatus
      });
    } catch (error) {
      console.error('Payment error:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

// Get udhari summary statistics
router.get('/summary', async (req, res, next) => {
  try {
    // Total udhari
    const totalResult = await query(`
      SELECT 
        COALESCE(SUM(amount_due), 0) as total_udhari,
        COUNT(*) as total_trips
      FROM trips 
      WHERE amount_due > 0 
        AND payment_status IN ('pending', 'partial', 'overdue')
    `);

    // By age
    const agingResult = await query(`
      SELECT 
        CASE 
          WHEN start_date >= CURRENT_DATE - INTERVAL '30 days' THEN '0-30 days'
          WHEN start_date >= CURRENT_DATE - INTERVAL '60 days' THEN '31-60 days'
          WHEN start_date >= CURRENT_DATE - INTERVAL '90 days' THEN '61-90 days'
          ELSE '90+ days'
        END as age_bucket,
        COUNT(*) as trip_count,
        COALESCE(SUM(amount_due), 0) as amount
      FROM trips
      WHERE amount_due > 0 
        AND payment_status IN ('pending', 'partial', 'overdue')
      GROUP BY age_bucket
      ORDER BY age_bucket
    `);

    // By party count
    const partyCount = await query(`
      SELECT COUNT(DISTINCT consigner_id) as party_count
      FROM trips
      WHERE amount_due > 0 
        AND payment_status IN ('pending', 'partial', 'overdue')
        AND consigner_id IS NOT NULL
    `);

    res.json({
      total_udhari: parseFloat(totalResult.rows[0]?.total_udhari) || 0,
      total_trips: parseInt(totalResult.rows[0]?.total_trips) || 0,
      total_parties: parseInt(partyCount.rows[0]?.party_count) || 0,
      aging: agingResult.rows
    });
  } catch (error) {
    console.error('Summary error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
