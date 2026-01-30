import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

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
    const yearFilterExpense = year ? `WHERE EXTRACT(YEAR FROM expense_date) = $1` : '';
    const yearFilterFuel = year ? `WHERE EXTRACT(YEAR FROM date) = $1` : '';
    const params = year ? [year] : [];

    const result = await query(
      `SELECT 
        TO_CHAR(start_date, 'YYYY-MM') as month,
        COUNT(*) as total_trips,
        COALESCE(SUM(actual_income), 0) as income
       FROM trips
       WHERE status = 'completed' ${yearFilter}
       GROUP BY TO_CHAR(start_date, 'YYYY-MM')
       ORDER BY month DESC`,
      params
    );

    const expensesResult = await query(
      `SELECT 
        TO_CHAR(expense_date, 'YYYY-MM') as month,
        COALESCE(SUM(amount), 0) as total
       FROM expenses
       ${yearFilterExpense}
       GROUP BY TO_CHAR(expense_date, 'YYYY-MM')`,
      params
    );

    const fuelResult = await query(
      `SELECT 
        TO_CHAR(date, 'YYYY-MM') as month,
        COALESCE(SUM(total_amount), 0) as total
       FROM fuel_entries
       ${yearFilterFuel}
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

// ============= EXPORT ROUTES =============

// Export P&L Report as Excel
router.get('/export/pnl/excel', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const params = start_date && end_date ? [start_date, end_date] : [];
    const dateFilter = params.length ? 'WHERE start_date >= $1 AND start_date <= $2' : '';

    // Get income from trips
    const tripsResult = await query(
      `SELECT trip_number, truck_id, from_location, to_location, start_date, 
              actual_income, status
       FROM trips ${dateFilter.replace('start_date', 't.start_date')}
       ORDER BY start_date DESC`,
      params
    );

    // Get expenses
    const expensesResult = await query(
      `SELECT expense_date, category, description, amount, vendor_name
       FROM expenses ${dateFilter.replace('start_date', 'expense_date')}
       ORDER BY expense_date DESC`,
      params
    );

    // Get fuel
    const fuelResult = await query(
      `SELECT date, fuel_station, quantity_liters, price_per_liter, total_amount
       FROM fuel_entries ${dateFilter.replace('start_date', 'date')}
       ORDER BY date DESC`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Fleetora TMS';
    workbook.created = new Date();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    const totalIncome = tripsResult.rows.reduce((sum, t) => sum + (parseFloat(t.actual_income) || 0), 0);
    const totalExpenses = expensesResult.rows.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const totalFuel = fuelResult.rows.reduce((sum, f) => sum + parseFloat(f.total_amount), 0);
    
    summarySheet.columns = [
      { header: 'Category', key: 'category', width: 25 },
      { header: 'Amount (₹)', key: 'amount', width: 20 }
    ];
    summarySheet.addRow({ category: 'Total Income', amount: totalIncome });
    summarySheet.addRow({ category: 'Total Expenses', amount: totalExpenses });
    summarySheet.addRow({ category: 'Total Fuel', amount: totalFuel });
    summarySheet.addRow({ category: 'Net Profit', amount: totalIncome - totalExpenses - totalFuel });

    // Trips Sheet
    const tripsSheet = workbook.addWorksheet('Trips');
    tripsSheet.columns = [
      { header: 'Trip Number', key: 'trip_number', width: 15 },
      { header: 'From', key: 'from_location', width: 20 },
      { header: 'To', key: 'to_location', width: 20 },
      { header: 'Date', key: 'start_date', width: 12 },
      { header: 'Income (₹)', key: 'actual_income', width: 15 },
      { header: 'Status', key: 'status', width: 12 }
    ];
    tripsResult.rows.forEach(row => tripsSheet.addRow(row));

    // Expenses Sheet
    const expensesSheet = workbook.addWorksheet('Expenses');
    expensesSheet.columns = [
      { header: 'Date', key: 'expense_date', width: 12 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Amount (₹)', key: 'amount', width: 15 },
      { header: 'Vendor', key: 'vendor_name', width: 20 }
    ];
    expensesResult.rows.forEach(row => expensesSheet.addRow(row));

    // Fuel Sheet
    const fuelSheet = workbook.addWorksheet('Fuel');
    fuelSheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Station', key: 'fuel_station', width: 25 },
      { header: 'Liters', key: 'quantity_liters', width: 12 },
      { header: 'Price/L (₹)', key: 'price_per_liter', width: 12 },
      { header: 'Total (₹)', key: 'total_amount', width: 15 }
    ];
    fuelResult.rows.forEach(row => fuelSheet.addRow(row));

    // Style headers
    [summarySheet, tripsSheet, expensesSheet, fuelSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=PnL_Report_${new Date().toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

// Export Trips Report as Excel
router.get('/export/trips/excel', async (req, res, next) => {
  try {
    const { start_date, end_date, status } = req.query;
    let whereClause = '';
    const params = [];
    let paramIdx = 0;

    if (start_date && end_date) {
      params.push(start_date, end_date);
      whereClause += `${whereClause ? ' AND' : ' WHERE'} t.start_date >= $${++paramIdx} AND t.start_date <= $${++paramIdx}`;
    }
    if (status) {
      params.push(status);
      whereClause += `${whereClause ? ' AND' : ' WHERE'} t.status = $${++paramIdx}`;
    }

    const result = await query(
      `SELECT t.trip_number, tr.truck_number, d.name as driver_name,
              t.from_location, t.to_location, t.start_date, t.end_date,
              t.distance_km, t.weight_tons, t.actual_income, 
              t.driver_advance_amount, t.trip_spent_amount, t.status
       FROM trips t
       LEFT JOIN trucks tr ON t.truck_id = tr.id
       LEFT JOIN drivers d ON t.driver_id = d.id
       ${whereClause}
       ORDER BY t.start_date DESC`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Trips Report');
    
    sheet.columns = [
      { header: 'Trip #', key: 'trip_number', width: 12 },
      { header: 'Truck', key: 'truck_number', width: 12 },
      { header: 'Driver', key: 'driver_name', width: 18 },
      { header: 'From', key: 'from_location', width: 18 },
      { header: 'To', key: 'to_location', width: 18 },
      { header: 'Start Date', key: 'start_date', width: 12 },
      { header: 'End Date', key: 'end_date', width: 12 },
      { header: 'Distance (km)', key: 'distance_km', width: 12 },
      { header: 'Weight (tons)', key: 'weight_tons', width: 12 },
      { header: 'Income (₹)', key: 'actual_income', width: 12 },
      { header: 'Advance (₹)', key: 'driver_advance_amount', width: 12 },
      { header: 'Spent (₹)', key: 'trip_spent_amount', width: 12 },
      { header: 'Status', key: 'status', width: 12 }
    ];

    result.rows.forEach(row => sheet.addRow(row));

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Trips_Report_${new Date().toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

// Export P&L as PDF
router.get('/export/pnl/pdf', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const params = start_date && end_date ? [start_date, end_date] : [];
    const dateFilter = params.length ? 'WHERE start_date >= $1 AND start_date <= $2' : '';

    // Get data
    const incomeResult = await query(
      `SELECT COALESCE(SUM(actual_income), 0) as total FROM trips WHERE status = 'completed' 
       ${dateFilter.replace('WHERE start_date', 'AND start_date')}`,
      params
    );
    const expensesResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses 
       ${dateFilter.replace('start_date', 'expense_date')}`,
      params
    );
    const fuelResult = await query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM fuel_entries 
       ${dateFilter.replace('start_date', 'date')}`,
      params
    );

    const totalIncome = parseFloat(incomeResult.rows[0].total);
    const totalExpenses = parseFloat(expensesResult.rows[0].total);
    const totalFuel = parseFloat(fuelResult.rows[0].total);
    const netProfit = totalIncome - totalExpenses - totalFuel;

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=PnL_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(24).fillColor('#1e40af').text('Fleetora', { align: 'center' });
    doc.fontSize(10).fillColor('#64748b').text('Transport Management System', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).fillColor('#0f172a').text('Profit & Loss Report', { align: 'center' });
    
    if (start_date && end_date) {
      doc.fontSize(10).fillColor('#64748b').text(`Period: ${start_date} to ${end_date}`, { align: 'center' });
    }
    doc.moveDown(2);

    // Summary Table
    const formatCurrency = (amt) => `₹${amt.toLocaleString('en-IN')}`;
    
    doc.fontSize(12).fillColor('#0f172a');
    
    const tableTop = doc.y;
    const col1 = 50, col2 = 350, rowHeight = 30;

    // Table header
    doc.rect(col1, tableTop, 450, rowHeight).fill('#3b82f6');
    doc.fillColor('#ffffff').text('Category', col1 + 10, tableTop + 10);
    doc.text('Amount', col2 + 10, tableTop + 10);

    // Table rows
    const rows = [
      ['Total Income', formatCurrency(totalIncome)],
      ['Total Expenses', formatCurrency(totalExpenses)],
      ['Total Fuel Cost', formatCurrency(totalFuel)],
      ['Net Profit', formatCurrency(netProfit)]
    ];

    rows.forEach((row, i) => {
      const y = tableTop + (i + 1) * rowHeight;
      doc.rect(col1, y, 450, rowHeight).fill(i % 2 === 0 ? '#f8fafc' : '#ffffff');
      doc.fillColor(i === 3 ? (netProfit >= 0 ? '#16a34a' : '#dc2626') : '#334155');
      doc.text(row[0], col1 + 10, y + 10);
      doc.text(row[1], col2 + 10, y + 10);
    });

    // Footer
    doc.moveDown(4);
    doc.fontSize(8).fillColor('#94a3b8').text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });

    doc.end();
  } catch (error) {
    next(error);
  }
});

export default router;
