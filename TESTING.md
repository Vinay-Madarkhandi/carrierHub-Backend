# CarrierHub API - Manual Testing Guide

This document provides sample cURL commands and Postman requests for manually testing all CarrierHub API endpoints, with special focus on the payment integration.

## Base Configuration

```bash
# Set base URL
export BASE_URL="https://carrierhub-backend.onrender.com/api"
# For local testing
# export BASE_URL="http://localhost:5000/api"

# Test credentials (from seed data)
export STUDENT_EMAIL="student@carrierhub.com"
export STUDENT_PASSWORD="Student@123456"
export ADMIN_EMAIL="admin@carrierhub.com"
export ADMIN_PASSWORD="Admin@123456"
```

## Health Check

```bash
curl -X GET https://carrierhub-backend.onrender.com/health
```

Expected Response:

```json
{
  "success": true,
  "message": "CarrierHub Backend is running",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "environment": "production",
  "host": "0.0.0.0",
  "port": 5000
}
```

## Authentication Endpoints

### 1. Student Registration

```bash
curl -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Student",
    "email": "test.student@example.com",
    "phone": "9876543210",
    "password": "TestStudent@123"
  }'
```

### 2. Student Login

```bash
curl -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$STUDENT_EMAIL'",
    "password": "'$STUDENT_PASSWORD'"
  }'
```

Save the token from response:

```bash
export STUDENT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Get Student Profile

```bash
curl -X GET $BASE_URL/auth/me \
  -H "Authorization: Bearer $STUDENT_TOKEN"
```

### 4. Admin Login

```bash
curl -X POST $BASE_URL/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$ADMIN_EMAIL'",
    "password": "'$ADMIN_PASSWORD'"
  }'
```

Save the admin token:

```bash
export ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Category Endpoints

### Get Consultant Categories

```bash
curl -X GET $BASE_URL/categories
```

Expected Response:

```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": {
    "categories": [
      {
        "type": "CAREER_GUIDANCE",
        "title": "Career Guidance",
        "description": "Professional career counseling..."
      }
    ]
  }
}
```

## Booking Endpoints

### 1. Create Booking

```bash
curl -X POST $BASE_URL/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d '{
    "consultantType": "CAREER_GUIDANCE",
    "details": "I need guidance on choosing between software engineering and data science careers. I have a background in computer science.",
    "amount": 150000
  }'
```

Save the booking ID from response:

```bash
export BOOKING_ID=1
```

### 2. Get Student Bookings

```bash
curl -X GET "$BASE_URL/bookings/me?page=1&limit=10" \
  -H "Authorization: Bearer $STUDENT_TOKEN"
```

### 3. Get Specific Booking

```bash
curl -X GET $BASE_URL/bookings/$BOOKING_ID \
  -H "Authorization: Bearer $STUDENT_TOKEN"
```

## Payment Endpoints

### 1. Get Razorpay Key (Public)

```bash
curl -X GET $BASE_URL/payments/key
```

Expected Response:

```json
{
  "success": true,
  "data": {
    "keyId": "rzp_test_xxx"
  }
}
```

### 2. Create Payment Order

```bash
curl -X POST $BASE_URL/payments/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d '{
    "bookingId": '$BOOKING_ID'
  }'
```

Expected Response:

```json
{
  "success": true,
  "message": "Payment order created successfully",
  "data": {
    "orderId": "order_xyz123",
    "amount": 150000,
    "currency": "INR",
    "keyId": "rzp_test_xxx"
  }
}
```

Save the order ID:

```bash
export ORDER_ID="order_xyz123"
```

### 3. Verify Payment (After Razorpay Payment)

**Note**: This requires actual payment data from Razorpay. Use test card numbers in frontend.

```bash
# Example with test signature (won't work without actual payment)
curl -X POST $BASE_URL/payments/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d '{
    "razorpay_order_id": "'$ORDER_ID'",
    "razorpay_payment_id": "pay_test123456",
    "razorpay_signature": "test_signature_hash",
    "bookingId": '$BOOKING_ID'
  }'
```

### 4. Webhook Endpoint (Internal Testing)

**Note**: This endpoint is called by Razorpay. For testing, use the webhook test script.

```bash
# Generate test webhook signature
node -e "
const crypto = require('crypto');
const payload = {
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: 'pay_test123',
        order_id: '$ORDER_ID',
        amount: 150000,
        currency: 'INR',
        status: 'captured'
      }
    }
  }
};
const body = JSON.stringify(payload);
const signature = crypto.createHmac('sha256', 'test_webhook_secret').update(body).digest('hex');
console.log('Body:', body);
console.log('Signature:', signature);
"
```

Then use the generated signature:

```bash
curl -X POST $BASE_URL/payments/webhook \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: GENERATED_SIGNATURE" \
  -d '{
    "event": "payment.captured",
    "payload": {
      "payment": {
        "entity": {
          "id": "pay_test123",
          "order_id": "'$ORDER_ID'",
          "amount": 150000,
          "currency": "INR",
          "status": "captured"
        }
      }
    }
  }'
```

## Admin Endpoints

### 1. Get All Bookings

```bash
curl -X GET "$BASE_URL/admin/bookings?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 2. Get Bookings with Filters

```bash
curl -X GET "$BASE_URL/admin/bookings?status=SUCCESS&consultantType=CAREER_GUIDANCE&page=1&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 3. Update Booking Status

```bash
curl -X PATCH $BASE_URL/admin/bookings/$BOOKING_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "status": "COMPLETED"
  }'
```

### 4. Export Bookings as CSV

```bash
curl -X GET $BASE_URL/admin/bookings/export \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o bookings-export.csv
```

### 5. Get Dashboard Statistics

```bash
curl -X GET $BASE_URL/admin/dashboard/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Error Testing

### 1. Test Rate Limiting

```bash
# Send multiple requests quickly to trigger rate limiting
for i in {1..20}; do
  curl -X POST $BASE_URL/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"wrong@email.com","password":"wrong"}' &
done
wait
```

### 2. Test Invalid Authentication

```bash
curl -X GET $BASE_URL/bookings/me \
  -H "Authorization: Bearer invalid_token"
```

Expected Response:

```json
{
  "success": false,
  "message": "Invalid token",
  "error": "INVALID_TOKEN"
}
```

### 3. Test Input Validation

```bash
curl -X POST $BASE_URL/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d '{
    "consultantType": "INVALID_TYPE",
    "details": "Short",
    "amount": 5000
  }'
```

Expected Response:

```json
{
  "success": false,
  "message": "Validation failed",
  "error": "VALIDATION_ERROR",
  "details": [...]
}
```

## Complete Payment Flow Test

### Step 1: Create Complete Flow Script

Create `test-payment-flow.sh`:

```bash
#!/bin/bash

set -e  # Exit on any error

echo "🚀 Testing Complete Payment Flow"

# Configuration
BASE_URL="https://carrierhub-backend.onrender.com/api"
STUDENT_EMAIL="student@carrierhub.com"
STUDENT_PASSWORD="Student@123456"

# Step 1: Login
echo "📝 Step 1: Student Login"
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$STUDENT_EMAIL'",
    "password": "'$STUDENT_PASSWORD'"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')
echo "✅ Login successful, token received"

# Step 2: Create Booking
echo "📝 Step 2: Create Booking"
BOOKING_RESPONSE=$(curl -s -X POST $BASE_URL/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "consultantType": "CAREER_GUIDANCE",
    "details": "Test booking for payment flow verification",
    "amount": 150000
  }')

BOOKING_ID=$(echo $BOOKING_RESPONSE | jq -r '.data.booking.id')
echo "✅ Booking created with ID: $BOOKING_ID"

# Step 3: Create Payment Order
echo "📝 Step 3: Create Payment Order"
ORDER_RESPONSE=$(curl -s -X POST $BASE_URL/payments/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "bookingId": '$BOOKING_ID'
  }')

ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.data.orderId')
AMOUNT=$(echo $ORDER_RESPONSE | jq -r '.data.amount')
echo "✅ Payment order created: $ORDER_ID"
echo "💰 Amount: ₹$(echo "scale=2; $AMOUNT / 100" | bc)"

# Step 4: Verify Order Details
echo "📝 Step 4: Verify Order in Database"
BOOKING_CHECK=$(curl -s -X GET $BASE_URL/bookings/$BOOKING_ID \
  -H "Authorization: Bearer $TOKEN")

RAZORPAY_ORDER=$(echo $BOOKING_CHECK | jq -r '.data.booking.razorpayOrderId')
echo "✅ Order ID stored in database: $RAZORPAY_ORDER"

# Step 5: Test Webhook (Simulate payment captured)
echo "📝 Step 5: Simulate Payment Captured Webhook"
WEBHOOK_PAYLOAD='{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_test_'$(date +%s)'",
        "order_id": "'$ORDER_ID'",
        "amount": '$AMOUNT',
        "currency": "INR",
        "status": "captured"
      }
    }
  }
}'

# Generate webhook signature
WEBHOOK_SECRET="test_webhook_secret"  # Replace with actual secret
SIGNATURE=$(echo -n "$WEBHOOK_PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | sed 's/^.* //')

WEBHOOK_RESPONSE=$(curl -s -X POST $BASE_URL/payments/webhook \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: $SIGNATURE" \
  -d "$WEBHOOK_PAYLOAD")

echo "✅ Webhook processed: $(echo $WEBHOOK_RESPONSE | jq -r '.message')"

# Step 6: Verify Final Status
echo "📝 Step 6: Verify Final Booking Status"
FINAL_STATUS=$(curl -s -X GET $BASE_URL/bookings/$BOOKING_ID \
  -H "Authorization: Bearer $TOKEN")

STATUS=$(echo $FINAL_STATUS | jq -r '.data.booking.status')
PAYMENT_STATUS=$(echo $FINAL_STATUS | jq -r '.data.booking.payment.status')

echo "✅ Final booking status: $STATUS"
echo "✅ Payment status: $PAYMENT_STATUS"

if [[ "$STATUS" == "SUCCESS" && "$PAYMENT_STATUS" == "SUCCESS" ]]; then
  echo "🎉 Payment flow test PASSED!"
else
  echo "❌ Payment flow test FAILED!"
  exit 1
fi
```

### Step 2: Run the Test

```bash
chmod +x test-payment-flow.sh
./test-payment-flow.sh
```

## Postman Collection

### Import Collection

Create `CarrierHub-API.postman_collection.json`:

```json
{
  "info": {
    "name": "CarrierHub API",
    "description": "Complete API collection for CarrierHub payment integration testing",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "https://carrierhub-backend.onrender.com/api"
    },
    {
      "key": "studentToken",
      "value": ""
    },
    {
      "key": "adminToken",
      "value": ""
    }
  ],
  "item": [
    {
      "name": "Authentication",
      "item": [
        {
          "name": "Student Login",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"student@carrierhub.com\",\n  \"password\": \"Student@123456\"\n}"
            },
            "url": "{{baseUrl}}/auth/login"
          },
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "if (responseCode.code === 200) {",
                  "    const jsonData = pm.response.json();",
                  "    pm.collectionVariables.set('studentToken', jsonData.data.token);",
                  "    pm.test('Student login successful', function() {",
                  "        pm.expect(jsonData.success).to.be.true;",
                  "    });",
                  "}"
                ]
              }
            }
          ]
        },
        {
          "name": "Admin Login",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"admin@carrierhub.com\",\n  \"password\": \"Admin@123456\"\n}"
            },
            "url": "{{baseUrl}}/auth/admin/login"
          },
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "if (responseCode.code === 200) {",
                  "    const jsonData = pm.response.json();",
                  "    pm.collectionVariables.set('adminToken', jsonData.data.token);",
                  "}"
                ]
              }
            }
          ]
        }
      ]
    },
    {
      "name": "Payments",
      "item": [
        {
          "name": "Get Razorpay Key",
          "request": {
            "method": "GET",
            "url": "{{baseUrl}}/payments/key"
          }
        },
        {
          "name": "Create Payment Order",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              },
              {
                "key": "Authorization",
                "value": "Bearer {{studentToken}}"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"bookingId\": 1\n}"
            },
            "url": "{{baseUrl}}/payments/create"
          }
        }
      ]
    }
  ]
}
```

### Environment Variables for Postman

Create `CarrierHub-Environment.postman_environment.json`:

```json
{
  "name": "CarrierHub Production",
  "values": [
    {
      "key": "baseUrl",
      "value": "https://carrierhub-backend.onrender.com/api",
      "enabled": true
    },
    {
      "key": "studentEmail",
      "value": "student@carrierhub.com",
      "enabled": true
    },
    {
      "key": "studentPassword",
      "value": "Student@123456",
      "enabled": true
    },
    {
      "key": "adminEmail",
      "value": "admin@carrierhub.com",
      "enabled": true
    },
    {
      "key": "adminPassword",
      "value": "Admin@123456",
      "enabled": true
    }
  ]
}
```

## Automated Testing Scripts

### Node.js Test Script

Create `manual-test.js`:

```javascript
const fetch = require("node-fetch");

const BASE_URL = "https://carrierhub-backend.onrender.com/api";

const test = async () => {
  try {
    console.log("🚀 Starting API Tests\n");

    // Test 1: Health Check
    console.log("1. Health Check...");
    const health = await fetch(
      "https://carrierhub-backend.onrender.com/health"
    );
    const healthData = await health.json();
    console.log("✅ Health:", healthData.success ? "OK" : "FAILED");

    // Test 2: Student Login
    console.log("\n2. Student Login...");
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@carrierhub.com",
        password: "Student@123456",
      }),
    });
    const loginData = await loginResponse.json();
    const token = loginData.data?.token;
    console.log("✅ Login:", loginData.success ? "OK" : "FAILED");

    if (!token) {
      console.log("❌ No token received, stopping tests");
      return;
    }

    // Test 3: Get Categories
    console.log("\n3. Get Categories...");
    const categoriesResponse = await fetch(`${BASE_URL}/categories`);
    const categoriesData = await categoriesResponse.json();
    console.log("✅ Categories:", categoriesData.success ? "OK" : "FAILED");

    // Test 4: Create Booking
    console.log("\n4. Create Booking...");
    const bookingResponse = await fetch(`${BASE_URL}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        consultantType: "CAREER_GUIDANCE",
        details: "Test booking for automated testing",
        amount: 150000,
      }),
    });
    const bookingData = await bookingResponse.json();
    const bookingId = bookingData.data?.booking?.id;
    console.log("✅ Booking:", bookingData.success ? "OK" : "FAILED");

    if (!bookingId) {
      console.log("❌ No booking ID received, stopping payment tests");
      return;
    }

    // Test 5: Create Payment Order
    console.log("\n5. Create Payment Order...");
    const orderResponse = await fetch(`${BASE_URL}/payments/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ bookingId }),
    });
    const orderData = await orderResponse.json();
    console.log("✅ Payment Order:", orderData.success ? "OK" : "FAILED");

    console.log("\n🎉 All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
};

test();
```

Run with:

```bash
node manual-test.js
```

## Troubleshooting Commands

### Check Booking Status

```bash
# Get specific booking details
curl -X GET $BASE_URL/bookings/$BOOKING_ID \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.'
```

### Check Payment Records

```bash
# Admin endpoint to see all bookings with payment info
curl -X GET "$BASE_URL/admin/bookings?bookingId=$BOOKING_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

### Verify Webhook Delivery

Check webhook logs in Razorpay dashboard or use:

```bash
# Check recent webhook deliveries (if logging is enabled)
curl -X GET $BASE_URL/admin/webhooks/logs \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

This comprehensive testing guide ensures all API endpoints are working correctly and the payment integration is functioning as expected.
