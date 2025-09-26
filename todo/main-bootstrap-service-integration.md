# Main Bootstrap Service Integration

## Kontext
Die Integration des neuen `createTerrainBootstrap`-Services in `src/app/main.ts` kollidiert aktuell mit unveröffentlichten Upstream-Anpassungen.
Beim Rebase bleibt unklar, welche Lifecycle-Hooks Vorrang haben sollen, sodass die Änderungen nicht konfliktfrei übernommen werden können.
Damit der Branch mergefähig bleibt, wurde `main.ts` vorerst auf den bisherigen Initialisierungspfad (direkte Aufrufe von `ensureTerrainFile`/`loadTerrains`/`watchTerrains`) zurückgedreht.

## Betroffene Module
- `salt-marcher/src/app/main.ts`
- `salt-marcher/tests/app/main.integration.test.ts`
- `salt-marcher/docs/app/README.md`
- `salt-marcher/src/app/bootstrap-services.ts`

## Aktueller Zustand
- `createTerrainBootstrap` kapselt Priming, Watcher-Registrierung und Logger-Integration. Unit-Tests decken Retry-/Errorpfade ab und schützen die API-Signatur.【F:salt-marcher/src/app/bootstrap-services.ts†L1-L118】【F:salt-marcher/tests/app/terrain-bootstrap.test.ts†L1-L106】
- `main.ts` nutzt weiterhin den Legacy-Pfad (`ensureTerrainFile`/`loadTerrains`/`watchTerrains`) und erhält dadurch keine der erweiterten Telemetrie-Funktionen des Services.【F:salt-marcher/src/app/main.ts†L1-L65】
- Der Integrationstest hält die Umstellung als `it.todo` fest und verifiziert nur den alten Ablauf (direktes Terrain-Priming).【F:salt-marcher/tests/app/main.integration.test.ts†L1-L77】【F:salt-marcher/tests/app/main.integration.test.ts†L107-L108】
- Die Bootstrap-Dokumentation weist noch auf den geplanten Service-Einsatz hin, solange `main.ts` nicht migriert wurde.【F:salt-marcher/docs/app/README.md†L29-L46】

## Risiken & Auswirkungen
- Doppelter Bootstrap-Code (Service vs. Legacy-Pfad) erschwert Wartung und führt zu inkonsistentem Logging.
- `main.ts` überspringt die Watcher-Telemetrie aus `createTerrainBootstrap` (z. B. `onError`-Hook), wodurch Laufzeitfehler nicht dedupliziert geloggt werden.
- Weitere Arbeiten am Bootstrap erhöhen das Konfliktrisiko, solange die Service-Anbindung nicht vereinheitlicht wurde; der Integrationstest bleibt fragmentiert.

## Lösungsideen
1. Git-Historie und Upstream-Änderungen analysieren, um die korrekte Reihenfolge von Plugin-Registrierungen und Terrain-Priming festzulegen.
2. `main.ts` so umstellen, dass der `TerrainBootstrapHandle` die alleinige Quelle für Start/Stop-Logik ist (inkl. Logger-Weitergabe).
3. Integrationstest reaktivieren und auf den Service ausrichten (`start()`/`stop()`-Spies statt Legacy-Mocks).
4. Dokumentation und Release-Notes aktualisieren, damit die neue Verantwortlichkeit transparent bleibt.
5. Beim Umstieg prüfen, ob zusätzliche Bootstrap-Schritte (z. B. Layout-Bridge, CSS) ebenfalls Service-Schnittstellen benötigen, um die Verantwortung klar zu halten.

## Nächste Schritte
- Merge-Konflikte im Team adressieren und gemeinsam entscheiden, wo Logging und Fehlerbehandlung zukünftig leben.
- Nach erfolgreicher Anbindung die Legacy-Terrain-Aufrufe entfernen und Tests auf den Service umstellen.

## Verweise
- Bereichsdoku: [docs/app/README.md](../salt-marcher/docs/app/README.md)
- Integrationstest (Legacy-Pfad + TODO): [tests/app/main.integration.test.ts](../salt-marcher/tests/app/main.integration.test.ts)
