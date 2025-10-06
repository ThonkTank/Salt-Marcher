# ADR-0004: Introduce Event Bus Port for Watcher & Service Coordination

- **Status**: Proposed
- **Date**: 2024-04-06

## Context
Risk log documents concurrency faults in file watchers causing duplicate writes when modals remain open. Current architecture uses direct callbacks, leading to cycles between modals, stores, and persistence services.

## Decision
- Establish EventBusPort with typed envelopes and at-least-once delivery semantics.
- Route watcher updates, renderer lifecycle events, and storage mutations through the bus.
- Provide dead-letter queue for repeated handler failures and integrate telemetry counters for parity tracking.

## Consequences
- Breaks dependency cycles by funnelling communication through a single port.
- Requires new subscription management in renderer lifecycle and store modules.
- Adds infrastructure overhead; mitigated via shared bus implementation reused by future domains.

