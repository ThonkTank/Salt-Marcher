# Session UI transitions

The session workspace is a composition boundary. It projects the current
snapshot but does not own asynchronous or modal state machines.

| Owner | Input | Event | Transition/output | Race rule |
| --- | --- | --- | --- | --- |
| Scene controller | current snapshot revision | focus, set location, assign party member | revisioned scene command | only the latest full-snapshot request may commit |
| Group controller | focused scene, party, group loot | expand, request/cancel/confirm delete | register rows and explicit delete state | expansion is isolated by scene; group results are latest-per-group |
| Loot controller | scene and location identity | open/load/refresh | loot projection and inbox cursor | existing receipt reconciliation remains authoritative |
| Dialog controller | typed dialog payload | open/close | one discriminated dialog state | close is an explicit event; no effect follows snapshot identity |
| Reference follow | combat-card creature identity | inspect/follow | reference context selection | the followed identity is updated only after the explicit dependency changes |
| Mutation controller | snapshot, setter, error boundary | execute snapshot/group command | functional snapshot commit | request sequence tokens discard stale completions; errors remain visible |

The architecture test rejects the former `latestSnapshot` mirror and Hook
dependency suppressions in the workspace owner. Deferred-promise tests prove
the latest-invocation rule without wall-clock sleeps.

Styles follow the same ownership: workspace CSS contains column composition,
while control, group register, dialog, loot, and encounter selectors stay in
their feature files. Session and encounter surfaces remain scoped below
`.session-mockup`; cross-feature overrides are rejected by the focused test.

Run the complete fast path with `pnpm check:session-ui`. It runs the typed and
component/controller gates, builds once, then runs one short functional suite
and a separate visual session suite through the shared receipt runner.
