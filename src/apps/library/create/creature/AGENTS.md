# Ziele
- Stellt den Kreaturen-Editor mit Abschnitten für Werte, Sinne und Zauber.
- Modulare, wiederverwendbare Komponenten für bessere Wartbarkeit und Erweiterbarkeit.

# Aktueller Stand
- `modal` erzeugt das Editor-Dialogfenster.
- `index` und `section-*` rendern Formularabschnitte inkl. Presets.
- `presets` liefert Vorlagewerte (inkl. dokumentierter Schwierigkeits-Tiers), `section-utils` kapselt Hilfsfunktionen.
- `section-basics` speichert Standardbewegungen in `data.speeds` und pflegt Hover-Flags getrennt von den Distanzangaben.

## Refactored Sections (Phase 2-4, 2025-01)
- **section-entries.ts**: 393 → 134 Zeilen (-66%) durch Entry-Card-Komponente
- **section-spellcasting.ts**: 636 → 444 Zeilen (-30%) durch Spell-Input, Spell-Row, Spell-Group Komponenten
- **section-stats-and-skills.ts**: 257 → 121 Zeilen (-53%) durch Stat-Column und Skill-Manager Komponenten
- **section-basics.ts**: 352 → 149 Zeilen (-58%) durch Alignment-Editor und Movement-Model Komponenten

## Komponenten-Architektur
- **components/spellcasting/**: Spell-Input (Autocomplete), Spell-Row, Spell-Group (4 Typen: at-will, per-day, level, custom)
- **components/stats-and-skills/**: Stat-Column (Score/Mod/Save), Skill-Manager (Search, Chips, Expertise)
- **components/basics/**: Alignment-Editor (Law/Chaos, Good/Evil, Override), Movement-Model (Standard + Custom)
- **components/entry-card.ts**: Basis, Combat, Meta, Details Sections mit Preset-Autocomplete

Alle Komponenten sind mit JSDoc dokumentiert und exportieren type-safe Interfaces und Handles.

# ToDo
- [P4.3] Spell-Ladeprozess im Modal mit Lade-/Fehlerzustand versehen.

# Standards
- Jede Abschnittsdatei beschreibt im Kopf, welche Felder sie rendert.
- Gemeinsame Utilities bleiben in `section-utils` und werden nicht dupliziert.
- Komponenten exportieren klare Options-Interfaces und Handles für externe Updates.
- JSDoc mit @param, @returns, @example für alle öffentlichen APIs.
- Keine Breaking Changes bei Refactorings - bestehende APIs bleiben erhalten.
