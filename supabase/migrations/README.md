# Workflow Executions Migration

## How to apply this migration

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New query**
4. Copy and paste the content of `create_workflow_executions.sql`
5. Click **Run** to execute the migration

### Option 2: Via Supabase CLI

If you have the Supabase CLI installed:

```bash
# Navigate to the ai-chatbot directory
cd /home/youssefachour1208/github/chat-sdk/ai-chatbot

# Run the migration
supabase db push
```

## What this migration does

1. **Creates the `WorkflowExecution` table** with:
   - `id`: UUID primary key
   - `workflowId`: Reference to the workflow
   - `userId`: Reference to the user who executed the workflow
   - `workflowTitle`: Title of the workflow at execution time
   - `executionData`: JSONB containing all execution details (nodes, variables, logs)
   - `status`: Execution status (success, error, partial)
   - `createdAt`: Timestamp of execution

2. **Creates indexes** for better query performance on:
   - `userId` (to quickly find user's executions)
   - `workflowId` (to find executions of a specific workflow)
   - `createdAt` (to sort executions by date)

3. **Enables Row Level Security (RLS)** with policies:
   - Users can only view their own executions
   - Users can only create their own executions
   - Users can only delete their own executions

## Verification

After running the migration, verify it worked:

```sql
-- Check if table exists
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'WorkflowExecution';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'WorkflowExecution';

-- Check policies
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'WorkflowExecution';
```

## Rollback (if needed)

If you need to remove this migration:

```sql
-- Drop the table (this will delete all data!)
DROP TABLE IF EXISTS "WorkflowExecution" CASCADE;
```

**⚠️ Warning**: This will permanently delete all workflow execution history!
