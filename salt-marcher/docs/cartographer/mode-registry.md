# Cartographer Mode Registry

## Struktur & Zweck

```
src/apps/cartographer/mode-registry/
├─ index.ts                # Öffentliche Registry-API + Kern-Provider-Bootstrap
├─ registry.ts             # Interne Registrierungslogik, Sortierung, Lazy-Wrapping
└─ providers/
   ├─ editor.ts            # Provider-Deklaration für den Editor-Modus
   ├─ inspector.ts         # Provider-Deklaration für den Inspector-Modus
   └─ travel-guide.ts      # Provider-Deklaration für den Travel-Guide-Modus
```

Ergänzende Tests liegen in [`tests/cartographer/mode-registry.test.ts`](../../tests/cartographer/mode-registry.test.ts) und sichern das Registrierungsverhalten ab. Die Registry verwaltet deklarative Provider, kapselt Lazy Loading und stellt dem Presenter eine sortierte, fehlertolerante Modusliste zur Verfügung.

## Registrierungsprotokoll

1. **Provider deklarieren:** Exportiere ein Objekt vom Typ `CartographerModeProvider` mit Metadaten und einer `load()`-Funktion.
2. **Registrieren:** Rufe `registerModeProvider(provider)` oder `registerCartographerModeProvider(provider)` (direkt aus `registry.ts`) auf. Die Funktion liefert ein Dispose-Handle (`() => void`).
3. **Konflikte:** Doppelregistrierungen mit identischer `metadata.id` werden mit einer aussagekräftigen Fehlermeldung abgelehnt.
4. **Deregistrieren:** Nutze das Dispose-Handle oder `unregisterModeProvider(id)`, um einen Provider zu entfernen.
5. **Snapshots erstellen:**
   - `provideCartographerModeEntries()` registriert Kern-Provider und liefert `CartographerModeRegistryEntry[]` (inkl. Metadaten & Capabilities).
   - `provideCartographerModes()` bleibt als Convenience-Wrapper erhalten und gibt nur die `mode`-Instanzen zurück.
   - `createCartographerModeRegistrySnapshot()` arbeitet auf dem aktuellen Zustand, ohne Kern-Provider automatisch nachzuladen (für Tests & Tools).
   - `createCartographerModesSnapshot()` gibt weiterhin lediglich die `CartographerMode`-Wrapper aus.
6. **Reset:** `resetCartographerModeRegistry({ registerCoreProviders })` leert die Registry und registriert Kernmodi optional neu (`true` ist Standard).

## Metadaten-Schema

| Feld        | Typ                  | Pflicht | Beschreibung |
|-------------|----------------------|---------|--------------|
| `id`        | `string`              | ✅       | Eindeutiger, stabiler Identifier (UI & Persistenz). |
| `label`     | `string`              | ✅       | Nutzerfreundlicher Anzeigename. |
| `summary`   | `string`              | ✅       | Kurzbeschreibung (Tooltips, Docs). |
| `keywords`  | `readonly string[]`   | ❌       | Suchbegriffe für Filter & Suche. |
| `order`     | `number`              | ❌       | Sortier-Priorität (kleiner = weiter oben). |
| `source`    | `string`              | ✅       | Herkunft (z. B. `core/cartographer/editor` oder Plugin-ID). |
| `version`   | `string`              | ❌       | Version des Providers (SemVer empfohlen). |
| `capabilities` | `{ mapInteraction: "none" \| "hex-click"; persistence: "read-only" \| "manual-save"; sidebar: "required" \| "optional" \| "hidden" }` | ✅ | Deklariert Interaktions- & Persistenzfähigkeiten. Steuert u. a. Hex-Click-Weiterleitung und Save-Schaltflächen. |

Metadaten werden beim Registrieren defensiv geklont und eingefroren, damit Konsumenten stabile Referenzen erhalten.

## Capabilities & Typed Provider-API

- **`mapInteraction`** – Steuert, ob der Presenter Hex-Klicks an den Modus weiterleitet (`"hex-click"`) oder sie vollständig ignoriert (`"none"`).
- **`persistence`** – Deklariert, ob der Modus eigene Speicherlogik bereitstellt (`"manual-save"`). Nur dann wird `onSave()` aufgerufen und die Map-Header-Schaltfläche aktiv.【F:salt-marcher/src/apps/cartographer/presenter.ts†L334-L357】
- **`sidebar`** – Kennzeichnet den Bedarf an Sidebar-Fläche (`"required"`, `"optional"`, `"hidden"`). Aktuell dient die Information als Dokumentation, künftig kann die Shell Sidebar-Flächen dynamisch ein-/ausblenden.

Provider sollten über `defineCartographerModeProvider()` registriert werden. Die Hilfsfunktion leitet aus den Metadaten die Typparameter ab, sodass TypeScript bei Inkonsistenzen (z. B. `manual-save` ohne `onSave`) bereits zur Compile-Zeit warnt.【F:salt-marcher/src/apps/cartographer/mode-registry/registry.ts†L37-L44】

> **Hinweis:** Die Registry erzwingt die Capability-Verträge zusätzlich zur Laufzeit. Missmatches lösen Exceptions aus und verhindern, dass defekte Provider die UI in instabile Zustände versetzen.【F:salt-marcher/src/apps/cartographer/mode-registry/registry.ts†L121-L183】

## Lazy Loading & Fehlerbehandlung

- Provider laden ihren Modus erst, wenn eine Lifecycle-Funktion (`onEnter`, `onFileChange`, …) aufgerufen wird.
- Fehlschläge beim Laden werden geloggt (`console.error`) und an den Aufrufer propagiert.
- Optional implementierte Hooks (`onHexClick`, `onSave`) werden nur aufgerufen, wenn der geladene Modus sie anbietet.
- Capability-Validierung: Deklariert ein Provider `persistence = "manual-save"`, muss der Modus `onSave()` implementieren; bei `mapInteraction = "hex-click"` ist `onHexClick()` Pflicht. Verstöße lösen Exceptions aus und verhindern fehlerhafte Integrationen.【F:salt-marcher/src/apps/cartographer/mode-registry/registry.ts†L121-L183】
- Ein Abgleich stellt sicher, dass die Mode-ID mit der Provider-ID übereinstimmt; Abweichungen werden als Warnung geloggt.
- Der Lazy-Wrapper reicht den vollständigen `CartographerModeLifecycleContext` (inkl. `AbortSignal`) an jeden Hook weiter und behält typsichere Signaturen bei.【F:salt-marcher/src/apps/cartographer/mode-registry/registry.ts†L185-L325】

## Beobachtung & UI-Synchronisation

- `subscribeToModeRegistry(listener)` stellt ein Observable über den Registry-Zustand bereit. Jeder Listener erhält sofort ein `initial`-Event mit allen aktuell bekannten Modi (inklusive Kern-Providern) und im weiteren Verlauf gezielte `registered`-, `deregistered`- und `reset`-Events.【F:salt-marcher/src/apps/cartographer/mode-registry/registry.ts†L62-L96】【F:salt-marcher/src/apps/cartographer/mode-registry/index.ts†L29-L89】
- Event-Nutzlasten kombinieren Metadaten und lazy-gekapselte `CartographerMode`-Instanzen, sodass Konsumenten direkt mit stabilen Objekten weiterarbeiten können.
- Der `CartographerPresenter` abonniert die Registry dauerhaft, aktualisiert seine interne Modusliste und synchronisiert die View-Shell inkrementell über `registerMode`, `deregisterMode` und `setModes`. Änderungen an Drittanbieter-Providern tauchen daher ohne Reload im Dropdown auf.【F:salt-marcher/src/apps/cartographer/presenter.ts†L102-L198】【F:salt-marcher/src/apps/cartographer/presenter.ts†L362-L418】
- Capability-Updates wirken sofort: Der Presenter speichert die Metadaten pro Modus und ignoriert `onSave`/`onHexClick`, wenn ein Provider `persistence = "read-only"` bzw. `mapInteraction = "none"` deklariert.【F:salt-marcher/src/apps/cartographer/presenter.ts†L334-L357】【F:salt-marcher/tests/cartographer/presenter.test.ts†L445-L520】
- Wird der aktive Modus deregistriert, stößt der Presenter automatisch einen Fallback auf den zuerst verfügbaren Modus an – inklusive Lifecycle-Aufräumen und UI-Update der Shell.【F:salt-marcher/src/apps/cartographer/presenter.ts†L407-L416】

## Migration für Drittanbieter-Modi

1. **Metadaten & Capabilities definieren:** Wähle eine stabile `id`, sprechenden `label`, aussagekräftige `summary`, ordne `source` (z. B. deine Plugin-ID) zu und setze `capabilities` bewusst. Typische Zuordnungen: Hex-interaktive Modi ⇒ `mapInteraction: "hex-click"`, reine Viewer ⇒ `"none"`; Schreibzugriffe ⇒ `persistence: "manual-save"`.
2. **Provider erstellen:** Kapsle deine bisherige Fabrik in eine `load()`-Funktion und übergib alles an `defineCartographerModeProvider({ metadata, load })`. Empfohlen: dynamischer Import (`await import(...)`) für echtes Lazy Loading.
3. **Registrieren:** Im Plugin-Setup `registerModeProvider(provider)` aufrufen und das Dispose-Handle speichern.
4. **Aufräumen:** Im Plugin-Teardown Dispose-Handle aus Schritt 3 aufrufen oder `unregisterModeProvider(id)` verwenden.
5. **Tests & Qualität:** Validiere dein Registrierungsverhalten mit einer Variante der vorhandenen Vitest-Cases. Nutze `resetCartographerModeRegistry({ registerCoreProviders: false })`, um reproduzierbare Testzustände zu erhalten.

> **Konvention:** Für `source` wird das Schema `namespace/module` empfohlen (`core/cartographer/<name>` für Kernfunktionen, `plugin/<id>/<feature>` für Erweiterungen).

## Extension Workflow (Kurzfassung)

1. **Capability-Mapping festlegen:** Entscheide früh, welche Interaktionen dein Modus tatsächlich benötigt. Reduziere Capabilities, wenn Features (z. B. Hex-Klicks oder Speichern) deaktiviert bleiben sollen.
2. **Modul isolieren:** Implementiere den Modus weiterhin in `modes/<name>.ts` und stelle sicher, dass Lifecycle-Hooks `CartographerModeLifecycleContext` akzeptieren.
3. **Provider definieren:** Verwende `defineCartographerModeProvider({ metadata, load })`, damit TypeScript Capabilities gegen die bereitgestellten Hooks validiert.
4. **Registrieren & Aufräumen:** Registriere den Provider während des Plugin-Setups (`registerModeProvider`) und speichere das Rückgabe-Handle für das Teardown (`dispose()`).
5. **Tests & Dokumentation:** Ergänze Vitest-Cases, die Registrierung, Capabilities und Presenter-Integration abdecken, und verlinke deine Erweiterung in den passenden Modul-Docs.

