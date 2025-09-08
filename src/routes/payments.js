import express from 'express';
import { authenticateStudent } from '../middlewares/auth.js';
import { validatePaymentCreation, validatePaymentVerification } from '../utils/validators.js';
import { createPaymentOrder, verifyPayment, handleWebhook } from '../controllers/paymentController.js';

const router = express.Router();

// Webhook endpoint (no authentication required)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Student payment routes (require authentication)
router.use(authenticateStudent);

// Create payment order
router.post('/create', validatePaymentCreation, createPaymentOrder);

// Verify payment
router.post('/verify', validatePaymentVerification, verifyPayment);

export default router;
