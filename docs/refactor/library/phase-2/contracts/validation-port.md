# Validation Port Specification

## Goals
- Centralise validation pipelines across serializers, presets/imports, and renderer inputs.
- Provide consistent issue reporting to UI and logging layers.

## Rules
- `strict=true` forbids warnings; any warning escalates to error.
- `coerce` normalises unknown payloads (e.g., string → number) and shares validation result contract.
- Issues propagate with deterministic ordering (by field, then severity).

## Testing Guidance
- Property-based tests verify idempotence of `coerce` for already valid inputs.
- Mutation testing ensures validation catches tampered fields from risk log scenarios.

