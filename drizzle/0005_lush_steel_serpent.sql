ALTER TABLE "orders" ADD COLUMN "cash_tendered_cents" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "change_cents" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tendered_nonneg" CHECK ("orders"."cash_tendered_cents" is null or "orders"."cash_tendered_cents" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_change_nonneg" CHECK ("orders"."change_cents" is null or "orders"."change_cents" >= 0);