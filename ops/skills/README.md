# ops/skills/

Each `.md` file here is an **AI agent role prompt** — a plain-text description of a review focus injected into `claude -p` by `apply_skill.sh`.

## How skill files are used

`apply_skill.sh` selects which skills to run for each source directory (based on directory size, UI content, and position in the processing order). For each selected skill it:

1. Reads the skill file: `ops/skills/<skill-name>.md`
2. Injects its content as the `# Role` section of the prompt sent to `claude`
3. The Claude agent receives: task description + guidelines + backlog protocol + this role text

The skill file defines *what to look for* and *what format to write findings in*. The scaffolding (scope, backlog protocol, build verification) is always added by `apply_skill.sh` on top.

## Naming convention

The filename (without `.md`) is the skill name used in `apply_skill.sh` and in backlog `@skill:` tags.

| Skill file | Focus |
|---|---|
| `review-smells.md` | Code smells, anti-patterns, duplication |
| `review-elegance.md` | Readability, idiomatic style, naming |
| `review-simplicity.md` | Over-engineering, KISS violations |
| `review-quality.md` | Combined smells + elegance + simplicity (for small dirs) |
| `review-structure.md` | File/folder organization, package layout |
| `review-architecture.md` | Layer violations, dependency direction |
| `review-conventions.md` | Inconsistent patterns across the codebase |
| `review-security.md` | Security vulnerabilities, data exposure |
| `review-performance.md` | Performance issues, inefficient queries, main-thread blocking |
| `review-design.md` | UI visual design, layout, styling |
| `review-accessibility.md` | Accessibility, usability, a11y compliance |
| `review-ui.md` | Combined visual design + accessibility (for small UI dirs) |
| `review-onboarding.md` | Missing/poor docs, onboarding friction, stale comments |
| `triage.md` | Backlog maintenance: purge resolved items, assign skills, break down large issues |
| `init.md` | CLAUDE.md maintenance: keep it accurate after code changes |
| `commit.md` | Git checkpoint: build verification + commit all current changes |
| `sync-main.md` | Sync local branch with upstream main (fetch, merge/rebase, resolve conflicts) |

## Adding a new review skill

1. Create `ops/skills/<your-skill-name>.md`.
2. Write the role prompt: what to look for, what to ignore, and what format to use for backlog entries.
3. Reference the skill name in `apply_skill.sh` `_build_skill_list()` if it should run automatically, or invoke it manually via `dispatch_claude`.
4. Add the skill to the table in `triage.md` under "Available skills and when to assign them" so triage agents know when to use it.
