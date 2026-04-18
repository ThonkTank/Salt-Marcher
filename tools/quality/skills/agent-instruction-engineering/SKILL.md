---
name: agent-instruction-engineering
description: Governs SaltMarcher agent-facing instruction artifacts. Use when creating, editing, reviewing, or refactoring `AGENTS.md`, any `SKILL.md`, agent rule markdown, prompt-governance standards, or other Markdown files whose primary purpose is to steer Codex or other agents. Also use when checking whether `agents/openai.yaml` still matches the governing instruction source.
---

# Agent Instruction Engineering

## Overview

Use this skill to keep SaltMarcher's agent instructions explicit, scoped, and
internally consistent. Treat agent prompts, skills, and instruction-bearing
governance docs as executable control surfaces, not as narrative documentation.

## Covered Artifacts

Use this skill for work on:

- `AGENTS.md`
- any `SKILL.md`
- Markdown standards or rules that directly govern agent behavior
- Markdown prompt or workflow artifacts meant to steer Codex or other agents
- `agents/openai.yaml` consistency checks after changing the governing skill

Do not use this skill for ordinary feature specs, UI docs, ADRs, or persistence
docs unless those files are directly defining agent behavior.

## Workflow

### 1. Classify the instruction surface

Decide which control surface you are editing before changing wording.

- `AGENTS.md`: project-wide norms only
- `SKILL.md`: reusable operational skill for another agent
- architecture standard: canonical project rule for one topic
- other instruction markdown: narrow prompt or workflow artifact
- `agents/openai.yaml`: UI metadata derived from the governing skill, not the
  primary instruction source

If the requested content belongs in a different surface, move it there instead
of broadening the current file.

### 2. Read the governing context first

Before rewriting, read the nearest authority documents that constrain the
artifact.

- For `AGENTS.md`, read relevant architecture standards and avoid feature-level
  detail.
- For `SKILL.md`, read the owning repo rules and any neighboring references the
  skill already depends on.
- For standards, read `AGENTS.md` and the adjacent standards that could already
  own the topic.

Never guess ownership when the repo already defines it.

### 3. Rewrite for behavioral clarity

Write instructions as operational control logic.

- State what the agent must do, when it must do it, and what is out of scope.
- Prefer explicit triggers over vague intent labels like "be smart" or "use
  judgment."
- Encode proportionality so the agent can distinguish critical behavior from
  optional polish.
- Remove duplicate or conflicting directives instead of piling on exceptions.
- Keep the strongest rules close to the top of the artifact.

### 4. Preserve separation of concerns

Keep each instruction surface narrow.

- Do not turn `AGENTS.md` into a long-form standard.
- Do not hide triggering logic in reference files; the `SKILL.md` description
  must say when the skill should be used.
- Do not put tool, UI, or branding metadata into `SKILL.md` frontmatter.
- Do not let `agents/openai.yaml` drift into a second source of truth.

If a rule is reusable across multiple artifacts, place it in a canonical
standard and have the other files summarize or point to it.

### 5. Run a consistency pass

After editing any covered artifact:

- compare the new wording against adjacent instruction files
- remove contradictions and duplicate ownership claims
- verify references still point at the canonical source
- update `agents/openai.yaml` if the skill name, description, or default prompt
  changed

## Writing Rules

- Prefer concise imperative instructions.
- Prefer stable heuristics over brittle examples unless the example teaches a
  non-obvious edge case.
- Prefer "when X, do Y" over aspiration statements.
- Say what the agent must not do only when the failure mode is real and costly.
- Avoid filler sections such as motivational framing, changelogs, or author
  notes.
- Keep one language per file.

## Frontmatter Rules For Skills

When editing a `SKILL.md`:

- keep only `name` and `description` in frontmatter unless the skill system
  explicitly allows more
- make `description` carry the trigger conditions
- keep body content for workflow, constraints, and references that are only
  needed after trigger time

## `agents/openai.yaml` Rules

Treat `agents/openai.yaml` as derived interface metadata.

- `display_name` and `short_description` must stay aligned with `SKILL.md`
- `default_prompt` must explicitly mention `$agent-instruction-engineering`
  style invocation for this skill
- add `policy.allow_implicit_invocation: true` for this skill because the repo
  wants mandatory availability on covered work
- do not move operative workflow instructions from `SKILL.md` into
  `openai.yaml`

## References

- For prompt-engineering principles, read
  [references/prompt-engineering-principles.md](references/prompt-engineering-principles.md).
- For SaltMarcher instruction-surface ownership, read
  [references/instruction-surfaces.md](references/instruction-surfaces.md).
- For common failure modes, read
  [references/instruction-anti-patterns.md](references/instruction-anti-patterns.md).
