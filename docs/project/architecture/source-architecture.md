# Source Architecture

## Purpose And Target

This document owns SaltMarcher's greenfield runtime and source target. The
target is one self-contained Godot 4 desktop application written in GDScript
and Godot-native resources. It runs offline on Linux, Windows, and macOS and
does not require Java, JavaFX, Gradle, JDBC, SQLite, a database server, a web
server, or a separately installed runtime.

The confirmed program-capability requirements and the derived technical needs
remain authoritative for behavior and quality. Existing Java packages, SQL
schemas, Java APIs, and JavaFX layouts are migration evidence only. They do not
constrain the target design.

## Target Source Shape

```text
project.godot
godot/
  src/
    app/             composition, startup, Campaign activation, shutdown
    ui/              shell and feature-neutral presentation mechanisms
    platform/
      persistence/   versioned file-store and recovery mechanisms
      execution/     bounded background work and cancellation
      diagnostics/   local payload-free diagnostics
      portability/   export, import, assets, and path validation
    capabilities/
      <capability>/
        model/       owned immutable truth and invariants
        application/ commands, queries, and published state
        persistence/ file codecs, indexes, and commit participation
        ui/           Godot scenes and input translation
  tests/              headless unit, contract, recovery, and journey proof
resources/            bundled read-only catalogs, icons, themes, translations
docs/                 durable product, contract, and architecture truth
```

Directories exist only when they own code. Cross-capability use goes through a
small application-facing contract owned by the providing capability. No
capability reads another capability's files, scene internals, or model objects.

## Godot Runtime Boundary

- `project.godot` starts exactly one composition scene. `app` constructs the
  installation runtime, the active Campaign runtime, and the visible shell.
- A visible scene translates input into application commands and renders
  immutable published state. It does not open files or decide domain rules.
- Mutable Campaign truth lives in plain GDScript model/application objects,
  never in `Node` instances. Removing a scene therefore cannot discard work.
- Godot scene-tree mutations happen on the main thread. File I/O, indexing,
  generation, import, and simulation use bounded workers; results return with
  a revision and are ignored when their Campaign generation is stale.
- Signals connect explicit owners. Global autoload service location and string
  names as cross-capability APIs are forbidden.
- The active Campaign owns all Campaign-scoped application objects. Switching
  revokes the old generation, drains accepted writes, commits the new active
  pointer, publishes the new shell root, and then releases the detached graph.

## Presentation Architecture

The shell is a keyboard-operable Godot `Control` tree with one navigation
surface, one focused workspace, compact live-state surfaces, dialogs, and an
optional passive second-window projection. Capability UI scenes consume only
their application contracts and feature-neutral UI helpers.

Maps use chunked domain projections rendered through Godot canvas primitives
or `TileMapLayer`; scene nodes are a viewport cache, not authored truth. Camera,
zoom, pointer sampling, selection, and layer composition are reusable UI
mechanisms. Hex and Dungeon coordinates, editing rules, visibility, knowledge,
and travel remain owned by their capabilities.

Theme tokens, scalable text, focus indication, semantic status copy, and
translations are centralized. Color is never the only carrier of state. The
default 1366 x 768 journey, high-density scaling, multiple windows, keyboard
operation, and the passive display are qualification surfaces rather than
best-effort refinements.

## Persistence Architecture

SaltMarcher uses a versioned transactional file store rooted at
`user://salt-marcher/`. It does not embed a relational database or a SQLite
extension.

The installation registry and every Campaign commit are immutable,
checksummed generations. A writer creates complete documents under fresh names,
flushes them, and publishes only by atomic rename. Existing generations are
never edited in place. Startup scans newest-first and accepts only a generation
whose checksum, schema, references, and owned files validate. Damage therefore
falls back to the newest uniquely safe generation and is disclosed.

Campaign data is not one monolithic JSON document. Each commit manifest points
to immutable owner partitions, indexes, and map chunks. Unchanged content is
shared by reference between generations; changed content receives new files.
The complete manifest is the atomic Campaign truth. Compaction may remove data
only when no retained generation, trash entry, export, or recovery point
references it. Assets retain their original bytes and are addressed by stable
manifest identities plus checksums.

One local GM process is the sole writer. Optimistic generation checks reject
late or stale commands. Confirmed UI feedback is emitted only after the new
generation can be read back and validated. Import stages an isolated complete
Campaign, validates all paths, sizes, checksums, formats, and references, then
publishes it under a new identity. Export is a closed versioned package of the
manifest closure. Campaign deletion moves the complete root to recoverable
trash; permanent deletion is a separate operation.

The detailed file layout, commit protocol, recovery rules, and format-freeze
policy are owned by the persistence-lifecycle contract.

## Capability And Failure Isolation

Every stored partition declares its capability owner and format. Unknown,
disabled, or temporarily unavailable capability partitions remain opaque,
checksum-verifiable, exportable, and untouched. A supporting capability can
fail without preventing core Campaign truth from opening. Core admission
requires safe read and write of the minimum survivor journeys; every other
capability publishes an explicit degraded state with retry.

Extensions are never granted ambient access to the scene tree or the data
root. Declarative extensions run through validated capability contracts.
Executable extensions remain disabled until a separately qualified sandbox
can enforce the disclosed file, network, and Campaign-data permissions on all
supported operating systems; loading arbitrary GDScript into the main process
is forbidden because it cannot provide that boundary.

## Diagnostics And Privacy

Diagnostics stay local and record operation identity, duration, format,
generation, and failure class. They do not record authored text, feature
payloads, secrets, media, or paths outside SaltMarcher's owned root. There is
no telemetry or network access by default.

## Migration Relationship

The migration is a sequence of complete Godot vertical slices. Each slice is
derived from current owner requirements, implemented on the production Godot
route, qualified headlessly and visibly, and then makes its corresponding Java,
JavaFX, JDBC, and SQLite code deletable. There is no dual-write bridge and no
conversion of disposable development databases.

The Java tree may exist only while the live cutover roadmap names its remaining
owner. New product behavior is implemented in Godot. The final cutover deletes
`build.gradle.kts`, `settings.gradle.kts`, `gradle/`, `gradlew`, all Java source,
all `adapter/javafx` and `adapter/sqlite` packages, the SQLite driver, and every
Java-/SQLite-specific document or resource. Completion requires fresh absence
checks plus the complete Godot qualification suite; a runnable Campaign desk
or a green foundation test is not evidence that the whole migration is done.

## References

- [Program Capability Requirements](../requirements/requirements-program-capabilities.md)
- [Program Technical Needs](program-technical-needs.md)
- [Persistence Lifecycle](../contract/persistence-lifecycle.md)
- [Godot Cutover Roadmap](../delivery/roadmap-godot-cutover.md)
