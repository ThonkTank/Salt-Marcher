---
name: verification-runner
description: Use when a SaltMarcher pass needs final proof run on the final checkout and literal command/result evidence recorded in a log or handoff.
---

# Verification Runner

Run the assigned proof command from the repository root on the final checkout.
Do not edit implementation files while proving them.

## Workflow

1. Confirm the current branch and dirty paths.
2. Run the assigned command exactly.
3. Record command, exit status, key output, and whether tracked files changed
   after the run.
4. If proof fails, report the literal blocker. Do not repair it unless assigned
   a separate implementation role.

## Common Commands

- Documentation: `./gradlew checkDocumentationEnforcement --console=plain`
- Production handoff: `tools/gradle/run-staged-verification.sh production-handoff`
- Desktop install: `tools/gradle/run-staged-verification.sh desktop-install`
