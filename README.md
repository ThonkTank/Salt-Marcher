# Salt Marcher for Obsidian

## Purpose & Audience
Salt Marcher is an Obsidian community plugin that helps game masters run hexcrawl-inspired tabletop campaigns directly in their vaults. This repository-level README is for contributors and maintainers who need a quick orientation across source code, documentation, and supporting assets before diving into specific folders.

## Directory Map
| Path | Description | Primary Docs |
| --- | --- | --- |
| `DOCUMENTATION.md` | Project-wide documentation hub and shared standards for all contributors. | [`DOCUMENTATION.md`](DOCUMENTATION.md) |
| `salt-marcher/` | Source, build pipeline, and packaged artifacts for the Obsidian plugin. | [`salt-marcher/overview.md`](salt-marcher/overview.md) |
| `wiki/` | Offline export of the end-user wiki for reference and contributions. | [`wiki/README.md`](wiki/README.md) |
| `References, do not delete!/` | External SRD references preserved for licensing compliance. | [`References, do not delete!/README.md`]("References, do not delete!"/README.md) |

## Key Workflows
- **Install the plugin for testing:** Follow the packaging and enablement steps in the [Salt Marcher README](salt-marcher/README.md) to load the plugin in Obsidian and verify workspace views.
- **Update documentation consistently:** Use the shared [documentation style guide](style-guide.md) and cross-reference folder-specific docs listed in the directory map before committing changes.
- **Coordinate releases and support:** Review the project [wiki](wiki/README.md) for user-facing guides, and keep changelogs or troubleshooting entries aligned with the latest plugin features.

## Linked Docs
- [Repository documentation hub](DOCUMENTATION.md) – entry point into contributor, architecture, and user-facing docs.
- [Repository overview](repository-overview.md) – cross-team responsibilities and release coordination map.
- [Salt Marcher plugin overview](salt-marcher/overview.md) – architectural breakdown of the plugin package.
- [Developer documentation set](salt-marcher/docs/README.md) – deep dives for individual subsystems.
- [Project wiki](wiki/README.md) – canonical end-user guides hosted on GitHub.

## To-Do
- [Cartographer presenter respects abort signals](todo/cartographer-presenter-abort-handling.md) – Presenter muss Abort-Signale sauber propagieren.
- [Cartographer mode registry](todo/cartographer-mode-registry.md) – Modi deklarativ registrieren statt hart verdrahten.
- [UI terminology consistency](todo/ui-terminology-consistency.md) – Einheitliche Sprache für UI-Texte und Kommentare herstellen.

## Standards & Conventions
- All new or updated docs must follow the mandatory template defined in the [documentation style guide](style-guide.md).
- Synchronize repository docs with the user-focused wiki to keep workflows and terminology consistent for referees and contributors alike.
- Record outstanding architectural or quality concerns in the [`todo/`](todo/README.md) backlog and cross-link the relevant documentation sections.
