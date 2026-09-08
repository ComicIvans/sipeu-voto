ALTER TABLE "votes" ADD COLUMN "opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_schedule_ordered" CHECK ("votes"."opens_at" IS NULL OR "votes"."closes_at" IS NULL OR "votes"."closes_at" > "votes"."opens_at");