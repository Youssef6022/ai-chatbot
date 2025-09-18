# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Next.js 15 AI chatbot application built with the Vercel AI SDK. The project demonstrates a full-featured chat application with authentication, database persistence, file uploads, and multi-provider AI integration.

## Development Commands

**Package Manager**: This project uses `pnpm` as the package manager (required).

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

## Architecture Overview

### AI Integration
- **Primary Framework**: Vercel AI SDK with multiple provider support
- **Default Provider**: xAI (Grok models) via Vercel AI Gateway
- **Models Configuration**: `lib/ai/providers.ts` defines model mappings
- **Available Models**: 
  - `chat-model`: `grok-2-vision-1212` (main chat)
  - `chat-model-reasoning`: `grok-3-mini` with reasoning middleware
  - `title-model`: `grok-2-1212` (chat titles)
  - `artifact-model`: `grok-2-1212` (document generation)

### Database Architecture (PostgreSQL + Drizzle ORM)
- **Schema Location**: `lib/db/schema.ts`
- **Migrations**: `lib/db/migrations/` directory
- **Core Tables**:
  - `User`: User accounts with email/password
  - `Chat`: Chat sessions with visibility and context
  - `Message` (deprecated): Old message format
  - New message parts system for improved message handling
- **Database Queries**: Centralized in `lib/db/queries.ts`

### Authentication (Auth.js/NextAuth)
- **Configuration**: `app/(auth)/auth.config.ts`
- **Providers**: Google OAuth, GitHub OAuth, Email/Password, Guest mode
- **Session Management**: Server-side session handling
- **Auth Secret**: Configurable via `AUTH_SECRET` environment variable

### File Storage
- **Provider**: Vercel Blob Storage
- **Configuration**: `BLOB_READ_WRITE_TOKEN` environment variable
- **Supports**: File uploads in chat interface

### Application Structure
- **Framework**: Next.js 15 with App Router
- **UI Library**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS
- **Icons**: Lucide React + Simple Icons
- **Editor**: ProseMirror integration for document editing
- **Code Highlighting**: Shiki with multiple language support

## Environment Variables

Required environment variables (see `.env.example`):

```env
AUTH_SECRET=**** # Generate with: openssl rand -base64 32
AI_GATEWAY_API_KEY=**** # Required for non-Vercel deployments
BLOB_READ_WRITE_TOKEN=**** # Vercel Blob storage token
POSTGRES_URL=**** # PostgreSQL database connection string
REDIS_URL=**** # Optional Redis for caching/performance
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

### Advanced AI Features
- Multi-turn conversations with context
- Tool calling capabilities (weather, documents, suggestions)
- Reasoning model support with thinking middleware
- Token usage tracking and analytics

## Development Workflow

1. **Setup Environment**: Copy `.env.example` to `.env.local` and fill in values
2. **Install Dependencies**: `pnpm install`
3. **Database Setup**: `pnpm run db:generate && pnpm run db:migrate`
4. **Start Development**: `pnpm dev`
5. **Code Quality**: Run `pnpm run lint:fix` before commits

## Important Development Notes

- Always run database migrations after schema changes
- Use Biome for code formatting and linting (configured in project)
- Test environment uses mock AI providers (see `lib/ai/models.mock.ts`)
- Port 9627 is used for development to avoid conflicts
- Authentication supports both authenticated and guest users
- Redis is optional but recommended for production performance