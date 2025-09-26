# Cartographer Presenter – Lifecycle & Abort-Verhalten

## Strukturdiagramm
```
src/apps/cartographer/
├─ presenter.ts
├─ view-shell/
│  └─ mode-controller.ts
└─ modes/
   ├─ editor.ts
   ├─ inspector.ts
   └─ travel-guide.ts
```

- **`presenter.ts`** – State-Machine für Modewechsel, Dateiladen und Map-Rendering. Koordiniert Shell-Updates, Layer-Aufbau und Mode-Hooks.
- **`view-shell/mode-controller.ts`** – Liefert `AbortSignal`-gekoppelte Mode-Wechselanforderungen der UI an den Presenter.
- **`modes/*`** – Konkrete Mode-Implementierungen, die Lifecycle-Hooks konsumieren und UI/Map-spezifische Logik kapseln.

Weitere Dokumente: [view-shell-overview.md](view-shell-overview.md) für Shell-Details, [map-layer-overview.md](map-layer-overview.md) für Render-Pipeline.

## Lifecycle & Abort-Signale

Der Presenter erzeugt für jeden Modewechsel einen eigenen `AbortController`. Dessen Signal wird an alle Lifecycle-Schritte (`onExit`, `onEnter`, `onFileChange`, optionale Hooks) weitergereicht und ersetzt das bisherige, signal-lose Kontextobjekt.【F:salt-marcher/src/apps/cartographer/presenter.ts†L24-L56】【F:salt-marcher/src/apps/cartographer/presenter.ts†L510-L663】 Gleichzeitig verknüpft der Presenter externe UI-Abbrüche (`ModeSelectContext.signal`) mit seinem Controller, so dass sowohl Benutzer-Abbrüche als auch supersedierende Wechsel laufende Aufgaben stoppen.【F:salt-marcher/src/apps/cartographer/presenter.ts†L443-L474】

Jeder Hook erhält ein `CartographerModeLifecycleContext`, das alle bisherigen Getter (`getFile`, `getMapLayer`, `getOptions` …) plus `ctx.signal` bereitstellt. Für jeden aktiven Modus wird genau ein Kontextobjekt erzeugt, zwischengespeichert und an sämtliche Hooks (inklusive `onExit`) weitergereicht. Auf dem Exit-Pfad ist derselbe Verweis garantiert, wobei `ctx.signal.aborted` bereits auf `true` gesetzt ist.【F:salt-marcher/src/apps/cartographer/presenter.ts†L245-L278】【F:salt-marcher/src/apps/cartographer/presenter.ts†L510-L663】

Die View-Shell liefert weiterhin pro Modewechsel ein `AbortSignal`, der Mode-Controller kapselt aber nun auch Aufräumlogik für parallele Requests. Bereits laufende Wechsel werden deterministisch abgebrochen, bevor ein neuer `onSwitch`-Callback startet.【F:salt-marcher/src/apps/cartographer/view-shell/mode-controller.ts†L1-L52】

## Garantierter Lifecycle-Vertrag

1. **`onEnter` → `onFileChange`:** Direkt nach einem erfolgreichen `onEnter` ruft der Presenter `onFileChange` mit demselben Kontextobjekt auf. Spätere Refreshes und Map-Updates nutzen solange denselben Verweis, bis der Modus verlassen wird.【F:salt-marcher/src/apps/cartographer/presenter.ts†L360-L561】
2. **Optionale Hooks:** `onHexClick` und `onSave` erhalten das identische Kontextobjekt, sofern sie vom Modus implementiert werden. Der Lazy-Wrapper validiert optional implementierte Hooks und reicht Argumente typsicher weiter.【F:salt-marcher/src/apps/cartographer/mode-registry/registry.ts†L121-L183】
3. **Capability-gesteuerte Hooks:** Der Presenter prüft `metadata.capabilities` und ruft `onSave` nur bei `persistence = "manual-save"`, `onHexClick` nur bei `mapInteraction = "hex-click"` auf. Dadurch lassen sich Modi bewusst als read-only markieren.【F:salt-marcher/src/apps/cartographer/presenter.ts†L334-L357】【F:salt-marcher/tests/cartographer/presenter.test.ts†L445-L520】
4. **`onExit`:** Beim Verlassen des Modus liefert der Presenter erneut denselben Kontext. Das `AbortSignal` wurde bis dahin abgebrochen, sodass Aufräumlogik deterministisch erkennen kann, dass keine weiteren Updates mehr folgen.【F:salt-marcher/src/apps/cartographer/presenter.ts†L510-L663】
5. **Wrapper-Garantie:** Drittanbieter, die über die Registry integrieren, erhalten garantiert dieselbe Signatur wie die Kernmodi. Fehlende Parameter fallen bereits beim Kompilieren auf, weil der Wrapper Methodenaufrufe streng typisiert.【F:salt-marcher/src/apps/cartographer/mode-registry/registry.ts†L37-L325】

## Aufräum- & Idempotenz-Regeln

- **Presenter-Seite:** Beim Start eines neuen Wechsels wird der vorherige Lifecycle-Controller abgebrochen, bevor `onExit` des bisherigen Modus ausgeführt wird. Nach Abschluss (oder Abbruch) setzt der Presenter den Controller sauber zurück und verhindert verspätete Shell-Updates.【F:salt-marcher/src/apps/cartographer/presenter.ts†L510-L663】 Ebenso werden Map-Layer-Aufbauten an das aktive Signal gekoppelt; verspätete Layer werden zerstört, bevor sie sichtbar werden.【F:salt-marcher/src/apps/cartographer/presenter.ts†L665-L731】
- **Mode-Seite:** Alle integrierten Modi prüfen `ctx.signal.aborted` und beenden langlaufende Aufgaben sofort. Sie räumen UI-Elemente, Tool-Instanzen oder Travel-spezifische Controller idempotent auf, selbst wenn das Signal bereits abgebrochen wurde.【F:salt-marcher/src/apps/cartographer/modes/editor.ts†L12-L120】【F:salt-marcher/src/apps/cartographer/modes/inspector.ts†L12-L130】【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L1-L220】

## Leitlinien für Mode-Autor:innen

1. **Signal beachten:** Jeder Lifecycle-Hook erhält `ctx.signal`. Prüfe zu Beginn sowie nach jedem `await`, ob `ctx.signal.aborted` gesetzt ist, und brich weitere Arbeit ab. Nutze das Signal auch in Timeout-/Event-Handlern, bevor du UI oder Map veränderst.
2. **Aufräumen kapseln:** Sammle Teardown-Schritte in eigenen Hilfsfunktionen, so dass sie sowohl beim regulären `onExit` als auch beim Abort-Callback sicher mehrfach aufgerufen werden können (siehe Travel-Mode-`abortLifecycle`).【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L18-L146】
3. **Keine verspäteten Updates:** Setze Shell- oder Map-Zustände nur, solange `ctx.signal` aktiv ist. Nach einem Abort darf kein UI-Update mehr durchgeführt werden (Tests stellen sicher, dass verspätete Aktualisierungen ausbleiben).【F:salt-marcher/tests/cartographer/presenter.test.ts†L290-L360】
4. **Tests erweitern:** Bei neuen Modi unbedingt Vitest-Coverage ergänzen, die Abbruchpfade simuliert. Verwende `createDeferred` oder ähnliche Helfer, um langsame Hooks nachzustellen und das konsistente Verhalten zu verifizieren.【F:salt-marcher/tests/cartographer/presenter.test.ts†L262-L360】

## Tests & Qualitätssicherung

- **Unit-Tests:** `salt-marcher/tests/cartographer/presenter.test.ts` enthält Regressionstests für Mode-Wechsel, Signal-Kaskadierung und Layer-Aufräumverhalten. Neue Tests decken langsame Hooks und UI-Konsistenz nach Abbrüchen ab.【F:salt-marcher/tests/cartographer/presenter.test.ts†L40-L360】
- **Manuelle QA:** Beim Testen in Obsidian sollte während schneller Modewechsel geprüft werden, dass Sidebar/Map nicht „flackern“ und abgebrochene Modi keine DOM-Reste zurücklassen. Verwende DevTools, um auf abgebrochene Netzwerk-/Render-Aufgaben zu achten.

## Standards & Konventionen

- Lifecycle-Hooks in Modi sind **async-safe** zu halten: Jedes `await` braucht eine anschließende Signal-Prüfung.
- Cleanup-Funktionen (`cleanupFile`, `abortLifecycle` etc.) müssen mehrfach aufrufbar sein, ohne Exceptions zu werfen.
- Tests nutzen `createDeferred` (siehe oben) statt `setTimeout`, um deterministische Abbruchpfade zu validieren.
- Dokumentiere neue Hooks oder Kontext-Erweiterungen hier sowie im passenden Mode-Dokument, damit Autor:innen immer die aktuelle Referenz besitzen.
