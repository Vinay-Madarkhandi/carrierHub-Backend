import request from "supertest";
import app from "../src/index.js";
import { prisma } from "./setup.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  verifyPayment,
  verifyWebhookSignature,
  createOrder,
} from "../src/services/razorpayService.js";

// Mock Razorpay
jest.mock("razorpay");

describe("Enhanced Payment Tests", () => {
  let student;
  let token;
  let booking;

  beforeEach(async () => {
    // Create test student and get token
    const hashedPassword = await bcrypt.hash("Password123", 12);
    student = await prisma.student.create({
      data: {
        name: "John Doe",
        email: "john@example.com",
        phone: "9876543210",
        password: hashedPassword,
      },
    });

    // Login to get token
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "john@example.com",
      password: "Password123",
    });

    token = loginResponse.body.data.token;

    // Create test booking
    booking = await prisma.booking.create({
      data: {
        studentId: student.id,
        consultantType: "CAREER_GUIDANCE",
        details: "Test booking for payment",
        amount: 150000, // ₹1500 in paise
        currency: "INR",
      },
    });
  });

  describe("Order Creation", () => {
    it("should create order with correct amount in paise", async () => {
      const mockOrder = {
        id: "order_test123",
        amount: 150000,
        currency: "INR",
        status: "created",
      };

      // Mock Razorpay order creation
      const mockRazorpay = {
        orders: {
          create: jest.fn().mockResolvedValue(mockOrder),
        },
      };

      // Test direct service function
      const order = await createOrder(150000, "INR", booking.id, {
        bookingId: booking.id,
        studentId: student.id,
      });

      expect(order.amount).toBe(150000);
      expect(order.currency).toBe("INR");
    });

    it("should create payment order via API", async () => {
      const response = await request(app)
        .post("/api/payments/create")
        .set("Authorization", `Bearer ${token}`)
        .send({
          bookingId: booking.id,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        amount: 150000,
        currency: "INR",
      });
      expect(response.body.data.orderId).toBeDefined();
      expect(response.body.data.keyId).toBeDefined();
    });

    it("should fail for invalid booking state", async () => {
      // Update booking to SUCCESS state
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "SUCCESS" },
      });

      const response = await request(app)
        .post("/api/payments/create")
        .set("Authorization", `Bearer ${token}`)
        .send({
          bookingId: booking.id,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("INVALID_BOOKING_STATUS");
    });
  });

  describe("Signature Verification", () => {
    it("should verify valid payment signature", () => {
      const orderId = "order_test123";
      const paymentId = "pay_test456";
      const secret = "test_secret";

      // Set test secret
      process.env.RAZORPAY_KEY_SECRET = secret;

      const body = `${orderId}|${paymentId}`;
      const validSignature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");

      const result = verifyPayment(orderId, paymentId, validSignature);
      expect(result).toBe(true);
    });

    it("should reject tampered payment signature", () => {
      const orderId = "order_test123";
      const paymentId = "pay_test456";
      const secret = "test_secret";

      process.env.RAZORPAY_KEY_SECRET = secret;

      const body = `${orderId}|${paymentId}`;
      const validSignature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");

      // Tamper with signature
      const tamperedSignature = validSignature.slice(0, -1) + "x";

      const result = verifyPayment(orderId, paymentId, tamperedSignature);
      expect(result).toBe(false);
    });

    it("should reject signature with missing parameters", () => {
      const result1 = verifyPayment("", "pay_test456", "signature");
      const result2 = verifyPayment("order_test123", "", "signature");
      const result3 = verifyPayment("order_test123", "pay_test456", "");

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });
  });

  describe("Webhook Verification", () => {
    it("should verify valid webhook signature", () => {
      const webhookSecret = "webhook_secret";
      const body = JSON.stringify({ event: "payment.captured" });

      process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

      const validSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(body)
        .digest("hex");

      const result = verifyWebhookSignature(body, validSignature);
      expect(result).toBe(true);
    });

    it("should reject invalid webhook signature", () => {
      const webhookSecret = "webhook_secret";
      const body = JSON.stringify({ event: "payment.captured" });

      process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

      const invalidSignature = "invalid_signature";

      const result = verifyWebhookSignature(body, invalidSignature);
      expect(result).toBe(false);
    });
  });

  describe("Payment Verification API", () => {
    beforeEach(async () => {
      // Add razorpay order ID to booking
      await prisma.booking.update({
        where: { id: booking.id },
        data: { razorpayOrderId: "order_test123" },
      });
    });

    it("should verify valid payment", async () => {
      const orderId = "order_test123";
      const paymentId = "pay_test456";
      const secret = "test_secret";

      process.env.RAZORPAY_KEY_SECRET = secret;

      const body = `${orderId}|${paymentId}`;
      const signature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");

      const response = await request(app)
        .post("/api/payments/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          bookingId: booking.id,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment).toBeDefined();

      // Verify payment was created in database
      const payment = await prisma.payment.findFirst({
        where: { razorpayPaymentId: paymentId },
      });
      expect(payment).toBeTruthy();
      expect(payment.status).toBe("SUCCESS");

      // Verify booking status was updated
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(updatedBooking.status).toBe("SUCCESS");
    });

    it("should prevent duplicate payment processing", async () => {
      const orderId = "order_test123";
      const paymentId = "pay_test456";
      const secret = "test_secret";

      process.env.RAZORPAY_KEY_SECRET = secret;

      const body = `${orderId}|${paymentId}`;
      const signature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");

      // First verification
      await request(app)
        .post("/api/payments/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          bookingId: booking.id,
        })
        .expect(200);

      // Second verification should still succeed but not create duplicate
      const response = await request(app)
        .post("/api/payments/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          bookingId: booking.id,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("already verified");

      // Verify only one payment record exists
      const payments = await prisma.payment.findMany({
        where: { razorpayPaymentId: paymentId },
      });
      expect(payments).toHaveLength(1);
    });
  });

  describe("Webhook Processing", () => {
    it("should process payment.captured webhook with idempotency", async () => {
      // Create booking with razorpay order ID
      await prisma.booking.update({
        where: { id: booking.id },
        data: { razorpayOrderId: "order_test123" },
      });

      const webhookPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_test456",
              order_id: "order_test123",
              amount: 150000,
              currency: "INR",
              status: "captured",
            },
          },
        },
      };

      const webhookSecret = "webhook_secret";
      process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

      const body = JSON.stringify(webhookPayload);
      const signature = crypto
        .createHmac("sha256", webhookSecret)
        .update(body)
        .digest("hex");

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("x-razorpay-signature", signature)
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify payment was created
      const payment = await prisma.payment.findFirst({
        where: { razorpayPaymentId: "pay_test456" },
      });
      expect(payment).toBeTruthy();
      expect(payment.status).toBe("SUCCESS");

      // Verify booking status was updated
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(updatedBooking.status).toBe("SUCCESS");

      // Test idempotency - send same webhook again
      const response2 = await request(app)
        .post("/api/payments/webhook")
        .set("x-razorpay-signature", signature)
        .send(webhookPayload)
        .expect(200);

      expect(response2.body.success).toBe(true);
      expect(response2.body.message).toContain("already processed");

      // Verify still only one payment record
      const payments = await prisma.payment.findMany({
        where: { razorpayPaymentId: "pay_test456" },
      });
      expect(payments).toHaveLength(1);
    });

    it("should process payment.failed webhook", async () => {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { razorpayOrderId: "order_test123" },
      });

      const webhookPayload = {
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_test456",
              order_id: "order_test123",
              status: "failed",
            },
          },
        },
      };

      const webhookSecret = "webhook_secret";
      process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

      const body = JSON.stringify(webhookPayload);
      const signature = crypto
        .createHmac("sha256", webhookSecret)
        .update(body)
        .digest("hex");

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("x-razorpay-signature", signature)
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify booking status was updated to failed
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(updatedBooking.status).toBe("FAILED");
    });
  });
});
