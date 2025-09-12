# CarrierHub Payment Integration Guide

## Overview

This document provides comprehensive guidance for setting up, configuring, and maintaining the Razorpay payment integration in the CarrierHub application.

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Razorpay Dashboard Configuration](#razorpay-dashboard-configuration)
3. [Webhook Configuration](#webhook-configuration)
4. [Testing Guide](#testing-guide)
5. [Production Deployment](#production-deployment)
6. [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
7. [Security Considerations](#security-considerations)
8. [API Reference](#api-reference)

## Environment Setup

### Required Environment Variables

Add these variables to your `.env` file:

```env
# Razorpay Configuration
# Get these from https://dashboard.razorpay.com/
RAZORPAY_KEY_ID="rzp_test_xxx"          # Test: rzp_test_xxx, Live: rzp_live_xxx
RAZORPAY_KEY_SECRET="rzp_secret_xxx"     # Corresponding secret key
RAZORPAY_WEBHOOK_SECRET="rzp_wh_xxx"     # Webhook secret for signature verification

# Business Configuration
MIN_BOOKING_AMOUNT=10000                 # Minimum amount in paise (₹100)

# Security
NODE_ENV=production                      # Set to 'production' for live environment
JWT_SECRET="your-production-jwt-secret"  # Strong secret for JWT tokens
```

### Key Management

1. **Development Environment**: Use test keys (`rzp_test_xxx`)
2. **Production Environment**: Use live keys (`rzp_live_xxx`)
3. **Security**: Never commit keys to source control
4. **Rotation**: Regularly rotate secrets, especially webhook secrets

## Razorpay Dashboard Configuration

### 1. Create Razorpay Account

1. Visit [https://dashboard.razorpay.com/](https://dashboard.razorpay.com/)
2. Sign up/Login to your account
3. Navigate to Account & Settings

### 2. API Keys Setup

1. Go to **Settings** → **API Keys**
2. Generate API Keys for your environment:
   - **Test Mode**: For development and testing
   - **Live Mode**: For production (requires account activation)
3. Copy the Key ID and Key Secret to your environment variables

### 3. Webhook Configuration

1. Navigate to **Settings** → **Webhooks**
2. Click **"+ Add New Webhook"**
3. Configure webhook:

   ```
   Webhook URL: https://your-domain.com/api/payments/webhook
   Active Events:
   ✅ payment.captured
   ✅ payment.failed
   ✅ payment.authorized
   ✅ refund.processed

   Secret: Generate a secure random string (save as RAZORPAY_WEBHOOK_SECRET)
   ```

### 4. Account Settings

Configure your account details:

- **Business Details**: Company information
- **Bank Account**: For settlements
- **KYC Documents**: Required for live mode
- **Settlement Schedule**: Configure as needed

## Webhook Configuration

### Webhook URL Setup

Your webhook endpoint: `https://your-domain.com/api/payments/webhook`

### Supported Events

| Event                | Description                         | Action                                           |
| -------------------- | ----------------------------------- | ------------------------------------------------ |
| `payment.captured`   | Payment successfully captured       | Update booking to SUCCESS, create payment record |
| `payment.failed`     | Payment failed                      | Update booking to FAILED                         |
| `payment.authorized` | Payment authorized but not captured | Update booking to PROCESSING                     |
| `refund.processed`   | Refund completed                    | Update payment status to REFUNDED                |

### Webhook Security

The webhook endpoint automatically:

- Verifies signature using `RAZORPAY_WEBHOOK_SECRET`
- Implements idempotency (handles duplicate events)
- Logs all events for audit purposes
- Returns appropriate HTTP status codes

## Testing Guide

### Test Environment Setup

1. Use Razorpay test keys in development
2. Configure webhook URL to your local/staging environment
3. Use ngrok for local webhook testing:
   ```bash
   ngrok http 5000
   # Use the https URL for webhook configuration
   ```

### Test Cards

Use these test card numbers with Razorpay:

| Scenario           | Card Number        | CVV   | Expiry  |
| ------------------ | ------------------ | ----- | ------- |
| Successful Payment | `4111111111111111` | `123` | `12/25` |
| Failed Payment     | `4000000000000002` | `123` | `12/25` |
| International Card | `4242424242424242` | `123` | `12/25` |
| Insufficient Funds | `4000000000000341` | `123` | `12/25` |

### Manual Testing Checklist

#### 1. Payment Order Creation

```bash
curl -X POST https://your-api.com/api/payments/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"bookingId": 1}'
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

#### 2. Payment Verification

```bash
curl -X POST https://your-api.com/api/payments/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "razorpay_order_id": "order_xyz123",
    "razorpay_payment_id": "pay_abc456",
    "razorpay_signature": "signature_hash",
    "bookingId": 1
  }'
```

#### 3. Webhook Testing

Use this script to test webhook signature verification:

```javascript
// webhook-test.js
const crypto = require("crypto");

const testWebhook = (webhookSecret, payload) => {
  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");

  // Send to your webhook endpoint
  fetch("https://your-api.com/api/payments/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": signature,
    },
    body: body,
  });
};

// Test payment captured event
testWebhook(process.env.RAZORPAY_WEBHOOK_SECRET, {
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        id: "pay_test123",
        order_id: "order_test456",
        amount: 150000,
        currency: "INR",
        status: "captured",
      },
    },
  },
});
```

### Automated Testing

Run the enhanced payment tests:

```bash
npm test -- tests/payments.enhanced.test.js
```

Tests cover:

- Order creation with metadata
- Signature verification (valid/invalid)
- Webhook processing with idempotency
- Payment verification flow
- Error scenarios and recovery

## Production Deployment

### Pre-deployment Checklist

- [ ] **Environment Variables**: All production values set
- [ ] **Database**: Migrations applied successfully
- [ ] **Razorpay Account**: Activated for live payments
- [ ] **Webhook URL**: Updated in Razorpay dashboard
- [ ] **SSL Certificate**: Valid HTTPS configuration
- [ ] **Monitoring**: Error tracking configured
- [ ] **Backup**: Database backup strategy in place

### Deployment Steps

1. **Update Environment Variables**:

   ```env
   NODE_ENV=production
   RAZORPAY_KEY_ID=rzp_live_xxx
   RAZORPAY_KEY_SECRET=rzp_secret_xxx
   RAZORPAY_WEBHOOK_SECRET=rzp_wh_xxx
   ```

2. **Update Webhook URL** in Razorpay Dashboard:

   ```
   https://carrierhub-backend.onrender.com/api/payments/webhook
   ```

3. **Deploy Application**:

   ```bash
   # If using Render
   git push origin main

   # Manual deployment
   npm run build
   npm start
   ```

4. **Verify Deployment**:

   ```bash
   # Health check
   curl https://carrierhub-backend.onrender.com/health

   # Test payment creation
   curl https://carrierhub-backend.onrender.com/api/payments/key
   ```

### Post-deployment Verification

1. **Create Test Payment**: Use production environment with test amount
2. **Verify Webhook**: Check webhook delivery in Razorpay dashboard
3. **Monitor Logs**: Watch for any errors or issues
4. **Test Error Scenarios**: Ensure error handling works correctly

## Monitoring and Troubleshooting

### Key Metrics to Monitor

1. **Payment Success Rate**: Target >95%
2. **Webhook Delivery Success**: Target >99%
3. **Payment Processing Time**: Target <30 seconds
4. **Error Rates**: Target <5%

### Common Issues and Solutions

#### 1. Payment Order Creation Fails

**Symptoms**: Error creating Razorpay order
**Causes**:

- Invalid API keys
- Insufficient permissions
- Network connectivity issues

**Solutions**:

- Verify API keys in dashboard
- Check network connectivity
- Review error logs for specific error codes

#### 2. Signature Verification Fails

**Symptoms**: Payment verification returns invalid signature
**Causes**:

- Mismatched webhook secret
- Modified payload
- Incorrect signature calculation

**Solutions**:

- Verify webhook secret matches dashboard
- Check payload integrity
- Review signature calculation logic

#### 3. Webhook Not Received

**Symptoms**: Payment status not updating after successful payment
**Causes**:

- Incorrect webhook URL
- Server not responding
- Firewall blocking requests

**Solutions**:

- Verify webhook URL in dashboard
- Check server health and logs
- Review firewall configurations

### Debugging Tools

#### 1. Webhook Logs

Check webhook delivery in Razorpay dashboard:

1. Go to **Settings** → **Webhooks**
2. Click on your webhook
3. View **Recent Deliveries** for status and retries

#### 2. Payment Logs

Monitor application logs for payment-related events:

```bash
# Filter payment logs
grep "payment" logs/app.log

# Monitor in real-time
tail -f logs/app.log | grep -i "payment\|webhook\|razorpay"
```

#### 3. Database Queries

Useful queries for debugging:

```sql
-- Check payment status
SELECT b.id, b.status, p.status as payment_status, p.razorpay_payment_id
FROM bookings b
LEFT JOIN payments p ON b.id = p.booking_id
WHERE b.id = ?;

-- Find failed payments
SELECT * FROM bookings
WHERE status = 'FAILED'
AND updated_at > NOW() - INTERVAL 1 DAY;

-- Webhook processing stats
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_payments,
  SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successful
FROM payments
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Security Considerations

### Best Practices

1. **Environment Variables**: Never hardcode secrets
2. **HTTPS Only**: All payment endpoints must use HTTPS
3. **Input Validation**: Validate all payment-related inputs
4. **Error Handling**: Don't expose sensitive information in errors
5. **Audit Logging**: Log all payment activities for compliance
6. **Rate Limiting**: Implement rate limiting on payment endpoints

### Security Checklist

- [ ] **Secrets Management**: All secrets in environment variables
- [ ] **HTTPS Enforcement**: SSL certificates valid and enforced
- [ ] **Signature Verification**: Constant-time comparison implemented
- [ ] **Input Validation**: All inputs validated and sanitized
- [ ] **Error Sanitization**: No sensitive data in error responses
- [ ] **Audit Logging**: Payment events logged without sensitive data
- [ ] **Rate Limiting**: Payment endpoints protected from abuse

### Compliance Considerations

1. **PCI DSS**: If storing card data (not recommended)
2. **Data Protection**: Handle payment data according to local laws
3. **Audit Requirements**: Maintain payment audit trails
4. **Incident Response**: Plan for security incidents

## API Reference

### Payment Endpoints

#### Create Payment Order

```http
POST /api/payments/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "bookingId": 123
}
```

**Response**:

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

#### Verify Payment

```http
POST /api/payments/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "razorpay_order_id": "order_xyz123",
  "razorpay_payment_id": "pay_abc456",
  "razorpay_signature": "signature_hash",
  "bookingId": 123
}
```

#### Get Razorpay Key (Public)

```http
GET /api/payments/key
```

**Response**:

```json
{
  "success": true,
  "data": {
    "keyId": "rzp_test_xxx"
  }
}
```

#### Webhook Endpoint

```http
POST /api/payments/webhook
Content-Type: application/json
x-razorpay-signature: <signature>

{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_123",
        "order_id": "order_456",
        "amount": 150000,
        "currency": "INR",
        "status": "captured"
      }
    }
  }
}
```

### Error Codes

| Code                     | Description                   | Action                      |
| ------------------------ | ----------------------------- | --------------------------- |
| `NOT_FOUND`              | Booking not found             | Verify booking ID           |
| `INVALID_BOOKING_STATUS` | Booking not payable           | Check booking status        |
| `INVALID_SIGNATURE`      | Signature verification failed | Check payment data          |
| `WEBHOOK_ERROR`          | Webhook processing failed     | Check webhook configuration |
| `VALIDATION_ERROR`       | Input validation failed       | Check request parameters    |

## Support and Maintenance

### Regular Maintenance Tasks

1. **Monitor Payment Success Rates**: Weekly review
2. **Update Dependencies**: Monthly security updates
3. **Review Error Logs**: Daily error analysis
4. **Test Webhook Delivery**: Weekly webhook health checks
5. **Backup Payment Data**: Regular database backups

### Getting Help

1. **Razorpay Support**: [https://razorpay.com/support/](https://razorpay.com/support/)
2. **Documentation**: [https://razorpay.com/docs/](https://razorpay.com/docs/)
3. **Status Page**: [https://status.razorpay.com/](https://status.razorpay.com/)

### Emergency Procedures

#### Payment System Down

1. Monitor error rates and user reports
2. Check Razorpay status page
3. Review application logs
4. Implement temporary payment pause if needed
5. Notify users about payment issues

#### Security Incident

1. Isolate affected systems
2. Review payment logs for suspicious activity
3. Rotate API keys and secrets
4. Notify affected users if required
5. Document incident for compliance
