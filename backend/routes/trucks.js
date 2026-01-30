import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all trucks
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    let queryText = `
      SELECT t.*, d.name as assigned_driver_name 
      FROM trucks t
      LEFT JOIN drivers d ON t.assigned_driver_id = d.id
    `;
    const params = [];

    if (status) {
      queryText += ' WHERE t.status = $1';
      params.push(status);
    }

    queryText += ' ORDER BY t.truck_number';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get truck by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT t.*, d.name as assigned_driver_name 
      FROM trucks t
      LEFT JOIN drivers d ON t.assigned_driver_id = d.id
      WHERE t.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Truck not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create truck
router.post('/',
  authorizeRoles('admin', 'manager'),
  [
    body('truck_number').notEmpty().trim(),
    body('truck_type').optional().trim(),
    body('capacity_tons').optional().isDecimal(),
    body('owner_type').isIn(['owned', 'leased', 'attached'])
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        truck_number, truck_type, capacity_tons, model,
        purchase_date, owner_type, status, notes, assigned_driver_id
      } = req.body;

      const result = await query(
        `INSERT INTO trucks (truck_number, truck_type, capacity_tons, model, purchase_date, owner_type, status, notes, assigned_driver_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [truck_number, truck_type, capacity_tons, model, purchase_date, owner_type, status || 'active', notes, assigned_driver_id || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Update truck
router.put('/:id',
  authorizeRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const {
        truck_number, truck_type, capacity_tons, model,
        purchase_date, owner_type, status, notes, assigned_driver_id
      } = req.body;

      const result = await query(
        `UPDATE trucks 
         SET truck_number = $1, truck_type = $2, capacity_tons = $3, model = $4,
             purchase_date = $5, owner_type = $6, status = $7, notes = $8, assigned_driver_id = $9
         WHERE id = $10
         RETURNING *`,
        [truck_number, truck_type, capacity_tons, model, purchase_date, owner_type, status, notes, assigned_driver_id || null, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Truck not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Delete truck
router.delete('/:id',
  authorizeRoles('admin'),
  async (req, res, next) => {
    try {
      const result = await query('DELETE FROM trucks WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Truck not found' });
      }
      res.json({ message: 'Truck deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
