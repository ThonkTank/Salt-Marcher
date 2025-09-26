# Mode-Queue als robuste State-Machine ausbauen

## Originalkritik
> `CartographerPresenter` serialisiert Modewechsel über eine manuell verkettete `modeChange`-Promise; ohne dediziertes Cleanup/Finally-Handling bleibt die Wartbarkeit des Queues fragil, sobald Modi komplexeres Error-Handling benötigen.【F:salt-marcher/src/apps/cartographer/presenter.ts†L82-L85】【F:salt-marcher/src/apps/cartographer/presenter.ts†L187-L205】

## Kontext
- Module: `salt-marcher/src/apps/cartographer/presenter.ts` (Modewechsel), `salt-marcher/tests/cartographer/presenter.test.ts` (Verhaltensabdeckung).
- Aktuelle Implementierung nutzt Promise-Chaining und manuelle Fehlerbehandlung.
- Fehlende deterministische Zustände erschweren Retry- oder Abbruchpfade.

## Lösungsideen
- Eine explizite State-Machine einführen (z. B. `Idle`/`Switching`/`Error`) mit klaren Transitionen und Cleanup-Hooks.
- Fehler- und Finally-Pfade zentralisieren, sodass Ressourcen garantiert freigegeben werden.
- Tests für konkurrierende Modewechsel und Fehlerfälle erweitern.
- Dokumentation (`salt-marcher/docs/cartographer/view-shell-overview.md`) aktualisieren, sobald das Queue-Modell definiert ist.
