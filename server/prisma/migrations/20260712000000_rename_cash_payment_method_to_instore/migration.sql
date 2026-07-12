-- Preserve existing paid instore records while changing the payment-method label.
-- PostgreSQL 10+ supports renaming an enum value in place.
ALTER TYPE "PaymentMethod" RENAME VALUE 'CASH' TO 'INSTORE';
