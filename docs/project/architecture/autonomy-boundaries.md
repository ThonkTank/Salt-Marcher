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

Ask the owner only for product outcomes with genuinely different visible
behavior, or for an outside-policy R3b external action. R2 work may land as a
provisional recommendation on `main`/next with a German release note and owner
acceptance before promotion.

`Entscheid du`, `nimm den Default`, or equivalent wording means: apply the
agent's recommendation with the safest reasonable rollback and move on.

## Safety Model

Reversibility is the safety model. `main` can be reset or reverted to a prior
commit, and the owner's daily testing of next/stable remains the behavior
acceptance gate no agent can replace.
