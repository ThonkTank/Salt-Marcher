# Ziele
- Stellt UI-Controller und Layer für den Travel-Modus bereit.

# Aktueller Stand
- Controller-Dateien (`context-menu`, `drag`) verdrahten Benutzerinteraktionen.
- `controls`, `sidebar` und Layer-Dateien rendern sichtbare Panels.
- `types` sammelt UI-spezifische Contracts.

# ToDo
- Touch-Gesten und Barrierefreiheitssignale ergänzen.
- Kontextmenüs auf neue Encounter-Ereignisse erweitern.

# Standards
- UI-Dateien beginnen mit kurzer Beschreibung der sichtbaren Elemente.
- Exportierte Controller heißen `create<Name>Controller` und kapseln Listener-Registrierung.
