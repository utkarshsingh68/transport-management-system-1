import express from 'express';
import pool, { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// =============================================
// BANK ACCOUNTS
// =============================================

// Get all bank accounts
router.get('/accounts', async (req, res) => {
  try {
    const result = await query('SELECT * FROM bank_accounts WHERE is_active = true ORDER BY account_name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get bank account by ID
router.get('/accounts/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM bank_accounts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Bank account not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching bank account:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create bank account
router.post('/accounts', async (req, res) => {
  try {
    const { account_name, bank_name, account_number, ifsc_code, branch, account_type, opening_balance } = req.body;
    
    const result = await query(`
      INSERT INTO bank_accounts (account_name, bank_name, account_number, ifsc_code, branch, account_type, opening_balance, current_balance)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING *
    `, [account_name, bank_name, account_number, ifsc_code, branch, account_type, opening_balance || 0]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating bank account:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update bank account
router.put('/accounts/:id', async (req, res) => {
  try {
    const { account_name, bank_name, account_number, ifsc_code, branch, account_type, opening_balance } = req.body;
    
    const result = await query(`
      UPDATE bank_accounts SET
        account_name = $1, bank_name = $2, account_number = $3, ifsc_code = $4,
        branch = $5, account_type = $6, opening_balance = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 RETURNING *
    `, [account_name, bank_name, account_number, ifsc_code, branch, account_type, opening_balance, req.params.id]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating bank account:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete bank account (soft delete)
router.delete('/accounts/:id', async (req, res) => {
  try {
    await query('UPDATE bank_accounts SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ message: 'Bank account deleted successfully' });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// =============================================
// BANK STATEMENTS
// =============================================

// Get reconciliation summary - Must be before other routes
router.get('/summary', async (req, res) => {
  try {
    const { account_id, from_date, to_date } = req.query;

    let filters = [];
    const params = [];

    if (account_id) {
      params.push(account_id);
      filters.push(`bank_account_id = $${params.length}`);
    }

    if (from_date) {
      params.push(from_date);
      filters.push(`transaction_date >= $${params.length}`);
    }

    if (to_date) {
      params.push(to_date);
      filters.push(`transaction_date <= $${params.length}`);
    }

    const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';

    const result = await query(`
      SELECT
        COUNT(*) as total_entries,
        COUNT(CASE WHEN is_reconciled THEN 1 END) as reconciled_count,
        COUNT(CASE WHEN NOT is_reconciled THEN 1 END) as unreconciled_count,
        COALESCE(SUM(debit_amount), 0) as total_debits,
        COALESCE(SUM(credit_amount), 0) as total_credits,
        COALESCE(SUM(CASE WHEN is_reconciled THEN debit_amount ELSE 0 END), 0) as reconciled_debits,
        COALESCE(SUM(CASE WHEN is_reconciled THEN credit_amount ELSE 0 END), 0) as reconciled_credits,
        COALESCE(SUM(CASE WHEN NOT is_reconciled THEN debit_amount ELSE 0 END), 0) as unreconciled_debits,
        COALESCE(SUM(CASE WHEN NOT is_reconciled THEN credit_amount ELSE 0 END), 0) as unreconciled_credits
      FROM bank_statements ${whereClause}
    `, params);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching reconciliation summary:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get bank statements
router.get('/statements', async (req, res) => {
  try {
    const { account_id, from_date, to_date, is_reconciled, search } = req.query;
    
    let queryText = `
      SELECT bs.*, ba.account_name, ba.bank_name
      FROM bank_statements bs
      JOIN bank_accounts ba ON bs.bank_account_id = ba.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (account_id) {
      paramCount++;
      queryText += ` AND bs.bank_account_id = $${paramCount}`;
      params.push(account_id);
    }

    if (from_date) {
      paramCount++;
      queryText += ` AND bs.transaction_date >= $${paramCount}`;
      params.push(from_date);
    }

    if (to_date) {
      paramCount++;
      queryText += ` AND bs.transaction_date <= $${paramCount}`;
      params.push(to_date);
    }

    if (is_reconciled !== undefined && is_reconciled !== 'all') {
      paramCount++;
      queryText += ` AND bs.is_reconciled = $${paramCount}`;
      params.push(is_reconciled === 'true');
    }

    if (search) {
      paramCount++;
      queryText += ` AND (bs.description ILIKE $${paramCount} OR bs.reference_number ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY bs.transaction_date DESC, bs.id DESC`;

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bank statements:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Import bank statements (batch)
router.post('/statements/import', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { bank_account_id, statements } = req.body;
    const importBatchId = `IMP-${Date.now()}`;
    const imported = [];

    for (const stmt of statements) {
      const result = await client.query(`
        INSERT INTO bank_statements (
          bank_account_id, statement_date, transaction_date, value_date, description,
          reference_number, debit_amount, credit_amount, balance, transaction_type, import_batch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
      `, [
        bank_account_id,
        stmt.statement_date || stmt.transaction_date,
        stmt.transaction_date,
        stmt.value_date,
        stmt.description,
        stmt.reference_number,
        stmt.debit_amount || 0,
        stmt.credit_amount || 0,
        stmt.balance,
        stmt.transaction_type,
        importBatchId
      ]);
      imported.push(result.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: `${imported.length} statements imported`, data: imported, batchId: importBatchId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing statements:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// Add single statement entry
router.post('/statements', async (req, res) => {
  try {
    const { bank_account_id, transaction_date, value_date, description, reference_number, 
            debit_amount, credit_amount, balance, transaction_type } = req.body;

    const result = await query(`
      INSERT INTO bank_statements (
        bank_account_id, statement_date, transaction_date, value_date, description,
        reference_number, debit_amount, credit_amount, balance, transaction_type
      ) VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [bank_account_id, transaction_date, value_date, description, reference_number,
        debit_amount || 0, credit_amount || 0, balance, transaction_type]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding statement:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete statement
router.delete('/statements/:id', async (req, res) => {
  try {
    await query('DELETE FROM bank_statements WHERE id = $1', [req.params.id]);
    res.json({ message: 'Statement deleted successfully' });
  } catch (error) {
    console.error('Error deleting statement:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// =============================================
// RECONCILIATION
// =============================================

// Get unreconciled transactions from system
router.get('/unreconciled-transactions', async (req, res) => {
  try {
    const { from_date, to_date, type } = req.query;
    const transactions = [];

    const dateFilter = (dateField) => {
      let filter = '';
      if (from_date) filter += ` AND ${dateField} >= '${from_date}'`;
      if (to_date) filter += ` AND ${dateField} <= '${to_date}'`;
      return filter;
    };

    // Get expenses paid by bank
    if (!type || type === 'expenses') {
      const expenses = await query(`
        SELECT id, expense_date as date, 'expense' as type, description, amount,
               bill_number as reference, vendor_name as party
        FROM expenses
        WHERE payment_mode = 'bank' ${dateFilter('expense_date')}
        AND NOT EXISTS (
          SELECT 1 FROM reconciliation_log rl 
          WHERE rl.matched_type = 'expense' AND rl.matched_id = expenses.id
        )
        ORDER BY expense_date DESC
      `);
      transactions.push(...expenses.rows.map(e => ({ ...e, category: 'Expense' })));
    }

    // Get fuel entries paid by bank
    if (!type || type === 'fuel') {
      const fuel = await query(`
        SELECT fe.id, fe.date, 'fuel' as type, 
               CONCAT('Fuel - ', t.truck_number, ' - ', fe.fuel_station) as description,
               fe.total_amount as amount, fe.bill_number as reference, fe.fuel_station as party
        FROM fuel_entries fe
        LEFT JOIN trucks t ON fe.truck_id = t.id
        WHERE fe.payment_mode = 'bank' ${dateFilter('fe.date')}
        AND NOT EXISTS (
          SELECT 1 FROM reconciliation_log rl 
          WHERE rl.matched_type = 'fuel' AND rl.matched_id = fe.id
        )
        ORDER BY fe.date DESC
      `);
      transactions.push(...fuel.rows.map(f => ({ ...f, category: 'Fuel' })));
    }

    // Get salary payments by bank
    if (!type || type === 'salary') {
      const salary = await query(`
        SELECT sp.id, sp.payment_date as date, 'salary' as type,
               CONCAT('Salary - ', d.name, ' - ', sp.month) as description,
               sp.net_amount as amount, NULL as reference, d.name as party
        FROM salary_payments sp
        LEFT JOIN drivers d ON sp.driver_id = d.id
        WHERE sp.payment_mode = 'bank' ${dateFilter('sp.payment_date')}
        AND NOT EXISTS (
          SELECT 1 FROM reconciliation_log rl 
          WHERE rl.matched_type = 'salary' AND rl.matched_id = sp.id
        )
        ORDER BY sp.payment_date DESC
      `);
      transactions.push(...salary.rows.map(s => ({ ...s, category: 'Salary' })));
    }

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching unreconciled transactions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Auto-match suggestions
router.post('/suggest-matches', async (req, res) => {
  try {
    const { statement_id } = req.body;
    
    const statement = await query('SELECT * FROM bank_statements WHERE id = $1', [statement_id]);
    if (statement.rows.length === 0) {
      return res.status(404).json({ message: 'Statement not found' });
    }

    const stmt = statement.rows[0];
    const stmtAmount = parseFloat(stmt.debit_amount) || parseFloat(stmt.credit_amount);
    const isDebit = parseFloat(stmt.debit_amount) > 0;
    const suggestions = [];

    // Match by amount (within 1 rupee tolerance)
    if (isDebit) {
      const expenseByAmount = await query(`
        SELECT id, 'expense' as type, description, amount, expense_date as date, vendor_name as party
        FROM expenses 
        WHERE payment_mode = 'bank' 
        AND ABS(amount - $1) < 1
        AND expense_date BETWEEN $2::date - INTERVAL '7 days' AND $2::date + INTERVAL '7 days'
        LIMIT 5
      `, [stmtAmount, stmt.transaction_date]);
      
      expenseByAmount.rows.forEach(e => {
        suggestions.push({ ...e, confidence: 'medium', matchReason: 'Amount match' });
      });

      const fuelByAmount = await query(`
        SELECT fe.id, 'fuel' as type, CONCAT('Fuel - ', t.truck_number) as description, 
               fe.total_amount as amount, fe.date, fe.fuel_station as party
        FROM fuel_entries fe
        LEFT JOIN trucks t ON fe.truck_id = t.id
        WHERE fe.payment_mode = 'bank'
        AND ABS(fe.total_amount - $1) < 1
        AND fe.date BETWEEN $2::date - INTERVAL '7 days' AND $2::date + INTERVAL '7 days'
        LIMIT 5
      `, [stmtAmount, stmt.transaction_date]);
      
      fuelByAmount.rows.forEach(f => {
        suggestions.push({ ...f, confidence: 'medium', matchReason: 'Amount match' });
      });
    }

    res.json(suggestions);
  } catch (error) {
    console.error('Error suggesting matches:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reconcile statement with transaction
router.post('/reconcile', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { statement_id, matched_type, matched_id, notes } = req.body;

    const statement = await client.query('SELECT * FROM bank_statements WHERE id = $1', [statement_id]);
    if (statement.rows.length === 0) {
      throw new Error('Statement not found');
    }

    const stmtAmount = parseFloat(statement.rows[0].debit_amount) || parseFloat(statement.rows[0].credit_amount);

    await client.query(`
      UPDATE bank_statements SET
        is_reconciled = true,
        reconciled_with_type = $1,
        reconciled_with_id = $2,
        reconciled_date = CURRENT_DATE,
        reconciled_by = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [matched_type, matched_id, req.user.id, statement_id]);

    await client.query(`
      INSERT INTO reconciliation_log (bank_statement_id, matched_type, matched_id, matched_amount, match_confidence, notes, created_by)
      VALUES ($1, $2, $3, $4, 'manual', $5, $6)
    `, [statement_id, matched_type, matched_id, stmtAmount, notes, req.user.id]);

    await client.query('COMMIT');
    res.json({ message: 'Reconciliation successful' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reconciling:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

// Unreconcile statement
router.post('/unreconcile/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE bank_statements SET
        is_reconciled = false, reconciled_with_type = NULL, reconciled_with_id = NULL,
        reconciled_date = NULL, reconciled_by = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [req.params.id]);

    await client.query('DELETE FROM reconciliation_log WHERE bank_statement_id = $1', [req.params.id]);

    await client.query('COMMIT');
    res.json({ message: 'Unreconciled successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error unreconciling:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

export default router;
