# Aktueller Stand

Stand: 8. November 2026. Regulärer Produkteinstieg bleibt Atlas V7 mit
Dateiformat 22 und Generierungsrezept 4. Der optionale Electron-/Pixi-Höhenversuch
verwendet Dateiformat 23. [README](../../README.md) enthält Befehle,
[Architektur](../architecture.md) Zuständigkeiten und
[Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktueller Auftrag und Richtungsentscheidung

Aaron hat den aktuellen Zweck ausdrücklich eingegrenzt: zunächst prüfen, ob
die architektonische Richtung sinnvoll ist. Die Testreparatur dient diesem
Machbarkeitsnachweis. Eine vollständige Leistungsabnahme und der Ausbau P1–P9
sind damit nicht beauftragt. Die zusätzlichen Wiederholungen wurden deshalb
bewusst beendet; weitere Software-Messgruppen würden die offene Architekturfrage
nicht beantworten.

**Die Richtung ist ein tragfähiger Kandidat für den weiteren kleinen Versuch.**
Der lokale Höhenpfad liefert während laufender Gesten echte Geländeänderungen,
feine relative Höhen überleben grobe Eingriffe und History, und Bearbeitung kann
mit realer Persistenz und Hintergrundrechnung überlappen. Das unterstützt die
Trennung von aktivem Modell, Darstellung, Hintergrundarbeit und Dateispeicher.
Eine allgemeine Überlegenheit von Electron/Pixi gegenüber V7 ist damit nicht
belegt.

**Die Skalierung grober Ansichten bleibt die entscheidende offene Frage.**
Der derzeitige räumliche Leser verlangt alle berührten Quellenstufen und scheitert
bei den dichten Dateien an seiner Grenze von 512 Quellkacheln. Die im
[Neubauplan](atlas-rebuild-plan.md) vorgesehene Übersicht mit begrenztem Nachladen
ist noch nicht umgesetzt. Dieser Befund begrenzt den gegenwärtigen Versuch; er
entscheidet nicht allein über die Eignung der gewählten Sprache oder Laufzeit.

## Reparierte Prüfung und dabei gefundene Fehler

- Sichtbarer Zoom und Kameraanker werden getrennt geprüft. Ein ignoriertes
  Mausrad kann nicht mehr durch erfolgreiches Verschieben verdeckt werden.
- Ein gehaltener bewegter Strich muss an zwei getrennten Stellen schon vor dem
  Loslassen korrektes Gelände zeigen und genau eine rückgängig machbare Aktion
  erzeugen. Modellwerte, tatsächliche Canvasbilder und Renderübergaben werden
  gemeinsam geprüft.
- Echte Dateien mit 32, 1024 und 9000 Quellen belasten denselben groben Bereich;
  die größte Quellmenge überschreitet 256 MiB. Sichtbares zusätzliches Relief,
  genaue Detailrückkehr, gespeicherte Komposition und unveränderte Feindaten
  verhindern einen scheinbaren Erfolg durch weggelassene Quellen.
- Last entsteht aus einer Datei mit 9008 echten Quellen sowie einem rechnenden
  Worker. Eingaben müssen reale Speicherintervalle und aktuelle Workerarbeit
  überlappen. Kalte Ziele sind nach gewöhnlichem Projektöffnen ungeladen;
  der Betriebssystem-Dateicache wird nicht als kalt ausgegeben.
- Die Fehlerkontrollen erkennen ignorierten Zoom, Zeichnen erst bei Pointerup,
  verzögerte und fehlende Renderübergaben. Der normale Pfad muss sich anschließend
  wieder erholen. Ein beliebiger Testfehler zählt nicht als erfolgreiche Kontrolle.
- History überträgt eigene Source-Patch-Kopien auch nach Quellenauslagerung.
  Pointerup fordert einen echten Frame an, wenn der letzte Live-Stand bereits
  gezeichnet war. Hintergrundstatistik wird beim Projektwechsel zurückgesetzt.
- Zustandsabfragen kopieren nicht mehr ständig das wachsende Ereignisjournal.
  Messungen lesen seit ihrem Beginn hinzugekommene Ereignisse; das vollständige
  Journal und sein Verlustzähler bleiben erhalten. Native Klickziele werden
  nach dem möglicherweise scrollenden Hintergrundstart ermittelt.

## Identität und vorhandene Belege

Der Laufzeitkandidat wurde aus sauberem Arbeitsbaum gebaut und als eigenständiges
Forge-Paket gestartet. Nachfolgende Änderungen betreffen die Dokumentation.

| Identität     | Wert                                                               |
| ------------- | ------------------------------------------------------------------ |
| Codecommit    | `442576ccb9bce95cb6d7c63758b4a2829f77af63`                         |
| Quell-SHA-256 | `f8261ae209f3e1db73fc505b7d2befe356af2719cfc530bc16b20ce4fb5b74f4` |
| Lock-SHA-256  | `8f90d72914d5d7599759b5d117e4c40457f883f4213f870940a1167db6a17839` |
| Paket-SHA-256 | `3dd319c486e0e55056737539e29bead6869dc00a39af010c3de24a388568c165` |

| Prüfung                                                 | Nachweis                                                                                                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-Modell, Raster, Renderer, Beobachtung und Auswertung | 80 Tests bestanden am Codekandidaten.                                                                                                                                 |
| SQLite-Store und Skalierungsfixtures                    | 12 Tests bestanden in Electrons tatsächlicher Laufzeit.                                                                                                               |
| TypeScript, Syntax und Format der Änderungen            | Bestanden.                                                                                                                                                            |
| Gezielte Interaktionsvorprüfung                         | 17 Inhalts-/Interaktionschecks und fünf Fehlerkontrollen bestanden (`repair-interactions-5`).                                                                         |
| Gezielter warmer Lastsammler                            | 100 Striche, 600 Eingaben einschließlich Pointerup, vollständige Sammlung ohne Ereignisverlust (`repair-busy-series-2`).                                              |
| Gezielter kalter Lastsammler                            | 34 Ortswechsel vollständig mit belegter Speicher-/Workerüberlappung, ohne Ereignisverlust (`repair-cold-busy-series-2`).                                              |
| Skalierungsvorprüfung                                   | 32 Quellen bestanden einschließlich Relief, History und Dateirundlauf; 1024 und 9000 Quellen scheiterten an der unveränderten 512-Kachel-Grenze (`repair-scaling-4`). |
| Native Vorprüfung des Pakets                            | Exit 2, `NO_NATIVE_DISPLAY` (`representative-final/442576c-native-preflight`).                                                                                        |

Alle genannten Pfade liegen unter `artifacts/atlas-rebuild/`. Die gezielten
Vorprüfungen sind keine vollständige Abnahme des danach gepackten Kandidaten.
Ihre Ergebnisse und fehlgeschlagenen Vorläufe bleiben als solche erhalten.

Der zusätzliche Paketlauf unter
`artifacts/atlas-rebuild/representative-final/442576c-packaged-full/` wurde mit
SIGINT/Exit 130 beendet. Vorhanden sind Log, ausdrücklich partielle Metadaten und
19 abgeschlossene Beobachtungsdateien ohne verworfene Ereignisse. Je Gruppe 1
und 2 wurden 400 warme Striche erfasst. Drei kalte Serien mit jeweils 34 Wechseln
sind vollständig protokolliert; die zweite kalte Lastserie ist unvollständig.
Gruppe 3 und die nachgelagerten Kontrollen/Skalierungsfälle wurden nicht erreicht.
Es gibt keinen abschließenden `report.json` und kein Gesamt-PASS für diesen Lauf.
Erfasste Eingabezahlen werden nicht als bestandene Einzelversuche ausgegeben.

## Grenzen der Aussage und nächste technische Frage

Die formale native P0-Abnahme bleibt **blockiert**. Es fehlt die eindeutige
Zuordnung von Atlas-Generation über die verbrauchte Canvasressource zum tatsächlich
präsentierten Compositorframe. Softwaregrafik, Renderübergaben und RAF ersetzen
weder diese Messung noch eine qualifizierte Hardware-/Displayreferenz. Einzelne
Überschreitungen der strengen Submission-Diagnostik sind außerdem nicht mit einem
Verstoß gegen das getrennt zu prüfende p95-Ziel gleichzusetzen.

Der nächste erkenntnisreiche kleine Versuch wäre eine begrenzte grobe Übersicht:
bei 32, 1024 und 9000 Quellen denselben Ausschnitt darstellen und bearbeiten,
mit begrenzten Reads und Speicherbedarf, danach exakte feine Details wiederfinden.
Er prüft die noch offene architektonische Annahme. Weitere große Wiederholungsreihen
oder Fachwerkzeuge sind für diese Richtungsentscheidung nicht der nächste Schritt.

Die V7-Vergleichsreihe, native Leistungsabnahme, RPM-Installation und echte
OS-Dateidialogbedienung bleiben offen. Ohne `cargo` konnten hier die Rust-Anteile
der Gesamtprüfung nicht ausgeführt werden. Die vorhandenen Teilnachweise ersetzen
keine Freigabe durch `Candidate · exact-SHA aggregate`; der PR bleibt ein Draft.
