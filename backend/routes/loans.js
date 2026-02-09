import express from 'express';
import pool, { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Helper function to generate EMI schedule
const generateEMISchedule = (principal, rate, tenure, startDate, emiAmount, interestType) => {
  const schedule = [];
  let balance = principal;
  const monthlyRate = rate / 12 / 100;
  const start = new Date(startDate);

  for (let i = 1; i <= tenure; i++) {
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + i - 1);

    let interestComponent, principalComponent;

    if (interestType === 'flat') {
      interestComponent = (principal * rate / 100) / 12;
      principalComponent = emiAmount - interestComponent;
    } else {
      interestComponent = balance * monthlyRate;
      principalComponent = emiAmount - interestComponent;
    }

    const openingBalance = balance;
    balance = Math.max(0, balance - principalComponent);

    schedule.push({
      emi_number: i,
      due_date: dueDate.toISOString().split('T')[0],
      emi_amount: emiAmount,
      principal_component: Math.round(principalComponent * 100) / 100,
      interest_component: Math.round(interestComponent * 100) / 100,
      opening_balance: Math.round(openingBalance * 100) / 100,
      closing_balance: Math.round(balance * 100) / 100
    });
  }

  return schedule;
};

// Calculate EMI amount
const calculateEMI = (principal, rate, tenure, interestType) => {
  if (interestType === 'flat') {
    const totalInterest = (principal * rate * tenure / 12) / 100;
    return (principal + totalInterest) / tenure;
  }
  const monthlyRate = rate / 12 / 100;
  const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenure) / (Math.pow(1 + monthlyRate, tenure) - 1);
  return Math.round(emi * 100) / 100;
};

// Get loans summary - Must be before /:id
router.get('/stats/summary', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total_loans,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_loans,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_loans,
        COALESCE(SUM(principal_amount), 0) as total_principal,
        COALESCE(SUM(CASE WHEN status = 'active' THEN outstanding_amount ELSE 0 END), 0) as total_outstanding,
        COALESCE(SUM(total_paid), 0) as total_paid,
        COALESCE(SUM(CASE WHEN status = 'active' THEN emi_amount ELSE 0 END), 0) as total_monthly_emi
      FROM loans
    `);

    // Get upcoming EMIs (next 30 days)
    const upcomingEmis = await query(`
      SELECT es.*, l.loan_name, l.lender_name
      FROM emi_schedule es
      JOIN loans l ON es.loan_id = l.id
      WHERE es.status IN ('pending', 'partial')
      AND es.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY es.due_date
    `);

    // Get overdue EMIs
    const overdueEmis = await query(`
      SELECT es.*, l.loan_name, l.lender_name,
             CURRENT_DATE - es.due_date as days_overdue
      FROM emi_schedule es
      JOIN loans l ON es.loan_id = l.id
      WHERE es.status IN ('pending', 'partial')
      AND es.due_date < CURRENT_DATE
      ORDER BY es.due_date
    `);

    res.json({
      summary: result.rows[0],
      upcoming_emis: upcomingEmis.rows,
      overdue_emis: overdueEmis.rows
    });
  } catch (error) {
    console.error('Error fetching loans summary:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Calculate EMI (utility endpoint)
router.post('/calculate-emi', async (req, res) => {
  try {
    const { principal, rate, tenure, interest_type } = req.body;
    const emi = calculateEMI(principal, rate, tenure, interest_type || 'reducing');
    const schedule = generateEMISchedule(principal, rate, tenure, new Date().toISOString().split('T')[0], emi, interest_type || 'reducing');

    const totalInterest = schedule.reduce((sum, s) => sum + s.interest_component, 0);
    const totalAmount = principal + totalInterest;

    res.json({
      emi_amount: emi,
      total_interest: Math.round(totalInterest * 100) / 100,
      total_amount: Math.round(totalAmount * 100) / 100,
      schedule_preview: schedule.slice(0, 3)
    });
  } catch (error) {
    console.error('Error calculating EMI:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update overdue status
router.post('/update-overdue', async (req, res) => {
  try {
    await query(`
      UPDATE emi_schedule SET
        status = 'overdue',
        days_overdue = CURRENT_DATE - due_date
      WHERE status IN ('pending', 'partial')
      AND due_date < CURRENT_DATE
    `);
    res.json({ message: 'Overdue status updated' });
  } catch (error) {
    console.error('Error updating overdue status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all loans
router.get('/', async (req, res) => {
  try {
    const { status, truck_id, lender_type } = req.query;

    let queryText = `
      SELECT l.*, t.truck_number
      FROM loans l
      LEFT JOIN trucks t ON l.truck_id = t.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (status && status !== 'all') {
      paramCount++;
      queryText += ` AND l.status = $${paramCount}`;
      params.push(status);
    }

    if (truck_id) {
      paramCount++;
      queryText += ` AND l.truck_id = $${paramCount}`;
      params.push(truck_id);
    }

    if (lender_type) {
      paramCount++;
      queryText += ` AND l.lender_type = $${paramCount}`;
      params.push(lender_type);
    }

    queryText += ` ORDER BY l.created_at DESC`;

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get loan by ID with schedule
router.get('/:id', async (req, res) => {
  try {
    const loan = await query(`
      SELECT l.*, t.truck_number
      FROM loans l
      LEFT JOIN trucks t ON l.truck_id = t.id
      WHERE l.id = $1
    `, [req.params.id]);

    if (loan.rows.length === 0) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    const schedule = await query(`SELECT * FROM emi_schedule WHERE loan_id = $1 ORDER BY emi_number`, [req.params.id]);
    const payments = await query(`SELECT * FROM emi_payments WHERE loan_id = $1 ORDER BY payment_date DESC`, [req.params.id]);

    res.json({
      ...loan.rows[0],
      schedule: schedule.rows,
      payments: payments.rows
    });
  } catch (error) {
    console.error('Error fetching loan:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create loan
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      loan_name, truck_id, asset_type, lender_type, lender_name, lender_branch,
      loan_account_number, loan_type, principal_amount, interest_rate, interest_type,
      tenure_months, emi_amount, emi_start_date, emi_day, sanction_date, disbursement_date,
      processing_fee, insurance_amount, notes
    } = req.body;

    const calculatedEMI = emi_amount || calculateEMI(principal_amount, interest_rate, tenure_months, interest_type);

    const maturityDate = new Date(emi_start_date);
    maturityDate.setMonth(maturityDate.getMonth() + tenure_months - 1);

    const loanResult = await client.query(`
      INSERT INTO loans (
        loan_name, truck_id, asset_type, lender_type, lender_name, lender_branch,
        loan_account_number, loan_type, principal_amount, interest_rate, interest_type,
        tenure_months, emi_amount, emi_start_date, emi_day, sanction_date, disbursement_date,
        maturity_date, outstanding_amount, emis_remaining, next_emi_date,
        processing_fee, insurance_amount, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $9, $12, $14, $19, $20, $21, $22)
      RETURNING *
    `, [
      loan_name, truck_id || null, asset_type, lender_type, lender_name, lender_branch,
      loan_account_number, loan_type, principal_amount, interest_rate, interest_type,
      tenure_months, calculatedEMI, emi_start_date, emi_day || 1, sanction_date, disbursement_date,
      maturityDate.toISOString().split('T')[0], processing_fee || 0, insurance_amount || 0, notes, req.user.id
    ]);

    const loanId = loanResult.rows[0].id;

    const schedule = generateEMISchedule(
      principal_amount, interest_rate, tenure_months, emi_start_date, calculatedEMI, interest_type
    );

    for (const emi of schedule) {
      await client.query(`
        INSERT INTO emi_schedule (
          loan_id, emi_number, due_date, emi_amount, principal_component,
          interest_component, opening_balance, closing_balance
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [loanId, emi.emi_number, emi.due_date, emi.emi_amount, emi.principal_component,
          emi.interest_component, emi.opening_balance, emi.closing_balance]);
    }

    await client.query('COMMIT');
    res.status(201).json(loanResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating loan:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// Update loan
router.put('/:id', async (req, res) => {
  try {
    const {
      loan_name, truck_id, asset_type, lender_type, lender_name, lender_branch,
      loan_account_number, loan_type, sanction_date, processing_fee, insurance_amount, notes
    } = req.body;

    const result = await query(`
      UPDATE loans SET
        loan_name = $1, truck_id = $2, asset_type = $3, lender_type = $4,
        lender_name = $5, lender_branch = $6, loan_account_number = $7, loan_type = $8,
        sanction_date = $9, processing_fee = $10, insurance_amount = $11, notes = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13 RETURNING *
    `, [loan_name, truck_id, asset_type, lender_type, lender_name, lender_branch,
        loan_account_number, loan_type, sanction_date, processing_fee, insurance_amount, notes, req.params.id]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating loan:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete loan
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM emi_payments WHERE loan_id = $1', [req.params.id]);
    await client.query('DELETE FROM emi_schedule WHERE loan_id = $1', [req.params.id]);
    await client.query('DELETE FROM loans WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ message: 'Loan deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting loan:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// Record EMI payment
router.post('/:id/pay', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const loanId = req.params.id;
    const { payment_date, payment_amount, payment_mode, payment_reference, bank_account_id, notes, emi_schedule_id } = req.body;

    const loan = await client.query('SELECT * FROM loans WHERE id = $1', [loanId]);
    if (loan.rows.length === 0) {
      throw new Error('Loan not found');
    }

    const loanData = loan.rows[0];
    let principalPaid = 0;
    let interestPaid = 0;
    let remainingPayment = parseFloat(payment_amount);

    if (emi_schedule_id) {
      const emi = await client.query('SELECT * FROM emi_schedule WHERE id = $1', [emi_schedule_id]);
      if (emi.rows.length > 0) {
        const emiData = emi.rows[0];
        const emiDue = parseFloat(emiData.emi_amount) - parseFloat(emiData.paid_amount || 0);
        const payingAmount = Math.min(remainingPayment, emiDue);

        principalPaid = Math.min(payingAmount, parseFloat(emiData.principal_component));
        interestPaid = payingAmount - principalPaid;

        const newPaidAmount = parseFloat(emiData.paid_amount || 0) + payingAmount;
        const status = newPaidAmount >= parseFloat(emiData.emi_amount) ? 'paid' : 'partial';

        await client.query(`
          UPDATE emi_schedule SET
            status = $1, paid_amount = $2, paid_date = $3, payment_mode = $4, payment_reference = $5,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
        `, [status, newPaidAmount, payment_date, payment_mode, payment_reference, emi_schedule_id]);

        remainingPayment -= payingAmount;
      }
    } else {
      const pendingEmis = await client.query(`
        SELECT * FROM emi_schedule 
        WHERE loan_id = $1 AND status IN ('pending', 'partial', 'overdue')
        ORDER BY emi_number
      `, [loanId]);

      for (const emi of pendingEmis.rows) {
        if (remainingPayment <= 0) break;

        const emiDue = parseFloat(emi.emi_amount) - parseFloat(emi.paid_amount || 0);
        const payingAmount = Math.min(remainingPayment, emiDue);

        const emiPrincipal = Math.min(payingAmount, parseFloat(emi.principal_component) - (parseFloat(emi.paid_amount || 0) * parseFloat(emi.principal_component) / parseFloat(emi.emi_amount)));
        const emiInterest = payingAmount - emiPrincipal;

        principalPaid += emiPrincipal;
        interestPaid += emiInterest;

        const newPaidAmount = parseFloat(emi.paid_amount || 0) + payingAmount;
        const status = newPaidAmount >= parseFloat(emi.emi_amount) ? 'paid' : 'partial';

        await client.query(`
          UPDATE emi_schedule SET
            status = $1, paid_amount = $2, paid_date = $3, payment_mode = $4, payment_reference = $5,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
        `, [status, newPaidAmount, payment_date, payment_mode, payment_reference, emi.id]);

        remainingPayment -= payingAmount;
      }
    }

    await client.query(`
      INSERT INTO emi_payments (
        loan_id, emi_schedule_id, payment_date, payment_amount, principal_paid, interest_paid,
        payment_mode, payment_reference, bank_account_id, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [loanId, emi_schedule_id, payment_date, payment_amount, principalPaid, interestPaid,
        payment_mode, payment_reference, bank_account_id, notes, req.user.id]);

    const newTotalPaid = parseFloat(loanData.total_paid) + parseFloat(payment_amount);
    const newPrincipalPaid = parseFloat(loanData.principal_paid) + principalPaid;
    const newInterestPaid = parseFloat(loanData.interest_paid) + interestPaid;
    const newOutstanding = parseFloat(loanData.principal_amount) - newPrincipalPaid;

    const paidEmis = await client.query(
      `SELECT COUNT(*) FROM emi_schedule WHERE loan_id = $1 AND status = 'paid'`,
      [loanId]
    );
    const emisPaid = parseInt(paidEmis.rows[0].count);
    const emisRemaining = loanData.tenure_months - emisPaid;

    const nextEmi = await client.query(`
      SELECT due_date FROM emi_schedule 
      WHERE loan_id = $1 AND status IN ('pending', 'partial', 'overdue')
      ORDER BY emi_number LIMIT 1
    `, [loanId]);

    const nextEmiDate = nextEmi.rows.length > 0 ? nextEmi.rows[0].due_date : null;
    const status = newOutstanding <= 0 ? 'closed' : 'active';

    await client.query(`
      UPDATE loans SET
        total_paid = $1, principal_paid = $2, interest_paid = $3, outstanding_amount = $4,
        emis_paid = $5, emis_remaining = $6, last_payment_date = $7, next_emi_date = $8, status = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
    `, [newTotalPaid, newPrincipalPaid, newInterestPaid, newOutstanding, emisPaid, emisRemaining,
        payment_date, nextEmiDate, status, loanId]);

    await client.query('COMMIT');
    res.json({ message: 'Payment recorded successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error recording payment:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

// Get EMI schedule for a loan
router.get('/:id/schedule', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM emi_schedule WHERE loan_id = $1 ORDER BY emi_number`, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching EMI schedule:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get payment history for a loan
router.get('/:id/payments', async (req, res) => {
  try {
    const result = await query(`
      SELECT ep.*, es.emi_number, es.due_date as emi_due_date
      FROM emi_payments ep
      LEFT JOIN emi_schedule es ON ep.emi_schedule_id = es.id
      WHERE ep.loan_id = $1
      ORDER BY ep.payment_date DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
