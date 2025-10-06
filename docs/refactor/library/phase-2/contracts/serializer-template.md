# Serializer Template Specification

## Template Responsibilities
- Provide a declarative field policy list describing defaults, validation, and migration behaviour.
- Guarantee round-trip safety via `roundTrip` helper executing serialize → deserialize consistency checks.
- Support dry-run contexts for import validation without persisting side effects.

## Policy Rules
- `required=true` fields must either exist on the payload or be synthesised from `defaultValue`/`migrate`.
- `allowUnknownFields=false` strips unspecified payload entries and records telemetry warnings.
- Version increments follow semantic versioning: major for structural changes, minor for optional fields, patch for validation tweaks.

## Validation DSL
- `validate` functions throw descriptive errors; property-based tests ensure invariants across random payloads.
- Shared error shape: `{ field, message, code }` used across import/preset flows.

## Migration Strategy
- `migrate` handles legacy payloads; results feed into validation before persistence.
- Telemetry logs all migrations with version delta for auditability.

