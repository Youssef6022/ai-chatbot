const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createUserFilesTable() {
  try {
    console.log('Creating user_files table...');
    
    const { data, error } = await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS user_files (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          filename VARCHAR NOT NULL,
          original_name VARCHAR NOT NULL,
          mime_type VARCHAR NOT NULL,
          size_bytes INTEGER NOT NULL,
          blob_url VARCHAR NOT NULL,
          tags TEXT[] DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_user_files_user_id ON user_files(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_files_mime_type ON user_files(mime_type);
        CREATE INDEX IF NOT EXISTS idx_user_files_created_at ON user_files(created_at DESC);
      `
    });

    if (error) {
      console.error('Error creating table:', error);
      process.exit(1);
    }

    console.log('✅ user_files table created successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

createUserFilesTable();