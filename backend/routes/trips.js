import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toMoneyNumber = (value) => {
  const num = toNullableNumber(value);
  return num ?? 0;
};

const syncTripSpentExpense = async ({ tripId, truckId, startDate, amount, userId }) => {
  const referenceType = 'trip_spend';
  const referenceId = tripId;

  const existing = await query(
    `SELECT id FROM expenses WHERE reference_type = $1 AND reference_id = $2 LIMIT 1`,
    [referenceType, referenceId]
  );
  const existingId = existing.rows[0]?.id;

  // If amount is zero, remove the linked expense (if it exists)
  if (!amount || amount <= 0) {
    if (existingId) {
      await query(`DELETE FROM expenses WHERE id = $1`, [existingId]);
    }
    return;
  }

  const expenseDate = startDate; // trip start date as expense date
  const category = 'Trip Spend';
  const description = 'Auto: Trip spent amount';
  const paymentMode = 'cash';
  const vendorName = 'Trip';

  if (existingId) {
    await query(
      `UPDATE expenses SET
        expense_date = $1,
        truck_id = $2,
        trip_id = $3,
        category = $4,
        description = $5,
        amount = $6,
        payment_mode = $7,
        vendor_name = $8,
        created_by = $9
      WHERE id = $10`,
      [expenseDate, truckId || null, tripId, category, description, amount, paymentMode, vendorName, userId, existingId]
    );
    return;
  }

  await query(
    `INSERT INTO expenses (
      expense_date, truck_id, trip_id, category, description, amount, payment_mode, vendor_name, reference_type, reference_id, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (reference_type, reference_id) DO UPDATE SET
      expense_date = EXCLUDED.expense_date,
      truck_id = EXCLUDED.truck_id,
      trip_id = EXCLUDED.trip_id,
      category = EXCLUDED.category,
      description = EXCLUDED.description,
      amount = EXCLUDED.amount,
      payment_mode = EXCLUDED.payment_mode,
      vendor_name = EXCLUDED.vendor_name,
      created_by = EXCLUDED.created_by`,
    [expenseDate, truckId || null, tripId, category, description, amount, paymentMode, vendorName, referenceType, referenceId, userId]
  );
};

// Calculate trip income
const calculateIncome = (rateType, weightTons, ratePerTon, distanceKm, fixedAmount) => {
  if (rateType === 'per_ton' && weightTons && ratePerTon) {
    return weightTons * ratePerTon;
  } else if (rateType === 'per_km' && distanceKm && ratePerTon) {
    return distanceKm * ratePerTon;
  } else if (rateType === 'fixed') {
    return fixedAmount || 0;
  }
  return 0;
};

// Get all trips
router.get('/', async (req, res, next) => {
  try {
    const { truck_id, driver_id, status, start_date, end_date } = req.query;
    let queryText = `
      SELECT t.*, tr.truck_number, d.name as driver_name
      FROM trips t
      LEFT JOIN trucks tr ON t.truck_id = tr.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (truck_id) {
      queryText += ` AND t.truck_id = $${paramIndex}`;
      params.push(truck_id);
      paramIndex++;
    }

    if (driver_id) {
      queryText += ` AND t.driver_id = $${paramIndex}`;
      params.push(driver_id);
      paramIndex++;
    }

    if (status) {
      queryText += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (start_date) {
      queryText += ` AND t.start_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      queryText += ` AND t.start_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    queryText += ' ORDER BY t.start_date DESC, t.id DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get trip by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT t.*, tr.truck_number, d.name as driver_name
      FROM trips t
      LEFT JOIN trucks tr ON t.truck_id = tr.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      WHERE t.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create trip
router.post('/',
  authorizeRoles('admin', 'manager', 'accountant'),
  [
    body('trip_number').notEmpty().trim(),
    body('truck_id').isInt(),
    body('driver_id').isInt(),
    body('from_location').notEmpty().trim(),
    body('to_location').notEmpty().trim(),
    body('start_date').isDate()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        trip_number, truck_id, driver_id, from_location, to_location,
        start_date, end_date, distance_km, weight_tons, rate_per_ton,
        rate_type, fixed_amount, actual_income, driver_advance_amount, trip_spent_amount, consignor_name,
        consignee_name, lr_number, status, notes
      } = req.body;

      const distanceKmNum = toNullableNumber(distance_km);
      const weightTonsNum = toNullableNumber(weight_tons);
      const ratePerTonNum = toNullableNumber(rate_per_ton);
      const fixedAmountNum = toNullableNumber(fixed_amount);
      const actualIncomeNum = toNullableNumber(actual_income);
      const driverAdvanceAmountNum = toMoneyNumber(driver_advance_amount);
      const tripSpentAmountNum = toMoneyNumber(trip_spent_amount);

      const calculated_income = calculateIncome(rate_type, weightTonsNum, ratePerTonNum, distanceKmNum, fixedAmountNum);

      const result = await query(
        `INSERT INTO trips (
          trip_number, truck_id, driver_id, from_location, to_location,
          start_date, end_date, distance_km, weight_tons, rate_per_ton,
          rate_type, fixed_amount, calculated_income, actual_income,
          driver_advance_amount, trip_spent_amount,
          consignor_name, consignee_name, lr_number, status, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING *`,
        [
          trip_number, truck_id, driver_id, from_location, to_location,
          start_date, end_date, distanceKmNum, weightTonsNum, ratePerTonNum,
          rate_type, fixedAmountNum, calculated_income, actualIncomeNum ?? calculated_income,
          driverAdvanceAmountNum, tripSpentAmountNum,
          consignor_name, consignee_name, lr_number, status || 'planned', notes, req.user.id
        ]
      );

      const createdTrip = result.rows[0];
      await syncTripSpentExpense({
        tripId: createdTrip.id,
        truckId: createdTrip.truck_id,
        startDate: createdTrip.start_date,
        amount: tripSpentAmountNum,
        userId: req.user.id
      });

      res.status(201).json(createdTrip);
    } catch (error) {
      next(error);
    }
  }
);

// Update trip
router.put('/:id',
  authorizeRoles('admin', 'manager', 'accountant'),
  async (req, res, next) => {
    try {
      const {
        trip_number, truck_id, driver_id, from_location, to_location,
        start_date, end_date, distance_km, weight_tons, rate_per_ton,
        rate_type, fixed_amount, actual_income, driver_advance_amount, trip_spent_amount, consignor_name,
        consignee_name, lr_number, status, notes
      } = req.body;

      const distanceKmNum = toNullableNumber(distance_km);
      const weightTonsNum = toNullableNumber(weight_tons);
      const ratePerTonNum = toNullableNumber(rate_per_ton);
      const fixedAmountNum = toNullableNumber(fixed_amount);
      const actualIncomeNum = toNullableNumber(actual_income);
      const driverAdvanceAmountNum = toMoneyNumber(driver_advance_amount);
      const tripSpentAmountNum = toMoneyNumber(trip_spent_amount);

      const calculated_income = calculateIncome(rate_type, weightTonsNum, ratePerTonNum, distanceKmNum, fixedAmountNum);

      const result = await query(
        `UPDATE trips SET
          trip_number = $1, truck_id = $2, driver_id = $3, from_location = $4, to_location = $5,
          start_date = $6, end_date = $7, distance_km = $8, weight_tons = $9, rate_per_ton = $10,
          rate_type = $11, fixed_amount = $12, calculated_income = $13, actual_income = $14,
          driver_advance_amount = $15, trip_spent_amount = $16,
          consignor_name = $17, consignee_name = $18, lr_number = $19, status = $20, notes = $21
        WHERE id = $22
        RETURNING *`,
        [
          trip_number, truck_id, driver_id, from_location, to_location,
          start_date, end_date, distanceKmNum, weightTonsNum, ratePerTonNum,
          rate_type, fixedAmountNum, calculated_income, actualIncomeNum ?? calculated_income,
          driverAdvanceAmountNum, tripSpentAmountNum,
          consignor_name, consignee_name, lr_number, status, notes, req.params.id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      const updatedTrip = result.rows[0];
      await syncTripSpentExpense({
        tripId: updatedTrip.id,
        truckId: updatedTrip.truck_id,
        startDate: updatedTrip.start_date,
        amount: tripSpentAmountNum,
        userId: req.user.id
      });

      res.json(updatedTrip);
    } catch (error) {
      next(error);
    }
  }
);

// Delete trip
router.delete('/:id',
  authorizeRoles('admin'),
  async (req, res, next) => {
    try {
      const result = await query('DELETE FROM trips WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Trip not found' });
      }
      res.json({ message: 'Trip deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
