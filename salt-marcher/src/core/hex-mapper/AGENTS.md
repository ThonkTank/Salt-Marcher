# Ziele
- Liefert Rendering- und Interaktionslogik für hexbasierte Karten.

# Aktueller Stand
- Kernmodule (`camera`, `hex-geom`, `hex-notes`, `hex-render`) bieten Steuerung und Datenmodelle.
- Unterordner `render` kapselt WebGL/SVG-spezifische Implementierungen.

# ToDo
- Performance-Profile dokumentieren und optimieren.
- Notiz-Synchronisierung mit Library/Encounter vorbereiten.

# Standards
- Dateien notieren im Kopf die wichtigsten Eingaben/Ausgaben.
- Render-Funktionen bleiben frei von Obsidian-spezifischen Importen.
