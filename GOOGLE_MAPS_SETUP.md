# Google Maps & Google Search Setup

Ce guide explique comment activer Google Maps et Google Search dans l'application en utilisant le nouveau SDK Google GenAI.

## 🎯 Qu'est-ce qui a été ajouté ?

Une nouvelle implémentation parallèle utilisant `@google/genai` (SDK officiel Google) qui supporte:
- ✅ **Google Maps** - Recherche de lieux, directions, informations géographiques
- ✅ **Google Search** - Recherche web native
- ✅ **Reasoning Mode** - Pensée étendue du modèle

## 📁 Fichiers ajoutés

1. **`/app/(chat)/api/chat-genai/route.ts`** - Nouvelle route API utilisant Google GenAI SDK
2. **`/hooks/use-chat-genai.ts`** - Hook React personnalisé pour le streaming
3. **`/lib/config.ts`** - Configuration centralisée
4. **`/lib/ai/providers.ts`** - Client Google GenAI initialisé

## 🚀 Comment activer Google Maps ?

### Option 1: Variable d'environnement (Recommandé pour tester)

1. **Ajouter la variable dans `.env.local`:**
   ```bash
   NEXT_PUBLIC_USE_GENAI_SDK=true
   ```

2. **Redémarrer le serveur de développement:**
   ```bash
   pnpm dev
   ```

3. **Utiliser le sélecteur de grounding dans le chat:**
   - Cliquer sur l'icône globe (🌍)
   - Sélectionner "Google Maps" ou "Google Search"
   - Envoyer un message comme: "clos des diablotins 2 vers Cora Woluwe"

### Option 2: Utiliser directement la nouvelle route (Pour tests avancés)

Au lieu de passer par l'interface, vous pouvez appeler directement `/api/chat-genai`:

```typescript
const response = await fetch('/api/chat-genai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: chatId,
    message: {
      id: generateUUID(),
      role: 'user',
      parts: [{ type: 'text', text: 'Restaurant près de la Tour Eiffel' }],
    },
    selectedChatModel: 'chat-model-medium',
    selectedVisibilityType: 'private',
    groundingType: 'maps', // 'maps', 'search', ou 'none'
    isReasoningEnabled: false,
  }),
});
```

## 🔧 Configuration du grounding

Le grounding type peut prendre 3 valeurs:

| Valeur | Description | Use Case |
|--------|-------------|----------|
| `'none'` | Pas de grounding | Chat normal |
| `'search'` | Google Search | Infos actuelles, news, recherches web |
| `'maps'` | Google Maps | Lieux, directions, infos géographiques |

## 📊 Différences entre les deux implémentations

### Ancienne (Vercel AI SDK + `@ai-sdk/google`)
- ✅ Outils de document (create, update)
- ✅ Suggestions de modifications
- ✅ Streaming UI automatique
- ✅ Support de tous les artefacts
- ❌ **PAS de Google Maps**
- ✅ Google Search (via `google.tools.googleSearch`)

### Nouvelle (`@google/genai` SDK)
- ✅ **Google Maps natif**
- ✅ **Google Search natif**
- ✅ Streaming basique
- ✅ Weather tool
- ⚠️ Pas encore de support pour les outils de document
- ⚠️ Pas encore de support pour les artefacts complexes

## 🧪 Tester Google Maps

### Exemples de requêtes:

**Recherche de lieux:**
```
Restaurant italien à Bruxelles
```

**Directions:**
```
Comment aller de clos des diablotins 2 vers Cora Woluwe
```

**Informations géographiques:**
```
Où se trouve la Grand Place de Bruxelles ?
```

## 🔐 Sécurité

- La clé API `GOOGLE_GENERATIVE_AI_API_KEY` est utilisée pour les deux implémentations
- Elle est stockée côté serveur uniquement (pas exposée au client)
- Les messages sont sauvegardés dans la base de données comme avant

## 🐛 Debugging

Si ça ne fonctionne pas:

1. **Vérifier que la variable d'environnement est définie:**
   ```bash
   echo $NEXT_PUBLIC_USE_GENAI_SDK
   ```

2. **Vérifier les logs du serveur:**
   - Regarder la console pour les erreurs de streaming
   - Vérifier que le client GenAI est bien initialisé

3. **Vérifier que la clé API est valide:**
   - Tester dans Google AI Studio: https://aistudio.google.com

## 🚧 Limitations actuelles

- ❌ Les outils de document (createDocument, updateDocument) ne fonctionnent pas encore avec GenAI
- ❌ Les suggestions ne sont pas encore supportées
- ❌ L'interface n'a pas encore de toggle visuel (il faut passer par la variable d'env)
- ❌ Pas de support pour `resumeStream` (reprise de conversation interrompue)

## 📝 Prochaines étapes

Pour une migration complète:

1. Adapter les outils de document pour GenAI
2. Créer un adaptateur pour les artefacts
3. Ajouter un toggle UI pour basculer entre les implémentations
4. Migrer progressivement toutes les fonctionnalités
5. Une fois stable, supprimer l'ancienne implémentation

## 💡 Astuce

Pour tester rapidement sans modifier l'environnement, vous pouvez directement appeler la route `/api/chat-genai` depuis un outil comme Postman ou directement depuis le code.

## 📚 Documentation

- [Google GenAI SDK](https://ai.google.dev/)
- [Google Maps Tool](https://ai.google.dev/gemini-api/docs/google-maps)
- [Google Search Tool](https://ai.google.dev/gemini-api/docs/google-search)
