ALTER TABLE "pads" DROP CONSTRAINT "pads_path_launch_check";--> statement-breakpoint
ALTER TABLE "pads" ADD CONSTRAINT "pads_path_launch_check" CHECK (octet_length("pads"."path") <= 512 AND "pads"."path" !~ '[[:cntrl:]]');--> statement-breakpoint
ALTER TABLE "pads" DROP CONSTRAINT "pads_root_path_launch_check";--> statement-breakpoint
ALTER TABLE "pads" ADD CONSTRAINT "pads_root_path_launch_check" CHECK (octet_length("pads"."root_path") <= 512 AND "pads"."root_path" !~ '[[:cntrl:]]');--> statement-breakpoint
ALTER TABLE "pads" DROP CONSTRAINT "pads_parent_path_launch_check";--> statement-breakpoint
ALTER TABLE "pads" ADD CONSTRAINT "pads_parent_path_launch_check" CHECK ("pads"."parent_path" IS NULL OR (octet_length("pads"."parent_path") <= 512 AND "pads"."parent_path" !~ '[[:cntrl:]]'));
