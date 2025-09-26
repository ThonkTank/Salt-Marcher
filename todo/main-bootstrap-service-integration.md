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
- `createTerrainBootstrap` steht als Service-Grenze bereit und wird bereits von Unit-Tests abgedeckt, ist aber im Plugin-Einstieg noch nicht angebunden.
- Der Integrationstest markiert die offene Service-Anbindung als `it.todo`, prüft aber weiterhin den Legacy-Pfad (direktes Terrain-Priming).
- Die Bootstrap-Dokumentation beschreibt den geplanten Service-Einsatz; ein Hinweis auf dieses To-Do wurde ergänzt.

## Risiken & Auswirkungen
- Doppelter Bootstrap-Code (Service vs. Legacy-Pfad) erschwert Wartung und führt zu inkonsistentem Logging.
- Fehlerbehandlung (Warnungen bei fehlgeschlagenem Priming) liegt wieder direkt in `main.ts`, wodurch Tests nur den Legacy-Fall sichern.
- Weitere Arbeiten am Bootstrap erhöhen das Konfliktrisiko, solange die Service-Anbindung nicht vereinheitlicht wurde.

## Lösungsideen
1. Git-Historie und Upstream-Änderungen analysieren, um die korrekte Reihenfolge von Plugin-Registrierungen und Terrain-Priming festzulegen.
2. `main.ts` so umstellen, dass der `TerrainBootstrapHandle` die alleinige Quelle für Start/Stop-Logik ist (inkl. Logger-Weitergabe).
3. Integrationstest reaktivieren und auf den Service ausrichten (`start()`/`stop()`-Spies statt Legacy-Mocks).
4. Dokumentation und Release-Notes aktualisieren, damit die neue Verantwortlichkeit transparent bleibt.

## Nächste Schritte
- Merge-Konflikte im Team adressieren und gemeinsam entscheiden, wo Logging und Fehlerbehandlung zukünftig leben.
- Nach erfolgreicher Anbindung die Legacy-Terrain-Aufrufe entfernen und Tests auf den Service umstellen.

## Verweise
- Bereichsdoku: [docs/app/README.md](../salt-marcher/docs/app/README.md)
- Integrationstest (Legacy-Pfad + TODO): [tests/app/main.integration.test.ts](../salt-marcher/tests/app/main.integration.test.ts)
