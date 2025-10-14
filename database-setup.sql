-- Migration SQL pour ajouter la table UserQuota
-- À exécuter dans Supabase SQL Editor

-- Création de la table UserQuota
CREATE TABLE IF NOT EXISTS "UserQuota" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL REFERENCES "User"("id"),
    "smallUsed" integer DEFAULT 0 NOT NULL,
    "smallLimit" integer DEFAULT 5000 NOT NULL,
    "mediumUsed" integer DEFAULT 0 NOT NULL,
    "mediumLimit" integer DEFAULT 2000 NOT NULL,
    "largeUsed" integer DEFAULT 0 NOT NULL,
    "largeLimit" integer DEFAULT 500 NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
);

-- Index pour optimiser les requêtes par userId
CREATE INDEX IF NOT EXISTS "UserQuota_userId_idx" ON "UserQuota"("userId");

-- Contrainte unique pour s'assurer qu'un utilisateur n'a qu'un seul quota
ALTER TABLE "UserQuota" ADD CONSTRAINT "UserQuota_userId_unique" UNIQUE ("userId");

-- Politique RLS (Row Level Security) pour la sécurité
ALTER TABLE "UserQuota" ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux utilisateurs de voir seulement leurs propres quotas
CREATE POLICY "Users can view own quota" ON "UserQuota"
  FOR SELECT USING (auth.uid() = "userId");

-- Politique pour permettre aux utilisateurs de mettre à jour leurs propres quotas
CREATE POLICY "Users can update own quota" ON "UserQuota"
  FOR UPDATE USING (auth.uid() = "userId");

-- Politique pour permettre l'insertion de nouveaux quotas
CREATE POLICY "Users can insert own quota" ON "UserQuota"
  FOR INSERT WITH CHECK (auth.uid() = "userId");

-- Optionnel: Créer des quotas par défaut pour les utilisateurs existants
INSERT INTO "UserQuota" ("userId", "smallUsed", "smallLimit", "mediumUsed", "mediumLimit", "largeUsed", "largeLimit")
SELECT 
    "id" as "userId",
    0 as "smallUsed",
    5000 as "smallLimit", 
    0 as "mediumUsed",
    2000 as "mediumLimit",
    0 as "largeUsed", 
    500 as "largeLimit"
FROM "User" 
WHERE "id" NOT IN (SELECT "userId" FROM "UserQuota")
ON CONFLICT ("userId") DO NOTHING;