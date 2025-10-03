# Ziele
- Bietet Editoren zum Anlegen neuer Bibliothekseinträge (Kreaturen, Zauber).

# Aktueller Stand
- `index` verbindet gemeinsame Shared-Komponenten mit Kategorie-spezifischen Views.
- Unterordner `creature`, `spell` kapseln spezialisierte Formulare.
- `shared` enthält modulübergreifende Editoren wie Token- und Stat-Helfer.

# ToDo
- [P4.2] Validierungsfeedback konsolidieren und zentral beschreiben.
- [P3.4] Speicherroutinen mit Autosave ergänzen.

# Standards
- Editor-Module erläutern, welche Felder sie erfassen.
- Komponenten exportieren Factories/Funktionen ohne globale Mutationen.
