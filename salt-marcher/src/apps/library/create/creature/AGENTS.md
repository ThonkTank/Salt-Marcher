# Ziele
- Stellt den Kreaturen-Editor mit Abschnitten für Werte, Sinne und Zauber.

# Aktueller Stand
- `modal` erzeugt das Editor-Dialogfenster.
- `index` und `section-*` rendern Formularabschnitte inkl. Presets.
- `presets` liefert Vorlagewerte (inkl. dokumentierter Schwierigkeits-Tiers), `section-utils` kapselt Hilfsfunktionen.
- `section-basics` speichert Standardbewegungen in `data.speeds` und pflegt Hover-Flags getrennt von den Distanzangaben.

# ToDo
- Spell-Ladeprozess im Modal mit Lade-/Fehlerzustand versehen.

# Preset-Schwierigkeitsstufen
- Tier 1 (CR 0–4): Grundlinien für Scouts, Begleiter und Minions ohne ausgedehnte Ressourcen.
- Tier 2 (CR 5–10): Veteranen und Elite-Gegner mit skalierenden Trefferpunkten und taktischen Reaktionen.
- Tier 3 (CR 11–16): Kampagnenbedrohungen mit erhöhter Defensivkraft und zuverlässigen Signaturfähigkeiten.
- Tier 4 (CR 17+): Legendäre Kontrahenten, deren Statblöcke Encounter-Strukturen und Skalierung bestimmen.

# Standards
- Jede Abschnittsdatei beschreibt im Kopf, welche Felder sie rendert.
- Gemeinsame Utilities bleiben in `section-utils` und werden nicht dupliziert.
