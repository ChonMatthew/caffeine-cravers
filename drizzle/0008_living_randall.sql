ALTER TABLE "items" ADD COLUMN "station" text DEFAULT 'drink' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "station" text DEFAULT 'drink' NOT NULL;--> statement-breakpoint
-- Backfill: the existing catalog's food-ish display categories move to the
-- 'food' station; every other category (all coffee/drinks) keeps the 'drink'
-- default. One-time data fix, not a schema change, so it lives in this same
-- migration rather than a separate script.
UPDATE "items" SET "station" = 'food' WHERE "category" IN ('Snacks', 'Food', 'Add On');--> statement-breakpoint
-- Propagate that onto already-placed order lines (itemName match — order_items
-- has no reliable item_id once an item is archived/renamed, but nothing in the
-- existing catalog has been renamed across the food/drink line).
UPDATE "order_items" oi SET "station" = i."station" FROM "items" i WHERE oi."item_id" = i."id";--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_station_valid" CHECK ("items"."station" in ('food', 'drink'));--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_station_valid" CHECK ("order_items"."station" in ('food', 'drink'));