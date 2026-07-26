Status: Active
Owner: Aletheia B2
Last Reviewed: 2026-07-26
Charter Version: C-0.6.0
Process Version: B2-1.0.0
Evaluation Version: E-0.6.0
Source of Truth: Temporary protocol for antagonistic GM-Core UX, visual, accessibility, and tutorial assurance.

# B2 — UX Assurance

B2 determines whether a GM can understand, navigate, and confidently use the
product. B2 is a Claude role process: its Claude coordinator delegates concept,
rendered practical test, and independent evaluation to separate Claude
subagents under the [Program Charter](program-charter.md).

## Review Boundary

B2 tests information architecture, workflow order, navigation, discoverability,
layout, visual hierarchy, typography, density, consistency, feedback, empty and
error states, cancellation and recovery, keyboard use, focus, contrast,
scaling, localization pressure, and accessibility semantics. It examines the
whole journey as well as individual screens and treats aesthetics, clarity, and
interaction quality as observable product qualities rather than taste-only
commentary.

Tutorial review covers every capability: correct contextual trigger,
first-install and post-update automatic start of the complete tutorial,
skippability, safe resume or replay, interaction with the real UI, progressive
disclosure, comprehensible language, accurate focus target, and proof that the
user can perform the capability after guidance. Mere help text or screenshots
of a tutorial are insufficient.

## Practical Cycle

The coordinator freezes the stable A commit, supported viewport and environment
profiles, affected owner IDs, and budget. A concept subagent defines realistic
tasks, failure hypotheses, standards, rendered states, deciding observations,
and accessibility and behavior guards. A separate test subagent drives the real
UI using production routes, keyboard and pointer interaction, deterministic
screenshots or scene evidence, layout measurements, tutorial journeys, and
failure recovery in B2's own worktree. A fresh evaluation subagent replays the
tasks and negative controls under demanding display, scaling, content,
localization, and input conditions.

Use primary accessibility and platform standards when thresholds matter.
Screenshots without a declared visual oracle, subjective preference without a
task consequence, and DOM or scene inspection without rendered interaction do
not establish the finding.

## Handoff

B2 never repairs product code. It returns only finished evaluated UI tests,
visual baselines when durable and deterministic, or precise UX instructions for
A. A handoff names exact commits, task and environment, literal measurements or
rendered evidence, violated outcome or standard, severity, uncertainty, and
acceptance oracle. Urgent findings use the Charter inbox. After every merge, B2
synchronizes or recreates its worktree at the newest stable product-slice
commit.

## References

- [Program Charter](program-charter.md)
- [Product Process](product-process.md)
- [Shared Evaluation](process-evaluation.md)
- [Quality Platforms](../../verification/quality-platforms.md)
- [Source References](../../verification/source-references.md)
