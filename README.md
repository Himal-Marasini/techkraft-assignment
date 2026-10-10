# Merchant Onboarding API

A NestJS API for merchant applications: sales staff create and submit them, a background job runs a risk check, and an assigned reviewer approves, rejects or asks for more information.

Stack: NestJS 10, TypeScript, PostgreSQL + TypeORM, Redis + BullMQ, JWT, Swagger, Jest + Supertest, Docker Compose.

## Run it

Needs Node 20+, pnpm and Docker.

```bash
cp .env.sample .env        # then set JWT_SECRET (32+ chars) and SEED_USER_PASSWORD
docker compose up -d postgres redis
pnpm install
pnpm migration:run
pnpm seed
pnpm start:dev
```

- API: `http://localhost:4041/api/v1`
- Swagger: `http://localhost:4041/api-docs`

`docker compose up -d` also builds and starts the API in a container; it applies migrations on start.

Seeded users, all with the password from `SEED_USER_PASSWORD`:

| Email | Role |
|---|---|
| `admin@techkraft.test` | ADMIN |
| `reviewer1@techkraft.test`, `reviewer2@techkraft.test` | REVIEWER |
| `sales1@techkraft.test`, `sales2@techkraft.test` | SALES |

## Tests

```bash
pnpm test        # unit tests, no services needed
pnpm test:e2e    # integration tests, needs Postgres and Redis running
```

The e2e run creates and migrates its own database (`TEST_DATABASE_URL`).

## Endpoints

All under `/api/v1`. Everything except login needs `Authorization: Bearer <token>`.

| Method | Path | Who | What |
|---|---|---|---|
| POST | `/auth/login` | anyone | Get a JWT |
| POST | `/merchant-applications` | SALES, ADMIN | Create a draft |
| PATCH | `/merchant-applications/:id` | SALES (own), ADMIN | Edit while `DRAFT` or `INFO_REQUESTED` |
| GET | `/merchant-applications/:id` | all | Get one |
| GET | `/merchant-applications` | all | List, with `status`, `page`, `pageSize` |
| POST | `/merchant-applications/:id/submit` | SALES (own), ADMIN | Submit and queue the risk check |
| POST | `/merchant-applications/:id/assign` | ADMIN | Assign a reviewer |
| POST | `/merchant-applications/:id/decision` | assigned REVIEWER | `APPROVED`, `REJECTED` or `INFO_REQUESTED` |

## Who can see what

- **ADMIN** sees every application.
- **SALES** see only applications they created.
- **REVIEWER** sees only applications assigned to them.

The filter is part of the database query. An application outside your scope returns the same 404 as one that doesn't exist.

## Status flow

```
DRAFT ──submit──► SUBMITTED ──risk check ends──► UNDER_REVIEW ──► APPROVED
  ▲                                                  │        ├──► REJECTED
  └────────────── edit + resubmit ◄──────────────────┴────────► INFO_REQUESTED
```

- **Application status** is changed by people through the endpoints above.
- **Risk status** is set only by the system: `PENDING` → `PROCESSING` → `PASSED`, `FAILED` or `ERROR`.
- A reviewer can be assigned while the application is `SUBMITTED` or `UNDER_REVIEW`.
- A decision needs `UNDER_REVIEW`. Approval also needs risk status `PASSED`.
- Any action from the wrong status returns 409.

## Risk check

- Submit adds a BullMQ job. The worker calls a simulated provider that scores the application from business type, monthly volume and average ticket size.
- A score of 60 or more is `HIGH` and the check is `FAILED`. Below that it is `LOW` and `PASSED`.
- A failing provider call is retried 3 times with exponential backoff. After that the risk status is `ERROR` and the application still moves to `UNDER_REVIEW`, so a reviewer can reject it or ask for information.
- The job is safe to run twice: the job ID is unique per submission, the worker only writes while that submission's check is still in progress, and the database allows one result per submission.
- If a job never reaches the queue (Redis down at submit, or a crash right after saving), a task that runs every minute queues it again once the submission has been `PENDING` for two minutes.

## Audit and sensitive data

- Create, update, submit, assign, decision and risk outcomes each write a row to `audit_logs`, in the same transaction as the change.
- An update is audited by field name only, not by value.
- Request bodies and headers are never logged. Passwords are stored as bcrypt hashes and never returned.
- The tax ID is never returned in full, only masked (`******4567`).

**Fields that need field-level encryption in production:** `taxId` first, then `ownerFullName` and `ownerEmail`. They are stored as plain text here.

## Assumptions

The brief leaves these open, so I chose:

- ADMIN assigns reviewers. SALES and REVIEWER cannot.
- ADMIN cannot record a decision, because the brief says only the assigned reviewer may.
- ADMIN can create, edit and submit any application.
- After `INFO_REQUESTED`, the owner edits and resubmits. The application keeps its reviewer.
- All amounts are in one platform currency.
- Users are seeded. There is no user management API.

## Trade-offs and known limits

- **Free text in the audit log:** the reviewer's reason and the provider's error message are stored as written.
- **Risk details:** a reviewer sees the risk status but not the score. The score is stored in `risk_assessments` with no endpoint for it yet.
- **Audit storage:** PostgreSQL, as the brief allows.
- **Not built:** the optional webhook, MongoDB audit store and ADR.

## AI assistance

I used Claude Code as a coding assistant. The design decisions were mine, including the status model (`UNDER_REVIEW` and the separate risk statuses), role-based data filtering in the query in place of a separate policy layer, reusing the application status for review decisions, and trimming the data model to what the brief needs. I reviewed every change and can explain all of it.

Verification: ESLint, the TypeScript compiler, the unit tests, the e2e tests against real PostgreSQL and Redis, and a TypeORM check that the migration matches the entities.
