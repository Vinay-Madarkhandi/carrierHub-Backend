import express from 'express';
import { authenticateAdmin } from '../middlewares/auth.js';
import { validateAdminBookingQuery, validateBookingStatusUpdate, validateId } from '../utils/validators.js';
import { getAllBookings, updateBookingStatus, exportBookings, getDashboardStats } from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require authentication
router.use(authenticateAdmin);

// Get all bookings with filters
router.get('/bookings', validateAdminBookingQuery, getAllBookings);

// Update booking status
router.patch('/bookings/:id/status', validateId, validateBookingStatusUpdate, updateBookingStatus);

// Export bookings as CSV
router.get('/bookings/export', validateAdminBookingQuery, exportBookings);

// Get dashboard statistics
router.get('/dashboard/stats', getDashboardStats);

export default router;
