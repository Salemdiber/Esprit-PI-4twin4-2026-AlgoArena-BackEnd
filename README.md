  <img src="https://raw.githubusercontent.com/Salemdiber/Esprit-PI-4twin4-2026-AlgoArena-FrontEnd/main/public/logo_algoarena.png" alt="AlgoArena Logo" width="220" />
  <h1>🛠️ AlgoArena | Backend API</h1>
  <p><strong>High-performance NestJS engine powering the world's most advanced competitive coding arena.</strong></p>
  <div align="center">
    <img src="https://img.shields.io/badge/Status-Stable-success?style=for-the-badge" />
    <img src="https://img.shields.io/badge/Security-Hardened-orange?style=for-the-badge" />
    <img src="https://img.shields.io/badge/Sandbox-Docker-blue?style=for-the-badge" />
  </div>
</div>

![NestJS](https://img.shields.io/badge/NestJS-11.0.1-E0234E?logo=nestjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-3178C6?logo=typescript)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%207.6.0-47A248?logo=mongodb)
![Docker](https://img.shields.io/badge/Docker-dockerode%204.0.10-2496ED?logo=docker)
![License](https://img.shields.io/badge/License-UNLICENSED-lightgrey)

## Table of Contents
- [About The Project](#about-the-project)
- [Key Features](#key-features)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation And Setup](#installation-and-setup)
- [Available Scripts](#available-scripts)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Docker Setup](#docker-setup)
- [Related Repositories](#related-repositories)
- [Team](#team)
- [License](#license)

## About The Project
AlgoArena Backend is the core API layer that powers authentication, challenge management, code evaluation, analytics, and platform operations for the AlgoArena ecosystem.

Built with NestJS and MongoDB (Mongoose), it provides structured modules for user accounts, admin workflows, AI-assisted challenge generation, sandboxed execution, and operational visibility. The backend is designed to support both day-to-day learner activity and administrative governance at platform scale.

For stakeholders, this service is where business rules and platform reliability live: secure account operations, role-based controls, progress tracking, challenge lifecycle management, and admin reporting.

The backend integrates external services (Groq and Docker) to enable AI generation and isolated code execution while persisting user progression and audit history.

### 🔐 Identity & Access
- 🛡️ **Authentication**: Secure registration with reCAPTCHA v3 & JWT strategy
- 🔄 **Persistence**: Robust access & refresh token rotation flow
- 🌐 **OAuth2**: Seamless Google and GitHub social integration
- 🔑 **Self-Service**: Full password recovery and reset infrastructure
- 🚔 **Authorization**: Advanced RBAC (Role-Based Access Control) with custom decorators

### 🎨 Challenge & Content Engine
- 🏗️ **Orchestration**: Full Challenge CRUD with lifecycle states (Draft/Published)
- 🧩 **Discovery**: High-performance public browsing and search endpoints
- 📝 **Evaluation**: Complex judge flow with per-test-case validation
- 💡 **Hints**: Dynamic AI-driven hint generation for stuck users
- 📈 **Progression**: Accurate solve tracking and XP/rank calculations

### 🤖 AI Core
- 🪄 **Generation**: Automated challenge creation via LLMs (Groq integration)
- 🔍 **Detection**: AI-detection and analysis of user-provided content
- 🧠 **Insights**: AI-powered code analysis and suggestion engine

### 🐳 Sandboxed Execution
- 🧱 **Isolation**: Secure Docker sandbox execution for multi-language logic
- 🛡️ **Hardening**: Resource-limited containers (no network, limited CPU/RAM)
- 📊 **Telemetry**: Real-time metrics collection and health monitoring
- 🏥 **Health**: Dedicated `/admin/sandbox/status` for real-time visibility

### 📊 Operations & Governance
- 📉 **Analytics**: Comprehensive stats overview for users, challenges, and subs
- 📜 **Audit Logs**: Deep platform transparency with point-in-time recovery
- ⚙️ **Control**: Centralized platform settings and maintenance mode toggles
- 🏥 **Observability**: Real-time health metrics and session monitoring

## 🏗️ Architecture Overview

```mermaid
graph LR
    A[Public/Admin API] --> B{Guard Layer}
    B --> C[Auth Module]
    B --> D[Challenge Module]
    B --> E[Judge Module]
    B --> F[Audit Module]
    
    E --> G[Docker Engine]
    E --> H[AI Engine]
    D --> H
    
    C & D & E & F --> I[(MongoDB)]
```

## Tech Stack
| Technology | Version | Purpose |
|---|---|---|
| NestJS Core | 11.0.1 | API framework |
| TypeScript | 5.7.3 | Language/runtime typing |
| Mongoose | 7.6.0 | MongoDB ODM |
| MongoDB driver | 6.21.0 | DB connectivity |
| @nestjs/mongoose | 11.0.0 | Nest + Mongoose integration |
| JWT (`@nestjs/jwt`) | 11.0.2 | Access/refresh token auth |
| Passport + strategies | 0.6.0 + ecosystem | Local/JWT/OAuth auth strategies |
| Dockerode | 4.0.10 | Docker sandbox container control |
| Groq SDK | 0.37.0 | AI generation/inference integration |
| OpenAI SDK | 6.33.0 | AI integration support |
| Redis client | 5.11.0 | Cache support |
| Swagger | 11.2.6 / 5.0.1 | API docs generation and UI |
| Jest | 30.0.0 | Testing framework |

## Project Structure
```text
src/
+-- ai/                      # AI generation endpoints/services
+-- analytics/               # Admin and platform analytics endpoints
+-- audit-logs/              # Activity/audit logging module
+-- auth/                    # Auth, JWT, OAuth, password reset, guards
+-- cache/                   # Redis-backed cache services
+-- challenges/              # Challenge schemas/controllers/services
+-- code-executor/           # VM/plagiarism-related execution logic
+-- judge/                   # Submission judge + docker execution + sandbox metrics
+-- onboarding/              # Onboarding and classification flows
+-- sessions/                # Session endpoints/services
+-- settings/                # Platform settings + maintenance controls
+-- system-health/           # Health telemetry endpoint/service
+-- user/                    # User CRUD/profile/rank/speed challenge session APIs
+-- app.module.ts            # Root module wiring
+-- main.ts                  # Bootstrap (CORS, validation, cookies, static uploads, swagger)
```

## Prerequisites
- Node.js (LTS recommended, Node 18+)
- npm (project uses `package-lock.json`)
- MongoDB instance (local or remote)
- Docker Engine running (required for judge sandbox execution)
- Optional: Redis (if cache module is enabled via env)

## Installation And Setup
1. Clone repository
```bash
git clone git@github.com:Salemdiber/Esprit-PI-4twin4-2026-AlgoArena-BackEnd.git
cd Esprit-PI-4twin4-2026-AlgoArena-BackEnd
```

2. Install dependencies
```bash
npm install
```

3. Configure environment
```bash
# no .env.example is present; create .env manually
```

4. Start in development
```bash
npm run start:dev
```

5. API default URL
```text
http://localhost:3000
```

## Available Scripts
| Script | Command | Description |
|---|---|---|
| Build | `npm run build` | Compile NestJS app into `dist/` |
| Format | `npm run format` | Prettier format for source and tests |
| Start | `npm run start` | Start Nest app |
| Start (dev) | `npm run start:dev` | Start with watch mode |
| Start (debug) | `npm run start:debug` | Start in debug + watch mode |
| Start (prod) | `npm run start:prod` | Run compiled output |
| Lint | `npm run lint` | ESLint for TS sources |
| Test | `npm run test` | Unit tests |
| Test (watch) | `npm run test:watch` | Unit tests in watch mode |
| Test (coverage) | `npm run test:cov` | Coverage run |
| Test (debug) | `npm run test:debug` | Debug test run |
| Test (e2e) | `npm run test:e2e` | End-to-end tests |

## Environment Variables
| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | API server port |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed frontend origins (comma-separated) |
| `NODE_ENV` | No | `development` | Runtime environment mode |
| `MONGO_URI` | Yes | `mongodb://localhost:27017/algoarena` (fallback) | MongoDB connection string |
| `MONGO_DB` | Optional | Database name from `MONGO_URI`, or `AlgoArenaDB` locally | MongoDB database name used by model submission export / continual learning |
| `JWT_SECRET` | Yes | `defaultJwtSecret` (fallback) | JWT signing secret |
| `GOOGLE_CLIENT_ID` | OAuth only | None | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth only | None | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | OAuth only | None | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | OAuth only | None | GitHub OAuth client secret |
| `RECAPTCHA_SECRET` | Auth forms | None | Server-side reCAPTCHA verification secret |
| `SMTP_HOST` | Email | None | SMTP host |
| `SMTP_PORT` | Email | None | SMTP port |
| `SMTP_USER` | Email | None | SMTP username |
| `SMTP_PASS` | Email | None | SMTP password |
| `EMAIL_FROM` | Email | None | Sender email |
| `EMAIL_FROM_NAME` | Email | `AlgoArena` (fallback) | Sender display name |
| `FRONTEND_URL` | Email links | None | Frontend base URL used in emails |
| `PLATFORM_NAME` | Email templates | `AlgoArena` fallback | Branding name in emails |
| `PLATFORM_LOGO_URL` | Email templates | None | Logo URL used in email templates |
| `EMAIL_SMTP_EXISTENCE_CHECK` | Optional | `false` | Enables SMTP existence checks in deliverability service |
| `GROQ_API_KEY` | AI features | None | Groq API key |
| `OLLAMA_MODEL` | Optional | `deepseek-coder:6.7b-instruct-q4_K_M` | Fallback model name in challenge generation method |
| `REDIS_URL` | Optional | None | Redis connection URL |
| `REDIS_CACHE` | Optional | None | Cache toggle/config value in cache service |
| `JUDGE_KEEP_CONTAINERS` | Optional | `false` | If `true`, keeps judge containers after execution |
| `AI_API_KEY` | Optional | None | ArenaJudge external AI key |
| `AI_MODEL` | Optional | None | ArenaJudge model identifier |
| `AI_BASE_URL` | Optional | None | ArenaJudge API base URL |
| `BREVO_SMTP_HOST` | Optional | None | Additional SMTP host setting (present in env) |
| `BREVO_SMTP_PORT` | Optional | None | Additional SMTP port setting (present in env) |
| `BREVO_SMTP_USER` | Optional | None | Additional SMTP user setting (present in env) |
| `DOCKER_HUB_USERNAME` | Optional | None | Docker Hub username reference |
| `DOCKER_HUB_TOKEN` | Optional | None | Docker Hub token reference |
| `COMPLEXITY_MODEL_URL` | Optional | `https://codecomplexity-model.onrender.com` | Base URL of the Python complexity-model microservice (`Complexity-Model/service`). Set to empty/unreachable to disable ML predictions; the judge falls back to the LLM estimate. |
| `COMPLEXITY_MODEL_TIMEOUT_MS` | Optional | `60000` | HTTP timeout for the model call. Render free instances can cold-start slowly; on timeout the judge silently falls back to the AI estimate so grading is never blocked by a model outage. |
| `COMPLEXITY_MODEL_MIN_CONFIDENCE` | Optional | `0.3` | Minimum **raw** model probability (before temperature calibration) of the top Big-O class required to display the model output. Below this threshold the LLM estimate is used instead and the UI shows the "AI estimate" badge. The default is intentionally permissive so the AlgoArena · CodeAnalyser card is shown on most submissions; raise to ~0.60 for cautious display or ~0.85 for "only show when the model is very confident". |
| `COMPLEXITY_MODEL_TEMPERATURE` | Optional | `0.5` (set inside the Python service) | Softmax sharpening factor applied by the model service. Lower values pull confident predictions closer to 100%; `1.0` disables calibration. See `../Complexity-Model/README.md`. |
| `COMPLEXITY_MODEL_VERSION` | Optional | `AlgoArena · CodeAnalyser v1.0` (set inside the Python service) | Display name returned in `/predict` responses, surfaced verbatim in the frontend's prediction card footer. |

## Complexity Prediction Model

The judge integrates a tree-based ML model (XGBoost on the public CodeComplex dataset, ~92% test macro-F1) to label every accepted submission with a Big-O class such as `O(n)`, `O(n log n)` or `O(n^2)`.

* **Where it lives:** `../Complexity-Model/service/` (FastAPI microservice loading `complexity_model.pkl`). See `../Complexity-Model/README.md` for training history, accuracy, and known caveats.
* **Where the backend calls it:** `src/judge/services/ml-complexity.service.ts` — a thin HTTP client guarded by a timeout. Wired into `JudgeService.gradeSubmission` (`src/judge/judge.service.ts`) right after AI analysis. If the model is unreachable or its top-class confidence is below `COMPLEXITY_MODEL_MIN_CONFIDENCE`, the existing LLM estimate is used instead.
* **What it sets on the submission record:** `complexitySource` (`'ml-model' | 'ai' | 'unknown'`), `complexityConfidence` (0–1), `complexityModelVersion`, plus the actual `timeComplexity` / `spaceComplexity` strings. The frontend uses these to render the purple "ML model" badge or the blue "AI estimate" badge next to the Time Complexity / Space Complexity tiles in the Latest Submission tab.

## API Endpoints
Major discovered endpoints from controllers:

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/` | App health hello route | Public |
| POST | `/auth/register` | Register user | Public |
| POST | `/auth/check-availability` | Username/email availability | Public |
| POST | `/auth/login` | Login and issue access token | Public |
| POST | `/auth/refresh` | Refresh access token | Cookie-based |
| POST | `/auth/logout` | Logout and clear refresh | Cookie-based |
| GET | `/auth/google` | Start Google OAuth | Public |
| GET | `/auth/google/callback` | Google OAuth callback | OAuth flow |
| GET | `/auth/github` | Start GitHub OAuth | Public |
| GET | `/auth/github/callback` | GitHub OAuth callback | OAuth flow |
| POST | `/auth/forgot-password` | Request password reset | Public |
| POST | `/auth/verify-reset-code` | Verify reset code | Public |
| POST | `/auth/reset-password` | Reset password with token | Public |
| GET | `/user/me` | Current user profile | JWT |
| GET | `/user/me/rank-stats` | Rank/XP stats | JWT |
| PATCH | `/user/me/xp` | Update XP/rank | JWT |
| PATCH | `/user/me/avatar` | Upload avatar | JWT |
| PATCH | `/user/me/password` | Change password | JWT |
| PATCH | `/user/me/placement` | Update placement | JWT |
| POST | `/user/me/speed-challenge/complete` | Mark speed challenge complete | JWT |
| POST | `/user/me/speed-challenge/session/save` | Save speed challenge session | JWT |
| GET | `/user/me/speed-challenge/session` | Load speed challenge session | JWT |
| POST | `/user/me/speed-challenge/session/clear` | Clear speed challenge session | JWT |
| PATCH | `/user/me` | Update profile | JWT |
| DELETE | `/user/me` | Delete own account | JWT |
| POST | `/user/admin` | Create admin user | JWT + Admin role |
| GET | `/user` | List users | (Controller-level business logic; secured by app conventions) |
| GET | `/user/:id` | Get user by id | Same as above |
| PATCH | `/user/:id/status` | Update user status | JWT |
| PATCH | `/user/:id` | Update user | JWT |
| GET | `/challenges/public` | Public challenge list | Public |
| GET | `/challenges/public/:id` | Public challenge details | Public |
| GET | `/challenges` | Challenge list (admin/authorized variants) | Mixed |
| GET | `/challenges/:id` | Challenge details | Mixed |
| POST | `/challenges` | Create challenge | Admin-guarded in challenge controller |
| PATCH | `/challenges/:id` | Update challenge | Admin-guarded in challenge controller |
| PATCH | `/challenges/:id/publish` | Publish challenge | Admin |
| PATCH | `/challenges/:id/unpublish` | Unpublish challenge | Admin |
| DELETE | `/challenges/:id` | Delete challenge | Admin |
| POST | `/challenges/ai-detection/analyze` | Analyze challenge with AI detection | Public/admin integration endpoint |
| POST | `/judge/submit` | Submit solution for judging | JWT |
| POST | `/judge/hint` | Request AI hint | JWT |
| GET | `/judge/progress` | User challenge progress | JWT |
| GET | `/judge/progress/:challengeId` | Challenge-specific progress | JWT |
| GET | `/analytics/insights` | Platform insights | Public/internal |
| GET | `/admin/stats/overview` | Admin overview stats | Admin dashboard use |
| GET | `/admin/stats/users` | Admin users stats | Admin dashboard use |
| GET | `/admin/stats/challenges` | Admin challenge stats | Admin dashboard use |
| GET | `/admin/stats/submissions` | Admin submission stats | Admin dashboard use |
| GET | `/admin/sandbox/status` | Sandbox monitor telemetry | JWT + Admin |
| GET | `/audit-logs` | Audit log list | JWT + Admin |
| GET | `/audit-logs/stats` | Audit log stats | JWT + Admin |
| GET | `/audit-logs/:id` | Audit log by id | JWT + Admin |
| POST | `/audit-logs` | Create audit entry | JWT + Admin |
| POST | `/audit-logs/confirm/:id` | Confirm audit action | JWT + Admin |
| POST | `/audit-logs/rollback/:id` | Roll back audit action | JWT + Admin |
| GET | `/settings` | Get platform settings | Public/consumed by frontend |
| PUT | `/settings` | Replace settings | Auth + Admin |
| PATCH | `/settings/user-registration` | Toggle user registration | Auth + Admin |
| PATCH | `/settings/ai-battles` | Toggle AI battles | Auth + Admin |
| PATCH | `/settings/maintenance-mode` | Toggle maintenance mode | Auth + Admin |
| PATCH | `/settings/ollama-enabled` | Toggle ollama mode | Auth + Admin |
| PATCH | `/settings/api-rate-limit` | Update API rate limits | Auth + Admin |
| PATCH | `/settings/code-execution-limit` | Update code execution limit | Auth + Admin |
| GET | `/system-health` | Runtime health metrics | Public/admin view |
| GET | `/sessions/active` | Active sessions | Available endpoint |
| POST | `/admin/challenges/generate-ai` | Generate challenges via AI | JWT + Admin |
| POST | `/api/plagiarism/detect` | Plagiarism detect endpoint | API namespace |
| POST | `/api/plagiarism/bulk-check` | Bulk plagiarism check | API namespace |
| POST | `/api/plagiarism/analyze-code` | Code analysis check | API namespace |

## Docker Setup
AlgoArena uses Docker for isolated judge execution in `judge/services/docker-execution.service.ts`.

Current implementation details from code:
- Container runtime is managed via `dockerode`.
- Container name prefix: `AlgoArenaSandbox`.
- Runtime naming pattern: `AlgoArenaSandbox-{timestamp}-{id}`.
- Containers run with restricted settings (no network, limited memory/CPU, readonly root fs, dropped capabilities).
- JavaScript and Python runtime images are pulled and used on demand (`node:18-alpine`, `python:3.10-alpine`).
- Sandbox execution metrics are persisted to MongoDB collection `sandbox_metrics` and exposed via `/admin/sandbox/status`.

Repository note:
- No root-level `Dockerfile` or `docker-compose.yml` is currently present in this backend repository.

## Related Repositories
| Repository | URL |
|---|---|
| Frontend App | https://github.com/Salemdiber/Esprit-PI-4twin4-2026-AlgoArena-FrontEnd |
| Backend API | https://github.com/Salemdiber/Esprit-PI-4twin4-2026-AlgoArena-BackEnd |

## Team
Contributors discovered from git history:
- Adem Miladi
- Draouil Rayssen
- MDadem
- Salem Diber
- Salemdiber

## License
`UNLICENSED` (from `package.json`).
