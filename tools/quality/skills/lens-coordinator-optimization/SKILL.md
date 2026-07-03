---
name: lens-coordinator-optimization
description: Use inside an Overview coordinator subagent when the goal is to critique the current state and propose cleaner alternatives, when Clean-Break signals appear, or when the current architecture/check/harness may be the problem rather than the baseline. Adds optimization-oriented panel selection and alternative synthesis on top of `lens-coordinator`.
---

# Lens: Optimization Coordinator

## Role

Use this skill inside an Overview coordinator when the goal is to make the
current state as clean as practical, not merely handoff-ready.

Mandatory generic skill:

- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator/SKILL.md`

This skill is additive. The generic coordinator workflow lives in
`lens-coordinator`; this skill only adds optimization-oriented critique,
suboptimality classification, and alternative synthesis. It must reuse the
generic coordinator's exploration, slice creation, panel creation, reviewer
launch, and aggregation workflow.

Optimization review criticizes the current artifact, design, implementation, or
decision and proposes better alternatives. Any supported improvement finding is
blocking same-run work for Main unless it is closed as false-positive or
review-owned with evidence. It must not treat existing architecture, checks,
harnesses, or standards as unquestionable constraints when the assignment or
evidence indicates that those constraints may be part of the problem.

Use this lens automatically when Clean-Break signals appear: adapter-on-adapter
stacks, ownership subversion, self-confirming harness behavior, repeated
blocker-driven churn, or explicit delete markers such as
`LEGACY_REMOVE_ON_TOUCH`. In those cases, evaluate whether the old layer should
be retired instead of wrapped, and treat marked temporary adapters as suspect
baseline until proven otherwise.

## Optimization Lens Selection

Select lenses by the improvement signal, not by panel size. Prefer the narrowest
lens that can evaluate the dominant suboptimality, and add a second lens only
when the same slice has a distinct optimization question.

Use these lenses for optimization review:

- `lens-architecture`: use for fundamental architecture questions, ownership
  boundaries, dependency direction, public APIs, layering, build/enforcement
  lifecycle, architecture-significant refactors, or when checks/harnesses may
  encode the wrong boundary. Use this lens to evaluate whether the architecture
  itself should change, not only whether the current solution fits it.
- `lens-performance`: use when the improvement question concerns hot paths,
  rendering, startup, memory pressure, allocation rate, query cost, batch work,
  large data volume, latency, concurrency, or resource consumption.
- `lens-structure`: use when the problem is file, package, folder, module, or
  artifact organization; poor discoverability; weak co-location; or high mental
  navigation cost.
- `lens-quality`: use as the broad default for maintainability and local design
  quality when the signal spans smells, readability, and simplicity together or
  when no narrower specialist lens dominates. Do not use it as a substitute for
  a clearer `lens-architecture`, `lens-performance`, `lens-security`, or
  `lens-structure` signal.
- `lens-simplicity`: use when the main question is whether fewer concepts,
  types, classes, abstractions, files, or lines can achieve the same behavior
  with less accidental complexity.
- `lens-elegance`: use when expression quality dominates: naming, API shape,
  control flow, debuggability, teachability, or how naturally the code reads.
- `lens-smells`: use when concrete anti-patterns are suspected: duplication,
  shotgun surgery, temporal coupling, hidden coupling, test smells, god objects,
  speculative generality, or other compounding maintainability smells.
- `lens-conventions`: use when multiple local idioms compete, a pattern should
  be normalized, naming or placement is inconsistent, or a repeated practice
  needs a canonical convention.
- `lens-critical-analysis`: use for tradeoff stress tests, rule/check
  challenges, architecture decisions, finding triage, direction choices, or
  any question shaped like "is this the right constraint or approach?"
- `lens-research-alternatives`: use only when external evidence is needed to
  compare realistic alternatives, libraries, patterns, or technologies; apply
  source-reference requirements before relying on outside sources.
- `lens-security`: use when optimization touches trust boundaries, secrets,
  auth/authz, external input, persistence, process execution, file/network
  access, dependency exposure, or sensitive data handling.
- `lens-design`: use for visual UI improvement questions: hierarchy, spacing,
  color, typography, iconography, polish, design-system fit, or component
  aesthetics.
- `lens-ux`: use for interaction-model improvement questions: flows, mode
  transitions, state preservation, information architecture, workflow
  efficiency, and system-level behavioral coherence.
- `lens-onboarding`: use for developer-experience improvement questions:
  READMEs, comments, newcomer path, agent-facing instructions, skill/prompt
  clarity, or workflow comprehensibility.

Selection rules:

- Use `lens-quality` as the first fallback only when the optimization signal is
  broad maintainability. Prefer a narrower specialist when one risk clearly
  dominates.
- If production code changed repeatedly because of harness blockers, quality
  gates, architecture checks, or rule-driven rewrites, include
  `lens-architecture` and `lens-critical-analysis` unless the assignment
  explicitly excludes governance or architecture questions. Treat the repeated
  churn as a signal that the constraint itself may be suboptimal.
- If the reviewed scope contains delete markers, to-be-retired adapters, or
  temporary compatibility seams, include `lens-architecture` and
  `lens-simplicity` unless a narrower owner proves the marker is unrelated.
  Ask reviewers whether the diff removes, contains, or normalizes the marked
  surface.
- Use multiple lenses on one slice only when each lens answers a different
  optimization question. Otherwise keep one reviewer per slice with the best
  fitting lens.
- Keep `Handoff Blockers Found` separate from optimization findings. Sort
  optimization findings by suboptimality severity, not by handoff-fix class.

Do not present supported optimization findings as optional suggestions. If the
evidence supports the finding, it is blocking same-run work; if not, close it as
false-positive/review-owned with evidence.

## Suboptimality Severity

Sort optimization findings by suboptimality severity, not by handoff blocker
status. Use these severity levels inside the optimization result:

- `Severe Suboptimality`: the current approach is materially harder to change,
  reason about, operate, or extend than a practical alternative, and the cost is
  likely to compound soon.
- `Moderate Suboptimality`: the current approach works but creates avoidable
  complexity, inconsistency, or friction that is worth improving when the pass
  can absorb it.
- `Minor Suboptimality`: a small local cleanup would improve clarity,
  consistency, or reversibility and should be handled in the same run.
- `Tradeoff / Keep`: the current approach is proportional or a proposed
  alternative has costs that outweigh the benefit; include the closing
  evidence.

If a reviewer finds a true `Must Fix Before Handoff`, report it in a separate
`Handoff Blockers Found` subsection before optimization findings. Do not mix
that blocker into the suboptimality ranking.

## Challenge Existing Constraints

For optimization reviews, existing rules are evidence, not final answers.
Actively evaluate whether architecture boundaries, quality gates, harnesses,
check rules, or documented standards are the right constraints for the current
problem when any of these signals appears:

- the production code had to be changed multiple times mainly to satisfy
  harness or check blockers
- the implementation preserves an adapter stack or marked-to-delete layer as
  baseline instead of retiring it
- the clean implementation becomes less direct, less cohesive, or harder to
  explain because of a check rule
- the rule protects a real invariant but at the wrong layer, granularity, or
  abstraction level
- reviewers can describe a simpler architecture that preserves the same product
  behavior and invariant

In that case, ask reviewers to evaluate both the current implementation and the
constraint that shaped it. The result may require changing production code,
changing the check/harness/rule, or documenting a deliberate tradeoff in the
same run; do not route the finding to a separate architecture-governance slice.

## Alternative Synthesis

After reviewers finish:

- group findings by underlying design pressure
- identify questioned constraints and whether they should stand, change, or move
- identify delete or retire signals and whether the current pass removes,
  quarantines, or incorrectly normalizes them
- identify the smallest cleanup that materially improves the current state
- identify larger alternatives only when Main must choose among same-run fixes
- name tradeoffs and reversibility for every major alternative
- reject alternatives that solve a different goal than the user's current goal
- report when the current approach is already the best proportional option

## Output Format

Return one top-level section named `Optimization Coordinator Result` with:

- `Reviewability`: `Ready`, `Not Reviewable Yet`, or `Blocked`.
- `Current State`: concise evidence-backed description of what was reviewed.
- `Panel`: reviewer, skill, scope, reason, and outcome.
- `Handoff Blockers Found`: true `Must Fix Before Handoff` findings, or
  `None`.
- `Questioned Constraints`: architecture rules, checks, harness blockers, or
  standards that were evaluated, with keep/change/move recommendation.
- `Delete Signals`: marked adapters, temporary seams, or retire candidates
  inspected, with remove/keep-temporary/blocker classification.
- `Optimization Findings`: grouped findings sorted by suboptimality severity.
- `Alternatives`: candidate alternatives, tradeoffs, and reversibility.
- `Current-Pass Recommendations`: changes worth doing now.
- `Blocking Same-Run Work`: supported optimization findings Main must handle
  before completion.
- `Final Status`: clean enough, optimize in this pass, or handoff blocker found.

## References

- [Coordinator Lens](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator/SKILL.md)
- [Adversarial Review Agent Lens](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md)
