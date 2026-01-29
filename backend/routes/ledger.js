import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get cash ledger
router.get('/cash', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    let queryText = `
      SELECT * FROM cash_transactions
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      queryText += ` AND transaction_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      queryText += ` AND transaction_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    queryText += ' ORDER BY transaction_date DESC, id DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get bank ledger
router.get('/bank', async (req, res, next) => {
  try {
    const { start_date, end_date, bank_name } = req.query;
    let queryText = `
      SELECT * FROM bank_transactions
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (bank_name) {
      queryText += ` AND bank_name = $${paramIndex}`;
      params.push(bank_name);
      paramIndex++;
    }

    if (start_date) {
      queryText += ` AND transaction_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      queryText += ` AND transaction_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    queryText += ' ORDER BY transaction_date DESC, id DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Add cash transaction
router.post('/cash',
  authorizeRoles('admin', 'accountant'),
  [
    body('transaction_date').isDate(),
    body('transaction_type').isIn(['income', 'expense']),
    body('amount').isDecimal(),
    body('category').notEmpty()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { transaction_date, transaction_type, category, amount, description, reference_type, reference_id } = req.body;

      // Get current balance
      const balanceResult = await query(
        'SELECT balance_after FROM cash_transactions ORDER BY created_at DESC, id DESC LIMIT 1'
      );
      const currentBalance = balanceResult.rows[0]?.balance_after || 0;
      const newBalance = transaction_type === 'income' 
        ? parseFloat(currentBalance) + parseFloat(amount)
        : parseFloat(currentBalance) - parseFloat(amount);

      const result = await query(
        `INSERT INTO cash_transactions (transaction_date, transaction_type, category, amount, description, reference_type, reference_id, balance_after, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [transaction_date, transaction_type, category, amount, description, reference_type, reference_id, newBalance, req.user.id]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Add bank transaction
router.post('/bank',
  authorizeRoles('admin', 'accountant'),
  [
    body('transaction_date').isDate(),
    body('bank_name').notEmpty(),
    body('transaction_type').isIn(['credit', 'debit']),
    body('amount').isDecimal(),
    body('category').notEmpty()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { transaction_date, bank_name, transaction_type, category, amount, description, reference_number, reference_type, reference_id } = req.body;

      // Get current balance for this bank
      const balanceResult = await query(
        'SELECT balance_after FROM bank_transactions WHERE bank_name = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
        [bank_name]
      );
      const currentBalance = balanceResult.rows[0]?.balance_after || 0;
      const newBalance = transaction_type === 'credit' 
        ? parseFloat(currentBalance) + parseFloat(amount)
        : parseFloat(currentBalance) - parseFloat(amount);

      const result = await query(
        `INSERT INTO bank_transactions (transaction_date, bank_name, transaction_type, category, amount, description, reference_number, reference_type, reference_id, balance_after, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [transaction_date, bank_name, transaction_type, category, amount, description, reference_number, reference_type, reference_id, newBalance, req.user.id]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Get ledger summary
router.get('/summary', async (req, res, next) => {
  try {
    const cashResult = await query(`
      SELECT 
        balance_after as cash_balance,
        (SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE transaction_type = 'income') as total_cash_in,
        (SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE transaction_type = 'expense') as total_cash_out
      FROM cash_transactions
      ORDER BY created_at DESC, id DESC LIMIT 1
    `);

    const bankResult = await query(`
      SELECT 
        bank_name,
        balance_after as balance
      FROM bank_transactions bt1
      WHERE id = (SELECT MAX(id) FROM bank_transactions bt2 WHERE bt2.bank_name = bt1.bank_name)
    `);

    const totalBankBalance = bankResult.rows.reduce((sum, row) => sum + parseFloat(row.balance || 0), 0);

    res.json({
      cash_balance: cashResult.rows[0]?.cash_balance || 0,
      total_cash_in: cashResult.rows[0]?.total_cash_in || 0,
      total_cash_out: cashResult.rows[0]?.total_cash_out || 0,
      bank_accounts: bankResult.rows,
      total_bank_balance: totalBankBalance,
      total_balance: parseFloat(cashResult.rows[0]?.cash_balance || 0) + totalBankBalance
    });
  } catch (error) {
    next(error);
  }
});

export default router;
