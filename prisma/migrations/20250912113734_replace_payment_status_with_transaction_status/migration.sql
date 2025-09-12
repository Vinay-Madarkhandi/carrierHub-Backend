/*
  Warnings:

  - Changed the type of `status` on the `Payment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."TransactionStatus" AS ENUM ('COMPLETED', 'REJECTED', 'PROCESSING', 'REFUNDED');

-- AlterTable
ALTER TABLE "public"."Payment" DROP COLUMN "status",
ADD COLUMN     "status" "public"."TransactionStatus" NOT NULL;

-- DropEnum
DROP TYPE "public"."PaymentStatus";
