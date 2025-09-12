import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import { errorHandler, notFound } from "./utils/errorHandler.js";
import {
  generalRateLimit,
  corsMiddleware,
  helmetConfig,
} from "./middlewares/security.js";

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from "./routes/auth.js";
import bookingRoutes from "./routes/bookings.js";
import paymentRoutes from "./routes/payments.js";
import adminRoutes from "./routes/admin.js";
import categoryRoutes from "./routes/categories.js";
import diagnosticsRoutes from "./routes/diagnostics.js";

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0"; // Listen on all network interfaces

// Security middleware
app.use(helmetConfig);
app.use(corsMiddleware);
app.use(generalRateLimit);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "CarrierHub Backend is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    host: HOST,
    port: PORT,
    clientIP: req.ip || req.connection.remoteAddress,
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/diagnostics", diagnosticsRoutes);

// API documentation endpoint
app.get("/api/docs", (req, res) => {
  res.json({
    success: true,
    message: "API Documentation",
    endpoints: {
      auth: {
        "POST /api/auth/register": "Register a new student",
        "POST /api/auth/login": "Student login",
        "GET /api/auth/me": "Get current student profile",
      },
      admin: {
        "POST /api/admin/login": "Admin login",
      },
      categories: {
        "GET /api/categories": "Get consultant categories",
      },
      bookings: {
        "POST /api/bookings": "Create a new booking",
        "GET /api/bookings/me": "Get student bookings",
        "GET /api/bookings/:id": "Get specific booking",
      },
      payments: {
        "GET /api/payments/key": "Get Razorpay key ID (public)",
        "POST /api/payments/create": "Create Razorpay order",
        "POST /api/payments/verify": "Verify payment",
        "POST /api/payments/webhook": "Razorpay webhook",
      },
      adminEndpoints: {
        "GET /api/admin/bookings": "Get all bookings (admin)",
        "PATCH /api/admin/bookings/:id/status": "Update booking status",
        "GET /api/admin/bookings/export": "Export bookings as CSV",
      },
    },
  });
});

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

// Start server on all network interfaces
app.listen(PORT, HOST, () => {
  console.log(`🚀 CarrierHub Backend running on ${HOST}:${PORT}`);
  console.log(`📚 API Documentation: http://${HOST}:${PORT}/api/docs`);
  console.log(`🏥 Health Check: http://${HOST}:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Network Access: Available on all network interfaces`);

  // Display local network IPs for easy access
  if (process.env.NODE_ENV === "development") {
    console.log(`\n📡 Access URLs:`);
    console.log(`   Local:    http://localhost:${PORT}`);
    console.log(`   Network:  http://0.0.0.0:${PORT}`);
    console.log(`   External: http://[YOUR_IP]:${PORT}`);
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  process.exit(0);
});

export default app;
