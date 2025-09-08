# CarrierHub Backend

A production-ready backend for CarrierHub - a student-first consultant booking application. Built with Node.js, Express.js, Prisma ORM, and integrated with Razorpay for payments.

## 🚀 Features

- **Student Authentication**: Custom login system with JWT tokens
- **Admin Dashboard**: Complete admin panel for managing bookings
- **Consultant Categories**: 9 predefined consultant categories
- **Booking Management**: Create, view, and manage bookings
- **Razorpay Integration**: Complete payment flow with order creation, verification, and webhooks
- **Security**: Helmet, CORS, rate limiting, input validation
- **Database**: PostgreSQL with Prisma ORM
- **Testing**: Comprehensive test suite with Jest and Supertest
- **Documentation**: OpenAPI/Swagger documentation and Postman collection

## 📋 Prerequisites

- Node.js 22+ 
- PostgreSQL 15+ (or Neon Postgres)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd carrierhub-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"
   
   # Server
   PORT=5000
   NODE_ENV=development
   
   # JWT
   JWT_SECRET="your-secure-jwt-secret"
   JWT_EXPIRES_IN="7d"
   
   # Razorpay
   RAZORPAY_KEY_ID="rzp_test_xxx"
   RAZORPAY_KEY_SECRET="rzp_secret_xxx"
   RAZORPAY_WEBHOOK_SECRET="rzp_wh_secret_xxx"
   
   # CORS
   FRONTEND_URL="http://localhost:3000"
   
   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   
   # Minimum booking amount (in paise)
   MIN_BOOKING_AMOUNT=10000
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   
   # Seed the database with initial data
   npm run db:seed
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:5000`

## 🗄️ Database Setup

### Local PostgreSQL (Recommended for Development)
```bash
# Install PostgreSQL on your machine
# Create databases
createdb carrierhub_dev
createdb carrierhub_test

# Or using psql
psql -U postgres
CREATE DATABASE carrierhub_dev;
CREATE DATABASE carrierhub_test;
```

### Neon Postgres (Cloud Database)
1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string to your `.env` file

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Database
Make sure your test database is set up:
```env
TEST_DATABASE_URL="postgresql://postgres:password@localhost:5432/carrierhub_test?sslmode=disable"
```

## 🔗 API Endpoints

### Base URL: `http://localhost:5000/api`

### Authentication
- `POST /api/auth/register` - Register a new student
- `POST /api/auth/login` - Student login
- `GET /api/auth/me` - Get current student profile
- `POST /api/auth/admin/login` - Admin login

### Categories
- `GET /api/categories` - Get consultant categories

### Bookings
- `POST /api/bookings` - Create a new booking
- `GET /api/bookings/me` - Get student's bookings
- `GET /api/bookings/:id` - Get specific booking

### Payments
- `POST /api/payments/create` - Create Razorpay order
- `POST /api/payments/verify` - Verify payment
- `POST /api/payments/webhook` - Razorpay webhook

### Admin
- `GET /api/admin/bookings` - Get all bookings (admin)
- `PATCH /api/admin/bookings/:id/status` - Update booking status
- `GET /api/admin/bookings/export` - Export bookings as CSV
- `GET /api/admin/dashboard/stats` - Get dashboard statistics

## 🔧 Database Commands

```bash
# Generate Prisma client
npm run db:generate

# Create and apply migration
npm run db:migrate

# Reset database (WARNING: Deletes all data)
npm run db:reset

# Open Prisma Studio (database GUI)
npm run db:studio

# Check migration status
npm run db:status

# Push schema changes (dev only)
npm run db:create
```

## 📊 API Documentation

### Interactive Documentation
- **OpenAPI Spec**: `docs/openapi.json`
- **Postman Collection**: `docs/postman-collection.json`
- **API Docs Endpoint**: `GET /api/docs`

### Health Check
- **Endpoint**: `GET /health`
- **Response**: Server status and environment info

## 🔒 Security Features

- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevents brute force attacks
- **CORS**: Open to all origins for development
- **Helmet**: Security headers
- **Input Validation**: express-validator for request validation
- **SQL Injection Protection**: Prisma ORM with parameterized queries

## 📝 Database Seeding

The seed script creates:
- Admin user: `admin@carrierhub.com` / `Admin@123456`
- Test student: `student@carrierhub.com` / `Student@123456`
- Sample bookings for testing

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"
JWT_SECRET="your-production-jwt-secret"
RAZORPAY_KEY_ID="rzp_live_xxx"
RAZORPAY_KEY_SECRET="rzp_live_secret_xxx"
RAZORPAY_WEBHOOK_SECRET="rzp_live_wh_secret_xxx"
FRONTEND_URL="https://yourdomain.com"
```

### Production Deployment Steps
1. Set up your production environment variables
2. Run database migrations: `npm run db:migrate`
3. Seed the database with admin user: `npm run db:seed`
4. Deploy to your preferred hosting platform
5. Configure webhook URL in Razorpay dashboard

## 📁 Project Structure

```
carrierhub-backend/
├── src/
│   ├── controllers/     # Route controllers
│   ├── middlewares/     # Auth & security
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utilities
│   ├── index.js         # App entry point
│   └── prismaClient.js  # Database client
├── prisma/
│   └── schema.prisma    # Database schema
├── scripts/
│   └── seed.js          # Database seeding
├── tests/               # Test files
├── docs/                # API documentation
└── README.md
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, email support@carrierhub.com or create an issue in the repository.

---

**Built with ❤️ for CarrierHub**# carrierHub-Backend
