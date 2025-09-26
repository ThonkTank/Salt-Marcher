# Layout Editor Bridge

## Purpose & Audience
Dieses Dokument beschreibt die optionale Integration zwischen Salt Marcher und dem "Layout Editor"-Plugin. Es richtet sich an Entwickler:innen, die `src/app/layout-editor-bridge.ts` warten oder erweitern und verstehen müssen, wann und wie das Bridge-Modul externe APIs aufruft. Nutzerorientierte Workflows verbleiben im [Projekt-Wiki](../../wiki/README.md).

## Struktur
```
docs/app/
├─ README.md                  # Überblick App-Bootstrap
└─ layout-editor-bridge.md    # Dieses Dokument

src/app/
├─ integration-telemetry.ts   # Gemeinsame Fehler-Telemetrie & Notices
└─ layout-editor-bridge.ts    # Bridge-Implementierung

tests/app/
└─ layout-editor-bridge.test.ts  # Lifecycle- und Fehlerpfad-Tests
```

## Integrationsvertrag
- **Registrierung**: `setupLayoutEditorBridge(plugin)` wird aus `main.ts` mit dem aktuellen Plugin-Objekt aufgerufen. Die Funktion sucht über `app.plugins.getPlugin("layout-editor")?.getApi?.()` nach dem Fremd-Plugin. Das erwartete API-Objekt muss mindestens `registerViewBinding` bereitstellen; `unregisterViewBinding` wird genutzt, wenn vorhanden.
- **View Binding**: Bei erfolgreichem Lookup registriert die Bridge ein Binding mit der Kennung `salt-marcher.cartographer-map`. Die ID ist Teil des Vertrags; Layout-Editor-Konfigurationen, die auf Salt Marcher verweisen, nutzen diesen Schlüssel.
- **Lifecycle Hooks**: Die Bridge hört auf Obsidian-Events (`layout-ready`) sowie auf Plugin-Lifecycle (`plugin-enabled`/`plugin-disabled`). Die Listener sind jetzt streng typisiert (`PluginLifecycleEmitter`) und werden über das Rückgabecallback deterministisch abgeräumt.
- **Fehlerbild & Telemetrie**: Fehlschläge bei API-Auflösung, Registrierung oder Deregistrierung werden über `reportIntegrationIssue` gemeldet. Das Hilfsmodul schreibt eine `console.error`-Spur und zeigt deduplizierte Notices mit konkretem Kontext an (Registrierung, Deregistrierung, inkompatible API).

## Abhängigkeiten & Erwartungen
- **Layout Editor Plugin**: Muss einen synchronen `getApi()`-Zugriff bereitstellen. Gibt `getApi()` vorübergehend `null/undefined` zurück, wiederholt die Bridge den Versuch beim nächsten Lifecycle-Event. Eine inkompatible API (fehlendes `registerViewBinding`) führt zu einem deduplizierten Fehlerhinweis.
- **Plugin-Manager-Emitter**: Wir kapseln `app.plugins.on/off` über `bindLifecycleEmitter`, sodass Listener automatisch mit dem korrekten Kontext verknüpft werden. Fallback: Wenn `off` fehlt oder `on` kein Token zurückgibt, verzichtet die Bridge auf das Abmelden.
- **Telemetrie-Helfer**: `integration-telemetry.ts` stellt eine zentrale Schnittstelle für Integrationsprobleme bereit. Notices sind bewusst kurz gehalten und verweisen auf das Debug-Log für Details.
- **Obsidian Lifecycle**: Die Bridge wird ausschließlich über das App-Bootstrap-Modul verwaltet. Andere Komponenten dürfen das Layout-Editor-API nicht direkt ansprechen, um die Verantwortung klar zu halten.

## Defensive Coding Standards
- **Feature-Detection zuerst**: Jede neue Interaktion mit dem Layout-Editor muss optional bleiben (typeof-/in-Checks) und darf bei fehlender API still aussteigen.
- **Idempotenz erzwingen**: Halte `tryRegister`/`unregister` reentrant, indem du Sentinels wie `unregister`-Closures oder Flag-States nutzt.
- **Bound Context**: Lifecycle-Methoden des Plugin-Managers werden via `bind` an den ursprünglichen Kontext gebunden, damit Obsidian-internes State-Handling nicht verloren geht.
- **Fehlerlog sichtbar halten**: `reportIntegrationIssue` liefert strukturierte Fehlermeldungen inklusive Notices. Zusätzliche Fehlerzweige müssen denselben Pfad nutzen, damit Nutzer:innen informiert bleiben.
- **Isolierte Teardown-Signatur**: Das Dispose-Callback darf keine zusätzlichen Parameter erwarten. Es wird von `main.ts` direkt in `onunload` durchgereicht.

## Offene Punkte
- Prüfen, ob das Layout-Editor-Plugin mittelfristig weitere Hooks (z. B. Status-Abfragen) bereitstellt, die wir spiegeln möchten.
- `todo/layout-editor-bridge-review.md` hält den historischen Review-Kontext fest und sollte nach der nächsten Plugin-Version aktualisiert werden, falls sich der Integrationsvertrag erneut ändert.

## Weiterführende Ressourcen
- Lifecycle-Analyse: [`Notes/layout-editor-bridge-review.md`](../../Notes/layout-editor-bridge-review.md)
- Implementierung: [`src/app/layout-editor-bridge.ts`](../../salt-marcher/src/app/layout-editor-bridge.ts)
- Telemetrie: [`src/app/integration-telemetry.ts`](../../salt-marcher/src/app/integration-telemetry.ts)
- Tests: [`tests/app/layout-editor-bridge.test.ts`](../../salt-marcher/tests/app/layout-editor-bridge.test.ts)
