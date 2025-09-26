-- Migration pour ajouter la table user_files
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

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_user_files_user_id ON user_files(user_id);
CREATE INDEX IF NOT EXISTS idx_user_files_mime_type ON user_files(mime_type);
CREATE INDEX IF NOT EXISTS idx_user_files_created_at ON user_files(created_at DESC);

-- Table pour les attachements de chat (optionnel pour plus tard)
CREATE TABLE IF NOT EXISTS chat_file_attachments (
  chat_id VARCHAR NOT NULL,
  file_id UUID NOT NULL REFERENCES user_files(id) ON DELETE CASCADE,
  attached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (chat_id, file_id)
);

-- RLS (Row Level Security) pour la sécurité
ALTER TABLE user_files ENABLE ROW LEVEL SECURITY;

-- Policy : les utilisateurs ne voient que leurs fichiers
CREATE POLICY user_files_isolation ON user_files
  USING (auth.uid() = user_id);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_files_updated_at
    BEFORE UPDATE ON user_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();