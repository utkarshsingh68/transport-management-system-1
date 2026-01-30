// Migration script to add assigned_driver_id to trucks table
// Usage: node scripts/migrateDriverAssignment.js

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
    console.log('🔄 Adding assigned_driver_id column to trucks table...');
    
    // Check if column already exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'trucks' AND column_name = 'assigned_driver_id'
    `);
    
    if (checkColumn.rows.length === 0) {
      await client.query(`
        ALTER TABLE trucks 
        ADD COLUMN assigned_driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL
      `);
      console.log('✅ Column assigned_driver_id added to trucks table');
      
      // Create index for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_trucks_assigned_driver ON trucks(assigned_driver_id)
      `);
      console.log('✅ Index created');
    } else {
      console.log('ℹ️ Column assigned_driver_id already exists');
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate().catch(console.error);
