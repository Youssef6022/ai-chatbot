# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Next.js 15 AI chatbot application built with the Vercel AI SDK. The project demonstrates a full-featured chat application with authentication, database persistence, file uploads, and multi-provider AI integration.

## Development Commands

**Package Manager**: This project uses `pnpm` as the package manager (required). See `"packageManager": "pnpm@9.12.3"` in package.json.

### Core Development
- **Development server**: `pnpm dev` (runs on port 9627 with Turbo)
- **Build**: `pnpm build` (includes automatic database migration via `tsx lib/db/migrate`)
- **Production server**: `pnpm start` (runs on port 9627)

### Code Quality
- **Linting**: `pnpm run lint` (uses Biome linter)
- **Linting with auto-fix**: `pnpm run lint:fix` (lint + format)
- **Format**: `pnpm run format` (uses Biome formatter)

### Database Management (Drizzle ORM)
- **Generate types**: `pnpm run db:generate` (generate TypeScript types from schema)
- **Run migrations**: `pnpm run db:migrate` (apply database migrations)
- **Database studio**: `pnpm run db:studio` (visual database interface)
- **Push schema**: `pnpm run db:push` (push schema without migration)
- **Pull schema**: `pnpm run db:pull` (pull schema from database)
- **Check migrations**: `pnpm run db:check`
- **Up migrations**: `pnpm run db:up`

### Testing
- **Run tests**: `pnpm test` (Playwright end-to-end tests)
- **Test Environment Variable**: Set `PLAYWRIGHT=True` to enable test mode with mock AI models

### Utilities
- **Kill port process**: `pnpm run killp` or `./scripts/kill-port.sh` (kills process on port 9627)

## Architecture Overview

### AI Integration
- **Dual SDK Support**: Application supports two AI integration paths:
  - **Vercel AI SDK** (default): Google Gemini via `@ai-sdk/google` with streaming support
  - **Google GenAI SDK**: Native `@google/genai` client enabling Google Maps and Search features
- **SDK Selection**: Controlled via `NEXT_PUBLIC_USE_GENAI_SDK` environment variable in `lib/config.ts`
- **Chat Routes**:
  - `/api/chat/` - Vercel AI SDK streaming endpoint
  - `/api/chat-genai/` - Google GenAI SDK endpoint with Maps/Search support
- **Models Configuration**: `lib/ai/providers.ts` defines model mappings with environment-based switching
- **Available Models**:
  - `chat-model-small`: `gemini-2.5-flash-lite`
  - `chat-model-medium`: `gemini-2.5-flash`
  - `chat-model-large`: `gemini-2.5-pro`
  - `title-model`: `gemini-2.5-flash-lite`
  - `artifact-model`: `gemini-2.5-flash`
- **Test Environment**: Uses mock models from `lib/ai/models.mock.ts` with `isTestEnvironment` flag
- **Alternative Providers**: Support for xAI Gateway and other providers through Vercel AI SDK

### Database Architecture (PostgreSQL + Drizzle ORM)
- **Schema Location**: `lib/db/schema.ts`
- **Migrations**: `lib/db/migrations/` directory
- **Core Tables**:
  - `User`: User accounts with email/password authentication
  - `UserQuota`: Usage tracking and limits for AI model tiers (small/medium/large)
  - `Chat`: Chat sessions with visibility (public/private) and context tracking
  - `Message_v2`: Current message format with parts and attachments support
  - `Message` (deprecated): Legacy message format - migration guide available
  - `Vote_v2`: Message voting system with chat/message relationships
  - `Document`: Document management with different types (text, code, image, sheet)
  - `Suggestion`: Document editing suggestions with resolution tracking
  - `Stream`: Stream tracking for real-time chat functionality
  - `user_files`: File metadata storage (name, MIME type, size, blob URL, tags, folder reference)
  - `user_folders`: Folder structure for organizing user files (supports nested folders)
  - `chat_file_attachments`: Many-to-many relationship between chats and attached files
  - `Workflow`: Workflow persistence with JSON data, public/private visibility
- **Database Queries**: Centralized in `lib/db/queries.ts`
- **Migration Helper**: `lib/db/helpers/01-core-to-parts.ts` for message format migration

### Authentication (Supabase Auth)
- **Middleware**: `middleware.ts` handles session management with Supabase
- **Auth Routes**: Login (`/login`), Register (`/register`), Auth callback (`/auth/callback`), Signout (`/api/auth/signout`)
- **Session Updates**: Automatic session refresh via Supabase middleware
- **Guest Support**: Allows unauthenticated access with appropriate route protection
- **Password Hashing**: Uses `bcrypt-ts` for secure password handling

### File Storage and Management
- **Provider**: Vercel Blob Storage
- **Configuration**: `BLOB_READ_WRITE_TOKEN` environment variable
- **Features**:
  - File uploads in chat interface with attachment support
  - Folder-based organization system (nested folders supported)
  - File metadata tracking (tags, MIME types, sizes)
  - Chat-file associations via `chat_file_attachments` table
  - JSZip for archive handling, PapaParse for CSV processing

### Application Structure
- **Framework**: Next.js 15 with App Router and Turbopack for development
  - Experimental PPR (Partial Prerendering) enabled
  - TypeScript build errors ignored (`typescript.ignoreBuildErrors: true`)
  - Webpack configured with Node.js module fallbacks for client-side compatibility
- **UI Library**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS v4 with custom configuration
- **Icons**: Lucide React + Simple Icons (`@icons-pack/react-simple-icons`)
- **Editor**: ProseMirror integration for rich document editing
- **Code Highlighting**: Shiki with multiple language support + CodeMirror for interactive editing (supports JavaScript, Python)
- **Data Fetching**: SWR for client-side data management
- **Animations**: Framer Motion for smooth UI transitions
- **Image Optimization**: Next.js Image with remote patterns for Vercel Blob, Supabase, Gravatar, and avatar.vercel.sh

## Environment Variables

Required environment variables (see `.env.example`):

```env
# Authentication
AUTH_SECRET=**** # Generate with: openssl rand -base64 32

# Supabase Authentication (required)
NEXT_PUBLIC_SUPABASE_URL=**** # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=**** # Your Supabase anon/public key

# AI Configuration
AI_GATEWAY_API_KEY=**** # AI Gateway API Key (required for non-Vercel deployments)
GOOGLE_GENERATIVE_AI_API_KEY=**** # Google AI API key for Gemini models
NEXT_PUBLIC_USE_GENAI_SDK=false # Set to 'true' to use @google/genai (enables Maps/Search), 'false' for Vercel AI SDK

# Storage
BLOB_READ_WRITE_TOKEN=**** # Vercel Blob storage token

# Database
POSTGRES_URL=**** # PostgreSQL database connection string (supports Neon/Vercel Postgres)
REDIS_URL=**** # Optional Redis for caching/performance

# Testing
PLAYWRIGHT=True # Set to enable test environment with mock AI models
```

## Key Features

### Chat Interface
- Real-time streaming responses
- Message persistence and chat history
- File upload and processing capabilities
- Public/private chat visibility settings
- Chat title generation
- Resizable panels and responsive design

### Document Management
- ProseMirror-based rich text editor
- Document creation and editing tools
- Integration with AI for document generation

### File Library System
- **Library Interface**: Dedicated file management UI at `/library` route
- **Folder Organization**: Hierarchical folder structure with nested folders support
- **File Operations**:
  - Upload files with drag-and-drop support
  - Create/rename/delete folders
  - Move files between folders
  - Tag-based file organization
  - File metadata tracking (MIME type, size, upload date)
- **Library API Routes**:
  - `/api/library/upload` - File upload endpoint
  - `/api/library/files` - List and manage files
  - `/api/library/folders` - Folder CRUD operations
  - `/api/library/folders/[id]/files` - Files within specific folder
  - `/api/library/move` - Move files between folders
  - `/api/library/delete` - Delete files and folders
- **Integration**: Files can be attached to chats via `chat_file_attachments` table

### Workflow Builder
- Visual workflow designer using ReactFlow (`@xyflow/react`)
- **Node Types**:
  - Generate Node: AI text generation with model selection
  - Files Node: File attachment and context management
  - Note Node: Text annotations and documentation
- **Variable System**:
  - Global variables with pre-run configuration modal
  - Variable highlighting in prompts with syntax: `{{variableName}}`
  - Connected node results available as variables
- **AI Grounding Options** (per Generate Node):
  - Google Search: Web search integration for up-to-date information
  - Google Maps: Location-based queries and geographical information
  - RAG (Retrieval-Augmented Generation): Vector search across legal document corpora
    - Code Civil: French civil law corpus
    - Code Commerce: French commercial law corpus
    - Codes Droit Français: Complete French legal system corpus
  - Note: Grounding options are mutually exclusive (only one can be active per node)
- **Features**:
  - JSON export/import for workflow persistence
  - Real-time execution with API integration at `/api/workflow/generate`
  - Workflow console for execution logs and debugging
  - Custom edge styling and connection validation
  - Database persistence via `Workflow` table with public/private visibility
- **Routes**:
  - `/workflows` - Workflow builder and editor interface
  - `/workflows-library` - Browse and manage saved workflows
  - `/api/workflows` - List all workflows
  - `/api/workflows/[id]` - Get/update/delete specific workflow

### Advanced AI Features
- Multi-turn conversations with context preservation
- Tool calling capabilities (weather via `get-weather.ts`, document management, suggestions)
- **RAG (Retrieval-Augmented Generation)**: Vector search integration via Vertex AI
  - Uses `vertexAIClient` for RAG queries (separate from standard `genaiClient`)
  - Three RAG corpora available: Code Civil, Code Commerce, Codes Droit Français
  - Configured in [app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts#L238-L269) with corpus IDs and similarity settings
  - System prompts customized per corpus in [lib/ai/system-prompts.ts](lib/ai/system-prompts.ts)
  - Automatically forces gemini-2.5-medium model with thinking enabled for better legal analysis
  - Supports both chat interface and workflow builder
- Model migration system for backward compatibility (`migrateModelId` function)
- AI entitlements system for usage control with quota management (`lib/ai/entitlements.ts`)
- Usage tracking via `UserQuota` table with limits per model tier (small: 5000, medium: 2000, large: 500)
- Custom prompts and AI personas (`lib/ai/prompts.ts`)
- Token usage tracking and analytics with `tokenlens` integration

## Development Workflow

1. **Setup Environment**: Copy `.env.example` to `.env.local` and fill in values
2. **Install Dependencies**: `pnpm install`
3. **Database Setup**: `pnpm run db:generate && pnpm run db:migrate`
4. **Start Development**: `pnpm dev`
5. **Code Quality**: Run `pnpm run lint:fix` before commits

## Code Quality and Standards

### Biome Configuration
- **Linting and Formatting**: Uses Biome instead of ESLint/Prettier
- **Configuration**: `biome.jsonc` with custom rules for accessibility, complexity, and style
- **Pre-commit**: Run `pnpm run lint:fix` to auto-fix issues before commits
- **Accessibility**: Custom a11y rules with intentional exceptions for UX patterns

### Testing Strategy
- **E2E Testing**: Playwright tests with environment variable `PLAYWRIGHT=True`
- **Test Organization**: Tests are organized into `tests/e2e/` (end-to-end) and `tests/routes/` (API routes)
- **Mock AI Models**: Test environment automatically uses mock providers (`lib/ai/models.mock.ts`)
- **Test Routes**: `/ping` endpoint for Playwright health checks
- **Test Configuration**: `playwright.config.ts` with 240s timeout, Chrome browser, parallelization settings

## Key Architectural Patterns

### API Route Structure
APIs are organized into two directories:
- `app/(chat)/api/` - Chat-related endpoints requiring user context
- `app/api/` - Public/standalone endpoints

**Key API Groups**:
- **Chat API**:
  - `/api/chat/` - Vercel AI SDK streaming endpoint with individual chat management
  - `/api/chat/[id]/stream` - Individual chat streaming endpoint
  - `/api/chat-genai/` - Google GenAI SDK endpoint (when `NEXT_PUBLIC_USE_GENAI_SDK=true`)
- **File Management**:
  - `/api/files/upload/` - Vercel Blob storage integration for chat attachments
  - `/api/library/*` - Complete file library system (upload, folders, move, delete)
- **Documents**: `/api/document/` for document CRUD operations
- **History**: `/api/history/` for chat history management
- **Workflows**:
  - `/api/workflow/generate` - Workflow execution endpoint (in `app/(chat)/api/`)
  - `/api/workflows` - Workflow persistence and listing (in `app/api/`)
  - `/api/workflows/[id]` - Individual workflow operations (in `app/api/`)
- **Voting**: `/api/vote/` for message voting functionality
- **Suggestions**: `/api/suggestions/` for document editing suggestions
- **Quota**: `/api/quota` for user quota management and tracking
- **Anonymization**: `/api/anonymization` for data anonymization utilities

### State Management
- **Server Actions**: Used in `app/(chat)/actions.ts` for server-side operations
- **Client State**: SWR for API data fetching and caching
- **Context**: React Context for global state like theme and user preferences

### Security Considerations
- **Middleware Protection**: Routes protected via Supabase session middleware
- **API Security**: Server-only imports for sensitive operations
- **Environment Isolation**: Separate configuration for test vs production environments

## Important Development Notes

- Always run database migrations after schema changes (`pnpm run db:migrate`)
- Use Biome for all code formatting and linting (configured in `biome.jsonc`)
- Test environment automatically uses mock AI providers (see `lib/ai/models.mock.ts`)
- Port 9627 is used for development to avoid conflicts with other services
- Authentication supports both authenticated and guest users via Supabase
- Supabase configuration requires both URL and anon key environment variables
- Redis is optional but recommended for production performance and caching
- Message format migration: Legacy `Message` table is deprecated, use `Message_v2` for new code
- Vote format migration: Legacy `Vote` table is deprecated, use `Vote_v2` for new code
- React 19 RC is used (`react@19.0.0-rc-45804af1-20241021`)
- File uploads support: JSZip for archive handling, PapaParse for CSV processing
- Advanced dependencies: Data grids (`react-data-grid`), OpenTelemetry monitoring, token analytics (`tokenlens`)
- Workflow system uses ReactFlow with custom node types and variable interpolation
- For production deployments on Vercel, OIDC tokens are used automatically for AI Gateway authentication
- When switching AI providers, modify `lib/ai/providers.ts` to configure model mappings
- **Security**: Never commit API keys or credentials to the repository. Check `scripts/` directory for any test files with hardcoded credentials

### Switching Between AI SDKs
The application supports two AI integration approaches:
- **Vercel AI SDK** (default, `NEXT_PUBLIC_USE_GENAI_SDK=false`): Best for standard chat with streaming and multi-provider support
- **Google GenAI SDK** (`NEXT_PUBLIC_USE_GENAI_SDK=true`): Required for Google Maps integration and Google Search features
- Configuration is centralized in `lib/config.ts`
- Chat routes automatically switch based on configuration (`/api/chat/` vs `/api/chat-genai/`)
- Artifacts and some tools may not be fully supported with GenAI SDK (see deprecation warnings in `lib/ai/providers.ts`)

## Application Routes Structure

### Public Routes
- `/` - Main chat interface (supports guest access)
- `/chat/[id]` - Individual chat view
- `/login` - User authentication
- `/register` - User registration
- `/auth/callback` - Authentication callback
- `/library` - File library management interface
- `/workflows` - Visual workflow builder and editor
- `/workflows-library` - Browse and manage saved workflows
- `/share/[id]` - Shared chat views

### API Routes
**Note**: API routes are split between `app/api/` (public APIs) and `app/(chat)/api/` (chat-related APIs).

**Chat-related APIs** (`app/(chat)/api/`):
- `/api/chat/` - Vercel AI SDK chat streaming and management
- `/api/chat/[id]/stream` - Individual chat streaming endpoint
- `/api/chat-genai/` - Google GenAI SDK chat endpoint (Maps/Search support)
- `/api/files/upload/` - File upload to Vercel Blob for chat attachments
- `/api/document/` - Document CRUD operations
- `/api/workflow/generate` - Workflow execution
- `/api/vote/` - Message voting
- `/api/suggestions/` - Document editing suggestions
- `/api/history/` - Chat history management

**Public APIs** (`app/api/`):
- `/api/auth/signout` - Sign out endpoint
- `/api/library/*` - File library system (upload, folders, move, delete)
- `/api/workflows` - Workflow persistence and listing
- `/api/workflows/[id]` - Get/update/delete specific workflow
- `/api/quota` - User quota management and tracking
- `/api/anonymization` - Data anonymization utilities
- `/ping` - Health check for Playwright tests