# Deployment guide

## Container topology

The production Compose file defines:

- PostgreSQL with a readiness healthcheck;
- one Elysia server that starts after PostgreSQL is healthy.

The multi-stage Dockerfile performs a frozen workspace install and builds the server bundle and Vite SPA. Pushes to `main` publish `ghcr.io/marlonf24/battleships:latest` plus a commit-specific tag for both AMD64 and ARM64; `v1.2.3`-style Git tags additionally publish semantic `1.2.3`, `1.2`, and `1` image tags. Pull requests build without publishing. The default Compose file pulls `latest` rather than building locally. The GHCR package must be made public after its first publication if unauthenticated users should be able to run Compose directly.

At container startup, the runtime runs `drizzle-kit push` without `--force`; the server starts only after schema synchronization succeeds. A destructive or ambiguous schema change therefore requires explicit operator handling rather than automatic approval. Elysia then serves the SPA while keeping `/api`, `/health`, and `/openapi` outside the history fallback.

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

Container startup performs the same operation before launching Elysia. `drizzle-kit push` compares the live database with the declared schema and may require operator input for destructive changes, so resolve and back up the target before production deployment.

For a deliberate pre-cutover development reset only:

```bash
docker compose down --volumes
docker compose up
```

There is no automatic drop/reset switch or legacy-schema compatibility layer.
