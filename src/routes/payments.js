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
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container { 
            max-width: 400px; 
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            padding: 32px;
            text-align: center;
          }
          .logo {
            width: 60px;
            height: 60px;
            background: #2563eb;
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
          }
          h2 {
            color: #1f2937;
            margin: 0 0 8px 0;
            font-size: 24px;
            font-weight: 700;
          }
          .subtitle {
            color: #6b7280;
            margin-bottom: 32px;
            font-size: 14px;
          }
          .info { 
            background: #f8fafc; 
            padding: 20px; 
            margin: 24px 0; 
            border-radius: 12px;
            border-left: 4px solid #2563eb;
          }
          .info p {
            margin: 12px 0;
            font-size: 16px;
            color: #374151;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .info strong {
            color: #1f2937;
          }
          .btn { 
            background: #2563eb; 
            color: white; 
            padding: 16px 32px; 
            border: none; 
            border-radius: 12px; 
            cursor: pointer; 
            font-size: 16px;
            font-weight: 600;
            width: 100%;
            transition: all 0.2s ease;
            margin: 24px 0;
            position: relative;
            overflow: hidden;
          }
          .btn:hover { 
            background: #1d4ed8; 
            transform: translateY(-1px);
            box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.25);
          }
          .btn:active {
            transform: translateY(0);
          }
          .btn:disabled {
            background: #d1d5db;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
          }
          .loading {
            display: none;
            color: #6b7280;
            font-style: italic;
            margin: 16px 0;
            font-size: 14px;
          }
          .error {
            color: #dc2626;
            background: #fef2f2;
            padding: 16px;
            border-radius: 8px;
            margin: 16px 0;
            display: none;
            border: 1px solid #fecaca;
          }
          .return-link {
            display: inline-block;
            margin-top: 24px;
            color: #2563eb;
            text-decoration: none;
            padding: 12px 24px;
            border: 2px solid #2563eb;
            border-radius: 8px;
            transition: all 0.2s ease;
            font-weight: 500;
          }
          .return-link:hover {
            background: #2563eb;
            color: white;
            transform: translateY(-1px);
          }
          .secure-badge {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 20px 0;
            font-size: 12px;
            color: #6b7280;
          }
          .secure-badge::before {
            content: "🔒";
            margin-right: 6px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">CH</div>
          <h2>Secure Payment</h2>
          <p class="subtitle">Complete your consultation booking</p>
          
          <div class="info">
            <p><strong>Amount:</strong> <span>₹${
              booking.amount / 100
            }</span></p>
            <p><strong>Booking ID:</strong> <span>#${bookingId}</span></p>
            <p><strong>Name:</strong> <span>${booking.student.name}</span></p>
            <p><strong>Email:</strong> <span>${booking.student.email}</span></p>
          </div>

          <div class="error" id="error-message"></div>
          <div class="loading" id="loading">Initializing secure payment...</div>
          
          <button class="btn" id="pay-btn" onclick="startPayment()">
            🔒 Pay ₹${booking.amount / 100} Securely
          </button>
          
          <div class="secure-badge">
            Secured by Razorpay
          </div>
          
          <a href="carrierhub://dashboard" class="return-link">← Return to App</a>
        </div>

        <script>
          let paymentInProgress = false;
          
          function showError(message) {
            const errorDiv = document.getElementById('error-message');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            
            const btn = document.getElementById('pay-btn');
            btn.disabled = false;
            btn.innerHTML = '🔒 Pay ₹${booking.amount / 100} Securely';
            
            const loading = document.getElementById('loading');
            loading.style.display = 'none';
            
            paymentInProgress = false;
          }
          
          function startPayment() {
            if (paymentInProgress) {
              console.log('Payment already in progress');
              return;
            }
            
            console.log('=== Starting Payment Process ===');
            
            // Hide any previous errors
            document.getElementById('error-message').style.display = 'none';
            
            // Show loading
            const btn = document.getElementById('pay-btn');
            const loading = document.getElementById('loading');
            btn.disabled = true;
            btn.innerHTML = 'Processing...';
            loading.style.display = 'block';
            paymentInProgress = true;
            
            // Check if Razorpay is loaded (same as frontend)
            if (typeof window.Razorpay === 'undefined') {
              console.error('Razorpay not loaded');
              showError('Payment system not loaded. Please refresh and try again.');
              return;
            }
            
            // Check if key is available
            const razorpayKey = "${process.env.RAZORPAY_KEY_ID}";
            console.log('Razorpay Key:', razorpayKey ? 'Available' : 'Missing');
            
            if (!razorpayKey || razorpayKey.includes('undefined')) {
              console.error('Razorpay key missing');
              showError('Payment configuration error. Please contact support.');
              return;
            }
            
            // Create options exactly like frontend
            const options = {
              key: razorpayKey,
              amount: ${booking.amount},
              currency: "INR",
              name: "CarrierHub",
              description: "Consultation Booking Payment",
              order_id: "${orderId}",
              prefill: {
                name: "${booking.student.name}",
                email: "${booking.student.email}",
                contact: ""
              },
              theme: {
                color: "#2563eb"
              },
              handler: function (response) {
                console.log('Payment successful:', response);
                // Redirect back to app with success parameters
                window.location.href = "carrierhub://payment-success?paymentId=" + response.razorpay_payment_id + "&orderId=" + response.razorpay_order_id + "&signature=" + response.razorpay_signature + "&bookingId=${bookingId}";
              },
              modal: {
                ondismiss: function() {
                  console.log('Payment dismissed by user');
                  paymentInProgress = false;
                  btn.disabled = false;
                  btn.innerHTML = '🔒 Pay ₹${booking.amount / 100} Securely';
                  loading.style.display = 'none';
                },
                confirm_close: true,
                escape: true,
                backdropclose: false
              },
              retry: {
                enabled: true,
                max_count: 3
              },
              timeout: 300
            };
            
            console.log('Creating Razorpay instance with options:', {
              ...options,
              handler: '[Function]'
            });
            
            try {
              // Hide loading before opening (like frontend)
              loading.style.display = 'none';
              
              // Create and open Razorpay (exactly like frontend)
              const rzp = new window.Razorpay(options);
              
              rzp.on('payment.failed', function (response) {
                console.error('Payment failed:', response);
                paymentInProgress = false;
                showError('Payment failed: ' + (response.error?.description || 'Unknown error'));
              });
              
              console.log('Opening Razorpay payment modal...');
              rzp.open();
              
            } catch (error) {
              console.error('Error creating/opening Razorpay:', error);
              showError('Error starting payment: ' + error.message);
            }
          }
          
          // Page load check (like frontend)
          window.onload = function() {
            console.log('=== Payment Page Loaded ===');
            console.log('Razorpay available:', typeof window.Razorpay !== 'undefined');
            console.log('Environment key available:', "${
              process.env.RAZORPAY_KEY_ID
            }" ? 'Yes' : 'No');
            
            if (typeof window.Razorpay === 'undefined') {
              showError('Payment system failed to load. Please refresh the page.');
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
