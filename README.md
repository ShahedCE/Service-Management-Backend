# Real-Time Service Request Management System

## Architecture Overview
Layered NestJS backend (Controller → Service → Repository) with PostgreSQL
for persistence, BullMQ/Redis for automated background processing, and
Socket.IO for real-time push updates. React frontend consumes REST APIs
and subscribes to WebSocket events for live UI sync without polling.
All protected routes are secured with JwtAuthGuard (authentication) and
RolesGuard (authorization) using an @Roles() decorator per endpoint.

## Technology Stack
- Backend: NestJS (Node.js, TypeScript)
- Database: PostgreSQL + TypeORM
- Queue: BullMQ + Redis
- Real-time: Socket.IO
- Frontend: React
- Containerization: Docker + Docker Compose

## Assumptions
- JWT-based auth; two roles: OPERATOR, SUPERVISOR
- Single-tenant deployment
- No public self-signup — the first Supervisor is created via a seed
  script; all subsequent users (Operators and Supervisors) are created
  by an existing Supervisor via POST /users
- Long-running processing is simulated via timed BullMQ jobs
- Priority field stored but not used by queue scheduling (future enhancement)
- Reprocessing capped at 3 attempts; 3rd reject → FAILED
- RBAC enforced via JwtAuthGuard + RolesGuard on every protected route

## Setup Instructions

### Option A: Docker (Recommended)

**Prerequisites:** Docker, Docker Compose

\`\`\`bash
cp .env.example .env
docker-compose up --build
\`\`\`

This starts PostgreSQL, Redis, and the NestJS backend together.

\`\`\`bash
docker-compose exec backend npm run migration:run
docker-compose exec backend npm run seed
\`\`\`

### Option B: Manual Setup

**Prerequisites:** Node.js 18+, PostgreSQL 14+, Redis 6+

#### Backend
\`\`\`bash
cd backend
cp .env.example .env
npm install
npm run migration:run
npm run seed
npm run start:dev
\`\`\`

#### Frontend
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`

### Environment Variables (.env)
\`\`\`
DATABASE_URL=postgresql://postgres:Shahed@localhost:5433/service_management_db
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_secret
PORT=4000

# Seed script — creates the first Supervisor account
SUPERVISOR_EMAIL=supervisor@example.com
SUPERVISOR_PASSWORD=changeme123
SUPERVISOR_NAME=John Doe
\`\`\`

> Note: When running via Docker Compose, DATABASE_URL and REDIS_HOST
> should point to service names (postgres, redis) instead of localhost.

## Database Setup
\`\`\`bash
createdb service_management_db
npm run migration:run
npm run seed   # creates the first Supervisor account (idempotent)
\`\`\`

The system uses exactly **3 tables**: User, ServiceRequest, StatusHistory.

## Build & Run (Production)
\`\`\`bash
npm run build
npm run start:prod
\`\`\`

## API Documentation

### Auth
| Endpoint | Role |
|---|---|
| POST /auth/login | Public |
| POST /auth/logout | Operator, Supervisor |

### Users (Operator Management)
| Endpoint | Role | Notes |
|---|---|---|
| POST /users | Supervisor | Create Operator or Supervisor account |
| GET /users | Supervisor | List all users |
| GET /users/:id | Supervisor | View single user |
| PATCH /users/:id | Supervisor | Update name/role/isActive (no hard delete — deactivate via isActive: false) |

### Service Requests
| Endpoint | Role | Notes |
|---|---|---|
| POST /requests | Operator | Create new request (auto-starts background processing) |
| GET /requests?page=&limit=&sortBy=&order=&status=&priority=&search=&createdBy=&assignedTo=&from=&to= | Operator, Supervisor | Operator sees own only |
| GET /requests/:id | Operator, Supervisor | Operator restricted to own/assigned |
| PATCH /requests/:id | Operator (own, pre-processing) | title/description only |

**Paginated response format:**
\`\`\`json
{
  "success": true,
  "data": [ /* requests */ ],
  "meta": { "page": 1, "limit": 10, "totalItems": 42, "totalPages": 5 }
}
\`\`\`

### Supervisor Actions
| Endpoint | Role | Notes |
|---|---|---|
| PATCH /requests/:id/approve | Supervisor | → COMPLETED |
| PATCH /requests/:id/reject | Supervisor | body: { reviewComment } → REQUEUED or FAILED |
| PATCH /requests/:id/cancel | Supervisor | → CANCELLED (from any pre-terminal state) |

### Chat (Real-time Messaging)
| Endpoint | Role | Notes |
|---|---|---|
| GET /chat/active | Supervisor | List all active chats (latest message per operator) |
| GET /chat/:operatorId | Operator, Supervisor | Fetch message history. Operator restricted to own. |

### Status History
| Endpoint | Role |
|---|---|
| GET /requests/:id/history | Operator, Supervisor |

## RBAC Enforcement
Every protected route uses:
\`\`\`
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERVISOR)
\`\`\`
JwtAuthGuard validates the token and attaches the user; RolesGuard checks
the user's role against the route's @Roles() metadata before allowing access.

| Action | Operator | Supervisor |
|---|---|---|
| Create request | ✅ | ❌ |
| View own/assigned requests | ✅ | ✅ (all) |
| Edit title/description | ✅ (own, pre-processing) | ✅ |
| Approve / Reject / Cancel | ❌ | ✅ |
| Manage users | ❌ | ✅ |
| View status history | ✅ | ✅ |

## Request Lifecycle
```mermaid
flowchart TD
    A[PENDING] --> B[QUEUED]
    B --> C[PROCESSING]
    C --> D[READY_FOR_REVIEW]
    D -->|Approve| E[COMPLETED - terminal]
    D -->|Reject| F[REQUEUED]
    F --> B
    C -.->|requeueCount = 3| G[FAILED - terminal]
    D -.->|Supervisor Cancel| H[CANCELLED - terminal]
```
\`\`\`

## WebSocket Events
| Event | Direction | Payload |
|---|---|---|
| requestCreated | Server→Client | ServiceRequest |
| requestQueued | Server→Client | { requestId } |
| requestProcessing | Server→Client | { requestId } |
| requestProgressUpdated | Server→Client | { requestId, progress } |
| requestReadyForReview | Server→Client | ServiceRequest |
| requestCompleted | Server→Client | ServiceRequest |
| requestRequeued | Server→Client | ServiceRequest |
| requestFailed | Server→Client | ServiceRequest |
| requestCancelled | Server→Client | ServiceRequest |
| sendMessage | Client→Server | { operatorId, content } |
| typing | Client→Server | { operatorId, isTyping } |
| newMessage | Server→Client | ChatMessage |
| userTyping | Server→Client | { operatorId, isTyping, senderId } |

**Rooms:**
- `supervisor-room` — receives all events
- `user-{userId}` — receives events only for own/assigned requests

## Concurrency Model
- BullMQ worker runs as a separate consumer process (concurrency: 5),
  doesn't block the main API event loop
- All status/progress/requeueCount mutations wrapped in a DB transaction
  with pessimistic_write row lock — prevents race conditions on
  simultaneous approve/reject or worker/supervisor collisions
- Worker checks current DB status before processing (idempotency guard
  against duplicate job execution on retry)
- Job retry policy for transient failures: attempts: 3, exponential
  backoff — separate from the business-level reject/requeue cycle
- WebSocket events emit only **after** transaction commit