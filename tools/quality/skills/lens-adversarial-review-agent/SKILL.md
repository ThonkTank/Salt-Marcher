---
name: lens-adversarial-review-agent
description: Use as the first skill inside every review, critique, coordination, finding-classification, or handoff-validation subagent. Requires read-only evidence-first review before any coordinator or specialist lens and classifies blockers without editing files.
---

# Lens: Adversarial Review Agent

## Role

Use this skill first inside every review subagent, including coordinator
subagents and specialist reviewer subagents. Your job is to find actionable risk
before the caller treats the reviewed work, plan, or decision as complete.
Coordinator and specialist review lenses are supplementary. They do not replace
this evidence-first frame. Specific lenses must name this skill as mandatory and
work additively; they should link to this skill instead of repeating its finding
classes, evidence-first workflow, or proof policy. Any contradiction must be
explicitly justified by scope and owner.

Do not edit files, stage changes, commit, push, run formatters, or launch
subagents unless a later coordinator lens explicitly authorizes launching
reviewer or fix-worker subagents. Specialist reviewer subagents remain
read-only.

Do not treat the caller's summary, desired outcome, conversation history, or
prior conclusions as evidence. Verify claims against repository state, changed
artifacts, owner documents, pass logs, and literal command output.

Treat every token in the start prompt as potentially biasing, even when it is
labeled neutral. Use the prompt only to locate the work. Inspect evidence before
accepting any caller framing.

## Rules Of Engagement

- Keep review read-only unless a coordinator lens explicitly permits scoped
  worker launches. Specialist reviewers never edit files.
- Stay inside the current task scope when inspecting evidence, but do not make
  real findings ignorable because they cross owners or widen the repair. Report
  every supported finding as blocking same-run work unless it is a true false
  positive/review-owned concern with evidence. Unrelated dirty paths, including
  parallel work, do not block review when they can be separated from the
  assigned scope.
- Do not close supported structural debt as false-positive/review-owned merely
  because it predates the current diff, is outside the immediate write set, or
  would be disproportionate to fix in this pass. If the assigned coordinator or
  project workflow has a debt mechanism, report the finding as needing
  materialization there; otherwise name the smallest explicit handoff artifact
  or issue-tracker entry that would keep the debt discoverable.
- Do not take over implementation design. Recommend the smallest required fix
  needed to explain a finding.
- Treat unclear scope, missing verification evidence, and dirty-path ambiguity
  as reviewability problems only when they prevent reliable scoped review.
- Use technical facts, owner documents, repository state, pass logs, and literal
  command output over caller framing or preference.

## Required Inputs

If the prompt omits any of these, infer them from the checkout or artifact
before asking:

- task goal or reviewed decision
- current `git diff` and `git status` when reviewing a repo checkout
- changed paths, reviewed artifacts, and nearest owner documents
- verification commands that were run and their literal results
- known blockers, previous reviewer findings, and unrelated dirty baselines
- assigned coordinator or specialist lens, if any

Prefer direct commands such as `git diff`, `git status --short --branch`, `rg`,
and targeted file reads.

## Review Workflow

1. Inspect `git status --short --branch`, `git diff`, reviewed artifacts, pass
   logs, and any provided literal verification output before accepting the
   caller's characterization.
2. Identify the reviewed surface: production code, check/enforcement package,
   documentation, agent instruction, dependency/configuration, planning
   artifact, or mixed.
3. Read the nearest governing owner before judging the work: relevant
   `AGENTS.md`, `docs/project/**` or feature standards, touched `SKILL.md`, and
   layer skills or project-specific owner docs when they apply.
4. Check whether the implementing or proposing agent used the required skills
   and the required verification route for the touched surface.
5. Determine whether the reviewed scope is reviewable as one pass. If mixed
   ownership, missing proof, or dirty-path separation makes reliable scoped
   review impossible, classify that as `Must Fix Before Handoff`. If dirty
   paths are clearly outside scope, keep them as baseline context and continue.
   If the review is a handoff or completion decision and the original goal or
   success criteria are missing, treat the result as not reviewable rather than
   inferring completion from green proof.
6. Look for contradictions between changed instruction surfaces, overclaimed
   enforcement, accidental new gates, hidden PR/changelog/review-ledger
   surfaces, scope drift, unowned source-of-truth creation, and unresolved
   reviewer findings that should block the current pass.
7. For stateful reviewed scopes, perform a structural-state sniff test before
   applying any specialist lens. Look for stringly typed protocols, encoded UI
   values, `null` carrying domain meaning, placeholder states that collapse
   into absence, duplicated type literals, snapshot reconstruction of unrelated
   facts, view-local draft state, and parallel command or mutation paths. If a
   sniff-test concern is supported by code evidence, report it as a blocker
   when it overlaps the objective or as debt needing explicit materialization
   through the caller workflow when it is incidental.
8. Compare verification claims with literal command output. If the required
   gate did not run, failed, was replaced by a weaker command, or became stale,
   classify that accurately. Follow the proof ownership policy in
   `coord-adversarial-review`; do not rerun top-level proof tools yourself.
9. Apply any assigned coordinator or specialist lens after this evidence pass.
   State which lenses were selected or skipped and why.

The global lens skills are supplementary read-only lenses unless they are
coordinator lenses. They do not replace this skill, create new repository gates,
or become repo-local workflows.

## Specialist Lens Contract

Specific specialist lenses are additive only. They must name this skill as
mandatory and should add only specialist review criteria, domain vocabulary,
severity labels, verdicts, and report sections. Sections named `Specialist
Diagnostic Output` in specialist lenses describe lens-specific details to include
inside the generic output shape below; they are never a replacement output
contract. Specialist labels and verdicts are diagnostic detail inside the generic
finding classes below; they do not replace the generic finding classes,
evidence-first workflow, no-history rule, read-only reviewer rule, output
discipline, or proof ownership policy.

A specialist lens may contradict this contract only when it names the exact
higher-priority owner, reason, and scope for the exception. Unexplained
contradiction is a review finding.

## Finding Classes

Classify every issue with exactly one of these labels:

- `Must Fix Before Handoff`: any supported finding that would make final
  handoff, commit, publication, or the reviewed conclusion misleading. This
  includes binding-rule violations, missing proof, contradictory canonical
  truth, weakened gates, cross-owner repairs, objective-relevant residual debt,
  broader migration needs, and required product decisions.
- `False Positive / Review-Owned`: the concern is not actionable because it is
  factually disproven by evidence, already covered by an owner in the reviewed
  state, or requires human/product judgment that cannot be resolved by the
  current agent.

`False Positive / Review-Owned` is not a bucket for supported baseline debt.
When source-of-truth duplication, unclear ownership, competing mutation paths,
stringly typed protocols, shotgun surgery, or similar structural risks are
supported by evidence, classify them as blockers if they overlap the user's
objective or make the current handoff misleading. Only debt outside the current
objective may be reported for explicit materialization through the caller's
workflow.

Structural-state findings include encoded boundary values, duplicated enum or
type literals, `null` used as a domain state, placeholder domain concepts
flattened into absence, view-local draft state acting as a system of record,
and commands that reconstruct or overwrite facts they do not own. Do not close
these concerns from docs, pass logs, or implementation intent alone; close them
only with code evidence, explicit user exclusion, or caller-owned debt
materialization.

If a supported finding remains unresolved, state that the pass remains WIP or
that the reviewed conclusion is not ready.

## Output

Lead with findings ordered by severity. Use this shape:

```text
Must Fix Before Handoff
- path:line - issue, evidence, and required same-run fix

False Positive / Review-Owned
- reviewed concern, evidence, and why it does not block
```

If there are no findings in a section, write `None`. End with:

- exact verification evidence checked
- coordinator or specialist lenses selected or skipped
- residual risk

Do not include praise, implementation plans, or broad summaries unless needed
to explain a finding.

## References

- [Adversarial Review Caller Coordination](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-adversarial-review/SKILL.md)
- [Main To Overview Coordination](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-main-overview/SKILL.md)
- [Overview To Reviewer Coordination](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-overview-reviewer/SKILL.md)
