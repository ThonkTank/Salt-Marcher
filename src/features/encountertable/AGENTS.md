# Encounter Table Feature

This file uses the root owner-slice architecture. The package names mentioned below describe the current boundary and current homes, not the target shape for future package invention.

| Public API | Internal | Allowed consumers |
| --- | --- | --- |
| `features.encountertable.api` | `model`, `repository`, `service`, `recovery`, `ui` | `ui.bootstrap`, `features.encounter`, importer maintenance flows |

Boundary notes:
- `api/` exposes cross-feature DTOs and service facades, not consumer-specific decision policy.
- Consumer-specific rules such as how to interpret multiple linked loot tables belong in the consuming feature.
