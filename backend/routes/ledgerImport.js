import express from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import pool, { query } from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { detectColumnsWithAI, classifyTransactionWithAI, matchPartyWithAI } from '../services/groqAI.js';

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

// ============================================================================
// AI-POWERED SMART COLUMN DETECTION PATTERNS
// ============================================================================

const COLUMN_PATTERNS = {
  party_name: {
    // Header patterns (Hindi + English)
    patterns: [
      'party', 'consigner', 'consignee', 'customer', 'client', 'name', 'firm', 'company', 
      'transporter', 'vendor', 'supplier', 'buyer', 'seller', 'merchant', 'trader',
      'account', 'partyname', 'party name', 'customer name', 'account name',
      // Hindi patterns
      'पार्टी', 'व्यापारी', 'ग्राहक', 'कंपनी', 'फर्म', 'नाम', 'खाताधारक'
    ],
    // Negative patterns (avoid matching these)
    negativePatterns: ['date', 'amount', 'balance', 'debit', 'credit'],
    priority: 1,
    dataValidator: (values) => {
      // Party names are typically strings with 2+ characters, not pure numbers
      const validCount = values.filter(v => {
        if (!v) return false;
        const str = v.toString().trim();
        return str.length >= 2 && !/^\d+$/.test(str) && !/^\d+\.\d+$/.test(str);
      }).length;
      return validCount / values.length > 0.5;
    }
  },
  date: {
    patterns: [
      'date', 'dated', 'transaction_date', 'txn_date', 'dt', 'entry_date', 'bill_date',
      'payment_date', 'invoice_date', 'posting_date', 'value_date', 'doc_date',
      // Hindi patterns
      'तारीख', 'दिनांक', 'तिथि'
    ],
    priority: 2,
    dataValidator: (values) => {
      // Check if values look like dates
      const datePatterns = [
        /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/,
        /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/,
        /^\d{1,2}\s+[a-zA-Z]{3,}\s+\d{2,4}$/i
      ];
      const validCount = values.filter(v => {
        if (!v) return false;
        if (v instanceof Date) return true;
        const str = v.toString().trim();
        return datePatterns.some(p => p.test(str));
      }).length;
      return validCount / values.length > 0.3;
    }
  },
  trip_id: {
    patterns: [
      'trip', 'trip_id', 'trip_number', 'trip_no', 'tripno', 'lr', 'lr_no', 'lrno',
      'bilty', 'bilti', 'gr_no', 'grno', 'challan', 'challan_no', 'memo', 'memo_no',
      'builty', 'pod', 'pod_no', 'invoice_no', 'bill_no', 'ref_no',
      // Hindi patterns  
      'बिल्टी', 'चालान', 'एलआर', 'ट्रिप'
    ],
    priority: 3,
    dataValidator: (values) => {
      // Trip IDs often have alphanumeric patterns
      const validCount = values.filter(v => {
        if (!v) return false;
        const str = v.toString().trim();
        return str.length >= 2 && str.length <= 30;
      }).length;
      return validCount / values.length > 0.3;
    }
  },
  debit: {
    patterns: [
      'debit', 'dr', 'paid', 'payment', 'received', 'receipt', 'received_amount',
      'payment_received', 'cash_received', 'inward', 'collection', 'recovery',
      // Hindi patterns (Jama = received)
      'जमा', 'प्राप्त', 'आमद', 'वसूली'
    ],
    negativePatterns: ['credit', 'cr', 'due'],
    priority: 4,
    dataValidator: (values) => {
      // Should be mostly numeric
      const numericCount = values.filter(v => {
        if (!v) return true; // Empty is OK
        const num = parseFloat(v.toString().replace(/[₹$,\s]/g, ''));
        return !isNaN(num);
      }).length;
      return numericCount / values.length > 0.7;
    }
  },
  credit: {
    patterns: [
      'credit', 'cr', 'freight', 'bill', 'due', 'invoice', 'bill_amount', 'freight_amount',
      'invoice_amount', 'outstanding', 'outward', 'sales', 'billed',
      // Hindi patterns (Baki = due/credit)
      'उधार', 'बाकी', 'भाड़ा', 'बिल', 'देय'
    ],
    negativePatterns: ['debit', 'dr', 'paid'],
    priority: 5,
    dataValidator: (values) => {
      // Should be mostly numeric
      const numericCount = values.filter(v => {
        if (!v) return true;
        const num = parseFloat(v.toString().replace(/[₹$,\s]/g, ''));
        return !isNaN(num);
      }).length;
      return numericCount / values.length > 0.7;
    }
  },
  amount: {
    patterns: [
      'amount', 'amt', 'value', 'total', 'sum', 'balance', 'net', 'gross',
      // Hindi patterns
      'रकम', 'राशि', 'धनराशि', 'कुल'
    ],
    priority: 6,
    dataValidator: (values) => {
      const numericCount = values.filter(v => {
        if (!v) return true;
        const num = parseFloat(v.toString().replace(/[₹$,\s]/g, ''));
        return !isNaN(num);
      }).length;
      return numericCount / values.length > 0.7;
    }
  },
  description: {
    patterns: [
      'description', 'desc', 'narration', 'particulars', 'remarks', 'note', 'detail',
      'comment', 'memo', 'explanation', 'notes', 'remark',
      // Hindi patterns
      'विवरण', 'टिप्पणी', 'नोट'
    ],
    priority: 7,
    dataValidator: (values) => {
      // Should be mostly text strings
      const textCount = values.filter(v => {
        if (!v) return true;
        const str = v.toString().trim();
        return str.length > 0 && isNaN(parseFloat(str));
      }).length;
      return textCount / values.length > 0.3;
    }
  },
  reference: {
    patterns: [
      'reference', 'ref', 'ref_no', 'refno', 'voucher', 'voucher_no', 'receipt',
      'receipt_no', 'cheque', 'cheque_no', 'chq', 'utr', 'utr_no', 'transaction_id',
      'txn_id', 'neft', 'rtgs', 'imps',
      // Hindi patterns
      'संदर्भ', 'चेक', 'रसीद'
    ],
    priority: 8,
    dataValidator: (values) => {
      return true; // Reference can be any format
    }
  },
  type: {
    // Transaction type column (debit/credit indicator)
    patterns: [
      'type', 'transaction_type', 'txn_type', 'entry_type', 'dr_cr', 'drcr',
      'debit_credit', 'mode', 'transaction_mode',
      // Hindi patterns
      'प्रकार', 'लेनदेन'
    ],
    priority: 9,
    dataValidator: (values) => {
      // Should contain debit/credit type indicators
      const typePatterns = /^(dr|cr|debit|credit|payment|receipt|paid|received|jama|baki|d|c)$/i;
      const validCount = values.filter(v => {
        if (!v) return false;
        return typePatterns.test(v.toString().trim());
      }).length;
      return validCount / values.length > 0.3;
    }
  }
};

// AI Pattern Keywords for transaction classification
const TRANSACTION_KEYWORDS = {
  credit: {
    // Keywords indicating freight/bill/due (money owed to us)
    keywords: [
      'freight', 'bhada', 'bill', 'invoice', 'due', 'baki', 'outstanding',
      'sales', 'income', 'revenue', 'charges', 'fare', 'shipping',
      'transport', 'delivery', 'service', 'load', 'trip', 'lr',
      // Hindi
      'भाड़ा', 'बाकी', 'बिल', 'उधार', 'देय'
    ],
    patterns: [/trip/i, /lr[\s\-]?\d+/i, /freight/i, /bill/i]
  },
  debit: {
    // Keywords indicating payment received
    keywords: [
      'paid', 'payment', 'received', 'receipt', 'cash', 'bank', 'cheque',
      'check', 'neft', 'rtgs', 'imps', 'upi', 'transfer', 'collection',
      'recovery', 'adjusted', 'settled', 'cleared',
      // Hindi
      'जमा', 'प्राप्त', 'भुगतान', 'वसूली'
    ],
    patterns: [/paid/i, /received/i, /payment/i, /cash/i, /bank/i, /chequ?e/i, /utr/i]
  }
};

// ============================================================================
// AI-POWERED COLUMN DETECTION FUNCTIONS
// ============================================================================

// Normalize text for matching
function normalizeText(text) {
  if (!text) return '';
  return text.toString()
    .toLowerCase()
    .trim()
    .replace(/[_\-\s\.]+/g, '')
    .replace(/[^\w\u0900-\u097F]/g, ''); // Keep alphanumeric + Hindi chars
}

// Calculate string similarity (Levenshtein-based)
function calculateSimilarity(str1, str2) {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Levenshtein distance
  const matrix = Array(s1.length + 1).fill(null).map(() => Array(s2.length + 1).fill(null));
  
  for (let i = 0; i <= s1.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - (matrix[s1.length][s2.length] / maxLen);
}

// AI-powered column type detection from header
function detectColumnTypeFromHeader(header) {
  if (!header) return null;
  const normalized = normalizeText(header);
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const [type, config] of Object.entries(COLUMN_PATTERNS)) {
    // Check negative patterns first
    if (config.negativePatterns) {
      const hasNegative = config.negativePatterns.some(neg => 
        normalized.includes(normalizeText(neg))
      );
      if (hasNegative) continue;
    }
    
    for (const pattern of config.patterns) {
      const normalizedPattern = normalizeText(pattern);
      
      // Exact match
      if (normalized === normalizedPattern) {
        return { type, confidence: 'high', score: 1, matchedPattern: pattern };
      }
      
      // Contains match
      if (normalized.includes(normalizedPattern) || normalizedPattern.includes(normalized)) {
        const score = 0.9;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { type, confidence: 'high', score, matchedPattern: pattern };
        }
      }
      
      // Similarity match
      const similarity = calculateSimilarity(header, pattern);
      if (similarity > 0.6 && similarity > bestScore) {
        bestScore = similarity;
        bestMatch = { 
          type, 
          confidence: similarity > 0.8 ? 'high' : 'medium', 
          score: similarity,
          matchedPattern: pattern 
        };
      }
    }
  }
  
  return bestMatch;
}

// AI-powered column type detection from data samples
function detectColumnTypeFromData(values) {
  const results = {};
  
  for (const [type, config] of Object.entries(COLUMN_PATTERNS)) {
    if (config.dataValidator) {
      const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '');
      if (nonEmptyValues.length > 0) {
        const isValid = config.dataValidator(nonEmptyValues);
        results[type] = isValid;
      }
    }
  }
  
  return results;
}

// Smart column mapping with AI
function smartColumnMapping(headers, dataSamples) {
  const mapping = {};
  const headerDetections = [];
  
  // First pass: detect from headers
  headers.forEach((h, idx) => {
    const detection = detectColumnTypeFromHeader(h.header);
    headerDetections.push({
      ...h,
      headerDetection: detection
    });
  });
  
  // Second pass: validate with data
  headerDetections.forEach((h, idx) => {
    const colValues = dataSamples.map(row => row[h.column]).filter(v => v !== undefined);
    const dataValidation = detectColumnTypeFromData(colValues);
    
    let finalType = h.headerDetection?.type;
    let confidence = h.headerDetection?.confidence || 'none';
    
    // If header detection found a type, validate with data
    if (finalType && dataValidation[finalType] === false) {
      // Header says one thing, data says another - lower confidence
      confidence = 'low';
    } else if (finalType && dataValidation[finalType] === true) {
      // Both agree - high confidence
      confidence = 'high';
    }
    
    // If no header match, try to infer from data alone
    if (!finalType) {
      // Try to infer type from data patterns
      const colValues = dataSamples.map(row => row[h.column]).filter(v => v !== undefined);
      
      // Check for date pattern
      if (COLUMN_PATTERNS.date.dataValidator(colValues)) {
        finalType = 'date';
        confidence = 'medium';
      }
      // Check for numeric pattern
      else if (COLUMN_PATTERNS.amount.dataValidator(colValues)) {
        const numericValues = colValues.filter(v => {
          const num = parseFloat(v?.toString().replace(/[₹$,\s]/g, ''));
          return !isNaN(num) && num > 0;
        });
        if (numericValues.length > colValues.length * 0.5) {
          // Could be amount, debit, or credit
          finalType = 'amount';
          confidence = 'low';
        }
      }
      // Check for party name pattern
      else if (COLUMN_PATTERNS.party_name.dataValidator(colValues)) {
        finalType = 'party_name';
        confidence = 'medium';
      }
    }
    
    h.finalType = finalType;
    h.confidence = confidence;
    
    // Assign to mapping if best match for this type
    if (finalType && !mapping[finalType]) {
      mapping[finalType] = h.column;
    }
  });
  
  return { mapping, headerDetections };
}

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

// Parse date from various formats
function parseDate(value) {
  if (!value) return null;
  
  // If it's already a Date object (Excel dates)
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) {
      return value.toISOString().split('T')[0];
    }
    return null;
  }
  
  // If it's a number (Excel serial date)
  if (typeof value === 'number') {
    // Excel serial date starts from 1900-01-01 (with leap year bug)
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  const str = value.toString().trim();
  if (!str) return null;
  
  // Common date formats
  const formats = [
    // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    { regex: /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/, parse: (m) => [m[3], m[2], m[1]] },
    // YYYY-MM-DD, YYYY/MM/DD
    { regex: /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/, parse: (m) => [m[1], m[2], m[3]] },
    // DD/MM/YY, DD-MM-YY
    { regex: /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/, parse: (m) => {
      const year = parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`;
      return [year, m[2], m[1]];
    }},
    // DD MMM YYYY, DD-MMM-YYYY (e.g., 15 Jan 2026)
    { regex: /^(\d{1,2})[\s\-]([a-zA-Z]{3,})[\s\-](\d{2,4})$/i, parse: (m) => {
      const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
      const monthNum = months[m[2].toLowerCase().substring(0, 3)];
      const year = m[3].length === 2 ? (parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`) : m[3];
      return monthNum ? [year, monthNum, m[1]] : null;
    }},
    // MMM DD, YYYY (e.g., Jan 15, 2026)
    { regex: /^([a-zA-Z]{3,})[\s](\d{1,2}),?[\s](\d{4})$/i, parse: (m) => {
      const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
      const monthNum = months[m[1].toLowerCase().substring(0, 3)];
      return monthNum ? [m[3], monthNum, m[2]] : null;
    }}
  ];
  
  for (const format of formats) {
    const match = str.match(format.regex);
    if (match) {
      const parts = format.parse(match);
      if (parts) {
        const [year, month, day] = parts.map(p => parseInt(p));
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime()) && date.getFullYear() > 1990 && date.getFullYear() < 2100) {
          return date.toISOString().split('T')[0];
        }
      }
    }
  }
  
  // Try native Date parsing as last resort
  const date = new Date(str);
  if (!isNaN(date.getTime()) && date.getFullYear() > 1990 && date.getFullYear() < 2100) {
    return date.toISOString().split('T')[0];
  }
  
  return null;
}

// Parse numeric value with intelligence
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  
  // If already a number
  if (typeof value === 'number') return Math.abs(value);
  
  // Clean string
  let str = value.toString().trim();
  
  // Remove currency symbols, commas, spaces
  str = str.replace(/[₹$€£,\s]/g, '');
  
  // Handle Indian lakhs/crores notation (1,00,000)
  str = str.replace(/(\d),(\d{2},)/g, '$1$2');
  
  // Handle negative in parentheses: (500) = -500
  const isNegative = str.match(/^\(.*\)$/) || str.match(/^-/);
  str = str.replace(/[()]/g, '').replace(/^-/, '');
  
  // Handle Dr/Cr suffixes
  str = str.replace(/[a-zA-Z.]+$/g, '').trim();
  
  const num = parseFloat(str);
  return isNaN(num) ? null : Math.abs(num);
}

// Normalize party name for matching
function normalizePartyName(name) {
  if (!name) return '';
  return name.toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\u0900-\u097F]/g, '') // Keep alphanumeric + Hindi
    .replace(/\b(pvt|private|ltd|limited|llp|inc|co|company)\b\.?/gi, '')
    .trim();
}

// Fuzzy match party name
function fuzzyMatchParty(inputName, existingParties) {
  const normalizedInput = normalizePartyName(inputName);
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const party of existingParties) {
    const normalizedParty = normalizePartyName(party.name);
    
    // Exact match
    if (normalizedInput === normalizedParty) {
      return { party, confidence: 'exact', score: 1 };
    }
    
    // Calculate similarity
    const similarity = calculateSimilarity(inputName, party.name);
    
    if (similarity > bestScore && similarity > 0.7) {
      bestScore = similarity;
      bestMatch = { 
        party, 
        confidence: similarity > 0.9 ? 'high' : similarity > 0.8 ? 'medium' : 'low',
        score: similarity 
      };
    }
  }
  
  return bestMatch;
}

// AI classify transaction type from description
function classifyTransactionType(description, existingType = null) {
  if (existingType) {
    const normalized = existingType.toString().toLowerCase().trim();
    if (['dr', 'd', 'debit', 'paid', 'payment', 'received', 'receipt', 'jama'].includes(normalized)) {
      return 'debit'; // Payment received
    }
    if (['cr', 'c', 'credit', 'freight', 'bill', 'due', 'baki', 'invoice'].includes(normalized)) {
      return 'credit'; // Amount due
    }
  }
  
  if (!description) return null;
  
  const desc = description.toString().toLowerCase();
  
  // Check debit keywords (payment received)
  for (const keyword of TRANSACTION_KEYWORDS.debit.keywords) {
    if (desc.includes(keyword.toLowerCase())) {
      return 'debit';
    }
  }
  for (const pattern of TRANSACTION_KEYWORDS.debit.patterns) {
    if (pattern.test(desc)) {
      return 'debit';
    }
  }
  
  // Check credit keywords (freight due)
  for (const keyword of TRANSACTION_KEYWORDS.credit.keywords) {
    if (desc.includes(keyword.toLowerCase())) {
      return 'credit';
    }
  }
  for (const pattern of TRANSACTION_KEYWORDS.credit.patterns) {
    if (pattern.test(desc)) {
      return 'credit';
    }
  }
  
  return null;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Upload and analyze Excel file with AI-powered detection
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

    // Find the header row (first non-empty row)
    let headerRowNum = 1;
    for (let i = 1; i <= Math.min(10, worksheet.rowCount); i++) {
      const row = worksheet.getRow(i);
      let cellCount = 0;
      row.eachCell(() => cellCount++);
      if (cellCount >= 2) {
        headerRowNum = i;
        break;
      }
    }

    // Get headers
    const headerRow = worksheet.getRow(headerRowNum);
    const headers = [];
    
    headerRow.eachCell((cell, colNumber) => {
      const headerText = cell.value?.toString()?.trim() || `Column ${colNumber}`;
      headers.push({
        column: colNumber,
        header: headerText,
        originalIndex: colNumber
      });
    });

    // Parse all data rows
    const allDataRows = [];
    for (let i = headerRowNum + 1; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const rowData = {};
      let hasData = false;
      
      row.eachCell((cell, colNumber) => {
        let value = cell.value;
        // Handle rich text
        if (value && typeof value === 'object' && value.richText) {
          value = value.richText.map(rt => rt.text).join('');
        }
        rowData[colNumber] = value;
        if (value !== null && value !== undefined && value !== '') {
          hasData = true;
        }
      });
      
      if (hasData) {
        allDataRows.push({ rowNumber: i, data: rowData, originalRow: i });
      }
    }

    // AI-powered column mapping with Groq LLM
    let columnMapping, headerDetections;
    let aiUsed = false;
    
    try {
      // Try Groq AI first for intelligent column detection
      console.log('Attempting AI-powered column detection...');
      const aiResult = await detectColumnsWithAI(headers, allDataRows.slice(0, 50));
      
      if (aiResult && aiResult.mapping && Object.keys(aiResult.mapping).length > 0) {
        columnMapping = aiResult.mapping;
        headerDetections = aiResult.headerDetections;
        aiUsed = true;
        console.log('AI column detection successful');
      } else {
        throw new Error('AI returned empty mapping');
      }
    } catch (aiError) {
      // Fall back to rule-based detection if AI fails
      console.log('AI detection failed, falling back to rule-based:', aiError.message);
      const ruleBasedResult = smartColumnMapping(headers, allDataRows.slice(0, 50));
      columnMapping = ruleBasedResult.mapping;
      headerDetections = ruleBasedResult.headerDetections;
    }

    // Get existing parties for matching
    let existingParties = [];
    try {
      // Try parties table first
      const partiesResult = await query(`
        SELECT id, name, phone, 'consigner' as type 
        FROM parties 
        WHERE type IN ('consigner', 'both')
        UNION
        SELECT id, name, phone, 'transporter' as type
        FROM transporters
        ORDER BY name
      `);
      existingParties = partiesResult.rows;
    } catch (err) {
      // Fallback to just transporters
      try {
        const transResult = await query(`SELECT id, name, phone FROM transporters ORDER BY name`);
        existingParties = transResult.rows;
      } catch (err2) {
        console.log('No parties/transporters table found');
      }
    }

    // Analyze each row with AI
    const partyNameCol = columnMapping.party_name;
    const dateCol = columnMapping.date;
    const debitCol = columnMapping.debit;
    const creditCol = columnMapping.credit;
    const amountCol = columnMapping.amount;
    const descCol = columnMapping.description;
    const typeCol = columnMapping.type;
    const refCol = columnMapping.reference;
    const tripCol = columnMapping.trip_id;

    const analyzedRows = [];
    const partyMatches = {};
    const errors = [];
    let validRowCount = 0;
    let errorRowCount = 0;

    for (const row of allDataRows) {
      const rowAnalysis = {
        rowNumber: row.rowNumber,
        originalData: row.data,
        parsed: {},
        errors: [],
        warnings: [],
        status: 'valid'
      };

      // Parse party name
      const partyNameRaw = partyNameCol ? row.data[partyNameCol] : null;
      if (partyNameRaw) {
        const partyName = partyNameRaw.toString().trim();
        rowAnalysis.parsed.party_name = partyName;
        
        // Fuzzy match party
        const normalizedName = normalizePartyName(partyName);
        if (!partyMatches[normalizedName]) {
          const match = fuzzyMatchParty(partyName, existingParties);
          partyMatches[normalizedName] = match 
            ? { ...match, originalName: partyName }
            : { originalName: partyName, party: null, confidence: 'new', isNew: true };
        }
        rowAnalysis.partyMatch = partyMatches[normalizedName];
      } else {
        rowAnalysis.errors.push('Missing party name');
        rowAnalysis.status = 'error';
      }

      // Parse date
      if (dateCol) {
        const dateValue = row.data[dateCol];
        const parsedDate = parseDate(dateValue);
        if (parsedDate) {
          rowAnalysis.parsed.date = parsedDate;
        } else if (dateValue) {
          rowAnalysis.warnings.push(`Could not parse date: ${dateValue}`);
        }
      }
      if (!rowAnalysis.parsed.date) {
        rowAnalysis.parsed.date = new Date().toISOString().split('T')[0];
        rowAnalysis.warnings.push('Using current date');
      }

      // Parse amounts
      let debitAmount = 0;
      let creditAmount = 0;

      if (debitCol) {
        debitAmount = parseNumber(row.data[debitCol]) || 0;
      }
      if (creditCol) {
        creditAmount = parseNumber(row.data[creditCol]) || 0;
      }

      // If only amount column exists, determine type
      if (amountCol && !debitCol && !creditCol) {
        const amount = parseNumber(row.data[amountCol]) || 0;
        
        // Try to classify from description or type column
        const description = descCol ? row.data[descCol]?.toString() : '';
        const typeValue = typeCol ? row.data[typeCol] : null;
        const classifiedType = classifyTransactionType(description, typeValue);
        
        if (classifiedType === 'debit') {
          debitAmount = amount;
        } else if (classifiedType === 'credit') {
          creditAmount = amount;
        } else {
          // Default: positive = credit (due), negative = debit (paid)
          if (amount >= 0) {
            creditAmount = amount;
          } else {
            debitAmount = Math.abs(amount);
          }
          rowAnalysis.warnings.push('Transaction type inferred from amount sign');
        }
      }

      rowAnalysis.parsed.debit = debitAmount;
      rowAnalysis.parsed.credit = creditAmount;

      if (debitAmount === 0 && creditAmount === 0) {
        rowAnalysis.errors.push('No valid amount found');
        rowAnalysis.status = 'error';
      }

      // Parse description
      if (descCol) {
        rowAnalysis.parsed.description = row.data[descCol]?.toString() || '';
      }

      // Parse reference
      if (refCol) {
        rowAnalysis.parsed.reference = row.data[refCol]?.toString() || '';
      }

      // Parse trip ID
      if (tripCol) {
        rowAnalysis.parsed.trip_id = row.data[tripCol]?.toString() || '';
      }

      // Determine final transaction type
      if (debitAmount > 0 && creditAmount === 0) {
        rowAnalysis.parsed.transaction_type = 'debit'; // Payment received
      } else if (creditAmount > 0 && debitAmount === 0) {
        rowAnalysis.parsed.transaction_type = 'credit'; // Freight due
      } else if (debitAmount > 0 && creditAmount > 0) {
        rowAnalysis.warnings.push('Both debit and credit have values - using net');
        if (creditAmount > debitAmount) {
          rowAnalysis.parsed.transaction_type = 'credit';
          rowAnalysis.parsed.credit = creditAmount - debitAmount;
          rowAnalysis.parsed.debit = 0;
        } else {
          rowAnalysis.parsed.transaction_type = 'debit';
          rowAnalysis.parsed.debit = debitAmount - creditAmount;
          rowAnalysis.parsed.credit = 0;
        }
      }

      // Count valid/error rows
      if (rowAnalysis.status === 'error') {
        errorRowCount++;
      } else {
        validRowCount++;
      }

      analyzedRows.push(rowAnalysis);
    }

    // Prepare party summary
    const partyList = Object.values(partyMatches);
    const newPartiesCount = partyList.filter(p => p.isNew).length;
    const matchedPartiesCount = partyList.filter(p => !p.isNew).length;

    res.json({
      success: true,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      totalRows: allDataRows.length,
      validRows: validRowCount,
      errorRows: errorRowCount,
      headers: headerDetections,
      columnMapping,
      aiPowered: aiUsed,
      previewRows: analyzedRows.slice(0, 50), // First 50 for preview
      allRows: analyzedRows, // All rows for import
      existingParties: existingParties.map(p => ({ id: p.id, name: p.name })),
      partyMatches,
      partyStats: {
        total: partyList.length,
        matched: matchedPartiesCount,
        new: newPartiesCount
      },
      detectionSummary: {
        partyName: columnMapping.party_name ? headers.find(h => h.column === columnMapping.party_name)?.header : null,
        date: columnMapping.date ? headers.find(h => h.column === columnMapping.date)?.header : null,
        debit: columnMapping.debit ? headers.find(h => h.column === columnMapping.debit)?.header : null,
        credit: columnMapping.credit ? headers.find(h => h.column === columnMapping.credit)?.header : null,
        amount: columnMapping.amount ? headers.find(h => h.column === columnMapping.amount)?.header : null,
        description: columnMapping.description ? headers.find(h => h.column === columnMapping.description)?.header : null,
        reference: columnMapping.reference ? headers.find(h => h.column === columnMapping.reference)?.header : null,
        tripId: columnMapping.trip_id ? headers.find(h => h.column === columnMapping.trip_id)?.header : null
      }
    });

  } catch (error) {
    console.error('Error analyzing file:', error);
    next(error);
  }
});

// ============================================================================
// SMART IMPORT ENDPOINT - AI-powered bulk ledger entry creation
// ============================================================================

router.post('/smart-import', upload.single('file'), authorizeRoles('admin', 'accountant'), async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    const { analyzedRows, createNewParties, partyMatches: clientPartyMatches } = req.body;
    
    // Parse JSON if stringified
    const rows = typeof analyzedRows === 'string' ? JSON.parse(analyzedRows) : analyzedRows;
    const partyMappings = typeof clientPartyMatches === 'string' ? JSON.parse(clientPartyMatches) : clientPartyMatches;
    const shouldCreateNew = createNewParties === true || createNewParties === 'true';

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'No rows to import' });
    }

    await client.query('BEGIN');

    // Determine which table to use for parties
    let partyTable = 'transporters';
    
    // Check if parties table exists
    try {
      await client.query('SELECT 1 FROM parties LIMIT 1');
      partyTable = 'parties';
    } catch (e) {
      // Use transporters
    }

    // Get existing parties
    const partiesResult = await client.query(
      partyTable === 'parties' 
        ? `SELECT id, name FROM parties WHERE type IN ('consigner', 'both')`
        : `SELECT id, name FROM transporters`
    );
    
    const partyMap = {};
    partiesResult.rows.forEach(p => {
      partyMap[normalizePartyName(p.name)] = { id: p.id, name: p.name };
    });

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      newParties: 0,
      newPartiesList: [],
      entries: [],
      errors: []
    };

    // Process each row
    for (const row of rows) {
      if (row.status === 'error' || !row.parsed.party_name) {
        results.skipped++;
        results.errors.push({
          row: row.rowNumber,
          reason: 'Skipped - invalid row or missing party name',
          errors: row.errors
        });
        continue;
      }

      try {
        const partyName = row.parsed.party_name;
        const normalizedName = normalizePartyName(partyName);
        let partyId = partyMap[normalizedName]?.id;

        // Check if we have a matched party from frontend selection
        if (!partyId && partyMappings && partyMappings[normalizedName]) {
          const mapping = partyMappings[normalizedName];
          if (mapping.party?.id) {
            partyId = mapping.party.id;
          }
        }

        // Create new party if needed
        if (!partyId) {
          if (shouldCreateNew) {
            const insertQuery = partyTable === 'parties'
              ? `INSERT INTO parties (name, type, created_at) VALUES ($1, 'consigner', NOW()) RETURNING id`
              : `INSERT INTO transporters (name, created_at) VALUES ($1, NOW()) RETURNING id`;
            
            const newPartyResult = await client.query(insertQuery, [partyName]);
            partyId = newPartyResult.rows[0].id;
            partyMap[normalizedName] = { id: partyId, name: partyName };
            results.newParties++;
            results.newPartiesList.push({ id: partyId, name: partyName });

            // Initialize balance record
            try {
              await client.query(
                `INSERT INTO consigner_balance (consigner_id, outstanding_balance, total_trips, total_freight, total_paid)
                 VALUES ($1, 0, 0, 0, 0)
                 ON CONFLICT (consigner_id) DO NOTHING`,
                [partyId]
              );
            } catch (balanceErr) {
              console.log('Balance table may not exist:', balanceErr.message);
            }
          } else {
            results.failed++;
            results.errors.push({
              row: row.rowNumber,
              reason: `Party not found: ${partyName}`,
              partyName
            });
            continue;
          }
        }

        // Get amounts
        const debitAmount = row.parsed.debit || 0;
        const creditAmount = row.parsed.credit || 0;

        if (debitAmount === 0 && creditAmount === 0) {
          results.skipped++;
          continue;
        }

        // Determine transaction type and amount
        let transactionType, amount;
        if (creditAmount > 0 && debitAmount === 0) {
          transactionType = 'credit';
          amount = creditAmount;
        } else if (debitAmount > 0 && creditAmount === 0) {
          transactionType = 'debit';
          amount = debitAmount;
        } else {
          // Both have values - use net
          if (creditAmount > debitAmount) {
            transactionType = 'credit';
            amount = creditAmount - debitAmount;
          } else {
            transactionType = 'debit';
            amount = debitAmount - creditAmount;
          }
        }

        // Build description
        let description = row.parsed.description || 'Imported entry';
        if (row.parsed.reference) {
          description += ` (Ref: ${row.parsed.reference})`;
        }
        if (row.parsed.trip_id) {
          description += ` [Trip: ${row.parsed.trip_id}]`;
        }

        // Get current balance
        let currentBalance = 0;
        try {
          const balanceResult = await client.query(
            'SELECT outstanding_balance FROM consigner_balance WHERE consigner_id = $1',
            [partyId]
          );
          if (balanceResult.rows.length > 0) {
            currentBalance = parseFloat(balanceResult.rows[0].outstanding_balance) || 0;
          }
        } catch (e) {
          // Balance table might not exist
        }

        // Calculate new balance
        const newBalance = transactionType === 'credit'
          ? currentBalance + amount  // Add to outstanding
          : currentBalance - amount; // Payment received reduces outstanding

        // Insert ledger entry
        const transactionDate = row.parsed.date || new Date().toISOString().split('T')[0];
        
        const insertResult = await client.query(
          `INSERT INTO consigner_ledger (consigner_id, transaction_type, amount, balance_after, description, transaction_date, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [partyId, transactionType, amount, newBalance, description, transactionDate, req.user.id]
        );

        // Update balance
        try {
          await client.query(
            `INSERT INTO consigner_balance (consigner_id, outstanding_balance, total_trips, total_freight, total_paid)
             VALUES ($1, $2, 0, $3, $4)
             ON CONFLICT (consigner_id) 
             DO UPDATE SET 
               outstanding_balance = $2,
               total_freight = consigner_balance.total_freight + $3,
               total_paid = consigner_balance.total_paid + $4,
               updated_at = NOW()`,
            [
              partyId, 
              newBalance, 
              transactionType === 'credit' ? amount : 0,
              transactionType === 'debit' ? amount : 0
            ]
          );
        } catch (e) {
          console.log('Balance update error:', e.message);
        }

        results.success++;
        results.entries.push({
          id: insertResult.rows[0].id,
          row: row.rowNumber,
          partyName,
          partyId,
          transactionType,
          amount,
          date: transactionDate,
          newBalance
        });

      } catch (rowError) {
        results.failed++;
        results.errors.push({
          row: row.rowNumber,
          reason: rowError.message
        });
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Import completed: ${results.success} entries created`,
      results
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Transaction rolled back'
    });
  } finally {
    client.release();
  }
});

// Download sample template
router.get('/template', (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Party Ledger');
  
  worksheet.columns = [
    { header: 'Party Name', key: 'party_name', width: 30 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Debit (Payment Received)', key: 'debit', width: 20 },
    { header: 'Credit (Freight Due)', key: 'credit', width: 20 },
    { header: 'Reference', key: 'reference', width: 20 },
    { header: 'Trip/LR No', key: 'trip_id', width: 15 }
  ];
  
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  headerRow.alignment = { horizontal: 'center' };
  
  // Sample data
  const samples = [
    { party_name: 'ABC Traders', date: '15/01/2026', description: 'Freight for Delhi trip', debit: '', credit: 25000, reference: 'BILL-001', trip_id: 'LR-1001' },
    { party_name: 'ABC Traders', date: '20/01/2026', description: 'Payment received via NEFT', debit: 15000, credit: '', reference: 'UTR123456', trip_id: '' },
    { party_name: 'XYZ Transport', date: '18/01/2026', description: 'Freight charges Mumbai', debit: '', credit: 45000, reference: '', trip_id: 'LR-1002' },
    { party_name: 'PQR Logistics', date: '22/01/2026', description: 'Cash payment', debit: 30000, credit: '', reference: 'CASH', trip_id: '' }
  ];
  
  samples.forEach(data => worksheet.addRow(data));
  
  // Style data rows
  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    row.getCell('debit').numFmt = '₹#,##0';
    row.getCell('credit').numFmt = '₹#,##0';
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=party_ledger_template.xlsx');
  
  workbook.xlsx.write(res);
});

export default router;
