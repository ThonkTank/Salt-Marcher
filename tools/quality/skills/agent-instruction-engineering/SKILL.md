---
name: agent-instruction-engineering
description: Use when creating, editing, reviewing, or refactoring SaltMarcher agent-facing instruction surfaces such as AGENTS.md, SKILL.md, agents/openai.yaml, workflow standards, or prompt-governance markdown.
---

# Agent Instruction Engineering

Treat instructions as executable control surfaces. Use this skill for
`AGENTS.md`, any `SKILL.md`, `agents/openai.yaml`, workflow standards, and
Markdown whose primary purpose is to steer agents.

## Workflow

1. Classify the surface: router, skill, standard, metadata, or narrow prompt.
2. Read the nearest owner before editing.
3. Put durable rules in the lowest stable owner and leave other files as short
   routers.
4. Prefer direct `when X, do Y` instructions over aspirations or anti-pattern
   lists.
5. Remove duplicate or conflicting rules instead of adding exceptions.
6. Keep `agents/openai.yaml` derived from the governing `SKILL.md`; do not move
   operative workflow into metadata.
7. For instruction-surface changes, keep net instruction volume unchanged or
   lower unless the user explicitly accepts growth. State the line-count trade
   in the log or PR.

## References

- [Agent Instruction Standard](../../../../docs/project/architecture/agent-instructions.md)
