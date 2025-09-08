import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';

const SALT_ROUNDS = 12;

export const hashPassword = async (password) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

export const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

export const registerStudent = async (studentData) => {
  const { name, email, phone, password } = studentData;
  
  // Check if student already exists
  const existingStudent = await prisma.student.findUnique({
    where: { email }
  });

  if (existingStudent) {
    throw new Error('Student with this email already exists');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create student
  const student = await prisma.student.create({
    data: {
      name,
      email,
      phone,
      password: hashedPassword
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true
    }
  });

  // Generate token
  const token = generateToken({ id: student.id, type: 'student' });

  return { student, token };
};

export const loginStudent = async (email, password) => {
  // Find student
  const student = await prisma.student.findUnique({
    where: { email }
  });

  if (!student) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, student.password);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  // Generate token
  const token = generateToken({ id: student.id, type: 'student' });

  return {
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      createdAt: student.createdAt
    },
    token
  };
};

export const loginAdmin = async (email, password) => {
  // Find admin
  const admin = await prisma.admin.findUnique({
    where: { email }
  });

  if (!admin) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, admin.password);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  // Generate token
  const token = generateToken({ id: admin.id, type: 'admin' });

  return {
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      createdAt: admin.createdAt
    },
    token
  };
};
