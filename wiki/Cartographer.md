# Cartographer Workspace

## Overview & Audience
The Cartographer workspace orchestrates Salt Marcher's hex maps, presenter lifecycle, and travel encounters. Use this guide when preparing maps, running overland travel, or diagnosing presenter behaviour inside Obsidian.

## Prerequisites
- Salt Marcher plugin installed and enabled in the active vault.
- Hex map files stored in your vault or a plan to create a new one via the workspace header.
- Shared terrain and region data initialised through the Library workflows.

## Step-by-step Workflow
1. **Open the Cartographer workspace.** Launch it from the compass ribbon icon or run `Salt Marcher: Cartographer öffnen` to mount the map shell, header, and sidebar hosts.
2. **Load or create a map.** Use the header controls to open an existing file or start a new map; confirm the presenter reloads all layers without warnings.
3. **Select the appropriate mode.** Choose Travel, Editor, or Inspector from the header dropdown. Each switch calls `onExit` on the previous mode before initialising the next to avoid leaking listeners. Aborted or rapidly chained selections cancel any unfinished setup, so partially loaded layers are disposed instead of resurfacing later.
4. **Execute mode-specific tasks.**
   - **Travel:** Play routes, manage tempo, and monitor encounter prompts.
   - **Editor:** Paint terrains, assign regions, and adjust metadata using the active tool panel.
   - **Inspector:** Inspect individual hexes, adjust terrain assignments, and edit annotations.
5. **Handle encounters and saves.** Respond to encounter pop-ups by opening the Encounter workspace, then return to Cartographer to resume travel. Use the Save menu to persist changes or branch via Save As when testing variations.

## Reference & Tips
| Header Action | Purpose | Primary Outcome |
| --- | --- | --- |
| Open Map | Select an existing hex map file. | Broadcasts the chosen file to all active components and refreshes map layers. |
| Create Map | Start a new map document. | Generates a file, loads it into the presenter, and initialises default layers. |
| Delete Map | Remove the current map after confirmation. | Cleans presenter state so the shell unmounts mode-specific artefacts safely. |
| Save / Save As | Persist the active map. | Calls presenter hooks to write changes immediately or duplicate via Save As. |

| Mode | Key Capabilities | Data Dependencies |
| --- | --- | --- |
| Travel | Route playback, tempo control, encounter hand-off, terrain palette sync. | Requires up-to-date terrains and routes; listens for `salt:terrains-updated`. |
| Editor | Terrain brush, region assignment, tool lifecycle management. | Depends on terrains and regions from Library; updates map metadata on commit. |
| Inspector | Hex inspection, terrain reassignment, annotation editing. | Reads current map file and global terrain colours for accurate previews. |

- Travel mode pauses playback automatically when an encounter fires and reopens the encounter pane if it was previously hidden.
- Editor tools dispose themselves on mode change; ensure unsaved map edits are committed via Save before switching contexts.
- Inspector updates propagate through the presenter, keeping the Library and Data Management watchers aligned with the active map.

## Related Links
- [Getting Started](./Getting-Started.md)
- [Library](./Library.md)
- [Encounter](./Encounter.md)
- [Data Management](./Data-Management.md)
- Plugin architecture notes under `salt-marcher/docs/cartographer/`.
