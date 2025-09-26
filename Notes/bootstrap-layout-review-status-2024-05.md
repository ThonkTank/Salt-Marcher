# Bootstrap & Layout Review – Mai 2024

## Layout Editor Bridge
- Telemetrie, typisierte Lifecycle-Guards und Vitest-Coverage sichern die Integration gegen API-Drift und Runtime-Fehler ab (siehe Detailanalyse im [Layout-Bridge-Review-Note](layout-editor-bridge-review.md)).
- Beobachtungspunkt: Änderungen an `app.plugins.on/off` oder der Fremd-API müssen weiterhin überwacht werden.

## Main Bootstrap Service Integration
- `createTerrainBootstrap` liefert eine getestete Service-Grenze, wird in `main.ts` jedoch noch nicht genutzt (siehe [To-Do](../todo/main-bootstrap-service-integration.md)).
- Offene Arbeit: Legacy-Bootstrap ersetzen, Integrationstest reaktivieren und Service-Logging im Plugin-Einstieg sichtbar machen.

## Plugin Bootstrap Review
- Bootstrap-Bestandteile (Terrain-Service, Layout-Bridge) sind modularisiert, aber der Plugin-Einstieg orchestriert weiterhin Legacy- und Service-Code parallel (siehe [To-Do](../todo/plugin-bootstrap-review.md)).
- Offene Arbeit: Service-Handover definieren, Integrations-Testszenarien erweitern und Konfigurations-Optionen priorisieren.
