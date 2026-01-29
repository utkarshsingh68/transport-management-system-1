-- Transport Management System Database Schema

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'accountant', 'viewer')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trucks Table
CREATE TABLE trucks (
    id SERIAL PRIMARY KEY,
    truck_number VARCHAR(50) UNIQUE NOT NULL,
    truck_type VARCHAR(50),
    capacity_tons DECIMAL(10, 2),
    model VARCHAR(100),
    purchase_date DATE,
    owner_type VARCHAR(20) CHECK (owner_type IN ('owned', 'leased', 'attached')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drivers Table
CREATE TABLE drivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    license_number VARCHAR(50) UNIQUE,
    license_expiry DATE,
    address TEXT,
    joining_date DATE,
    salary_amount DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trips Table
CREATE TABLE trips (
    id SERIAL PRIMARY KEY,
    trip_number VARCHAR(50) UNIQUE NOT NULL,
    truck_id INTEGER REFERENCES trucks(id) ON DELETE RESTRICT,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE RESTRICT,
    from_location VARCHAR(200) NOT NULL,
    to_location VARCHAR(200) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    distance_km DECIMAL(10, 2),
    weight_tons DECIMAL(10, 2),
    rate_per_ton DECIMAL(10, 2),
    rate_type VARCHAR(20) CHECK (rate_type IN ('per_ton', 'fixed', 'per_km')),
    fixed_amount DECIMAL(10, 2),
    calculated_income DECIMAL(10, 2),
    actual_income DECIMAL(10, 2),
    driver_advance_amount DECIMAL(10, 2) DEFAULT 0,
    trip_spent_amount DECIMAL(10, 2) DEFAULT 0,
    consignor_name VARCHAR(200),
    consignee_name VARCHAR(200),
    lr_number VARCHAR(100),
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fuel Entries Table
CREATE TABLE fuel_entries (
    id SERIAL PRIMARY KEY,
    truck_id INTEGER REFERENCES trucks(id) ON DELETE RESTRICT,
    trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    fuel_station VARCHAR(200),
    quantity_liters DECIMAL(10, 2) NOT NULL,
    price_per_liter DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    odometer_reading DECIMAL(10, 2),
    payment_mode VARCHAR(20) CHECK (payment_mode IN ('cash', 'bank', 'credit')),
    bill_number VARCHAR(100),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expenses Table
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    expense_date DATE NOT NULL,
    truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL,
    trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_mode VARCHAR(20) CHECK (payment_mode IN ('cash', 'bank')),
    bank_name VARCHAR(100),
    bill_number VARCHAR(100),
    bill_file_path VARCHAR(500),
    vendor_name VARCHAR(200),
    is_recurring BOOLEAN DEFAULT false,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transporters Table
CREATE TABLE transporters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    company_name VARCHAR(200),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    gstin VARCHAR(20),
    pan VARCHAR(20),
    bank_details TEXT,
    opening_balance DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transporter Payments Table
CREATE TABLE transporter_payments (
    id SERIAL PRIMARY KEY,
    transporter_id INTEGER REFERENCES transporters(id) ON DELETE RESTRICT,
    payment_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_mode VARCHAR(20) CHECK (payment_mode IN ('cash', 'bank', 'cheque', 'upi')),
    reference_number VARCHAR(100),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transporter Invoices (Receivables)
CREATE TABLE transporter_invoices (
    id SERIAL PRIMARY KEY,
    transporter_id INTEGER REFERENCES transporters(id) ON DELETE RESTRICT,
    trip_id INTEGER REFERENCES trips(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
    due_date DATE,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Salary Payments Table
CREATE TABLE salary_payments (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE RESTRICT,
    payment_date DATE NOT NULL,
    month VARCHAR(7) NOT NULL,
    basic_salary DECIMAL(10, 2) NOT NULL,
    allowances DECIMAL(10, 2) DEFAULT 0,
    deductions DECIMAL(10, 2) DEFAULT 0,
    advance_adjusted DECIMAL(10, 2) DEFAULT 0,
    net_amount DECIMAL(10, 2) NOT NULL,
    payment_mode VARCHAR(20) CHECK (payment_mode IN ('cash', 'bank')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Advance Payments Table
CREATE TABLE advance_payments (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE RESTRICT,
    advance_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    purpose TEXT,
    payment_mode VARCHAR(20) CHECK (payment_mode IN ('cash', 'bank')),
    is_adjusted BOOLEAN DEFAULT false,
    adjusted_in_salary INTEGER REFERENCES salary_payments(id),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cash Transactions Table
CREATE TABLE cash_transactions (
    id SERIAL PRIMARY KEY,
    transaction_date DATE NOT NULL,
    transaction_type VARCHAR(20) CHECK (transaction_type IN ('income', 'expense')),
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    balance_after DECIMAL(10, 2),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bank Transactions Table
CREATE TABLE bank_transactions (
    id SERIAL PRIMARY KEY,
    transaction_date DATE NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    transaction_type VARCHAR(20) CHECK (transaction_type IN ('credit', 'debit')),
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    reference_number VARCHAR(100),
    reference_type VARCHAR(50),
    reference_id INTEGER,
    balance_after DECIMAL(10, 2),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_trips_truck ON trips(truck_id);
CREATE INDEX idx_trips_driver ON trips(driver_id);
CREATE INDEX idx_trips_date ON trips(start_date);
CREATE INDEX idx_fuel_truck ON fuel_entries(truck_id);
CREATE INDEX idx_fuel_date ON fuel_entries(date);
CREATE INDEX idx_expenses_truck ON expenses(truck_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_reference ON expenses(reference_type, reference_id);
CREATE UNIQUE INDEX uniq_expenses_reference ON expenses(reference_type, reference_id);
CREATE INDEX idx_transporter_invoices_status ON transporter_invoices(status);
CREATE INDEX idx_cash_transactions_date ON cash_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(transaction_date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trucks_updated_at BEFORE UPDATE ON trucks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fuel_entries_updated_at BEFORE UPDATE ON fuel_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
