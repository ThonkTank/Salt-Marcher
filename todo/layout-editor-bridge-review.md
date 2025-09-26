# To-Do: Layout Editor Bridge Review

## Kontext
- Modul: [`src/app/layout-editor-bridge.ts`](../salt-marcher/src/app/layout-editor-bridge.ts)
- Dokumentation: [`docs/app/layout-editor-bridge.md`](../salt-marcher/docs/app/layout-editor-bridge.md)
- Review-Notizen: [`Notes/layout-editor-bridge-review.md`](../Notes/layout-editor-bridge-review.md)

Die Bridge integriert Salt Marcher optional mit dem Layout-Editor-Plugin. Die aktuelle Implementierung funktioniert, basiert jedoch auf impliziten Verträgen und liefert keine operativen Signale, falls Integrationspunkte brechen.

## Offene Aufgaben

### Typisierte Plugin-Lifecycle-API
- **Problem**: `app.plugins.on/off` wird über untypisierte Tokens angesprochen. Änderungen an der Obsidian-API könnten Listener-Leaks oder Exceptions verursachen.
- **Ansatz**: Führe eine lokale Typschnittstelle (z. B. `PluginManagerLifecycle`) ein, ergänze Guards für Rückgabewerte und dokumentiere das erwartete Verhalten in Tests.

### Fehler-Telemetrie & User Feedback
- **Problem**: Fehlgeschlagene Registrierungen/Unregistrierungen landen nur im Konsolen-Log. Nutzer:innen merken nicht, dass das Binding fehlt.
- **Ansatz**: Ergänze strukturierte Logging-Hooks (z. B. gemeinsames `logIntegrationIssue`) und überlege, ob Notifications oder Statusbadges angezeigt werden sollen, sobald die Bridge nicht registriert ist.

### Tests für Lifecycle-Szenarien
- **Problem**: Es gibt keine automatisierten Tests, die Registrierungs-, Aktivierungs- oder Deaktivierungspfade abdecken.
- **Ansatz**: Implementiere Jest-basierte Unit-Tests mit Mock-Plugin-Manager/Workspace, um `setupLayoutEditorBridge`-Verhalten (Erstregistrierung, Re-Enable, Teardown) abzudecken.

## Betroffene Module
- `src/app/layout-editor-bridge.ts`
- Evtl. gemeinsames Logging-/Telemetry-Modul

## Priorität
- Mittel; Integration funktioniert aktuell, Risiken steigen jedoch mit zukünftigen API-Änderungen.
