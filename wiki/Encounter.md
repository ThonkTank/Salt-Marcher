# Encounter Workspace

The Encounter workspace currently functions as a dedicated placeholder view so the travel experience can hand off encounters without leaving Obsidian. When the view opens it renders a simple heading and reserves space for future encounter tooling while applying encounter-specific styling hooks.【F:salt-marcher/src/apps/encounter/view.ts†L1-L20】

## How encounters launch
- **Travel mode integration:** Whenever the travel logic signals `onEncounter`, the mode pauses playback and calls `openEncounter`, which opens (or reveals) the encounter workspace in a neighbouring pane.【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L174-L222】
- **Preloading:** Entering travel mode preloads the encounter module to reduce the delay between triggering an encounter and seeing the workspace appear.【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L41-L83】

## Manual access
The encounter view is not yet exposed via a ribbon icon or command. To open it manually, create a new pane (e.g. with **Ctrl/Cmd+P → Open view by type**) and select `salt-encounter`. Once a route triggers another encounter, the existing pane will be reused automatically.

## Roadmap notes
- Capture a screenshot once the dedicated encounter UI lands and replace this note with the image reference.
- Expand this article with encounter editing/management instructions as features ship.

## Related articles
- [Cartographer](./Cartographer.md) – explains how travel mode orchestrates the encounter hand-off.
- [Getting Started](./Getting-Started.md) – outlines how to open the workspace manually if needed.
