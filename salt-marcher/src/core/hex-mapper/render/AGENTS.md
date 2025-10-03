# Ziele
- Implementiert Low-Level-Rendering und Interaktionen für Hex-Karten.

# Aktueller Stand
- Dateien teilen sich in Szenenaufbau (`scene`, `bootstrap`), Kamera (`camera-controller`), Koordinaten (`coordinates`) und Interaktionen.
- `types` definiert gemeinsame Contracts für Render-Helfer.

# ToDo
- GPU/Canvas-Auswahl dokumentieren und abstrahieren.

# Standards
- Jede Datei benennt im Kopf, welchen Teil der Render-Pipeline sie verantwortet.
- Exportierte Funktionen/Factories bleiben deterministisch und injizieren Abhängigkeiten als Parameter.
