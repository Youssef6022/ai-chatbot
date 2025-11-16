#!/bin/bash

# Script to apply the WorkflowExecution migration to Supabase
# This script reads the SQL file and provides instructions for applying it

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/create_workflow_executions.sql"

echo "========================================="
echo "Workflow Executions Migration"
echo "========================================="
echo ""

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found at:"
    echo "   $MIGRATION_FILE"
    exit 1
fi

echo "✅ Migration file found"
echo ""
echo "This migration will create the WorkflowExecution table in your Supabase database."
echo ""
echo "📋 What will be created:"
echo "   • WorkflowExecution table with RLS enabled"
echo "   • Indexes for better query performance"
echo "   • Security policies for user data isolation"
echo ""
echo "📝 Migration file location:"
echo "   $MIGRATION_FILE"
echo ""
echo "========================================="
echo "How to apply this migration:"
echo "========================================="
echo ""
echo "Option 1: Via Supabase Dashboard (Recommended)"
echo "   1. Go to your Supabase project dashboard"
echo "   2. Navigate to SQL Editor"
echo "   3. Click 'New query'"
echo "   4. Copy and paste the content of the migration file"
echo "   5. Click 'Run'"
echo ""
echo "Option 2: Via psql (if you have direct database access)"
echo "   psql \$POSTGRES_URL < \"$MIGRATION_FILE\""
echo ""
echo "========================================="
echo ""

read -p "Would you like to view the migration SQL? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "========================================="
    echo "Migration SQL:"
    echo "========================================="
    cat "$MIGRATION_FILE"
    echo ""
fi

echo ""
echo "✅ Ready to apply migration!"
echo ""
echo "After applying, verify with:"
echo "   SELECT table_name FROM information_schema.tables WHERE table_name = 'WorkflowExecution';"
echo ""
