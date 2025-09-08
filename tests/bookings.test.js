import request from 'supertest';
import app from '../src/index.js';
import { prisma } from './setup.js';
import bcrypt from 'bcryptjs';

describe('Bookings', () => {
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

  describe('POST /api/bookings', () => {
    it('should create a booking successfully', async () => {
      const bookingData = {
        consultantType: 'CAREER_GUIDANCE',
        details: 'I need guidance on choosing a career path in technology.',
        amount: 150000 // ₹1500
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send(bookingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking.consultantType).toBe(bookingData.consultantType);
      expect(response.body.data.booking.amount).toBe(bookingData.amount);
      expect(response.body.data.booking.status).toBe('PENDING');

      // Verify booking was created in database
      const booking = await prisma.booking.findFirst({
        where: { studentId: student.id }
      });
      expect(booking).toBeTruthy();
      expect(booking.consultantType).toBe(bookingData.consultantType);
    });

    it('should fail with invalid consultant type', async () => {
      const bookingData = {
        consultantType: 'INVALID_TYPE',
        details: 'I need guidance on choosing a career path.',
        amount: 150000
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send(bookingData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should fail with amount below minimum', async () => {
      const bookingData = {
        consultantType: 'CAREER_GUIDANCE',
        details: 'I need guidance on choosing a career path.',
        amount: 5000 // Below minimum
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send(bookingData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should fail without authentication', async () => {
      const bookingData = {
        consultantType: 'CAREER_GUIDANCE',
        details: 'I need guidance on choosing a career path.',
        amount: 150000
      };

      const response = await request(app)
        .post('/api/bookings')
        .send(bookingData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/bookings/me', () => {
    beforeEach(async () => {
      // Create test bookings
      await prisma.booking.createMany({
        data: [
          {
            studentId: student.id,
            consultantType: 'CAREER_GUIDANCE',
            details: 'First booking',
            amount: 150000,
            status: 'PENDING'
          },
          {
            studentId: student.id,
            consultantType: 'STUDY_ABROAD',
            details: 'Second booking',
            amount: 200000,
            status: 'SUCCESS'
          }
        ]
      });
    });

    it('should get student bookings', async () => {
      const response = await request(app)
        .get('/api/bookings/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('should paginate bookings correctly', async () => {
      const response = await request(app)
        .get('/api/bookings/me?page=1&limit=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(1);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
    });
  });

  describe('GET /api/bookings/:id', () => {
    let booking;

    beforeEach(async () => {
      // Create a test booking
      booking = await prisma.booking.create({
        data: {
          studentId: student.id,
          consultantType: 'CAREER_GUIDANCE',
          details: 'Test booking details',
          amount: 150000,
          status: 'PENDING'
        }
      });
    });

    it('should get specific booking', async () => {
      const response = await request(app)
        .get(`/api/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking.id).toBe(booking.id);
      expect(response.body.data.booking.consultantType).toBe('CAREER_GUIDANCE');
    });

    it('should fail to get non-existent booking', async () => {
      const response = await request(app)
        .get('/api/bookings/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should fail to get booking of another student', async () => {
      // Create another student and booking
      const anotherStudent = await prisma.student.create({
        data: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '9876543211',
          password: 'Password123'
        }
      });

      const anotherBooking = await prisma.booking.create({
        data: {
          studentId: anotherStudent.id,
          consultantType: 'CAREER_GUIDANCE',
          details: 'Another student booking',
          amount: 150000,
          status: 'PENDING'
        }
      });

      const response = await request(app)
        .get(`/api/bookings/${anotherBooking.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
