# Salt Marcher Documentation Hub

## Purpose & Audience
This hub orients contributors, technical writers, and support staff to every major piece of Salt Marcher documentation. Start here to find the right README, overview, or wiki article before editing or sharing guidance with users.

## Directory Map
| Path | Description | Primary Docs |
| --- | --- | --- |
| `../README.md` | Repository-level overview for maintainers and cross-team coordination. | [`../README.md`](../README.md) |
| `repository-overview.md` | Cross-repository responsibilities and coordination touchpoints. | [`repository-overview.md`](repository-overview.md) |
| `../salt-marcher/overview.md` | High-level summary of repository responsibilities and collaboration touchpoints. | [`../salt-marcher/overview.md`](../salt-marcher/overview.md) |
| `../salt-marcher/` | Plugin source, build system, and subsystem documentation. | [`../salt-marcher/overview.md`](../salt-marcher/overview.md) |
| `../salt-marcher/docs/` | Deep dives for Cartographer, Encounter, Library, Core, and UI modules. | [`../salt-marcher/docs/README.md`](../salt-marcher/docs/README.md) |
| `../wiki/` | Offline mirror of the GitHub wiki for user-facing articles. | [`../wiki/README.md`](../wiki/README.md) |
| `style-guide.md` | Mandatory template and formatting rules for all Salt Marcher documentation. | [`style-guide.md`](style-guide.md) |
| `architecture-critique.md` | Repository-wide architecture health log and follow-up tracker. | [`architecture-critique.md`](architecture-critique.md) |

## Key Workflows
- **Select the right entry point:** Use the directory map above to choose between contributor docs (`README.md`, `repository-overview.md`, `overview.md`), subsystem guides (`salt-marcher/docs/`), or user guides (`wiki/`).
- **Author new documentation:** Draft using the [documentation style guide](style-guide.md), ensuring each document includes the standard sections and cross-links relevant materials.
- **Review and update docs:** When code or workflows change, update both the technical references (e.g., subsystem docs) and user-facing wiki entries linked here to keep guidance aligned.

## Linked Docs
- [Root README](../README.md) – maintainer-facing repository summary and workflows.
- [Salt Marcher plugin overview](../salt-marcher/overview.md) – architecture and build information for the plugin package.
- [Architecture critique](architecture-critique.md) – repository-wide assessment of technical risks and follow-ups.
- [Documentation style guide](style-guide.md) – template and formatting requirements.
- [GitHub project wiki](../wiki/README.md) – canonical end-user guides and troubleshooting articles.

## To-Do
- [Cartographer presenter respects abort signals](../todo/cartographer-presenter-abort-handling.md) – Presenter muss Abort-Signale honorieren.
- [Cartographer mode registry](../todo/cartographer-mode-registry.md) – Modi deklarativ konfigurierbar machen.
- [UI terminology consistency](../todo/ui-terminology-consistency.md) – UI-Sprache vereinheitlichen.

## Standards & Conventions
- Maintain this index whenever documentation locations change so all teams share an accurate map.
- Ensure every linked document complies with the [documentation style guide](style-guide.md) and uses relative links where possible.
- Capture unresolved documentation issues or backlog items im [`todo/`](../todo/README.md)-Backlog und verweise auf passende Detaildokumente.
