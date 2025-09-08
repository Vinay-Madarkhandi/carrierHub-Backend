import express from 'express';
import { authenticateStudent } from '../middlewares/auth.js';
import { validateBookingCreation, validateId } from '../utils/validators.js';
import { createBooking, getMyBookings, getBookingById } from '../controllers/bookingController.js';

const router = express.Router();

// All routes require student authentication
router.use(authenticateStudent);

// Create a new booking
router.post('/', validateBookingCreation, createBooking);

// Get student's bookings
router.get('/me', getMyBookings);

// Get specific booking by ID
router.get('/:id', validateId, getBookingById);

export default router;
