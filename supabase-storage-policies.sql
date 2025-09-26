-- Policies pour le bucket user-files dans Supabase Storage
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Policy pour permettre aux utilisateurs authentifiés d'uploader leurs fichiers
INSERT INTO storage.policies (name, bucket_id, operation, role, definition) 
VALUES (
  'Allow authenticated users to upload their own files',
  'user-files',
  'INSERT',
  'authenticated',
  '(auth.uid()::text = (storage.foldername(name))[1])'
);

-- 2. Policy pour permettre aux utilisateurs authentifiés de voir leurs fichiers
INSERT INTO storage.policies (name, bucket_id, operation, role, definition)
VALUES (
  'Allow authenticated users to view their own files',
  'user-files', 
  'SELECT',
  'authenticated',
  '(auth.uid()::text = (storage.foldername(name))[1])'
);

-- 3. Policy pour permettre aux utilisateurs authentifiés de supprimer leurs fichiers
INSERT INTO storage.policies (name, bucket_id, operation, role, definition)
VALUES (
  'Allow authenticated users to delete their own files',
  'user-files',
  'DELETE', 
  'authenticated',
  '(auth.uid()::text = (storage.foldername(name))[1])'
);

-- 4. Policy pour permettre l'accès public en lecture (pour les URLs publiques)
INSERT INTO storage.policies (name, bucket_id, operation, role, definition)
VALUES (
  'Allow public access for viewing files',
  'user-files',
  'SELECT',
  'public',
  'true'
);

-- 5. Activer RLS sur le bucket
UPDATE storage.buckets SET public = true WHERE id = 'user-files';