ALTER TABLE "ballots" DROP CONSTRAINT "ballots_group_id_parliamentary_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "ballots" DROP CONSTRAINT "ballots_committee_id_committees_id_fk";
--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_group_id_parliamentary_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."parliamentary_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ballots_committee_id" ON "ballots" USING btree ("committee_id");