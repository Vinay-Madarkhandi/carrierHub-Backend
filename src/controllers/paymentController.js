import prisma from '../prismaClient.js';
import { createOrder, verifyPayment as verifyPaymentSignature, verifyWebhookSignature, getRazorpayKeyId } from '../services/razorpayService.js';

export const createPaymentOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const studentId = req.student.id;

    // Find booking and verify ownership
    const booking = await prisma.booking.findFirst({
      where: {
        id: parseInt(bookingId),
        studentId
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
        error: 'NOT_FOUND'
      });
    }

    // Check if booking is in valid state for payment
    if (booking.status !== 'PENDING' && booking.status !== 'FAILED') {
      return res.status(400).json({
        success: false,
        message: 'Booking is not in a valid state for payment',
        error: 'INVALID_BOOKING_STATUS'
      });
    }

    // Create Razorpay order
    const order = await createOrder(booking.amount, booking.currency, bookingId);

    // Update booking with Razorpay order ID
    await prisma.booking.update({
      where: { id: booking.id },
      data: { razorpayOrderId: order.id }
    });

    res.json({
      success: true,
      message: 'Payment order created successfully',
      data: {
        orderId: order.id,
        amount: booking.amount,
        currency: booking.currency,
        keyId: getRazorpayKeyId()
      }
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, bookingId } = req.body;
    const studentId = req.student.id;

    // Find booking and verify ownership
    const booking = await prisma.booking.findFirst({
      where: {
        id: parseInt(bookingId),
        studentId
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
        error: 'NOT_FOUND'
      });
    }

    // Verify payment signature
    const isSignatureValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (!isSignatureValid) {
      // Mark booking as failed
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'FAILED' }
      });

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        error: 'INVALID_SIGNATURE'
      });
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpaySignature: razorpay_signature,
        amount: booking.amount,
        currency: booking.currency,
        status: 'SUCCESS'
      }
    });

    // Update booking status
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'SUCCESS' }
    });

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: { payment }
    });
  } catch (error) {
    next(error);
  }
};

export const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);

    // Verify webhook signature
    const isSignatureValid = verifyWebhookSignature(body, signature);

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature',
        error: 'INVALID_SIGNATURE'
      });
    }

    const { event, payload } = req.body;

    // Handle different webhook events
    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload.payment.entity);
        break;
      case 'payment.failed':
        await handlePaymentFailed(payload.payment.entity);
        break;
      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    res.json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: 'WEBHOOK_ERROR'
    });
  }
};

// Helper functions for webhook handling
const handlePaymentCaptured = async (paymentEntity) => {
  try {
    const { order_id, id: payment_id, amount, currency, status } = paymentEntity;

    // Find booking by Razorpay order ID
    const booking = await prisma.booking.findFirst({
      where: { razorpayOrderId: order_id }
    });

    if (!booking) {
      console.error(`Booking not found for order ID: ${order_id}`);
      return;
    }

    // Check if payment already exists (idempotency)
    const existingPayment = await prisma.payment.findFirst({
      where: { razorpayPaymentId: payment_id }
    });

    if (existingPayment) {
      console.log(`Payment already processed: ${payment_id}`);
      return;
    }

    // Create payment record
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        razorpayPaymentId: payment_id,
        razorpayOrderId: order_id,
        razorpaySignature: '', // Not available in webhook
        amount: amount,
        currency: currency,
        status: 'SUCCESS'
      }
    });

    // Update booking status
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'SUCCESS' }
    });

    console.log(`Payment captured for booking ${booking.id}`);
  } catch (error) {
    console.error('Error handling payment captured:', error);
  }
};

const handlePaymentFailed = async (paymentEntity) => {
  try {
    const { order_id } = paymentEntity;

    // Find booking by Razorpay order ID
    const booking = await prisma.booking.findFirst({
      where: { razorpayOrderId: order_id }
    });

    if (!booking) {
      console.error(`Booking not found for order ID: ${order_id}`);
      return;
    }

    // Update booking status to failed
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'FAILED' }
    });

    console.log(`Payment failed for booking ${booking.id}`);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
};
