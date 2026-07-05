Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-06
Source of Truth: Live attack PR closure evidence for ADR 0003 base-ref gates.

# ADR 0003 Live Proof

## 2026-07-06 adr-0003-live-proof - Attack PR closure evidence

Problem: queue task `10-attack-proofs` requires live red attack PR evidence for
ADR 0003 base-ref gates before the queue can be marked done.
Evidence: PR `#367` <https://github.com/ThonkTank/Salt-Marcher/pull/367>
closed unmerged with red `warden-freeze` and `judge-review`; PR `#387`
<https://github.com/ThonkTank/Salt-Marcher/pull/387> closed unmerged with red
`judge-review`; PR `#388`
<https://github.com/ThonkTank/Salt-Marcher/pull/388> closed unmerged with red
`production-handoff` and `judge-review`.
Branch cleanup: `git ls-remote --heads origin review-test/p2-warden-rename-attack
review-test/judge-always-pass review-test/harness-map-shrink` returned no
matching heads after deleting the remaining `review-test/p2-warden-rename-attack`
remote branch.
