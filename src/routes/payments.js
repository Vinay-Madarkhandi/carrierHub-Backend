import express from 'express';
import { authenticateStudent } from '../middlewares/auth.js';
import { validatePaymentCreation, validatePaymentVerification } from '../utils/validators.js';
import { createPaymentOrder, verifyPayment, handleWebhook } from '../controllers/paymentController.js';

const router = express.Router();

// Middleware to capture raw body for webhook signature verification
const captureRawBody = (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    try {
      req.body = JSON.parse(data);
    } catch (error) {
      console.error('Error parsing webhook JSON:', error);
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    next();
  });
};

// Webhook endpoint (no authentication required)
router.post('/webhook', captureRawBody, handleWebhook);

// Public endpoint to get Razorpay key ID (no authentication required)
router.get('/key', (req, res) => {
  res.json({
    success: true,
    data: {
      keyId: process.env.RAZORPAY_KEY_ID
    }
  });
});

// Student payment routes (require authentication)
router.use(authenticateStudent);

// Create payment order
router.post('/create', validatePaymentCreation, createPaymentOrder);

// Verify payment
router.post('/verify', validatePaymentVerification, verifyPayment);

export default router;
