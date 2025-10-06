# Complexity & Coverage Snapshot

## Size Hotspots
Top files by line count within `src/apps/library` (including docs) illustrate concentration of logic around creature tooling. 【9c608c†L1-L9】

| Rank | File | Lines | Notes |
| --- | --- | --- | --- |
| 1 | `core/preset-data.ts` | 36 377 | Generated preset bundle; consider excluding from runtime diffing. |
| 2 | `create/creature/components/entry-card.ts` | 1 369 | Large UI component set for creature entries. |
| 3 | `create/creature/components/types.ts` | 1 026 | Extensive type definitions for entry system. |
| 4 | `create/creature/components/condition-component.ts` | 809 | Complex UI logic for conditions. |
| 5 | `create/creature/components/entry-card-simplified.ts` | 739 | Alternate entry card variant. |
| 6 | `create/creature/components/area-component.ts` | 690 | Area effect editor. |
| 7 | `core/reference-parser.ts` | 618 | Markdown parser for reference conversion. |
| 8 | `create/creature/components/README.md` | 604 | Extensive documentation indicates steep learning curve. |
| 9 | `create/creature/components/area-component.test.ts` | 588 | Heavy unit coverage concentrated on area component. |
| 10 | `create/creature/components/RECHARGE_USES_COMPONENTS.md` | 569 | Additional documentation emphasising complex subsystem. |

The monolithic `creature-files.ts` sits at 465 lines blending schema, numeric helpers and Markdown rendering, making it a prime refactor candidate. 【F:src/apps/library/core/creature-files.ts†L1-L320】

## Test Coverage Overview
- Library shell test mocks renderers, so watcher logic, imports and serializer roundtrips are not exercised. 【F:tests/library/view.test.ts†L1-L67】
- Dedicated validation tests focus on creature entry and stats checks, but there are no analogous suites for spells, items or equipment. 【F:tests/library/create-creature-validation.test.ts†L1-L58】
- `statblock-to-markdown.test.ts` covers markdown serialization but only for creatures; items/spells lack roundtrip tests. 【F:tests/library/statblock-to-markdown.test.ts†L1-L40】

## Coverage Gaps
- No automated coverage for terrain/region debounced save paths or watcher error callbacks. 【F:src/apps/library/view/terrains.ts†L130-L161】【F:src/core/regions-store.ts†L59-L86】
- Import pipelines (item/equipment) operate without tests, increasing risk of regression when refactoring parse logic. 【F:src/apps/library/view/items.ts†L45-L111】【F:src/apps/library/view/equipment.ts†L44-L104】
