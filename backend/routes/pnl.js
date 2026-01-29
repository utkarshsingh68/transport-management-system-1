import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Comprehensive P&L Report
router.get('/pnl', async (req, res, next) => {
  try {
    const { start_date, end_date, truck_id, group_by } = req.query;

    // Default to current month
    const startOfMonth = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = end_date || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

    // Income from trips
    let incomeQuery = `
      SELECT COALESCE(SUM(actual_income), 0) as trip_income
      FROM trips
      WHERE status = 'completed'
        AND start_date BETWEEN $1 AND $2
    `;
    const incomeParams = [startOfMonth, endOfMonth];
    if (truck_id) {
      incomeQuery += ' AND truck_id = $3';
      incomeParams.push(truck_id);
    }
    const incomeResult = await query(incomeQuery, incomeParams);

    // Fuel expenses
    let fuelQuery = `
      SELECT COALESCE(SUM(total_amount), 0) as fuel_expense
      FROM fuel_entries
      WHERE date BETWEEN $1 AND $2
    `;
    const fuelParams = [startOfMonth, endOfMonth];
    if (truck_id) {
      fuelQuery += ' AND truck_id = $3';
      fuelParams.push(truck_id);
    }
    const fuelResult = await query(fuelQuery, fuelParams);

    // Other expenses by category
    let expenseQuery = `
      SELECT 
        category,
        COALESCE(SUM(amount), 0) as amount
      FROM expenses
      WHERE expense_date BETWEEN $1 AND $2
    `;
    const expenseParams = [startOfMonth, endOfMonth];
    if (truck_id) {
      expenseQuery += ' AND truck_id = $3';
      expenseParams.push(truck_id);
    }
    expenseQuery += ' GROUP BY category';
    const expenseResult = await query(expenseQuery, expenseParams);

    // Salary payments
    const salaryResult = await query(`
      SELECT COALESCE(SUM(net_amount), 0) as salary_expense
      FROM salary_payments
      WHERE payment_date BETWEEN $1 AND $2
    `, [startOfMonth, endOfMonth]);

    // Calculate totals
    const totalIncome = parseFloat(incomeResult.rows[0]?.trip_income || 0);
    const fuelExpense = parseFloat(fuelResult.rows[0]?.fuel_expense || 0);
    const salaryExpense = parseFloat(salaryResult.rows[0]?.salary_expense || 0);
    
    const expensesByCategory = expenseResult.rows.reduce((acc, row) => {
      acc[row.category] = parseFloat(row.amount);
      return acc;
    }, {});

    const otherExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0);
    const totalExpenses = fuelExpense + salaryExpense + otherExpenses;
    const netProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome * 100) : 0;

    res.json({
      period: { start_date: startOfMonth, end_date: endOfMonth },
      income: {
        trip_income: totalIncome,
        total: totalIncome
      },
      expenses: {
        fuel: fuelExpense,
        salary: salaryExpense,
        by_category: expensesByCategory,
        total: totalExpenses
      },
      net_profit: netProfit,
      profit_margin: profitMargin.toFixed(2)
    });
  } catch (error) {
    next(error);
  }
});

// Truck-wise P&L
router.get('/pnl/truck-wise', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    const startOfMonth = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = end_date || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

    const result = await query(`
      SELECT 
        t.id as truck_id,
        t.truck_number,
        COALESCE((SELECT SUM(actual_income) FROM trips WHERE truck_id = t.id AND status = 'completed' AND start_date BETWEEN $1 AND $2), 0) as income,
        COALESCE((SELECT SUM(total_amount) FROM fuel_entries WHERE truck_id = t.id AND date BETWEEN $1 AND $2), 0) as fuel_cost,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE truck_id = t.id AND expense_date BETWEEN $1 AND $2), 0) as other_expenses,
        COALESCE((SELECT COUNT(*) FROM trips WHERE truck_id = t.id AND status = 'completed' AND start_date BETWEEN $1 AND $2), 0) as trip_count,
        COALESCE((SELECT SUM(distance_km) FROM trips WHERE truck_id = t.id AND status = 'completed' AND start_date BETWEEN $1 AND $2), 0) as total_km
      FROM trucks t
      WHERE t.status = 'active'
      ORDER BY t.truck_number
    `, [startOfMonth, endOfMonth]);

    const truckWise = result.rows.map(row => ({
      ...row,
      income: parseFloat(row.income),
      fuel_cost: parseFloat(row.fuel_cost),
      other_expenses: parseFloat(row.other_expenses),
      total_expenses: parseFloat(row.fuel_cost) + parseFloat(row.other_expenses),
      profit: parseFloat(row.income) - parseFloat(row.fuel_cost) - parseFloat(row.other_expenses),
      avg_per_km: row.total_km > 0 
        ? ((parseFloat(row.income) - parseFloat(row.fuel_cost) - parseFloat(row.other_expenses)) / parseFloat(row.total_km)).toFixed(2)
        : 0
    }));

    res.json({
      period: { start_date: startOfMonth, end_date: endOfMonth },
      trucks: truckWise,
      summary: {
        total_income: truckWise.reduce((sum, t) => sum + t.income, 0),
        total_expenses: truckWise.reduce((sum, t) => sum + t.total_expenses, 0),
        total_profit: truckWise.reduce((sum, t) => sum + t.profit, 0)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Driver-wise performance
router.get('/pnl/driver-wise', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    const startOfMonth = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = end_date || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

    const result = await query(`
      SELECT 
        d.id as driver_id,
        d.name as driver_name,
        d.phone,
        COALESCE((SELECT COUNT(*) FROM trips WHERE driver_id = d.id AND status = 'completed' AND start_date BETWEEN $1 AND $2), 0) as trip_count,
        COALESCE((SELECT SUM(actual_income) FROM trips WHERE driver_id = d.id AND status = 'completed' AND start_date BETWEEN $1 AND $2), 0) as income_generated,
        COALESCE((SELECT SUM(distance_km) FROM trips WHERE driver_id = d.id AND status = 'completed' AND start_date BETWEEN $1 AND $2), 0) as total_km,
        COALESCE((SELECT SUM(net_amount) FROM salary_payments WHERE driver_id = d.id AND payment_date BETWEEN $1 AND $2), 0) as salary_paid,
        COALESCE((SELECT SUM(amount) FROM advance_payments WHERE driver_id = d.id AND is_adjusted = false), 0) as pending_advances
      FROM drivers d
      WHERE d.status = 'active'
      ORDER BY income_generated DESC
    `, [startOfMonth, endOfMonth]);

    res.json({
      period: { start_date: startOfMonth, end_date: endOfMonth },
      drivers: result.rows.map(row => ({
        ...row,
        income_generated: parseFloat(row.income_generated),
        salary_paid: parseFloat(row.salary_paid),
        pending_advances: parseFloat(row.pending_advances),
        avg_per_trip: row.trip_count > 0 ? (parseFloat(row.income_generated) / parseInt(row.trip_count)).toFixed(2) : 0
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Monthly trend report
router.get('/pnl/monthly-trend', async (req, res, next) => {
  try {
    const { months = 12 } = req.query;

    const result = await query(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE - INTERVAL '${parseInt(months) - 1} months'),
          date_trunc('month', CURRENT_DATE),
          '1 month'::interval
        ) as month
      )
      SELECT 
        to_char(m.month, 'YYYY-MM') as month,
        to_char(m.month, 'Mon YYYY') as month_label,
        COALESCE((SELECT SUM(actual_income) FROM trips WHERE status = 'completed' AND date_trunc('month', start_date) = m.month), 0) as income,
        COALESCE((SELECT SUM(total_amount) FROM fuel_entries WHERE date_trunc('month', date) = m.month), 0) as fuel,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE date_trunc('month', expense_date) = m.month), 0) as expenses,
        COALESCE((SELECT SUM(net_amount) FROM salary_payments WHERE date_trunc('month', payment_date) = m.month), 0) as salary
      FROM months m
      ORDER BY m.month
    `);

    const trend = result.rows.map(row => ({
      month: row.month,
      month_label: row.month_label,
      income: parseFloat(row.income),
      fuel: parseFloat(row.fuel),
      expenses: parseFloat(row.expenses),
      salary: parseFloat(row.salary),
      total_expenses: parseFloat(row.fuel) + parseFloat(row.expenses) + parseFloat(row.salary),
      profit: parseFloat(row.income) - parseFloat(row.fuel) - parseFloat(row.expenses) - parseFloat(row.salary)
    }));

    res.json(trend);
  } catch (error) {
    next(error);
  }
});

// Expense breakdown
router.get('/expense-breakdown', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    const startOfMonth = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = end_date || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

    // Fuel by payment mode
    const fuelByMode = await query(`
      SELECT payment_mode, COALESCE(SUM(total_amount), 0) as amount
      FROM fuel_entries
      WHERE date BETWEEN $1 AND $2
      GROUP BY payment_mode
    `, [startOfMonth, endOfMonth]);

    // Expenses by category
    const expensesByCategory = await query(`
      SELECT category, COALESCE(SUM(amount), 0) as amount
      FROM expenses
      WHERE expense_date BETWEEN $1 AND $2
      GROUP BY category
      ORDER BY amount DESC
    `, [startOfMonth, endOfMonth]);

    // Expenses by payment mode
    const expensesByMode = await query(`
      SELECT payment_mode, COALESCE(SUM(amount), 0) as amount
      FROM expenses
      WHERE expense_date BETWEEN $1 AND $2
      GROUP BY payment_mode
    `, [startOfMonth, endOfMonth]);

    res.json({
      period: { start_date: startOfMonth, end_date: endOfMonth },
      fuel_by_mode: fuelByMode.rows,
      expenses_by_category: expensesByCategory.rows,
      expenses_by_mode: expensesByMode.rows
    });
  } catch (error) {
    next(error);
  }
});

// Receivables aging report
router.get('/receivables-aging', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        t.name as party_name,
        ti.invoice_number,
        ti.invoice_date,
        ti.due_date,
        ti.amount,
        ti.paid_amount,
        ti.amount - ti.paid_amount as balance,
        CASE 
          WHEN ti.status = 'paid' THEN 'Paid'
          WHEN ti.due_date < CURRENT_DATE - INTERVAL '90 days' THEN '90+ Days'
          WHEN ti.due_date < CURRENT_DATE - INTERVAL '60 days' THEN '60-90 Days'
          WHEN ti.due_date < CURRENT_DATE - INTERVAL '30 days' THEN '30-60 Days'
          WHEN ti.due_date < CURRENT_DATE THEN '0-30 Days'
          ELSE 'Not Due'
        END as aging_bucket
      FROM transporter_invoices ti
      JOIN transporters t ON ti.transporter_id = t.id
      WHERE ti.status != 'paid'
      ORDER BY ti.due_date
    `);

    // Summarize by bucket
    const buckets = result.rows.reduce((acc, row) => {
      if (!acc[row.aging_bucket]) {
        acc[row.aging_bucket] = { count: 0, amount: 0 };
      }
      acc[row.aging_bucket].count++;
      acc[row.aging_bucket].amount += parseFloat(row.balance);
      return acc;
    }, {});

    res.json({
      details: result.rows,
      summary: buckets,
      total_receivable: result.rows.reduce((sum, row) => sum + parseFloat(row.balance), 0)
    });
  } catch (error) {
    next(error);
  }
});

export default router;
