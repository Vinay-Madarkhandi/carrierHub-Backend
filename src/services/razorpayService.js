import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createOrder = async (amount, currency = 'INR', receipt) => {
  try {
    const options = {
      amount: amount, // amount in paise
      currency: currency,
      receipt: receipt.toString(),
      payment_capture: 1 // Auto capture payment
    };

    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    throw new Error('Failed to create Razorpay order');
  }
};

export const verifyPayment = (razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
  try {
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;
    return isAuthentic;
  } catch (error) {
    console.error('Payment verification error:', error);
    return false;
  }
};

export const verifyWebhookSignature = (body, signature) => {
  try {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      console.error('RAZORPAY_WEBHOOK_SECRET is not configured');
      return false;
    }

    if (!signature) {
      console.error('No signature provided for webhook verification');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === signature;
    
    if (!isValid) {
      console.error('Webhook signature mismatch:', {
        expected: expectedSignature,
        received: signature
      });
    }

    return isValid;
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
};

export const getRazorpayKeyId = () => {
  return process.env.RAZORPAY_KEY_ID;
};

export default razorpay;
