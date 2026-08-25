# Frontend robustness FR2F1 current-format manifest audit

- Date: 2026-08-25
- Delivery baseline: `origin/main@c3c357a88e12cd2aff603196e9b65303874d37e8`
- Sprint: `FR2F1` from the
  [frontend robustness roadmap](../architecture/frontend-robustness-roadmap.md)
- Change class: documentation and test infrastructure only
- Gate verdict: **FR2 remains open / no-go for FR3**

## Sources reviewed before implementation

- the complete frontend robustness roadmap, acceptance matrix, FR2D audit, and
  FR2E gate correction;
- the original Electron roadmap, target architecture, Campaign Management and
  Live Session requirements, and Live Session persistence contract;
- `program-technical-needs.md`, including its population rule, `RP-R`, `RP-L`,
  `TN-16`, and `QS-05`;
- the current Campaign schema bootstrap and schema version, all registered
  feature stores, Utility composition, E2E fixture materializer, qualification
  journey, suite registry, and focused check manifest;
- live `origin/main@c3c357a8`, the clean candidate branch, the green Main
  attestation for FR2E, and current open pull requests.

## Implementation packet

FR2F was too broad for one clean sprint and is split into `FR2F1` manifest,
`FR2F2` materialization/readback, and `FR2F3` focused-Scene/Travel evidence.

This first slice adds one immutable JSON manifest and a Zod validator. The
manifest:

- records all 20 Campaign schema registrations in their real bootstrap order;
- gives every owner one authority, state class, qualification disposition,
  owning-boundary fixture plan, and independent oracle plan;
- separates installation switch authority, shared dependencies, and app-wide
  view state from Campaign truth;
- names eight technical-profile classes the current format cannot represent,
  routes their implementation to the original `M2` through `M6` program
  milestones, and keeps their qualification in `FR7B`;
- carries the literal claim
  `preliminary-current-format-reference-not-rp-r-or-rp-l`.

The focused test compares the manifest to the live Campaign schema version and
bootstrap registration order. Schema changes, added/removed/reordered owners,
duplicate identities, or an upgraded performance claim fail closed.

No renderer state, Utility handler, SQLite schema, fixture data, command,
readback, application bundle input, or runtime behavior changes in this slice.

## Dispatch and failure trace

There is intentionally no production dispatch path yet. FR2F2 will consume the
manifest as its construction contract. Before that happens:

1. the JSON is parsed strictly;
2. duplicate Campaign, installation, or absence identities are rejected;
3. the declared Campaign schema version must equal the current project value;
4. every bootstrap registration must occur exactly once and in real order;
5. the claim cannot be changed to `RP-R`/`RP-L` by free-form text.

An owner/schema mismatch stops qualification before fixture construction. It
does not mutate Campaign data and has no reconciliation or unmount path.

## Negative findings and shortcuts

1. The manifest specifies fixture and oracle work; it does not materialize or
   read back any of it. FR2F2 remains required.
2. Several owners are not part of `LiveSessionSnapshot`. Their oracle must be a
   separate owning-store readback; treating the Session snapshot as complete
   Campaign-format truth would be a false shortcut.
3. Installation dependencies do not currently have a bootstrap registration
   catalog equivalent to the Campaign schema list. Their identities are
   schema-validated and unique but cannot yet be automatically checked for
   completeness. FR2F2 must compare them to the concrete services it uses.
4. The eight future-profile absences are coarse data-class boundaries, not an
   executable final `RP-R`/`RP-L` construction manifest. The RP-L cohort
   ambiguity recorded by FR2E remains open for FR7B.
5. `legacy-items` is compatibility-shaped current-format truth even though the
   product is pre-release. It is listed because the current schema owns it;
   FR2F2 must use `ItemDefinitionResolver.saveLegacy` and must not seed its
   table through direct SQL.
6. `campaign-runtime` is currently a structural compatibility/preflight table,
   not the owner of the Live Session projection. It is initialize-only; Scene,
   Party, Combat, and Hex/Travel own the switch oracle.
7. Pending Campaign lifecycle receipt reconciliation is installation-owned and
   already has a separate production journey. The manifest does not duplicate
   that truth inside a Campaign fixture.
8. No timing, production-route, cross-OS, handoff, installed-runtime, or owner
   acceptance evidence is introduced here.
9. The initial implementation draft incorrectly assigned absent product data
   classes to frontend-robustness phases. The post-implementation audit
   corrected that scope leak: original program milestones own the missing
   capabilities; `FR7B` only qualifies them after they exist.
10. The schema can retain multiple Running Scenes, but no current owning
    product command creates a second Scene. Existing integration tests use
    direct SQL for that setup. The initial manifest draft incorrectly planned
    a multi-Scene fixture; the audit reduced current-format construction to the
    publicly bootstrapped standard Scene and records multi-Scene creation as an
    explicit `M3` absence.

## Verification

- `git diff --check`: passed;
- manifest contract alone: 1 file and 2 tests passed, including owner/schema,
  identity, duplicate, and qualification-claim drift;
- `pnpm check:frontend-robustness`: 24 files and 161 tests passed;
- the complete local `pnpm check` passed formatting, all lint partitions, both
  TypeScript projects, and 91/91 architecture tests. Its portable unit phase
  then reproduced only the four unrelated host-sensitive failures already
  recorded by FR2D and FR2E: three Encounter Generator settings tests exceeded
  their unchanged 30-second timeout, and the 16-ms Reference Matcher gate
  measured 32.627 ms. The result was 195/197 files and 803/807 tests passed;
- no failed test imports the new manifest contract or artifact. Thresholds were
  not weakened; clean-host remote `Check` remains the broad repository gate;
- the slice changes documentation, test infrastructure, and qualification
  metadata only. It changes no application input and requires no AppImage
  handoff.

## Gate decision and follow-up

FR2F1 closes only the owner/applicability contract and its drift gate. It does
not close `FR-A07`, `TN-16`, or `QS-05`.

- `FR2F2` must implement the A/B materializer through the named owning
  boundaries and independently read back every manifest disposition;
- `FR2F3` must add the focused-Scene next mutation/restart oracle and isolate
  the Travel/SwiftShader behavior;
- `FR2G` must run the current-format production population and obtain explicit
  owner architecture go/no-go;
- `FR7B` retains exact cross-OS `RP-R`/`RP-L` `QS-05` qualification.

FR3 remains no-go.
