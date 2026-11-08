# Aktueller Stand

Stand: 8. November 2026. Atlas V7 bleibt der reguläre Produkteinstieg mit
Dateiformat 22; der optionale Electron-/Pixi-Höheneditor verwendet Format 24.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten und [Produktvertrag](../product-contract.md) Verhalten und Grenzen.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.

## Ergebnis und Auftragsgrenze

Das begrenzte [Konsolidierungspaket K1–K6](atlas-rebuild-plan.md#aktueller-auftrag-p0-konsolidierung-k1k6)
ist implementiert und am sauberen Produktbuild funktional geprüft. Die bestehenden
Grenzen und Fehlerkontrollen bleiben erhalten. **Die native Leistungsabnahme bleibt
offen.** Der vollständige F01–F19-Ausbau P1–P9 ist weiterhin an das P0-Gate gebunden.

| Paket                  | Ergebnis                                                                                                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1 Lebenszyklus        | Neu/Öffnen/natives Schließen schließen dieselbe lokale Geste ab und warten alle angenommenen Writes ab. Save/Discard/Cancel beurteilt den vollständigen lokalen Stand. Fehler und Abbruch erhalten das Dokument.                       |
| K2 Schreibfehler       | Dauerhafter sichtbarer Persistenzfehler; erhaltene ChangeSets werden erst nach Session-/Sequenzabgleich über denselben idempotenten Transaktionspfad wiederholt. Verlorene Bestätigungen führen nicht zu doppelten Änderungen.         |
| K3 Nativer Nachweisweg | Explizites Referenzprofil, Umgebungsabgleich, kleine Traceprobe und Vorprüfung vor Fixtures. Fehlende Präsentationszuordnung bleibt ein eigener Implementierungsblocker; auch eine qualifizierte Referenz umgeht ihn nicht.            |
| K4 CI/Paket            | Echter Normalstart, Rendererhänger und Dateilebenszyklus sind Teil des bestehenden Aggregatchecks. Ein separater Schritt baut und startet das P0-Paket. Die Laufzeit-Allowlist schließt das Archiv auch im vollständigen Checkout aus. |
| K5 Bereinigung         | Tote Quellen-/Snapshot-/JSON-APIs samt Spiegeltests entfernt. Auswertertypen kommen direkt aus geprüftem JavaScript/JSDoc. Bestehende Dokumente gekürzt und nach Zuständigkeit geordnet.                                               |
| K6 Großpinsel          | Eingabe→Modell→Dispatch→Worker→Rückweg→Upload→Submit getrennt beobachtet. Nachrichtenlaufzeit ist in der kurzen Probe klein; Workerarbeit und Framewarten überwiegen. Kein belastbar begründeter weiterer Renderumbau.                 |

Lokale Freigabe, zeitabhängige Höhengesten, numerische Übersichten, der begrenzte
Rasterdispatcher und Reads während Save bleiben die Grundlage. Es gibt keinen
zusätzlichen Worker, keine zweite Render-/Commitstrecke und keine abgesenkten Zeitziele.

## Funktionsnachweise

Die Desktopläufe verwenden den sauberen Build von `cc4a6cbfa6c4b09f96452ea9d3757c0d3559d517`
mit `dirty: false`. Sein Produktquellhash ist
`3a44a2a75c05f8f8a1e81425c7b7b60796f213569b4a08f28a684afb7b2810d4`;
der Lockhash ist `b471b4a1da63f4226f95a28b60f3345aa03e51803f0ef1982624cd16a2d35bc2`.
Der veröffentlichte [Implementierungscommit](https://github.com/ThonkTank/Salt-Marcher/commit/b2f09f0ef56ed45f4b41bd9f886ae3f95b0f06f5)
hat exakt denselben Git-Baum wie dieser lokale Buildcommit. Nachfolgende
Berichts-/Dokumentationskorrekturen ändern diese Produktquellen nicht.

| Prüfung                                                | Ergebnis                                                                                                                                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Produkt-TypeScript und Auswerter-CheckJs               | Bestanden; Produkt bleibt strikt typgeprüft.                                                                                                                                                 |
| Modell, Renderer, Controller, Auswerter und Vorprüfung | 234 P0-Tests bestanden, einschließlich negativer Profil-/Zeit-/Inhaltsfälle.                                                                                                                 |
| SQLite-/Utility-Dispatcher und Skalierungsfixtures     | 15 Tests bestanden, einschließlich geordnetem Commit, idempotenter Wiederholung, Save exakt S und Reads während Snapshot.                                                                    |
| Neuer Desktop-Smoke auf sauberem Build                 | 83 Checks bestanden: 13 Normalstart, 19 echte Hängerprüfungen und 51 Lifecyclechecks in 13 Datei-/Schließfällen.                                                                             |
| Navigation und Coastworkflow                           | 16 Checks und fünf Fehlerkontrollen bestanden; absichtlich falsche Darstellung fällt durch, anschließende Erholung besteht.                                                                  |
| 32 / 1.024 / 9.000 reale Autorenquellen                | Alle drei Rundläufe bestanden: grobe Bearbeitung, geschützte Feindaten, Detailrückkehr, History, Save und Prozessneustart.                                                                   |
| Tatsächliches Forge-Paket                              | 130 ASAR-Einträge geprüft, native SQLite vorhanden, keine unerlaubten/fehlenden Dateien. Keine der 2.289 Archivdateien wäre enthalten. Echter Paketstart ohne Diagnose: 13 Checks bestanden. |
| Native Vorprüfung in dieser Umgebung                   | Exit 2, `BLOCKED`, keine Fixtures: `NO_NATIVE_DISPLAY` und `NATIVE_PRESENTATION_ADAPTER_UNIMPLEMENTED` bleiben getrennt sichtbar.                                                            |

Der Lifecycle-Smoke umfasst aktive Geste, zwei lokal ausstehende Writes und vor
Commit abgewiesene Writes jeweils mit Save/Discard/Cancel. Er prüft außerdem
verlorene Bestätigung ohne Doppelcommit, dauerhaften Fehler und Neu/Öffnen.
Beim echten 500-ms-Hänger wird nach Loslassen nichts nachgeholt; weitergehaltene
Gesten nehmen nur begrenzte Zeit an und wirken danach nachweisbar weiter.

## Großpinsel: Befund und Grenze

Drei unabhängige kurze Proben von `M03-height-large`, jeweils ein Strich,
Electron 44.10.2, 1.440 × 960, DPR 1, ANGLE/SwiftShader:

| Probe | Edit→Submit-p95 | Inhalt, Live-Verlauf und Undo |
| ----- | --------------- | ----------------------------- |
| 1     | 43,2 ms         | Bestanden                     |
| 2     | 47,1 ms         | Bestanden                     |
| 3     | 36,4 ms         | Bestanden                     |

Dies sind Submission-Proxies mit wenigen Eingaben, keine native Präsentation und
keine belastbare allgemeine p95-Verteilung. Die frühere Überschreitung
(54,3 / 68,7 / 50,0 ms) wurde in dieser kleinen Gegenprobe nicht reproduziert;
eine verlässliche Behebung ist damit nicht nachgewiesen.

Sieben angenommene Mausinputs lassen sich vollständig bis zum passenden lokalen
Submit zerlegen. Ein weiterer Pfad bleibt wegen widersprüchlicher Reihenfolge
zweier Worker-Uhrstempel um 0,000244 ms ausdrücklich unvollständig. Die Diagnose
ersetzt weder die vollständigen Eingabeprüfungen noch alle reinen Halteintervalle.
In den vollständig zugeordneten Pfaden benötigen Dispatch→Worker 0–0,2 ms und
Rückweg 0–2,5 ms, Workerarbeit 7,6–21,1 ms, Antwort→Upload 2,6–18,8 ms sowie
Upload→Submit 0,6–1,0 ms. Eingabe→Modell trägt weitere 3,7–15,2 ms bei.

Damit ist ein zusätzlicher Nachrichten-/Workerpfad nicht begründet. Workerarbeit
und Framewarten erklären die größeren Zeitanteile dieser Probe; sie belegen noch
keinen dominierenden, sicher behebbaren Fehler des vollständigen Lastfalls.
Der gemeinsame RAF-Veröffentlichungsweg bleibt erhalten. Die Sammlung meldet
`scopePassed: true`, insgesamt aber korrekt `BLOCKED` wegen Teilumfang und
fehlender nativer Nachweise.

## CI, Belege und nächste Grenze

Der zentrale Check heißt unverändert `Candidate · exact-SHA aggregate`.
Er prüft den veröffentlichten PR-Head einschließlich V7-/Rust-Verträgen,
Clippy, Format, Browserfällen, P0-Smoke und beiden Paketpfaden. Maßgeblich ist
sein Ergebnis an den [aktuellen PR-Checks](https://github.com/ThonkTank/Salt-Marcher/pull/1469/checks).
Lokal fehlen `cargo` und `rpmbuild`: Der Gesamt-Vitestlauf scheitert deshalb an
der Rust-gestützten V7-Vertragssuite, nicht an einem P0-Test. Die Rust-gestützten Pflichtprüfungen bleiben deshalb im CI-Gate erhalten.

Rohbelege liegen ignoriert unter `artifacts/atlas-rebuild/`:
`smoke-2026-11-08T22-41-45.349Z/`, `consolidation-interactions/`,
`consolidation-scaling/`, `consolidation-large/`, `consolidation-native/` und
`ci-package/`. Die CI lädt ihre eigenen Smoke-/Paketberichte und Logs ohne
Datenbanken hoch. Der [vorherige Prüfstand](https://github.com/ThonkTank/Salt-Marcher/blob/6855e6cdc11894548b5a73f8ba736be85cb2aaee/docs/implementation/status.md)
enthält die historische D11-Collection und deren Identitäten.

Vor P1 bleibt die tatsächliche Atlas-Generation→Bildschirm-Präsentationszuordnung
umzusetzen und an einer ausdrücklich qualifizierten Referenz zu belegen. Erst
danach ist die vollständige unveränderte native Stichprobe sinnvoll. Capture,
RAF und zeitliche Nähe zu einem Folgeframe ersetzen diese Zuordnung nicht.
Die installierte RPM-Bedienabnahme bleibt ebenfalls offen; ein gebautes und
gestartetes Anwendungsverzeichnis belegt sie nicht.
