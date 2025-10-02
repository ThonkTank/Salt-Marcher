# Ziele
- Bietet Editoren zum Anlegen neuer Bibliothekseinträge (Kreaturen, Zauber).

# Aktueller Stand
- `index` verbindet gemeinsame Shared-Komponenten mit Kategorie-spezifischen Views.
- Unterordner `creature`, `spell` kapseln spezialisierte Formulare.
- `shared` enthält modulübergreifende Editoren wie Token- und Stat-Helfer.

# ToDo
- Validierungsfeedback konsolidieren und zentral beschreiben.
- Speicherroutinen mit Autosave ergänzen.
- Wiederkehrende Formular-Layouts (Cards, Field-Grids) in gemeinsame Builder überführen.

# Standards
- Editor-Module erläutern, welche Felder sie erfassen.
- Komponenten exportieren Factories/Funktionen ohne globale Mutationen.
