import request from 'supertest';
import app from '../src/index.js';
import { prisma } from './setup.js';
import bcrypt from 'bcryptjs';

describe('Authentication', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new student successfully', async () => {
      const studentData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        password: 'Password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(studentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.student).toMatchObject({
        name: studentData.name,
        email: studentData.email,
        phone: studentData.phone
      });
      expect(response.body.data.token).toBeDefined();

      // Verify student was created in database
      const student = await prisma.student.findUnique({
        where: { email: studentData.email }
      });
      expect(student).toBeTruthy();
      expect(student.name).toBe(studentData.name);
    });

    it('should fail to register with invalid email', async () => {
      const studentData = {
        name: 'John Doe',
        email: 'invalid-email',
        phone: '9876543210',
        password: 'Password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(studentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should fail to register with weak password', async () => {
      const studentData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        password: '123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(studentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should fail to register with duplicate email', async () => {
      const studentData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        password: 'Password123'
      };

      // Create first student
      await request(app)
        .post('/api/auth/register')
        .send(studentData)
        .expect(201);

      // Try to create second student with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(studentData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test student
      const hashedPassword = await bcrypt.hash('Password123', 12);
      await prisma.student.create({
        data: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '9876543210',
          password: hashedPassword
        }
      });
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'john@example.com',
        password: 'Password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.student.email).toBe(loginData.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should fail to login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'Password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail to login with invalid password', async () => {
      const loginData = {
        email: 'john@example.com',
        password: 'WrongPassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    let student;
    let token;

    beforeEach(async () => {
      // Create a test student and get token
      const hashedPassword = await bcrypt.hash('Password123', 12);
      student = await prisma.student.create({
        data: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '9876543210',
          password: hashedPassword
        }
      });

      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'Password123'
        });

      token = loginResponse.body.data.token;
    });

    it('should get student profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.student.email).toBe(student.email);
    });

    it('should fail without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/admin/login', () => {
    beforeEach(async () => {
      // Create a test admin
      const hashedPassword = await bcrypt.hash('AdminPassword123', 12);
      await prisma.admin.create({
        data: {
          name: 'Admin User',
          email: 'admin@example.com',
          password: hashedPassword
        }
      });
    });

    it('should login admin with valid credentials', async () => {
      const loginData = {
        email: 'admin@example.com',
        password: 'AdminPassword123'
      };

      const response = await request(app)
        .post('/api/auth/admin/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.admin.email).toBe(loginData.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should fail admin login with invalid credentials', async () => {
      const loginData = {
        email: 'admin@example.com',
        password: 'WrongPassword'
      };

      const response = await request(app)
        .post('/api/auth/admin/login')
        .send(loginData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
