# Creatures Platform

`features/creatures` is a core platform domain. It owns creature data, creature-facing application APIs, and the reusable public Creature UI consumed by encounter workflows and shell surfaces.

## Ownership

| Surface | Purpose | Notes |
| --- | --- | --- |
| `features.creatures.api` | Public application/API boundary | The supported entry point for other features and shell wiring, including public Creature UI entry types |
| `features.creatures.application` | Creature-owned workflows and use cases | Internal to the platform unless explicitly promoted to `api` |
| `features.creatures.model` | Creature domain model | Canonical creature types live here |
| `features.creatures.repository` | Creature persistence | Storage contract stays creature-owned |
| `features.creatures.service` | Domain policy/helpers | Keep feature-owned logic here when it has a clear creature owner |
| `features.creatures.ui.shared` | Reusable creature UI implementation | Internal implementation behind the public `features.creatures.api` entry surface |

## Boundaries

- `ui/components` is not the default home for Creature UI. Only move Creature components there when they are truly generic shared UI used by 2+ unrelated features and no longer creature-owned.
- `CreatureBrowserPane`, `CreatureFilterPane`, `StatBlockLoader`, and `StatBlockRequest` are public Creature entry types exposed via `features.creatures.api`.
- `features.creatures.ui.shared` contains the reusable feature-owned UI implementation behind that API surface, including `StatBlockPane` and `MobAttackCalculator`.
- Importer-adjacent helpers stay inside the creature platform unless they are genuinely owner-neutral.
- `shared/creatures/parser/ActionToHitParser` intentionally remains under `shared` because it is reused by both importer parsing and creature UI stat block rendering.

## Allowed consumers

- `ui.bootstrap`
- `ui.shell`
- `features.encounter`
- `features.encountertable`
- `features.partyanalysis`
- importer maintenance flows
