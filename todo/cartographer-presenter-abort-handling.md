# Cartographer presenter respects abort signals

## Original Finding
> `CartographerPresenter` ignoriert das vom Shell-Controller übergebene `ModeSelectContext`/`AbortSignal`. Selbst wenn der Mode-Wechsel vom UI abgebrochen wird, laufen `setMode` und asynchrone Aufräum-/Enter-Schritte weiter und riskieren Race-Conditions.
>
> **Empfohlene Maßnahme:** `CartographerPresenter.setMode` sollte das `ModeSelectContext`-Signal respektieren, um abgebrochene Modewechsel deterministisch zu stoppen.

Quelle: [`architecture-critique.md`](../architecture-critique.md).

## Kontext
- **Betroffene Module:** `salt-marcher/src/apps/cartographer/presenter.ts`, `salt-marcher/src/apps/cartographer/view-shell.ts`, `salt-marcher/src/apps/cartographer/view-shell/mode-controller.ts`.
- **Auswirkung:** Asynchrone Wechsel laufen trotz UI-Abbruch weiter; UI und Presenter können divergierende Modi anzeigen, Cleanup läuft doppelt.
- **Risiko:** Race-Conditions bei schnellen Wechseln, Zombie-Controller die auf bereits zerstörte Views zugreifen.

## Lösungsansätze
1. Reiche `AbortSignal` und Kontext vom Mode-Controller durch `setMode` bis in jede Lifecycle-Phase (`exit`, `enter`).
2. Brich laufende `modeChange`-Operationen kontrolliert ab, sobald `signal.aborted` gesetzt ist; stelle sicher, dass Cleanup-Pfade idempotent sind.
3. Ergänze Vitest-Szenarien, die einen Abbruch während `enter` simulieren und sicherstellen, dass keine verspäteten UI-Updates erfolgen.

## Referenzen
- Presenter-Implementierung: [`salt-marcher/src/apps/cartographer/presenter.ts`](../salt-marcher/src/apps/cartographer/presenter.ts)
- View-Shell und Mode-Controller: [`salt-marcher/src/apps/cartographer/view-shell.ts`](../salt-marcher/src/apps/cartographer/view-shell.ts), [`salt-marcher/src/apps/cartographer/view-shell/mode-controller.ts`](../salt-marcher/src/apps/cartographer/view-shell/mode-controller.ts)

## Status-Quo-Analyse (2024-05-06)
- `CartographerPresenter.setMode` reicht das vom Mode-Controller erzeugte `AbortSignal` inzwischen an `executeModeTransition` weiter. Dort wird ein dedizierter `AbortController` mit dem externen Signal verknüpft (`bindExternalAbort`) und bei jedem Schritt (`runTransitionStep`) geprüft.
- Die Transition-State-Maschine (`ModeTransition`) erzwingt serielles Abarbeiten, indem vorherige Transitionen abgebrochen und als erledigt markiert werden (`transitionTasks`/`modeChange`).
- `renderMap` synchronisiert mit der Transition und verhindert verspätete UI-Updates, solange `isTransitionAborted` true liefert. Dadurch werden Layer-Aufbau und `onFileChange`-Hooks nicht mehr nachträglich ausgeführt, sobald ein Abort erkannt wird.
- Schwachstelle: Die Mode-Lifecycle-Hooks (`onExit`, `onEnter`, `onFileChange`) erhalten weiterhin keinen Zugriff auf das `AbortSignal`. Langlaufende async-Operationen in den Modi laufen daher trotz Abort zu Ende; der Presenter kann sie nur nach Abschluss ignorieren.
- Der `ModeController` im View-Layer erzeugt pro Wechsel eine frische `AbortController`-Instanz, ruft `abort()` bei neuen Requests und unterdrückt Fehler, solange der Abort intentional war. Das UI selbst reagiert also korrekt auf Benutzerabbrüche.

## Offene Fragen & Testideen
- Wie verhalten sich existierende Modi (Travel Guide, Editor, Inspector), falls deren `onEnter` oder `onFileChange` parallel I/O betreiben? Blockiert ein Abbruch den UI-Thread spürbar?
- Müssen wir das Mode-Interface erweitern (z. B. `onEnter(ctx, signal)`), oder reicht es, das Signal über den bestehenden Kontext verfügbar zu machen?
- Benötigen wir zusätzliche Guards im Presenter, um den Aufruf von `previous.onExit()` vorzeitig abzubrechen, falls der vorherige Mode gerade im Exit hängt?
- Tests: Simulationsmodus, der in `onEnter` ein `setTimeout`/`delay` nutzt und dann via Controller abgebrochen wird – Erwartung: Kein `setModeLabel`-Flip-Flop, kein verspätetes `onFileChange`.

## Maßnahmenplan (Priorität ↓)
1. **P0 – Abbruchverhalten verifizieren** (Owner: Cartographer-Frontend-Team)
   - Automatisierten Vitest ergänzen, der einen künstlich langsamen Mode registriert und während `onEnter` einen neuen Modewechsel triggert.
   - Erwartete Assertions: `onEnter` wird nicht abgeschlossen, `CartographerPresenter` kehrt sauber zurück, keine verspäteten State-Updates (`shell.setModeActive`, `onFileChange`).
   - Recherche: Prüfen, ob vorhandene Test-Utilities Mode-Registrierung erlauben oder ob ein spezieller Testdouble benötigt wird.
2. **P1 – Abort-Signal in Mode-Kontext integrieren** (Owner: Architektur & API-Design)
   - Entscheidung treffen, ob das bestehende `CartographerModeContext` um ein `getAbortSignal()` erweitert oder das Mode-Interface signaturseitig angepasst wird.
   - Kompatibilität der bestehenden Modi bewerten; nötigenfalls Migration-Plan dokumentieren.
   - Dokumentation im Modul-README ergänzen, sobald die API erweitert wird.
3. **P2 – Cleanup-Sicherheit prüfen** (Owner: Cartographer-Frontend-Team)
   - Code-Review auf doppelte/dauerhafte Side-Effects in `onExit`/`onEnter` durchführen; falls idempotente Patterns fehlen, Guidelines im Moduldokument festhalten.
   - Optionale Ergänzung: Logging/Telemetry für abgebrochene Transitionen, um Feldfeedback zu sammeln.
