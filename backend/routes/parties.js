import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Search consigner by name (auto-complete)
router.get('/search', async (req, res, next) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.json([]);
    }

    // Try with consigner_balance join, fallback to simple query
    try {
      const result = await query(`
        SELECT p.id, p.name, p.phone, p.address,
          COALESCE(cb.outstanding_balance, 0) as outstanding_balance,
          COALESCE(cb.total_freight, 0) as total_freight,
          COALESCE(cb.total_paid, 0) as total_paid
        FROM transporters p
        LEFT JOIN consigner_balance cb ON p.id = cb.consigner_id
        WHERE LOWER(p.name) LIKE LOWER($1)
        ORDER BY p.name
        LIMIT 10
      `, [`%${name}%`]);

      res.json(result.rows);
    } catch (err) {
      console.log('Search fallback due to:', err.message);
      // Fallback - just basic columns
      const result = await query(`
        SELECT id, name, phone, address,
          0 as outstanding_balance, 0 as total_freight, 0 as total_paid
        FROM transporters
        WHERE LOWER(name) LIKE LOWER($1)
        ORDER BY name
        LIMIT 10
      `, [`%${name}%`]);

      res.json(result.rows);
    }
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get consigner by exact name with balance
router.get('/by-name/:name', async (req, res, next) => {
  try {
    // Try with consigner_balance join, fallback to simple query
    try {
      const result = await query(`
        SELECT p.id, p.name, p.phone, p.address,
          COALESCE(cb.outstanding_balance, 0) as outstanding_balance,
          COALESCE(cb.total_freight, 0) as total_freight,
          COALESCE(cb.total_paid, 0) as total_paid
        FROM transporters p
        LEFT JOIN consigner_balance cb ON p.id = cb.consigner_id
        WHERE LOWER(p.name) = LOWER($1)
        LIMIT 1
      `, [req.params.name]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Consigner not found' });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.log('By-name fallback due to:', err.message);
      // Fallback - just basic columns
      const result = await query(`
        SELECT id, name, phone, address,
          0 as outstanding_balance, 0 as total_freight, 0 as total_paid
        FROM transporters
        WHERE LOWER(name) = LOWER($1)
        LIMIT 1
      `, [req.params.name]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Consigner not found' });
      }

      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('By-name error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get all parties (transporters/customers)
router.get('/', async (req, res, next) => {
  try {
    // Get all parties with their trip-based dues
    // This matches trips by BOTH consigner_id AND consignor_name to stay in sync with Udhari
    const result = await query(`
      SELECT 
        p.*,
        COALESCE((SELECT SUM(amount) FROM transporter_invoices WHERE transporter_id = p.id), 0) as total_billed,
        COALESCE((SELECT SUM(amount) FROM transporter_payments WHERE transporter_id = p.id), 0) as total_paid,
        -- Trip dues: match by ID or by normalized name (same logic as Udhari)
        COALESCE((
          SELECT SUM(t.amount_due) 
          FROM trips t 
          WHERE t.amount_due > 0 
            AND t.payment_status IN ('pending', 'partial', 'overdue')
            AND (
              t.consigner_id = p.id 
              OR LOWER(TRIM(t.consignor_name)) = LOWER(TRIM(p.name))
            )
        ), 0) as trip_dues,
        -- Total freight from all trips
        COALESCE((
          SELECT SUM(t.freight_amount) 
          FROM trips t 
          WHERE t.consigner_id = p.id 
            OR LOWER(TRIM(t.consignor_name)) = LOWER(TRIM(p.name))
        ), 0) as total_freight,
        -- Total received from all trips
        COALESCE((
          SELECT SUM(t.amount_paid) 
          FROM trips t 
          WHERE t.consigner_id = p.id 
            OR LOWER(TRIM(t.consignor_name)) = LOWER(TRIM(p.name))
        ), 0) as total_received,
        -- Count pending trips
        COALESCE((
          SELECT COUNT(*) 
          FROM trips t 
          WHERE t.amount_due > 0 
            AND t.payment_status IN ('pending', 'partial', 'overdue')
            AND (
              t.consigner_id = p.id 
              OR LOWER(TRIM(t.consignor_name)) = LOWER(TRIM(p.name))
            )
        ), 0) as pending_trips
      FROM transporters p
      ORDER BY p.name
    `);
    
    const parties = result.rows.map(p => {
      // Balance = Opening Balance + Total Billed - Total Paid + Trip Dues
      // Trip dues already calculated to match Udhari logic
      const invoiceBalance = parseFloat(p.opening_balance || 0) + parseFloat(p.total_billed || 0) - parseFloat(p.total_paid || 0);
      const tripBalance = parseFloat(p.trip_dues || 0);
      
      return {
        ...p,
        balance: invoiceBalance + tripBalance,
        trip_dues: parseFloat(p.trip_dues || 0),
        total_freight: parseFloat(p.total_freight || 0),
        total_received: parseFloat(p.total_received || 0),
        pending_trips: parseInt(p.pending_trips || 0)
      };
    });
    
    res.json(parties);
  } catch (error) {
    next(error);
  }
});

// Get party by ID with ledger
router.get('/:id', async (req, res, next) => {
  try {
    const partyResult = await query('SELECT * FROM transporters WHERE id = $1', [req.params.id]);
    if (partyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const party = partyResult.rows[0];
    const partyName = party.name;

    // Get combined ledger: invoices, payments, AND trip transactions
    const ledgerResult = await query(`
      -- Invoices (debit)
      SELECT id, 'invoice' as type, invoice_date as date, invoice_number as reference, 
             amount as debit, 0 as credit, 'Invoice: ' || invoice_number as description,
             1 as sort_order, TRUE as editable
      FROM transporter_invoices WHERE transporter_id = $1
      
      UNION ALL
      
      -- Payments (credit)
      SELECT id, 'payment' as type, payment_date as date, reference_number as reference,
             0 as debit, amount as credit, 'Payment: ' || COALESCE(reference_number, 'N/A') as description,
             2 as sort_order, TRUE as editable
      FROM transporter_payments WHERE transporter_id = $1
      
      UNION ALL
      
      -- Trip freight charges (debit) - matched by ID or name
      SELECT t.id, 'trip_freight' as type, t.start_date as date, t.trip_number as reference,
             t.freight_amount as debit, 0 as credit, 
             'Trip ' || t.trip_number || ': ' || t.from_location || ' → ' || t.to_location as description,
             3 as sort_order, FALSE as editable
      FROM trips t
      WHERE (t.consigner_id = $1 OR LOWER(TRIM(t.consignor_name)) = LOWER(TRIM($2)))
        AND t.freight_amount > 0
      
      UNION ALL
      
      -- Trip payments received (credit) - from trip_payments table
      SELECT tp.id, 'trip_payment' as type, tp.payment_date as date, tp.reference_number as reference,
             0 as debit, tp.amount as credit,
             'Trip Payment: ' || t.trip_number || ' (' || COALESCE(tp.payment_mode, 'cash') || ')' as description,
             4 as sort_order, FALSE as editable
      FROM trip_payments tp
      JOIN trips t ON tp.trip_id = t.id
      WHERE (t.consigner_id = $1 OR LOWER(TRIM(t.consignor_name)) = LOWER(TRIM($2)))
      
      ORDER BY date DESC, sort_order
    `, [req.params.id, partyName]);

    // Calculate current balance from trips (same as Udhari)
    const tripDuesResult = await query(`
      SELECT 
        COALESCE(SUM(amount_due), 0) as trip_dues,
        COUNT(*) as pending_trips
      FROM trips t
      WHERE t.amount_due > 0 
        AND t.payment_status IN ('pending', 'partial', 'overdue')
        AND (t.consigner_id = $1 OR LOWER(TRIM(t.consignor_name)) = LOWER(TRIM($2)))
    `, [req.params.id, partyName]);

    const tripDues = parseFloat(tripDuesResult.rows[0]?.trip_dues) || 0;
    const pendingTrips = parseInt(tripDuesResult.rows[0]?.pending_trips) || 0;

    res.json({
      party: {
        ...party,
        trip_dues: tripDues,
        pending_trips: pendingTrips
      },
      ledger: ledgerResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// Create party
router.post('/',
  authorizeRoles('admin', 'manager', 'accountant'),
  [
    body('name').notEmpty().trim(),
    body('company_name').optional().trim()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, company_name, phone, email, address, gstin, pan, bank_details, opening_balance } = req.body;

      const result = await query(
        `INSERT INTO transporters (name, company_name, phone, email, address, gstin, pan, bank_details, opening_balance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [name, company_name, phone, email, address, gstin, pan, bank_details, opening_balance || 0]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Update party
router.put('/:id', authorizeRoles('admin', 'manager', 'accountant'), async (req, res, next) => {
  try {
    const { name, company_name, phone, email, address, gstin, pan, bank_details, opening_balance, status } = req.body;

    const result = await query(
      `UPDATE transporters SET name = $1, company_name = $2, phone = $3, email = $4, 
       address = $5, gstin = $6, pan = $7, bank_details = $8, opening_balance = $9, status = $10
       WHERE id = $11 RETURNING *`,
      [name, company_name, phone, email, address, gstin, pan, bank_details, opening_balance, status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Party not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete party
router.delete('/:id', authorizeRoles('admin', 'manager'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if party has any linked trips
    const tripsCheck = await query(
      'SELECT COUNT(*) as count FROM trips WHERE consigner_id = $1',
      [id]
    );

    if (parseInt(tripsCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete party with linked trips. Please remove or reassign trips first.',
        linkedTrips: parseInt(tripsCheck.rows[0].count)
      });
    }

    // Delete related records first (if any)
    try {
      await query('DELETE FROM consigner_balance WHERE consigner_id = $1', [id]);
      await query('DELETE FROM consigner_ledger WHERE consigner_id = $1', [id]);
      await query('DELETE FROM transporter_invoices WHERE transporter_id = $1', [id]);
      await query('DELETE FROM transporter_payments WHERE transporter_id = $1', [id]);
    } catch (err) {
      console.log('Related records cleanup:', err.message);
    }

    // Delete the party
    const result = await query(
      'DELETE FROM transporters WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Party not found' });
    }

    res.json({ success: true, message: 'Party deleted successfully', party: result.rows[0] });
  } catch (error) {
    console.error('Delete party error:', error.message);
    next(error);
  }
});

// Add invoice for party
router.post('/:id/invoices',
  authorizeRoles('admin', 'manager', 'accountant'),
  async (req, res, next) => {
    try {
      const { invoice_number, invoice_date, amount, trip_id, due_date, notes } = req.body;

      const result = await query(
        `INSERT INTO transporter_invoices (transporter_id, trip_id, invoice_number, invoice_date, amount, due_date, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [req.params.id, trip_id, invoice_number, invoice_date, amount, due_date, notes, req.user.id]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Add payment from party
router.post('/:id/payments',
  authorizeRoles('admin', 'manager', 'accountant'),
  async (req, res, next) => {
    try {
      const { payment_date, amount, payment_mode, reference_number, notes } = req.body;

      const result = await query(
        `INSERT INTO transporter_payments (transporter_id, payment_date, amount, payment_mode, reference_number, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [req.params.id, payment_date, amount, payment_mode, reference_number, notes, req.user.id]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Update invoice
router.put('/:partyId/invoices/:invoiceId',
  authorizeRoles('admin', 'manager', 'accountant'),
  async (req, res, next) => {
    try {
      const { partyId, invoiceId } = req.params;
      const { date, amount, reference } = req.body;

      const result = await query(
        `UPDATE transporter_invoices 
         SET invoice_date = $1, amount = $2, invoice_number = $3
         WHERE id = $4 AND transporter_id = $5
         RETURNING *`,
        [date, amount, reference, invoiceId, partyId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Delete invoice
router.delete('/:partyId/invoices/:invoiceId',
  authorizeRoles('admin', 'manager', 'accountant'),
  async (req, res, next) => {
    try {
      const { partyId, invoiceId } = req.params;

      const result = await query(
        `DELETE FROM transporter_invoices WHERE id = $1 AND transporter_id = $2 RETURNING *`,
        [invoiceId, partyId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      res.json({ success: true, message: 'Invoice deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Update payment
router.put('/:partyId/payments/:paymentId',
  authorizeRoles('admin', 'manager', 'accountant'),
  async (req, res, next) => {
    try {
      const { partyId, paymentId } = req.params;
      const { date, amount, reference } = req.body;

      const result = await query(
        `UPDATE transporter_payments 
         SET payment_date = $1, amount = $2, reference_number = $3
         WHERE id = $4 AND transporter_id = $5
         RETURNING *`,
        [date, amount, reference, paymentId, partyId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Delete payment
router.delete('/:partyId/payments/:paymentId',
  authorizeRoles('admin', 'manager', 'accountant'),
  async (req, res, next) => {
    try {
      const { partyId, paymentId } = req.params;

      const result = await query(
        `DELETE FROM transporter_payments WHERE id = $1 AND transporter_id = $2 RETURNING *`,
        [paymentId, partyId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      res.json({ success: true, message: 'Payment deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Get receivables summary
router.get('/summary/receivables', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(DISTINCT t.id) as total_parties,
        COALESCE(SUM(
          COALESCE(t.opening_balance, 0) + 
          COALESCE((SELECT SUM(amount) FROM transporter_invoices WHERE transporter_id = t.id), 0) -
          COALESCE((SELECT SUM(amount) FROM transporter_payments WHERE transporter_id = t.id), 0)
        ), 0) as total_receivable
      FROM transporters t
      WHERE t.status = 'active'
    `);

    const overdueResult = await query(`
      SELECT COUNT(*) as overdue_count, COALESCE(SUM(amount - paid_amount), 0) as overdue_amount
      FROM transporter_invoices
      WHERE status != 'paid' AND due_date < CURRENT_DATE
    `);

    res.json({
      ...result.rows[0],
      ...overdueResult.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

export default router;
