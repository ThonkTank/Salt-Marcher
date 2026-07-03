---
name: coord-main-planning-review
description: Blocked legacy router for old SaltMarcher shared planning-review launches. Do not use for new CR review or planning-bundle review; route to coord-main-cr-review or coord-main-plan-review instead.
---

# Coordination: Main To Planning Review Legacy Router

## Status

This skill path is retained only for historical artifacts and orientation. It
is not an operative launch surface.

New launches must use the split routes:

- CR review:
  `tools/quality/skills/coord-main-cr-review/SKILL.md`
- Planning-bundle review:
  `tools/quality/skills/coord-main-plan-review/SKILL.md`

If a current workflow tries to launch this legacy shared route, stop and report
`Blocked - Legacy Planning Review Router`. Main must choose the artifact type
and relaunch through the matching split caller skill. Do not self-review, do
not synthesize acceptance, and do not write a CR review or plan review through
this path.

## References

- [Main To CR Review](../coord-main-cr-review/SKILL.md)
- [Main To Plan Review](../coord-main-plan-review/SKILL.md)
- [Implementation Artifacts Standard](../../../../docs/project/architecture/implementation-artifacts.md)
