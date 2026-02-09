import express from 'express';
import pool, { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Helper function to convert number to words (Indian format)
const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertLessThanThousand = (n) => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertLessThanThousand(n % 100) : '');
  };

  if (num === 0) return 'Zero Rupees Only';

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const remainder = Math.floor(num % 1000);
  const paise = Math.round((num % 1) * 100);

  let words = '';
  if (crore) words += convertLessThanThousand(crore) + ' Crore ';
  if (lakh) words += convertLessThanThousand(lakh) + ' Lakh ';
  if (thousand) words += convertLessThanThousand(thousand) + ' Thousand ';
  if (remainder) words += convertLessThanThousand(remainder);

  words = words.trim() + ' Rupees';
  if (paise) words += ' and ' + convertLessThanThousand(paise) + ' Paise';
  words += ' Only';

  return words;
};

// Get company profile
router.get('/company-profile', async (req, res) => {
  try {
    const result = await query('SELECT * FROM company_profile LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching company profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save/Update company profile
router.post('/company-profile', async (req, res) => {
  try {
    const {
      company_name, address, city, state, state_code, pincode, gstin, pan,
      phone, email, bank_name, bank_account_number, bank_ifsc, bank_branch,
      invoice_prefix, invoice_start_number, terms_conditions
    } = req.body;

    const existing = await query('SELECT id FROM company_profile LIMIT 1');

    if (existing.rows.length > 0) {
      const result = await query(`
        UPDATE company_profile SET
          company_name = $1, address = $2, city = $3, state = $4, state_code = $5,
          pincode = $6, gstin = $7, pan = $8, phone = $9, email = $10,
          bank_name = $11, bank_account_number = $12, bank_ifsc = $13, bank_branch = $14,
          invoice_prefix = $15, invoice_start_number = $16, terms_conditions = $17,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $18 RETURNING *
      `, [company_name, address, city, state, state_code, pincode, gstin, pan,
          phone, email, bank_name, bank_account_number, bank_ifsc, bank_branch,
          invoice_prefix, invoice_start_number, terms_conditions, existing.rows[0].id]);
      res.json(result.rows[0]);
    } else {
      const result = await query(`
        INSERT INTO company_profile (
          company_name, address, city, state, state_code, pincode, gstin, pan,
          phone, email, bank_name, bank_account_number, bank_ifsc, bank_branch,
          invoice_prefix, invoice_start_number, terms_conditions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `, [company_name, address, city, state, state_code, pincode, gstin, pan,
          phone, email, bank_name, bank_account_number, bank_ifsc, bank_branch,
          invoice_prefix, invoice_start_number, terms_conditions]);
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error saving company profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get HSN/SAC codes
router.get('/hsn-sac', async (req, res) => {
  try {
    const result = await query('SELECT * FROM hsn_sac_master WHERE is_active = true ORDER BY code');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching HSN/SAC codes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add HSN/SAC code
router.post('/hsn-sac', async (req, res) => {
  try {
    const { code, description, gst_rate, type } = req.body;
    const result = await query(
      `INSERT INTO hsn_sac_master (code, description, gst_rate, type) VALUES ($1, $2, $3, $4) RETURNING *`,
      [code, description, gst_rate, type]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding HSN/SAC code:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get next invoice number
router.get('/next-number', async (req, res) => {
  try {
    const profile = await query('SELECT invoice_prefix, invoice_start_number FROM company_profile LIMIT 1');
    const prefix = profile.rows[0]?.invoice_prefix || 'INV';
    const startNum = profile.rows[0]?.invoice_start_number || 1;

    const lastInvoice = await query(
      `SELECT invoice_number FROM gst_invoices WHERE invoice_number LIKE $1 ORDER BY id DESC LIMIT 1`,
      [prefix + '%']
    );

    let nextNum = startNum;
    if (lastInvoice.rows.length > 0) {
      const lastNum = parseInt(lastInvoice.rows[0].invoice_number.replace(prefix + '-', '')) || 0;
      nextNum = lastNum + 1;
    }

    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const invoiceNumber = `${prefix}-${year}${month}-${nextNum.toString().padStart(4, '0')}`;

    res.json({ invoiceNumber });
  } catch (error) {
    console.error('Error generating invoice number:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get invoice summary/stats - Must be before /:id route
router.get('/stats/summary', async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    let dateFilter = 'WHERE is_cancelled = false';
    const params = [];

    if (from_date && to_date) {
      dateFilter = 'WHERE invoice_date BETWEEN $1 AND $2 AND is_cancelled = false';
      params.push(from_date, to_date);
    }

    const result = await query(`
      SELECT
        COUNT(*) as total_invoices,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(balance_amount), 0) as total_pending,
        COALESCE(SUM(cgst_amount + sgst_amount), 0) as total_cgst_sgst,
        COALESCE(SUM(igst_amount), 0) as total_igst,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN payment_status = 'partial' THEN 1 END) as partial_count,
        COUNT(CASE WHEN payment_status = 'unpaid' THEN 1 END) as unpaid_count
      FROM gst_invoices ${dateFilter}
    `, params);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all invoices
router.get('/', async (req, res) => {
  try {
    const { status, from_date, to_date, party_id, search } = req.query;
    
    let queryText = `
      SELECT i.*, t.name as party_display_name
      FROM gst_invoices i
      LEFT JOIN transporters t ON i.party_id = t.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (status && status !== 'all') {
      paramCount++;
      queryText += ` AND i.payment_status = $${paramCount}`;
      params.push(status);
    }

    if (from_date) {
      paramCount++;
      queryText += ` AND i.invoice_date >= $${paramCount}`;
      params.push(from_date);
    }

    if (to_date) {
      paramCount++;
      queryText += ` AND i.invoice_date <= $${paramCount}`;
      params.push(to_date);
    }

    if (party_id) {
      paramCount++;
      queryText += ` AND i.party_id = $${paramCount}`;
      params.push(party_id);
    }

    if (search) {
      paramCount++;
      queryText += ` AND (i.invoice_number ILIKE $${paramCount} OR i.party_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY i.invoice_date DESC, i.id DESC`;

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get invoice by ID with items
router.get('/:id', async (req, res) => {
  try {
    const invoice = await query(
      `SELECT i.*, t.name as party_display_name, tr.trip_number
       FROM gst_invoices i
       LEFT JOIN transporters t ON i.party_id = t.id
       LEFT JOIN trips tr ON i.trip_id = tr.id
       WHERE i.id = $1`,
      [req.params.id]
    );

    if (invoice.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const items = await query('SELECT * FROM gst_invoice_items WHERE invoice_id = $1 ORDER BY id', [req.params.id]);
    const company = await query('SELECT * FROM company_profile LIMIT 1');

    res.json({
      ...invoice.rows[0],
      items: items.rows,
      company: company.rows[0] || null
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create invoice
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      invoice_number, invoice_date, due_date, party_id, party_name, party_address,
      party_gstin, party_state, party_state_code, trip_id, invoice_type, supply_type,
      place_of_supply, vehicle_number, transport_mode, lr_number, eway_bill_number,
      eway_bill_date, notes, items
    } = req.body;

    // Calculate totals
    let subtotal = 0, cgst_amount = 0, sgst_amount = 0, igst_amount = 0, cess_amount = 0;

    items.forEach(item => {
      subtotal += parseFloat(item.amount) || 0;
      cgst_amount += parseFloat(item.cgst_amount) || 0;
      sgst_amount += parseFloat(item.sgst_amount) || 0;
      igst_amount += parseFloat(item.igst_amount) || 0;
      cess_amount += parseFloat(item.cess_amount) || 0;
    });

    const total_tax = cgst_amount + sgst_amount + igst_amount + cess_amount;
    const exactTotal = subtotal + total_tax;
    const total_amount = Math.round(exactTotal);
    const round_off = total_amount - exactTotal;
    const amount_in_words = numberToWords(total_amount);

    const invoiceResult = await client.query(`
      INSERT INTO gst_invoices (
        invoice_number, invoice_date, due_date, party_id, party_name, party_address,
        party_gstin, party_state, party_state_code, trip_id, invoice_type, supply_type,
        place_of_supply, subtotal, cgst_amount, sgst_amount, igst_amount, cess_amount,
        total_tax, round_off, total_amount, amount_in_words, balance_amount,
        vehicle_number, transport_mode, lr_number, eway_bill_number, eway_bill_date,
        notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
      RETURNING *
    `, [
      invoice_number, invoice_date, due_date, party_id, party_name, party_address,
      party_gstin, party_state, party_state_code, trip_id, invoice_type, supply_type,
      place_of_supply, subtotal, cgst_amount, sgst_amount, igst_amount, cess_amount,
      total_tax, round_off, total_amount, amount_in_words, total_amount,
      vehicle_number, transport_mode, lr_number, eway_bill_number, eway_bill_date,
      notes, req.user.id
    ]);

    const invoiceId = invoiceResult.rows[0].id;

    for (const item of items) {
      await client.query(`
        INSERT INTO gst_invoice_items (
          invoice_id, description, hsn_sac_code, quantity, unit, rate, amount,
          gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
          igst_rate, igst_amount, cess_rate, cess_amount, total_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        invoiceId, item.description, item.hsn_sac_code, item.quantity || 1, item.unit || 'NOS',
        item.rate, item.amount, item.gst_rate || 0, item.cgst_rate || 0, item.cgst_amount || 0,
        item.sgst_rate || 0, item.sgst_amount || 0, item.igst_rate || 0, item.igst_amount || 0,
        item.cess_rate || 0, item.cess_amount || 0, item.total_amount
      ]);
    }

    await client.query('COMMIT');
    res.status(201).json(invoiceResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating invoice:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// Update invoice
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      invoice_date, due_date, party_id, party_name, party_address,
      party_gstin, party_state, party_state_code, trip_id, invoice_type, supply_type,
      place_of_supply, vehicle_number, transport_mode, lr_number, eway_bill_number,
      eway_bill_date, notes, items
    } = req.body;

    let subtotal = 0, cgst_amount = 0, sgst_amount = 0, igst_amount = 0, cess_amount = 0;

    items.forEach(item => {
      subtotal += parseFloat(item.amount) || 0;
      cgst_amount += parseFloat(item.cgst_amount) || 0;
      sgst_amount += parseFloat(item.sgst_amount) || 0;
      igst_amount += parseFloat(item.igst_amount) || 0;
      cess_amount += parseFloat(item.cess_amount) || 0;
    });

    const total_tax = cgst_amount + sgst_amount + igst_amount + cess_amount;
    const exactTotal = subtotal + total_tax;
    const total_amount = Math.round(exactTotal);
    const round_off = total_amount - exactTotal;
    const amount_in_words = numberToWords(total_amount);

    const currentInvoice = await client.query('SELECT paid_amount FROM gst_invoices WHERE id = $1', [req.params.id]);
    const paid_amount = currentInvoice.rows[0]?.paid_amount || 0;
    const balance_amount = total_amount - paid_amount;
    const payment_status = paid_amount === 0 ? 'unpaid' : (paid_amount >= total_amount ? 'paid' : 'partial');

    await client.query(`
      UPDATE gst_invoices SET
        invoice_date = $1, due_date = $2, party_id = $3, party_name = $4, party_address = $5,
        party_gstin = $6, party_state = $7, party_state_code = $8, trip_id = $9,
        invoice_type = $10, supply_type = $11, place_of_supply = $12, subtotal = $13,
        cgst_amount = $14, sgst_amount = $15, igst_amount = $16, cess_amount = $17,
        total_tax = $18, round_off = $19, total_amount = $20, amount_in_words = $21,
        balance_amount = $22, payment_status = $23, vehicle_number = $24, transport_mode = $25,
        lr_number = $26, eway_bill_number = $27, eway_bill_date = $28, notes = $29,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $30
    `, [
      invoice_date, due_date, party_id, party_name, party_address, party_gstin,
      party_state, party_state_code, trip_id, invoice_type, supply_type, place_of_supply,
      subtotal, cgst_amount, sgst_amount, igst_amount, cess_amount, total_tax, round_off,
      total_amount, amount_in_words, balance_amount, payment_status, vehicle_number,
      transport_mode, lr_number, eway_bill_number, eway_bill_date, notes, req.params.id
    ]);

    await client.query('DELETE FROM gst_invoice_items WHERE invoice_id = $1', [req.params.id]);

    for (const item of items) {
      await client.query(`
        INSERT INTO gst_invoice_items (
          invoice_id, description, hsn_sac_code, quantity, unit, rate, amount,
          gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
          igst_rate, igst_amount, cess_rate, cess_amount, total_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        req.params.id, item.description, item.hsn_sac_code, item.quantity || 1, item.unit || 'NOS',
        item.rate, item.amount, item.gst_rate || 0, item.cgst_rate || 0, item.cgst_amount || 0,
        item.sgst_rate || 0, item.sgst_amount || 0, item.igst_rate || 0, item.igst_amount || 0,
        item.cess_rate || 0, item.cess_amount || 0, item.total_amount
      ]);
    }

    await client.query('COMMIT');
    res.json({ message: 'Invoice updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating invoice:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// Record payment against invoice
router.post('/:id/payment', async (req, res) => {
  try {
    const { amount } = req.body;

    const invoice = await query('SELECT * FROM gst_invoices WHERE id = $1', [req.params.id]);
    if (invoice.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const currentPaid = parseFloat(invoice.rows[0].paid_amount) || 0;
    const totalAmount = parseFloat(invoice.rows[0].total_amount);
    const newPaid = currentPaid + parseFloat(amount);
    const balance = totalAmount - newPaid;
    const status = newPaid >= totalAmount ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');

    await query(`
      UPDATE gst_invoices SET paid_amount = $1, balance_amount = $2, payment_status = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [newPaid, balance, status, req.params.id]);

    res.json({ message: 'Payment recorded successfully' });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel invoice
router.post('/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;
    await query(`UPDATE gst_invoices SET is_cancelled = true, cancelled_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [reason, req.params.id]);
    res.json({ message: 'Invoice cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling invoice:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete invoice
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM gst_invoice_items WHERE invoice_id = $1', [req.params.id]);
    await client.query('DELETE FROM gst_invoices WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting invoice:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

export default router;
