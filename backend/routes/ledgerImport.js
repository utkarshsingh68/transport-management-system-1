import express from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import pool, { query } from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'text/csv',
      'application/csv'
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
    }
  }
});

// Column detection patterns
const COLUMN_PATTERNS = {
  party_name: {
    patterns: ['party', 'consigner', 'consignee', 'customer', 'client', 'name', 'firm', 'company', 'व्यापारी', 'पार्टी'],
    priority: 1
  },
  date: {
    patterns: ['date', 'dated', 'transaction_date', 'txn_date', 'dt', 'तारीख', 'दिनांक'],
    priority: 2
  },
  trip_id: {
    patterns: ['trip', 'trip_id', 'trip_number', 'trip_no', 'lr', 'lr_no', 'bilty', 'gr_no', 'challan'],
    priority: 3
  },
  debit: {
    patterns: ['debit', 'dr', 'paid', 'payment', 'received', 'jama', 'जमा'],
    priority: 4
  },
  credit: {
    patterns: ['credit', 'cr', 'freight', 'bill', 'due', 'baki', 'उधार', 'बाकी'],
    priority: 5
  },
  amount: {
    patterns: ['amount', 'amt', 'value', 'total', 'sum', 'रकम', 'राशि'],
    priority: 6
  },
  description: {
    patterns: ['description', 'desc', 'narration', 'particulars', 'remarks', 'note', 'detail', 'विवरण'],
    priority: 7
  },
  reference: {
    patterns: ['reference', 'ref', 'ref_no', 'voucher', 'receipt', 'cheque', 'utr'],
    priority: 8
  }
};

// Detect column type from header text
function detectColumnType(header) {
  if (!header) return null;
  const normalized = header.toString().toLowerCase().trim().replace(/[_\-\s]+/g, '');
  
  for (const [type, config] of Object.entries(COLUMN_PATTERNS)) {
    for (const pattern of config.patterns) {
      const normalizedPattern = pattern.toLowerCase().replace(/[_\-\s]+/g, '');
      if (normalized.includes(normalizedPattern) || normalizedPattern.includes(normalized)) {
        return { type, confidence: 'high' };
      }
    }
  }
  
  // Pattern-based detection for numbers (amount columns)
  if (normalized.match(/^(rs|₹|inr|rupee)/)) {
    return { type: 'amount', confidence: 'medium' };
  }
  
  return null;
}

// Parse date from various formats
function parseDate(value) {
  if (!value) return null;
  
  // If it's already a Date object (Excel dates)
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  
  const str = value.toString().trim();
  
  // Common date formats
  const formats = [
    // DD/MM/YYYY, DD-MM-YYYY
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
    // DD/MM/YY
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/
  ];
  
  for (const format of formats) {
    const match = str.match(format);
    if (match) {
      let year, month, day;
      if (match[1].length === 4) {
        // YYYY-MM-DD
        [, year, month, day] = match;
      } else if (match[3].length === 4) {
        // DD/MM/YYYY
        [, day, month, year] = match;
      } else {
        // DD/MM/YY
        [, day, month, year] = match;
        year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      }
      
      const date = new Date(year, parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  // Try native Date parsing
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  return null;
}

// Parse numeric value
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  
  // If already a number
  if (typeof value === 'number') return value;
  
  // Clean string
  let str = value.toString().trim();
  
  // Remove currency symbols and separators
  str = str.replace(/[₹$,\s]/g, '');
  
  // Handle negative in parentheses
  if (str.match(/^\(.*\)$/)) {
    str = '-' + str.replace(/[()]/g, '');
  }
  
  // Handle Dr/Cr suffixes
  const isDr = str.match(/dr\.?$/i);
  const isCr = str.match(/cr\.?$/i);
  str = str.replace(/[a-zA-Z.]+$/g, '').trim();
  
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// Normalize party name for matching
function normalizePartyName(name) {
  if (!name) return '';
  return name.toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

// Upload and analyze Excel file
router.post('/analyze', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = new ExcelJS.Workbook();
    
    if (req.file.originalname.match(/\.csv$/i)) {
      await workbook.csv.load(req.file.buffer);
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount === 0) {
      return res.status(400).json({ error: 'File is empty or has no data' });
    }

    // Get headers from first row
    const headerRow = worksheet.getRow(1);
    const headers = [];
    const columnMapping = {};
    
    headerRow.eachCell((cell, colNumber) => {
      const headerText = cell.value?.toString() || `Column ${colNumber}`;
      const detection = detectColumnType(headerText);
      headers.push({
        column: colNumber,
        header: headerText,
        detectedType: detection?.type || null,
        confidence: detection?.confidence || 'none'
      });
      
      if (detection) {
        // Only assign if not already assigned or higher priority
        const existing = Object.entries(columnMapping).find(([k, v]) => v === colNumber);
        if (!existing) {
          columnMapping[detection.type] = colNumber;
        }
      }
    });

    // Parse data rows (preview first 100)
    const dataRows = [];
    const sampleSize = Math.min(worksheet.rowCount, 101);
    
    for (let i = 2; i <= sampleSize; i++) {
      const row = worksheet.getRow(i);
      const rowData = {};
      let hasData = false;
      
      row.eachCell((cell, colNumber) => {
        rowData[colNumber] = cell.value;
        if (cell.value !== null && cell.value !== '') {
          hasData = true;
        }
      });
      
      if (hasData) {
        dataRows.push({ rowNumber: i, data: rowData });
      }
    }

    // Get existing parties for matching
    const partiesResult = await query(`
      SELECT id, name, phone, type 
      FROM parties 
      WHERE type IN ('consigner', 'both')
    `);
    const existingParties = partiesResult.rows;

    // Analyze party names in data
    const partyNames = new Set();
    const partyNameCol = columnMapping.party_name;
    
    if (partyNameCol) {
      dataRows.forEach(row => {
        const name = row.data[partyNameCol];
        if (name) partyNames.add(normalizePartyName(name));
      });
    }

    // Match parties
    const partyMatches = {};
    partyNames.forEach(normalizedName => {
      const match = existingParties.find(p => 
        normalizePartyName(p.name) === normalizedName
      );
      if (match) {
        partyMatches[normalizedName] = { id: match.id, name: match.name, matched: true };
      } else {
        partyMatches[normalizedName] = { name: normalizedName, matched: false };
      }
    });

    res.json({
      fileName: req.file.originalname,
      totalRows: worksheet.rowCount - 1,
      previewRows: dataRows.length,
      headers,
      columnMapping,
      dataRows: dataRows.slice(0, 20), // First 20 for preview
      existingParties: existingParties.map(p => ({ id: p.id, name: p.name })),
      partyMatches,
      newPartiesCount: Object.values(partyMatches).filter(p => !p.matched).length
    });

  } catch (error) {
    console.error('Error analyzing file:', error);
    next(error);
  }
});

// Import ledger entries
router.post('/import', upload.single('file'), authorizeRoles('admin'), async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { columnMapping, createNewParties, dateFormat } = req.body;
    const mapping = typeof columnMapping === 'string' ? JSON.parse(columnMapping) : columnMapping;

    if (!mapping.party_name) {
      return res.status(400).json({ error: 'Party name column is required' });
    }

    if (!mapping.debit && !mapping.credit && !mapping.amount) {
      return res.status(400).json({ error: 'At least one amount column (Debit, Credit, or Amount) is required' });
    }

    const workbook = new ExcelJS.Workbook();
    
    if (req.file.originalname.match(/\.csv$/i)) {
      await workbook.csv.load(req.file.buffer);
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }

    const worksheet = workbook.worksheets[0];
    
    await client.query('BEGIN');

    // Get existing parties
    const partiesResult = await client.query(`
      SELECT id, name FROM parties WHERE type IN ('consigner', 'both')
    `);
    const partyMap = {};
    partiesResult.rows.forEach(p => {
      partyMap[normalizePartyName(p.name)] = p.id;
    });

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      newParties: 0,
      errors: []
    };

    // Process each row
    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      
      try {
        // Get party name
        const partyNameRaw = row.getCell(parseInt(mapping.party_name)).value;
        if (!partyNameRaw) {
          results.skipped++;
          continue;
        }
        
        const partyNameNormalized = normalizePartyName(partyNameRaw);
        let partyId = partyMap[partyNameNormalized];

        // Create new party if needed
        if (!partyId) {
          if (createNewParties === 'true' || createNewParties === true) {
            const newPartyResult = await client.query(
              `INSERT INTO parties (name, type, created_at) VALUES ($1, 'consigner', NOW()) RETURNING id`,
              [partyNameRaw.toString().trim()]
            );
            partyId = newPartyResult.rows[0].id;
            partyMap[partyNameNormalized] = partyId;
            results.newParties++;

            // Initialize consigner balance
            await client.query(
              `INSERT INTO consigner_balance (consigner_id, outstanding_balance, total_trips, total_freight, total_paid)
               VALUES ($1, 0, 0, 0, 0)
               ON CONFLICT (consigner_id) DO NOTHING`,
              [partyId]
            );
          } else {
            results.errors.push({ row: i, error: `Party not found: ${partyNameRaw}` });
            results.failed++;
            continue;
          }
        }

        // Get date
        const dateRaw = mapping.date ? row.getCell(parseInt(mapping.date)).value : null;
        const transactionDate = parseDate(dateRaw) || new Date().toISOString().split('T')[0];

        // Get amounts
        let debitAmount = 0;
        let creditAmount = 0;
        
        if (mapping.debit) {
          debitAmount = parseNumber(row.getCell(parseInt(mapping.debit)).value) || 0;
        }
        if (mapping.credit) {
          creditAmount = parseNumber(row.getCell(parseInt(mapping.credit)).value) || 0;
        }
        if (mapping.amount && !mapping.debit && !mapping.credit) {
          // Single amount column - need to determine type
          const amount = parseNumber(row.getCell(parseInt(mapping.amount)).value) || 0;
          if (amount > 0) creditAmount = amount;
          else debitAmount = Math.abs(amount);
        }

        // Skip if no amount
        if (debitAmount === 0 && creditAmount === 0) {
          results.skipped++;
          continue;
        }

        // Get description
        const descriptionRaw = mapping.description ? row.getCell(parseInt(mapping.description)).value : '';
        const description = descriptionRaw?.toString() || 'Imported entry';

        // Get reference
        const referenceRaw = mapping.reference ? row.getCell(parseInt(mapping.reference)).value : '';
        const reference = referenceRaw?.toString() || '';

        // Determine transaction type and amount
        let transactionType, amount;
        if (creditAmount > 0) {
          transactionType = 'credit';
          amount = creditAmount;
        } else {
          transactionType = 'debit';
          amount = debitAmount;
        }

        // Get current balance
        const balanceResult = await client.query(
          'SELECT outstanding_balance FROM consigner_balance WHERE consigner_id = $1',
          [partyId]
        );
        
        let currentBalance = balanceResult.rows.length > 0 
          ? parseFloat(balanceResult.rows[0].outstanding_balance) 
          : 0;

        // Calculate new balance
        let newBalance;
        if (transactionType === 'credit') {
          newBalance = currentBalance + amount; // Add to outstanding
        } else {
          newBalance = currentBalance - amount; // Payment received
        }

        // Insert ledger entry
        await client.query(
          `INSERT INTO consigner_ledger (consigner_id, transaction_type, amount, balance_after, description, transaction_date, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [partyId, transactionType, amount, newBalance, description + (reference ? ` (Ref: ${reference})` : ''), transactionDate, req.user.id]
        );

        // Update balance
        if (balanceResult.rows.length > 0) {
          await client.query(
            `UPDATE consigner_balance SET outstanding_balance = $1, updated_at = NOW() WHERE consigner_id = $2`,
            [newBalance, partyId]
          );
        } else {
          await client.query(
            `INSERT INTO consigner_balance (consigner_id, outstanding_balance, total_trips, total_freight, total_paid)
             VALUES ($1, $2, 0, 0, 0)`,
            [partyId, newBalance]
          );
        }

        results.success++;

      } catch (rowError) {
        results.errors.push({ row: i, error: rowError.message });
        results.failed++;
      }
    }

    await client.query('COMMIT');

    res.json({
      message: 'Import completed',
      results
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import error:', error);
    next(error);
  } finally {
    client.release();
  }
});

// Download sample template
router.get('/template', (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Party Ledger');
  
  // Add headers
  worksheet.columns = [
    { header: 'Party Name', key: 'party_name', width: 30 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Debit (Payment)', key: 'debit', width: 18 },
    { header: 'Credit (Due)', key: 'credit', width: 18 },
    { header: 'Reference', key: 'reference', width: 20 }
  ];
  
  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  // Add sample data
  worksheet.addRow({
    party_name: 'ABC Traders',
    date: '15/01/2026',
    description: 'Freight for Trip LR-001',
    debit: '',
    credit: 25000,
    reference: 'BILL-001'
  });
  
  worksheet.addRow({
    party_name: 'ABC Traders',
    date: '20/01/2026',
    description: 'Payment received',
    debit: 15000,
    credit: '',
    reference: 'CHQ-123'
  });
  
  worksheet.addRow({
    party_name: 'XYZ Transport',
    date: '18/01/2026',
    description: 'Freight charges',
    debit: '',
    credit: 45000,
    reference: ''
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=party_ledger_template.xlsx');
  
  workbook.xlsx.write(res);
});

export default router;
