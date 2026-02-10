-- Migration to fix missing schema elements
-- Run this on your Supabase database

-- 1. Add assigned_driver_id to trucks table
ALTER TABLE trucks
ADD COLUMN IF NOT EXISTS assigned_driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL;

-- 2. Create parties table (unified table for consigners/consignees/both)
CREATE TABLE IF NOT EXISTS parties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    company_name VARCHAR(200),
    type VARCHAR(20) DEFAULT 'both' CHECK (type IN ('consigner', 'consignee', 'both')),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    gstin VARCHAR(15),
    pan VARCHAR(10),
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_ifsc VARCHAR(20),
    opening_balance DECIMAL(12, 2) DEFAULT 0,
    credit_limit DECIMAL(12, 2) DEFAULT 0,
    payment_terms INTEGER DEFAULT 30,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Add consigner_id to trips table if not exists
ALTER TABLE trips
ADD COLUMN IF NOT EXISTS consigner_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;

-- 4. Create consigner_balance table for tracking outstanding amounts
CREATE TABLE IF NOT EXISTS consigner_balance (
    id SERIAL PRIMARY KEY,
    consigner_id INTEGER REFERENCES parties(id) ON DELETE CASCADE UNIQUE,
    outstanding_balance DECIMAL(12, 2) DEFAULT 0,
    total_trips INTEGER DEFAULT 0,
    total_freight DECIMAL(12, 2) DEFAULT 0,
    total_paid DECIMAL(12, 2) DEFAULT 0,
    last_payment_date DATE,
    last_trip_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create consigner_ledger table for detailed transaction history
CREATE TABLE IF NOT EXISTS consigner_ledger (
    id SERIAL PRIMARY KEY,
    consigner_id INTEGER REFERENCES parties(id) ON DELETE CASCADE,
    trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
    entry_date DATE NOT NULL,
    entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('freight', 'payment', 'adjustment', 'opening')),
    description TEXT,
    debit_amount DECIMAL(12, 2) DEFAULT 0,
    credit_amount DECIMAL(12, 2) DEFAULT 0,
    running_balance DECIMAL(12, 2) DEFAULT 0,
    payment_mode VARCHAR(20) CHECK (payment_mode IN ('cash', 'bank', 'cheque', 'upi', 'adjustment')),
    reference_number VARCHAR(100),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create bank_reconciliation table
CREATE TABLE IF NOT EXISTS bank_reconciliation (
    id SERIAL PRIMARY KEY,
    transaction_date DATE NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    description TEXT,
    reference_number VARCHAR(100),
    transaction_type VARCHAR(20) CHECK (transaction_type IN ('credit', 'debit')),
    amount DECIMAL(12, 2) NOT NULL,
    bank_balance DECIMAL(12, 2),
    is_reconciled BOOLEAN DEFAULT false,
    reconciled_with VARCHAR(50),
    reconciled_id INTEGER,
    reconciled_date DATE,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Create loans table for EMI tracking
CREATE TABLE IF NOT EXISTS loans (
    id SERIAL PRIMARY KEY,
    loan_name VARCHAR(200) NOT NULL,
    truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL,
    asset_type VARCHAR(50) DEFAULT 'truck',
    lender_type VARCHAR(50),
    lender_name VARCHAR(200),
    lender_branch VARCHAR(200),
    loan_account_number VARCHAR(100),
    loan_type VARCHAR(50) CHECK (loan_type IN ('vehicle', 'equipment', 'working_capital', 'personal', 'other')),
    principal_amount DECIMAL(12, 2) NOT NULL,
    interest_rate DECIMAL(5, 2),
    interest_type VARCHAR(20) DEFAULT 'reducing' CHECK (interest_type IN ('flat', 'reducing')),
    loan_term_months INTEGER,
    emi_amount DECIMAL(12, 2),
    total_emis INTEGER,
    emis_paid INTEGER DEFAULT 0,
    emis_remaining INTEGER,
    disbursement_date DATE,
    emi_start_date DATE,
    emi_end_date DATE,
    sanction_date DATE,
    processing_fee DECIMAL(10, 2) DEFAULT 0,
    insurance_amount DECIMAL(10, 2) DEFAULT 0,
    outstanding_principal DECIMAL(12, 2),
    total_interest_payable DECIMAL(12, 2),
    total_amount_payable DECIMAL(12, 2),
    total_paid DECIMAL(12, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'defaulted')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Create emi_schedule table
CREATE TABLE IF NOT EXISTS emi_schedule (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    emi_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    emi_amount DECIMAL(12, 2) NOT NULL,
    principal_component DECIMAL(12, 2),
    interest_component DECIMAL(12, 2),
    opening_balance DECIMAL(12, 2),
    closing_balance DECIMAL(12, 2),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'partial')),
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    paid_date DATE,
    late_fee DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Create emi_payments table
CREATE TABLE IF NOT EXISTS emi_payments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    emi_schedule_id INTEGER REFERENCES emi_schedule(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL,
    payment_amount DECIMAL(12, 2) NOT NULL,
    payment_mode VARCHAR(20) CHECK (payment_mode IN ('cash', 'bank', 'cheque', 'upi', 'auto_debit')),
    reference_number VARCHAR(100),
    bank_name VARCHAR(100),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Create payments table for general payment tracking
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    payment_date DATE NOT NULL,
    payment_type VARCHAR(50) NOT NULL,
    party_type VARCHAR(50),
    party_id INTEGER,
    party_name VARCHAR(200),
    amount DECIMAL(12, 2) NOT NULL,
    payment_mode VARCHAR(20) CHECK (payment_mode IN ('cash', 'bank', 'cheque', 'upi')),
    bank_name VARCHAR(100),
    reference_number VARCHAR(100),
    description TEXT,
    trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Create udhari (credit) table
CREATE TABLE IF NOT EXISTS udhari (
    id SERIAL PRIMARY KEY,
    party_id INTEGER REFERENCES parties(id) ON DELETE CASCADE,
    party_name VARCHAR(200),
    entry_date DATE NOT NULL,
    entry_type VARCHAR(20) CHECK (entry_type IN ('credit', 'debit', 'payment')),
    description TEXT,
    amount DECIMAL(12, 2) NOT NULL,
    running_balance DECIMAL(12, 2),
    payment_mode VARCHAR(20),
    reference_number VARCHAR(100),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Create documents table
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    document_type VARCHAR(50) NOT NULL,
    document_name VARCHAR(200) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    expiry_date DATE,
    reminder_days INTEGER DEFAULT 30,
    file_path VARCHAR(500),
    file_name VARCHAR(200),
    file_size INTEGER,
    mime_type VARCHAR(100),
    description TEXT,
    status VARCHAR(20) DEFAULT 'valid' CHECK (status IN ('valid', 'expired', 'expiring_soon')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(type);
CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(name);
CREATE INDEX IF NOT EXISTS idx_consigner_ledger_consigner ON consigner_ledger(consigner_id);
CREATE INDEX IF NOT EXISTS idx_consigner_ledger_date ON consigner_ledger(entry_date);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_truck ON loans(truck_id);
CREATE INDEX IF NOT EXISTS idx_emi_schedule_loan ON emi_schedule(loan_id);
CREATE INDEX IF NOT EXISTS idx_emi_schedule_due_date ON emi_schedule(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_udhari_party ON udhari(party_id);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date);

-- Apply updated_at trigger to new tables
DO $$ 
BEGIN
    -- Create trigger function if not exists
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $trigger$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $trigger$ language 'plpgsql';
EXCEPTION WHEN duplicate_function THEN NULL;
END $$;

DROP TRIGGER IF EXISTS update_parties_updated_at ON parties;
CREATE TRIGGER update_parties_updated_at BEFORE UPDATE ON parties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loans_updated_at ON loans;
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_emi_schedule_updated_at ON emi_schedule;
CREATE TRIGGER update_emi_schedule_updated_at BEFORE UPDATE ON emi_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrate data from transporters to parties if transporters has data
INSERT INTO parties (name, company_name, phone, email, address, gstin, pan, opening_balance, status, created_at)
SELECT name, company_name, phone, email, address, gstin, pan, opening_balance, status, created_at
FROM transporters
WHERE NOT EXISTS (SELECT 1 FROM parties WHERE parties.name = transporters.name)
ON CONFLICT DO NOTHING;

SELECT 'Schema migration completed successfully!' as status;
