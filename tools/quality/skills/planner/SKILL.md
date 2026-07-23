---
name: planner
description: Produces short M-tier implementation plans and L-tier journal design notes for SaltMarcher work after architecture decisions are settled. Use when a change needs implementation sequencing before editing; use architecture-planning instead when the user explicitly requests greenfield or architecture-significant refactor design with independent error search and replanning.
---

# Planner

Planning is lightweight and decision-focused.

## M-Tier Plan

Write 5-15 lines covering:

- goal
- write set
- proof command
- risks
- done-when facts

## L-Tier Design Note

When the user asks for a durable L-tier note or it removes a concrete
implementation risk, append one page to `docs/project/journal/YYYY-MM.md` before
implementation. Cover:

- problem
- target state
- alternatives considered
- scope boundary
- done-when facts

## Quality Bar

Plans must name concrete target decisions, rejected shortcuts, owner surfaces,
and proof. Do not produce ceremony, duplicate owner docs, or create extra
review artifacts.
