# Salt Marcher Streamlining Plan

## Objectives
- Reduce maintenance overhead by concentrating engineering capacity on the high-relevance runtime assets that power the Obsidian plugin experience.
- Simplify supporting infrastructure and dependency surface area highlighted by the latest repository inventory refresh.
- Establish short-, mid-, and long-term actions that keep documentation and governance aligned with the updated relevance scale.

## Key Findings from the Inventory Review
- The refreshed inventory separates directories and documentation hubs, clarifying which artefacts underpin day-to-day work versus archival material. 【F:wiki/File-Inventory.md†L6-L14】
- Runtime touchpoints such as `main.js` and `manifest.json` remain critical, earning 10/10 relevance scores that warrant focused investment. 【F:wiki/File-Inventory.md†L18-L20】【F:wiki/File-Inventory.md†L34-L35】
- Build orchestration and tooling (for example, `esbuild.config.mjs`) sit in the 7–8 relevance band, indicating targeted improvements can yield stability gains. 【F:wiki/File-Inventory.md†L19-L20】【F:wiki/File-Inventory.md†L33-L35】
- A large proportion of vendored dependencies carry 1–2 relevance scores, signalling opportunities to prune or better encapsulate third-party code paths. 【F:wiki/File-Inventory.md†L22-L27】【F:wiki/File-Inventory.md†L36-L80】

## Workstreams & Actions

### 1. Core Runtime Consolidation (Weeks 1–2)
- Audit `main.js` ownership boundaries and refactor to isolate domain modules for Cartographer, Library, Encounter, and Data Management workflows.
- Introduce automated smoke checks around manifest integrity and migration scripts so the highest-relevance files remain deployment-ready.
- Document module responsibilities within the plugin README to maintain parity with runtime changes.

### 2. Build & Test Modernisation (Weeks 2–3)
- Review `esbuild` configuration for redundant plugins or overlapping transforms; fold defaults into a shared preset where possible.
- Align test runners and coverage tooling with the build pipeline to ensure 7–8 relevance assets have direct quality gates.
- Establish a quarterly configuration review cadence tied to release planning.

### 3. Dependency Footprint Reduction (Weeks 3–4)
- Categorise low-relevance packages by usage (runtime, build-only, unused) and remove or replace redundant modules.
- Replace vendored utilities with first-party helpers when functionality is simple, reducing future security update obligations.
- Introduce dependency health dashboards (e.g., automated update PRs) to surface drift early.

### 4. Documentation & Knowledge Base Alignment (Weeks 4–5)
- Cross-link the inventory with feature guides so contributors understand the impact of proposed changes before coding.
- Summarise high-level architecture decisions in the wiki to complement the directory map and ease onboarding. 【F:wiki/File-Inventory.md†L6-L27】
- Schedule periodic documentation audits parallel to inventory updates.

### 5. Governance & Workflow Reinforcement (Ongoing)
- Embed the inventory refresh procedure into the release checklist so relevance scores stay current. 【F:wiki/File-Inventory.md†L24-L27】
- Define ownership for each workstream and capture it in the Notes directory to maintain accountability.
- Track execution status during weekly stand-ups and adjust milestones as blockers emerge.

## Milestones & Deliverables
| Week | Deliverable | Owner |
| --- | --- | --- |
| 1 | Runtime audit report and refactoring backlog | Core engineering |
| 2 | Updated build/test configuration proposal | Dev experience |
| 3 | Dependency rationalisation decision log | Core engineering |
| 4 | Knowledge base cross-links and onboarding brief | Documentation |
| 5 | Governance update and recurring review schedule | Project leads |

## Success Metrics
- 20% reduction in critical runtime TODOs identified during sprint planning.
- Build pipeline duration reduced by 10% while maintaining test coverage levels.
- Dependency update PRs resolve within one sprint of release availability.
- Documentation accuracy validated through quarterly contributor surveys scoring ≥4/5.
