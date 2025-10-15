# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Next.js 15 AI chatbot application built with the Vercel AI SDK. The project demonstrates a full-featured chat application with authentication, database persistence, file uploads, and multi-provider AI integration.

## Development Commands

**Package Manager**: This project uses `pnpm` as the package manager (required). See `"packageManager": "pnpm@9.12.3"` in package.json.

### Core Development
- **Development server**: `pnpm dev` (runs on port 9627 with Turbo)
- **Build**: `pnpm build` (includes automatic database migration)
- **Production server**: `pnpm start`

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

## Architecture Overview

### AI Integration
- **Primary Framework**: Vercel AI SDK with multiple provider support
- **Default Provider**: Google (Gemini models) direct integration
- **Models Configuration**: `lib/ai/providers.ts` defines model mappings
- **Available Models**: 
  - `chat-model-small`: `gemini-2.5-flash-lite`
  - `chat-model-medium`: `gemini-2.5-flash`
  - `chat-model-large`: `gemini-2.5-pro`
  - `title-model`: `gemini-2.5-flash-lite`
  - `artifact-model`: `gemini-2.5-flash`
- **Test Environment**: Uses mock models from `lib/ai/models.mock.ts`

### Database Architecture (PostgreSQL + Drizzle ORM)
- **Schema Location**: `lib/db/schema.ts`
- **Migrations**: `lib/db/migrations/` directory
- **Core Tables**:
  - `User`: User accounts with email/password authentication
  - `Chat`: Chat sessions with visibility (public/private) and context tracking
  - `Message_v2`: Current message format with parts and attachments support
  - `Message` (deprecated): Legacy message format - migration guide available
  - `Vote_v2`: Message voting system with chat/message relationships
  - `Document`: Document management with different types (text, code, image, sheet)
  - `Suggestion`: Document editing suggestions with resolution tracking
  - `Stream`: Stream tracking for real-time chat functionality
- **Database Queries**: Centralized in `lib/db/queries.ts`
- **Migration Helper**: `lib/db/helpers/01-core-to-parts.ts` for message format migration

### Authentication (Supabase Auth)
- **Middleware**: `middleware.ts` handles session management with Supabase
- **Auth Routes**: Login (`/login`), Register (`/register`), Auth callback (`/auth/callback`), Signout (`/api/auth/signout`)
- **Session Updates**: Automatic session refresh via Supabase middleware
- **Guest Support**: Allows unauthenticated access with appropriate route protection
- **Password Hashing**: Uses `bcrypt-ts` for secure password handling

### File Storage
- **Provider**: Vercel Blob Storage
- **Configuration**: `BLOB_READ_WRITE_TOKEN` environment variable
- **Supports**: File uploads in chat interface

### Application Structure
- **Framework**: Next.js 15 with App Router and Turbopack for development
- **UI Library**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS v4 with custom configuration
- **Icons**: Lucide React + Simple Icons (`@icons-pack/react-simple-icons`)
- **Editor**: ProseMirror integration for rich document editing
- **Code Highlighting**: Shiki with multiple language support + CodeMirror for interactive editing (supports JavaScript, Python)
- **Data Fetching**: SWR for client-side data management
- **Animations**: Framer Motion for smooth UI transitions

## Environment Variables

Required environment variables (see `.env.example`):

```env
AUTH_SECRET=**** # Generate with: openssl rand -base64 32
BLOB_READ_WRITE_TOKEN=**** # Vercel Blob storage token
POSTGRES_URL=**** # PostgreSQL database connection string
REDIS_URL=**** # Optional Redis for caching/performance
GOOGLE_GENERATIVE_AI_API_KEY=**** # Google AI API key for Gemini models
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

### Workflow Builder
- Visual workflow designer using ReactFlow (`@xyflow/react`)
- Two node types: Text Input (prompt) and Generate Text (AI generation)
- Variable replacement system with global variables and connected node results
- JSON export/import functionality for workflow persistence
- Real-time execution with API integration at `/api/workflow/generate`
- Accessible via `/workflows` route

### Advanced AI Features
- Multi-turn conversations with context preservation
- Tool calling capabilities (weather via `get-weather.ts`, document management, suggestions)
- Model migration system for backward compatibility (`migrateModelId` function)
- AI entitlements system for usage control (`lib/ai/entitlements.ts`)
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
- **Mock AI Models**: Test environment automatically uses mock providers
- **Test Routes**: `/ping` endpoint for Playwright health checks

## Key Architectural Patterns

### API Route Structure
- **Chat API**: `/api/chat/` with streaming support and individual chat endpoints
- **File Upload**: `/api/files/upload/` for Vercel Blob storage integration
- **Documents**: `/api/document/` for document CRUD operations
- **History**: `/api/history/` for chat history management
- **Workflow**: `/api/workflow/generate` for workflow execution
- **Voting**: `/api/vote/` for message voting functionality
- **Suggestions**: `/api/suggestions/` for document editing suggestions

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
- Redis is optional but recommended for production performance and caching
- Message format migration: Legacy `Message` table is deprecated, use `Message_v2` for new code
- React 19 RC is used (`react@19.0.0-rc-45804af1-20241021`)
- File uploads support: JSZip for archive handling, PapaParse for CSV processing