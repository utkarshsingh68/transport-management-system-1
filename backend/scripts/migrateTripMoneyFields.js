import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function migrateTripMoneyFields() {
  const dbName = process.env.DB_NAME || 'tms_db';
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: dbName,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  try {
    await client.connect();

    // Add columns only if they don't exist (Postgres supports IF NOT EXISTS on ADD COLUMN)
    await client.query(`
      ALTER TABLE trips
        ADD COLUMN IF NOT EXISTS driver_advance_amount DECIMAL(10, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS trip_spent_amount DECIMAL(10, 2) DEFAULT 0;
    `);

    console.log('✅ Migration complete: trips.driver_advance_amount, trips.trip_spent_amount');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

migrateTripMoneyFields();

