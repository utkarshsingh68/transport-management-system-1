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

    const result = await query(`
      SELECT p.id, p.name, p.phone, p.address, p.type, p.email, p.gstin,
        COALESCE(cb.outstanding_balance, 0) as outstanding_balance,
        COALESCE(cb.total_freight, 0) as total_freight,
        COALESCE(cb.total_paid, 0) as total_paid
      FROM parties p
      LEFT JOIN consigner_balance cb ON p.id = cb.consigner_id
      WHERE (p.type = 'consigner' OR p.type = 'both')
        AND LOWER(p.name) LIKE LOWER($1)
      ORDER BY p.name
      LIMIT 10
    `, [`%${name}%`]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get consigner by exact name with balance
router.get('/by-name/:name', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT p.id, p.name, p.phone, p.address, p.type, p.email, p.gstin,
        COALESCE(cb.outstanding_balance, 0) as outstanding_balance,
        COALESCE(cb.total_freight, 0) as total_freight,
        COALESCE(cb.total_paid, 0) as total_paid
      FROM parties p
      LEFT JOIN consigner_balance cb ON p.id = cb.consigner_id
      WHERE LOWER(p.name) = LOWER($1)
        AND (p.type = 'consigner' OR p.type = 'both')
      LIMIT 1
    `, [req.params.name]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Consigner not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Get all parties (transporters/customers)
router.get('/', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT p.*,
        COALESCE((SELECT SUM(amount) FROM transporter_invoices WHERE transporter_id = p.id), 0) as total_billed,
        COALESCE((SELECT SUM(amount) FROM transporter_payments WHERE transporter_id = p.id), 0) as total_paid
      FROM transporters p
      ORDER BY p.name
    `);
    
    const parties = result.rows.map(p => ({
      ...p,
      balance: parseFloat(p.opening_balance) + parseFloat(p.total_billed) - parseFloat(p.total_paid)
    }));
    
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

    const ledgerResult = await query(`
      SELECT 'invoice' as type, invoice_date as date, invoice_number as reference, 
             amount as debit, 0 as credit, 'Invoice: ' || invoice_number as description
      FROM transporter_invoices WHERE transporter_id = $1
      UNION ALL
      SELECT 'payment' as type, payment_date as date, reference_number as reference,
             0 as debit, amount as credit, 'Payment: ' || COALESCE(reference_number, 'N/A') as description
      FROM transporter_payments WHERE transporter_id = $1
      ORDER BY date DESC
    `, [req.params.id]);

    res.json({
      party: partyResult.rows[0],
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
