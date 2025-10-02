# Ziele
- Stellt den Kreaturen-Editor mit Abschnitten für Werte, Sinne und Zauber.

# Aktueller Stand
- `modal` erzeugt das Editor-Dialogfenster.
- `index` und `section-*` rendern Formularabschnitte inkl. Presets.
- `presets` liefert Vorlagewerte, `section-utils` kapselt Hilfsfunktionen.

# ToDo
- Presets mit Schwierigkeitsgraden dokumentieren.
- Abschnittsvalidierung für abhängige Felder ergänzen.

# Standards
- Jede Abschnittsdatei beschreibt im Kopf, welche Felder sie rendert.
- Gemeinsame Utilities bleiben in `section-utils` und werden nicht dupliziert.
