Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-26
Source of Truth: Target source shape, dependency direction, and
architecture-significant quality constraints for the SaltMarcher desktop app.

# Source Architecture

## Purpose And Concerns

This specification serves maintainers changing features, persistence, the
JavaFX shell, and application startup. It answers where behavior belongs, how
features collaborate, and which boundaries protect UI responsiveness, local
data, and diagnosability.

SaltMarcher remains one local JavaFX desktop process and one Gradle application.
Local persistence has one installation-owned store for the Campaign registry
and reusable definitions plus one physically separate store per Campaign. Only
one Campaign runtime is active in the shell at a time. The target is a modular
monolith, not a distributed system or a set of Gradle subprojects.

## Target Shape

```text
app/       explicit application composition and lifecycle
shell/     passive JavaFX host and shell contracts
platform/  execution, persistence, diagnostics, and state mechanisms
features/  capability-driven feature roles and required adapters
resources/ static resources and centralized application styling
docs/      durable product, domain, contract, architecture, and proof truth
tools/     retained build and development tooling
```

Feature roles follow owned behavior rather than a mandatory folder template. A
feature publishes `api` only for capabilities consumed outside its
implementation, owns `domain` only for business truth and invariants, and owns
`application` only for use-case orchestration. A feature with stored truth owns
an `adapter/sqlite`; a feature with JavaFX presentation owns an
`adapter/javafx`; bundled read-only reference data belongs in an
`adapter/resource`; explicit remote protocol integration belongs in an
`adapter/http`. Empty role packages are forbidden. Dungeon remains one
feature and publishes separate Authored, Editor, and Travel APIs.

## Permanent Boundaries

- `app` MUST compose platform services, feature entry points, and shell
  contributions explicitly and deterministically. It may depend on every
  target root but MUST NOT own feature behavior or long-lived feature state.
- `app` MUST give the installation lifetime and each active Campaign runtime
  separate persistence and execution lifecycles. One installation-owned
  activation coordinator serializes Campaign changes and owns the activation
  generation, durable active-Campaign pointer, and runtime admission fence.
- `shell` MUST remain independent from feature implementations. Features may
  use `shell.api` contracts; the shell receives already constructed
  contributions and MUST NOT locate feature services. Shell internals may use
  feature-neutral platform mechanisms; `shell.api` contracts remain free of
  platform implementation types.
- `platform` MUST contain only feature-neutral mechanisms. It MUST NOT import
  `app`, `shell`, or feature code. Its capability packages are
  `platform.execution`, `platform.persistence`, `platform.diagnostics`,
  `platform.state`, and `platform.ui`; new catch-all packages are forbidden.
  Passive map camera, viewport, layered-canvas, cache, and technical pointer
  mechanisms live in `platform.ui.mapcanvas`; they do not form a Maps feature
  or own adopter coordinates and behavior.
- A feature MUST expose cross-feature capabilities only from its `api` package.
  Application, JavaFX adapter, and composition code may consume foreign APIs;
  no consumer may import another feature's domain, application, adapters, or
  composition entry point.
- Feature domain roles MUST remain independent from `platform`. Observable API
  contracts may use feature-neutral state and UI-dispatch contracts.
  Application code may use execution, state, UI-dispatch, and diagnostics
  contracts; SQLite adapters may use persistence and diagnostics; JavaFX
  adapters may use UI contracts; HTTP adapters may use diagnostics; feature composition may wire any platform
  capability.
- Feature API calls that can touch persistence or files MUST be non-blocking.
  JavaFX state changes MUST be dispatched explicitly to the UI thread.
- Published feature state MUST be immutable and revisioned. A late asynchronous
  result MUST NOT overwrite newer state.
- Feature SQLite adapters own their stored truth and migration steps. Reusable
  definitions and the Campaign registry use the installation store;
  Campaign-owned truth uses only that Campaign's store. Cross-store references
  use stable logical identities and MUST NOT depend on cross-database foreign
  keys or duplicate mutable Campaign truth. Shared connection, integrity,
  backup, and recovery mechanisms belong to `platform`. JDBC and SQLite driver
  APIs are allowed only in feature SQLite adapters and `platform.persistence`.
- Technical diagnostics MUST remain local and MUST NOT record feature payloads,
  secrets, or user-authored content.

The global compact travel context is owned by a feature-neutral Travel
capability. It consumes Party position plus Dungeon and Hex API readbacks,
publishes one immutable `TravelContextSnapshot`, and owns the single global
`Reise` state contribution. Dungeon and Hex retain their movement semantics and
detailed workspaces; `app` only composes these APIs.

Internal Java types have no compatibility obligation while all consumers move
atomically in one green slice. Persisted data and observable behavior retain
their contract and requirement owners.

## Tutorial Runtime Boundary

The installation runtime owns one tutorial coordinator and its installation-
scoped progress. Capability owners contribute immutable, versioned lesson
definitions through explicit application composition; neither the shell nor
the tutorial coordinator discovers feature implementations. A lesson targets
semantic capability actions and owned product concepts rather than source
packages, CSS selectors, persistence rows, or adapter details. An installed
extension which exposes a capability contributes its lesson through the same
restricted extension boundary and cannot gain additional Campaign, file, or
network authority by doing so.

The coordinator compares the installed application version with the last
version whose automatic presentation began in this installation profile. First
installation and the first start of every distinct installed version enqueue
the complete lesson set contributed by all capabilities exposed by that
version, including unchanged lessons. A same-version restart enqueues nothing
automatically. Removed capabilities contribute nothing; an added, changed, or
restored capability participates in the complete set of the next installed
version in which it is present.

Each lesson exposes an individual skip, and the automatic presentation exposes
a separate action which dismisses all remaining lessons. Skip, dismissal, and
completion state are installation-owned preferences, not Campaign truth and do
not suppress the complete set after a later application update. Starting,
skipping, or dismissing a tutorial cannot confirm a Campaign mutation, disable
a capability, or change runtime authority. A
tutorial may guide a real product action only after the GM invokes that action
through its ordinary capability boundary and receives the ordinary durable
feedback.

Tutorial presentation is an in-product shell contribution which remains
keyboard-operable, localizable, scalable, offline, and skippable without
completion. It is isolated from an unavailable or faulty lesson so the
underlying capability and the rest of the Campaign remain usable. Lesson
versioning and deliberate replay are reversible technical conveniences, not
owner-confirmed behavior.

## Campaign Runtime Boundary

An installation runtime owns shared reference capabilities, the Campaign
registry, and a lifecycle/import coordinator. The coordinator owns bounded
validation, staging, identity remapping, and atomic promotion of a complete
Campaign package including its store and assets; feature owners retain their
payload truth. Existing shared definitions and Campaigns remain unchanged
until all required import choices and validation have succeeded.

A Campaign runtime owns the Campaign-scoped feature components, their execution
lanes, their SQLite lifecycle, and their bound shell contributions. Core
readiness means preservation plus the required survivor journeys have valid
semantic state, can open safely, and have a writable transactional persistence
boundary. Before the durable pointer commit, candidate preparation qualifies
the complete attached root structure, selected focused-Scene journey, survivor
state, and non-payload rollback probe without admitting Campaign mutations. It
MUST NOT perform a duplicate offscreen CSS/layout render as a substitute for
the real publication path. Visible readiness is decided after whole-root
publication by the safely rendered focused Scene and its exact next durable
feature mutation through the same production composition and persistence route
against a disposable Campaign. Candidate preparation MUST NOT create, alter,
or delete user-authored truth merely to test readiness. An optional or
supporting capability that fails readiness starts explicitly disabled or
degraded and does not block the core shell. Runtime closure revokes later work
on its first attempt and remains in `QUIESCING` after a release failure.
Campaign-scoped components acquire foreign subscription handles only after the
complete component aggregate owns them. A synchronous partial-start failure
retains every acquired handle in that aggregate; retry resumes at the first
unacquired handle, while runtime closure releases and, after release failure,
retries only the retained handles. Each
retry owns a fresh terminal result while skipping component, execution-lane,
and database releases already proven successful; it reaches `CLOSED` and
shuts down its closure executor only after the complete graph is released.

Campaign activation is one serialized state transition:

1. prepare a core-ready candidate without admitting Campaign mutations;
2. close admission for the current runtime and drain every accepted mutation;
3. durably commit the target Campaign and a new activation generation in the
   installation registry; this commit is the linearization and crash-truth
   point;
4. publish the candidate's whole Campaign shell root and admit its generation;
5. retire the detached runtime: close it, or retain the complete aggregate in
   the coordinator's single bounded `PARKED` slot when the eligibility rules
   below hold.

Application and persistence boundaries reject a revoked runtime generation
before commit. Failure before the registry commit reopens the unchanged prior
runtime. Failure after that commit never reopens prior mutation authority: the
coordinator keeps the UI in an explicit switching/recovery state and rolls
forward to the durably selected Campaign. Restart follows the same durable
selection.

A user-directed switch out of recovery first rereads the durable pointer and
derives one explicit replacement fallback aggregate: the retained prior when
it is still durable, or the prepared target when that target was already
committed. Every other recovery-owned aggregate must close before another
candidate may be allocated. The fallback remains owned through replacement
preparation, prior drain, and an ambiguous or timed-out pointer commit; it may
retire only after the replacement pointer commit is confirmed. Its lifecycle
mode is explicit: an active fallback drains once before replacement
preparation, a parked fallback remains parked, and an already committed but
not yet published fallback remains prepared rather than being treated as an
active runtime. If the durable Campaign could not open at all, the explicit
mode is durable-truth-only: there is no aggregate to drain or republish, so the
coordinator may prepare one healthy alternative within the same ownership
bound and commit it without reading or mutating the inaccessible Campaign
store. Any rejection before that commit returns to the durable recovery state.
A definite
pre-commit rejection resumes admission and republishes that exact retained
shell into the installation host because recovery publication detached and
released the prior host reference. Resolving a contained pre-commit recovery
does the same rather than claiming an active snapshot while the recovery desk
is still visible. A committed replacement follows the normal roll-forward
rule, including recovery after publication failure.

Every contained preparation, drain, or pointer-commit stage retains its exact
activation context: the prior aggregate, its drain outcome, and whether a
recovery publication actually detached the prior root. Normal switching
timeouts therefore let the host show a contained settling/recovery desk while
retaining the exact published shell identity and accelerator surface. The host
restores that same shell on `RESUMED` without falsely marking its publication
lost or publishing it a second time. This contained desk presents the retained
Campaign as healthy and available while the transition settles; it MUST NOT
label or disable that Campaign as damaged. A retry, registry-read failure, or
other recovery action while any contained stage remains nonterminal MUST stay
`RECOVERY_UNAVAILABLE` and MUST NOT request visible recovery publication.
Only a recovery-directed replacement republishes its detached fallback. A durable-truth-only replacement retains a non-recursive fallback
of the damaged durable activation, Campaign identity, and path rather than a
second recovery graph. If its late preparation or pointer commit settles
definitively before commit, that exact damaged recovery truth is restored and
a later healthy replacement remains possible without reading or changing the
damaged Campaign bytes.

Exact aggregate restoration requires either that no drain began or that the
drain completed successfully. A terminal drain failure makes that in-memory
aggregate unsafe to readmit: it remains an owned close obligation until close
succeeds, while the durable Campaign truth remains selected and is rebuilt
through the normal current-format open path. No replacement candidate may be
allocated while that close remains unsettled.

The coordinator records the prior aggregate's drain outcome explicitly as
`NOT_STARTED`, `PAUSED`, `UNSAFE`, or `NOT_REQUIRED`. Only terminal successful
completion moves an attempted drain to `PAUSED`; a synchronous exception or a
timeout moves it to `UNSAFE` until a late terminal success proves `PAUSED`.
Immediate or late terminal failure releases the uncommitted candidate, closes
the unsafe prior under a retained obligation, never resumes or republishes that
instance, and retains the unchanged durable Campaign truth for a cold rebuild
after close settlement. A definite pre-commit rejection resumes a `PAUSED`
fallback exactly once. Prepared and durable-truth-only fallbacks never receive
that resume operation.

Campaign switching replaces the whole Campaign shell root. The active shell
does not discover services, mix contributions from another runtime, or
coordinate state copying between runtimes. The coordinator MAY retain exactly
one detached ownership aggregate containing its Campaign runtime, complete
shell root, and accelerator map. That aggregate is `PARKED`: admission is
drained and closed, it has no mutation authority, and it is absent from the
installation-owned active `Scene`. A later activation always receives a fresh
durable generation before the aggregate can regain admission authority.

Parking is eligible only while the focused workspace has no delayed activation
or deactivation lifecycle and every installation-owned reference consumed by
the aggregate is immutable for the parked interval. The current eligibility
rule is the focused primary Scene journey. Any mutable shared-definition route
MUST invalidate or evict the parked aggregate before publishing its mutation;
other focused workspaces use close-and-rebuild. Before reuse, the complete
parked current-format store is checked in O(1) against the quiescent token
captured after its admitted work drained: physical file identity, size,
high-resolution modification time, and absence of WAL, SHM, and rollback
journal sidecars. An unchanged token inherits the physical, foreign-key, and
owner-schema integrity established at current-format open. Any detected main
file change receives those complete checks through an immutable read-only
SQLite connection; a sidecar appearance fails closed because an immutable
main-file read cannot safely interpret it. Even a structurally valid external
change invalidates the aggregate because its in-memory models may be stale; the
coordinator closes it, fails before pointer commit, and a later retry rebuilds
from the now-validated current bytes. Neither route creates, alters, or deletes
database-family bytes. Failure closes the parked aggregate, preserves the
active Campaign and target bytes, and fails before pointer commit.

This change token is an ownership oracle for one local application process,
not a defense against an actor with operating-system privileges who can rewrite
bytes while spoofing file identity and timestamps. Files entering through an
import or other untrusted boundary never inherit this oracle and require full
bounded validation. A definite stale or other pre-commit rejection returns a
borrowed parked aggregate to the slot and reopens only the confirmed prior
authority. That origin survives delayed drain or ambiguous-commit recovery: a
terminal pre-commit outcome or durable reread confirming the prior returns the
loan, while a confirmed target or post-commit publication failure never caches
the prior aggregate.

Preparing a third distinct Campaign requires the parked aggregate to close
successfully first. A failed eviction remains a slot-occupying close obligation
and blocks further candidate preparation until it settles. The same gate
applies to any incomplete close of a full Campaign candidate, so repeated
close failure cannot accumulate runtime graphs outside the active-plus-one
bound. A close obligation retains its matching never-committed reservation;
neither cleanup nor replacement allocation may proceed until that exact close
has settled successfully. Unresolved close or reservation-cleanup obligations
also block a new Campaign identity reservation itself, so repeated close and
delete failure cannot grow directories or invoke another candidate factory.
Terminal close
identity-deduplicates active, parked, recovery, and pending-close ownership.
The steady ownership bound is therefore one active plus one parked Campaign
runtime; recovery or incomplete close may replace normal progress but never
authorizes another factory allocation beyond that bound.

Candidate aggregate closure is itself idempotent. The coordinator retains only
the currently active, parked, recovery, eviction, or unsettled-close identities;
it MUST NOT keep an unbounded history of previously closed candidate graphs.
Repeated close calls reuse an in-flight attempt or skip already completed
release steps. The coordinator memoizes the one invocation wrapper and
terminal stage in an identity-keyed pending attempt for each candidate; repeated submissions
observe that exact stage, and only its terminal failure authorizes a fresh
attempt under the same bounded close obligation. A serialized transition may additionally retain an
identity set of successful close settlements only for the duration of that
transition, so a just-settled retry and subsequent recovery containment cannot
invoke close twice; the set is discarded before the next transition.

Retrofitting selector columns into today's
mixed global store, shadow snapshots, and dual live graphs are not accepted as
Campaign boundaries; an owner-scoped store design may use internal
discriminators only with independent isolation proof.

The JavaFX `Scene` and its render host belong to the installation lifetime and
remain stable across Campaign switches. This is a rendering and input host,
not Campaign state: each activation installs the complete candidate `AppShell`
as the stable host's sole root and completely replaces the host accelerators.
No inactive Campaign node remains in the active `Scene`; an eligible parked
root stays detached inside its complete coordinator-owned aggregate.
Qualification therefore reasons about the candidate root while visible
readiness is observed only after that root is attached to the
installation-owned `Scene` for two consecutive JavaFX pulses with positive
on-screen bounds. A pulse with a different root or non-positive bounds resets
the sequence. The publication coordinator and candidate jointly own that
readiness attempt as a cancellable lifecycle resource. Successful readiness,
phase timeout, publication revocation, whole-root replacement, recovery
publication, candidate close, host close, and window disposal all terminate
its pulse source and release its reference to the candidate root before the
detached aggregate can be retained or closed. Candidate-route render
qualification treats JavaFX CSS conversion warnings from the published root's
stylesheet as failures rather than accepting a visibly degraded shell.
When publication authority is revoked after a root swap may have begun, the
root-swap invocation must settle first, then the owned readiness cancellation
must settle, and only then may the installation host publish recovery. Late
readiness completion has no activation authority and shares the already-owned
recovery publication rather than initiating another root change.
Entering recovery stages the coordinator-owned aggregate and its prior
publication truth before asking the host to replace the root. The coordinator
may set `publicationLost` only after the host confirms that recovery is visible;
an exceptional or timed-out recovery publication retains the previous shell,
identity, accelerator references, and restoration truth until later completion
is confirmed.

## Delivery State

Temporary repository state, verification scope, and the next deletion boundary
live only in feature-owned `docs/<feature>/delivery/` documents routed from the
feature README. They do not modify this target.

The target-package ArchUnit rules are mechanically enforced by
`architectureTest` and `check`.

## Rationale

Vertical ownership keeps one behavior change local to its feature. Explicit
composition makes dependencies visible to the compiler. Physical Campaign
store separation gives switching, recovery, and export a Campaign-sized
containment boundary while the lifecycle coordinator preserves cross-store
consistency. Non-blocking I/O keeps the JavaFX event thread responsive.
Versioned persistence and local diagnostics make failures recoverable without
transmitting user data.

Generic classpath discovery, a shell-owned service locator, horizontal
domain/view/data roots, and package-form compatibility were rejected because
they hide dependencies, fragment ownership, and make safe migration harder.

## References

- [Feature Boundary Standard](patterns/feature-boundaries.md)
- [Application Composition Standard](patterns/application-composition.md)
- [Shell Layer Standard](patterns/shell-layer.md)
- [Styling Standard](patterns/styling.md)
- [Verification Core Architecture](verification-core.md)
- [Documentation Standard](../documentation.md)
