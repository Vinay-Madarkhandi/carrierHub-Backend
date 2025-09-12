# Frontend Integration Guide for CarrierHub Razorpay Payment

## Overview

This guide provides exact code snippets for integrating Razorpay payments with the CarrierHub backend in a Next.js/React application.

## Prerequisites

1. Install Razorpay SDK:

```bash
npm install razorpay
# or
yarn add razorpay
```

2. Add Razorpay script to your Next.js app (`pages/_document.tsx` or `app/layout.tsx`):

```tsx
// For app directory (app/layout.tsx)
import Script from "next/script";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
```

## Environment Variables

Add to your `.env.local`:

```env
NEXT_PUBLIC_API_URL=https://carrierhub-backend.onrender.com/api
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxx  # Optional: can be fetched from API
```

## Core Payment Hook

Create `hooks/useRazorpayPayment.ts`:

```typescript
import { useState, useCallback } from "react";

interface PaymentData {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface OrderData {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

interface UseRazorpayPaymentProps {
  onSuccess?: (paymentData: PaymentData) => void;
  onFailure?: (error: any) => void;
  onCancel?: () => void;
}

export const useRazorpayPayment = ({
  onSuccess,
  onFailure,
  onCancel,
}: UseRazorpayPaymentProps = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = useCallback(
    async (bookingId: number): Promise<OrderData | null> => {
      try {
        setError(null);
        const token = localStorage.getItem("token"); // Adjust based on your auth implementation

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/payments/create`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ bookingId }),
          }
        );

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "Failed to create payment order");
        }

        return data.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create order";
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  const verifyPayment = useCallback(
    async (paymentData: PaymentData, bookingId: number) => {
      try {
        const token = localStorage.getItem("token");

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/payments/verify`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              ...paymentData,
              bookingId,
            }),
          }
        );

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "Payment verification failed");
        }

        return data.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Verification failed";
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  const initiatePyment = useCallback(
    async (
      bookingId: number,
      customerDetails: {
        name: string;
        email: string;
        phone: string;
      }
    ) => {
      if (typeof window === "undefined" || !window.Razorpay) {
        setError("Razorpay SDK not loaded");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Step 1: Create order
        const orderData = await createOrder(bookingId);
        if (!orderData) return;

        // Step 2: Configure Razorpay options
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "CarrierHub",
          description: "Consultant Booking Payment",
          order_id: orderData.orderId,
          prefill: {
            name: customerDetails.name,
            email: customerDetails.email,
            contact: customerDetails.phone,
          },
          theme: {
            color: "#3B82F6", // Adjust to match your brand
          },
          handler: async (response: any) => {
            try {
              const paymentData = {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              };

              // Step 3: Verify payment
              await verifyPayment(paymentData, bookingId);

              onSuccess?.(paymentData);
            } catch (verificationError) {
              console.error("Payment verification failed:", verificationError);
              onFailure?.(verificationError);
            } finally {
              setLoading(false);
            }
          },
          modal: {
            ondismiss: () => {
              setLoading(false);
              onCancel?.();
            },
          },
        };

        // Step 4: Open Razorpay checkout
        const rzp = new window.Razorpay(options);

        rzp.on("payment.failed", (response: any) => {
          setLoading(false);
          const error = {
            code: response.error.code,
            description: response.error.description,
            reason: response.error.reason,
          };
          onFailure?.(error);
        });

        rzp.open();
      } catch (err) {
        setLoading(false);
        onFailure?.(err);
      }
    },
    [createOrder, verifyPayment, onSuccess, onFailure, onCancel]
  );

  return {
    initiatePyment,
    loading,
    error,
    clearError: () => setError(null),
  };
};

// Extend Window interface for TypeScript
declare global {
  interface Window {
    Razorpay: any;
  }
}
```

## Payment Component Example

Create `components/PaymentButton.tsx`:

```typescript
import React from "react";
import { useRazorpayPayment } from "../hooks/useRazorpayPayment";
import { toast } from "sonner"; // or your preferred toast library

interface PaymentButtonProps {
  bookingId: number;
  amount: number;
  customerDetails: {
    name: string;
    email: string;
    phone: string;
  };
  onPaymentSuccess?: () => void;
  disabled?: boolean;
  className?: string;
}

export const PaymentButton: React.FC<PaymentButtonProps> = ({
  bookingId,
  amount,
  customerDetails,
  onPaymentSuccess,
  disabled,
  className,
}) => {
  const { initiatePyment, loading, error } = useRazorpayPayment({
    onSuccess: (paymentData) => {
      toast.success("Payment successful!", {
        description: `Payment ID: ${paymentData.razorpay_payment_id}`,
      });
      onPaymentSuccess?.();
    },
    onFailure: (error) => {
      console.error("Payment failed:", error);
      toast.error("Payment failed", {
        description: error.description || error.message || "Please try again",
      });
    },
    onCancel: () => {
      toast.info("Payment cancelled by user");
    },
  });

  const handlePayment = () => {
    initiatePyment(bookingId, customerDetails);
  };

  return (
    <div>
      <button
        onClick={handlePayment}
        disabled={disabled || loading}
        className={`px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold 
                   hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed 
                   transition-colors ${className || ""}`}
      >
        {loading ? (
          <span className="flex items-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Processing...
          </span>
        ) : (
          `Pay ₹${(amount / 100).toFixed(2)}`
        )}
      </button>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
};
```

## Usage in a Booking Page

Example `pages/book/[id].tsx` or `app/book/[id]/page.tsx`:

```typescript
"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PaymentButton } from "../../components/PaymentButton";

interface Booking {
  id: number;
  amount: number;
  consultantType: string;
  details: string;
  status: string;
}

export default function BookingPaymentPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchBookingDetails();
    fetchUserDetails();
  }, []);

  const fetchBookingDetails = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/bookings/${params.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setBooking(data.data.booking);
      }
    } catch (error) {
      console.error("Failed to fetch booking:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setUser(data.data.student);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
    }
  };

  const handlePaymentSuccess = () => {
    // Redirect to success page or dashboard
    router.push("/dashboard?payment=success");
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  if (!booking || !user) {
    return (
      <div className="text-red-600 p-8">Booking or user details not found</div>
    );
  }

  if (booking.status !== "PENDING") {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Payment Status</h1>
        <p>This booking is currently {booking.status.toLowerCase()}.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6">Complete Payment</h1>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="font-semibold mb-2">
          {booking.consultantType.replace("_", " ")}
        </h2>
        <p className="text-sm text-gray-600 mb-2">{booking.details}</p>
        <p className="text-lg font-bold">
          Amount: ₹{(booking.amount / 100).toFixed(2)}
        </p>
      </div>

      <PaymentButton
        bookingId={booking.id}
        amount={booking.amount}
        customerDetails={{
          name: user.name,
          email: user.email,
          phone: user.phone,
        }}
        onPaymentSuccess={handlePaymentSuccess}
        className="w-full"
      />
    </div>
  );
}
```

## Error Handling and User Feedback

Create `components/PaymentStatus.tsx`:

```typescript
import React from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

interface PaymentStatusProps {
  status: "success" | "failed" | "pending";
  message?: string;
  paymentId?: string;
}

export const PaymentStatus: React.FC<PaymentStatusProps> = ({
  status,
  message,
  paymentId,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case "success":
        return {
          icon: CheckCircleIcon,
          color: "text-green-600",
          bgColor: "bg-green-50",
          title: "Payment Successful!",
          defaultMessage: "Your payment has been processed successfully.",
        };
      case "failed":
        return {
          icon: XCircleIcon,
          color: "text-red-600",
          bgColor: "bg-red-50",
          title: "Payment Failed",
          defaultMessage:
            "There was an issue processing your payment. Please try again.",
        };
      case "pending":
        return {
          icon: ClockIcon,
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          title: "Payment Pending",
          defaultMessage: "Your payment is being processed. Please wait...",
        };
    }
  };

  const {
    icon: Icon,
    color,
    bgColor,
    title,
    defaultMessage,
  } = getStatusConfig();

  return (
    <div className={`p-6 rounded-lg ${bgColor}`}>
      <div className="flex items-center">
        <Icon className={`h-8 w-8 ${color} mr-3`} />
        <div>
          <h3 className={`text-lg font-semibold ${color}`}>{title}</h3>
          <p className="text-gray-700 mt-1">{message || defaultMessage}</p>
          {paymentId && (
            <p className="text-sm text-gray-500 mt-2">
              Payment ID: {paymentId}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
```

## Testing the Integration

### Manual Testing Steps

1. **Create a booking** through your normal flow
2. **Initiate payment** using the PaymentButton component
3. **Use Razorpay test cards**:
   - Success: `4111111111111111`
   - Failure: `4000000000000002`
   - CVV: Any 3 digits
   - Expiry: Any future date

### Test Card Numbers

```javascript
// Razorpay Test Cards
const TEST_CARDS = {
  success: {
    number: "4111111111111111",
    cvv: "123",
    expiry: "12/25",
  },
  failure: {
    number: "4000000000000002",
    cvv: "123",
    expiry: "12/25",
  },
  internationalSuccess: {
    number: "4242424242424242",
    cvv: "123",
    expiry: "12/25",
  },
};
```

## Error Scenarios to Handle

1. **Network failures**
2. **Invalid booking states**
3. **Razorpay script loading failures**
4. **Payment verification failures**
5. **User cancellation**

## Security Considerations

1. **Never expose** `RAZORPAY_KEY_SECRET` on frontend
2. **Always verify payments** on the backend
3. **Use HTTPS** in production
4. **Validate all inputs** before sending to API
5. **Handle sensitive data** securely (don't log payment details)

## Next Steps

1. Test the integration with Razorpay test mode
2. Set up webhook URL in Razorpay dashboard
3. Configure production keys when ready
4. Implement additional payment methods if needed
5. Add analytics/tracking for payment events
