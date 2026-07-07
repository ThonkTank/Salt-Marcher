Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-07
Source of Truth: July 2026 looper-quality design notes split from the main
monthly journal to keep journal files within line-cap enforcement.

# July 2026 Looper Quality Journal

## 2026-07-07 rq3b-quality-trend-gate-design - Block refactor-intent regressions

Problem: RQ-3a makes duplication and generic design smells visible, but
quality/consolidation PRs can still merge while worsening the exact metrics
they claim to improve.
Target state: autonomous PRs carry one `task:<class>` label; the existing
required `production-handoff` job runs the local quality delta as a final
step and blocks only `task:quality`, `task:consolidation`, and the documented
`task:architecture` exception case.
Alternatives considered: a new required CI check would make the branch
protection set drift and is explicitly out of scope; a warning-only rule would
not protect refactor-intent merges. Enforcement inside `production-handoff`
keeps the existing required-check set stable while making the failure visible
in the primary handoff log.
Scope boundary: change only the label taxonomy, local delta enforcement mode,
`quality-platforms.yml` production-handoff step, label creation helper, and
short looper/governance notes. The gate does not block feature/bug/docs work,
does not use external services, and does not change branch protection.
Done when: the local enforce selftest covers red `task:quality` and green
`task:feature`, `production-handoff` invokes the enforce mode with the PR
label-derived task class, and the required proof route passes or names a
concrete repair target.

## 2026-07-07 rq4-benefit-readback-design - Verify self-directed benefit claims

Problem: self-directed architecture, quality, consolidation, and performance
PRs state expected benefits at merge time, but the process score has no
delayed check that the benefit was realized.
Target state: PR bodies expose one machine-parseable `Benefit:` line, a daily
readback scans merged PRs from the 7-14 day maturity window, writes one private
feedback packet per verdict, appends a short journal line, and publishes a
German summary for the status issue.
Alternatives considered: immediate PR-time enforcement would only prove
syntax, not delayed effect; manual review would not scale to the autonomous
loop. A local script using existing artifacts and lightweight metrics keeps
the signal reproducible without external quality services.
Scope boundary: implement the parser, metric resolver, feedback packet field,
score input, PR-template hint, and looper hook. Do not make feature/docs PRs
carry a Benefit line, and do not promote unverifiable claims to owner-facing
decisions.
Done when: the parser selftest covers realized, not-realized, and
unverifiable outcomes, docs enforcement passes, and a dry run prints the
German summary without exposing private feedback content in tracked docs.

## 2026-07-07 rq7-looper-manifest-design - Detect installed looper drift

Problem: authorized local looper and prompt edits can diverge from the repo
contract after installation, leaving the continuous loop governed by files that
are not diffable in review.
Target state: `tools/looper-system/config/manifest.json` declares repo-local looper
files, SHA-256 hashes, the active repo-local systemd unit, and required
absence of legacy Home Looper paths. Every Looper session reads back those
facts, reports a German green or drift line, and opens or refreshes one
`looper-drift` issue without copying file contents into GitHub.
Alternatives considered: relying on manual install discipline would not detect
post-merge local edits; storing installed file contents in an issue would leak
more context than needed. Hash-only readback keeps drift actionable while
respecting the Warden boundary.
Scope boundary: do not edit `/opt/saltmarcher-warden`, Warden state, secrets,
cron, sudoers, credentials, approval tokens, or merge policy. This milestone
tracks only the already-authorized repo-owned Looper and prompt files.
Done when: the readback selftest proves clean and touched-byte drift cases,
the live manifest is green, a dry-run mismatch prints the drift line and issue
body, the status issue renderer includes the line, and docs enforcement passes.

## 2026-07-07 looper-repo-local-runtime - Move all Looper state under SaltMarcher

Problem: Looper evidence and active control files under `~/.local` were not
portable across devices and were not inspectable by external reviewers from
the SaltMarcher checkout.
Target state: `tools/looper-system/state/` owns the working clone, queue,
telemetry, logs, reports, lock files, pause sentinels, and run sentinels; the
systemd unit is generated under that runtime root and executes the repo script
directly.
Alternatives considered: keeping `~/.local/bin` as a thin launcher or leaving
legacy state as compatibility fallback would preserve two sources of truth.
The Looper contract now treats any legacy Home looper path as drift.
Scope boundary: only the Looper System moves. Normal SaltMarcher app data,
the updater service, and unrelated local state stay outside this migration.
Done when: install migration removes the old Home looper paths, readback is
green, dry-run writes only under `tools/looper-system/state/`, and the standard
handoff gates pass.

## 2026-07-07 looper-pr-provenance-label - Separate looper PR evaluation

Problem: looper-created and looper-repaired PRs were visible through telemetry,
branch names, or task labels, but not as a GitHub-filterable provenance class.
Target state: every PR created, selected, repaired, or materially advanced by
the Looper carries `source:looper` in addition to its `risk:*` and
`task:<class>` labels. Status and metrics reports can count looper work
without changing risk or task semantics.
Scope boundary: provenance only; the label does not affect merge eligibility,
risk classification, branch protection, or quality-trend enforcement.
Done when: the label helper creates the label, the wrapper ensures it for PR
telemetry, status/metrics reports render it, and telemetry-backed July looper
PRs are labeled retroactively.

## 2026-07-07 rq8-exploratory-smoke-design - Add product-facing smoke source

Problem: the autonomous loop can improve process and harnesses while missing
obvious product breakage that only appears when the JavaFX shell is launched
and traversed like a user would.
Target state: a local-only `exploratorySmoke` Gradle task launches the app
under TestFX/Monocle, visits the fixed station list, writes screenshots and a
summary JSON, and a triage script files at most three deduplicated
`explorer-finding` issues per week. The status issue gets a German
Exploration line, and the selection ladder treats explorer findings as
product-facing repair work.
Alternatives considered: adding the smoke to CI would make headless JavaFX a
new required-check risk and is explicitly out of scope for v1; relying on
manual screenshots would not feed the autonomous ladder. A local Gradle task
keeps the signal reproducible without changing branch protection.
Scope boundary: source lives under `test/exploration/`, excluded from existing
test gates and behavior-harness maps. Findings are system-generated and never
receive protected owner-feedback labels.
Done when: the smoke task compiles and produces station screenshots plus
summary JSON, triage selftest deduplicates an injected synthetic exception,
looper dry-run shows the daily hook position, docs enforcement passes, and
local production proof covers the build wiring.
