// Migration script for Trip Payment Management System
// Adds payment tracking, consigner ledger, and partial payments support
// Usage: node scripts/migratePaymentSystem.js

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrate = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting Payment System Migration...\n');

    // 1. Add payment fields to trips table
    console.log('1️⃣ Adding payment fields to trips table...');
    
    const paymentFields = [
      { name: 'freight_amount', type: 'DECIMAL(12,2) DEFAULT 0' },
      { name: 'payment_status', type: "VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'completed', 'overdue'))" },
      { name: 'amount_paid', type: 'DECIMAL(12,2) DEFAULT 0' },
      { name: 'amount_due', type: 'DECIMAL(12,2) DEFAULT 0' },
      { name: 'payment_due_date', type: 'DATE' },
      { name: 'consigner_id', type: 'INTEGER REFERENCES parties(id) ON DELETE SET NULL' },
    ];

    for (const field of paymentFields) {
      const checkColumn = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'trips' AND column_name = $1
      `, [field.name]);

      if (checkColumn.rows.length === 0) {
        await client.query(`ALTER TABLE trips ADD COLUMN ${field.name} ${field.type}`);
        console.log(`   ✅ Added ${field.name}`);
      } else {
        console.log(`   ⏭️ ${field.name} already exists`);
      }
    }

    // 2. Create trip_payments table for payment history
    console.log('\n2️⃣ Creating trip_payments table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS trip_payments (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
        amount DECIMAL(12,2) NOT NULL,
        payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        payment_mode VARCHAR(50) DEFAULT 'cash',
        reference_number VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id)
      )
    `);
    console.log('   ✅ trip_payments table ready');

    // 3. Create consigner_ledger table for udhari tracking
    console.log('\n3️⃣ Creating consigner_ledger table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS consigner_ledger (
        id SERIAL PRIMARY KEY,
        consigner_id INTEGER REFERENCES parties(id) ON DELETE CASCADE,
        trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
        transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'adjustment')),
        amount DECIMAL(12,2) NOT NULL,
        balance_after DECIMAL(12,2) NOT NULL,
        description TEXT,
        transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id)
      )
    `);
    console.log('   ✅ consigner_ledger table ready');

    // 4. Create consigner_balance table to track running balance
    console.log('\n4️⃣ Creating consigner_balance table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS consigner_balance (
        id SERIAL PRIMARY KEY,
        consigner_id INTEGER UNIQUE REFERENCES parties(id) ON DELETE CASCADE,
        outstanding_balance DECIMAL(12,2) DEFAULT 0,
        total_trips INTEGER DEFAULT 0,
        total_freight DECIMAL(12,2) DEFAULT 0,
        total_paid DECIMAL(12,2) DEFAULT 0,
        last_payment_date DATE,
        last_trip_date DATE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ consigner_balance table ready');

    // 5. Create indexes for better performance
    console.log('\n5️⃣ Creating indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_trips_payment_status ON trips(payment_status)',
      'CREATE INDEX IF NOT EXISTS idx_trips_consigner ON trips(consigner_id)',
      'CREATE INDEX IF NOT EXISTS idx_trips_payment_due ON trips(payment_due_date)',
      'CREATE INDEX IF NOT EXISTS idx_trip_payments_trip ON trip_payments(trip_id)',
      'CREATE INDEX IF NOT EXISTS idx_consigner_ledger_consigner ON consigner_ledger(consigner_id)',
      'CREATE INDEX IF NOT EXISTS idx_consigner_ledger_date ON consigner_ledger(transaction_date)',
    ];

    for (const idx of indexes) {
      await client.query(idx);
    }
    console.log('   ✅ All indexes created');

    // 6. Create function to update overdue payments
    console.log('\n6️⃣ Creating overdue check function...');
    
    await client.query(`
      CREATE OR REPLACE FUNCTION update_overdue_payments()
      RETURNS void AS $$
      BEGIN
        UPDATE trips 
        SET payment_status = 'overdue'
        WHERE payment_status = 'pending' 
          AND payment_due_date < CURRENT_DATE
          AND amount_due > 0;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ Overdue check function created');

    console.log('\n✅ Payment System Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Added payment fields to trips table');
    console.log('   - Created trip_payments table for payment history');
    console.log('   - Created consigner_ledger table for udhari tracking');
    console.log('   - Created consigner_balance table for running balances');
    console.log('   - Created performance indexes');
    console.log('   - Created overdue check function');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate().catch(console.error);
