# Cartographer Components

**Zweck**: UI-Komponenten für den Cartographer Workmode (Panels, Toolbars, Inspectors).

## Contents

| Element | Beschreibung |
|---------|--------------|
| `building-indicator-layer.ts` | Building indicator overlay rendering |
| `day-cycle-simulator.ts` | Day/night cycle simulation UI |
| `environment-panel.ts` | Environment settings panel |
| `inspector-panel.ts` | Main inspector panel coordinator |
| `inspector-panel-bindings.ts` | Data bindings for inspector |
| `inspector-panel-data.ts` | Data loading and transformation |
| `inspector-panel-types.ts` | Type definitions for inspector |
| `inspector-panel-ui.ts` | UI rendering for inspector |
| `layer-control-panel.ts` | Layer visibility toggle panel |
| `layer-presets.ts` | Predefined layer configurations |
| `tooltip-renderer.ts` | Hover tooltip rendering for hexes |
| `tool-toolbar.ts` | Tool selection toolbar |

## Connections

**Verwendet von:**
- `../view-builder.ts` - Creates and positions components
- `../controller.ts` - Coordinates component lifecycle

**Abhängig von:**
- `@features/maps` - Tile data, coordinate system
- `@ui/components` - Base UI utilities
- `../domain/` - Type definitions

## Inspector Panel Architecture

Das Inspector Panel besteht aus 5 Dateien:
- `inspector-panel.ts` - Haupt-Orchestrator (Entry Point)
- `inspector-panel-types.ts` - TypeScript Typen
- `inspector-panel-bindings.ts` - Reactive Bindings zu Stores
- `inspector-panel-data.ts` - Datenaufbereitung und Loading
- `inspector-panel-ui.ts` - DOM Rendering

Diese Aufteilung ermöglicht:
- Separation of Concerns (Daten vs UI vs Bindings)
- Testbarkeit der einzelnen Schichten
- Übersichtlichkeit bei ~1000 LOC Gesamtlogik
