import { body, param, query, validationResult } from "express-validator";

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      error: "VALIDATION_ERROR",
      details: errors.array(),
    });
  }
  next();
};

// Student registration validation
export const validateStudentRegistration = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("phone")
    .isMobilePhone("en-IN")
    .withMessage("Please provide a valid Indian phone number"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  handleValidationErrors,
];

// Student login validation
export const validateStudentLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

// Admin login validation
export const validateAdminLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

// Booking creation validation
export const validateBookingCreation = [
  body("consultantType")
    .isIn([
      "CAREER_GUIDANCE",
      "COLLEGE_COURSE",
      "EXAM_PREPARATION",
      "STUDY_ABROAD",
      "SKILL_MENTORSHIP",
      "JOB_PLACEMENT",
      "GOVERNMENT_JOBS",
      "PERSONAL_GROWTH",
      "ALTERNATIVE_CAREERS",
    ])
    .withMessage("Invalid consultant type"),
  body("details")
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Details must be between 10 and 1000 characters"),
  body("amount")
    .isInt({ min: parseInt(process.env.MIN_BOOKING_AMOUNT) || 1000 })
    .withMessage(
      `Amount must be at least ${
        (parseInt(process.env.MIN_BOOKING_AMOUNT) || 1000) / 100
      } INR`
    ),
  handleValidationErrors,
];

// Payment creation validation
export const validatePaymentCreation = [
  body("bookingId")
    .isInt({ min: 1 })
    .withMessage("Valid booking ID is required"),
  handleValidationErrors,
];

// Payment verification validation
export const validatePaymentVerification = [
  body("razorpay_payment_id")
    .notEmpty()
    .withMessage("Razorpay payment ID is required"),
  body("razorpay_order_id")
    .notEmpty()
    .withMessage("Razorpay order ID is required"),
  body("razorpay_signature")
    .notEmpty()
    .withMessage("Razorpay signature is required"),
  body("bookingId")
    .isInt({ min: 1 })
    .withMessage("Valid booking ID is required"),
  handleValidationErrors,
];

// Admin booking status update validation
export const validateBookingStatusUpdate = [
  body("status")
    .isIn(["PENDING", "PROCESSING", "SUCCESS", "FAILED", "COMPLETED"])
    .withMessage("Invalid booking status"),
  handleValidationErrors,
];

// ID parameter validation
export const validateId = [
  param("id").isInt({ min: 1 }).withMessage("Valid ID is required"),
  handleValidationErrors,
];

// Admin booking query validation
export const validateAdminBookingQuery = [
  query("status")
    .optional()
    .isIn(["PENDING", "PROCESSING", "SUCCESS", "FAILED", "COMPLETED"])
    .withMessage("Invalid status filter"),
  query("consultantType")
    .optional()
    .isIn([
      "CAREER_GUIDANCE",
      "COLLEGE_COURSE",
      "EXAM_PREPARATION",
      "STUDY_ABROAD",
      "SKILL_MENTORSHIP",
      "JOB_PLACEMENT",
      "GOVERNMENT_JOBS",
      "PERSONAL_GROWTH",
      "ALTERNATIVE_CAREERS",
    ])
    .withMessage("Invalid consultant type filter"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("dateFrom")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format for dateFrom"),
  query("dateTo")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format for dateTo"),
  handleValidationErrors,
];
