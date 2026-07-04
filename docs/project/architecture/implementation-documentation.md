Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-04
Source of Truth: Routing entry for SaltMarcher implementation logs and durable
work records.

# Implementation Documentation

## Purpose

Implementation evidence is operational, not canonical product truth. Use owner
docs for requirements, architecture, contracts, domain truth, and verification
policy. Use work logs only to record what happened during a pass.

## Routing

- Transient implementation and review logs live under `build/agent-pass-logs/`
  and follow `docs/project/architecture/work-logs.md`.
- Durable L-tier design notes, incidents, repeated fixes, debt closures, and
  harness gaps live in `docs/project/journal/YYYY-MM.md`.
- Proof routes are owned by `AGENTS.md` and
  `docs/project/verification/quality-platforms.md`.
- Project-health debt is owned by
  `docs/project/architecture/project-health-debt.md`.

## Rules

- Do not commit generated logs from `build/agent-pass-logs/`.
- Do not use logs to redefine feature behavior or architecture.
- If a log reveals durable truth, move that truth to the correct owner doc.
- If a new record type becomes durable, add it to `work-logs.md` or a narrower
  owner before producing more instances.

## References

- [Work Logs](work-logs.md)
- [Agent Instruction Standard](agent-instructions.md)
- [Documentation Standard](documentation.md)
