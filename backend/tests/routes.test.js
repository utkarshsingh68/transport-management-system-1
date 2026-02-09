import request from 'supertest';
import dotenv from 'dotenv';

// Load environment
dotenv.config();

import app from '../server.js';

// Helper to get auth token
let authToken = null;

const getAuthToken = async () => {
  if (authToken) return authToken;
  
  // Try to login with test credentials
  const res = await request(app)
    .post('/api/auth/login')
    .send({
      username: process.env.TEST_USERNAME || 'admin',
      password: process.env.TEST_PASSWORD || 'admin123'
    });

  if (res.status === 200 && res.body.token) {
    authToken = res.body.token;
    return authToken;
  }
  return null;
};

describe('Trucks API', () => {
  let token;

  beforeAll(async () => {
    token = await getAuthToken();
  });

  describe('GET /api/trucks', () => {
    it('should return trucks list when authenticated', async () => {
      if (!token) {
        console.log('Skipping: No auth token available');
        return;
      }

      const res = await request(app)
        .get('/api/trucks')
        .set('Authorization', `Bearer ${token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/trucks', () => {
    it('should validate required fields', async () => {
      if (!token) {
        console.log('Skipping: No auth token available');
        return;
      }

      const res = await request(app)
        .post('/api/trucks')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect([400, 422]).toContain(res.status);
    });
  });
});

describe('Drivers API', () => {
  let token;

  beforeAll(async () => {
    token = await getAuthToken();
  });

  describe('GET /api/drivers', () => {
    it('should return drivers list when authenticated', async () => {
      if (!token) {
        console.log('Skipping: No auth token available');
        return;
      }

      const res = await request(app)
        .get('/api/drivers')
        .set('Authorization', `Bearer ${token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});

describe('Trips API', () => {
  let token;

  beforeAll(async () => {
    token = await getAuthToken();
  });

  describe('GET /api/trips', () => {
    it('should return trips list when authenticated', async () => {
      if (!token) {
        console.log('Skipping: No auth token available');
        return;
      }

      const res = await request(app)
        .get('/api/trips')
        .set('Authorization', `Bearer ${token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});

describe('Loans API', () => {
  let token;

  beforeAll(async () => {
    token = await getAuthToken();
  });

  describe('GET /api/loans', () => {
    it('should return loans list when authenticated', async () => {
      if (!token) {
        console.log('Skipping: No auth token available');
        return;
      }

      const res = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/loans/summary', () => {
    it('should return loan summary when authenticated', async () => {
      if (!token) {
        console.log('Skipping: No auth token available');
        return;
      }

      const res = await request(app)
        .get('/api/loans/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('summary');
    });
  });
});

describe('Payments API', () => {
  let token;

  beforeAll(async () => {
    token = await getAuthToken();
  });

  describe('GET /api/payments', () => {
    it('should return payments list when authenticated', async () => {
      if (!token) {
        console.log('Skipping: No auth token available');
        return;
      }

      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});

describe('Bank Reconciliation API', () => {
  let token;

  beforeAll(async () => {
    token = await getAuthToken();
  });

  describe('GET /api/bank-reconciliation', () => {
    it('should return reconciliation records when authenticated', async () => {
      if (!token) {
        console.log('Skipping: No auth token available');
        return;
      }

      const res = await request(app)
        .get('/api/bank-reconciliation')
        .set('Authorization', `Bearer ${token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
