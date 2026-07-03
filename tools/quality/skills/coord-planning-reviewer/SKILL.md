---
name: coord-planning-reviewer
description: Use inside a SaltMarcher planning-review coordinator before launching artifact-lens or content-lens reviewer subagents for CR or planning-bundle review. Defines neutral reviewer briefings, artifact-vs-content lens boundaries, and coordinator-derived risk propositions for content lenses.
---

# Coordination: Planning Review Coordinator To Reviewer

## Role

Use this skill inside a planning-review coordinator before launching any
artifact-lens or content-lens reviewer subagent for CR or planning-bundle
review.

Mandatory coordinator skills before this skill:

- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md`
- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator/SKILL.md`
- `tools/quality/skills/lens-coordinator-cr-review/SKILL.md` for CR review,
  or `tools/quality/skills/lens-coordinator-plan-review/SKILL.md` for
  planning-bundle review

This skill is a briefing contract. It does not review artifacts, select the
final verdict, replace the matching artifact lens, or fork repo-owned `lens-*`
criteria.

## Reviewer Isolation

Every reviewer receives an isolated, artifact-specific briefing. Do not pass:

- conversation history
- other reviewers' findings
- coordinator expectations about likely acceptance
- implementation-defense rationale
- broad unrelated dirty-worktree context

Give only neutral facts needed to inspect the assigned artifact, baseline,
owners, evidence, and lens risk.

## Artifact Lens Briefing

Artifact-lens reviewers check artifact contract, baseline availability,
planning logistics, worker readiness, proof/review route, and downstream
authority for the reviewed artifact or bundle.

Each artifact-lens reviewer prompt must include:

- `Role`: the matching artifact lens.
- `Scope`: reviewed artifact path and required generated review artifact path.
- `Upstream Authority`: accepted upstream artifacts and reviews required by
  the artifact type, or accepted CR/CR review for a planning bundle.
- `Baseline Evidence`: repo paths, logs, proof snippets, and dirty-baseline
  boundary needed to check current-state claims.
- `Artifact Review Focus`: formal contract, CR intent preservation or planning
  bundle coverage, planning quality, dependency order, authorized step-plan
  readiness, proof route, review route, and decision completeness.
- `Constraints`: read-only, no edits, no staging, no commits, no formatters,
  no proof reruns, no subagent launches.
- `Required First Skill`:
  `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md`.
- `Assigned Lens`: exact artifact-lens skill path.

Artifact lenses may report missing specialist coverage when the artifact risk
requires a content lens.

## Content Lens Briefing

Content-lens reviewers evaluate whether the plan or CR is substantively good
through their assigned expertise. The planning-review coordinator, not Main,
must derive the risk proposition from neutral evidence. Reviewers must not be
reduced to checking whether the artifact satisfies Done When wording, keeps
gates intact, or restates upstream obligations.

Each content-lens reviewer prompt must include:

- `Role`: one assigned repo-owned content lens.
- `Risk Reason`: the concrete artifact signal that selected this lens.
- `Scope`: reviewed artifact plus the owner docs, code, logs, or proof evidence
  needed to judge the risk.
- `Upstream Authority`: accepted CR and CR review for a planning bundle, or
  explicit absence when reviewing a CR.
- `Coordinator-Derived Risk Proposition`: one falsifiable proposition about
  target direction, architecture choice, phase or step decomposition, repair
  strategy, proof strategy, or tradeoff that this lens must stress-test.
- `Evidence To Inspect`: concrete owner documents, code paths, logs, proof
  snippets, dirty-baseline facts, and current-state claims the reviewer must
  check against repo evidence.
- `What Would Make This Plan Wrong`: the condition that would turn the
  proposition into a blocker, rework finding, or evidence gap.
- `Alternative / Rejected Shortcut / Tradeoff To Compare`: at least one
  plausible alternative path, shortcut, or tradeoff the reviewer should test
  against the proposed plan.
- `Expected Specialist Judgment`: the fachliche judgment this lens must return,
  such as target fit, baseline truth, owner fit, dependency/proof feasibility,
  missed blockers, alternative quality, and residual risk.
- `Worker-Ready Quality Focus`: whether the plan already decides API shape,
  ownership boundary, migration path, compatibility budget, slice order, and
  proof oracle, or whether it wrongly pushes those decisions to the worker.
- `Artifact Boundary`: formal field, formatting, and provenance checks belong
  to the artifact lens unless a formal defect prevents this content lens from
  judging the substantive risk.
- `Constraints`: read-only, no edits, no staging, no commits, no formatters,
  no proof reruns, no subagent launches.
- `Required First Skill`:
  `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md`.
- `Assigned Lens`: exact repo-owned `lens-*` skill path.

Content-lens prompts must ask for a verdict on the assigned substantive risk:
target fit, baseline truth, alternative/tradeoff quality, missed blockers,
owner fit, dependency/proof feasibility, worker-ready decision quality, and
residual risk. For an architecture lens, explicitly ask whether the proposed
target and boundaries are architecturally right for the current project
context, not only whether the plan obeys its own allowed write set.

Content-lens reviewers must apply their assigned skill's expertise to answer
the coordinator-derived proposition with evidence. They must not paraphrase the
plan, treat the plan's claims as accepted truth, or answer a different formal
artifact question.

## Outcome Anchoring Boundary

Do not give content-lens reviewers pre-decided `Success Criteria / Done When`
as the acceptance frame. Provide the artifact's stated Done When as evidence to
challenge, not as the answer key.

Invalid content-lens briefing patterns include:

- asking only whether the artifact satisfies its existing Done When
- asking whether the plan includes a field, link, route, log, proof command, or
  role-triggered skill
- asking whether the plan preserves CR, roadmap, phase, guard, review,
  implementation-log, qualitative review, or implementation-review gates
- asking only whether the write set is narrow enough
- asking only whether upstream obligations are repeated or not skipped
- accepting abstract target principles without per-surface technical decisions
- accepting `where it fits`, `if needed`, or generic inventory language without
  decision criteria and downstream consequence
- accepting a plan that leaves API shape, owner boundary, migration strategy,
  compatibility budget, slice order, or proof oracle to the implementation
  worker
- telling the reviewer the intended solution is the accepted target
- omitting baseline evidence needed to prove or disprove the plan's premise
- omitting `What Would Make This Plan Wrong`
- omitting an alternative, rejected shortcut, or tradeoff to compare

When a content-lens reviewer returns only formal artifact findings, only
confirms gate preservation, only paraphrases plan claims, or never answers the
coordinator-derived risk proposition, treat that reviewer output as incomplete
and return `Blocked` or rebrief the reviewer before accepting the planning
artifact.

## References

- [CR Review Coordinator Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-cr-review/SKILL.md:1)
- [Plan Review Coordinator Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-plan-review/SKILL.md:1)
- [Main To CR Review Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-main-cr-review/SKILL.md:1)
- [Main To Plan Review Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-main-plan-review/SKILL.md:1)
- [Implementation Artifacts Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/implementation-artifacts.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-instructions.md:1)
