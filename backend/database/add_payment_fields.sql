-- Add payment fields to trips table (run this in Supabase SQL Editor)
-- This adds the missing columns for the payment management system

-- 1. Add payment fields to trips table
DO $$ 
BEGIN
    -- Add freight_amount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'freight_amount') THEN
        ALTER TABLE trips ADD COLUMN freight_amount DECIMAL(12,2) DEFAULT 0;
    END IF;

    -- Add payment_status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'payment_status') THEN
        ALTER TABLE trips ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'completed', 'overdue'));
    END IF;

    -- Add amount_paid
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'amount_paid') THEN
        ALTER TABLE trips ADD COLUMN amount_paid DECIMAL(12,2) DEFAULT 0;
    END IF;

    -- Add amount_due
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'amount_due') THEN
        ALTER TABLE trips ADD COLUMN amount_due DECIMAL(12,2) DEFAULT 0;
    END IF;

    -- Add payment_due_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'payment_due_date') THEN
        ALTER TABLE trips ADD COLUMN payment_due_date DATE;
    END IF;

    -- Add consigner_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'consigner_id') THEN
        ALTER TABLE trips ADD COLUMN consigner_id INTEGER REFERENCES transporters(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Create trip_payments table
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
);

-- 3. Create consigner_ledger table
CREATE TABLE IF NOT EXISTS consigner_ledger (
    id SERIAL PRIMARY KEY,
    consigner_id INTEGER REFERENCES transporters(id) ON DELETE CASCADE,
    trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'adjustment')),
    amount DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- 4. Create consigner_balance table
CREATE TABLE IF NOT EXISTS consigner_balance (
    id SERIAL PRIMARY KEY,
    consigner_id INTEGER UNIQUE REFERENCES transporters(id) ON DELETE CASCADE,
    outstanding_balance DECIMAL(12,2) DEFAULT 0,
    total_trips INTEGER DEFAULT 0,
    total_freight DECIMAL(12,2) DEFAULT 0,
    total_paid DECIMAL(12,2) DEFAULT 0,
    last_payment_date DATE,
    last_trip_date DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_trips_payment_status ON trips(payment_status);
CREATE INDEX IF NOT EXISTS idx_trips_consigner ON trips(consigner_id);
CREATE INDEX IF NOT EXISTS idx_trips_payment_due ON trips(payment_due_date);
CREATE INDEX IF NOT EXISTS idx_trip_payments_trip ON trip_payments(trip_id);
CREATE INDEX IF NOT EXISTS idx_consigner_ledger_consigner ON consigner_ledger(consigner_id);
CREATE INDEX IF NOT EXISTS idx_consigner_ledger_date ON consigner_ledger(transaction_date);

-- 6. Create function to update overdue payments
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

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE 'Payment system tables and fields added successfully!'; 
END $$;
