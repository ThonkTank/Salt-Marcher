# Presenter reagiert nicht auf Abbruchsignale

## Originalkritik
> `CartographerPresenter` ignoriert das vom Shell-Controller übergebene `ModeSelectContext`/`AbortSignal`. Selbst wenn der Mode-Wechsel vom UI abgebrochen wird, laufen `setMode` und asynchrone Aufräum-/Enter-Schritte weiter und riskieren Race-Conditions.【F:salt-marcher/src/apps/cartographer/presenter.ts†L112-L205】【F:salt-marcher/src/apps/cartographer/view-shell.ts†L77-L119】【F:salt-marcher/src/apps/cartographer/view-shell/mode-controller.ts†L1-L37】

## Kontext
- Module: `salt-marcher/src/apps/cartographer/presenter.ts`, `salt-marcher/src/apps/cartographer/view-shell.ts`, `salt-marcher/src/apps/cartographer/view-shell/mode-controller.ts`.
- Der Presenter koordiniert Mode-Wechsel und ruft `enter`/`exit`-Routinen sequentiell auf.
- Das UI kann Mode-Wechsel abbrechen, der Presenter setzt die Operation dennoch fort.

## Lösungsideen
- `setMode` und begleitende Helfer sollten das übergebene `AbortSignal` prüfen und laufende Arbeiten abbrechen.
- Lifecycle-Hooks (`exit`, `enter`, Cleanup) benötigen Guard-Checks, um Abbruchpfade zu respektieren.
- Ergänzende Tests in `tests/cartographer/presenter.test.ts` sichern den deterministischen Abbruch.
- Dokumentation anpassen (`salt-marcher/docs/cartographer/view-shell-overview.md`), sobald Verhalten korrigiert ist.
