# Salt Marcher for Obsidian

## Purpose & Audience
Salt Marcher is an Obsidian community plugin that helps game masters run hexcrawl-inspired tabletop campaigns directly in their vaults. This repository-level README is for contributors and maintainers who need a quick orientation across source code, documentation, and supporting assets before diving into specific folders.

## Directory Map
| Path | Description | Primary Docs |
| --- | --- | --- |
| `docs/` | Project-wide documentation hub and shared standards for all contributors. | [`docs/index.md`](docs/index.md) |
| `salt-marcher/` | Source, build pipeline, and packaged artifacts for the Obsidian plugin. | [`salt-marcher/PluginOverview.txt`](salt-marcher/PluginOverview.txt) |
| `wiki/` | Offline export of the end-user wiki for reference and contributions. | [`wiki/`](wiki/) |
| `References, do not delete!/` | External SRD references preserved for licensing compliance. | [`References, do not delete!/README.md`]("References, do not delete!"/README.md) |

## Key Workflows
- **Install the plugin for testing:** Follow the packaging and enablement steps in the [Salt Marcher README](salt-marcher/README.md) to load the plugin in Obsidian and verify workspace views.
- **Update documentation consistently:** Use the shared [documentation style guide](docs/style-guide.md) and cross-reference folder-specific docs listed in the directory map before committing changes.
- **Coordinate releases and support:** Review the project [wiki](../../wiki) for user-facing guides, and keep changelogs or troubleshooting entries aligned with the latest plugin features.

## Linked Docs
- [Repository documentation hub](docs/index.md) – entry point into contributor, architecture, and user-facing docs.
- [Salt Marcher plugin overview](salt-marcher/PluginOverview.txt) – architectural breakdown of the plugin package.
- [Developer documentation set](salt-marcher/docs/) – deep dives for individual subsystems.
- [Project wiki](../../wiki) – canonical end-user guides hosted on GitHub.

## Standards & Conventions
- All new or updated docs must follow the mandatory template defined in the [documentation style guide](docs/style-guide.md).
- Synchronize repository docs with the user-focused wiki to keep workflows and terminology consistent for referees and contributors alike.
- Record outstanding architectural or quality concerns in the structured backlog under [`todo/`](todo/) so the team can triage them across sprints.

## To-Do
- [Presenter reacts to abort signals](todo/presenter-abort-signal.md)
- [Cartographer modes are registered declaratively](todo/cartographer-mode-registry.md)
- [Cartographer mode queue gains a robust state machine](todo/cartographer-mode-queue-state-machine.md)
- [Hex renderer is modularised](todo/hex-renderer-modularization.md)
- [UI terminology is unified](todo/ui-terminology-consistency.md)
