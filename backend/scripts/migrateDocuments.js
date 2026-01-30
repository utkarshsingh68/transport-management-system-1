// Run this script to create the documents table
// Usage: node scripts/migrateDocuments.js

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createDocumentsTable = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Creating documents table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        document_type VARCHAR(50) NOT NULL,
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
        reminder_days INTEGER DEFAULT 30,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Documents table created');
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date);
      CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
    `);
    
    console.log('✅ Indexes created');
    
    // Create trigger for updated_at
    await client.query(`
      DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
      CREATE TRIGGER update_documents_updated_at 
        BEFORE UPDATE ON documents 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    `);
    
    console.log('✅ Trigger created');
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

createDocumentsTable().catch(console.error);
