import express from 'express';
import { authRateLimit } from '../middlewares/security.js';
import { authenticateStudent } from '../middlewares/auth.js';
import { validateStudentRegistration, validateStudentLogin, validateAdminLogin } from '../utils/validators.js';
import { register, login, getMe, adminLogin } from '../controllers/authController.js';

const router = express.Router();

// Student authentication routes
router.post('/register', authRateLimit, validateStudentRegistration, register);
router.post('/login', authRateLimit, validateStudentLogin, login);
router.get('/me', authenticateStudent, getMe);

// Admin authentication routes
router.post('/admin/login', authRateLimit, validateAdminLogin, adminLogin);

export default router;
