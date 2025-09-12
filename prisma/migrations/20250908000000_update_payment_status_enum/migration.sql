-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "status_new" "PaymentStatus" NOT NULL DEFAULT 'PENDING';

-- Update existing data - map BookingStatus values to PaymentStatus
UPDATE "Payment" SET "status_new" = 
  CASE 
    WHEN "status"::text = 'CONFIRMED' THEN 'SUCCESS'::"PaymentStatus"
    WHEN "status"::text = 'PENDING' THEN 'PENDING'::"PaymentStatus"
    WHEN "status"::text = 'CANCELLED' THEN 'FAILED'::"PaymentStatus"
    ELSE 'PENDING'::"PaymentStatus"
  END;

-- Drop old column and rename new column
ALTER TABLE "Payment" DROP COLUMN "status";
ALTER TABLE "Payment" RENAME COLUMN "status_new" TO "status";

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");