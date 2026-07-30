# SaltMarcher

SaltMarcher is a local-first tabletop-campaign tool for map travel, dungeon
editing, session planning, catalog data, encounters, and party state. It is
being rebuilt as a secure Electron application; the former JavaFX app is
preserved as Git reference `javafx-final-2026-07-27`.

## Quickstart

Run the Electron shell from the repository root:

```bash
pnpm dev
```

## Local Data

The Electron application uses an isolated development-data directory until
its first real-use release. It owns `installation.sqlite` plus one
`campaigns/<id>/campaign.sqlite` per campaign; no legacy-data conversion is
provided.

## Project Map

- `src/`: Electron main, preload, core, renderer, and shared code
- `resources/`: retained static product data and artwork
- `docs/`: canonical project and feature documentation

Start with `docs/README.md` for the documentation map.
