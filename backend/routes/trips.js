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
    const { truck_id, driver_id, status, start_date, end_date, payment_status } = req.query;
    let queryText = `
      SELECT t.*, tr.truck_number, d.name as driver_name, p.name as consigner_name
      FROM trips t
      LEFT JOIN trucks tr ON t.truck_id = tr.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      LEFT JOIN parties p ON t.consigner_id = p.id
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

    if (payment_status) {
      queryText += ` AND t.payment_status = $${paramIndex}`;
      params.push(payment_status);
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
        consignee_name, lr_number, status, notes,
        freight_amount, payment_due_date, consigner_id
      } = req.body;

      const distanceKmNum = toNullableNumber(distance_km);
      const weightTonsNum = toNullableNumber(weight_tons);
      const ratePerTonNum = toNullableNumber(rate_per_ton);
      const fixedAmountNum = toNullableNumber(fixed_amount);
      const actualIncomeNum = toNullableNumber(actual_income);
      const driverAdvanceAmountNum = toMoneyNumber(driver_advance_amount);
      const tripSpentAmountNum = toMoneyNumber(trip_spent_amount);
      const freightAmountNum = toMoneyNumber(freight_amount);

      const calculated_income = calculateIncome(rate_type, weightTonsNum, ratePerTonNum, distanceKmNum, fixedAmountNum);

      // Auto-create party if consigner_name is provided but no consigner_id
      let finalConsignerId = consigner_id;
      if (consignor_name && !consigner_id) {
        // Check if party exists by name
        const existingParty = await query(
          `SELECT id FROM transporters WHERE LOWER(name) = LOWER($1) LIMIT 1`,
          [consignor_name]
        );
        
        if (existingParty.rows.length > 0) {
          finalConsignerId = existingParty.rows[0].id;
        } else {
          // Create new party
          const newParty = await query(
            `INSERT INTO transporters (name, opening_balance) VALUES ($1, 0) RETURNING id`,
            [consignor_name]
          );
          finalConsignerId = newParty.rows[0].id;
        }
      }

      // Handle payment scenarios from req.body.payment_scenario
      const paymentScenario = req.body.payment_scenario || 'not_paid'; // 'full_to_driver', 'left_with_party', 'partial_to_driver'
      const amountPaidToDriver = toMoneyNumber(req.body.amount_paid_to_driver || 0);
      
      let paymentStatus = 'pending';
      let amountPaid = 0;
      let amountDue = freightAmountNum;

      if (paymentScenario === 'full_to_driver' && freightAmountNum > 0) {
        paymentStatus = 'paid';
        amountPaid = freightAmountNum;
        amountDue = 0;
      } else if (paymentScenario === 'partial_to_driver' && amountPaidToDriver > 0) {
        paymentStatus = 'partial';
        amountPaid = amountPaidToDriver;
        amountDue = freightAmountNum - amountPaidToDriver;
      } else if (paymentScenario === 'left_with_party') {
        paymentStatus = 'pending';
        amountPaid = 0;
        amountDue = freightAmountNum;
      }

      const result = await query(
        `INSERT INTO trips (
          trip_number, truck_id, driver_id, from_location, to_location,
          start_date, end_date, distance_km, weight_tons, rate_per_ton,
          rate_type, fixed_amount, calculated_income, actual_income,
          driver_advance_amount, trip_spent_amount,
          consignor_name, consignee_name, lr_number, status, notes, created_by,
          freight_amount, amount_paid, amount_due, payment_status, payment_due_date, consigner_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
        RETURNING *`,
        [
          trip_number, truck_id, driver_id, from_location, to_location,
          start_date, end_date, distanceKmNum, weightTonsNum, ratePerTonNum,
          rate_type, fixedAmountNum, calculated_income, actualIncomeNum ?? calculated_income,
          driverAdvanceAmountNum, tripSpentAmountNum,
          consignor_name, consignee_name, lr_number, status || 'planned', notes, req.user.id,
          freightAmountNum, amountPaid, amountDue, paymentStatus, payment_due_date || null, finalConsignerId
        ]
      );

      const createdTrip = result.rows[0];
      
      // Record payment to driver if applicable
      if (amountPaid > 0 && paymentScenario !== 'left_with_party') {
        await query(
          `INSERT INTO trip_payments (trip_id, amount, payment_date, payment_mode, notes, created_by)
           VALUES ($1, $2, $3, 'cash', $4, $5)`,
          [createdTrip.id, amountPaid, start_date, `Payment to driver: ${paymentScenario === 'full_to_driver' ? 'Full' : 'Partial'}`, req.user.id]
        );
      }
      
      // Update consigner ledger if freight amount and consigner are set
      if (freightAmountNum > 0 && finalConsignerId) {
        // Get current balance
        const balanceResult = await query(
          'SELECT outstanding_balance FROM consigner_balance WHERE consigner_id = $1',
          [finalConsignerId]
        );

        let currentBalance = balanceResult.rows.length > 0 
          ? parseFloat(balanceResult.rows[0].outstanding_balance) 
          : 0;
        
        // Add freight as credit (what consigner owes)
        let balanceAfterFreight = currentBalance + freightAmountNum;
        
        // Record freight in ledger as credit (debit to consigner)
        await query(
          `INSERT INTO consigner_ledger (consigner_id, trip_id, transaction_type, amount, balance_after, description, transaction_date, created_by)
           VALUES ($1, $2, 'credit', $3, $4, $5, $6, $7)`,
          [finalConsignerId, createdTrip.id, freightAmountNum, balanceAfterFreight, `New trip: ${trip_number} (${from_location} → ${to_location})`, start_date, req.user.id]
        );
        
        // If payment was made (full or partial), reduce the balance
        let finalBalance = balanceAfterFreight;
        if (amountPaid > 0) {
          finalBalance = balanceAfterFreight - amountPaid;
          
          // Record payment in ledger as debit (credit to consigner)
          const paymentDesc = paymentScenario === 'full_to_driver' 
            ? `Full payment received (paid to driver)` 
            : `Partial payment received: ₹${amountPaid} (paid to driver)`;
          
          await query(
            `INSERT INTO consigner_ledger (consigner_id, trip_id, transaction_type, amount, balance_after, description, transaction_date, created_by)
             VALUES ($1, $2, 'debit', $3, $4, $5, $6, $7)`,
            [finalConsignerId, createdTrip.id, amountPaid, finalBalance, paymentDesc, start_date, req.user.id]
          );
        }
        
        // Update or insert consigner balance
        await query(
          `INSERT INTO consigner_balance (consigner_id, outstanding_balance, total_freight, total_paid, total_trips, last_trip_date, last_updated)
           VALUES ($1, $2, $3, $4, 1, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (consigner_id) 
           DO UPDATE SET 
             outstanding_balance = consigner_balance.outstanding_balance + $2,
             total_freight = consigner_balance.total_freight + $3,
             total_paid = consigner_balance.total_paid + $4,
             total_trips = consigner_balance.total_trips + 1,
             last_trip_date = $5,
             last_updated = CURRENT_TIMESTAMP`,
          [finalConsignerId, amountDue, freightAmountNum, amountPaid, start_date]
        );
      }
      
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
        consignee_name, lr_number, status, notes,
        freight_amount, payment_due_date, consigner_id
      } = req.body;

      const distanceKmNum = toNullableNumber(distance_km);
      const weightTonsNum = toNullableNumber(weight_tons);
      const ratePerTonNum = toNullableNumber(rate_per_ton);
      const fixedAmountNum = toNullableNumber(fixed_amount);
      const actualIncomeNum = toNullableNumber(actual_income);
      const driverAdvanceAmountNum = toMoneyNumber(driver_advance_amount);
      const tripSpentAmountNum = toMoneyNumber(trip_spent_amount);
      const freightAmountNum = toMoneyNumber(freight_amount);

      const calculated_income = calculateIncome(rate_type, weightTonsNum, ratePerTonNum, distanceKmNum, fixedAmountNum);

      // Get existing trip to check for freight/consigner changes
      const existingTrip = await query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
      if (existingTrip.rows.length === 0) {
        return res.status(404).json({ error: 'Trip not found' });
      }
      const oldTrip = existingTrip.rows[0];

      const result = await query(
        `UPDATE trips SET
          trip_number = $1, truck_id = $2, driver_id = $3, from_location = $4, to_location = $5,
          start_date = $6, end_date = $7, distance_km = $8, weight_tons = $9, rate_per_ton = $10,
          rate_type = $11, fixed_amount = $12, calculated_income = $13, actual_income = $14,
          driver_advance_amount = $15, trip_spent_amount = $16,
          consignor_name = $17, consignee_name = $18, lr_number = $19, status = $20, notes = $21,
          freight_amount = $23, payment_due_date = $24, consigner_id = $25,
          amount_due = CASE WHEN $23 != COALESCE(freight_amount, 0) THEN $23 - COALESCE(amount_paid, 0) ELSE amount_due END
        WHERE id = $22
        RETURNING *`,
        [
          trip_number, truck_id, driver_id, from_location, to_location,
          start_date, end_date, distanceKmNum, weightTonsNum, ratePerTonNum,
          rate_type, fixedAmountNum, calculated_income, actualIncomeNum ?? calculated_income,
          driverAdvanceAmountNum, tripSpentAmountNum,
          consignor_name, consignee_name, lr_number, status, notes, req.params.id,
          freightAmountNum, payment_due_date || null, consigner_id || null
        ]
      );

      const updatedTrip = result.rows[0];

      // Handle consigner ledger updates if freight or consigner changed
      const oldFreight = parseFloat(oldTrip.freight_amount) || 0;
      const oldConsignerId = oldTrip.consigner_id;
      
      if (oldConsignerId !== consigner_id || oldFreight !== freightAmountNum) {
        // If old consigner exists, reverse the old entry
        if (oldConsignerId && oldFreight > 0) {
          const oldBalanceResult = await query(
            'SELECT outstanding_balance FROM consigner_balance WHERE consigner_id = $1',
            [oldConsignerId]
          );
          if (oldBalanceResult.rows.length > 0) {
            const newOldBalance = parseFloat(oldBalanceResult.rows[0].outstanding_balance) - oldFreight;
            await query(
              `UPDATE consigner_balance SET outstanding_balance = $1, total_freight = total_freight - $2, total_trips = total_trips - 1, updated_at = CURRENT_TIMESTAMP WHERE consigner_id = $3`,
              [newOldBalance, oldFreight, oldConsignerId]
            );
            await query(
              `INSERT INTO consigner_ledger (consigner_id, trip_id, transaction_type, amount, balance_after, description, created_by)
               VALUES ($1, $2, 'adjustment', $3, $4, $5, $6)`,
              [oldConsignerId, req.params.id, -oldFreight, newOldBalance, `Trip updated/removed: ${oldTrip.trip_number}`, req.user.id]
            );
          }
        }

        // Add new consigner entry if applicable
        if (consigner_id && freightAmountNum > 0) {
          const newBalanceResult = await query(
            'SELECT outstanding_balance FROM consigner_balance WHERE consigner_id = $1',
            [consigner_id]
          );
          let currentBalance = newBalanceResult.rows.length > 0 
            ? parseFloat(newBalanceResult.rows[0].outstanding_balance) 
            : 0;
          const newBalance = currentBalance + freightAmountNum;

          await query(
            `INSERT INTO consigner_ledger (consigner_id, trip_id, transaction_type, amount, balance_after, description, created_by)
             VALUES ($1, $2, 'credit', $3, $4, $5, $6)`,
            [consigner_id, req.params.id, freightAmountNum, newBalance, `Trip: ${trip_number} (${from_location} → ${to_location})`, req.user.id]
          );

          await query(
            `INSERT INTO consigner_balance (consigner_id, outstanding_balance, total_trips, total_freight, last_trip_date)
             VALUES ($1, $2, 1, $3, $4)
             ON CONFLICT (consigner_id) 
             DO UPDATE SET 
               outstanding_balance = $2,
               total_trips = consigner_balance.total_trips + 1,
               total_freight = consigner_balance.total_freight + $3,
               last_trip_date = $4,
               updated_at = CURRENT_TIMESTAMP`,
            [consigner_id, newBalance, freightAmountNum, start_date]
          );
        }
      }

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
