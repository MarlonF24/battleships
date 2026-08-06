# Deployment guide

## Container topology

The production Compose file defines:

- PostgreSQL with a readiness healthcheck;
- a one-shot Drizzle schema container;
- one Elysia server that starts only after schema synchronization succeeds.

The multi-stage Dockerfile performs a frozen workspace install, builds the server bundle and Vite SPA, uses the build image to apply the Drizzle schema, and copies only runtime outputs into the server image. Elysia serves the SPA while keeping `/api`, `/health`, and `/openapi` outside the history fallback.

## Single-replica requirement

Run exactly one server process/replica. Active aggregates, timers, sockets, and terminal board publication are process-local and deliberately undistributed. A load-balanced second process would not share sessions.

PostgreSQL stores enough information to report that a match ended, not enough to resume it. Startup marks every nonterminal row premature with reason `server_restart` and creates hub outbox events where applicable.

## Configuration

Use the canonical variables documented directly in `.env.example` and set `NODE_ENV=production`. Keep `CORS_ALLOWED_ORIGINS` empty when Elysia serves both the page and API; list only external browser origins that must call the API directly. Do not publish PostgreSQL outside its trusted network in production unless operations require it.

Hub integration is explicitly enabled or disabled. Never accept callback URLs from match requests; only `HUB_RESULT_WEBHOOK_URL` is used.

## Readiness and shutdown

`GET /health/live` proves the process can answer. `GET /health/ready` queries an application table, proving database access and schema readiness.

On shutdown, the server stops accepting work, closes sockets with a restart reason, cancels cleanup, stops webhook polling, and gives persistence a bounded drain. Any row that remains nonterminal is finalized during the next startup.

## Database operations

Synchronize the configured database with the current Drizzle schema before server rollout:

```bash
bun run db:push
```

Compose performs the same operation in its one-shot `schema` service. `drizzle-kit push` compares the live database with the declared schema and may apply destructive changes, so resolve and back up the target before production deployment.

For a deliberate pre-cutover development reset only:

```bash
docker compose down --volumes
docker compose up --build
```

There is no automatic drop/reset switch or legacy-schema compatibility layer.
