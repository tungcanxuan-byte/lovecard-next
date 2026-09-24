ALTER TABLE "cards" ADD COLUMN "paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_anonymous" boolean DEFAULT false;