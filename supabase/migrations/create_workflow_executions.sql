-- Create workflow_executions table
CREATE TABLE IF NOT EXISTS "WorkflowExecution" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflowId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "workflowTitle" TEXT NOT NULL,
  "executionData" JSONB NOT NULL,
  "status" VARCHAR NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'partial')),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT "WorkflowExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE,
  CONSTRAINT "WorkflowExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "WorkflowExecution_userId_idx" ON "WorkflowExecution"("userId");
CREATE INDEX IF NOT EXISTS "WorkflowExecution_workflowId_idx" ON "WorkflowExecution"("workflowId");
CREATE INDEX IF NOT EXISTS "WorkflowExecution_createdAt_idx" ON "WorkflowExecution"("createdAt" DESC);

-- Add RLS (Row Level Security) policies
ALTER TABLE "WorkflowExecution" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own executions
CREATE POLICY "Users can view their own workflow executions"
  ON "WorkflowExecution"
  FOR SELECT
  USING (auth.uid() = "userId");

-- Policy: Users can insert their own executions
CREATE POLICY "Users can create their own workflow executions"
  ON "WorkflowExecution"
  FOR INSERT
  WITH CHECK (auth.uid() = "userId");

-- Policy: Users can delete their own executions
CREATE POLICY "Users can delete their own workflow executions"
  ON "WorkflowExecution"
  FOR DELETE
  USING (auth.uid() = "userId");
