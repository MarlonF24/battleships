# ADR 0003: Process-local active game state

## Status

Accepted.

## Decision

Keep fleets, shots, deadlines, connections, and active aggregates in one server process. Do not persist or restore live boards.

## Rationale

Game-night sessions are short and restart recovery is not worth a distributed state service or reconstruction protocol. Explicit premature `server_restart` outcomes are simpler and honest. The consequence is a strict one-replica deployment and unavailable late board review after a session is discarded.
