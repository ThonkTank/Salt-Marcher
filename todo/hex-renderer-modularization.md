# Hex renderer modularization

## Original Finding
> Dateien wie `renderHexMap` überschreiten 300 Zeilen und beinhalten sowohl Rendering als auch Input-Handling. Ein Aufsplitten (Renderer, InteractionController) würde die „<500 Zeilen“-Vorgabe des Projekt-Guides unterstützen.
>
> **Empfohlene Maßnahme:** `renderHexMap` weiter aufteilen (Rendering, Input, Camera) und Testbarkeit erhöhen, um die Dateigröße zu reduzieren.

Quelle: [`docs/architecture-critique.md`](../docs/architecture-critique.md).

## Kontext
- **Betroffene Module:** `salt-marcher/src/core/hex-mapper/hex-render.ts`, `salt-marcher/src/core/hex-mapper/render/interactions.ts`.
- **Auswirkung:** Kombinierte Verantwortlichkeiten erschweren das Testen einzelner Teile und erhöhen die Fehleranfälligkeit.
- **Risiko:** Verletzung der Projektstandards, steigende Komplexität bei weiteren Features (z. B. zusätzliche Kamera-Controller).

## Lösungsansätze
1. Extrahiere Rendering-, Interaktions- und Kamera-Steuerung in eigenständige Klassen/Module mit klaren Schnittstellen.
2. Richte Integrationstests ein, die zusammengesetzte Controller validieren, während Unit-Tests die Einzelkomponenten abdecken.
3. Aktualisiere Dokumentation und Diagramme in `docs/core/hex-render-overview.md`, sobald neue Grenzen etabliert sind.

## Referenzen
- Hex-Renderer: [`salt-marcher/src/core/hex-mapper/hex-render.ts`](../salt-marcher/src/core/hex-mapper/hex-render.ts)
- Interaktions-Controller: [`salt-marcher/src/core/hex-mapper/render/interactions.ts`](../salt-marcher/src/core/hex-mapper/render/interactions.ts)
