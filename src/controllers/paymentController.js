import crypto from "crypto";
import prisma from "../prismaClient.js";
import { PaymentStatus, BookingStatus } from "@prisma/client";
import {
  createOrder,
  verifyPayment as verifyPaymentSignature,
  verifyWebhookSignature,
  getRazorpayKeyId,
} from "../services/razorpayService.js";

export const createPaymentOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const studentId = req.student.id;

    console.log("Creating payment order:", { bookingId, studentId });

    // Find booking and verify ownership
    const booking = await prisma.booking.findFirst({
      where: {
        id: parseInt(bookingId),
        studentId,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!booking) {
      console.error("Booking not found:", { bookingId, studentId });
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        error: "NOT_FOUND",
      });
    }

    // Check if booking is in valid state for payment
    if (booking.status !== "PENDING" && booking.status !== "FAILED") {
      console.warn("Invalid booking status for payment:", {
        bookingId: booking.id,
        currentStatus: booking.status,
      });
      return res.status(400).json({
        success: false,
        message: `Booking is not in a valid state for payment. Current status: ${booking.status}`,
        error: "INVALID_BOOKING_STATUS",
      });
    }

    // Check if order already exists and is valid
    if (booking.razorpayOrderId) {
      console.log("Existing Razorpay order found:", booking.razorpayOrderId);
      return res.json({
        success: true,
        message: "Payment order already exists",
        data: {
          orderId: booking.razorpayOrderId,
          amount: booking.amount,
          currency: booking.currency,
          keyId: getRazorpayKeyId(),
        },
      });
    }

    // Create Razorpay order with metadata
    const orderMetadata = {
      bookingId: booking.id,
      studentId: booking.studentId,
      additionalNotes: {
        student_name: booking.student.name,
        student_email: booking.student.email,
        consultant_type: booking.consultantType,
        booking_created: booking.createdAt.toISOString(),
      },
    };

    const order = await createOrder(
      booking.amount,
      booking.currency,
      bookingId,
      orderMetadata
    );

    // Update booking with Razorpay order ID
    await prisma.booking.update({
      where: { id: booking.id },
      data: { razorpayOrderId: order.id },
    });

    console.log("Payment order created successfully:", {
      orderId: order.id,
      bookingId: booking.id,
      amount: booking.amount,
    });

    res.json({
      success: true,
      message: "Payment order created successfully",
      data: {
        orderId: order.id,
        amount: booking.amount,
        currency: booking.currency,
        keyId: getRazorpayKeyId(),
      },
    });
  } catch (error) {
    console.error("Payment order creation error:", {
      error: error.message,
      bookingId: req.body.bookingId,
      studentId: req.student?.id,
    });
    next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      bookingId,
    } = req.body;
    const studentId = req.student.id;

    console.log("Payment verification request:", {
      bookingId,
      studentId,
      razorpay_order_id,
      razorpay_payment_id: razorpay_payment_id ? "present" : "missing",
      razorpay_signature: razorpay_signature ? "present" : "missing",
    });

    // Find booking and verify ownership
    const booking = await prisma.booking.findFirst({
      where: {
        id: parseInt(bookingId),
        studentId,
      },
    });

    if (!booking) {
      console.error("Booking not found:", { bookingId, studentId });
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        error: "NOT_FOUND",
      });
    }

    // Check if payment already exists (prevent duplicate processing)
    const existingPayment = await prisma.payment.findFirst({
      where: { razorpayPaymentId: razorpay_payment_id },
    });

    if (existingPayment) {
      console.log("Payment already processed:", razorpay_payment_id);
      return res.json({
        success: true,
        message: "Payment already verified",
        data: { payment: existingPayment },
      });
    }

    // Verify payment signature using direct crypto validation
    const sha = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = sha.digest("hex");
    const isSignatureValid = digest === razorpay_signature;

    if (!isSignatureValid) {
      console.error("Payment signature verification failed:", {
        razorpay_order_id,
        razorpay_payment_id,
        bookingId,
        expected: digest,
        received: razorpay_signature,
      });

      // Mark booking as failed with explicit Prisma enum
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.FAILED }, // Use imported Prisma enum
      });

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
        error: "INVALID_SIGNATURE",
      });
    }

    // Create payment record with explicit Prisma enum
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpaySignature: razorpay_signature,
        amount: booking.amount,
        currency: booking.currency,
        status: PaymentStatus.SUCCESS, // Use imported Prisma enum
      },
    });

    // Update booking status with explicit Prisma enum
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.SUCCESS }, // Use imported Prisma enum
    });

    console.log("Payment verified successfully:", {
      paymentId: payment.id,
      bookingId: booking.id,
      amount: booking.amount,
    });

    res.json({
      success: true,
      message: "Payment verified successfully",
      data: { payment },
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    next(error);
  }
};

export const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const body = req.rawBody; // Use raw body for signature verification

    console.log("Webhook received:", {
      event: req.body?.event,
      signature: signature ? "present" : "missing",
      bodyLength: body ? body.length : 0,
      timestamp: new Date().toISOString(),
    });

    // Verify webhook signature
    const isSignatureValid = verifyWebhookSignature(body, signature);

    if (!isSignatureValid) {
      console.error("Webhook signature validation failed");
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
        error: "INVALID_SIGNATURE",
      });
    }

    const { event, payload } = req.body;

    // Check for required payload structure
    if (!event || !payload) {
      console.error("Invalid webhook payload structure");
      return res.status(400).json({
        success: false,
        message: "Invalid webhook payload",
        error: "INVALID_PAYLOAD",
      });
    }

    console.log(`Processing webhook event: ${event}`, {
      eventId: payload.payment?.entity?.id || payload.refund?.entity?.id,
      orderId:
        payload.payment?.entity?.order_id || payload.refund?.entity?.payment_id,
    });

    // Handle different webhook events with idempotency
    let result = { success: true, message: "Event processed" };

    switch (event) {
      case "payment.captured":
        result = await handlePaymentCaptured(payload.payment.entity);
        break;
      case "payment.failed":
        result = await handlePaymentFailed(payload.payment.entity);
        break;
      case "payment.authorized":
        result = await handlePaymentAuthorized(payload.payment.entity);
        break;
      case "refund.processed":
        result = await handleRefundProcessed(payload.refund.entity);
        break;
      default:
        console.log(`Unhandled webhook event: ${event}`);
        result = {
          success: true,
          message: `Event ${event} acknowledged but not processed`,
        };
    }

    console.log(`Webhook event ${event} processing completed:`, result);
    res.json(result);
  } catch (error) {
    console.error("Webhook processing error:", {
      error: error.message,
      stack: error.stack,
      event: req.body?.event,
    });
    res.status(500).json({
      success: false,
      message: "Webhook processing failed",
      error: "WEBHOOK_ERROR",
    });
  }
};

// Helper functions for webhook handling with idempotency
const handlePaymentCaptured = async (paymentEntity) => {
  try {
    const {
      order_id,
      id: payment_id,
      amount,
      currency,
      status,
    } = paymentEntity;

    console.log("Processing payment.captured:", {
      orderId: order_id,
      paymentId: payment_id,
      amount,
      status,
    });

    // Find booking by Razorpay order ID
    const booking = await prisma.booking.findFirst({
      where: { razorpayOrderId: order_id },
    });

    if (!booking) {
      console.error(`Booking not found for order ID: ${order_id}`);
      return { success: false, message: "Booking not found" };
    }

    // Check if payment already exists (idempotency)
    const existingPayment = await prisma.payment.findFirst({
      where: { razorpayPaymentId: payment_id },
    });

    if (existingPayment) {
      console.log(`Payment already processed: ${payment_id}`);
      return { success: true, message: "Payment already processed" };
    }

    // Verify amounts match
    if (booking.amount !== amount) {
      console.error("Amount mismatch:", {
        bookingAmount: booking.amount,
        paymentAmount: amount,
        orderId: order_id,
      });
      return { success: false, message: "Amount mismatch detected" };
    }

    // Create payment record
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        razorpayPaymentId: payment_id,
        razorpayOrderId: order_id,
        razorpaySignature: "", // Not available in webhook
        amount: amount,
        currency: currency,
        status: PaymentStatus.SUCCESS, // Use imported Prisma enum
      },
    });

    // Update booking status with explicit Prisma enum
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.SUCCESS }, // Use imported Prisma enum
    });

    console.log(`Payment captured successfully for booking ${booking.id}`);
    return { success: true, message: "Payment processed successfully" };
  } catch (error) {
    console.error("Error handling payment captured:", {
      error: error.message,
      paymentId: paymentEntity.id,
      orderId: paymentEntity.order_id,
    });
    return { success: false, message: "Failed to process payment capture" };
  }
};

const handlePaymentFailed = async (paymentEntity) => {
  try {
    const { order_id, id: payment_id } = paymentEntity;

    console.log("Processing payment.failed:", {
      orderId: order_id,
      paymentId: payment_id,
    });

    // Find booking by Razorpay order ID
    const booking = await prisma.booking.findFirst({
      where: { razorpayOrderId: order_id },
    });

    if (!booking) {
      console.error(`Booking not found for order ID: ${order_id}`);
      return { success: false, message: "Booking not found" };
    }

    // Update booking status to failed (idempotent operation)
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.FAILED }, // Use imported Prisma enum
    });

    console.log(`Payment failed for booking ${booking.id}`);
    return { success: true, message: "Payment failure processed" };
  } catch (error) {
    console.error("Error handling payment failed:", {
      error: error.message,
      paymentId: paymentEntity.id,
      orderId: paymentEntity.order_id,
    });
    return { success: false, message: "Failed to process payment failure" };
  }
};

const handlePaymentAuthorized = async (paymentEntity) => {
  try {
    const { order_id, id: payment_id } = paymentEntity;

    console.log("Processing payment.authorized:", {
      orderId: order_id,
      paymentId: payment_id,
    });

    // Find booking by Razorpay order ID
    const booking = await prisma.booking.findFirst({
      where: { razorpayOrderId: order_id },
    });

    if (!booking) {
      console.error(`Booking not found for order ID: ${order_id}`);
      return { success: false, message: "Booking not found" };
    }

    // Update booking status to processing
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "PROCESSING" },
    });

    console.log(`Payment authorized for booking ${booking.id}`);
    return { success: true, message: "Payment authorization processed" };
  } catch (error) {
    console.error("Error handling payment authorized:", {
      error: error.message,
      paymentId: paymentEntity.id,
      orderId: paymentEntity.order_id,
    });
    return {
      success: false,
      message: "Failed to process payment authorization",
    };
  }
};

const handleRefundProcessed = async (refundEntity) => {
  try {
    const { payment_id, id: refund_id, amount, status } = refundEntity;

    console.log("Processing refund.processed:", {
      paymentId: payment_id,
      refundId: refund_id,
      amount,
      status,
    });

    // Find payment by Razorpay payment ID
    const payment = await prisma.payment.findFirst({
      where: { razorpayPaymentId: payment_id },
      include: { booking: true },
    });

    if (!payment) {
      console.error(`Payment not found for payment ID: ${payment_id}`);
      return { success: false, message: "Payment not found" };
    }

    // Update payment status to refunded
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "REFUNDED" },
    });

    // Update booking status to failed
    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: BookingStatus.FAILED }, // Use imported Prisma enum
    });

    console.log(
      `Refund processed for payment ${payment.id}, booking ${payment.bookingId}`
    );
    return { success: true, message: "Refund processed successfully" };
  } catch (error) {
    console.error("Error handling refund processed:", {
      error: error.message,
      refundId: refundEntity.id,
      paymentId: refundEntity.payment_id,
    });
    return { success: false, message: "Failed to process refund" };
  }
};
