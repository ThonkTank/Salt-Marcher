# Linux release operations

The first public Electron target is `0.3.0`. The version is now in package
metadata; publication remains pending the
[maintenance roadmap](../project/architecture/release-maintenance-roadmap.md).
[Execution evidence](../roadmap-execution.md) distinguishes implemented tooling
from completed runtime and human acceptance. Never treat a green build or this
procedure as proof of release acceptance.

## Immutable inputs

Finish the exact candidate SHA's complete required Check jobs and canonical
Local handoff, then promote that same SHA to main and wait for main Check to
succeed. `package.json`, release notes, and the requested target version must
match. Check both GitHub release and tag availability; existing versions and
assets must not be overwritten. Corrections use a new version.

The Release workflow accepts a versioned `request` JSON document and a
`recovery_case` comparison ID. The [request contract](../../scripts/release/request.ts)
requires repository, target commit/version/data formats, and explicit comparisons
for unchanged formats, a real migration, and skipped releases. A skipped case
names its actual intermediate artifacts. Each comparison includes the complete
manifest, original manifest hash, and either an immutable public tag or the exact
fixture workflow run, attempt, source commit, artifact ID and name. No `latest`
baseline, renamed target build, credential, or arbitrary download URL is accepted.

Run **Build explicit release comparison fixtures** on main when historical
comparison artifacts are needed. It builds named original sources and retains
their manifests, historical receipts and workflow receipts. Inspect the completed
run and its immutable artifact metadata when constructing the request. Expired
artifacts cannot be qualified by reusing their old identifiers.

A published baseline additionally requires `profileFixture`: an explicit
historical fixture artifact with the same data formats. Only this fixture seeds
synthetic data. The unchanged release baseline must independently read the entire
profile with its own embedded runtime identity. Its final readback and the
fixture's final readback must both prove the source unchanged. Historical
baselines use their own fixture. The early interruption case selects an
instrumented historical migration baseline; do not attribute its hooks to a
public release.

## Build and qualification

Dispatch **Release** from main with the complete immutable request. Admission
requires the clean exact main SHA, complete candidate evidence, successful main
attestation, matching package version, release notes, unused version/tag, and the
configured human approval policy. Controls are written outside the checkout.

The workflow bundles the exact-source runners, builds the release AppImage once,
and creates its manifest. It acquires only the requested comparisons, verifies
the pinned Ubuntu and Node inputs, prepares a separate-kernel KVM guest, and runs
the complete first-install/update/migration/restore suite there. The test guest
has no network or GitHub token. Runner, AppImage and environment bytes are checked
before use; returned profiles, history, journals and runtime identities are
recomputed on the host. Original inspection reports and logs are retained before
successful disposable profiles are removed.

Only a successful complete qualification produces the `release-<commit>` artifact.
The separate transport artifact retains environment and runtime evidence,
including failure diagnostics. The draft job authenticates the exact run and
attempt, its successful qualification job, unique artifact, comparison origins
and every bundle file before creating a draft from the unchanged bytes.

For local reproduction use the same entry points from a clean checkout:

1. `scripts/bundle-release-qualification.ts` creates the three guest runners.
2. `scripts/package-release-baseline.ts --request <request.json> --target-manifest <manifest.json> --output <new-comparison-root>` acquires explicit artifacts.
3. `scripts/prepare-release-vm.ts --output <new-environment> --cache <cache> --engine podman` prepares and verifies the guest; CI uses Docker.
4. `scripts/run-release-qualification-vm.ts --request <request.json> --workflow <workflow.json> --target <target-directory> --comparisons <comparison-root> --runners <runner-directory> --environment <prepared-environment> --node <pinned-node-archive> --work <new-work-directory> --output <new-bundle-directory> --recovery-case <migration-id> --engine podman` transports and verifies the complete offline guest run.

Invoke these TypeScript entries through `pnpm exec tsx`. The workflow identity
must refer to the actual source commit. A locally supplied identity is not proof
of GitHub provenance. KVM, the container engine and sufficient disk space are
mandatory; no fallback to host Electron/Xvfb is permitted. Keep failed guest
directories for diagnosis. Successful overlays may be removed only after their
original reports are archived and verified. Never bind valuable user profiles
into qualification guests.

## Human acceptance and publication

Download the draft AppImage and manifest together. Test only a copy of valuable
campaign data. Record version, commit, exact AppImage/request/qualification hashes,
test time, and all five checks: open campaign, save a change, perform the update,
continue work, restore a backup. The full input format is
[liveAcceptanceInputSchema](../../scripts/release/live-acceptance.ts); a prose
sentence and AppImage hash alone are insufficient.

Dispatch **Publish accepted release** on main with the version and that acceptance
JSON. The resolver authenticates the draft's completed qualification workflow.
The publish job waits for the configured human reviewer in the `release`
environment and checks out the exact qualified source commit. It downloads the
original CI artifact afresh, compares the draft's controls and all bound file
hashes, and verifies the acceptance input against those bytes. The receipt is
created only after the publishing run's actual human approval is found in GitHub's
review history. No agent approval or free-form reviewer claim substitutes for it.

Publication attaches that receipt and publishes the existing draft without a
rebuild or asset replacement. Verify that the public anonymous download matches
the qualified AppImage hash. If any step fails, investigate its retained evidence;
do not overwrite assets or label the release accepted to bypass the failure.

Keep previous deployments and every backup. Recovery may roll back an interrupted
activation only before normal use was accepted. Later crashes must never restore
older data automatically; no database downgrade or automatic backup deletion is
supported.
