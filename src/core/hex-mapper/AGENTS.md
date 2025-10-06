# Ziele
- Liefert Rendering- und Interaktionslogik für hexbasierte Karten.

# Aktueller Stand
- Kernmodule (`camera`, `hex-geom`, `hex-notes`, `hex-render`) bieten Steuerung und Datenmodelle.
- Unterordner `render` kapselt WebGL/SVG-spezifische Implementierungen.
- `PERFORMANCE.md` beschreibt aktuelle Profiling-Werte, Engpässe und Beobachtungsplan.

# ToDo
- keine offenen ToDos.

# Standards
- Dateien notieren im Kopf die wichtigsten Eingaben/Ausgaben.
- Render-Funktionen bleiben frei von Obsidian-spezifischen Importen.
