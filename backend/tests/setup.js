// Test setup - runs before all tests
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Default test database URL (use test database to avoid affecting production)
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set. Some tests may be skipped.');
}

// Clean up after all tests
export const teardown = async () => {
  // Add any cleanup logic here
};
