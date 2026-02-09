import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const client = await pool.connect();
  
  try {
    const sqlPath = path.join(__dirname, '../database/financial_features_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running financial features migration...');
    await client.query(sql);
    console.log('Migration completed successfully!');
    console.log('Created tables: company_profile, gst_invoices, gst_invoice_items, hsn_sac_master, bank_accounts, bank_statements, reconciliation_log, loans, emi_schedule, emi_payments');
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
