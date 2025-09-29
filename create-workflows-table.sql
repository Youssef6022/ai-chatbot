-- Create workflows table to store user workflows
CREATE TABLE IF NOT EXISTS "Workflow" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "workflowData" JSONB NOT NULL,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS "idx_workflow_userId" ON "Workflow"("userId");
CREATE INDEX IF NOT EXISTS "idx_workflow_public" ON "Workflow"("isPublic") WHERE "isPublic" = true;
CREATE INDEX IF NOT EXISTS "idx_workflow_created" ON "Workflow"("createdAt");

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updatedAt
CREATE TRIGGER update_workflow_updated_at 
    BEFORE UPDATE ON "Workflow"
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();