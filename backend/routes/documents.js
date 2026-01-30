import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import authMiddleware from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/documents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname || mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDF/DOC files are allowed'));
    }
  }
});

// Get all documents with optional filters
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { entity_type, entity_id, document_type, status } = req.query;
    let query = `
      SELECT d.*, 
        CASE 
          WHEN d.entity_type = 'truck' THEN t.truck_number
          WHEN d.entity_type = 'driver' THEN dr.name
        END as entity_name,
        CASE 
          WHEN d.expiry_date IS NULL THEN 'active'
          WHEN d.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN d.expiry_date <= CURRENT_DATE + d.reminder_days THEN 'expiring_soon'
          ELSE 'active'
        END as computed_status
      FROM documents d
      LEFT JOIN trucks t ON d.entity_type = 'truck' AND d.entity_id = t.id
      LEFT JOIN drivers dr ON d.entity_type = 'driver' AND d.entity_id = dr.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (entity_type) {
      params.push(entity_type);
      query += ` AND d.entity_type = $${++paramCount}`;
    }
    if (entity_id) {
      params.push(entity_id);
      query += ` AND d.entity_id = $${++paramCount}`;
    }
    if (document_type) {
      params.push(document_type);
      query += ` AND d.document_type = $${++paramCount}`;
    }
    if (status === 'expired') {
      query += ` AND d.expiry_date < CURRENT_DATE`;
    } else if (status === 'expiring_soon') {
      query += ` AND d.expiry_date >= CURRENT_DATE AND d.expiry_date <= CURRENT_DATE + d.reminder_days`;
    }

    query += ' ORDER BY d.expiry_date ASC NULLS LAST';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get documents expiring soon (for notifications)
router.get('/expiring', authMiddleware, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await pool.query(`
      SELECT d.*, 
        CASE 
          WHEN d.entity_type = 'truck' THEN t.truck_number
          WHEN d.entity_type = 'driver' THEN dr.name
        END as entity_name,
        d.expiry_date - CURRENT_DATE as days_until_expiry
      FROM documents d
      LEFT JOIN trucks t ON d.entity_type = 'truck' AND d.entity_id = t.id
      LEFT JOIN drivers dr ON d.entity_type = 'driver' AND d.entity_id = dr.id
      WHERE d.expiry_date IS NOT NULL 
        AND d.expiry_date >= CURRENT_DATE 
        AND d.expiry_date <= CURRENT_DATE + $1
      ORDER BY d.expiry_date ASC
    `, [parseInt(days)]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expiring documents:', error);
    res.status(500).json({ error: 'Failed to fetch expiring documents' });
  }
});

// Get expired documents
router.get('/expired', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, 
        CASE 
          WHEN d.entity_type = 'truck' THEN t.truck_number
          WHEN d.entity_type = 'driver' THEN dr.name
        END as entity_name,
        CURRENT_DATE - d.expiry_date as days_expired
      FROM documents d
      LEFT JOIN trucks t ON d.entity_type = 'truck' AND d.entity_id = t.id
      LEFT JOIN drivers dr ON d.entity_type = 'driver' AND d.entity_id = dr.id
      WHERE d.expiry_date IS NOT NULL AND d.expiry_date < CURRENT_DATE
      ORDER BY d.expiry_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expired documents:', error);
    res.status(500).json({ error: 'Failed to fetch expired documents' });
  }
});

// Get document summary/stats
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE expiry_date IS NULL OR expiry_date > CURRENT_DATE + reminder_days) as active_count,
        COUNT(*) FILTER (WHERE expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + reminder_days) as expiring_soon_count,
        COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) as expired_count,
        COUNT(*) as total_count
      FROM documents
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching document summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Upload new document
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const {
      document_type,
      entity_type,
      entity_id,
      document_number,
      issue_date,
      expiry_date,
      reminder_days,
      notes
    } = req.body;

    const file = req.file;
    const filePath = file ? `/uploads/documents/${file.filename}` : null;
    const fileName = file ? file.originalname : null;
    const fileType = file ? file.mimetype : null;
    const fileSize = file ? file.size : null;

    const result = await pool.query(`
      INSERT INTO documents (
        document_type, entity_type, entity_id, document_number,
        issue_date, expiry_date, file_path, file_name, file_type, file_size,
        reminder_days, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      document_type, entity_type, entity_id, document_number,
      issue_date || null, expiry_date || null, filePath, fileName, fileType, fileSize,
      reminder_days || 30, notes, req.user.id
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Update document
router.put('/:id', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      document_type,
      document_number,
      issue_date,
      expiry_date,
      reminder_days,
      notes
    } = req.body;

    let updateQuery = `
      UPDATE documents SET
        document_type = COALESCE($1, document_type),
        document_number = COALESCE($2, document_number),
        issue_date = $3,
        expiry_date = $4,
        reminder_days = COALESCE($5, reminder_days),
        notes = $6
    `;
    const params = [document_type, document_number, issue_date || null, expiry_date || null, reminder_days, notes];

    if (req.file) {
      updateQuery += `, file_path = $7, file_name = $8, file_type = $9, file_size = $10`;
      params.push(
        `/uploads/documents/${req.file.filename}`,
        req.file.originalname,
        req.file.mimetype,
        req.file.size
      );
    }

    updateQuery += ` WHERE id = $${params.length + 1} RETURNING *`;
    params.push(id);

    const result = await pool.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete document
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Get file path before deleting
    const doc = await pool.query('SELECT file_path FROM documents WHERE id = $1', [id]);
    if (doc.rows.length > 0 && doc.rows[0].file_path) {
      const filePath = path.join(__dirname, '..', doc.rows[0].file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query('DELETE FROM documents WHERE id = $1', [id]);
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Serve document file
router.get('/file/:filename', authMiddleware, (req, res) => {
  const filePath = path.join(__dirname, '../uploads/documents', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

export default router;
