# LIB-TD-0001 – Umsetzung & Nachweis

## Plan
- Telemetrie-Hooks der Ports konkretisieren, sodass jede Adapterinstanz eindeutig gemeldet wird.
- Regressionstest ergänzen, der den Harness über Legacy/v2-Adapter hinweg betreibt und Telemetrie-Signale prüft.
- Dokumentation und Kanban-Eintrag aktualisieren, um den Abschluss der Aufgabe nach Phase-3-Standards zu protokollieren.

## Umsetzung
- Serializer-, Storage- und Event-Adapter des Harness melden Aktivierungen jetzt über optionale Telemetrie und verhindern Mehrfachmeldungen pro Instanz.
- Event-Adapter resetten ihren Aktivierungsstatus beim Wechsel und führen weiterhin dedizierte `library:save`-Hooks aus.
- Vertrags-Suite validiert Telemetriepfade für Renderer, Storage, Serializer und Event über Legacy- und v2-Konfigurationen.

## Tests
- `npm run test:contracts`

## Dokumentation
- Neues Statusdokument für LIB-TD-0001 angelegt.
- Kanban-Eintrag in Phase 3 auf „erledigt“ gesetzt.
