# Getting Started

## Overview & Audience
This guide walks Obsidian users through installing Salt Marcher, enabling its workspaces, and validating that shared data files are initialised. Follow it when onboarding a new vault or refreshing a development environment before testing.

## Prerequisites
- Obsidian Desktop 1.5+ with community plugins enabled.
- A writable vault location for plugin files and shared terrain data.
- Latest Salt Marcher release package or a local build produced with `npm run build` inside `salt-marcher/`.

## Step-by-step Workflow
1. **Install the plugin.**
   - Download the latest release archive or run `npm install` followed by `npm run build` inside `salt-marcher/` to emit `main.js`.
   - Copy `manifest.json`, `main.js`, and `styles.css` (if present) into `.obsidian/plugins/salt-marcher/` within your vault.
   - Restart or reload Obsidian so it indexes the new plugin files.
2. **Enable Salt Marcher inside Obsidian.**
   - Open **Settings → Community plugins** and toggle **Salt Marcher** on.
   - Confirm the compass and book ribbon icons appear; these provide one-click access to the Cartographer and Library views.
3. **Bootstrap the shared terrain palette.**
   - After activation Salt Marcher ensures `SaltMarcher/Terrains.md` exists, seeds the default palette, and pushes the entries into the global renderer state.
   - Optionally run **Command Palette → Salt Marcher: Cartographer öffnen** once to trigger the bootstrap immediately.
4. **Open each workspace to validate registration.**
   - **Cartographer:** Use the compass ribbon icon or the matching command palette entry to mount the map shell, header, and sidebar hosts.
   - **Library:** Use the book ribbon icon or **Salt Marcher: Library öffnen** to ensure watcher setup completes and the mode tabs render.
   - **Encounter:** Travel mode opens this workspace automatically when an encounter trigger fires; to inspect manually, create a new pane and choose `salt-marcher-encounter` from **Open view by type**.
5. **Plan next steps.**
   - Review [Cartographer](./Cartographer.md) for map editing, travel playback, and mode lifecycle details.
   - Visit [Library](./Library.md) to curate terrains, regions, and lore records.
   - Consult [Data Management](./Data-Management.md) for the precise file formats used by the shared palettes.

## Reference & Tips
| Workspace | Command Palette Entry | Ribbon Icon | Notes |
| --- | --- | --- | --- |
| Cartographer | `Salt Marcher: Cartographer öffnen` | Compass | Mounts map shell, header actions, and travel/editor/inspector modes. |
| Library | `Salt Marcher: Library öffnen` | Book | Sets up file watchers for creatures, spells, terrains, and regions. |
| Encounter | `Open view by type → salt-marcher-encounter` | _None_ | Appears automatically during travel encounters; can be pinned manually. |

- Keep the release bundle and source tree aligned; mismatched versions may cause watcher errors or missing commands.
- For development, re-run `npm run build` after TypeScript changes to refresh `main.js` before testing in Obsidian.
- Record deviations between documentation and behaviour in [`architecture-critique.md`](../architecture-critique.md) so follow-up tasks can address them.

## Related Links
- [Cartographer](./Cartographer.md)
- [Library](./Library.md)
- [Encounter](./Encounter.md)
- [Data Management](./Data-Management.md)
- Repository [README](../README.md) for licensing and contribution logistics.
