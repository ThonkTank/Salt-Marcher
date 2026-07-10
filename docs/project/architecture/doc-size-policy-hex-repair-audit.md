Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: Hex documentation damage audit for the document size policy
roadmap M3 pilot.

# Hex Documentation Damage Audit

## Purpose

This audit is the M3 pilot for
`docs/project/architecture/doc-size-policy-vision-and-roadmap.md`. It checks
whether the old 350-line hard cap caused Hex documentation compression,
omission, or scatter that must be repaired before other features are queued.

## Scope

Audited files:

- `docs/hex/README.md`
- `docs/hex/requirements/*.md`
- `docs/hex/domain/*.md`
- `docs/hex/contract/*.md`
- `docs/hex/verification/*.md`

## Size Evidence

Current Hex documentation has no file near the former 350-line cap:

| File | Lines |
| --- | ---: |
| `requirements/requirements-hex-editor.md` | 133 |
| `requirements/requirements-hex.md` | 115 |
| `contract/contract-hex-persistence.md` | 114 |
| `domain/domain-hex-map.md` | 112 |
| `verification/verification-hex-editor.md` | 84 |
| `requirements/requirements-hex-travel.md` | 77 |
| `requirements/requirements-hex-travel-state.md` | 76 |
| `verification/verification-hex-travel.md` | 66 |
| `README.md` | 58 |

## History Evidence

`git log --numstat -- docs/hex` shows additive Hex documentation growth and
small alignment edits. The largest deletions found were normal paired edits,
not near-cap compression:

| Commit | Largest deletion in Hex docs | Audit result |
| --- | ---: | --- |
| `0331a0563` | 0 | Initial Hex docs, additive. |
| `e70d229df` | 8 | Rename/alignment edits, no near-cap file. |
| `d861daae6` | 1 | Small README/requirements update. |
| `c665451a3` | 13 | Hex editor roadmap implementation docs, net additive. |
| `ce4ecdffa` | 6 | Travel-state alignment, net additive. |
| `6a4738a7a` | 15 | Hex map roadmap completion, net additive across docs. |
| `6af157873` | 6 | Editor requirement/harness update, net additive. |
| `a2a50757f` | 4 | Governance wording alignment, balanced small edit. |
| `6d9747a5d` | 3 | Harness hardening docs, no material loss signal. |
| `4eb00535c` | 0 | Save-failure proof row, additive. |

## Scatter Evidence

No confirmed Hex fact was found living outside its contract because of size
pressure:

- requirements own user-visible Hex behavior
- domain owns Hex authored-map vocabulary and invariants
- contract owns Hex SQLite persistence semantics
- verification owns Hex proof obligations
- maps docs own shared canvas behavior

Some Hex requirements and README sections still contain current-state prose.
That is a later specification-alignment concern, not confirmed 350-line cap
damage: these files are far below the old cap and the history does not show
near-cap compression pressure.

## Result

No Hex documentation repair is required for M3 damage repair. The pilot audit
found no known lost owner-relevant Hex fact and no confirmed scatter caused by
the old size cap.

## References

- [Document Size Policy Roadmap](doc-size-policy-vision-and-roadmap.md)
- [Document Size Policy Ledger](doc-size-policy-ledger.md)
- [Hex Feature Docs](../../hex/README.md)
