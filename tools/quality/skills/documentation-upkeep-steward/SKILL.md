---
name: documentation-upkeep-steward
description: Use for SaltMarcher autonomous documentation-upkeep agent slices or Warden-provided documentation-upkeep tasks. Ordinary human-requested documentation edits do not trigger this skill unless explicitly routed into that autonomous steward workflow.
---

# Documentation Upkeep Steward

Repo-local router for autonomous documentation-upkeep agent work, Warden
documentation-upkeep packets, steward-slice planning/implementation/review, and
follow-up from steward findings. It is not a Warden, judge, benchmark, budget,
merge, or documentation-standard owner. Ordinary docs edits keep normal owner
routing unless explicitly placed in this autonomous steward workflow.

Classify every steward task before editing:

- `S1 Accessibility`: navigation/readability layers may point to owner docs but
  must not define new truth.
- `S2 Presentation`: reshape existing docs only when meaning is preserved.
- `S3 Expansion`: new docs/sections need repo, owner-doc, pass-log, or
  source-reference provenance; non-derivable truth becomes draft/open question
  or finding.
- `S4 Finding`: contradictions or gaps become project-health findings or new
  governed tasks with both sides cited; the steward does not decide truth.
- `S5 Documentation Model`: `documentation.md` changes need external
  epoch/token authority plus normal instruction workflow; otherwise block.

Do not autonomously edit `AGENTS.md`, `SKILL.md`, `src/**`, `test/**`,
`tools/**`, Gradle/build/gates, Warden state, or source mirrors. Instruction
surfaces still use `agent-instruction-engineering`; external evidence still
uses `source-references`; documentation contradictions/gaps route through
`project-health`.

Do not silently change active truth semantics, fabricate plausible missing
truth, weaken documentation-review rules, or bypass current workflow, proof,
and review. Treat Meaning-Diff, provenance sampling, and navigation benchmarks
as external Warden context unless current repo rules provide local commands.

References: [Agent Guide](../../../../AGENTS.md), [Agent Instruction Standard](../../../../docs/project/architecture/agent-instructions.md), [Documentation Standard](../../../../docs/project/architecture/documentation.md), [Project Health](../../../../docs/project/architecture/project-health.md), [Source References](../../../../docs/project/verification/source-references.md).
