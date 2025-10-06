# Ziele
- Implementiert Low-Level-Rendering und Interaktionen für Hex-Karten.

# Aktueller Stand
- Dateien teilen sich in Szenenaufbau (`scene`, `bootstrap`), Kamera (`camera-controller`), Koordinaten (`coordinates`) und Interaktionen.
- `types` definiert gemeinsame Contracts für Render-Helfer.

# Render-Oberflächen
- `surface.ts` prüft WebGL2/WebGL/Canvas2D-Fähigkeiten und meldet die bevorzugte Oberfläche.
- Bis eine GPU-Pipeline implementiert ist, bleibt die tatsächliche Ausgabe auf SVG beschränkt; Capabilities werden jedoch an die
  Render-Handles gereicht, damit Views ihre Präferenzen nachvollziehen können.

# Standards
- Jede Datei benennt im Kopf, welchen Teil der Render-Pipeline sie verantwortet.
- Exportierte Funktionen/Factories bleiben deterministisch und injizieren Abhängigkeiten als Parameter.
