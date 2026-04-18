# SaltMarcher Instruction Surfaces

Use this map to decide where agent-facing instructions belong.

## `AGENTS.md`

Owns project-wide rules and delivery protocol.

Put here:

- global norms that apply across the whole repo
- mandatory workflow requirements
- short summaries that point to canonical standards

Do not put here:

- long-form prompt-engineering doctrine
- feature-local behavior
- duplicated standards text

## `SKILL.md`

Owns reusable operational workflows for another agent.

Put here:

- trigger conditions in frontmatter description
- the workflow the skill should execute
- references to bundled resources

Do not put here:

- UI metadata better suited for `agents/openai.yaml`
- repo-global governance that belongs in standards or `AGENTS.md`

## Architecture Standards

Own canonical reusable rules for one project topic.

Put here:

- stable governance for one concern
- authority boundaries between document types
- review and enforcement expectations

Use this surface when multiple artifacts would otherwise repeat the same agent
rule.

## Other Instruction Markdown

Use only for narrow prompt artifacts or specialized agent workflows that do not
deserve a project-wide standard or a reusable skill.

If the file starts accumulating ownership rules, promotion to a standard or
skill is usually the right move.

## `agents/openai.yaml`

Owns interface metadata only.

Put here:

- display name
- short description
- default invocation prompt
- optional policy metadata

Do not put operative workflow logic here. If the YAML and `SKILL.md` disagree,
`SKILL.md` is the governing instruction source.
