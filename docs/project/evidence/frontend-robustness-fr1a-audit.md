# Frontend robustness FR1A audit

- Date: 2026-08-24
- Baseline: `origin/main@3a2ceabb5206dd0ba6acea71905b196659e7c0ec`
- Sprint: `FR1A` from the
  [frontend robustness roadmap](../architecture/frontend-robustness-roadmap.md)

## Sources reviewed before implementation

- the complete frontend robustness roadmap, acceptance matrix, and FR0 audit;
- the complete historical Electron roadmap and the current target-architecture
  renderer, operation-registry, capability-adapter, async-ordering, and
  architecture-gate boundaries;
- `TN-11`, `TN-16`, `TN-21`, and `QS-01` through `QS-05`;
- the current operation registry, derived `SaltMarcherApi`, capability wrapper,
  async coordinator, positive Hex/Travel/Planner/settings queues, known
  latest-only mutation owners, and their unit and architecture tests.

## Implementation packet

FR1A owns a compile-time renderer execution contract only:

- preserve each registry operation's `read` or `write` mode in its derived API
  function type without adding runtime metadata or importing schema-bearing
  registry values into the renderer;
- define explicit type-only descriptors for keyed read projections, FIFO
  commands, long work, and receipt reconciliation;
- require every authority key to state both scope and entity identity;
- add controlled compile-time mutations proving that an untyped callback or a
  write operation cannot enter a read descriptor, a read operation cannot enter
  a FIFO descriptor, and receipt reconciliation cannot invert command/read
  roles;
- add a semantic architecture gate proving the contract remains type-only and
  therefore adds no runtime implementation or parallel owner.

Owned files are the shared derived capability type, one renderer async contract
module, focused type/architecture tests, this audit, and the existing frontend
robustness manifest. No feature adapter, coordinator behavior, React owner,
IPC declaration, preload bridge, Utility handler, bundle dependency, or product
behavior is changed.

## Mental execution trace

1. A shared operation fragment declares `mode: 'read'` or `mode: 'write'`.
2. The mapped `SaltMarcherApi` function retains that literal mode in a nominal,
   compile-time-only brand while remaining normally callable at runtime.
3. A future application adapter selects a branded operation and declares its
   explicit projection or authority key through the matching descriptor.
4. TypeScript rejects a write selected for latest-only/read execution before
   dispatch; no transport, commit, event, acceptance, recovery, or remount can
   occur from that invalid wiring.
5. Valid descriptors remain data-free types in FR1A. FR1B and FR1C must provide
   the first vertical runtime entry points and their controlled result paths.

## Exclusions and delivery classification

FR1A does not cut over a consumer, select TanStack Query, implement a projection
store, alter `AsyncCommandCoordinator`, remove current legacy paths, or claim
FR-A02 through FR-A05 interaction evidence. Its implementation is erased from
the emitted JavaScript, but it changes shared and renderer source under `src/`
and therefore is app-build-input relevant. It requires the complete exact-SHA
Candidate handoff even though expected runtime behavior is unchanged.

## Post-implementation audit

### Exit-condition review

| FR1A condition | Evidence | Assessment |
| --- | --- | --- |
| Registry mode survives the derived API | literal-preserving registry generic, nominal API operation type, settings read/write type assertions | covered without exposing registry values or Zod schemas to the renderer |
| Separate typed entry points exist | read projection, FIFO command, long-work, and receipt-reconciliation descriptors | covered as type-only descriptors; runtime entry points remain intentionally absent |
| Invalid write/read wiring fails closed | unbranded, write-as-read, read-as-command, and inverted-receipt types resolve to `never` | controlled compile-time mutations cover each mode boundary |
| No parallel runtime owner is introduced | semantic architecture gate over imports, calls, constructions, and renderer consumers | covered; the contract has no runtime import, call, construction, or consumer |
| Existing baseline is ratcheted | the historical mode-erasure assertion is removed and replaced by target contract proof | covered without accepting any existing latest-only write as valid |

### Negative findings and follow-up

1. The first brand was required at the structural function boundary. That made
   valid Vitest mocks fail assignment even though their context already proves
   the operation type. The brand is now optional for structural compatibility,
   while mode extraction first requires the brand key to exist on the declared
   type. A plain callback therefore still resolves to no operation mode.
2. The first conditional treated `never` as assignable to `read`, which let an
   unbranded callback produce a read descriptor. `HasOperationMode` now handles
   the no-mode case explicitly before comparing the literal mode.
3. An exported `CapabilityOperationOfMode` convenience alias looked stricter
   than it was under the optional brand. It was removed rather than leaving a
   misleading public contract; consumers use the conditional descriptors.
4. The initial focused manifest omitted the directly changed operation-registry
   unit suite. It was added before closeout.
5. Calling the slice “test/contract-only” initially obscured repository delivery
   semantics. Runtime code is unchanged, but `src/` bytes are application build
   inputs, so FR1A is app-relevant and must complete canonical handoff.
6. The contract cannot stop a deliberate unsafe cast from forging an API type,
   and it does not yet prove FIFO transport, acceptance, or receipt behavior.
   Those are not weakened or declared complete: FR1B must provide the first
   read runtime consumer, and FR1C the first write/receipt runtime consumer with
   controlled interaction evidence.

### Pre-candidate verification

- `pnpm check:frontend-robustness`: passed both TypeScript configurations,
  9 test files, and 59 tests.
- formatting, all lint partitions, the complete TypeScript check, and the
  architecture suite passed; the architecture suite covered 9 files and 87
  tests.
- the complete local `pnpm check` reached 188 of 190 passing portable unit test
  files and 759 of 764 passing tests. Its five failures were confined to four
  unchanged 30-second tests in `encounter-generator-settings.test.tsx` and the
  unchanged 16-millisecond gate in `reference-matcher.test.ts`.
- during that run, CPU 0 reported both current and maximum frequency as 800 MHz
  (`scaling_cur_freq=800000`, `scaling_max_freq=800000`). This host therefore
  does not qualify the portable timing gates. No timeout, threshold, test, or
  implementation was weakened; exact-SHA Candidate CI remains the required
  qualified-host proof.

No remaining finding invalidates the bounded FR1A guarantee. Closeout requires
the final focused check, complete repository check on a qualified host, exact-
SHA Candidate jobs, canonical application handoff, unchanged promotion, and a
green Main attestation.
