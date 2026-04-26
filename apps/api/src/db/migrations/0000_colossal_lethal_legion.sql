CREATE TABLE "pad_docs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"pad_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"head_revision_id" bigint,
	"head_revision_number" bigint DEFAULT 0 NOT NULL,
	"checkpoint_revision_id" bigint,
	"checkpoint_revision_number" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pad_docs_pad_kind_unique" UNIQUE("pad_id","kind"),
	CONSTRAINT "pad_docs_kind_check" CHECK ("pad_docs"."kind" IN ('text', 'drawing'))
);
--> statement-breakpoint
CREATE TABLE "pad_revisions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"doc_id" bigint NOT NULL,
	"revision_number" bigint NOT NULL,
	"parent_revision_id" bigint,
	"reverted_from_revision_id" bigint,
	"update" bytea NOT NULL,
	"snapshot" bytea,
	"event_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pad_revisions_doc_revision_number_unique" UNIQUE("doc_id","revision_number")
);
--> statement-breakpoint
CREATE TABLE "pads" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"root_path" text NOT NULL,
	"parent_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pads_path_unique" UNIQUE("path"),
	CONSTRAINT "pads_path_check" CHECK ("pads"."path" <> '/' AND "pads"."path" NOT LIKE '%//%' AND "pads"."path" ~ '^/.+$'),
	CONSTRAINT "pads_path_launch_check" CHECK (octet_length("pads"."path") <= 512 AND "pads"."path" !~ '[[:cntrl:]]' AND "pads"."path" NOT LIKE '%\%%' ESCAPE '\'),
	CONSTRAINT "pads_root_path_check" CHECK ("pads"."root_path" <> '/' AND "pads"."root_path" NOT LIKE '%//%' AND "pads"."root_path" ~ '^/.+$' AND ("pads"."path" = "pads"."root_path" OR "pads"."path" LIKE "pads"."root_path" || '/%')),
	CONSTRAINT "pads_root_path_launch_check" CHECK (octet_length("pads"."root_path") <= 512 AND "pads"."root_path" !~ '[[:cntrl:]]' AND "pads"."root_path" NOT LIKE '%\%%' ESCAPE '\'),
	CONSTRAINT "pads_parent_path_check" CHECK ("pads"."parent_path" IS NULL OR ("pads"."parent_path" <> "pads"."path" AND "pads"."parent_path" <> '/' AND "pads"."parent_path" NOT LIKE '%//%' AND "pads"."parent_path" ~ '^/.+$')),
	CONSTRAINT "pads_parent_path_launch_check" CHECK ("pads"."parent_path" IS NULL OR (octet_length("pads"."parent_path") <= 512 AND "pads"."parent_path" !~ '[[:cntrl:]]' AND "pads"."parent_path" NOT LIKE '%\%%' ESCAPE '\'))
);
--> statement-breakpoint
ALTER TABLE "pad_docs" ADD CONSTRAINT "pad_docs_pad_id_pads_id_fk" FOREIGN KEY ("pad_id") REFERENCES "public"."pads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pad_revisions" ADD CONSTRAINT "pad_revisions_doc_id_pad_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."pad_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pad_docs_pad_kind" ON "pad_docs" USING btree ("pad_id","kind");--> statement-breakpoint
CREATE INDEX "idx_pad_revisions_doc_desc" ON "pad_revisions" USING btree ("doc_id","revision_number" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_pad_revisions_doc_created_at" ON "pad_revisions" USING btree ("doc_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_pad_revisions_doc_snapshot" ON "pad_revisions" USING btree ("doc_id","revision_number" DESC NULLS LAST) WHERE "pad_revisions"."snapshot" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_pads_root_path" ON "pads" USING btree ("root_path","path");--> statement-breakpoint
CREATE INDEX "idx_pads_parent_path" ON "pads" USING btree ("parent_path","path");
