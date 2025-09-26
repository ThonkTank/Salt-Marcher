# Hex-Renderer modularisieren

## Originalkritik
> Dateien wie `renderHexMap` überschreiten 300 Zeilen und beinhalten sowohl Rendering als auch Input-Handling. Ein Aufsplitten (Renderer, InteractionController) würde die „<500 Zeilen“-Vorgabe des Projekt-Guides unterstützen.【F:salt-marcher/src/core/hex-mapper/hex-render.ts†L1-L183】

## Kontext
- Module: `salt-marcher/src/core/hex-mapper/hex-render.ts`, `salt-marcher/src/core/hex-mapper/render/interactions.ts`, `salt-marcher/src/core/hex-mapper/render/scene.ts`.
- `hex-render.ts` bündelt Rendering, Interaktion und Kamera-Setup in einer großen Datei.
- Wartbarkeit und Testbarkeit leiden unter der Vermischung der Verantwortlichkeiten.

## Lösungsideen
- Rendering-, Interaktions- und Kamera-Steuerung in getrennte Module extrahieren.
- Öffentliche API vereinfachen (z. B. Builder oder Facade), um Konsumierende nicht zu brechen.
- Bestehende Tests erweitern/aufteilen (`salt-marcher/tests/`), um neue Module abzudecken.
- Dokumentation (`salt-marcher/docs/core/hex-render-overview.md`) aktualisieren, sobald die neue Architektur steht.
