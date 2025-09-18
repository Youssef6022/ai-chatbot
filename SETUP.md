# Configuration du Chatbot AI

Ce guide vous explique comment configurer et lancer le chatbot AI sur votre serveur.

## 1. Variables d'environnement requises

Créez un fichier `.env.local` dans le dossier `ai-chatbot/` avec les variables suivantes :

```env
# Secret pour l'authentification (générez avec: openssl rand -base64 32)
AUTH_SECRET=your_secret_here

# Clé API AI Gateway (requis pour déploiement non-Vercel)
AI_GATEWAY_API_KEY=your_api_key_here

# Token Vercel Blob pour le stockage de fichiers
BLOB_READ_WRITE_TOKEN=your_blob_token_here

# URL base de données PostgreSQL
POSTGRES_URL=your_postgres_url_here

# URL Redis (optionnel mais recommandé)
REDIS_URL=your_redis_url_here
```

## 2. Infrastructure manquante à configurer

### Base de données PostgreSQL
Vous devez configurer une base de données PostgreSQL. Options recommandées :

- **Option 1** : [Neon](https://neon.tech) (recommandé) - Base de données serverless
- **Option 2** : [Supabase](https://supabase.com) - Alternative avec interface graphique
- **Option 3** : PostgreSQL local/serveur - Pour un contrôle total

### Stockage de fichiers Vercel Blob
Pour le stockage des fichiers uploadés :

- Créez un projet Vercel pour obtenir le `BLOB_READ_WRITE_TOKEN`
- Ou implémentez un autre système de stockage (S3, etc.)

### AI Gateway API Key
Pour l'accès aux modèles AI :

- Obtenez une clé sur [Vercel AI Gateway](https://vercel.com/ai-gateway)
- Ou configurez directement les providers AI (OpenAI, Anthropic, etc.)

### Redis (optionnel)
Pour la mise en cache et l'optimisation des performances :

- [Upstash Redis](https://upstash.com) (recommandé)
- Redis local/serveur
- Ou tout autre provider Redis compatible

## 3. Étapes d'installation

```bash
# Naviguer vers le dossier du projet
cd ai-chatbot

# Installer les dépendances
pnpm install

# Générer les types de base de données
pnpm run db:generate

# Exécuter les migrations de base de données
pnpm run db:migrate

# Lancer le serveur de développement
pnpm dev
```

## 4. Configuration des providers AI

Le code utilise actuellement xAI (Grok) via le Gateway Vercel. Pour utiliser d'autres providers, modifiez le fichier `lib/ai/providers.ts`.

### Exemple pour OpenAI :
```typescript
import { openai } from '@ai-sdk/openai';

// Remplacez les modèles gateway par :
'chat-model': openai('gpt-4'),
'title-model': openai('gpt-3.5-turbo'),
```

## 5. Configuration de l'authentification

Le système utilise Auth.js avec plusieurs providers configurables dans `app/(auth)/auth.config.ts` :

- Google OAuth
- GitHub OAuth  
- Authentification par email/mot de passe
- Mode invité

## 6. Scripts utiles

```bash
# Base de données
pnpm run db:studio     # Interface graphique Drizzle Studio
pnpm run db:push       # Push du schéma sans migration
pnpm run db:pull       # Pull du schéma depuis la DB

# Code quality
pnpm run lint          # Linting avec Biome
pnpm run format        # Formatage du code

# Tests
pnpm test              # Tests Playwright
```

## 7. Vérification de l'installation

Une fois tout configuré, l'application devrait être accessible sur `http://localhost:3000` avec :

- ✅ Interface de chat fonctionnelle
- ✅ Authentification utilisateur
- ✅ Stockage des conversations
- ✅ Upload de fichiers
- ✅ Réponses AI en streaming

## Dépannage

### Erreur de base de données
- Vérifiez que `POSTGRES_URL` est correcte
- Exécutez `pnpm run db:migrate` pour créer les tables

### Erreur AI Gateway
- Vérifiez votre `AI_GATEWAY_API_KEY`
- Ou configurez un provider direct (OpenAI, etc.)

### Erreur de stockage
- Vérifiez le `BLOB_READ_WRITE_TOKEN`
- Ou désactivez temporairement l'upload de fichiers