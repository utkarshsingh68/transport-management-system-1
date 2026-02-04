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

// Update cash transaction
router.put('/cash/:id',
  authorizeRoles('admin', 'accountant'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { transaction_date, transaction_type, category, amount, description } = req.body;

      const result = await query(
        `UPDATE cash_transactions 
         SET transaction_date = $1, transaction_type = $2, category = $3, amount = $4, description = $5
         WHERE id = $6
         RETURNING *`,
        [transaction_date, transaction_type, category, amount, description, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Recalculate all balances
      await recalculateCashBalances();

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Delete cash transaction
router.delete('/cash/:id',
  authorizeRoles('admin', 'accountant'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await query(
        'DELETE FROM cash_transactions WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Recalculate all balances
      await recalculateCashBalances();

      res.json({ success: true, message: 'Transaction deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Helper function to recalculate cash balances
async function recalculateCashBalances() {
  const transactions = await query(
    'SELECT id, transaction_type, amount FROM cash_transactions ORDER BY transaction_date ASC, id ASC'
  );
  
  let balance = 0;
  for (const txn of transactions.rows) {
    balance = txn.transaction_type === 'income' 
      ? balance + parseFloat(txn.amount)
      : balance - parseFloat(txn.amount);
    
    await query(
      'UPDATE cash_transactions SET balance_after = $1 WHERE id = $2',
      [balance, txn.id]
    );
  }
}

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

// Update bank transaction
router.put('/bank/:id',
  authorizeRoles('admin', 'accountant'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { transaction_date, bank_name, transaction_type, category, amount, description, reference_number } = req.body;

      // Convert income/expense to credit/debit for bank
      const bankType = transaction_type === 'income' ? 'credit' : 'debit';

      const result = await query(
        `UPDATE bank_transactions 
         SET transaction_date = $1, bank_name = $2, transaction_type = $3, category = $4, amount = $5, description = $6, reference_number = $7
         WHERE id = $8
         RETURNING *`,
        [transaction_date, bank_name, bankType, category, amount, description, reference_number, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Recalculate all balances for this bank
      await recalculateBankBalances(bank_name);

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Delete bank transaction
router.delete('/bank/:id',
  authorizeRoles('admin', 'accountant'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Get the bank name before deleting
      const txn = await query('SELECT bank_name FROM bank_transactions WHERE id = $1', [id]);
      if (txn.rows.length === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const bankName = txn.rows[0].bank_name;

      const result = await query(
        'DELETE FROM bank_transactions WHERE id = $1 RETURNING *',
        [id]
      );

      // Recalculate all balances for this bank
      await recalculateBankBalances(bankName);

      res.json({ success: true, message: 'Transaction deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Helper function to recalculate bank balances
async function recalculateBankBalances(bankName) {
  const transactions = await query(
    'SELECT id, transaction_type, amount FROM bank_transactions WHERE bank_name = $1 ORDER BY transaction_date ASC, id ASC',
    [bankName]
  );
  
  let balance = 0;
  for (const txn of transactions.rows) {
    balance = txn.transaction_type === 'credit' 
      ? balance + parseFloat(txn.amount)
      : balance - parseFloat(txn.amount);
    
    await query(
      'UPDATE bank_transactions SET balance_after = $1 WHERE id = $2',
      [balance, txn.id]
    );
  }
}

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
