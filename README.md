# Salt Marcher for Obsidian

Salt Marcher is an Obsidian community plugin for running hexcrawl-inspired tabletop campaigns directly in your vault. It provides integrated map management, lore libraries, and encounter orchestration so referees can prep and run sessions without leaving their notes. Detailed usage guides live in the [project wiki](../../wiki); this README highlights the essentials to help you get started quickly.

## Prerequisites
- Obsidian Desktop 1.5+ with Community Plugins enabled
- A vault with write access (the plugin stores terrain data and encounter logs)
- Optional: existing regional maps or encounter notes you want to import

## Installation (within Obsidian)
1. Open **Settings → Community Plugins** and enable community plugins.
2. Use **Browse** to locate "Salt Marcher" (or install manually from this repository) and press **Install**.
3. After installation, click **Enable**. Obsidian will load the plugin and register its workspace views automatically.

## Primary Workflows
Salt Marcher ships three coordinated workspaces:

- **Cartographer** – Your hex map control center for editing tiles, annotating regions, and launching encounters.
- **Library** – A knowledge base for creatures, spells, terrains, and regions that synchronizes with Cartographer selections.
- **Encounter** – A focused session view for managing active encounters created from your maps or library records.

Deep-dive documentation, mode breakdowns, and UI tours for each workflow are available in the [wiki](../../wiki).

## What Loads Automatically
On activation, the plugin registers the following so everything is ready the moment Obsidian starts:

- Workspace views for **Cartographer**, **Encounter**, and **Library**, each backed by their respective presenters and UI shells.【F:salt-marcher/src/app/main.ts†L16-L19】
- Terrain bootstrap: the plugin creates the terrain data file if missing, loads terrains into memory, and starts a watcher so view components react to updates in real time.【F:salt-marcher/src/app/main.ts†L21-L24】
- Ribbon icons labelled **Open Cartographer** and **Open Library** that open the corresponding views in a new leaf.【F:salt-marcher/src/app/main.ts†L26-L34】
- Commands **Cartographer öffnen** and **Library öffnen** so keyboard palettes mirror the ribbon actions.【F:salt-marcher/src/app/main.ts†L36-L47】
- Hex map styling and the layout editor bridge, ensuring custom CSS and layout synchronization stay active across sessions.【F:salt-marcher/src/app/main.ts†L49-L60】

## Quick-Start Checklist
- [ ] Click the **Open Cartographer** ribbon icon (or run **Cartographer öffnen**) to open the map workspace.
- [ ] Create a new hex map or import an existing region using the Cartographer controls.
- [ ] Manage terrains and regions in the **Library** view; confirm updates reflect instantly in Cartographer.
- [ ] Trigger an encounter from Cartographer or Library and manage it within the **Encounter** view.

## Support & Licensing
Need help? Start with the troubleshooting entries in the [wiki](../../wiki). For direct assistance, open a discussion or issue in this repository.

This project builds upon the excellent SRD 5.2 markdown compilation by [Springbov](https://github.com/springbov/dndsrd5.2_markdown/tree/main). Content remains under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/legalcode), and attribution to Springbov is retained per the license terms.
