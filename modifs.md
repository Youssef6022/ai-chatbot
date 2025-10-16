# RÉCAPITULATIF COMPLET DES MODIFICATIONS - MAGISTRAL AI

## 1. CORRECTIONS CRITIQUES ET PRIORITAIRES

### 1.1 Problèmes Urgents
- **🔴 CRITIQUE - Affichage Mobile du Chat**
  - Le menu n'apparait pas sur mobile, rendant le menu inaccessible
  - Correction prioritaire car le chat doit rester fonctionnel sur tous les supports
  - Action requise : Corriger le système de menu dépliable mobile

### 1.2 Corrections Mineures Immédiates
- **Titre de l'application** : Remplacer "Next.js Chatbot Template" par "Magistral AI" dans les onglets navigateur ✅
- **Logo** : Ajouter le vrai logo Magistral en haut de l'interface ✅
- **Bug Artefact** : L'artefact se rouvre automatiquement lors du démarrage d'un nouveau chat après fermeture ✅

## 2. SYSTÈME D'AUTHENTIFICATION

### 2.1 Modifications de Connexion
- **Méthode d'authentification** : 
  - Email uniquement avec Magic Link (pas de gestion de mot de passe)
  - Provider Google
  - Envoi automatique de Magic Link par email
- **Restriction d'accès** : chat.magistral.ai doit être inaccessible sans connexion

## 3. INTERFACE CHAT

### 3.1 Modifications de l'Interface
- **Supprimer** : Les 4 boutons de suggestions au-dessus de la barre de message ✅ 
- **Quotas d'affichage** : 
  - Exprimer en nombre de messages (pas en tokens) ✅
  - Format : "Small xx/50, Medium xx/10, Large PRO" ✅
- **Sélection de modèle** : 
  - Proposer "Magistral Small", "Magistral Medium", "Magistral Large (Pro)" ✅
- **Fonction Grounding** : 
  - Ajouter l'option useSearchGrounding ✅
  - Icône planète avec "Recherche web" ✅
- **Thinking Process** : 
  - Ajouter un chevron pour déplier et voir la réflexion de l'IA ✅

## 4. SYSTÈME D'ARTEFACTS

### 4.1 Améliorations Interface
- **Clarification de l'interactivité** :
  - Ajouter un indicateur visuel informant que l'édition directe est possible ✅
- **Outils de sélection** :
  - Supprimer les fonctions inutiles en bas à droite ✅
  - OU permettre de sélectionner un passage et modifier via prompt spécifique ✅

### 4.2 Fonctionnalités d'Export
- **Export Google Docs** : Permettre la copie directe vers Google Docs ✅
- **Formatage** : 
  - Option pour changer le format de copie (actuellement conserve le Markdown) ✅
  - Permettre un formatage standard pour Word/Google Docs ✅
- **Export CSV** : 
  - Remplacer "copy as .csv" par un vrai téléchargement "download as .csv" ✅
  - Option d'export vers Google Sheets ✅

### 4.3 Types d'Artefacts Supportés
- Text Artifact : Rédaction d'essais et emails ✅
- Code Artifact : Écriture et exécution de code ✅
- Sheet Artifact : Création et analyse de données tabulaires ✅

A voir comment on les améliore...

## 5. SYSTÈME DE WORKFLOWS

### 5.1 Corrections UX
- **Position des nouveaux éléments** : 
  - Les éléments "+ add" doivent apparaître sous la barre de création ✅
  - Non plus en bas de la toile ✅
- **Console d'édition** : 
  - Considérer le placement sur le volet de droite (comme n8n et ChatGPT Workflow), ou revoir l'intégration en bas comme actuellement ✅
- **Gestion des variables** : 
  - Notification rouge avec le nombre de variables non remplies 
  - Détection automatique des variables dans les prompts ✅

### 5.2 Nouvelles Fonctionnalités

#### 5.2.1 Node Tools
- **Google Search** : Ancrage pour recherche Google ✅
- **RAG (Retrieval-Augmented Generation)** :
  - Bibliothèque de RAG pré-classés par domaine
  - Exemple : Code Civil, Code du Commerce pour avocats
  - RAG personnalisés via demande à Magistral (pour entreprises)

#### 5.2.2 Forms
- **Ajout de formulaires** dans les workflows :
  - Label (titre du form)
  - Zone de texte (textarea)
  - Champ simple
  - Liste déroulante
  - Add Files
  - Select Files in library
  - Champ Description (optionnel)

#### 5.2.3 Notes
- **Fonction "Note"** : Post-it jaune pour annotations sur la toile
- Permettre la description du workflow ✅

#### 5.2.4 Nodes Conditionnels
- Création de conditions pour diriger le flux
- Exemple : Si mention "code civil" → direction vers node avec RAG Code Civil
- Permet de créer des agents décisionnels autonomes

### 5.3 Système de Prompts
- **Prompts de base** : 
  - Assistant général par défaut
  - Possibilité de sélectionner/créer d'autres system prompts
  - Variables intégrées dans les prompts
- **Priorité d'affichage** : User prompt doit avoir plus d'espace (plus important)

## 6. PAGE RUN

### 6.1 Structure de la Page
**Volet Gauche - Module d'Exécution** :
- Champs d'entrée dynamiques (forms)
- Upload de fichiers
- Bouton "Run" principal

**Volet Droite - Suivi d'Exécution** :
- Liste des étapes avec indicateurs visuels
- ✓ pour étapes complétées
- Animation pour étape en cours
- Étapes en attente en gris
- Bouton "show result" par étape
- Indicateur de progression global

### 6.2 Fonctionnalités
1. Récupération et complétion des formulaires
2. Envoi du run
3. Suivi en temps réel des étapes
4. Accès aux outputs individuels ou final
5. Export vers Google Docs ou téléchargement texte

### 6.3 États de Gestion
- Pending : En attente
- In Progress : En cours
- Success : Terminé
- Failed : Échec
- Cancelled : Annulé

## 7. SYSTÈME DE LIBRARY ET TEMPLATES

### 7.1 Library
- **Data Privacy** :
  - Mode anonymisation des documents
  - Run en mode privacy
  - Innovation majeure de Magistral

### 7.2 Templates et Import
- **Import de Workflows** :
  - Remplacer nom de fichier par URL dans le JSON
  - Téléchargement automatique des documents lors de l'import
  - Tag "template" + nom du scénario
- **Native Workflows** :
  - Workflows ajoutés automatiquement dans tous les comptes
  - Bouton on/off pour "hide Native WF"
  - Premiers workflows : Article, Social Posts, Legal
- **Recherche** :
  - Barre de recherche pour templates
  - Filtrage Custom/Magistral

## 8. SYSTÈME DE TRADUCTION

- Détection automatique de la langue du navigateur
- Stockage dans localStorage/cookie
- Fichiers de traduction français/anglais

## 9. SYSTÈME DE BILLING ET ABONNEMENTS

### 9.1 Structure des Plans

#### Free (par défaut)
- Quotas limités Small et Medium
- Magistral Small pour workflows

#### Pro (24,99€ - Essai 7 jours avec CB)
- Quotas généreux
- Accès Magistral Large
- Accès RAG public
- Accès total workflows
- Accès Data Privacy

#### Max (79,99€)
- Gros quotas

#### Enterprise (sur mesure)
- RAGs privés/personnalisés
- Clé API Google Gemini
- Facturation mensuelle
- Workflows personnalisés

### 9.2 Système de Gestion
- Billing via Stripe
- Contact support
- Système d'affiliation (futur)
- Page de souscription

### 9.3 Gestion des Messages
- 1 passage par agent = 1 message débité
- Restrictions par plan utilisateur
- Mode Large réservé Pro/Max/Enterprise

## 11. RECOMMANDATIONS UX/UI

### 11.1 Améliorations Visuelles
1. **Indicateurs d'état** :
   - Badges colorés pour les quotas (vert/orange/rouge)
   - Animation de chargement cohérente
   - Tooltips informatifs au survol

2. **Responsive Design** :
   - Menu hamburger fonctionnel mobile

3. **Dark Mode** :
   - Cohérence des couleurs sur tous les éléments ✅
   - Contraste optimal pour la lisibilité✅

### 11.2 Optimisations Interface
1. **Workflow Builder** :
   - Grille magnétique pour alignement
   - Faire apparaître une poubelle sur les blocs sélectionnés pour les supprimer