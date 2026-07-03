---
name: agent-instruction-engineering
description: Use when creating, editing, reviewing, or refactoring agent-facing instruction artifacts such as `AGENTS.md`, any `SKILL.md`, `agents/openai.yaml`, prompt-governance standards, workflow rules, or Markdown whose primary purpose is to steer Codex or other agents. Requires explicit triggers, narrow ownership, derived metadata, and repo-local prompt-engineering references.
---

# Agent Instruction Engineering

## Overview

Use this skill to keep agent instructions explicit, scoped, and internally
consistent. Treat prompts, skills, AGENTS files, and instruction-bearing
governance docs as executable control surfaces, not narrative documentation.

The reference source for this skill is:

- `/home/aaron/Schreibtisch/projects/references/agent-instruction-engineering/prompt-engineering-principles.md`
- `/home/aaron/Schreibtisch/projects/references/agent-instruction-engineering/instruction-surfaces.md`
- `/home/aaron/Schreibtisch/projects/references/agent-instruction-engineering/instruction-anti-patterns.md`

Repo-local standards can still define project-specific rules, but they must not
recreate a competing local prompt-engineering skill or bundled reference mirror.

## Covered Artifacts

Use this skill for work on:

- `AGENTS.md`
- any `SKILL.md`
- Markdown standards or rules that directly govern agent behavior
- Markdown prompt or workflow artifacts meant to steer Codex or other agents
- `agents/openai.yaml` consistency checks after changing the governing skill

Do not use this skill for ordinary feature specs, UI docs, ADRs, or persistence
docs unless those files directly define agent behavior.

## Workflow

### 1. Classify The Instruction Surface

Decide which control surface you are editing before changing wording.

- `AGENTS.md`: project-wide norms and delivery protocol
- `SKILL.md`: reusable operational skill for another agent
- architecture or quality standard: canonical project rule for one topic
- other instruction markdown: narrow prompt or workflow artifact
- `agents/openai.yaml`: UI metadata derived from the governing skill, not the
  primary instruction source

If the requested content belongs in a different surface, move it there instead
of broadening the current file.

### 2. Read Governing Context First

Before rewriting, read the nearest authority documents that constrain the
artifact.

- For `AGENTS.md`, read relevant project standards and avoid feature-level
  detail.
- For `SKILL.md`, read the owning project rules and any global references the
  skill depends on.
- For standards, read `AGENTS.md` and adjacent standards that could already own
  the topic.

Never guess ownership when the project already defines it.

### 3. Rewrite For Behavioral Clarity

Write instructions as operational control logic.

- State what the agent must do, when it must do it, and what is out of scope.
- Prefer explicit triggers over vague intent labels such as "be smart" or "use
  judgment."
- Encode proportionality so the agent can distinguish critical behavior from
  optional polish.
- Remove duplicate or conflicting directives instead of piling on exceptions.
- Keep the strongest rules close to the top of the artifact.

### 4. Preserve Separation Of Concerns

Keep each instruction surface narrow.

- Do not turn `AGENTS.md` into a long-form standard.
- Do not hide triggering logic in reference files; the `SKILL.md` description
  must say when the skill should be used.
- Do not put tool, UI, or branding metadata into `SKILL.md` frontmatter.
- Do not let `agents/openai.yaml` drift into a second source of truth.

If a rule is reusable across multiple artifacts, place it in the canonical
standard or repo-owned skill and have other files summarize or point to it.

### 5. Run A Consistency Pass

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
- State the desired behavior directly; use negative wording only when it defines
  a necessary boundary that the positive rule does not already imply.
- Replace anti-pattern reminders with the target pattern when the reminder only
  makes the avoided behavior more salient.
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
- `default_prompt` must explicitly mention the skill as
  `$agent-instruction-engineering`
- add `policy.allow_implicit_invocation: true` when the skill should be
  mandatory on covered work
- do not move operative workflow instructions from `SKILL.md` into
  `openai.yaml`
