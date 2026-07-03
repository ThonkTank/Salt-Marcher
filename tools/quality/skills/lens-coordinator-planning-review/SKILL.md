---
name: lens-coordinator-planning-review
description: Blocked legacy coordinator lens for the old shared SaltMarcher CR and planning-bundle review route. Do not use for new reviews; route to lens-coordinator-cr-review or lens-coordinator-plan-review instead.
---

# Lens: Planning Review Coordinator Legacy Router

## Status

This skill path is retained only for historical artifacts and orientation. It
is not an operative coordinator lens.

New coordinator launches must use the split lenses:

- CR review:
  `tools/quality/skills/lens-coordinator-cr-review/SKILL.md`
- Planning-bundle review:
  `tools/quality/skills/lens-coordinator-plan-review/SKILL.md`

If a current workflow tries to use this legacy shared lens, stop and report
`Blocked - Legacy Planning Review Coordinator`. The caller must relaunch
through the matching split route. Do not self-review, synthesize acceptance, or
write a CR review or plan review through this path.

## References

- [CR Review Coordinator](../lens-coordinator-cr-review/SKILL.md)
- [Plan Review Coordinator](../lens-coordinator-plan-review/SKILL.md)
- [Implementation Artifacts Standard](../../../../docs/project/architecture/implementation-artifacts.md)
