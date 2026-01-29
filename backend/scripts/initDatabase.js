import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function initDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'tms_db';
    const checkDb = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (checkDb.rows.length === 0) {
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database '${dbName}' created`);
    } else {
      console.log(`ℹ️  Database '${dbName}' already exists`);
    }

    await client.end();

    // Connect to the TMS database
    const tmsClient = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: dbName,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    });

    await tmsClient.connect();
    console.log(`Connected to database '${dbName}'`);

    // Read and execute schema
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await tmsClient.query(schema);
    console.log('✅ Database schema created');

    // Create default admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await tmsClient.query(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO NOTHING`,
      ['admin', 'admin@tms.com', hashedPassword, 'System Administrator', 'admin']
    );
    console.log('✅ Default admin user created (username: admin, password: admin123)');

    // Create uploads directory
    const uploadsDir = path.join(__dirname, '../uploads/bills');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('✅ Uploads directory created');
    }

    await tmsClient.end();
    console.log('\n✨ Database initialization completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Copy .env.example to .env and update database credentials');
    console.log('2. Run: npm run dev (to start both frontend and backend)');
    console.log('3. Login with username: admin, password: admin123');

  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    process.exit(1);
  }
}

initDatabase();
