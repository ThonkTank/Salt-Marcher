# Aktueller Stand

Stand: 9. November 2026. Atlas V7 bleibt der reguläre Produkteinstieg mit
Dateiformat 22; der optionale Electron-/Pixi-Höheneditor verwendet Format 24.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten und [Produktvertrag](../product-contract.md) Verhalten und Grenzen.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.

## Ergebnis und Auftragsgrenze

Die beauftragte [Vereinfachung des P0-Ablaufs](atlas-rebuild-plan.md#p0-fortsetzung-und-nächster-produktnachweis)
ist implementiert und am integrierten Stand geprüft. Das Dokument erhält
vollständige Pinselabschnitte. Ein ausdrücklicher Pinselzustand und ein gerichteter
Frameablauf ersetzen gekoppelte Zustände und Rückrufe. Produkt und Diagnose
verwenden denselben tatsächlichen lokalen Darstellungsbefund.

**Der Aufräumschnitt ist abgeschlossen; P0 ist weiterhin nicht freigegeben.**
Der unveränderte warme 512-Pixel-Fall verfehlt seine Live-/Zeitkriterien. Die erste
native Präsentation des tatsächlichen Karteninhalts bleibt nicht zugeordnet.
Der gemeinsame P1/P2/P3-Produktfall und F01–F19 bleiben gemäß Plan an das bestehende
P0-Gate gebunden. Diese Arbeit ist keine GPU-, Worker-, Host- oder Messmethodenablösung.

| Kriterium                             | Umsetzung                                                                                                            | Nachweis am integrierten Stand                                                                                                                    | Status      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Ein Besitzer des Pinselwegs           | `applySegment(from, to, elapsedMs)` und gemeinsame reine Abschnittsgrenzen; kein Modellanker oder Nullzeit-Abgleich. | Numerische Segment-, Halo-, Budget-, getrennte Abschnitts- und Historyprüfungen.                                                                  | Verifiziert |
| Eindeutiger Eingabezustand            | Frei, gehalten/neu-drücken oder aktiv; ausstehende Dosis bleibt unabhängig über Up bestehen.                         | Kurzer Klick zwischen Frames, Hold, verworfene Zeit/Wege, neue kalte Fläche und Abschlussfälle.                                                   | Verifiziert |
| Gerichteter Frame und lokale Freigabe | Controller besitzt RAF und gebündelten Ladebedarf; Renderer liefert tatsächliche Submits und eine regionale Abfrage. | Lokale Freigabe, alte Antworten, Uploadbudget, Fairness und direkte Restbatchfortsetzung.                                                         | Verifiziert |
| Passive gemeinsame Diagnose           | Ein Dosisfakt, gemeinsamer Submitbezug, reine Faktenextraktion und zentrale Versuchs-/Szenariobewertung; Schema 3.   | Fehlende/falsche Belege scheitern; Diagnose an/aus bei identischen Eingaben, Zeiten und Produktfakten ergibt dieselben Werte und Commit-Payloads. | Verifiziert |
| Integration und Fehler                | Vorhandene Mathematik, Quellenbegrenzung, Store und Dateilebenszyklus bleiben Grundlage.                             | Echte Electron-/SQLite-Prüfungen, normaler Start, Hänger, Dateirundläufe und reale Interaktionen mit Fehlerkontrollen.                            | Verifiziert |
| Warmer großer Pinsel                  | Eingabefolge, Inhalt, D10/D11 und Grenzen unverändert.                                                               | Inhalt und Undo bestehen in der neuen Einzelprobe; ein aktueller Liveframe vor Release, Rückmeldung zu spät.                                      | FAIL        |
| Native P0-Abnahme                     | Bestehende fehlerschließende Vorprüfung und Inhaltskontrollen erhalten.                                              | Kein natives Display und weiterhin keine bewiesene erste Präsentationszuordnung.                                                                  | Blockiert   |

## Vereinfachte Zuständigkeiten

`brush.ts` enthält die ausdrücklichen Zustandsformen und reine Entscheidungen
über angenommene beziehungsweise verworfene Zeit. Nur der Controller besitzt den
Bewegungsanker. Der Fachkern prüft Quellen und Budgets vor Mutation und führt
Werte, Vorherbilder und eine Undo-Aktion je Geste. Der sofortige nominale Klickimpuls
bleibt erhalten; Loslassen fügt keine Dosis hinzu.

Der Controller übernimmt fertige Rasterteile, lässt das Bild tatsächlich zeichnen,
verarbeitet die lokale Rückmeldung, entscheidet höchstens eine Folgedosis und
disponiert anschließend Arbeit. Restbatches derselben bereits angenommenen Revision
dürfen weiterhin direkt nach Workerabschluss starten. Ein laufender Batch,
Pixel-/Bytegrenzen und Fairness bleiben wirksam.

`inspectRegion` unterscheidet außerhalb, fehlende Grundlage, veraltetes lokales
Bild und vollständig aktuell eingereichtes Bild. Ein außerhalb liegender Bereich
kann die Produktsperre lösen, erzeugt aber keinen Submitbeleg. Unveränderte ältere
Kachelrevisionen bleiben lokal gültig; ferne Arbeit sperrt keinen bereiten Pinselort.

`Observation` ordnet echte Eingabe-, Dosis-, Commit- und Submitfakten zu. Es besitzt
keinen Produktzustand oder Eingabezähler. `at` und `projectedAt` trennen
Modellannahme und Quellenprojektion. Scheitert die Projektion nach Annahme,
bleibt genau ein Dosisfakt mit `projectedAt: null`; daraus entsteht kein erfolgreicher
Bildbeleg. Modellwerte, Undo und geordnete Persistenz bleiben erhalten.
Der entsprechende Fehler wurde durch einen werfenden Projektionsaufruf geprüft.

Entfernt sind `Gesture.previous`, `applyPoint`, `readBoundsForPoint`, die
`regionDisplayed`-/`regionExact`-/`regionCoverage`-Doppelung, Renderer-RAF und
Controller-Rückrufe, unbenutzte Coverage-Ereignisse, doppelte Dosis-/Inputbelege,
Diagnoselisten im Controller und parallele gespeicherte Erfolgsflags. Historische
Journal-Aliase werden nicht mehr im aktiven Auswerter rekonstruiert. Der große
Journaltransfer bleibt nach Abschluss-Submit oder Timeout; Zeigerhöhenproben
werden nur ausdrücklich angefordert.

## Verifikation und Identität

Der saubere lokale Integrationsbuild ist
`cdf026571cfd7b1201b0744ea1b383c2d1b6b3ce` (`dirty: false`). Produktquellhash:
`5c2c5aa88ff2db6637faf82d089cc63dd9ee09b8e84a84b3ba552a66300c387d`;
Lockhash: `b471b4a1da63f4226f95a28b60f3345aa03e51803f0ef1982624cd16a2d35bc2`.
Alle folgenden Desktopläufe benutzen diesen Produktbuild. Die nachfolgende
Dokumentation ändert weder Produkt- noch Prüfcode.

| Prüfung                                                  | Ergebnis                                                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:atlas-p0`                                  | 288 Tests in elf Dateien bestanden.                                                                                           |
| `npm run typecheck`, `npm run typecheck:p0-tools`        | Beide bestanden.                                                                                                              |
| `npm run check:atlas-p0`                                 | Toolprüfung und sauberer Build; 15 echte Electron-/SQLite-/Fixturetests sowie 83 Start-/Hänger-/Lifecyclechecks bestanden.    |
| `--lab --only interactions`                              | Alle 16 Funktionsprüfungen und fünf Fehlerkontrollen bestanden; ausgewählter Umfang besteht, native Vollabnahme bleibt offen. |
| `--lab --only collection --case M03-height-max --runs 1` | Ein unveränderter warmer Großpinselfall tatsächlich ausgeführt; FAIL bei Livewirkung und Submissiongrenzen.                   |
| `--native --preflight`                                   | BLOCKED / Exit 2; keine Fixtures und kein Programmstart.                                                                      |

Die echten Fehlerkontrollen erkennen ignorierten Zoom, erst nach Pointerup
gezeichnetes Terrain sowie verzögerte und verworfene Darstellung; die zugehörige
Erholung besteht. Die gemeinsamen Auswerter akzeptieren weder fehlende
Projektionszeiten noch falsche Session-/Frame-/Ansichtsbezüge oder unvollständige
lokale Commitbereiche. Ein grüner Beobachtungsbeleg ersetzt keine unabhängige
Höhen-, Pixel- oder Undo-Prüfung.

Belege liegen unter `artifacts/atlas-rebuild/smoke-2026-11-09T00-48-02.360Z/`,
`simplification-interactions/`, `simplification-warm512/` und
`simplification-native-preflight/`. Der erforderliche Repositorycheck bleibt
`Candidate · exact-SHA aggregate`; seinen aktuellen Zustand zeigt der PR.
Eine frühere CI-Freigabe wird nicht auf einen neuen Commit übertragen.

## Warmer 512-Pixel-Fall

Ein Fall mit unveränderten 24-ms-Eingaben, Electron 44.10.2, 1.440 × 960, DPR 1
und SwiftShader. Der Anfangsimpuls wird nach rund **76,6 ms** eingereicht;
der Commit nach Pointerup nach **68,3 ms**. Vor Release liegt **ein** aktueller
Liveframe statt der geforderten mindestens zwei vor. Die Zeitbilanz nach D10
besteht; kein Folgeschritt nimmt mehr als **21,6 ms** an. Inhalt einschließlich
Endpunkten und Undo besteht in diesem Lauf.

Damit bleibt der Fall **FAIL**. Die Zahlen sind einzelne Submissionbeobachtungen,
keine allgemeine p95-Aussage, keine native Präsentationszeit und kein Beleg einer
Beschleunigung. Die drei während ausstehender Rückmeldung eingetroffenen Moves
werden gemäß Vertrag verworfen. Nach Release wird kein Endpunkt nachgemalt.
Die konkrete nächste Performanceentscheidung bleibt gesonderte Arbeit.

Das alte Schema-2-Fehlerartefakt bleibt unverändert. Der verifizierte Auswerter aus
`89737a4` erkennt weiterhin dieselbe Fehlerliste; der aktuelle CLI lehnt Schema 2 ab.
Der im historischen Bericht gespeicherte Gesamthash des Harness passt nicht zum
erhaltenen Skriptbestand, und der Bericht bezeichnet seinen Produktbuild als dirty.
Daraus wird kein exakter Vorher-/Nachher-Latenzvergleich abgeleitet.
Hashes und Nachbewertung stehen unter
`src-tauri/target/diagnostics/p0-simplification/old-warm-evaluation.json`.

## Native Freigabe und verbleibende Grenzen

Die reine Vorprüfung meldet `NO_NATIVE_DISPLAY` und
`NATIVE_PRESENTATION_MAPPING_UNPROVEN`. Die fehlende Verbindung zwischen
aufgenommenem Karteninhalt, tatsächlichem Copy-/Refresh-Vorgang und erster
Präsentation der exakten Revision ist durch den Aufräumschnitt nicht behoben.
Andere Hardware allein schließt diese Methodenlücke nicht. Submissionzeiten
werden weiterhin nicht als native Präsentationszeiten ausgegeben.

Die frühere begrenzte Messprobe wird nicht ohne neue konkrete Beweisidee wiederholt.
Vor P1 bleiben der warme Großpinselfall, tatsächliche Präsentationszuordnung und
vollständige native Stichprobe auf qualifizierter Referenz zu schließen. Auch die
Bedienabnahme einer installierten RPM bleibt offen; lokale Cargo-/RPM-Werkzeuge
stehen nicht zur Verfügung. Der gezielte Aufräumschnitt verändert diese Gates
und den vollständigen Produktumfang nicht.
