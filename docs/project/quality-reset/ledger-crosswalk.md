# Quality-reset ledger crosswalk

The first quality-reset ledger is retained unchanged as
`requirements-ledger.yaml`: it is a 177-item historical execution record, not
the current completion source. At the follow-up baseline it contained 169
verified entries and the eight unresolved entries below. The successor
`followup-requirements-ledger.json` owns the delta introduced by the
Nacharbeits-Handoff; its exact 64-ID identity and closure state are executable.

| Historical ID | Historical state | Successor proof |
| --- | --- | --- |
| `PRES-005` | open | `PRES-005`, `DEL-004`, `DEL-005` |
| `GIT-001` | in progress | `PRES-001`, `PRES-006` plus final ancestor proof |
| `GIT-005` | in progress | `PRES-003`, `PRES-006`, `DEL-002` |
| `CI-001` | in progress | `PRES-003`, `PRES-006`, `DEL-008` |
| `HANDOFF-001` | open | `PRES-002`, `PRES-004`, `DEL-005` |
| `HANDOFF-006` | open | `PRES-005`, `DEL-004` |
| `HANDOFF-010` | open | `PRES-005`, `IMPORT-006` |
| `HANDOFF-011` | open | `DOC-001`, `DOC-005` |

The historical statuses are deliberately not rewritten: doing so would erase
what was known at that earlier checkpoint. Final closure requires both the
successor ledger to have no open/in-progress/blocked entry and the generated
`final-evidence.json` to prove candidate CI, one fresh handoff, installation,
backup, readbacks, promotion, and the post-promotion run for one Application-SHA.
