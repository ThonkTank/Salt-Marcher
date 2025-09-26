# Encounter Tests

```
tests/encounter/
├─ README.md
├─ event-builder.test.ts   # Validates translation from travel state → encounter event payloads.
└─ presenter.test.ts       # Covers presenter persistence, subscriptions and resolution handling.
```

These Vitest suites ensure that the Encounter workspace receives stable travel
hand-offs and that its presenter survives Obsidian workspace restores.

- **`event-builder.test.ts`** mocks the hex-note and regions stores to assert
  that travel metadata (hex coordinate, region odds) is propagated into the
  encounter payload and gracefully handles missing data.
- **`presenter.test.ts`** exercises the presenter in isolation, confirming that
  persisted state is normalised, new encounter events reset notes, and the
  resolution timestamp is injected via the configurable clock dependency.

Run via `pnpm test -- --runInBand tests/encounter` when focusing on this
workspace; the root `pnpm test` command will execute them automatically.
