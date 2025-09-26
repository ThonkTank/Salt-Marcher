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
