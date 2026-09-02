# Frontend robustness FR2G2A provider lifecycle follow-up

- Date: 2026-09-02
- Baseline: `cb6853d05d403cd3cc46206ec5f0c049836bd596`
- Change class: app-relevant Renderer ownership correction
- Gate status: NO-GO blocker implemented; owner re-decision remains pending

## Blocking reproduction

The development application was started through the documented `pnpm dev`
loop with an empty development profile. Entering the valid Campaign name
`test` and selecting `Anlegen` displayed `Unbekannter Fehler`. Read-only
inspection showed no Campaign, command receipt, staged Campaign database, or
pending lifecycle journal entry: the command had not reached Utility-owned
durable state.

The same build was then opened with a separate diagnostic profile. The visible
failure reproduced there. Calling the validated raw preload bridge directly
created and activated a Campaign successfully, and a separately constructed
`CampaignWorkspaceProjection` also completed creation and Session readback.
The defect was therefore isolated to the mounted top-level provider lifecycle,
not the Campaign contract, Utility handler, SQLite store, input value, or
profile permissions.

## Root cause

`CapabilityProvider` created `InstallationSettingsProjection` and
`CampaignWorkspaceProjection` inside `useMemo`. Those constructors own mutable
coordinators, caches, and the active-Session invalidation subscription. The
provider's Effect cleanup permanently disposed both instances.

Root React `StrictMode` deliberately executes an initial setup, cleanup, and
second setup in development. The cleanup disposed the retained memoized
instances, while the second setup did not construct replacements. Subsequent
Campaign commands therefore returned the renderer-local `aborted` outcome
before transport. That raw lifecycle error correctly did not masquerade as a
transported capability code and consequently used the generic unknown-error
presentation.

## Bounded implementation

The provider now owns one private, instance-bound external resource owner. Its
render-time construction is side-effect free. The first committed
`useSyncExternalStore` subscription constructs exactly one immutable Context
value and its two projections. Removing the final subscription disposes that
exact value and clears it.

During StrictMode's probe cycle, the first subscription and its resources are
fully disposed; the second subscription constructs a fresh usable pair. A
real provider unmount performs the same final cleanup. Replacing the injected
Capability API selects a new owner whose snapshot is empty until its own
subscription constructs matching resources, so descendants cannot observe the
old API's disposed projections.

The correction retains root `StrictMode`, the provider-owned application
lifetime, one Campaign Workspace authority, exact subscriptions, immutable
Context values, and the existing capability error policy. It adds no
module-global owner, timer-delayed disposal, compatibility facade, duplicate
state path, IPC operation, schema, migration, or dependency.

## Controlled acceptance

- A new React test mounts the real provider under `StrictMode`, proves two
  initial Session-event subscriptions with the probe subscription already
  released, and then creates `test` through the surviving owner exactly once.
- The same test proves accepted Campaign publication, active-Session readback,
  usable installation settings, and cleanup of the remaining subscription on
  real unmount.
- API replacement is controlled separately: the first owner's final
  subscription is released, the replacement owner becomes visible, and only
  the replacement Campaign capability receives the write.
- Existing Campaign Workspace, Campaign menu, installation settings, and
  capability error tests remain part of the focused proof.
- The fresh-profile Electron `campaignCreate` journey, complete `pnpm check`,
  exact Candidate remote check, canonical handoff, installed-runtime check,
  and unchanged Main check remain mandatory delivery evidence for the frozen
  Candidate SHA.

## Negative audit and gate disposition

The defect invalidated the prior claim that one usable Campaign Workspace
projection lives for each mounted top-level provider. The follow-up restores
that guarantee by aligning resource construction and disposal with committed
subscriptions instead of render memoization. No durable data was damaged by
the reported attempt, and no cleanup or migration of Campaign storage is
required.

This packet closes only the named NO-GO blocker after all mandatory delivery
evidence is green. It does not accept the Campaign Workspace architecture,
authorize FR3A, close `QS-05` or M1, or approve the final visible cutover. Those
claims still require their own explicit gates, including a new FR2G2 owner
decision.
