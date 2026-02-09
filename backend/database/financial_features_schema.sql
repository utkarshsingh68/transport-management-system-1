-- Financial Features Schema: GST Invoices, Bank Reconciliation, EMI/Loan Tracking

-- =============================================
-- GST INVOICES
-- =============================================

-- Company/Business Profile for Invoice Generation
CREATE TABLE IF NOT EXISTS company_profile (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(200) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    state_code VARCHAR(2),
    pincode VARCHAR(10),
    gstin VARCHAR(15),
    pan VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(100),
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_ifsc VARCHAR(20),
    bank_branch VARCHAR(100),
    logo_path VARCHAR(500),
    invoice_prefix VARCHAR(10) DEFAULT 'INV',
    invoice_start_number INTEGER DEFAULT 1,
    terms_conditions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GST Invoices Table
CREATE TABLE IF NOT EXISTS gst_invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    
    -- Party Details
    party_id INTEGER REFERENCES transporters(id) ON DELETE RESTRICT,
    party_name VARCHAR(200) NOT NULL,
    party_address TEXT,
    party_gstin VARCHAR(15),
    party_state VARCHAR(100),
    party_state_code VARCHAR(2),
    
    -- Trip Reference (optional)
    trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
    
    -- Invoice Type
    invoice_type VARCHAR(20) DEFAULT 'tax_invoice' CHECK (invoice_type IN ('tax_invoice', 'bill_of_supply', 'credit_note', 'debit_note')),
    supply_type VARCHAR(20) DEFAULT 'service' CHECK (supply_type IN ('goods', 'service')),
    place_of_supply VARCHAR(100),
    
    -- Amounts
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    cgst_amount DECIMAL(12, 2) DEFAULT 0,
    sgst_amount DECIMAL(12, 2) DEFAULT 0,
    igst_amount DECIMAL(12, 2) DEFAULT 0,
    cess_amount DECIMAL(12, 2) DEFAULT 0,
    total_tax DECIMAL(12, 2) DEFAULT 0,
    round_off DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    amount_in_words VARCHAR(500),
    
    -- Payment Status
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    balance_amount DECIMAL(12, 2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    
    -- E-Way Bill (optional)
    eway_bill_number VARCHAR(50),
    eway_bill_date DATE,
    
    -- Additional Fields
    vehicle_number VARCHAR(50),
    transport_mode VARCHAR(50),
    lr_number VARCHAR(100),
    notes TEXT,
    
    -- Metadata
    is_cancelled BOOLEAN DEFAULT false,
    cancelled_reason TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GST Invoice Line Items
CREATE TABLE IF NOT EXISTS gst_invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES gst_invoices(id) ON DELETE CASCADE,
    
    -- Item Details
    description VARCHAR(500) NOT NULL,
    hsn_sac_code VARCHAR(10),
    quantity DECIMAL(10, 3) DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'NOS',
    rate DECIMAL(12, 2) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    
    -- Tax Details
    gst_rate DECIMAL(5, 2) DEFAULT 0,
    cgst_rate DECIMAL(5, 2) DEFAULT 0,
    cgst_amount DECIMAL(12, 2) DEFAULT 0,
    sgst_rate DECIMAL(5, 2) DEFAULT 0,
    sgst_amount DECIMAL(12, 2) DEFAULT 0,
    igst_rate DECIMAL(5, 2) DEFAULT 0,
    igst_amount DECIMAL(12, 2) DEFAULT 0,
    cess_rate DECIMAL(5, 2) DEFAULT 0,
    cess_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- HSN/SAC Master Codes (Common for Transport)
CREATE TABLE IF NOT EXISTS hsn_sac_master (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    description VARCHAR(500) NOT NULL,
    gst_rate DECIMAL(5, 2) NOT NULL,
    type VARCHAR(10) CHECK (type IN ('HSN', 'SAC')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert common transport SAC codes
INSERT INTO hsn_sac_master (code, description, gst_rate, type) VALUES
('996511', 'Goods Transport Agency (GTA) Services - Transport of goods by road', 5.00, 'SAC'),
('996512', 'Goods Transport Services - Rail', 5.00, 'SAC'),
('996521', 'Courier Services', 18.00, 'SAC'),
('996601', 'Rental of trucks with operator', 18.00, 'SAC'),
('996602', 'Rental of other motor vehicles with operator', 18.00, 'SAC'),
('9965', 'Goods Transport Services', 5.00, 'SAC'),
('9967', 'Supporting services in transport', 18.00, 'SAC')
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- BANK RECONCILIATION
-- =============================================

-- Bank Accounts Master
CREATE TABLE IF NOT EXISTS bank_accounts (
    id SERIAL PRIMARY KEY,
    account_name VARCHAR(200) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(20),
    branch VARCHAR(100),
    account_type VARCHAR(20) DEFAULT 'current' CHECK (account_type IN ('savings', 'current', 'overdraft')),
    opening_balance DECIMAL(12, 2) DEFAULT 0,
    current_balance DECIMAL(12, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bank Statement Imports
CREATE TABLE IF NOT EXISTS bank_statements (
    id SERIAL PRIMARY KEY,
    bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE CASCADE,
    statement_date DATE NOT NULL,
    
    -- Transaction Details
    transaction_date DATE NOT NULL,
    value_date DATE,
    description TEXT,
    reference_number VARCHAR(100),
    debit_amount DECIMAL(12, 2) DEFAULT 0,
    credit_amount DECIMAL(12, 2) DEFAULT 0,
    balance DECIMAL(12, 2),
    transaction_type VARCHAR(20), -- NEFT, RTGS, UPI, CHEQUE, etc.
    
    -- Reconciliation Status
    is_reconciled BOOLEAN DEFAULT false,
    reconciled_with_type VARCHAR(50), -- 'expense', 'income', 'payment', 'fuel', 'salary', 'emi', etc.
    reconciled_with_id INTEGER,
    reconciled_date DATE,
    reconciled_by INTEGER REFERENCES users(id),
    
    -- Import metadata
    import_batch_id VARCHAR(50),
    raw_data TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reconciliation Log
CREATE TABLE IF NOT EXISTS reconciliation_log (
    id SERIAL PRIMARY KEY,
    bank_statement_id INTEGER REFERENCES bank_statements(id) ON DELETE CASCADE,
    matched_type VARCHAR(50) NOT NULL,
    matched_id INTEGER NOT NULL,
    matched_amount DECIMAL(12, 2) NOT NULL,
    match_confidence VARCHAR(20) DEFAULT 'manual' CHECK (match_confidence IN ('auto', 'suggested', 'manual')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- EMI/LOAN TRACKING
-- =============================================

-- Loans Table
CREATE TABLE IF NOT EXISTS loans (
    id SERIAL PRIMARY KEY,
    loan_name VARCHAR(200) NOT NULL,
    
    -- Asset Reference (optional - for truck loans)
    truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL,
    asset_type VARCHAR(50), -- 'truck', 'equipment', 'property', 'working_capital', 'personal', 'other'
    
    -- Lender Details
    lender_type VARCHAR(50) NOT NULL, -- 'bank', 'nbfc', 'private', 'other'
    lender_name VARCHAR(200) NOT NULL,
    lender_branch VARCHAR(100),
    loan_account_number VARCHAR(50),
    
    -- Loan Details
    loan_type VARCHAR(50) DEFAULT 'term_loan' CHECK (loan_type IN ('term_loan', 'overdraft', 'vehicle_loan', 'working_capital', 'other')),
    principal_amount DECIMAL(14, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) NOT NULL,
    interest_type VARCHAR(20) DEFAULT 'reducing' CHECK (interest_type IN ('reducing', 'flat')),
    tenure_months INTEGER NOT NULL,
    
    -- EMI Details
    emi_amount DECIMAL(12, 2) NOT NULL,
    emi_start_date DATE NOT NULL,
    emi_day INTEGER DEFAULT 1, -- Day of month for EMI
    
    -- Dates
    sanction_date DATE,
    disbursement_date DATE NOT NULL,
    maturity_date DATE NOT NULL,
    
    -- Current Status
    total_paid DECIMAL(14, 2) DEFAULT 0,
    principal_paid DECIMAL(14, 2) DEFAULT 0,
    interest_paid DECIMAL(14, 2) DEFAULT 0,
    outstanding_amount DECIMAL(14, 2) NOT NULL,
    emis_paid INTEGER DEFAULT 0,
    emis_remaining INTEGER NOT NULL,
    
    -- Tracking
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'defaulted', 'foreclosed')),
    last_payment_date DATE,
    next_emi_date DATE,
    
    -- Documents
    sanction_letter_path VARCHAR(500),
    agreement_path VARCHAR(500),
    
    -- Additional
    processing_fee DECIMAL(10, 2) DEFAULT 0,
    insurance_amount DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- EMI Schedule (Pre-calculated EMI breakdown)
CREATE TABLE IF NOT EXISTS emi_schedule (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    
    emi_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    
    -- EMI Breakdown
    emi_amount DECIMAL(12, 2) NOT NULL,
    principal_component DECIMAL(12, 2) NOT NULL,
    interest_component DECIMAL(12, 2) NOT NULL,
    opening_balance DECIMAL(14, 2) NOT NULL,
    closing_balance DECIMAL(14, 2) NOT NULL,
    
    -- Payment Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'waived')),
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    paid_date DATE,
    payment_mode VARCHAR(20),
    payment_reference VARCHAR(100),
    
    -- Late Payment
    days_overdue INTEGER DEFAULT 0,
    late_fee DECIMAL(10, 2) DEFAULT 0,
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- EMI Payments (Actual payments made)
CREATE TABLE IF NOT EXISTS emi_payments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    emi_schedule_id INTEGER REFERENCES emi_schedule(id) ON DELETE SET NULL,
    
    payment_date DATE NOT NULL,
    payment_amount DECIMAL(12, 2) NOT NULL,
    principal_paid DECIMAL(12, 2) NOT NULL,
    interest_paid DECIMAL(12, 2) NOT NULL,
    late_fee_paid DECIMAL(10, 2) DEFAULT 0,
    other_charges DECIMAL(10, 2) DEFAULT 0,
    
    payment_mode VARCHAR(20) CHECK (payment_mode IN ('cash', 'bank', 'cheque', 'auto_debit', 'neft', 'upi')),
    payment_reference VARCHAR(100),
    bank_account_id INTEGER REFERENCES bank_accounts(id),
    
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_gst_invoices_party ON gst_invoices(party_id);
CREATE INDEX IF NOT EXISTS idx_gst_invoices_date ON gst_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_gst_invoices_status ON gst_invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_gst_invoice_items_invoice ON gst_invoice_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_bank_statements_account ON bank_statements(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_date ON bank_statements(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_statements_reconciled ON bank_statements(is_reconciled);

CREATE INDEX IF NOT EXISTS idx_loans_truck ON loans(truck_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_emi_schedule_loan ON emi_schedule(loan_id);
CREATE INDEX IF NOT EXISTS idx_emi_schedule_date ON emi_schedule(due_date);
CREATE INDEX IF NOT EXISTS idx_emi_schedule_status ON emi_schedule(status);
CREATE INDEX IF NOT EXISTS idx_emi_payments_loan ON emi_payments(loan_id);

-- =============================================
-- TRIGGERS
-- =============================================

CREATE TRIGGER update_gst_invoices_updated_at BEFORE UPDATE ON gst_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bank_statements_updated_at BEFORE UPDATE ON bank_statements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_emi_schedule_updated_at BEFORE UPDATE ON emi_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
