# World Planner Architecture

Status: Active Godot target architecture
Owner: World Planner
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose And Boundary

World Planner owns Campaign-authored NPC, faction, location, lifecycle, note,
source-constraint, membership, inventory-limit, Quest/rumour, and
recoverable-trash truth. It does not own creature statblocks, encounter tables,
encounter runtime, party truth, reward distribution, session records, or
Catalog browsing state.

The product exposes these records inside the single Godot `Katalog` route. That
placement does not transfer ownership to Catalog: Catalog asks the World
Planner provider for bounded rows and sends explicit commands back to the
provider.

## Godot Source Shape

```text
godot/src/features/worldplanner/
  world_planner_knowledge.gd           # pure owner model and invariants
  world_planner_command_controller.gd  # owner command vocabulary
  world_planner_detail_read_controller.gd # full entity detail read lane
  world_planner_narrative_read_controller.gd # attached-thread read lane
  world_planner_reference_options_controller.gd # bounded picker options
godot/src/app/
  campaign_partition_command_controller.gd # shared admitted write lifecycle
godot/src/features/catalog/
  catalog_browse_controller.gd         # provider-neutral query lane
godot/src/ui/
  catalog_workspace.gd                 # shared presentation only
  world_planner_narrative_threads.gd   # provider-owned Inspector composition
  world_planner_reference_picker.gd    # searchable paginated reference index
```

`WorldPlannerKnowledge` validates one versioned `worldplanner` owner-partition
payload. It creates stable independently identified NPCs, factions, and places;
allows duplicate display names; owns type-specific optional values and internal
relationships; stores note-first Quest/rumour records with typed subjects,
manual resolution, contributors, and reward descriptions; and applies deletion
or restoration as one candidate state. It
has no Node, filesystem, Catalog, Java, JavaFX, JDBC, or SQLite dependency.

`WorldPlannerCommandController` configures the provider-neutral Campaign
partition command lane with World Planner's payload and mutation vocabulary.
That lane snapshots the admitted active Campaign, reads and prepares one
mutation on a worker, and submits the complete candidate partition to the
existing serial asynchronous Campaign writer. Activation and Campaign
generations bind the submission. A switch, newer write, revoked session, or
concurrent accepted write rejects publication instead of writing detached
truth. Terminal feedback returns on the scene-tree thread.

## Read Boundary

The Catalog read lane resolves the active Campaign through the immutable
registry, opens its current commit, reads only the `worldplanner` partition, and
executes a bounded provider query off the scene-tree thread. Name or stable-ID
sorting in either direction occurs before offset/page slicing. The lane verifies
that the active registry pointer did not change before publishing. One active
query and one latest-wins pending query bound memory and worker count; epochs
suppress late readback.

Rows contain provider-neutral stable identity, kind, name, optional notes,
updated time, and trash state. Full typed detail editing remains an owner API
target and must not be implemented by copying owner truth into Catalog.

The separate narrative read lane resolves one selected active World Planner
entity and returns only attached Quest/rumour rows. It has the same one-active,
one-latest-pending bound, cancellation, registry confirmation, and late-result
suppression as the Catalog lane. Narrative commands share the existing serial
World Planner writer, so a thread mutation cannot race another accepted owner
mutation. Catalog composes the provider-owned `FÄDEN` view below entity details
without adding an eighth section or owning narrative state.

The entity-detail lane resolves the complete active or trashed NPC, faction, or
place record by stable identity. It uses the same one-active/one-latest-pending
bound and registry confirmation, while Catalog list rows remain provider-neutral.
The Inspector can therefore display every typed owner field and edit only
owner-native values without widening metadata queries or copying foreign
Creature and Encounter Table truth.

The reference-option lane serves one visible picker at a time with one active
and one latest pending query. Creature choices come from the registry-selected
Shared-Definition generation; faction and place choices come from the active
Campaign's World Planner partition. Both are sorted and paged before UI node
creation and re-confirm their registry generation before publication. The
picker retains only draft IDs, and the record command publishes the complete
owner candidate after explicit confirmation.

## Current Migration State

The production Godot route currently supports bounded active/trash search,
stable name/identity sorting, retained paging, and name-only create, name/note
edit, recoverable delete, and restore for NPCs, factions, and places. Selected
active entities also expose attached Quest/rumour title and notes, manual
open/closed state, and recoverable delete/restore in the Inspector. Deleting an
entity atomically removes current entity and narrative links. Restore keeps the
same identity and reattaches only surviving relationships that are still free.

The visible Inspector reads every documented optional NPC, faction, and place
field. Its editor owns name/general notes, NPC appearance/behavior/history,
NPC lifecycle and disposition, and faction disposition. Lifecycle change is an
explicit confirmed command and keeps stable selection. Creature and internal
relationship pickers now cover NPC Creature statblock, faction, last place, and
place-faction links without raw ID entry. Encounter-Table selection, faction
inventory editing, and destination handoffs remain pending. The legacy Java
owner is not deleted until that parity, acceptance, and deletion gate are
complete.

## Permanent Constraints

- one Campaign owner partition named `worldplanner`;
- stable identity is independent of display name;
- name is the only required creation field;
- duplicate display names are valid;
- current and trash queries are distinct bounded views;
- deletion and relationship cleanup publish atomically;
- narrative completion is manual and rewards are stored but never distributed;
- restore never invents a missing or conflicting relationship;
- provider I/O and mutation preparation never block the scene-tree thread;
- Catalog owns no World Planner record, persistence path, or domain rule;
- no JavaFX, Java, JDBC, SQLite, or service-locator dependency enters the Godot
  owner boundary.

## References

- [World Planner Requirements](../requirements/requirements-world-planner.md)
- [World Planner Domain Model](../domain/domain-world-planner.md)
- [World Planner Persistence Contract](../contract/contract-world-planner-persistence.md)
- [Catalog Architecture](../../catalog/architecture/architecture-catalog.md)
- [Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
