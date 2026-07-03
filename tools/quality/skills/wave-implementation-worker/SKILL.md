---
name: wave-implementation-worker
description: "Use for a clean-start implementation subagent that receives one local-contract wave-plan artifact from Wave Coordination and implements only that bounded slice. Use only for implementation workers, not mapping, planning, review, or commit."
---

# Wave Implementation Worker

## Role

Use this skill inside an implementation worker launched by Wave Coordination.
The worker implements one local wave-plan artifact and reports the result back
to the Wave Coordinator. When local implementation documentation defines
artifact roles, that owner decides roadmap, plan, implementation-log, and
review-log shape.

## Required Input

The worker must receive one local-contract-compliant wave-plan artifact, the
assigned implementation-log path when the local contract requires one, plus any
mandatory owner docs or skills named by that artifact. The local artifact
contract owns the plan and log fields. If no local contract exists, or the
worker cannot identify the assigned write boundary, required output log, and
done-when proof from the artifact, report a blocker instead of inventing fields
or returning chat-only completion.

When the local contract defines implementation-log form, the worker owns that
form for its assigned log. Missing log fields are direct mechanical form errors
only when the value is derivable from the accepted step plan, literal diff,
commands already run, and unchanged implementation result. Repair those fields
directly and rerun the smallest assigned log/proof check. Do not use form repair
to change implementation claims, scope, proof route, or completion status.

If the prompt includes the full roadmap, full coordinator goal, planner
rationale, prior phase history, review strategy, or commit policy beyond the
local plan artifact's required proof/review route, treat that as over-broad
context and ask for a local-contract-compliant wave-plan artifact before
proceeding.

## Required Workflow

1. Start clean. Do not rely on a forked parent conversation.
2. Read only the artifact-assigned read surface plus mandatory owner docs or
   skills required by the touched files.
3. Edit only the artifact-assigned write boundary.
4. Do not infer unrelated goals from surrounding files or previous phases.
5. If the slice is underspecified, blocked, or requires wider context, stop and
   report the exact missing input instead of widening scope.
6. Run only the checks explicitly assigned by the local plan artifact, unless
   local policy makes a narrower required check mandatory.
7. Do not review, commit, stage unrelated files, modify files outside the
   assigned write boundary, or mutate the roadmap except for an explicitly
   assigned coordinator status update.
8. Write the assigned implementation log when the local contract requires one;
   otherwise return the worker result required by the local implementation-log
   contract.

## Output Contract

Write the assigned implementation log when the local artifact contract requires
a durable log. Returning chat-only status is insufficient for workflows whose
local contract requires that log before proof or review. This worker
skill does not own implementation-log fields. If no local output contract exists
or no required log path was assigned, report that blocker to the coordinator
instead of inventing a report schema.
