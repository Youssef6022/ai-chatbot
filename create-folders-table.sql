-- Migration pour ajouter les dossiers dans Supabase
CREATE TABLE IF NOT EXISTS user_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  parent_folder_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajouter la colonne folder_id à user_files si elle n'existe pas
ALTER TABLE user_files ADD COLUMN IF NOT EXISTS folder_id UUID;

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_user_folders_user_id ON user_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_user_folders_parent ON user_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_user_files_folder_id ON user_files(folder_id);

-- RLS policies pour les dossiers
ALTER TABLE user_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own folders" ON user_folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own folders" ON user_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders" ON user_folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders" ON user_folders
  FOR DELETE USING (auth.uid() = user_id);