# SMR-02 World-Notes-Hostbelege

Diese Kopien sind die unveränderten JSON-Rohbelege der zwei kontrollierten
Obsidian-Fälle aus PR #95. `manifest.json` bindet jeden Dateibytebestand an
SHA-256, Länge und Originalpfad auf Laptop1. Die Originale im isolierten
synthetischen QA-Vault bleiben erhalten. Es wurden keine Screenshots erzeugt.

- `rollback-*`: erster Manifest-CAS scheitert nach dem nativen NPC-Write;
  UI-Fehler, vollständiger Rollback, Retry und frischer Prozess.
- `committed-*`: aus tatsächlichen Before-/After-Bytes der gespeicherten
  Gerücht-Löschung gebildetes Committed-Restjournal; ein frischer Prozess
  validiert und entfernt es vor dem World-Notes-Mount.

Wiederholbare Aufrufe mit jeweils eigenem `DUNGEON_QA_ROOT`:

```sh
node tools/host-test.cjs --world-notes-rollback
node tools/host-test.cjs --world-notes-rollback --restart
node tools/host-test.cjs --world-notes-recovery
node tools/host-test.cjs --world-notes-recovery --restart
```

Die beiden Fälle belegen kontrollierte Fehler und Restjournalbehandlung im
echten Host. [Stadts unabhängiger R02](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/95#pullrequestreview-5481505362)
bestätigt die portablen Rohbelege und diese beiden Fälle auf PR #95/`575ca65`.
Die ursprünglichen Prüfcheckouts waren dirty; ein physischer Absturz,
Stromausfall, breitere Recovery und Gesamt-SMR-02 sind damit nicht belegt.
