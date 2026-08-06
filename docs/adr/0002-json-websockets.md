# ADR 0002: JSON WebSockets instead of Protobuf or gRPC

## Status

Accepted.

## Decision

Use strict JSON HTTP for lifecycle operations and strict JSON WebSockets for live sessions. Do not use gRPC or Protobuf in the active application.

## Rationale

Browsers need a bidirectional live stream. gRPC-Web does not provide the required browser bidirectional stream without extra proxy and generation machinery. The board is small, so complete role-filtered JSON projections are simpler to validate, inspect, reconnect, and evolve than event replay or binary envelopes.
