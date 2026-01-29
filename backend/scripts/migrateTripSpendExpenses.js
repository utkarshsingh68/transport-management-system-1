import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function migrateTripSpendExpenses() {
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

    // 1) Ensure expenses reference columns exist
    await client.query(`
      ALTER TABLE expenses
        ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS reference_id INTEGER;
    `);

    // 2) Ensure indexes exist (IF NOT EXISTS supported for indexes)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_reference ON expenses(reference_type, reference_id);
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_expenses_reference
      ON expenses(reference_type, reference_id);
    `);

    // 3) Backfill one expense per trip that has trip_spent_amount > 0
    const trips = await client.query(`
      SELECT id, truck_id, start_date, COALESCE(trip_spent_amount, 0) AS trip_spent_amount, created_by
      FROM trips
      WHERE COALESCE(trip_spent_amount, 0) > 0
    `);

    let upserted = 0;
    for (const t of trips.rows) {
      await client.query(
        `INSERT INTO expenses (
          expense_date, truck_id, trip_id, category, description, amount, payment_mode, vendor_name,
          reference_type, reference_id, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (reference_type, reference_id) DO UPDATE SET
          expense_date = EXCLUDED.expense_date,
          truck_id = EXCLUDED.truck_id,
          trip_id = EXCLUDED.trip_id,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          amount = EXCLUDED.amount,
          payment_mode = EXCLUDED.payment_mode,
          vendor_name = EXCLUDED.vendor_name,
          created_by = EXCLUDED.created_by`,
        [
          t.start_date,
          t.truck_id || null,
          t.id,
          'Trip Spend',
          'Auto: Trip spent amount',
          t.trip_spent_amount,
          'cash',
          'Trip',
          'trip_spend',
          t.id,
          t.created_by || null,
        ]
      );
      upserted += 1;
    }

    console.log(`✅ Migration complete: expenses reference fields + backfilled ${upserted} trip-spend expenses`);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

migrateTripSpendExpenses();

