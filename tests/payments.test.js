import request from 'supertest';
import app from '../src/index.js';
import { prisma } from './setup.js';
import bcrypt from 'bcryptjs';

// Mock Razorpay service
jest.mock('../src/services/razorpayService.js', () => ({
  createOrder: jest.fn().mockResolvedValue({
    id: 'order_test_123',
    amount: 150000,
    currency: 'INR'
  }),
  verifyPayment: jest.fn().mockReturnValue(true),
  getRazorpayKeyId: jest.fn().mockReturnValue('rzp_test_123')
}));

describe('Payments', () => {
  let student;
  let token;
  let booking;

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

    // Create a test booking
    booking = await prisma.booking.create({
      data: {
        studentId: student.id,
        consultantType: 'CAREER_GUIDANCE',
        details: 'Test booking for payment',
        amount: 150000,
        status: 'PENDING'
      }
    });
  });

  describe('POST /api/payments/create', () => {
    it('should create payment order successfully', async () => {
      const response = await request(app)
        .post('/api/payments/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: booking.id })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orderId).toBe('order_test_123');
      expect(response.body.data.amount).toBe(150000);
      expect(response.body.data.keyId).toBe('rzp_test_123');

      // Verify booking was updated with order ID
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id }
      });
      expect(updatedBooking.razorpayOrderId).toBe('order_test_123');
    });

    it('should fail with non-existent booking', async () => {
      const response = await request(app)
        .post('/api/payments/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: 99999 })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should fail with booking not owned by student', async () => {
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
        .post('/api/payments/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: anotherBooking.id })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should fail with booking not in valid status', async () => {
      // Update booking to SUCCESS status
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'SUCCESS' }
      });

      const response = await request(app)
        .post('/api/payments/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: booking.id })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/verify', () => {
    beforeEach(async () => {
      // Update booking with order ID
      await prisma.booking.update({
        where: { id: booking.id },
        data: { razorpayOrderId: 'order_test_123' }
      });
    });

    it('should verify payment successfully', async () => {
      const paymentData = {
        razorpay_payment_id: 'pay_test_123',
        razorpay_order_id: 'order_test_123',
        razorpay_signature: 'sig_test_123',
        bookingId: booking.id
      };

      const response = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(paymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment.razorpayPaymentId).toBe('pay_test_123');

      // Verify payment was created in database
      const payment = await prisma.payment.findFirst({
        where: { bookingId: booking.id }
      });
      expect(payment).toBeTruthy();
      expect(payment.razorpayPaymentId).toBe('pay_test_123');

      // Verify booking status was updated
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id }
      });
      expect(updatedBooking.status).toBe('SUCCESS');
    });

    it('should fail with invalid signature', async () => {
      // Mock invalid signature
      const { verifyPayment } = require('../src/services/razorpayService.js');
      verifyPayment.mockReturnValue(false);

      const paymentData = {
        razorpay_payment_id: 'pay_test_123',
        razorpay_order_id: 'order_test_123',
        razorpay_signature: 'invalid_sig',
        bookingId: booking.id
      };

      const response = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(paymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INVALID_SIGNATURE');

      // Verify booking status was updated to FAILED
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id }
      });
      expect(updatedBooking.status).toBe('FAILED');
    });

    it('should fail with non-existent booking', async () => {
      const paymentData = {
        razorpay_payment_id: 'pay_test_123',
        razorpay_order_id: 'order_test_123',
        razorpay_signature: 'sig_test_123',
        bookingId: 99999
      };

      const response = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(paymentData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/webhook', () => {
    it('should handle payment captured webhook', async () => {
      // Mock webhook signature verification
      const { verifyWebhookSignature } = require('../src/services/razorpayService.js');
      verifyWebhookSignature.mockReturnValue(true);

      const webhookData = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_webhook_123',
              order_id: 'order_test_123',
              amount: 150000,
              currency: 'INR',
              status: 'captured'
            }
          }
        }
      };

      // Update booking with order ID
      await prisma.booking.update({
        where: { id: booking.id },
        data: { razorpayOrderId: 'order_test_123' }
      });

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify payment was created
      const payment = await prisma.payment.findFirst({
        where: { razorpayPaymentId: 'pay_webhook_123' }
      });
      expect(payment).toBeTruthy();

      // Verify booking status was updated
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id }
      });
      expect(updatedBooking.status).toBe('SUCCESS');
    });

    it('should handle payment failed webhook', async () => {
      // Mock webhook signature verification
      const { verifyWebhookSignature } = require('../src/services/razorpayService.js');
      verifyWebhookSignature.mockReturnValue(true);

      const webhookData = {
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_failed_123',
              order_id: 'order_test_123'
            }
          }
        }
      };

      // Update booking with order ID
      await prisma.booking.update({
        where: { id: booking.id },
        data: { razorpayOrderId: 'order_test_123' }
      });

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify booking status was updated to FAILED
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id }
      });
      expect(updatedBooking.status).toBe('FAILED');
    });

    it('should fail with invalid webhook signature', async () => {
      // Mock invalid webhook signature
      const { verifyWebhookSignature } = require('../src/services/razorpayService.js');
      verifyWebhookSignature.mockReturnValue(false);

      const webhookData = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_webhook_123',
              order_id: 'order_test_123',
              amount: 150000,
              currency: 'INR',
              status: 'captured'
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-razorpay-signature', 'invalid_signature')
        .send(webhookData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INVALID_SIGNATURE');
    });
  });
});
