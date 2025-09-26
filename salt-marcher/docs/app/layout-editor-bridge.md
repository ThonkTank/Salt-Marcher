# Layout Editor Bridge

## Purpose & Audience
Dieses Dokument beschreibt die optionale Integration zwischen Salt Marcher und dem "Layout Editor"-Plugin. Es richtet sich an Entwickler:innen, die `src/app/layout-editor-bridge.ts` warten oder erweitern und verstehen müssen, wann und wie das Bridge-Modul externe APIs aufruft. Nutzerorientierte Workflows verbleiben im [Projekt-Wiki](../../wiki/README.md).

## Struktur
```
docs/app/
├─ README.md                  # Überblick App-Bootstrap
└─ layout-editor-bridge.md    # Dieses Dokument

src/app/
└─ layout-editor-bridge.ts    # Bridge-Implementierung
```

## Integrationsvertrag
- **Registrierung**: `setupLayoutEditorBridge(plugin)` wird aus `main.ts` mit dem aktuellen Plugin-Objekt aufgerufen. Die Funktion sucht über `app.plugins.getPlugin("layout-editor")?.getApi?.()` nach dem Fremd-Plugin und erwartet ein API-Objekt mit `registerViewBinding` und `unregisterViewBinding`.
- **View Binding**: Bei erfolgreichem Lookup registriert die Bridge ein Binding mit der Kennung `salt-marcher.cartographer-map`. Die ID ist Teil des Vertrags; Layout-Editor-Konfigurationen, die auf Salt Marcher verweisen, nutzen diesen Schlüssel.
- **Lifecycle Hooks**: Die Bridge hört auf Obsidian-Events (`layout-ready`) sowie auf Plugin-Lifecycle (`plugin-enabled`/`plugin-disabled`) und führt `registerViewBinding` bzw. `unregisterViewBinding` deterministisch aus. Das von `setupLayoutEditorBridge` gelieferte Dispose-Callback räumt dieselben Bindings auf und entfernt die Event-Hooks wieder.
- **Fehlerbild**: Fehlschläge beim Registrieren/ Deregistrieren werden in der Konsole protokolliert; der Bridge-Code bricht nicht ab, wenn das Layout-Editor-Plugin fehlt oder inkompatible APIs liefert.

## Abhängigkeiten & Erwartungen
- **Layout Editor Plugin**: Muss einen synchronen `getApi()`-Zugriff bereitstellen. Alle Methoden sind optional, weshalb der Bridge-Code defensive Guards benötigt.
- **Plugin-Manager-Emitter**: Wir verlassen uns darauf, dass `app.plugins.on/off` EventEmitter-ähnliche Methoden bereitstellen und ein Token zurückgeben, das später wiederverwendet werden kann. Dieses Verhalten ist nicht offiziell dokumentiert (siehe Review-Notizen).
- **Obsidian Lifecycle**: Die Bridge wird ausschließlich über das App-Bootstrap-Modul verwaltet. Andere Komponenten dürfen das Layout-Editor-API nicht direkt ansprechen, um die Verantwortung klar zu halten.

## Defensive Coding Standards
- **Feature-Detection zuerst**: Jede neue Interaktion mit dem Layout-Editor muss optional bleiben (typeof-/in-Checks) und darf bei fehlender API still aussteigen.
- **Idempotenz erzwingen**: Halte `tryRegister`/`unregister` reentrant, indem du Sentinels wie `unregister`-Closures oder Flag-States nutzt.
- **Bound Context**: Wenn Methoden des Plugin-Managers (`on`/`off`) zwischengespeichert werden, müssen sie an den ursprünglichen Kontext gebunden (`bind`) werden, damit Obsidian-internes State-Handling nicht verloren geht.
- **Fehlerlog sichtbar halten**: Catch-Blöcke müssen `console.error` nutzen und die Layout-Editor-ID nennen, damit Support-Fälle im Debug-Log auffindbar sind. Mittel- bis langfristig sind strukturierte Telemetrie und UI-Feedback geplant.
- **Isolierte Teardown-Signatur**: Das Dispose-Callback darf keine zusätzlichen Parameter erwarten. Es wird von `main.ts` direkt in `onunload` durchgereicht.

## Offene Punkte
Anstehende Maßnahmen (typisierte APIs, Telemetrie, Tests) sind im [To-Do: Layout Editor Bridge Review](../../todo/layout-editor-bridge-review.md) dokumentiert.

## Weiterführende Ressourcen
- Lifecycle-Analyse: [`Notes/layout-editor-bridge-review.md`](../../Notes/layout-editor-bridge-review.md)
- Implementierung: [`src/app/layout-editor-bridge.ts`](../../salt-marcher/src/app/layout-editor-bridge.ts)
