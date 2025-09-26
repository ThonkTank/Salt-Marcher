# Data Management

## Overview & Audience
Data Management explains how Salt Marcher stores shared terrains and regions, how watchers broadcast changes, and which components consume those signals. Use it when extending data formats, debugging sync behaviour, or preparing bulk imports.

## Prerequisites
- Salt Marcher plugin installed with Library and Cartographer workflows available.
- Access to the vault's `SaltMarcher/Terrains.md` and `SaltMarcher/Regions.md` files.
- Understanding of Markdown fenced code blocks for editing structured data.

## Step-by-step Workflow
1. **Inspect the terrain palette.** Open `SaltMarcher/Terrains.md`, locate the fenced `terrain` block, and confirm the default blank entry remains at the top.
2. **Edit terrain entries safely.** Modify name, colour, or speed values within the code block; keep entries alphabetised and retain the `name: #hex, speed: value` pattern.
3. **Review region definitions.** Open `SaltMarcher/Regions.md`, locate the fenced `regions` block, and confirm each line references a valid terrain.
4. **Update region entries.** Adjust terrain assignments or encounter odds (`encounter: 1/n`). Normalise numeric values before saving to keep parsing predictable.
5. **Verify watcher propagation.** Reopen the Library or Cartographer workspaces to ensure `salt:terrains-updated` and `salt:regions-updated` events refresh dropdowns and palettes.

## Reference & Tips
| Terrain Field | Description | Notes |
| --- | --- | --- |
| `name` | Display label used across Cartographer and Library. | Keep unique; the blank entry (`:`) must remain for default hexes. |
| `color` | Hex value driving map rendering and previews. | Use full `#rrggbb`; avoid shorthand to keep parsing simple. |
| `speed` | Movement multiplier applied during travel. | Decimal values <1 slow movement, >1 accelerate. |

| Region Field | Description | Notes |
| --- | --- | --- |
| `name` | Identifier displayed in Library and Cartographer inspector. | Use descriptive names for easier search. |
| `terrain` | Reference to a terrain `name`. | Ensure the referenced terrain exists; dropdowns refresh automatically after saves. |
| `encounter` | Optional odds expressed as `1/n`. | Supports integers; serialisation normalises to fractional form. |

- Use fenced block formatting consistently; stray whitespace or indentation can prevent parsers from detecting entries.
- If a data file is deleted, Salt Marcher recreates it during the next bootstrap, but manual backups are recommended before large edits.
- Schedule batch changes during downtime to avoid flooding watchers with rapid saves; the Library's debounced writers help mitigate this.

## Related Links
- [Getting Started](./Getting-Started.md)
- [Cartographer](./Cartographer.md)
- [Library](./Library.md)
- [Encounter](./Encounter.md)
- Core data store overviews under `salt-marcher/docs/core/`.
