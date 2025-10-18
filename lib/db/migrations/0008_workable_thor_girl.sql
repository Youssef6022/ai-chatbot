CREATE TABLE IF NOT EXISTS "chat_file_attachments" (
	"chat_id" varchar NOT NULL,
	"file_id" uuid NOT NULL,
	"attached_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_file_attachments_chat_id_file_id_pk" PRIMARY KEY("chat_id","file_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" varchar NOT NULL,
	"original_name" varchar NOT NULL,
	"mime_type" varchar NOT NULL,
	"size_bytes" integer NOT NULL,
	"blob_url" varchar NOT NULL,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_file_attachments" ADD CONSTRAINT "chat_file_attachments_file_id_user_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."user_files"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Foreign key constraint removed: chat_id is varchar but Chat.id is uuid (incompatible types)
-- Relationship managed at application level
