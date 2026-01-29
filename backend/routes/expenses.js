import express from 'express';
import multer from 'multer';
import path from 'path';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Configure file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_PATH || './uploads/bills');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bill-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'));
    }
  }
});

// Get all expenses
router.get('/', async (req, res, next) => {
  try {
    const { truck_id, category, start_date, end_date, payment_mode } = req.query;
    let queryText = `
      SELECT e.*, t.truck_number
      FROM expenses e
      LEFT JOIN trucks t ON e.truck_id = t.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (truck_id) {
      queryText += ` AND e.truck_id = $${paramIndex}`;
      params.push(truck_id);
      paramIndex++;
    }

    if (category) {
      queryText += ` AND e.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (payment_mode) {
      queryText += ` AND e.payment_mode = $${paramIndex}`;
      params.push(payment_mode);
      paramIndex++;
    }

    if (start_date) {
      queryText += ` AND e.expense_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      queryText += ` AND e.expense_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    queryText += ' ORDER BY e.expense_date DESC, e.id DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get expense categories summary
router.get('/summary/categories', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    let queryText = `
      SELECT category, COUNT(*) as count, SUM(amount) as total
      FROM expenses
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      queryText += ` AND expense_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      queryText += ` AND expense_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    queryText += ' GROUP BY category ORDER BY total DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Create expense
router.post('/',
  authorizeRoles('admin', 'manager', 'accountant'),
  upload.single('bill_file'),
  [
    body('expense_date').isDate(),
    body('category').notEmpty().trim(),
    body('description').notEmpty().trim(),
    body('amount').isDecimal(),
    body('payment_mode').isIn(['cash', 'bank'])
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        expense_date, truck_id, trip_id, category, description, amount,
        payment_mode, bank_name, bill_number, vendor_name, is_recurring, notes
      } = req.body;

      const bill_file_path = req.file ? req.file.path : null;

      const result = await query(
        `INSERT INTO expenses (
          expense_date, truck_id, trip_id, category, description, amount,
          payment_mode, bank_name, bill_number, bill_file_path, vendor_name, is_recurring, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          expense_date, truck_id || null, trip_id || null, category, description, amount,
          payment_mode, bank_name, bill_number, bill_file_path, vendor_name, is_recurring || false, notes, req.user.id
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Update expense
router.put('/:id',
  authorizeRoles('admin', 'manager', 'accountant'),
  upload.single('bill_file'),
  async (req, res, next) => {
    try {
      const {
        expense_date, truck_id, trip_id, category, description, amount,
        payment_mode, bank_name, bill_number, vendor_name, is_recurring, notes
      } = req.body;

      const bill_file_path = req.file ? req.file.path : req.body.bill_file_path;

      const result = await query(
        `UPDATE expenses SET
          expense_date = $1, truck_id = $2, trip_id = $3, category = $4, description = $5, amount = $6,
          payment_mode = $7, bank_name = $8, bill_number = $9, bill_file_path = $10,
          vendor_name = $11, is_recurring = $12, notes = $13
        WHERE id = $14
        RETURNING *`,
        [
          expense_date, truck_id || null, trip_id || null, category, description, amount,
          payment_mode, bank_name, bill_number, bill_file_path, vendor_name, is_recurring, notes, req.params.id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Delete expense
router.delete('/:id',
  authorizeRoles('admin'),
  async (req, res, next) => {
    try {
      const result = await query('DELETE FROM expenses WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
