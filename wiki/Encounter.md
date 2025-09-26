# Encounter Workspace

## Overview & Audience
The Encounter workspace currently provides a dedicated pane for handling travel-triggered encounters without leaving Obsidian. Use this guide when validating hand-offs from Cartographer or planning future encounter tooling.

## Prerequisites
- Salt Marcher plugin enabled with Cartographer travel mode configured.
- Active travel route or manual trigger capable of emitting `onEncounter` events.
- Optional: predefined encounter notes or templates stored elsewhere in the vault.

## Step-by-step Workflow
1. **Trigger the encounter hand-off.** Run a travel route in Cartographer until an encounter event fires; the travel controller pauses playback, assembles region metadata, and calls `openEncounter(app, { mapFile, state })`.
2. **Review the encounter pane.** The workspace focuses a dedicated leaf that now lists the region name, hex coordinates, travel clock, encounter odds (if defined in Library → Regions), and the timestamp of the trigger.
3. **Capture notes & decisions.** Use the notes field to jot down initiative, tactics, or follow-ups. The presenter persists these notes so a workspace restore or Obsidian restart keeps the active encounter intact.
4. **Mark the encounter resolved.** Click **“Mark encounter resolved”** once the scene wraps; the pane records the resolution timestamp and communicates status to future restores. Resume travel from Cartographer when ready (resume remains manual).

## Reference & Tips
| Trigger Source | Behaviour | Notes |
| --- | --- | --- |
| Travel mode `onEncounter` callback | Opens or reveals the encounter workspace, publishes the travel payload, and pauses playback. | Encounter pane shows the latest travel metadata and cached notes even after reloads. |
| Manual pane creation (`Open view by type → salt-marcher-encounter`) | Opens the workspace without publishing a new payload. | The pane shows the most recent encounter (if any) and allows reviewing notes. |

- Keep the encounter workspace docked next to Cartographer to reduce window juggling when multiple encounters occur.
- Capture new encounter tooling ideas as To-Dos (siehe `todo/`-Ordner) und verlinke die betroffenen Dokumente, damit die inkrementelle UX-Weiterentwicklung nachvollziehbar bleibt.
- Use Obsidian's pane pinning to prevent the encounter view from being replaced by unrelated notes during sessions.
- When testing travel mode without a region assignment, expect the pane to show "Unknown region" and omit encounter odds—add odds in Library → Regions to surface them here.

## Related Links
- [Getting Started](./Getting-Started.md)
- [Cartographer](./Cartographer.md)
- [Library](./Library.md)
- [Data Management](./Data-Management.md)
- Travel hand-off implementation notes under `salt-marcher/docs/cartographer/travel-mode-overview.md`.
