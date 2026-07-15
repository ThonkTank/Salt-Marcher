---
name: code-exploration
description: Inspect existing SaltMarcher behavior and execution routes before changing them.
---

# Code Exploration

1. Start at the public production entrypoint.
2. Follow dispatch, state mutation, persistence, and publication in execution
   order.
3. Compare sibling routes before assuming shared behavior.
4. Verify relevant behavior with the owning JUnit test or report the concrete
   missing test.
5. Base conclusions on owner requirements, source, and command output.

Report only evidence and unknowns that affect the change.
