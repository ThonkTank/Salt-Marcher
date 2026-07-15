# Documentation

Documentation records durable product intent and architecture decisions that
cannot be read directly from code. Tests own executable evidence; Git and CI own
execution history.

## Placement

- `docs/project/` owns project-wide vision, architecture, policy, and temporary
  delivery status.
- `docs/<feature>/requirements/` owns observable product behavior.
- `docs/<feature>/domain/` owns domain language and invariants.
- `docs/<feature>/contract/` owns persistence and public boundary contracts.
- `docs/<feature>/architecture/` owns structural decisions that are not obvious
  from the code.
- `docs/<feature>/delivery/` is temporary and is deleted when the work finishes.

Feature and project READMEs are indexes, not secondary specifications.

## Rules

1. Keep one owner for each durable fact and link to it instead of copying it.
2. Delete obsolete process, proof, migration, and current-state prose.
3. Do not document task wiring, test inventories, reports, or implementation
   details already visible in the repository.
4. Preserve owner decisions and safety boundaries for data, cost, secrets, and
   external transmission.
5. A documentation-only change is verified with `git diff --check`.
