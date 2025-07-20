# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run start:dev          # Hot reload development server
npm run start:debug        # Debug mode with watch
npm run start:prod         # Production mode

# Build & Quality
npm run build              # TypeScript compilation
npm run lint               # ESLint with auto-fix
npm run format             # Prettier formatting

# Docker
docker build -t smart-recipe-backend .
docker run -p 8081:8081 -p 8083:8083 smart-recipe-backend
```

## Architecture Overview

This is a **NestJS TypeScript backend** for an AI-powered recipe recommendation system with the following key characteristics:

### Core Technology Stack
- **Framework**: NestJS v10.3.8 with TypeScript 5.4+
- **AI**: LangGraph v0.3.8 + Ollama (gemma2:2b model)
- **Databases**: MongoDB (primary), Elasticsearch (search), Redis (cache)
- **Real-time**: WebSocket with Socket.IO for streaming AI responses
- **Authentication**: JWT with Passport + Redis sessions

### Domain Architecture
The codebase follows a **domain-driven modular design** with clear separation:

```
📁 Core Infrastructure
├── database/     - MongoDB connection and configuration
├── cache/        - Redis with memory fallback caching
└── elasticsearch/ - Recipe search with Korean language support

📁 User Domain  
├── user/         - User profile and preferences
├── auth/         - JWT authentication and session management
└── allergen/     - Allergy type management

📁 Recipe Domain
└── recipe/       - Recipe CRUD with metadata (views, ratings, bookmarks)

📁 AI Domain
├── ai/           - Multi-provider AI service (Ollama primary)
├── langgraph/    - LangGraph v0.3.8 workflows for complex AI tasks  
└── conversation/ - ChatGPT-style conversational AI

📁 Communication
├── websocket/    - Real-time WebSocket gateway
└── chat/         - Chat message handling
```

### Key Features
- **Advanced AI Integration**: LangGraph workflows for multi-step AI reasoning
- **Hybrid Search**: Elasticsearch + MongoDB for optimized recipe discovery
- **Allergy-Aware**: Integrated allergy filtering throughout the system
- **Real-time Streaming**: WebSocket-based AI response streaming
- **Multi-level Caching**: Redis + memory cache with intelligent fallback

## Critical Configuration

### Environment Variables
The system requires several external services configured in `.env`:

```bash
# Required external services
MONGODB_URI=mongodb://recipe_admin:RecipeAI2024!@192.168.0.112:27017/recipe_ai_db
ELASTICSEARCH_URL=http://192.168.0.112:9200  
REDIS_URL=redis://:RecipeAI2024!@192.168.0.112:6379
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma2:2b

# Server configuration
PORT=8081           # HTTP server
WEBSOCKET_PORT=8083 # WebSocket server
```

### TypeScript Configuration
- **Strict mode** enabled with comprehensive null checks
- **Path aliases**: `@/*` (src), `@/modules/*`, `@/shared/*` 
- **ES2022 target** with decorators for NestJS
- **Source maps** enabled for debugging

### Service Dependencies
1. **MongoDB**: Primary database (Atlas cloud or local)
2. **Elasticsearch**: Recipe search engine with Korean analyzer
3. **Redis**: Session cache and real-time data
4. **Ollama**: Local AI model server (gemma2:2b)

## Key Implementation Patterns

### Module Organization
Each domain module follows a consistent structure:
- **Controller**: HTTP endpoints with Swagger documentation
- **Service**: Business logic and external service integration  
- **Schema/Entity**: MongoDB models with validation
- **DTO**: Request/response validation with class-validator
- **Interfaces**: TypeScript contracts for complex types

### LangGraph Workflows
The system uses **LangGraph v0.3.8** for complex AI workflows:
- Located in `src/modules/langgraph/`
- Supports streaming responses via WebSocket
- Includes RAG (Retrieval-Augmented Generation) capabilities
- State management for multi-step AI reasoning

### Real-time Communication
WebSocket implementation supports:
- **Streaming AI responses**: Token-by-token output
- **LangGraph workflow updates**: Real-time progress
- **Chat message handling**: Persistent conversation history
- **Connection management**: Automatic reconnection and cleanup

### Search Architecture
Hybrid search combining:
- **Elasticsearch**: Fast text search with Korean language support
- **MongoDB**: Complex relationship queries and metadata
- **Allergy filtering**: Multi-level safety verification
- **Caching**: Search result optimization with Redis

## Important Development Notes

### Error Handling
The system implements comprehensive error handling:
- **Global exception filters** for consistent API responses
- **Service-level error recovery** with fallback mechanisms
- **WebSocket error propagation** for real-time communication
- **AI service fallbacks** when primary providers fail

### Performance Considerations
- **Connection pooling** for all external services
- **Streaming responses** to reduce perceived latency
- **Multi-level caching** (Redis → Memory → Source)
- **Lazy loading** for non-critical data

### Security Implementation
- **JWT tokens** with configurable expiration
- **bcrypt password hashing** (12 rounds)
- **Input validation** on all endpoints
- **CORS configuration** for cross-origin requests

### API Documentation
- **Swagger/OpenAPI** available at `/api/docs`
- **Structured endpoints**: `/api/{domain}/{action}`
- **WebSocket events**: Documented in README.md
- **Response standardization** across all endpoints

## Development Workflow

When working with this codebase:

1. **External Services**: Ensure MongoDB, Elasticsearch, Redis, and Ollama are running
2. **Environment Setup**: Copy `.env.production` to `.env` and adjust for local development
3. **Database Initialization**: Run data indexing scripts if working with search features
4. **Real-time Testing**: Use WebSocket client for testing streaming AI features
5. **AI Model**: Verify Ollama model (gemma2:2b) is downloaded and accessible

## Common Troubleshooting

- **AI Connection Issues**: Check Ollama service status at `http://localhost:11434/api/tags`
- **Search Problems**: Verify Elasticsearch connection and recipe index existence
- **Cache Issues**: Clear Redis cache if experiencing stale data
- **WebSocket Failures**: Check port 8083 availability and firewall settings
- **Build Errors**: Run `npm run lint` to identify TypeScript issues

## Developer Notes: Overcoming "Fundamentals Paralysis"

**⚠️ Warning: Avoid Deep Rabbit Holes**

The original developer of this codebase experienced "fundamentals paralysis" - an obsession with understanding every technical detail before proceeding. This significantly slowed development progress.

### What NOT to do:
- **Don't** spend weeks learning TCP packet structures when implementing HTTP APIs
- **Don't** dive into JVM internals when using Node.js/TypeScript
- **Don't** study Elasticsearch Lucene algorithms when simple search queries suffice
- **Don't** implement complex OOP patterns when simple functions work fine
- **Don't** pursue "perfect" theoretical knowledge before writing practical code

### What TO do instead:
- **Use existing abstractions**: NestJS, LangGraph, Elasticsearch clients work fine without deep internals knowledge
- **Focus on business value**: Solving user problems (recipe recommendations, allergy safety) matters more than technical perfection
- **Iterate quickly**: 70% understanding + working code > 100% understanding + no progress
- **Learn by doing**: Practical implementation teaches more than theoretical study
- **Embrace "good enough"**: Most production systems use pragmatic solutions, not theoretical ideals

### Practical Development Approach:
```typescript
// ❌ Over-engineered "perfect" approach
abstract class AbstractRecipeProcessorFactory<T extends Recipe> {
  abstract createProcessor(): IRecipeProcessor<T>;
}

// ✅ Pragmatic working approach  
function processRecipe(recipe: Recipe): ProcessedRecipe {
  return {
    ...recipe,
    processed: true,
    processedAt: new Date()
  };
}
```

### Reality Check:
- Most successful developers know APIs, not internals
- Companies pay for working features, not theoretical knowledge  
- "Perfect" code that ships late loses to "good enough" code that ships on time
- Deep technical knowledge is valuable, but not at the expense of delivery

**Remember**: This codebase works well using standard patterns and abstractions. Don't let perfectionism prevent you from building valuable features for users.