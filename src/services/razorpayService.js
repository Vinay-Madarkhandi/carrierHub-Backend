import Razorpay from "razorpay";
import crypto from "crypto";

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createOrder = async (
  amount,
  currency = "INR",
  receipt,
  metadata = {}
) => {
  try {
    // Ensure amount is in paise (smallest currency unit)
    const amountInPaise = Math.round(amount);

    const options = {
      amount: amountInPaise, // amount in paise (₹1 = 100 paise)
      currency: currency.toUpperCase(),
      receipt: receipt.toString(),
      payment_capture: 1, // Auto capture payment
      notes: {
        booking_id: metadata.bookingId || receipt,
        student_id: metadata.studentId || "",
        created_at: new Date().toISOString(),
        ...metadata.additionalNotes,
      },
    };

    console.log("Creating Razorpay order:", {
      amount: amountInPaise,
      currency: currency.toUpperCase(),
      receipt: receipt.toString(),
      notes: options.notes,
    });

    const order = await razorpay.orders.create(options);

    console.log("Razorpay order created successfully:", {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
    });

    return order;
  } catch (error) {
    console.error("Razorpay order creation error:", {
      error: error.message,
      code: error.code,
      description: error.description,
      amount,
      currency,
      receipt,
    });
    throw new Error(
      `Failed to create Razorpay order: ${error.description || error.message}`
    );
  }
};

// Constant-time string comparison to prevent timing attacks
const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
};

export const verifyPayment = (
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature
) => {
  try {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.error("Payment verification failed: Missing required parameters");
      return false;
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = timingSafeEqual(expectedSignature, razorpay_signature);

    console.log("Payment signature verification:", {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      isValid: isAuthentic,
      expectedLength: expectedSignature.length,
      receivedLength: razorpay_signature.length,
    });

    return isAuthentic;
  } catch (error) {
    console.error("Payment verification error:", {
      error: error.message,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });
    return false;
  }
};

export const verifyWebhookSignature = (body, signature) => {
  try {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      console.error("RAZORPAY_WEBHOOK_SECRET is not configured");
      return false;
    }

    if (!signature) {
      console.error("No signature provided for webhook verification");
      return false;
    }

    // Ensure body is string for signature verification
    const bodyString = typeof body === "string" ? body : JSON.stringify(body);

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(bodyString)
      .digest("hex");

    const isValid = timingSafeEqual(expectedSignature, signature);

    console.log("Webhook signature verification:", {
      isValid,
      bodyLength: bodyString.length,
      expectedLength: expectedSignature.length,
      receivedLength: signature.length,
    });

    if (!isValid) {
      console.error("Webhook signature mismatch");
    }

    return isValid;
  } catch (error) {
    console.error("Webhook signature verification error:", {
      error: error.message,
      hasBody: !!body,
      hasSignature: !!signature,
    });
    return false;
  }
};

export const getRazorpayKeyId = () => {
  return process.env.RAZORPAY_KEY_ID;
};

export default razorpay;
