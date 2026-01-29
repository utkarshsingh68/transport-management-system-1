import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get dashboard summary
router.get('/summary', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const params = [];
    let paramIndex = 1;

    let dateFilter = '';
    if (start_date && end_date) {
      dateFilter = ` AND date >= $${paramIndex} AND date <= $${paramIndex + 1}`;
      params.push(start_date, end_date);
      paramIndex += 2;
    }

    // Get total income from trips
    const incomeResult = await query(
      `SELECT COALESCE(SUM(actual_income), 0) as total_income
       FROM trips
       WHERE status = 'completed'
       ${dateFilter.replace('date', 'start_date')}`,
      params
    );

    // Get total expenses
    const expensesResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total_expenses
       FROM expenses
       ${dateFilter.replace('date', 'expense_date')}`,
      params
    );

    // Get total fuel cost
    const fuelResult = await query(
      `SELECT COALESCE(SUM(total_amount), 0) as total_fuel
       FROM fuel_entries
       ${dateFilter}`,
      params
    );

    // Get total salary paid
    const salaryResult = await query(
      `SELECT COALESCE(SUM(net_amount), 0) as total_salary
       FROM salary_payments
       ${dateFilter.replace('date', 'payment_date')}`,
      params
    );

    const totalIncome = parseFloat(incomeResult.rows[0].total_income);
    const totalExpenses = parseFloat(expensesResult.rows[0].total_expenses);
    const totalFuel = parseFloat(fuelResult.rows[0].total_fuel);
    const totalSalary = parseFloat(salaryResult.rows[0].total_salary);
    const totalCosts = totalExpenses + totalFuel + totalSalary;
    const profit = totalIncome - totalCosts;

    res.json({
      total_income: totalIncome,
      total_expenses: totalExpenses,
      total_fuel: totalFuel,
      total_salary: totalSalary,
      total_costs: totalCosts,
      profit: profit,
      profit_margin: totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(2) : 0
    });
  } catch (error) {
    next(error);
  }
});

// Get monthly P&L report
router.get('/monthly', async (req, res, next) => {
  try {
    const { year } = req.query;
    const yearFilter = year ? `AND EXTRACT(YEAR FROM start_date) = $1` : '';
    const params = year ? [year] : [];

    const result = await query(
      `SELECT 
        TO_CHAR(start_date, 'YYYY-MM') as month,
        COUNT(*) as total_trips,
        SUM(actual_income) as income
       FROM trips
       WHERE status = 'completed' ${yearFilter}
       GROUP BY TO_CHAR(start_date, 'YYYY-MM')
       ORDER BY month DESC`,
      params
    );

    const expensesResult = await query(
      `SELECT 
        TO_CHAR(expense_date, 'YYYY-MM') as month,
        SUM(amount) as total
       FROM expenses
       ${yearFilter.replace('start_date', 'expense_date')}
       GROUP BY TO_CHAR(expense_date, 'YYYY-MM')`,
      params
    );

    const fuelResult = await query(
      `SELECT 
        TO_CHAR(date, 'YYYY-MM') as month,
        SUM(total_amount) as total
       FROM fuel_entries
       ${yearFilter.replace('start_date', 'date')}
       GROUP BY TO_CHAR(date, 'YYYY-MM')`,
      params
    );

    // Combine results
    const monthlyData = {};
    result.rows.forEach(row => {
      monthlyData[row.month] = {
        month: row.month,
        total_trips: row.total_trips,
        income: parseFloat(row.income) || 0,
        expenses: 0,
        fuel: 0
      };
    });

    expensesResult.rows.forEach(row => {
      if (monthlyData[row.month]) {
        monthlyData[row.month].expenses = parseFloat(row.total) || 0;
      }
    });

    fuelResult.rows.forEach(row => {
      if (monthlyData[row.month]) {
        monthlyData[row.month].fuel = parseFloat(row.total) || 0;
      }
    });

    const finalData = Object.values(monthlyData).map(item => ({
      ...item,
      total_costs: item.expenses + item.fuel,
      profit: item.income - (item.expenses + item.fuel)
    }));

    res.json(finalData);
  } catch (error) {
    next(error);
  }
});

// Get truck-wise P&L report
router.get('/truck-wise', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const params = [];
    let paramIndex = 1;

    let dateFilter = '';
    if (start_date && end_date) {
      dateFilter = ` WHERE t.start_date >= $${paramIndex} AND t.start_date <= $${paramIndex + 1}`;
      params.push(start_date, end_date);
      paramIndex += 2;
    }

    const result = await query(
      `SELECT 
        tr.id as truck_id,
        tr.truck_number,
        COUNT(t.id) as total_trips,
        COALESCE(SUM(t.actual_income), 0) as income,
        COALESCE(
          (SELECT SUM(amount) FROM expenses e WHERE e.truck_id = tr.id 
           ${start_date && end_date ? `AND e.expense_date >= $${paramIndex} AND e.expense_date <= $${paramIndex + 1}` : ''}),
          0
        ) as expenses,
        COALESCE(
          (SELECT SUM(total_amount) FROM fuel_entries f WHERE f.truck_id = tr.id 
           ${start_date && end_date ? `AND f.date >= $${paramIndex} AND f.date <= $${paramIndex + 1}` : ''}),
          0
        ) as fuel
       FROM trucks tr
       LEFT JOIN trips t ON tr.id = t.truck_id AND t.status = 'completed' ${dateFilter.replace('WHERE', 'AND')}
       GROUP BY tr.id, tr.truck_number
       ORDER BY tr.truck_number`,
      params
    );

    const data = result.rows.map(row => ({
      ...row,
      income: parseFloat(row.income),
      expenses: parseFloat(row.expenses),
      fuel: parseFloat(row.fuel),
      total_costs: parseFloat(row.expenses) + parseFloat(row.fuel),
      profit: parseFloat(row.income) - (parseFloat(row.expenses) + parseFloat(row.fuel))
    }));

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Get driver-wise report
router.get('/driver-wise', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const params = [];
    let paramIndex = 1;

    let dateFilter = '';
    if (start_date && end_date) {
      dateFilter = ` WHERE t.start_date >= $${paramIndex} AND t.start_date <= $${paramIndex + 1}`;
      params.push(start_date, end_date);
      paramIndex += 2;
    }

    const result = await query(
      `SELECT 
        d.id as driver_id,
        d.name as driver_name,
        COUNT(t.id) as total_trips,
        COALESCE(SUM(t.actual_income), 0) as income,
        d.salary_amount
       FROM drivers d
       LEFT JOIN trips t ON d.id = t.driver_id AND t.status = 'completed' ${dateFilter.replace('WHERE', 'AND')}
       GROUP BY d.id, d.name, d.salary_amount
       ORDER BY d.name`,
      params
    );

    res.json(result.rows.map(row => ({
      ...row,
      income: parseFloat(row.income),
      salary_amount: parseFloat(row.salary_amount) || 0
    })));
  } catch (error) {
    next(error);
  }
});

// Get cash and bank balance
router.get('/ledger/balance', async (req, res, next) => {
  try {
    const cashResult = await query(
      `SELECT balance_after FROM cash_transactions 
       ORDER BY created_at DESC, id DESC LIMIT 1`
    );

    const bankResult = await query(
      `SELECT balance_after FROM bank_transactions 
       ORDER BY created_at DESC, id DESC LIMIT 1`
    );

    res.json({
      cash_balance: cashResult.rows[0]?.balance_after || 0,
      bank_balance: bankResult.rows[0]?.balance_after || 0
    });
  } catch (error) {
    next(error);
  }
});

export default router;
