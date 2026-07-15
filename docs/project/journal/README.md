Status: Active
Source of Truth: Entry point and format for the project journal.

# Project Journal

- [July 2026 historical record](2026-07.md)

One file per month, `YYYY-MM.md`. The journal records retained L-tier design
notes and incidents, and nothing else. It is never a source of truth: a
decision that outlives its month belongs in an ADR under
`docs/project/decisions/`. Structural findings are fixed in their scoped pass
or tracked in a GitHub issue when they need separate work.

Do not journal routine progress, proof transcripts, or status updates. Git
history already records what happened when, more reliably and at no reading
cost.

## Entry Format

```text
## YYYY-MM-DD <slug> - <one-line title>

Problem: <what forced a decision>
Target: <what was chosen>
Alternatives rejected: <what was not chosen, and why>
Scope: <what this does and does not cover>
Done when: <the fact that closes it>
```

An incident entry replaces Target and Alternatives with what happened, what
caused it, and what now prevents a repeat.
