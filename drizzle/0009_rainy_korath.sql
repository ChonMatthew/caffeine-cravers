CREATE TABLE "shops" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"ref_prefix" text NOT NULL,
	CONSTRAINT "shops_ref_prefix_unique" UNIQUE("ref_prefix")
);
--> statement-breakpoint
-- The two fixed shops. Slug ids and prefixes are permanent; names are display.
INSERT INTO "shops" ("id", "name", "ref_prefix") VALUES
	('bukit-tinggi', 'Bukit Tinggi', 'BT'),
	('cheras', 'Cheras', 'CH');--> statement-breakpoint
-- Generated as ADD COLUMN ... NOT NULL, which fails on tables that already
-- have rows. Hand-edited (as in 0008): add nullable, backfill, then tighten.
ALTER TABLE "items" ADD COLUMN "shop_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shop_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ref_no" integer;--> statement-breakpoint
-- Everything that existed before the split belongs to shop #1, Bukit Tinggi.
UPDATE "items" SET "shop_id" = 'bukit-tinggi';--> statement-breakpoint
UPDATE "orders" SET "shop_id" = 'bukit-tinggi';--> statement-breakpoint
-- Renumber existing orders BT-1..BT-N in placement order, with no gaps (decided
-- 2026-10-05: old paper tickets' Ref # deliberately no longer match).
UPDATE "orders" o SET "ref_no" = r."n"
FROM (SELECT "id", row_number() OVER (ORDER BY "order_seq") AS "n" FROM "orders") r
WHERE o."id" = r."id";--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "shop_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "shop_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "ref_no" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_shop_idx" ON "items" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "orders_shop_created_at_idx" ON "orders" USING btree ("shop_id","created_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_ref_no_unique" UNIQUE("shop_id","ref_no");
