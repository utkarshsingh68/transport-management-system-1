-- Documents Management Schema

-- Documents Table for storing truck and driver documents
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    document_type VARCHAR(50) NOT NULL, -- 'rc', 'insurance', 'permit', 'fitness', 'puc', 'license', 'aadhar', 'pan'
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('truck', 'driver')),
    entity_id INTEGER NOT NULL,
    document_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    file_type VARCHAR(50),
    file_size INTEGER,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'expiring_soon')),
    reminder_days INTEGER DEFAULT 30, -- days before expiry to send reminder
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);

-- Trigger for updated_at
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
