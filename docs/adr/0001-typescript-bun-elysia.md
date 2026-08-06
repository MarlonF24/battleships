# ADR 0001: TypeScript, Bun, and Elysia

## Status

Accepted.

## Decision

Use one Bun workspace with React/Vite for the browser, Elysia for HTTP and WebSockets, shared TypeScript domain/contracts packages, and Drizzle/PostgreSQL for metadata.

## Rationale

One language allows rules and semantic fleet validation to be shared without generated translation code. Elysia applies runtime schemas directly at HTTP and WebSocket boundaries while preserving inferred types. Bun provides the runtime, workspace, test runner, and native TypeScript 7 quality gate.

The framework stays outside `game-domain`; switching transport or persistence does not change rules.
