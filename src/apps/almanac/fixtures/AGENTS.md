# Ziele
- Bündelt Referenzdaten und Demo-Factories für Almanac-Kalender, Events und Phänomene.
- Unterstützt Preview-/Test-Szenarien ohne Vault-Abhängigkeiten.

# Aktueller Stand
- `gregorian.fixture.ts` liefert das Standard-Schema inkl. Sample-Events und Zeiteinstellungen.
- `phenomena.fixture.ts` stellt Demo-Phänomene mitsamt Zusammenfassungen für UI-Previews bereit.

# ToDo
- [P1] Weitere Kalender-Schemata (z.B. 10-Tage-Woche, Schaltregeln) ergänzen.
- [P2] Fixture-Daten für Travel-Leaf (Wetter, Gezeiten) erweitern.

# Standards
- Fixtures bleiben deterministisch; keine zufälligen Seeds in Default-Ausgaben.
- Exportierte Factory-Funktionen akzeptieren Jahreszahlen/Parameter zur gezielten Generierung.
