import request from 'supertest';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment
dotenv.config({ path: path.join(__dirname, '..', '.env.test') });
process.env.NODE_ENV = 'test';

import app from '../server.js';

describe('API Health Check', () => {
  it('GET /api/health - should return OK status', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toHaveProperty('status', 'OK');
    expect(res.body).toHaveProperty('timestamp');
  });
});

describe('Auth Routes', () => {
  describe('POST /api/auth/login', () => {
    it('should return 400 for missing credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect('Content-Type', /json/);

      expect([400, 401, 422]).toContain(res.status);
    });

    it('should return 401 for invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'invaliduser',
          password: 'wrongpassword'
        });

      expect([401, 400]).toContain(res.status);
    });
  });
});

describe('Protected Routes (without auth)', () => {
  const protectedEndpoints = [
    { method: 'get', path: '/api/trucks' },
    { method: 'get', path: '/api/drivers' },
    { method: 'get', path: '/api/trips' },
    { method: 'get', path: '/api/fuel' },
    { method: 'get', path: '/api/expenses' },
    { method: 'get', path: '/api/parties' },
    { method: 'get', path: '/api/loans' },
    { method: 'get', path: '/api/payments' },
  ];

  protectedEndpoints.forEach(({ method, path }) => {
    it(`${method.toUpperCase()} ${path} - should return 401 without token`, async () => {
      const res = await request(app)[method](path);
      expect([401, 403]).toContain(res.status);
    });
  });
});

describe('404 Handling', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app)
      .get('/api/nonexistent-route')
      .expect(404);

    expect(res.body).toHaveProperty('error');
  });
});
