---
name: continuous-refactoring
description: Use before planning, implementing, refactoring, or reviewing SaltMarcher production-code, check/enforcement, or dependency work. Keeps cleanup in the normal development pass by applying scope-based report intake, small local cleanup, dependency freshness checks, and explicit handoff reporting without creating new gates.
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
5. Separate findings into:
   `Blocking In Scope`, `Small Local Cleanup`, `Separate Slice`, and
   `Out Of Scope`.
6. Fix new or touched-scope blocker findings before handoff unless the finding
   is a documented false positive owned by the existing gate policy.
7. Include small local cleanup when it is behavior-preserving and stays inside
   the current owner scope.
8. Split large refactors into a separate pass when they move public APIs,
   change architecture ownership, require package moves, need dependency
   upgrades, or touch unrelated owners.
9. For dependency work, check whether Dependabot already owns the update path.
   Dependency upgrades must remain dependency-only unless the user explicitly
   combines them with product work.
10. Run the required SaltMarcher verification surface for the actual changed
    files and keep the literal result available for review.
11. At the end of implementation, run the repo-wide adversarial review route
    through the repo-owned caller skill
    `tools/quality/skills/adversarial-review/SKILL.md` after the diff exists
    and after the verification attempt has a literal result, even when
    verification is red or the pass remains WIP.
12. Ensure the independent review subagent uses
    `tools/quality/skills/adversarial-review-agent/SKILL.md`, then resolve
    review findings according to the caller skill before final handoff or any
    commit/publication decision.

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
- touched-scope PMD, CPD, Lizard, compile, SpotBugs, and dead-code findings
  whose fix is behavior-preserving

Separate slice required:

- new public APIs, package moves, or role ownership changes
- architecture, domain, view, data, shell, or bootstrap boundary changes
- dependency upgrades
- mechanical mass rewrites
- report-wide cleanup outside the touched owner scope
- any cleanup whose correctness depends on product behavior review

## Handoff Requirements

Every covered handoff must report one of these exact statuses:

- `Cleanup included`: list the in-scope cleanup performed.
- `No in-scope cleanup found`: name the reports or focused checks inspected.
- `Deferred as separate slice`: name the finding and why it is not safe inside
  the current pass.

Every covered handoff must also report the adversarial review outcome required
by the repo-owned caller skill. Do not add a separate changelog, pull-request
template, or review-ledger file solely for this evidence; normal commit
history, handoff text, and memories carry the history.

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
- [Adversarial Review Caller Skill](../adversarial-review/SKILL.md)
- [Adversarial Review Agent Skill](../adversarial-review-agent/SKILL.md)
