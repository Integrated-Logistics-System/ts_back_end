# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this NestJS backend codebase.

## Development Commands

### Local Development
```bash
npm run start:dev         # Start development server with hot reload
npm run start:debug       # Start with debugging enabled
npm run build             # Build for production
npm run start:prod        # Start production server
```

### Testing
```bash
npm run test              # Run unit tests
npm run test:watch        # Run tests in watch mode
npm run test:cov          # Run tests with coverage
npm run test:e2e          # Run end-to-end tests
```

### Code Quality
```bash
npm run lint              # Run ESLint
npm run lint:fix          # Fix ESLint issues automatically
npm run format            # Format code with Prettier
```

## Architecture Overview

This is a NestJS-based backend for a Smart Recipe Chatbot with AI-powered conversation capabilities.

### Key Technologies
- **Framework**: NestJS with TypeScript
- **AI Integration**: Ollama (gemma3n:e4b model)
- **Search Engine**: Elasticsearch for recipe indexing and RAG
- **Databases**: MongoDB (users, chat history), Redis (caching, sessions)
- **Real-time Communication**: Socket.IO WebSocket gateway
- **Authentication**: JWT-based auth with guards and strategies

### Project Structure
```
src/
   main.ts                    # Application entry point
   app.module.ts             # Root module
   modules/                  # Feature modules
      agent/                 # AI Agent system (core business logic)
         core/               # Main agent service
         classification/     # Intent classification
         search/             # Elasticsearch integration
         generation/         # Response generation
      websocket/             # Real-time WebSocket communication
      auth/                  # Authentication & authorization
      user/                  # User management
      chat/                  # Chat history management
      recipe/                # Recipe CRUD operations
      elasticsearch/         # Search engine integration
      ai/                    # AI service abstraction
      cache/                 # Cache management
   shared/                   # Common utilities and interfaces
```

### Core System: Intent-Based Agent Architecture

The system processes user messages through an AI-powered agent that:
1. **Analyzes Context** - Understands conversation history and user preferences
2. **Classifies Intent** - Determines what the user wants (recipe list, details, alternatives, general chat)
3. **Processes Request** - Executes appropriate handler based on intent
4. **Transforms Data** - Converts Elasticsearch data to frontend-compatible format
5. **Generates Response** - Creates AI-powered natural language responses

#### Intent Types
- `RECIPE_LIST` - User wants recipe recommendations/listings
- `RECIPE_DETAIL` - User wants detailed recipe instructions  
- `ALTERNATIVE_RECIPE` - User wants alternative ingredients/methods
- `GENERAL_CHAT` - General conversation not recipe-specific

#### Key Data Flow
```
User Message → WebSocket Gateway → Agent Service → Intent Classifier
     ↓
Elasticsearch Search → Data Transformation → AI Response → WebSocket Response
```

### Critical Backend-Frontend Data Mapping

**Backend transforms Elasticsearch data for frontend consumption:**

```typescript
// Elasticsearch format
{
  nameKo: "첼시의 닭가슴살 요리",
  stepsKo: ["닭가슴살을 준비한다", "양념을 바른다", ...],
  ingredientsKo: ["닭가슴살", "소금", "후추"]
}

// Transformed to frontend format  
{
  title: "첼시의 닭가슴살 요리",
  steps: [
    { step: 1, instruction: "닭가슴살을 준비한다", time: null, tip: null },
    { step: 2, instruction: "양념을 바른다", time: null, tip: null }
  ],
  ingredients: ["닭가슴살", "소금", "후추"]
}
```

**WebSocket Response Structure by Intent:**
- `recipe_list` → `recipes[]` array for RecipeCard components
- `recipe_detail` → `recipeDetail` object for RecipeDetailCard component
- Frontend uses `conversationType` metadata to render appropriate UI

### Environment Configuration

Required services for development:
- **MongoDB**: User data, chat history
- **Redis**: Session management, caching  
- **Elasticsearch**: Recipe search and indexing
- **Ollama**: Local LLM service with gemma3n:e4b model

### Key Environment Variables
```bash
# Database
MONGODB_URI=mongodb+srv://recipe_admin:riqcFEUvo0Bj9EQF@cluster0.zmu0szz.mongodb.net/recipe_ai_db?retryWrites=true&w=majority&appName=Cluster0
REDIS_URL=redis://:RecipeAI2024!@192.168.0.112:6379

# Search & AI
ELASTICSEARCH_URL=http://192.168.0.112:9200
OLLAMA_URL=http://localhost:11434
OLLAMA_LLM_MODEL=gemma3n:e4b
OLLAMA_MAX_TOKENS=4000

# Authentication
JWT_SECRET=recipe-ai-ultra-secure-key-2024!@#$%^&*()_+
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Server
PORT=8081
WEBSOCKET_PORT=8083
NODE_ENV=development
```

## Database & Search Access Commands

### Elasticsearch Access
```bash
# Check cluster health
curl -X GET "192.168.0.112:9200/_cluster/health?pretty"

# List all indices
curl -X GET "192.168.0.112:9200/_cat/indices?v"

# Get recipe count
curl -X GET "192.168.0.112:9200/recipes/_count?pretty"

# Get a sample recipe document
curl -X GET "192.168.0.112:9200/recipes/_search?size=1&pretty"

# Search for specific recipe
curl -X GET "192.168.0.112:9200/recipes/_search?q=닭가슴살&size=1&pretty"
```

### MongoDB Access
```bash
# Connect to MongoDB Atlas (use MongoDB Compass or CLI)
# Connection String: mongodb+srv://recipe_admin:riqcFEUvo0Bj9EQF@cluster0.zmu0szz.mongodb.net/recipe_ai_db

# Database: recipe_ai_db
# Collections: users, chat_messages, conversations
```

## Development Guidelines

### Code Organization
- **Controllers**: Handle HTTP/WebSocket endpoints
- **Services**: Contain business logic  
- **Providers**: External service integrations (AI, DB, Search)
- **DTOs**: Data transfer objects with validation
- **Interfaces**: TypeScript type definitions

### Error Handling
- Use NestJS built-in exceptions (`NotFoundException`, `BadRequestException`, etc.)
- Log errors with contextual information
- Return structured error responses to clients
- Implement graceful fallbacks for AI/external service failures

### Logging Best Practices
```typescript
private readonly logger = new Logger(ServiceName.name);

// Use structured logging
this.logger.log(`🎯 Intent classified: ${intent} (confidence: ${confidence})`);
this.logger.error(`❌ Processing failed:`, error);
```

### WebSocket Event Patterns
- `conversation_message` - Standard message processing
- `conversation_stream` - Streaming responses with real-time chunks
- `conversation_response` - Complete response with metadata
- `conversation_chunk` - Streaming chunk with type indicators

### AI Integration Notes
- All AI calls should have fallback mechanisms
- Use appropriate temperature settings (0.1 for classification, 0.7 for generation)
- Implement retry logic for external service failures
- Cache frequent AI responses when possible

### Testing Strategy
- **Unit Tests**: Service logic, pure functions
- **Integration Tests**: Module interactions, database operations
- **E2E Tests**: Full request-response cycles including WebSocket

### Security Considerations
- JWT tokens validated on all protected routes
- WebSocket connections authenticated before processing
- Input validation using DTOs and class-validator
- Rate limiting on API endpoints
- Sensitive data encrypted in database

## Database Schemas

### Key Collections
- **users**: User profiles, preferences, allergies
- **chat_messages**: Conversation history with metadata
- **recipes**: Recipe data (if not using Elasticsearch exclusively)

### Elasticsearch Indices
- **recipes**: Main recipe search index with Korean/English fields
- **recipe_vectors**: Semantic search vectors (if using)

## Performance Considerations

### Caching Strategy
- **Redis**: Session data, frequent search results, AI responses
- **Application**: In-memory caching for static data
- **Elasticsearch**: Query result caching

### Optimization Points
- Elasticsearch query optimization for sub-second response times
- WebSocket connection pooling and cleanup
- AI service request batching and caching
- Database query optimization with proper indexing

## Common Development Tasks

### Adding New Intent Type
1. Update `UserIntent` enum in intent-classifier.ts
2. Add classification logic in intent classifier
3. Implement handler method in main-agent.ts  
4. Update WebSocket response building logic
5. Add frontend support for new intent type

### Debugging Data Flow
1. Check WebSocket Gateway logs for request receipt
2. Trace through Agent Service processing
3. Verify Elasticsearch query and results
4. Confirm data transformation logic
5. Validate WebSocket response structure

### Performance Monitoring
- Monitor Elasticsearch query performance
- Track AI service response times
- Watch WebSocket connection counts
- Monitor memory usage and garbage collection

Always run `npm run lint` and `npm run test` before committing changes.

## Documentation

Comprehensive documentation is available in the `docs/` directory:
- `docs/README.md` - Documentation overview
- `docs/01-architecture/` - System architecture guide  
- `docs/02-modules/` - Individual module documentation
- `docs/03-data-flow/` - Data processing pipeline
- `docs/04-api-reference/` - API specifications
- `docs/05-development/` - Development setup and guidelines
- `docs/06-tutorials/` - Step-by-step learning tutorials
- `docs/LEARNING-ROADMAP.md` - 8-week mastery plan

For questions about system architecture, refer to the relevant documentation section first.