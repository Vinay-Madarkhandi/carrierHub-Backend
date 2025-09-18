import express from "express";
import { authenticateStudent } from "../middlewares/auth.js";
import {
  validatePaymentCreation,
  validatePaymentVerification,
} from "../utils/validators.js";
import {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
} from "../controllers/paymentController.js";
import { createOrder } from "../services/razorpayService.js";
import prisma from "../prismaClient.js";

const router = express.Router();

// Middleware to capture raw body for webhook signature verification
const captureRawBody = (req, res, next) => {
  let data = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => {
    data += chunk;
  });
  req.on("end", () => {
    req.rawBody = data;
    try {
      req.body = JSON.parse(data);
    } catch (error) {
      console.error("Error parsing webhook JSON:", error);
      return res.status(400).json({ error: "Invalid JSON" });
    }
    next();
  });
};

// Webhook endpoint (no authentication required)
router.post("/webhook", captureRawBody, handleWebhook);

// Public endpoint to get Razorpay key ID (no authentication required)
router.get("/key", (req, res) => {
  res.json({
    success: true,
    data: {
      keyId: process.env.RAZORPAY_KEY_ID,
    },
  });
});

// Public web payment endpoint (uses temporary token for authentication)
router.get("/web-payment", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
            <h2 style="color: #d32f2f;">Payment Error</h2>
            <p>Invalid payment session. Please try again from the app.</p>
            <a href="carrierhub://dashboard" style="color: #1976d2; text-decoration: none;">Return to App</a>
          </body>
        </html>
      `);
    }

    // Decode and validate token
    let tokenData;
    try {
      tokenData = JSON.parse(Buffer.from(token, "base64").toString());
    } catch (error) {
      throw new Error("Invalid token format");
    }

    // Check token expiration
    if (Date.now() > tokenData.expires) {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
            <h2 style="color: #d32f2f;">Payment Session Expired</h2>
            <p>This payment session has expired. Please try again from the app.</p>
            <a href="carrierhub://dashboard" style="color: #1976d2; text-decoration: none;">Return to App</a>
          </body>
        </html>
      `);
    }

    const { bookingId, studentId } = tokenData;

    // Find booking and verify ownership
    const booking = await prisma.booking.findFirst({
      where: {
        id: parseInt(bookingId),
        studentId: parseInt(studentId),
      },
      include: {
        student: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
            <h2 style="color: #d32f2f;">Payment Error</h2>
            <p>Booking not found or access denied</p>
            <a href="carrierhub://dashboard" style="color: #1976d2; text-decoration: none;">Return to App</a>
          </body>
        </html>
      `);
    }

    // Create Razorpay order if not exists
    let orderId = booking.razorpayOrderId;
    if (!orderId) {
      const order = await createOrder(booking.amount, "INR", bookingId, {
        bookingId: booking.id,
        studentId: booking.studentId,
        student_name: booking.student.name,
        student_email: booking.student.email,
      });

      await prisma.booking.update({
        where: { id: booking.id },
        data: { razorpayOrderId: order.id },
      });

      orderId = order.id;
    }

    // Generate payment HTML page
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>CarrierHub Payment</title>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
          .container { max-width: 400px; margin: 0 auto; }
          .btn { background: #1976d2; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
          .btn:hover { background: #1565c0; }
          .info { background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>CarrierHub Payment</h2>
          <div class="info">
            <p><strong>Amount:</strong> ₹${booking.amount / 100}</p>
            <p><strong>Booking ID:</strong> ${bookingId}</p>
            <p><strong>Name:</strong> ${booking.student.name}</p>
          </div>
          <button class="btn" id="pay-btn" onclick="startPayment()">Pay Now</button>
          <br><br>
          <a href="carrierhub://dashboard">Return to App</a>
        </div>

        <script>
          function startPayment() {
            console.log('Pay Now button clicked');
            
            // Check if Razorpay is loaded
            if (typeof Razorpay === 'undefined') {
              alert('Razorpay not loaded. Please refresh the page and try again.');
              return;
            }
            
            // Check environment variables
            console.log('Razorpay Key:', "${process.env.RAZORPAY_KEY_ID}");
            console.log('Amount:', ${booking.amount});
            console.log('Order ID:', "${orderId}");
            
            var options = {
              "key": "${process.env.RAZORPAY_KEY_ID}",
              "amount": ${booking.amount},
              "currency": "INR",
              "name": "CarrierHub",
              "description": "Consultation Booking Payment",
              "order_id": "${orderId}",
              "prefill": {
                "name": "${booking.student.name}",
                "email": "${booking.student.email}"
              },
              "handler": function (response) {
                console.log('Payment successful:', response);
                // Payment success - redirect back to app
                window.location.href = "carrierhub://payment-success?paymentId=" + response.razorpay_payment_id + "&orderId=" + response.razorpay_order_id + "&signature=" + response.razorpay_signature + "&bookingId=${bookingId}";
              },
              "modal": {
                "ondismiss": function() {
                  console.log('Payment cancelled by user');
                  // Payment cancelled - redirect back to app
                  window.location.href = "carrierhub://payment-cancelled";
                }
              }
            };
            
            console.log('Creating Razorpay instance with options:', options);
            
            try {
              var rzp = new Razorpay(options);
              console.log('Razorpay instance created, opening payment modal...');
              rzp.open();
            } catch (error) {
              console.error('Error creating/opening Razorpay:', error);
              alert('Error opening payment: ' + error.message);
            }
          }

          // Remove auto-start and add page load check
          window.onload = function() {
            console.log('Page loaded');
            console.log('Razorpay available:', typeof Razorpay !== 'undefined');
            if (typeof Razorpay === 'undefined') {
              document.getElementById('pay-btn').innerHTML = 'Loading payment system...';
              setTimeout(function() {
                if (typeof Razorpay === 'undefined') {
                  document.getElementById('pay-btn').innerHTML = 'Payment system failed to load - Refresh page';
                } else {
                  document.getElementById('pay-btn').innerHTML = 'Pay Now';
                }
              }, 3000);
            }
          };
        </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error("Web payment error:", error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2 style="color: #d32f2f;">Payment Error</h2>
          <p>An error occurred processing your payment</p>
          <a href="carrierhub://dashboard" style="color: #1976d2; text-decoration: none;">Return to App</a>
        </body>
      </html>
    `);
  }
});

// Student payment routes (require authentication)
router.use(authenticateStudent);

// Create payment session with temporary token
router.post("/create-payment-session", async (req, res) => {
  try {
    const { bookingId } = req.body;
    const studentId = req.student.id;

    // Verify booking ownership
    const booking = await prisma.booking.findFirst({
      where: {
        id: parseInt(bookingId),
        studentId,
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Generate a temporary payment token (valid for 15 minutes)
    const paymentToken = Buffer.from(
      JSON.stringify({
        bookingId,
        studentId,
        timestamp: Date.now(),
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      })
    ).toString("base64");

    res.json({
      success: true,
      data: {
        paymentToken,
        paymentUrl: `/api/payments/web-payment?token=${paymentToken}`,
      },
    });
  } catch (error) {
    console.error("Create payment session error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment session",
    });
  }
});

// Create payment order
router.post("/create", validatePaymentCreation, createPaymentOrder);

// Verify payment
router.post("/verify", validatePaymentVerification, verifyPayment);

export default router;
