# ADR-0003: Consolidate Serializers via Template & Policy Layer

- **Status**: Proposed
- **Date**: 2024-04-06

## Context
Phase 1 domain/serialization catalogue reported three parallel serializer implementations with 78% overlap and inconsistent defaulting rules. Import review showed divergent error shapes and missing dry-run support, creating risk of data corruption.

## Decision
- Create generic serializer template with declarative `SerializerPolicies` describing fields, defaults, validation, and migrations.
- Enforce round-trip DoD: `roundTrip` helper executed in CI for every serializer.
- Provide policy-based validation DSL shared with import/preset flows.

## Consequences
- Enables deletion of duplicate serializer code paths after parity verification.
- Requires property-based and golden file tests to guard migrations.
- Slight upfront cost to reimplement existing serializers on top of template.

