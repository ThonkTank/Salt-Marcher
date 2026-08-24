# Frontend robustness FR1B audit

- Date: 2026-08-24
- Baseline: `origin/main@97435eeb27454a204407169f2ed0ca536f14b8db`
- Sprint: `FR1B` from the
  [frontend robustness roadmap](../architecture/frontend-robustness-roadmap.md)

## Sources reviewed before implementation

- the complete frontend robustness roadmap, acceptance matrix, and FR1A audit;
- the complete historical Electron roadmap and current target architecture;
- `TN-11`, `TN-16`, `TN-21`, and `QS-01` through `QS-05` in the program
  technical needs;
- the live capability provider, installation settings API, preference hook,
  async coordinator, operation/event registries, tests, build dependencies, and
  open pull requests;
- the current official TanStack Query invalidation/default-policy documentation
  and npm package metadata for `@tanstack/react-query` and
  `@tanstack/query-core`.

## Implementation packet

FR1B owns one complete, low-risk reference read projection:

- state class: immutable read projection;
- durable authority: Utility/SQLite installation settings;
- renderer authority key: `{ scope: 'installation.settings', entityKey: null }`;
- ordering: latest-only reads through the existing `AsyncCommandCoordinator`;
- cache lifetime: one `InstallationSettingsProjection` per
  `CapabilityProvider`, independent of individual consumer mounts;
- acceptance: exact-key publication with monotonic settings revision;
- invalidation: explicit `refresh()` of only the installation settings key;
- consumer cutover: `useInstallationPreferences` no longer calls
  `settings.read()` directly.

The existing preference draft/view state and queued update/reconciliation path
remain separate. An accepted settings update may publish its returned immutable
settings into the projection, but the read owner neither dispatches nor queues
writes.

## Bounded cache spike

The comparison was performed on 2026-08-24. The npm version observed for
`@tanstack/react-query` was `5.102.2`; no package was installed for the spike.

| Candidate | Useful behavior | Required local policy | Cost and removal path |
| --- | --- | --- | --- |
| TanStack Query | mature request deduplication, exact query-key invalidation, subscription lifecycle, stale/refetch and garbage-collection policy | disable or configure automatic freshness/refetch behavior; wrap monotonic revision acceptance and the renderer authority descriptor; keep mutation ownership outside Query | adds React Query and Query Core plus a provider/query adapter; removal would touch provider, query client, hooks, dependency lock, and every migrated key |
| Minimal `useSyncExternalStore` owner | React-native external-store subscription with the existing coordinator's latest-only tokens and cancellation | implement same-key in-flight deduplication, exact authority-key storage, monotonic revision rejection, retained-value failure state, and provider disposal | no new dependency or bundle input; removal is isolated to the generic owner, one settings adapter, one hook, and provider context field |

The minimal owner was selected. This slice has one singleton, explicitly
invalidated, revisioned value and intentionally needs none of Query's automatic
server-state policy. The required custom behavior is small and is exercised by
controlled promises. FR2 may still reject the approach if the more complex
Campaign/Workspace key topology demonstrates that this lifecycle does not
scale. The explicit removal path above prevents FR1B from becoming an implicit
platform commitment.

Reference material used for the spike:

- [TanStack Query invalidation guide](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)
- [TanStack Query important defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
- [`@tanstack/react-query` npm package](https://www.npmjs.com/package/%40tanstack/react-query)

## Mental execution trace

1. The provider constructs one settings projection and owns its lifecycle.
2. The first preference consumer subscribes and requests the installation key.
3. Further consumers join the same in-flight promise; no second IPC read is
   dispatched.
4. A result is published only if its coordinator token is current and its
   revision is not below the accepted key revision.
5. A newer invalidation aborts visible acceptance of the older request. An old
   transport that ignores cancellation may finish, but cannot replace the new
   value.
6. Consumer unmount removes only its subscription. A pending read and accepted
   cache survive while the provider remains mounted, so remount does not issue
   a duplicate read.
7. Provider unmount cancels acceptance and clears the cache. A late transport
   result cannot recreate visible state.
8. Read failure retains the last accepted immutable value while exposing a
   failure snapshot. Preference error presentation remains at the consumer
   boundary.

## Exclusions and delivery classification

FR1B does not add settings events or IPC, migrate any write to a new command
owner, claim FIFO/receipt guarantees from FR1C, replace preference view state,
or generalize the settings key to Campaign/Session topology. There is currently
no `settings.changed` event, so invalidation is deliberately explicit rather
than simulated through polling or a renderer-global signal.

The generic owner exists only because the chosen settings adapter exercises it
end to end. It is not an independent singleton, generic domain store, write
cache, or draft owner. The changes affect renderer source and are therefore
application-build-input relevant: exact-SHA Candidate checks and canonical
`pnpm handoff:app` remain mandatory before promotion.

## Post-implementation audit

### Exit-condition review

| FR1B condition | Evidence | Assessment |
| --- | --- | --- |
| one reference read is cut over end to end | provider-owned settings adapter, external-store hook, preference consumer, controlled React test | covered; the old direct initial read is absent |
| same-key reads deduplicate | two simultaneous preference consumers and generic controlled promise | covered with one transport invocation |
| stale visible acceptance is rejected | older read resolves after the newer invalidation result | covered; only revision 2 remains current |
| invalidation is exact-keyed | authority-key map and unrelated-key subscription test | covered without global remount or broadcast |
| revision regression fails closed | accepted revision 5 followed by transport revision 4 | covered; the ready revision 5 snapshot is restored |
| consumer and provider lifetime differ | unmount/remount under a live provider plus provider disposal during a pending read | covered for the reference owner |
| no write or draft enters the read owner | adapter API exposes only load/refresh/publish and architecture gate removes direct reads | covered for FR1B; FR1C remains open |
| bounded dependency decision and removal path exist | dated comparison above; package manifest and lock unchanged | covered; normal bundle budget remains a Candidate gate |

### Negative findings and follow-up

1. The first hook result recreated a frozen method bundle on every render. That
   would have changed the existing save callback identity and repeatedly reset
   the layout debounce. The hook now returns the stable provider projection
   separately from its changing snapshot.
2. The first lower-revision path rejected publication but left the projection
   snapshot in `pending`. It now restores the previously accepted `ready`
   snapshot, and a controlled revision-regression test locks that behavior.
3. Promise cleanup initially used an ignored `finally()` chain. Although the
   coordinator resolves failures as outcomes, a future thrown projection step
   could have created an unhandled rejected child promise. Symmetric `then`
   cleanup now clears the in-flight slot without that risk.
4. The initial architecture test used a new unregistered gate label. The
   repository's typed gate registry rejected it during the focused check; the
   assertion is now correctly classified under the existing
   `behavior-integration` gate.
5. A failed reconciliation read first reached both the projection failure
   snapshot and the enclosing command failure callback, which could show the
   same error twice. Command reporting now suppresses only the identical cause
   already owned by the projection snapshot; a React test covers the combined
   stale-write/read-failure path.
6. The first snapshot type declared `cause` as `unknown | null`, although
   `unknown` already includes `null`. The renderer lint partition rejected that
   misleading redundancy; the field is now simply `unknown`, while idle and
   successful snapshots still carry the runtime sentinel `null`.
7. Two React test wrappers were initially marked `async` without awaiting work;
   the focused test run passed, but the stricter renderer lint correctly
   rejected the misleading wrappers. They now resolve the controlled promise
   synchronously inside `act` and wait semantically for the resulting state.
8. Final lifecycle review found that `refresh()` retries a stale read by design,
   which could have started a new transport after provider disposal. Disposal
   is now a terminal owner state: subscriptions become no-ops, reads return an
   aborted outcome, publication is rejected, and the disposal test proves no
   second transport starts.
9. A retained failure snapshot could be reported again whenever a parent
   supplied a new `onError` callback identity. Each preference consumer now
   records the exact failure snapshot it has presented; a genuinely new failure
   still has a new snapshot and remains visible.
10. The adapter intentionally defers access to `api.settings.read` until a load.
   Several unrelated renderer unit tests provide narrow API doubles under the
   shared provider. Eager access would make provider construction depend on an
   unused capability and would be a broader test/runtime coupling.
11. Settings has no change event. External-process changes are therefore not
   automatically invalidated in FR1B. Inventing a renderer event or polling
   loop would expand the boundary; exact explicit refresh and accepted-write
   publication are the bounded behavior. FR7 retains the zero-alternate-owner
   and final recovery review.
12. The React proof covers deduplication and consumer remount; crossed revisions,
   key isolation, failure retention, and provider disposal use the same runtime
   owner directly with controlled promises. No unit result is presented as the
   still-open FR1C write/receipt or later Electron interaction guarantee.

No remaining finding threatens the bounded FR1B row. The cache choice remains
provisional until the FR2 go/no-go review, and all FR1 write conditions remain
open for FR1C.

### Pre-PR verification

- focused controlled tests: 3 files and 11 tests passed;
- `pnpm check:frontend-robustness`: both TypeScript configurations, 11 test
  files, and 69 tests passed;
- exact Candidate remote jobs, canonical app handoff, installed-runtime proof,
  unchanged promotion, and green Main evidence are intentionally pending at PR
  creation and must be attached before promotion.
