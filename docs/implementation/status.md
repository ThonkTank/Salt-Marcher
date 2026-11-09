# Aktueller Stand

Stand: 9. November 2026. R2 baut auf dem veröffentlichten R1-Stand
`7167da84681258885fab4a4f865eb32a891c895a` auf.
Atlas V7 bleibt der reguläre Einstieg mit Dateiformat 22; der optionale
Electron-/Pixi-Höheneditor verwendet Format 24.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten und [Produktvertrag](../product-contract.md) Verhalten und Grenzen.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft;
der [Neubauplan](atlas-rebuild-plan.md) bleibt der einzige Ausführungsplan.

## Übergabe

**R2 ist funktional integriert; die vollständige Leistungsabnahme bleibt offen.
P0 ist nicht freigegeben.** C1 ist im aktiven P0-Höheneditor angeschlossen.
Die lokale Wirkungsschranke umfasst angewandte und reservierte Beiträge;
Up versiegelt seine tatsächliche Eingabe, während angenommene Arbeit begrenzt
weiterläuft. Eine Geste endet mit einem gemeinsamen History-/Persistenzabschluss.
R3–R5 sind damit nicht erledigt.

Der frühere Arbeitsstand ging bei der Wiederherstellung der Ausführungsumgebung
verloren. Diese Übergabe beruht auf einer rekonstruierten Integration und neu
geprüften Dateien. Alte Prüfzahlen und Messbuilds werden nicht als Nachweis
für diesen Stand übernommen. Der unverbundene Suchbaum-/Moment-Prototyp ist
nicht Bestandteil des Produktcodes; es wurde kein weiteres Pinselverfahren
oder Performance-Experiment begonnen.

## Umsetzung und Prüfzuordnung

| Kriterium                                            | Umsetzung                                                                                                                                                                               | Nachweis                                                                                                                                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vollständige Eingabe und feste C1-Wirkung            | `brush.ts`, `prepaid-height.ts`, `PrepaidBrush`: vollständige Polylinie, kausale Uhr, `max(F,T)`, 50-ms-Zeitkappung, 127 offene Punkte plus Up-Platz.                                   | Unabhängige Koeffizienten/Oberflächen, alle 22 Stufen, negative Rate, Weltgrenzen, Ecken, Wiederbesuche, späte Zeitstempel und tatsächlicher Up-Endpunkt.                            |
| Atomare Annahme und begrenzte Fortsetzung            | `EditorDocument` besitzt Quellenreserve, Wirkungskonto und die einzige aktive/abschließende Aktion. Alle Quellen-/Zellen-/Kachel-/History-/Pendingbudgets werden vor Annahme geprüft.   | Reservierte noch nicht angewandte Arbeit, Kapazitätsgrenzen, Source-Pinning, unveränderliche Patches und genaue Anwendungsspannen; keine Mutation nach Abschluss.                    |
| Lokale sichtbare Grundlage und vollständige Receipts | `WorldRenderer`/`HeightField`: begrenzte lokale Grundlage, unveränderlicher Renderstand R, zusammengeführte neuere Quellen, authentischer Abschluss des gesamten sichtbaren Einflusses. | Teilpakete, R neben R+1, falsche/alte Handles, gleiche Revision nach Quellenimport, lokale kalte Lücke, Contextloss und Löschung eines bereits verdrängten feinen Autors.            |
| Vollständiger History-/Dateiabschluss                | Controller und `ProjectSession` verwenden `whenActionFinished`; erst danach wählen Writer oder Snapshot ihren Stand.                                                                    | Up→Undo, Up→Save/Reopen, Cancel, fehlgeschlagenes Open, erfolgreicher Ersatz, verlorene ACKs und Disposal mit abgelehnter alter Barriere.                                            |
| Aussagekräftige Beobachtung                          | Schema 6 trennt Annahme, Materialisierung, Versiegelung, Abschluss und Darstellung. Ordinalbereiche prüfen genau einmalige Übernahme; C1-Inhalt stammt aus unabhängiger Referenz.       | Fehlende/doppelte Anwendung, verlorene Ecken/Endpunkte, zu schwache/starke Wirkung, falsche Zeit, unvollständiger Abschluss und falsche Receipts scheitern im gemeinsamen Auswerter. |

Der alte Controllerpfad mit globalem `awaitingDose`, verworfenem wartendem Weg
und sofortigem Modellabschluss bei Up ist entfernt. Die aktuellen Dokumente
und Ablaufprüfungen beschreiben C1. Historische Diagnoseformate werden vom
aktuellen Schema-6-Einstieg verständlich abgewiesen.

Ein numerischer Abschlussrandfall ist ebenfalls geprüft: Rundet Float64 eine
positive reservierte Addition auf denselben Autorenwert, werden Übernahme und
Renderrevision weiterhin veröffentlicht. Die unveränderte Aktion erzeugt keine
History-/Pendingdaten und hinterlässt keinen erfundenen unbestätigten Sequenzwert.
Frühere echte unbestätigte Änderungen bleiben bis zu ihrem ACK geschützt.

## Neu ausgeführte Verifikation

- **576/576 P0-JavaScript-Tests in 17 Dateien bestanden.** Darin liegen die
  vollständigen Modell-, Controller-/Renderer-, Session- und Auswerterprüfungen.
- Die Gesamtsuite besteht **1.007 Tests in 58 Dateien**. Eine weitere Datei mit
  fünf Rust-Transportvertragstests scheitert bereits im Setup an fehlendem Cargo;
  diese fünf Tests werden übersprungen, der Gesamtlauf ist deshalb nicht grün.
- Vollständige TypeScript- und Tool-Typprüfung bestanden.
- `check:atlas-p0` besteht Build, **15/15 reale SQLite-/Fixturetests**,
  **120/120 Desktop-/Lifecycleprüfungen** und **fünf GPU-Referenzfälle mit neun
  Ansichten**. Darunter liegen alle 22 Höhenstufen, normale und extreme
  Auslöschung, negative Werte, Kachelnähte, Weltgrenze und Context-Wiederherstellung.
- Lokale Rustprüfungen und `contracts:check` sind durch fehlendes Cargo blockiert
  (`spawnSync cargo ENOENT`). Das wird nicht als erfolgreicher Gate-Anteil gezählt.

Der geprüfte Desktop-Build vom 9. November 2026, 15:53:21 UTC verwendet Node
24.22.1 und Electron 44.10.2. Seine Produktquellen haben SHA-256
`a2044974f4b3ae33412365c36fbf8af4ccba138029b876c000b439dc49591e02`;
dieser Inhalt wurde vor dem Commit gegen die endgültigen Dateien abgeglichen.
Der Build entstand noch mit lokalen Änderungen auf Checkpoint `ad49a79`;
nachfolgende Dokumentationspflege ändert seine Produktquellen nicht.
Prüflogs und der Smoke-Report liegen unter
`src-tauri/target/diagnostics/r2-verified/`, der vollständige GPU-Report unter
`src-tauri/target/diagnostics/atlas-gpu-reference/report.json`.
Die headless Software-GPU-Prüfung belegt Inhalt, keine Hardwarelatenz.

Für den veröffentlichten Head gilt **Candidate · exact-SHA aggregate** auf
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469/checks).
Ein historischer grüner Check wird nicht auf diesen Commit übertragen.

## Offene Grenzen und nächster Schritt

1. **R2-CPU-Abnahme offen:** Der bekannte dichte Eingabefall verfehlte vor dem
   Umgebungsverlust das feste 8-ms-p95-Ziel. Diese Bereinigung behebt oder
   qualifiziert diesen Befund nicht. Für den rekonstruierten Stand liegt kein
   neuer vollständiger CPU-Abnahmebeleg vor. Keine Umdeutung als gewöhnlicher
   Kapazitätsüberlauf und keine Absenkung von Eingaben, Wirkung oder Grenzwert.
2. **R3 bleibt offen:** Auswahl vor teurer Vorbereitung, normale Kleinstwerte
   und Level-9-Fall ohne CPU-Fallback sowie zwei begrenzte GL-Plätze fehlen.
   R2 behält einen GL-Platz. Die gezählten Struktur-/Puffergrenzen sind keine
   Messung des gesamten JavaScript-Heaps und kein Hardwarelatenznachweis.
3. **R4/R5 bleiben offen:** Positive Hardware-Richtungsprobe, 20-ms-Ergebnistakt,
   qualifizierte tatsächliche Präsentation und installierte Paketabnahme sind
   nicht belegt. Software-GPU-, Inhalts- oder Dateiprüfungen ersetzen sie nicht.

Nächste Arbeit ist die offene R2-CPU-Zulassung gemeinsam mit dem in R3 geplanten
begrenzten Renderpfad. Das rechtfertigt noch keinen allgemeinen Werkzeugausbau
oder eine P0-Freigabe. Unabhängige Referenz, Stärkeanker und Zeitziele bleiben
unverändert.
