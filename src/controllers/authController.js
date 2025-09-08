import { registerStudent, loginStudent, loginAdmin } from '../services/authService.js';

export const register = async (req, res, next) => {
  try {
    const { student, token } = await registerStudent(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      data: { student, token }
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { student, token } = await loginStudent(req.body.email, req.body.password);
    
    res.json({
      success: true,
      message: 'Student logged in successfully',
      data: { student, token }
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'Student profile retrieved successfully',
      data: { student: req.student }
    });
  } catch (error) {
    next(error);
  }
};

export const adminLogin = async (req, res, next) => {
  try {
    const { admin, token } = await loginAdmin(req.body.email, req.body.password);
    
    res.json({
      success: true,
      message: 'Admin logged in successfully',
      data: { admin, token }
    });
  } catch (error) {
    next(error);
  }
};
