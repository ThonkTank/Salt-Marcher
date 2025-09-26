# Cartographer mode state machine

## Original Finding
> `CartographerPresenter` serialisiert Modewechsel über eine manuell verkettete `modeChange`-Promise; ohne dediziertes Cleanup/Finally-Handling bleibt die Wartbarkeit des Queues fragil, sobald Modi komplexeres Error-Handling benötigen.
>
> **Empfohlene Maßnahme:** Die `modeChange`-Promise durch eine explizite State-Machine mit Fehler-/Finally-Behandlung ersetzen, bevor weitere Modi komplexere Lifecycle-Schritte erfordern.

Quelle: [`docs/architecture-critique.md`](../docs/architecture-critique.md).

## Kontext
- **Betroffene Module:** `salt-marcher/src/apps/cartographer/presenter.ts`.
- **Auswirkung:** Fehler während `exit`/`enter` können die Queue in inkonsistentem Zustand hinterlassen; nachfolgende Wechsel hängen oder überspringen Cleanup.
- **Risiko:** Speicherlecks durch nie aufgeräumte Controller, UI die im falschen Modus bleibt, schwer debugbare Race-Conditions.

## Lösungsansätze
1. Modellieren Sie eine explizite State-Machine mit Zuständen (`idle`, `switching`, `cancelling`, `failed`) und klaren Übergängen.
2. Erfasse Fehlerpfade in `finally`/`catch`-Blöcken und stelle sicher, dass Cleanup selbst bei Abbrüchen vollständig läuft.
3. Instrumentiere Telemetrie/Debug-Logs, um Modewechsel und Abbrüche nachzuverfolgen; ergänze Tests für parallele Wechselversuche.

## Referenzen
- Mode-Queue: [`salt-marcher/src/apps/cartographer/presenter.ts`](../salt-marcher/src/apps/cartographer/presenter.ts)
