# Encounter Workspace

## Overview & Audience
The Encounter workspace currently provides a dedicated pane for handling travel-triggered encounters without leaving Obsidian. Use this guide when validating hand-offs from Cartographer or planning future encounter tooling.

## Prerequisites
- Salt Marcher plugin enabled with Cartographer travel mode configured.
- Active travel route or manual trigger capable of emitting `onEncounter` events.
- Optional: predefined encounter notes or templates stored elsewhere in the vault.

## Step-by-step Workflow
1. **Trigger the encounter hand-off.** Run a travel route in Cartographer until an encounter event fires; the presenter pauses playback and calls `openEncounter`.
2. **Review the encounter pane.** The workspace opens (or focuses) a dedicated leaf containing placeholder content and encounter-specific styling hooks.
3. **Anchor supporting material.** Open related notes—such as NPC stat blocks or region lore—in adjacent panes to keep context visible while the encounter pane remains active.
4. **Resume travel after resolution.** Close or refocus the encounter pane, return to Cartographer, and resume playback from the paused state once the encounter wraps.

## Reference & Tips
| Trigger Source | Behaviour | Notes |
| --- | --- | --- |
| Travel mode `onEncounter` callback | Opens or reveals the encounter workspace and pauses travel playback. | Encounter pane will reopen automatically if dismissed while another trigger fires. |
| Manual pane creation (`Open view by type → salt-marcher-encounter`) | Opens the workspace without a travel trigger. | Useful for testing layouts or preparing upcoming encounter features. |

- Keep the encounter workspace docked next to Cartographer to reduce window juggling when multiple encounters occur.
- Document any desired encounter tooling in [`architecture-critique.md`](../architecture-critique.md) so the placeholder can evolve alongside feature work.
- Use Obsidian's pane pinning to prevent the encounter view from being replaced by unrelated notes during sessions.

## Related Links
- [Getting Started](./Getting-Started.md)
- [Cartographer](./Cartographer.md)
- [Library](./Library.md)
- [Data Management](./Data-Management.md)
- Travel hand-off implementation notes under `salt-marcher/docs/cartographer/travel-mode-overview.md`.
