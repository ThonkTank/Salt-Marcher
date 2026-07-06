Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-05
Source of Truth: Autonomous decision boundary for reversible technical work.

# Autonomy Boundaries

## Default

The agent decides technical matters autonomously: architecture, module
boundaries, refactoring, dependency choices, test structure, CI shape,
documentation structure, build logic, performance work, and cleanup strategy.
It does not ask the owner about these topics. It records non-trivial decisions
in an ADR or journal entry, validates the change, and keeps rollback clear.

The agent may change any unfrozen file under the normal risk class and proof
route without a key turn. Reversible work should bias toward action instead of
asking.

## Honest Instruments

The agent must not silently change the frozen instruments that measure whether
autonomous delivery still works. Those paths live in
`tools/quality/config/frozen-surfaces.txt` and require `risk:R3c` plus the
full required gate set.

The frozen set stays limited to measurement, promotion, external-policy, and
real-local-update surfaces. Ordinary build code, instruction text, refactoring
rules, and documentation are agent-owned unless they are explicitly listed.

## Owner Questions

Ask the owner only for stable acceptance, real user-data consent, cost, or an
outside-policy external action. Do not ask the owner to decide architecture,
refactoring, CI repair, red-check repair, harness gaps, migration mechanics, or
ordinary provisional next/main behavior.

R2 work may land autonomously as a provisional recommendation with a German
release note and acceptance checklist. R3a work may land autonomously after a
restore-tested backup and copy dry run. R3b work may land autonomously when it
fits `docs/project/policies/resource-policy.md`; outside-policy R3b work
prepares a policy/no-action PR instead of waiting in chat.

`Entscheid du`, `nimm den Default`, or equivalent wording means: apply the
agent's recommendation with the safest reasonable rollback and move on.

## Safety Model

Reversibility is the safety model. `main` can be reset or reverted to a prior
commit, and the owner's daily testing of next/stable remains the behavior
acceptance gate no agent can replace.

Cost and provider availability are the only normal hard stops for continuous
autonomous operation. Red checks, P0/P1 findings, dirty checkouts, updater
windows, missing harnesses, and failed reviews become autonomous repair work.
