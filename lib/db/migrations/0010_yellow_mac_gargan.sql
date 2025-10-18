CREATE TABLE IF NOT EXISTS "user_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar NOT NULL,
	"parent_folder_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_files' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE "user_files" ADD COLUMN "folder_id" uuid;
  END IF;
END $$;