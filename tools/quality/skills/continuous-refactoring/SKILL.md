---
name: continuous-refactoring
description: Use before planning, implementing, refactoring, or reviewing SaltMarcher production-code, check/enforcement, or dependency work. Keeps cleanup in the normal development pass, treats `LEGACY_REMOVE_ON_TOUCH` as an active delete signal, and routes proportional Clean-Break replacement work without creating new gates.
---

# Continuous Refactoring

## Overview

Use this skill to make cleanup part of normal development instead of a separate
periodic campaign.

This skill operationalizes:

- Clean-as-you-code policy from SonarSource: quality work is scoped to new or
  changed code.
- Google Engineering Practices: keep changes small, split large refactors, and
  allow small local cleanups when they belong with the current change.
- GitLab and GitHub pull-request quality workflows: surface tool findings in
  the review loop for the changed scope.
- Dependabot version-update workflow: dependency freshness enters as normal
  reviewable dependency PRs.
- OpenRewrite dry-run practice: mechanical refactors are previewed before
  applying changes.
- OpenAI Codex refactoring guidance: map debt first, choose one theme, and run
  the smallest useful validation after each pass.

It does not replace SaltMarcher's architecture, domain, view, data, shell, or
quality-platform standards. It only defines how an agent must bring existing
quality evidence into a normal implementation pass.

`LEGACY_REMOVE_ON_TOUCH` is the canonical active delete signal. A marked file,
class, method, adapter, or compatibility path is suspect baseline: use it to
find what must be removed or replaced, not as precedent for new implementation
shape.

## Required Workflow

Before editing production code, check/enforcement packages, or dependency
manifests:

1. Classify the implementation scope as production, check/enforcement, or
   dependency work.
2. Define the cleanup scope as the touched files plus directly adjacent owner
   files needed for the same change. Do not default to a repo-wide cleanup.
3. Read the nearest canonical owner for the touched surface before copying a
   nearby shape.
4. Inspect current quality evidence for the scope. Prefer the helper:
   `tools/quality/reporting/continuous_refactoring_candidates.py --scope <path>`.
   If the helper is insufficient, read the underlying reports directly.
5. Search the planned write set and directly owning adapters for
   `LEGACY_REMOVE_ON_TOUCH` markers.
6. Classify the pass as `Scoped Cleanup`, `Replacement Refactor`,
   `Harness/Governance Repair`, or `Investigation Required`. Use
   `Replacement Refactor` when adapter stacks, ownership subversion,
   self-confirming harness behavior, repeated fix churn, or active delete
   signals show that the old surface must be retired rather than adapted.
7. Separate findings into:
   `Blocking In Scope`, `Small Local Cleanup`, `Replacement Refactor`,
   `Separate Slice`, and `Out Of Scope`.
8. Treat `LEGACY_REMOVE_ON_TOUCH` as `Blocking In Scope` when the marked file,
   class, method, or owning adapter is touched by the current task. Remove it,
   include it in the current replacement plan, or report an explicit blocker.
9. Fix new or touched-scope blocker findings before handoff unless the finding
   is a documented false positive owned by the existing gate policy.
10. Include small local cleanup when it is behavior-preserving and stays inside
   the current owner scope.
11. Plan replacement and deletion together when the current goal is to replace
    a bad surface. Do not split the obsolete adapter deletion away when that
    would leave later agents treating it as baseline.
12. Split large refactors into a separate pass when they move public APIs,
    change architecture ownership, require package moves, need dependency
    upgrades, or touch unrelated owners and no Clean-Break signal ties deletion
    to the current goal.
13. For dependency work, check whether Dependabot already owns the update path.
   Dependency upgrades must remain dependency-only unless the user explicitly
   combines them with product work.
14. Temporary adapters left after a replacement pass must have an owner,
    removal condition, and proof that they are not target architecture.
15. Run the required SaltMarcher verification surface for the actual changed
    files and keep the literal result available for review.
16. Write the implementation pass log required by
    `docs/project/architecture/agent-instructions.md` under
    `build/agent-pass-logs/`. Include local cleanup decisions, abandoned
    approaches, reversals, repeated edits, architecture friction, quality
    tradeoffs, and verification results.
17. Before starting the review step, read and follow the global caller skills
    `/home/aaron/.codex/skills/local/coord-adversarial-review/SKILL.md` and
    `/home/aaron/.codex/skills/local/coord-main-overview/SKILL.md`; they require
    one main-agent-launched Overview coordinator pass that owns nested
    specialist review and scoped follow-up worker launches before handoff.

## Evidence Sources

Use current local artifacts first:

- `build/reports/pmd/main.xml`
- `build/reports/cpd/main.txt`
- `build/reports/lizard/main.txt`
- `build/reports/ckjm/summary.md` when present
- latest `build/gradle-run-logs/*production-handoff.log`

These artifacts are evidence, not permission to widen the patch. A report may
identify valuable follow-up work that still belongs in a separate slice.

## Cleanup Rules

Allowed in the current pass:

- unused imports, unused local declarations, or stale local constants in touched
  files
- local duplicate logic when both sides belong to the same owner and the
  extraction does not create a new architectural seam
- obvious pass-through helpers or carriers that only preserve legacy wording
  inside the touched owner scope
- `LEGACY_REMOVE_ON_TOUCH` support in the touched file, marked method or class,
  or directly owning adapter; remove it in the same pass instead of reshaping
  or extending it
- replacement of a marked or adapter-stacked surface when the same owner scope
  can retire the obsolete layer and prove the production path
- touched-scope PMD, CPD, Lizard, compile, SpotBugs, and dead-code findings
  whose fix is behavior-preserving

Separate slice required:

- new public APIs, package moves, or role ownership changes
- architecture, domain, view, data, shell, or bootstrap boundary changes unless
  they are explicitly covered by the current Replacement Refactor plan with
  owner, removal condition, and production-path proof
- dependency upgrades
- mechanical mass rewrites
- report-wide cleanup outside the touched owner scope
- any cleanup whose correctness depends on product behavior review and is not
  already part of an explicit Replacement Refactor plan

Forbidden without explicit user approval:

- new legacy or compatibility support without a stated removal condition
- remodeling, extending, or migrating code marked `LEGACY_REMOVE_ON_TOUCH`
  instead of removing it or reporting a blocker
- treating marked temporary adapters or compatibility paths as implementation
  precedent for new code

## Handoff Requirements

Every covered handoff must report one of these exact statuses:

- `Cleanup included`: list the in-scope cleanup performed, including completed
  replacement or deletion work from a `Replacement Refactor` pass.
- `No in-scope cleanup found`: name the reports or focused checks inspected.
- `Deferred as separate slice`: name the finding and why it is not safe inside
  the current pass.

Every covered handoff must also report the adversarial review outcome required
by the global `coord-adversarial-review` caller skill.

Every covered handoff must report `Delete signals`: removed, explicit blocker,
replacement plan, temporary adapter with owner/removal condition, or none found
in the write set.

Every covered handoff must report the implementation pass log path and, when
review completed, the review pass log path or the blocker that prevented the
review log from being written.

Also report out-of-scope blockers discovered while running required gates. Do
not claim that global debt is solved because a scoped pass is clean.

## References

- [Clean as You Code](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/sonar-clean-as-you-code.md)
- [Small CLs](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/google-small-cls.md)
- [The Standard of Code Review](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/google-code-review-standard.md)
- [GitLab Code Quality](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/gitlab-code-quality.md)
- [GitHub Pull Request Code Scanning Alerts](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/github-code-scanning-pr-alerts.md)
- [Dependabot Version Updates](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/github-dependabot-version-updates.md)
- [Dependabot Options Reference](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/github-dependabot-options.md)
- [OpenRewrite Gradle Plugin Configuration](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/openrewrite-gradle-plugin-configuration.md)
- [OpenAI Codex Refactor Your Codebase](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/openai-codex-refactor-your-codebase.md)
- [OpenAI Codex Worktrees](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/openai-codex-worktrees.md)
- [Global Main To Overview Coordination Skill](/home/aaron/.codex/skills/local/coord-main-overview/SKILL.md)
- [Global Adversarial Review Caller Skill](/home/aaron/.codex/skills/local/coord-adversarial-review/SKILL.md)
- [Global Adversarial Review Agent Skill](/home/aaron/.codex/skills/local/lens-adversarial-review-agent/SKILL.md)
