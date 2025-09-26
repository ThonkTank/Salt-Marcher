# Library Workspace

## Overview & Audience
The Library workspace manages Salt Marcher's lore sources—creatures, spells, terrains, and regions. Refer to this guide when curating shared data, synchronising palettes with Cartographer, or verifying watcher behaviour.

## Prerequisites
- Salt Marcher plugin enabled with access to the vault's `SaltMarcher/` directory.
- Initial terrain and region files created via the Getting Started workflow or prior Library sessions.
- Write permissions for the creature and spell folders inside the vault.

## Step-by-step Workflow
1. **Open the Library workspace.** Launch it via the book ribbon icon or run `Salt Marcher: Library öffnen` to initialise mode tabs and file watchers.
2. **Review creatures and spells.**
   - Use the search inputs to locate existing Markdown entries; double-click to open them in Obsidian for editing.
   - Create new entries through the modal dialogs; confirm files appear under `SaltMarcher/Creatures/` or `SaltMarcher/Spells/`.
3. **Maintain the terrain palette.**
   - Edit terrain rows in the inline table to adjust names, colours, or speed modifiers.
   - Allow the debounced save to flush changes, then verify the table reloads from disk without losing edits.
4. **Update region definitions.**
   - Adjust region names, terrain assignments, and encounter odds using the dropdowns and numeric fields.
   - Confirm dropdowns refresh when the terrain palette updates to keep assignments valid.
5. **Exit cleanly.** Close the workspace or switch modes to trigger watcher disposal and avoid duplicate listeners on reopening.

## Reference & Tips
| Data Type | Storage Path | Key Fields | Save Behaviour |
| --- | --- | --- | --- |
| Creatures | `SaltMarcher/Creatures/` | Markdown body with frontmatter (optional). | Immediate writes through Obsidian's editor; watcher keeps list fresh. |
| Spells | `SaltMarcher/Spells/` | Markdown body with optional tags. | Same as creatures; watcher mirrors filesystem changes. |
| Terrains | `SaltMarcher/Terrains.md` within a `terrain` code block. | `name`, `color` (hex), `speed` multiplier. | Debounced 500 ms batch save followed by reload. |
| Regions | `SaltMarcher/Regions.md` within a `regions` code block. | `name`, `terrain`, optional `encounter: 1/n`. | Debounced 500 ms batch save; listens to terrain updates for dropdown refresh. |

- Watchers dispose automatically when leaving the workspace; reopen Library after external syncs to rescan data.
- Maintain alphabetical ordering when editing terrains or regions manually to keep diffs readable.
- Keep encounter odds consistent with the Encounter workflow so travel triggers behave predictably.

## Related Links
- [Getting Started](./Getting-Started.md)
- [Cartographer](./Cartographer.md)
- [Encounter](./Encounter.md)
- [Data Management](./Data-Management.md)
- Plugin documentation under `salt-marcher/docs/library/`.
