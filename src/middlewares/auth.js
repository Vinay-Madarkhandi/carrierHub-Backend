import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';

export const authenticateStudent = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        error: 'NO_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const student = await prisma.student.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, phone: true, createdAt: true }
    });

    if (!student) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Student not found.',
        error: 'INVALID_TOKEN'
      });
    }

    req.student = student;
    next();
  } catch (error) {
    next(error);
  }
};

export const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        error: 'NO_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await prisma.admin.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, createdAt: true }
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Admin not found.',
        error: 'INVALID_TOKEN'
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    next(error);
  }
};
