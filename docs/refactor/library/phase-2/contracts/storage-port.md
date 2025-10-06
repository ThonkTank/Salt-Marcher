# Storage Port Specification

## Responsibilities
- Provide IO access via async CRUD with optional transactional semantics.
- Support dry-run writes for migration validation.
- Expose existence checks to short-circuit unnecessary read/write cycles.

## Consistency
- Default read consistency: `eventual` for UI hydration; `strong` required for save/confirm flows.
- Transaction blocks must rollback all previous steps if one fails.

## Watcher Integration
- Storage events publish via EventBusPort; storage layer emits typed events (`resource`, `mutation`, `version`).
- Partial write failures trigger rollback and structured error propagation.

