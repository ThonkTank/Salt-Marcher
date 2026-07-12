Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-12
Source of Truth: Behavior-harness coverage gaps that must be closed before touched areas change.

# Harness Gaps

## Purpose

This register names behavior surfaces that do not yet have enough production
route coverage to satisfy the owner-feedback rule in `AGENTS.md`.

## Scope

This file does not define product behavior. It records verification gaps and
the minimal harness proposal needed before a touched area may change.

## Gaps

No open harness gaps are registered.

## Rule

Touching a gap area requires creating the minimal harness in the same pass or
filing a Harness Gap blocker that references this register.

## Evidence Owner

`checkBehaviorHarnessTopology` proves behavior-harness task registration shape,
and the converted JUnit `Test` tasks prove their declared Gradle inputs through
`check`. Those gates do not prove that gap areas are covered; this register is
review-owned until the named harnesses exist.
