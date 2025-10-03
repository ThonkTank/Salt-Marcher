# Ziele
- Stellt den Kreaturen-Editor mit Abschnitten für Werte, Sinne und Zauber.

# Aktueller Stand
- `modal` erzeugt das Editor-Dialogfenster.
- `index` und `section-*` rendern Formularabschnitte inkl. Presets.
- `presets` liefert Vorlagewerte, `section-utils` kapselt Hilfsfunktionen.

# ToDo
- Presets mit Schwierigkeitsgraden dokumentieren.
- Bewegungs- und Geschwindigkeitseinträge in strukturierte Objekte mit Flags (z. B. Hover) überführen.
- Spell-Ladeprozess im Modal mit Lade-/Fehlerzustand versehen.

# Standards
- Jede Abschnittsdatei beschreibt im Kopf, welche Felder sie rendert.
- Gemeinsame Utilities bleiben in `section-utils` und werden nicht dupliziert.
