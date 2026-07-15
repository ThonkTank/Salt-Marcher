Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Decision to remove the versioned pre-commit gate and unsafe
CI path classification and parallel governance machinery while retaining
fail-closed required proof.

# 0005 Governance Cleanup And Local Hook Removal

## Problem

The versioned pre-commit hook classified staged paths and ran a different
proof route for documentation. The required CI job separately classified
changed paths to decide whether Gradle task outputs could be reused. Both
classifiers duplicated ownership rules and could choose a weaker proof from an
incorrect path classification.

The documentation cleanup also removed completed initiative records too
broadly, including accepted ADR bodies and active verification delivery
obligations.

The same cleanup exposed a marker/register preflight that duplicated ordinary
scoped repair and issue tracking, while active delivery state was misplaced
under architecture.

## Alternatives

- Repair both classifiers. Rejected because local commit interception is not a
  required project proof route and another path taxonomy would preserve the
  same maintenance burden.
- Delete the hook and keep content-addressed CI by default. Rejected for this
  precondition change because it would leave required proof dependent on the
  unsafe classifier being removed.
- Remove both classifiers and force the required CI check graph to rerun until
  the approved verification successor replaces this temporary route. Chosen.

## Decision

- Delete `tools/hooks/pre-commit` and the settings-plugin code that installs
  `core.hooksPath=tools/hooks`.
- Do not replace the hook with another local policy gate. Developers use the
  public proof routes named by `AGENTS.md`.
- Reserve tracked `tools/hooks/**` paths as forbidden through the existing
  build-harness repository policy. This reservation is not a hook mechanism.
- Existing clones with stale hook configuration must run
  `git config --unset-all core.hooksPath` after updating; repository startup
  does not mutate local Git configuration.
- Keep the required CI job name `check`, but run
  `check -- --rerun-tasks` unconditionally for pull requests and pushes.
- Do not publish green placeholder contexts for an unconfigured merge queue.
  W000 has no `merge_group` workflow event path.
- Preserve ADR 0003's honest-instrument principles and ADR 0004's
  content-addressed JUnit conversion with declared inputs. Supersede only the
  live governance and roadmap obligations named below. Keep active replacement
  obligations in one temporary delivery manifest until they close.
- Delete the marker/register debt preflight, its scanner, skill, wrapper calls,
  and instruction references without replacement. Fix proportional findings
  in the scoped pass or use a GitHub issue for separate work.
- Cancel the former per-commit resolution dossier and cross-model honesty
  reviewer. The full deprecated Harness Modernization roadmap remains solely
  because immutable ADR 0004 links to it as historical context. It is the
  narrow exception to completed-record deletion and is explicitly
  non-operative.
- Keep completed initiative records deleted when they are not accepted
  decisions, required history, or active obligations.

## Rationale

The required check must fail closed without guessing whether a changed path is
important. Unconditional reruns are slower, but their semantics are simple and
auditable. Removing the local hook also stops Gradle startup from mutating
repository-local Git configuration.

Historical accepted decisions remain evidence of what was decided at the time.
New decisions supersede only the portions they actually replace.
The retained deprecated roadmap supplies link-stable historical context; it
does not own milestones, activate work, or compete with the delivery manifest.

The 2026-07-15 live readback found no configured merge queue. The existing
Warden and Judge instruments read labels and metadata attributable to one pull
request, so they cannot soundly attribute a multi-PR merge group. Claiming
coverage with green placeholder contexts would conceal that limitation rather
than preserve fail-closed proof.

## Risks

- Required CI will do more work until the verification successor is approved.
- Existing clones may retain `core.hooksPath=tools/hooks` until their users
  unset it. The removed bootstrap intentionally does not repair clone-local Git
  configuration as a startup side effect.
- Historical verification records contain hook measurements. Git retains that
  evidence, but it is not a binding target or a command to recreate the hook.

## Validation

- `git diff --check`
- `./gradlew checkDocumentationEnforcement --console=plain`
- focused build-harness architecture policy check, including the reserved
  `tools/hooks/**` path
- reference audit for live hook claims, deleted owner names, and changed
  Markdown links
- exhaustive audit for the deleted marker/register preflight and its owners

The required CI `check` context provides the full rerun proof after publication.

## Rollback

Revert this ADR and the implementation together. Do not restore either path
classifier without a new accepted decision that names its proof obligations and
failure modes.

## Supersedes

- ADR 0002 only where it assigns incremental-versus-rerun CI selection to a
  build, hook, or gate-wiring path classifier.
- ADR 0003 only where it requires `merge_group` instrument execution or
  delegates live validation to the removed July proof dossier, nightly
  reviewer, or frozen-governance machinery that the current delivery target
  rejects. The repository has no configured merge queue, and the old
  instruments cannot soundly attribute a multi-PR group. Its trusted-base
  pull-request validation and honest-instrument principles remain active.
- ADR 0004 only where it assigns milestone sequencing to the deprecated
  roadmap, freezes scenario semantics, adopts the T3 versioned pre-commit hook,
  or requires the T4/T5 dossier, reviewer, and nightly obligations. Its
  content-addressed JUnit conversion and declared-input decision remain active.
