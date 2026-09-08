ALTER TABLE "ballots" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "ballots" ADD COLUMN "committee_id" text;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_group_id_parliamentary_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."parliamentary_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ballots_group_id" ON "ballots" USING btree ("group_id");--> statement-breakpoint
UPDATE "ballots" SET "group_id" = "users"."group_id", "committee_id" = "users"."committee_id" FROM "users" WHERE "ballots"."user_id" = "users"."id";
