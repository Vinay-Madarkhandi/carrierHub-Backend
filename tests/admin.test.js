import request from 'supertest';
import app from '../src/index.js';
import { prisma } from './setup.js';
import bcrypt from 'bcryptjs';

describe('Admin', () => {
  let admin;
  let token;
  let student;
  let booking;

  beforeEach(async () => {
    // Create a test admin and get token
    const hashedPassword = await bcrypt.hash('AdminPassword123', 12);
    admin = await prisma.admin.create({
      data: {
        name: 'Admin User',
        email: 'admin@example.com',
        password: hashedPassword
      }
    });

    // Login to get admin token
    const loginResponse = await request(app)
      .post('/api/auth/admin/login')
      .send({
        email: 'admin@example.com',
        password: 'AdminPassword123'
      });

    token = loginResponse.body.data.token;

    // Create a test student and booking
    const studentPassword = await bcrypt.hash('Password123', 12);
    student = await prisma.student.create({
      data: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        password: studentPassword
      }
    });

    booking = await prisma.booking.create({
      data: {
        studentId: student.id,
        consultantType: 'CAREER_GUIDANCE',
        details: 'Test booking for admin',
        amount: 150000,
        status: 'PENDING'
      }
    });
  });

  describe('GET /api/admin/bookings', () => {
    it('should get all bookings', async () => {
      const response = await request(app)
        .get('/api/admin/bookings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(1);
      expect(response.body.data.bookings[0].id).toBe(booking.id);
    });

    it('should filter bookings by status', async () => {
      const response = await request(app)
        .get('/api/admin/bookings?status=PENDING')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(1);
      expect(response.body.data.bookings[0].status).toBe('PENDING');
    });

    it('should filter bookings by consultant type', async () => {
      const response = await request(app)
        .get('/api/admin/bookings?consultantType=CAREER_GUIDANCE')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(1);
      expect(response.body.data.bookings[0].consultantType).toBe('CAREER_GUIDANCE');
    });

    it('should paginate bookings correctly', async () => {
      // Create more bookings
      await prisma.booking.createMany({
        data: [
          {
            studentId: student.id,
            consultantType: 'STUDY_ABROAD',
            details: 'Second booking',
            amount: 200000,
            status: 'SUCCESS'
          },
          {
            studentId: student.id,
            consultantType: 'EXAM_PREPARATION',
            details: 'Third booking',
            amount: 100000,
            status: 'COMPLETED'
          }
        ]
      });

      const response = await request(app)
        .get('/api/admin/bookings?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(3);
      expect(response.body.data.pagination.pages).toBe(2);
    });

    it('should fail without admin authentication', async () => {
      const response = await request(app)
        .get('/api/admin/bookings')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/admin/bookings/:id/status', () => {
    it('should update booking status successfully', async () => {
      const response = await request(app)
        .patch(`/api/admin/bookings/${booking.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'PROCESSING' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking.status).toBe('PROCESSING');

      // Verify status was updated in database
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id }
      });
      expect(updatedBooking.status).toBe('PROCESSING');
    });

    it('should fail with invalid status', async () => {
      const response = await request(app)
        .patch(`/api/admin/bookings/${booking.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should fail with non-existent booking', async () => {
      const response = await request(app)
        .patch('/api/admin/bookings/99999/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'PROCESSING' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/bookings/export', () => {
    it('should export bookings as CSV', async () => {
      const response = await request(app)
        .get('/api/admin/bookings/export')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('Booking ID');
      expect(response.text).toContain(booking.id.toString());
    });

    it('should export filtered bookings as CSV', async () => {
      const response = await request(app)
        .get('/api/admin/bookings/export?status=PENDING')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toContain(booking.id.toString());
    });
  });

  describe('GET /api/admin/dashboard/stats', () => {
    beforeEach(async () => {
      // Create more test data
      await prisma.booking.createMany({
        data: [
          {
            studentId: student.id,
            consultantType: 'STUDY_ABROAD',
            details: 'Second booking',
            amount: 200000,
            status: 'SUCCESS'
          },
          {
            studentId: student.id,
            consultantType: 'EXAM_PREPARATION',
            details: 'Third booking',
            amount: 100000,
            status: 'COMPLETED'
          }
        ]
      });

      // Create payment for SUCCESS booking
      const successBooking = await prisma.booking.findFirst({
        where: { status: 'SUCCESS' }
      });

      await prisma.payment.create({
        data: {
          bookingId: successBooking.id,
          razorpayPaymentId: 'pay_test_123',
          razorpayOrderId: 'order_test_123',
          razorpaySignature: 'sig_test_123',
          amount: successBooking.amount,
          currency: 'INR',
          status: 'SUCCESS'
        }
      });
    });

    it('should get dashboard statistics', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalBookings).toBe(3);
      expect(response.body.data.pendingBookings).toBe(1);
      expect(response.body.data.successBookings).toBe(1);
      expect(response.body.data.completedBookings).toBe(1);
      expect(response.body.data.totalRevenue).toBe(200000); // Only SUCCESS booking amount
      expect(response.body.data.categoryStats).toBeDefined();
    });
  });
});
