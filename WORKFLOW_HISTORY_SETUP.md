# Historique des Exécutions de Workflows - Guide de Configuration

## 📋 Vue d'ensemble

Un système complet d'historique des exécutions de workflows a été implémenté avec Supabase comme backend de stockage. Chaque exécution de workflow est automatiquement sauvegardée avec toutes ses données.

## ✅ Ce qui a été fait

### 1. **Schéma de base de données**

Nouveau schéma dans `lib/db/schema.ts`:
- Table `WorkflowExecution` avec les champs:
  - `id`: UUID unique
  - `workflowId`: Référence au workflow
  - `userId`: Référence à l'utilisateur
  - `workflowTitle`: Titre du workflow
  - `executionData`: JSONB contenant tous les détails (nodes, variables, logs)
  - `status`: Statut (success/error/partial)
  - `createdAt`: Date/heure d'exécution

### 2. **Migration SQL**

Fichier de migration créé: `supabase/migrations/create_workflow_executions.sql`

Contient:
- Création de la table avec contraintes
- Indexes pour performance (userId, workflowId, createdAt)
- Row Level Security (RLS) activé
- Politiques de sécurité (les utilisateurs ne voient que leurs propres exécutions)

### 3. **Fonctions de base de données**

Ajouté dans `lib/db/queries.ts`:
- `saveWorkflowExecution()` - Sauvegarder une exécution
- `getWorkflowExecutionsByUserId()` - Récupérer toutes les exécutions d'un utilisateur
- `getWorkflowExecutionsByWorkflowId()` - Récupérer les exécutions d'un workflow spécifique
- `getWorkflowExecutionById()` - Récupérer une exécution par ID
- `deleteWorkflowExecution()` - Supprimer une exécution

### 4. **Routes API**

Créées dans `app/api/workflow-executions/route.ts`:
- `GET /api/workflow-executions` - Liste des exécutions (avec filtre optionnel par workflowId)
- `POST /api/workflow-executions` - Sauvegarder une nouvelle exécution
- `DELETE /api/workflow-executions?id=xxx` - Supprimer une exécution

### 5. **Sauvegarde automatique**

Dans `app/(chat)/workflows/page.tsx`:
- Chaque exécution de workflow appelle automatiquement l'API POST
- Toutes les données sont sauvegardées:
  - Résultats de tous les AI Agents
  - Variables utilisées
  - Logs d'exécution
  - Métadonnées (modèle, température, etc.)

### 6. **Interface utilisateur**

Page d'historique: `app/(chat)/workflow-history/page.tsx`
- Liste des exécutions avec:
  - Titre du workflow
  - Date/heure formatée
  - Statut coloré (vert/rouge/orange)
  - Nombre de résultats et logs
- Panneau de détails affichant:
  - Variables globales
  - Résultats de chaque AI Agent
  - Thinking de chaque agent
  - Logs d'exécution avec timestamps
  - Bouton de suppression

### 7. **Bouton d'accès rapide**

Dans `app/(chat)/workflows/page.tsx`:
- Nouveau bouton "Historique" avec icône d'horloge
- Positionné à côté du bouton "Run"
- Navigation directe vers `/workflow-history`

## 🚀 Installation

### Étape 1: Appliquer la migration SQL

**Via Supabase Dashboard (Recommandé):**

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Cliquez sur **SQL Editor** dans le menu latéral
4. Cliquez sur **New query**
5. Copiez le contenu de `supabase/migrations/create_workflow_executions.sql`
6. Collez-le dans l'éditeur
7. Cliquez sur **Run** pour exécuter

**Via script:**

```bash
./scripts/apply-workflow-executions-migration.sh
```

### Étape 2: Vérifier la migration

Dans l'éditeur SQL de Supabase, exécutez:

```sql
-- Vérifier que la table existe
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'WorkflowExecution';

-- Vérifier que RLS est activé
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'WorkflowExecution';

-- Vérifier les politiques
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'WorkflowExecution';
```

Vous devriez voir:
- 1 table nommée `WorkflowExecution`
- `rowsecurity` = `true`
- 3 politiques (SELECT, INSERT, DELETE)

### Étape 3: Tester

1. Lancez votre application: `pnpm dev`
2. Allez sur `/workflows`
3. Créez et exécutez un workflow
4. Cliquez sur le bouton **Historique**
5. Vous devriez voir votre exécution dans la liste!

## 📊 Structure des données sauvegardées

Chaque exécution contient dans `executionData`:

```json
{
  "nodes": [
    {
      "id": "node-xxx",
      "type": "generate",
      "data": {
        "variableName": "AI Agent 1",
        "userPrompt": "...",
        "systemPrompt": "...",
        "result": "Résultat généré...",
        "thinking": "Processus de réflexion...",
        "model": "chat-model-medium",
        "temperature": 0.7
      }
    }
  ],
  "variables": [
    {
      "name": "myVar",
      "value": "valeur",
      "type": "global"
    }
  ],
  "executionLogs": [
    {
      "type": "info",
      "message": "Starting workflow...",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ]
}
```

## 🔧 Fonctionnalités

### Affichage de l'historique
- ✅ Liste triée par date (plus récente en premier)
- ✅ Filtrage par statut visuel (couleurs)
- ✅ Recherche rapide visuelle
- ✅ Limite de 50 exécutions par défaut (configurable)

### Détails d'une exécution
- ✅ Toutes les variables utilisées
- ✅ Résultats de chaque AI Agent
- ✅ Thinking de chaque agent (collapsible)
- ✅ Logs d'exécution chronologiques
- ✅ Métadonnées du modèle

### Gestion
- ✅ Suppression d'exécutions
- ✅ Sécurité RLS (isolation par utilisateur)
- ✅ Performance optimisée (indexes)

## 🔐 Sécurité

- **RLS activé**: Chaque utilisateur ne peut voir que ses propres exécutions
- **Foreign keys**: Relations strictes avec User et Workflow
- **Politiques**:
  - SELECT: `auth.uid() = userId`
  - INSERT: `auth.uid() = userId`
  - DELETE: `auth.uid() = userId`

## 📈 Performance

- **Indexes créés** sur:
  - `userId` (pour lister rapidement les exécutions d'un user)
  - `workflowId` (pour voir l'historique d'un workflow)
  - `createdAt DESC` (pour trier par date)

- **JSONB**: Format efficace pour données variables
- **Limite par défaut**: 50 exécutions maximum par requête

## 🎨 Design

- Interface cohérente avec le reste de l'application
- Couleurs de statut:
  - 🟢 Vert: Succès
  - 🔴 Rouge: Erreur
  - 🟠 Orange: Partiel
- Sections collapsibles pour économiser l'espace
- Scrollbar personnalisée
- Dark mode supporté

## 🔄 Prochaines étapes possibles

1. **Filtres avancés**:
   - Par date
   - Par workflow
   - Par statut
   - Par recherche textuelle

2. **Export**:
   - Export en JSON
   - Export en CSV
   - Partage d'exécutions

3. **Analytics**:
   - Graphiques de performance
   - Statistiques d'utilisation
   - Coûts par modèle

4. **Replay**:
   - Rejouer une exécution
   - Comparer deux exécutions
   - Restaurer une exécution

## ⚠️ Notes importantes

- La table `WorkflowExecution` est liée à `Workflow` avec CASCADE DELETE
- Si un workflow est supprimé, toutes ses exécutions seront aussi supprimées
- Les exécutions de workflows "temp_" (non sauvegardés) sont aussi conservées
- Aucune limite de stockage n'est implémentée (à surveiller en production)

## 🐛 Dépannage

### L'historique est vide
1. Vérifiez que la migration SQL a été appliquée
2. Vérifiez les logs du navigateur (Console)
3. Vérifiez les logs de l'API `/api/workflow-executions`
4. Vérifiez que vous êtes bien connecté

### Erreur "Unauthorized"
- Assurez-vous d'être connecté
- Vérifiez que Supabase Auth fonctionne

### Exécutions ne s'enregistrent pas
- Vérifiez les logs de la console lors de l'exécution
- Vérifiez la route API POST `/api/workflow-executions`
- Vérifiez les politiques RLS dans Supabase

## 📝 Fichiers modifiés/créés

### Créés:
- `supabase/migrations/create_workflow_executions.sql`
- `supabase/migrations/README.md`
- `scripts/apply-workflow-executions-migration.sh`
- `app/api/workflow-executions/route.ts`
- `app/(chat)/workflow-history/page.tsx`
- `WORKFLOW_HISTORY_SETUP.md` (ce fichier)

### Modifiés:
- `lib/db/schema.ts` (ajout table WorkflowExecution)
- `lib/db/queries.ts` (ajout 5 fonctions)
- `app/(chat)/workflows/page.tsx` (sauvegarde auto + bouton historique)

## ✅ Checklist de vérification

- [ ] Migration SQL appliquée dans Supabase
- [ ] Table `WorkflowExecution` créée
- [ ] RLS activé avec 3 politiques
- [ ] Build réussi (`pnpm build`)
- [ ] Application démarre (`pnpm dev`)
- [ ] Exécution d'un workflow sauvegarde dans la DB
- [ ] Page `/workflow-history` accessible
- [ ] Liste des exécutions s'affiche
- [ ] Détails d'une exécution s'affichent
- [ ] Suppression d'une exécution fonctionne

---

**Build status**: ✅ Réussi (build terminé avec succès)
**Migration status**: ⏳ À appliquer manuellement dans Supabase Dashboard
