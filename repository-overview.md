# Salt Marcher Repository Overview

## Purpose & Audience
This overview introduces contributors to the structure and responsibilities of the Salt Marcher repository. Use it when planning cross-folder changes, onboarding new maintainers, or coordinating releases that span plugin code, documentation, and licensing assets.

## Directory Map
| Path | Description | Primary Docs |
| --- | --- | --- |
| `DOCUMENTATION.md` | Repository-wide hub describing documentation hierarchy, contributor workflows, and standards. | [`DOCUMENTATION.md`](DOCUMENTATION.md) |
| `salt-marcher/` | Complete Obsidian plugin package including source, build scripts, tests, and subsystem overviews. | [`salt-marcher/overview.md`](salt-marcher/overview.md) |
| `wiki/` | Local mirror of the GitHub wiki for offline edits and reviews. | [`wiki/README.md`](wiki/README.md) |
| `architecture-critique.md` | Architektur-Review mit offenen Maßnahmen und Referenzen. | [`architecture-critique.md`](architecture-critique.md) |
| `References, do not delete!/` | Required SRD reference material maintained verbatim for licensing compliance. | [`References, do not delete!/README.md`]("References, do not delete!"/README.md) |

## Key Workflows
- **Plan cross-cutting changes:** Start with the [repository documentation hub](DOCUMENTATION.md) to understand where detailed subsystem docs live before editing code.
- **Coordinate plugin development:** Drill into [`salt-marcher/overview.md`](salt-marcher/overview.md) for architectural responsibilities, and reference the nested docs for cartographer, library, encounter, and UI modules.
- **Maintain compliance assets:** Verify updates against the SRD references and ensure acknowledgements stay current in top-level docs.

## Linked Docs
- [Documentation hub](DOCUMENTATION.md) – maps all README, overview, and wiki entry points.
- [Salt Marcher plugin documentation](salt-marcher/docs/README.md) – subsystem-specific guides for developers.
- [Project wiki](wiki/README.md) – authoritative end-user walkthroughs.
- [Architecture critique](architecture-critique.md) – open risks and resolved measures across the plugin.
- [Documentation style guide](style-guide.md) – mandatory template and formatting rules.

## Standards & Conventions
- Every new overview or README must adopt the sections defined in the shared [documentation style guide](style-guide.md).
- Update this overview whenever repository-level folders, workflows, or coordination touchpoints change.
- Capture architectural risks or follow-up work items in [`architecture-critique.md`](architecture-critique.md) to maintain shared visibility.
