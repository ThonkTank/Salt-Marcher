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

Der Presenter erzeugt für jeden Modewechsel einen eigenen `AbortController`. Dessen Signal wird an alle Lifecycle-Schritte (`onExit`, `onEnter`, `onFileChange`, optionale Hooks) weitergereicht und ersetzt das bisherige, signal-lose Kontextobjekt.【F:salt-marcher/src/apps/cartographer/presenter.ts†L24-L56】【F:salt-marcher/src/apps/cartographer/presenter.ts†L360-L471】 Gleichzeitig verknüpft der Presenter externe UI-Abbrüche (`ModeSelectContext.signal`) mit seinem Controller, so dass sowohl Benutzer-Abbrüche als auch supersedierende Wechsel laufende Aufgaben stoppen.【F:salt-marcher/src/apps/cartographer/presenter.ts†L310-L343】 

Jeder Hook erhält ein `CartographerModeLifecycleContext`, das alle bisherigen Getter (`getFile`, `getMapLayer`, `getOptions` …) plus `ctx.signal` bereitstellt. Der Presenter erstellt das Kontextobjekt pro Aufruf neu, damit eine einmal abgebrochene Transition kein stale Signal weiterreicht.【F:salt-marcher/src/apps/cartographer/presenter.ts†L205-L240】【F:salt-marcher/src/apps/cartographer/presenter.ts†L488-L524】

Die View-Shell liefert weiterhin pro Modewechsel ein `AbortSignal`, der Mode-Controller kapselt aber nun auch Aufräumlogik für parallele Requests. Bereits laufende Wechsel werden deterministisch abgebrochen, bevor ein neuer `onSwitch`-Callback startet.【F:salt-marcher/src/apps/cartographer/view-shell/mode-controller.ts†L1-L52】

## Aufräum- & Idempotenz-Regeln

- **Presenter-Seite:** Beim Start eines neuen Wechsels wird der vorherige Lifecycle-Controller abgebrochen, bevor `onExit` des bisherigen Modus ausgeführt wird. Nach Abschluss (oder Abbruch) setzt der Presenter den Controller sauber zurück und verhindert verspätete Shell-Updates.【F:salt-marcher/src/apps/cartographer/presenter.ts†L360-L486】 Ebenso werden Map-Layer-Aufbauten an das aktive Signal gekoppelt; verspätete Layer werden zerstört, bevor sie sichtbar werden.【F:salt-marcher/src/apps/cartographer/presenter.ts†L508-L561】
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
