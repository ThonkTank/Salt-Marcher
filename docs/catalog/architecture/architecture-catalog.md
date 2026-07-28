# Catalog Architecture

Status: Active target architecture
Owner: Catalog
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose And Boundary

Catalog is the Godot read-and-handoff workspace for reference content. It owns
only transient browsing state: active section, draft and accepted query,
result lifecycle, paging, stable selection, and explicit outward actions. It
owns no Creature, Item, Encounter, NPC, faction, place, or Encounter Table
truth and has no persistence adapter.

Provider features remain the sole owners of durable records, validation,
details, and mutations. Catalog consumes only their Godot application APIs.
It never creates a substitute record because a provider is missing. A missing
provider is a visible unavailable state whose create action is side-effect
free.

## Godot Source Shape

```text
godot/src/
  app/main.gd
  features/catalog/
    catalog_browse_controller.gd
    catalog_workspace_state.gd        # target retained state owner
    catalog_section_definition.gd     # target typed section declaration
  ui/
    main_shell.gd
    catalog_workspace.gd
    catalog_result_table.gd           # target virtualized shared result view
```

`main_shell.gd` composes exactly one `Katalog` route. Catalog does not register
another World Planner route or a section-specific workspace root. The seven
sections are Monster, Items, Encounter, NPCs, Fraktionen, Orte, and
Encounter-Tabellen.

Current migration state is narrower than the target: the production shell and
all seven visible section identities exist; Monster and Items query the
installation-wide Shared-Definition provider; NPCs, Fraktionen, and Orte query
the active Campaign's World Planner provider; Encounter-Tabellen query their
own active-Campaign partition. All three provider families implement stable
name/identity sorting before bounded paging. Saved Encounter reports
unavailable. Selected active World Planner rows compose their provider-owned
Quest/rumour threads in the Inspector. No unavailable section stores
Catalog-owned truth, and narrative records do not become an eighth section.

## Provider And Query Boundary

Shared Definitions expose bounded catalog metadata queries by selected
generation, kind, search text, sort key, direction, offset, and page size.
Sorting is stable and precedes page slicing. Rows contain stable definition
identity, kind, and display name. Full semantic content stays in the provider
and is read only when a provider-owned detail route requires it. The
generation index is checksummed and structurally validated once per read; it
does not open every object. A damaged Item object therefore cannot block
Creature metadata browsing, while selecting that Item still fails exact object
validation.

World Planner supplies the same bounded row contract for active and recoverable
trash views. Its create, edit, delete, and restore commands remain
provider-owned and publish through the serial Campaign writer; Catalog only
collects terminal feedback and refreshes the selected view.

An independent World Planner narrative lane reads attached threads for the
selected active NPC, faction, or place with one active and one latest pending
request. Its typed commands use the same World Planner writer. Catalog owns
neither the returned thread state nor its validation and ignores those command
completions in the provider-neutral result refresh path.

A second bounded World Planner detail lane resolves the selected entity's full
typed record without adding those fields to Catalog result rows. The shared
Inspector renders that immutable readback and submits owner-native field edits
or explicit NPC lifecycle changes through World Planner commands. Encounter
Table references use their provider picker; destination handoffs remain absent
until the real Encounter and Scene owners migrate.

The current World Planner editor additionally composes one searchable,
paginated reference picker. It queries only the selected Creature, faction,
place, or Encounter Table provider, keeps one active plus one latest pending
request, displays name and stable identity, and publishes no relationship
until the enclosing record edit is explicitly confirmed. It never materializes
an unbounded option list or accepts raw foreign IDs as user input.

Encounter Table owns a separate serial create/update command lane and
latest-wins detail lane. Its editor composes the same bounded Creature picker,
then presents selected identities as a weighted ledger with one explicit
`1..10` value per entry. Catalog never writes that owner partition directly or
copies Creature facts into table summaries.

The Catalog background controller admits one active read and at most one
latest-wins pending read. Every request receives a monotonic epoch. Newer input
cancels or invalidates older work; late completion cannot replace the latest
visible result. On completion or teardown, no worker handle or pending request
remains. Provider work never runs on the Godot scene-tree thread.

The target provider contract is the same for every section:

- bounded query input and immutable result;
- stable row identity independent of display name;
- typed ready, empty, invalid, unavailable, cancelled, stale, and failed state;
- provider-owned details and create/edit routes;
- explicit Encounter or Scene handoff routes where required;
- no filesystem, SQLite, JDBC, Java, or UI-node type at the boundary.

Creature and Item reads use independent bounded workers once both providers
have their final owner services. Other independent providers may likewise run
concurrently. Ordering belongs only to a provider's own mutation boundary.

## Workspace State And Interaction

One retained state exists per section. It holds draft and accepted query,
rows, total, page, stable selection, sort, request epoch, and result status.
Only the selected section may issue or observe work. Switching sections cancels
or invalidates invisible work without discarding that section's local state.

Search uses a 200 ms debounce and immediate Enter submission. Local typing,
section changes, selection, paging, and sort feedback occur synchronously on the
scene-tree thread; provider reads remain asynchronous. A successful refresh
keeps accepted rows visible with a refreshing status. Failure never labels
stale rows as current success.

The production vertical slice retains draft, accepted query, rows, count,
status, selection, page, name/identity sort direction, and World Planner
trash-view state for all seven sections. Search and trash-view changes return
to page one; header sorting returns to page one without discarding a stable
selection; section switching preserves the retained state and cancels the
previous section's invisible request. Provider-specific filters and semantic
columns such as Creature CR or Item rarity/cost remain target work rather than
being approximated from metadata that the current providers do not publish.

## Presentation

`CatalogWorkspace` owns one Godot root. It renders:

- one persistent seven-section selector;
- one inside-labelled search field and consistently placed create action;
- one explicit active/paper-bin switch for recoverable Campaign-owned records;
- one shared result table whose two column headers are its only sort controls;
- one Inspector region;
- one provider-owned narrative-thread composition below selected World Planner
  entity details;
- one footer for count, lifecycle status, and bounded page navigation;
- explicit empty, loading, refreshing, unavailable, and failed states.

Section definitions may supply data, columns, filters, and actions but never
construct Controls. Long choice lists and result collections use Godot
virtualization or bounded page nodes so scene-tree node count follows visible
content rather than provider size. No section retains a second hidden node tree.

Selecting a row is side-effect free. Opening details changes only Inspector
content. Narrative create/edit/state/trash/restore actions are explicit World
Planner commands and do not change Catalog selection. Any Encounter or Scene
mutation uses an explicit named route owned by the destination feature.
Encounter tuning does not belong to Catalog.

## Persistence And Failure Isolation

Catalog has no stored truth and receives no paths or persistence handles.
Shared-Definition reads select the generation from the Campaign registry;
Campaign-owned providers read their owner partition through the active runtime
boundary. One provider's damage, absence, cancellation, or slow response cannot
block another provider or Campaign opening.

Diagnostics are local and payload-free. A visible failure carries an owned
status and retry affordance rather than SQL, paths, or raw exception text.

## Permanent Constraints

- exactly one Catalog route and one Catalog UI root;
- exactly seven statically composed section identities;
- no Catalog domain database, persistence adapter, or copied provider truth;
- no JavaFX, Java, JDBC, SQLite, or legacy service locator dependency;
- only active sections issue work;
- one active and one latest-wins pending query per read lane;
- stable provider sorting occurs before bounded page slicing;
- late or cancelled results never replace newer visible state;
- row selection never mutates Encounter or Scene;
- every external mutation is an explicit provider/destination route;
- unavailable providers remain truthful and side-effect free.

## Rejected Alternatives

- Seven controllers or retained section node trees duplicate one lifecycle and
  are rejected.
- A Catalog-owned read database duplicates provider truth and is rejected.
- Eager loading of inactive sections creates invisible work and is rejected.
- A separate World Planner navigation surface duplicates the consolidated
  Katalog and is rejected.
- Calling the legacy Java Catalog from Godot would preserve the old runtime and
  is rejected; provider owners migrate directly to Godot contracts.

## References

- [Catalog Requirements](../requirements/requirements-catalog.md)
- [Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
- [Source Architecture](../../project/architecture/source-architecture.md)
- [Feature Boundaries](../../project/architecture/patterns/feature-boundaries.md)
- [Shell Layer](../../project/architecture/patterns/shell-layer.md)
