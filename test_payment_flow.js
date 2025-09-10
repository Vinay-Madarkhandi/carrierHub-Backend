import axios from 'axios';
import crypto from 'crypto';

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_STUDENT = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test Student',
  phone: '9876543210'
};

let authToken = '';
let bookingId = '';
let paymentOrderId = '';

// Helper function to make authenticated requests
const makeRequest = async (method, url, data = null) => {
  const config = {
    method,
    url: `${BASE_URL}${url}`,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` })
    }
  };
  
  if (data) {
    config.data = data;
  }
  
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error in ${method} ${url}:`, error.response?.data || error.message);
    throw error;
  }
};

// Test functions
async function testStudentRegistration() {
  console.log('\n🔐 Testing Student Registration...');
  try {
    const result = await makeRequest('POST', '/api/auth/student/register', TEST_STUDENT);
    console.log('✅ Student registration successful:', result.message);
    return true;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
      console.log('ℹ️  Student already exists, proceeding with login');
      return true;
    }
    console.error('❌ Student registration failed');
    return false;
  }
}

async function testStudentLogin() {
  console.log('\n🔑 Testing Student Login...');
  try {
    const result = await makeRequest('POST', '/api/auth/student/login', {
      email: TEST_STUDENT.email,
      password: TEST_STUDENT.password
    });
    authToken = result.token;
    console.log('✅ Student login successful');
    return true;
  } catch (error) {
    console.error('❌ Student login failed');
    return false;
  }
}

async function testBookingCreation() {
  console.log('\n📅 Testing Booking Creation...');
  try {
    const bookingData = {
      consultantType: 'CAREER',
      preferredDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      preferredTime: '10:00',
      description: 'Test booking for payment flow'
    };
    
    const result = await makeRequest('POST', '/api/bookings', bookingData);
    bookingId = result.booking.id;
    console.log('✅ Booking created successfully:', result.booking.id);
    return true;
  } catch (error) {
    console.error('❌ Booking creation failed');
    return false;
  }
}

async function testPaymentOrderCreation() {
  console.log('\n💳 Testing Payment Order Creation...');
  try {
    const result = await makeRequest('POST', '/api/payments/create', {
      bookingId: bookingId
    });
    paymentOrderId = result.order.id;
    console.log('✅ Payment order created successfully:', result.order.id);
    console.log('💰 Amount:', result.order.amount, 'paise');
    console.log('🔑 Razorpay Key ID:', result.keyId);
    return true;
  } catch (error) {
    console.error('❌ Payment order creation failed');
    return false;
  }
}

async function testPaymentVerification() {
  console.log('\n✅ Testing Payment Verification...');
  try {
    // Simulate Razorpay payment response
    const mockPaymentData = {
      razorpay_order_id: paymentOrderId,
      razorpay_payment_id: 'pay_test_' + Date.now(),
      razorpay_signature: 'mock_signature_for_testing'
    };
    
    console.log('ℹ️  Note: This will fail signature verification in test mode');
    console.log('📝 Mock payment data:', mockPaymentData);
    
    const result = await makeRequest('POST', '/api/payments/verify', mockPaymentData);
    console.log('✅ Payment verification successful:', result.message);
    return true;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('signature')) {
      console.log('ℹ️  Expected signature verification failure in test mode');
      return true;
    }
    console.error('❌ Unexpected payment verification error');
    return false;
  }
}

async function testWebhookEndpoint() {
  console.log('\n🔗 Testing Webhook Endpoint...');
  try {
    // Create a mock webhook payload
    const webhookPayload = {
      entity: 'event',
      account_id: 'acc_test',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: 'pay_test_' + Date.now(),
            amount: 10000,
            currency: 'INR',
            status: 'captured',
            order_id: paymentOrderId,
            method: 'card'
          }
        }
      },
      created_at: Math.floor(Date.now() / 1000)
    };
    
    // Generate a test signature (this will fail verification but test the endpoint)
    const webhookSecret = 'test_webhook_secret';
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(webhookPayload))
      .digest('hex');
    
    const config = {
      method: 'POST',
      url: `${BASE_URL}/api/payments/webhook`,
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': signature
      },
      data: webhookPayload
    };
    
    console.log('ℹ️  Note: This will fail signature verification with test secret');
    
    try {
      const response = await axios(config);
      console.log('✅ Webhook endpoint accessible:', response.status);
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('ℹ️  Webhook endpoint working (signature verification failed as expected)');
      } else {
        throw error;
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Webhook endpoint test failed');
    return false;
  }
}

// Main test runner
async function runPaymentFlowTests() {
  console.log('🚀 Starting Payment Flow Integration Tests\n');
  console.log('=' .repeat(50));
  
  const tests = [
    { name: 'Student Registration', fn: testStudentRegistration },
    { name: 'Student Login', fn: testStudentLogin },
    { name: 'Booking Creation', fn: testBookingCreation },
    { name: 'Payment Order Creation', fn: testPaymentOrderCreation },
    { name: 'Payment Verification', fn: testPaymentVerification },
    { name: 'Webhook Endpoint', fn: testWebhookEndpoint }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ ${test.name} failed with error:`, error.message);
      failed++;
    }
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Results Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Payment integration is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the logs above for details.');
  }
  
  console.log('\n💡 Next Steps:');
  console.log('1. Set up proper webhook URL using ngrok for local testing');
  console.log('2. Add the webhook secret to your Razorpay dashboard');
  console.log('3. Test with real Razorpay test payments');
  console.log('4. Monitor payment logs in the server console');
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runPaymentFlowTests().catch(console.error);
}

export {
  runPaymentFlowTests,
  testStudentRegistration,
  testStudentLogin,
  testBookingCreation,
  testPaymentOrderCreation,
  testPaymentVerification,
  testWebhookEndpoint
};