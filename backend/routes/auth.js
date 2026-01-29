import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

// Login
router.post('/login',
  [
    body('username').notEmpty().trim(),
    body('password').notEmpty()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;

      const result = await query(
        'SELECT * FROM users WHERE username = $1 AND is_active = true',
        [username]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken(user);

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Register (admin only - for creating new users)
router.post('/register',
  [
    body('username').isLength({ min: 3 }).trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('full_name').notEmpty().trim(),
    body('role').isIn(['admin', 'manager', 'accountant', 'viewer'])
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password, full_name, role } = req.body;

      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await query(
        `INSERT INTO users (username, email, password_hash, full_name, role) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, username, email, full_name, role`,
        [username, email, hashedPassword, full_name, role]
      );

      res.status(201).json({
        message: 'User created successfully',
        user: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
