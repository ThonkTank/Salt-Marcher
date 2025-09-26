# Salt Marcher Documentation Hub

## Purpose & Audience
This hub orients contributors, technical writers, and support staff to every major piece of Salt Marcher documentation. Start here to find the right README, overview, or wiki article before editing or sharing guidance with users.

## Directory Map
| Path | Description | Primary Docs |
| --- | --- | --- |
| `../README.md` | Repository-level overview for maintainers and cross-team coordination. | [`../README.md`](../README.md) |
| `../PluginOverview.txt` | High-level summary of repository responsibilities and collaboration touchpoints. | [`../PluginOverview.txt`](../PluginOverview.txt) |
| `../salt-marcher/` | Plugin source, build system, and subsystem documentation. | [`../salt-marcher/PluginOverview.txt`](../salt-marcher/PluginOverview.txt) |
| `../salt-marcher/docs/` | Deep dives for Cartographer, Encounter, Library, Core, and UI modules. | [`../salt-marcher/docs/`](../salt-marcher/docs/) |
| `../wiki/` | Offline mirror of the GitHub wiki for user-facing articles. | [`../../wiki`](../../wiki) |
| `style-guide.md` | Mandatory template and formatting rules for all Salt Marcher documentation. | [`style-guide.md`](style-guide.md) |

## Key Workflows
- **Select the right entry point:** Use the directory map above to choose between contributor docs (`README.md`, `PluginOverview.txt`), subsystem guides (`salt-marcher/docs/`), or user guides (`wiki/`).
- **Author new documentation:** Draft using the [documentation style guide](style-guide.md), ensuring each document includes the standard sections and cross-links relevant materials.
- **Review and update docs:** When code or workflows change, update both the technical references (e.g., subsystem docs) and user-facing wiki entries linked here to keep guidance aligned.

## Linked Docs
- [Root README](../README.md) – maintainer-facing repository summary and workflows.
- [Salt Marcher plugin overview](../salt-marcher/PluginOverview.txt) – architecture and build information for the plugin package.
- [Documentation style guide](style-guide.md) – template and formatting requirements.
- [GitHub project wiki](../../wiki) – canonical end-user guides and troubleshooting articles.

## Standards & Conventions
- Maintain this index whenever documentation locations change so all teams share an accurate map.
- Ensure every linked document complies with the [documentation style guide](style-guide.md) and uses relative links where possible.
- Capture unresolved documentation issues or backlog items via the structured backlog in [`../todo/`](../todo/) for coordination across releases.

## To-Do
- [Presenter reacts to abort signals](../todo/presenter-abort-signal.md)
- [Cartographer modes are registered declaratively](../todo/cartographer-mode-registry.md)
- [Cartographer mode queue gains a robust state machine](../todo/cartographer-mode-queue-state-machine.md)
- [Hex renderer is modularised](../todo/hex-renderer-modularization.md)
- [UI terminology is unified](../todo/ui-terminology-consistency.md)
