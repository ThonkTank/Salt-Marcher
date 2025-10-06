# Event Bus Port Specification

## Responsibilities
- Provide a decoupled messaging channel for renderer lifecycle events, storage mutations, and watcher notifications.
- Ensure ordered delivery per event type and at-least-once semantics.

## Lifecycle
1. Subscribers register during renderer `connect` and remove themselves in `dispose`.
2. `publish` enforces monotonic `version` increments per resource.
3. `drain` flushes pending messages before toggling kill switches or completing migrations.

## Error Handling
- Handlers may throw; the bus logs via telemetry and requeues once unless marked unrecoverable.
- After two consecutive failures, event is routed to a dead-letter queue consumed by diagnostics.

