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
   - `provideCartographerModes()` liefert eine Liste lazy-gekapselter `CartographerMode`-Instanzen (inkl. Kernmodi).
   - `createCartographerModesSnapshot()` arbeitet auf dem aktuellen Registry-Zustand, ohne Kern-Provider automatisch nachzuladen (für Tests & Tools).
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

Metadaten werden beim Registrieren defensiv geklont und eingefroren, damit Konsumenten stabile Referenzen erhalten.

## Lazy Loading & Fehlerbehandlung

- Provider laden ihren Modus erst, wenn eine Lifecycle-Funktion (`onEnter`, `onFileChange`, …) aufgerufen wird.
- Fehlschläge beim Laden werden geloggt (`console.error`) und an den Aufrufer propagiert.
- Optional implementierte Hooks (`onHexClick`, `onSave`) werden nur aufgerufen, wenn der geladene Modus sie anbietet.
- Ein Abgleich stellt sicher, dass die Mode-ID mit der Provider-ID übereinstimmt; Abweichungen werden als Warnung geloggt.

## Migration für Drittanbieter-Modi

1. **Metadaten definieren:** Wähle eine stabile `id`, sprechenden `label`, aussagekräftige `summary`, ordne `source` (z. B. deine Plugin-ID) zu.
2. **Provider erstellen:** Kapsle deine bisherige Fabrik in eine `load()`-Funktion. Empfohlen: dynamischer Import (`await import(...)`) für echtes Lazy Loading.
3. **Registrieren:** Im Plugin-Setup `registerModeProvider(provider)` aufrufen und das Dispose-Handle speichern.
4. **Aufräumen:** Im Plugin-Teardown Dispose-Handle aus Schritt 3 aufrufen oder `unregisterModeProvider(id)` verwenden.
5. **Tests & Qualität:** Validiere dein Registrierungsverhalten mit einer Variante der vorhandenen Vitest-Cases. Nutze `resetCartographerModeRegistry({ registerCoreProviders: false })`, um reproduzierbare Testzustände zu erhalten.

> **Konvention:** Für `source` wird das Schema `namespace/module` empfohlen (`core/cartographer/<name>` für Kernfunktionen, `plugin/<id>/<feature>` für Erweiterungen).

