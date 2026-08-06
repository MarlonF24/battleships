# ADR 0004: Separate network, domain, and persistence schemas

## Status

Accepted.

## Decision

Maintain TypeBox wire schemas, domain models, and Drizzle tables as separate contracts. Do not derive one from another.

## Rationale

They protect different boundaries. TypeBox describes untrusted input and role-filtered output; the domain represents semantically valid gameplay; Drizzle describes durable metadata. Coupling them would either expose persistence fields such as capabilities or force storage concerns into the rules. Explicit adapters make privacy and identity separation reviewable.
