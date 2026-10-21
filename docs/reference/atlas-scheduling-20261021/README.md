# Gelände-Detailarbeit gibt dem normalen Atlas Vorrang

Messstand: `7c90fa3f2857e2eaefd757f9fca35e281b0c7148`, einschließlich der Warteschlange aus `79b59f45`. Die anschließende Wiederanlaufkorrektur und ihre Regressionen stehen auf `941ce9fdbe650adb11ba41966f5cdd25442ac5d7`. Baseline: `dd22750b28f5e69ddabc780e156b4bf20b32a701`, also der vorherige zweistufige Ladeweg. `dirty: true` in nativen Belegen umfasst die noch nicht festgeschriebenen Belegdokumente und erhaltene historische ungetrackte Verzeichnisse; der Produktcode ist jeweils im genannten Commit enthalten. Entwicklungsstart und erneute Gebäudeprobe besitzen identische Main-/Preload-/Renderer-/HTML-Hashes.

## Implementierung und Schutz

`readTerrainProjectionSteps` teilt normale Geländeprojektionen in 64×64-Pixel-Rasterpakete. Nach abgeschlossenen Datenbanklesungen und Cacheeinträgen gibt der Generator zurück, wenn sein bisheriger Rechenschritt acht Millisekunden überschritten hat. Acht Millisekunden sind ein Prüfpunkt zwischen Paketen, keine garantierte Obergrenze einer einzelnen Berechnung.

Der Readonly-Worker beendet an jedem Haltepunkt die SQLite-Transaktion. Vor der nächsten Fortsetzung liest er die kanonische Atlasrevision erneut. Ein zwischenzeitlicher Edit verwirft die alte Projektion. Es gibt höchstens einen pausierten Generator; Quellenwechsel, neuere normale Projektion, Kamera-, Live- oder Autorenarbeit geben dessen Zwischenstände frei. Abgeschlossene Cacheteile bleiben nur nach den bestehenden Invalidierungsregeln wiederverwendbar.

Die Warteschlange priorisiert Auswahl, Live-Anzeige, Kamera, Autorenvorbereitung und normale Detailarbeit in dieser Reihenfolge. Auswahl kann eine normale Projektion unterbrechen und danach fortsetzen lassen. Kamera-, Live- und Autorenaufträge ersetzen veraltete Detailarbeit. Der Atlas behandelt diese erwartete Verdrängung ohne Fehlermeldung und fordert noch benötigte Details danach erneut an. Der Worker bleibt erhalten. Ausgabe besitzt weiterhin ihren vorhandenen separaten Readonly-Service; dies erzeugt keine weitere Kartenansicht.

Der synchrone Projektionsaufruf für bestehende Verbraucher verwendet denselben Generator bis zum Abschluss. Seine bisherigen größeren Rasterbatches bleiben erhalten. Live-Frames, Höhenrasteraufbau, Indexpflege und große Autorenberechnungen sind durch diese Änderung nicht vollständig zeitlich begrenzt.

## Gepaarte Worker-Messung

`tools/measure-terrain-scheduling.mjs` baut tatsächliche Services/Worker aus Baseline und aktuellem Quellstand. Jeder Lauf wärmt denselben Reader und dieselbe Geometrie mit der Übersicht auf. Danach beginnt die kalte Detailfarbe; 20 ms später wird eine Auswahlabfrage gestellt. Reihenfolge: Baseline/neu/neu/Baseline. Die fertigen Projektionen sind bytegleich. Je Lauf startet genau ein Worker; die Auswahl wird beim neuen Stand vor Abschluss der Detailfarbe fertig.

| Lauf | Warten auf Auswahl | Detail insgesamt | Größter Worker-Schritt | p95 der Worker-Schritte |
| --- | ---: | ---: | ---: | ---: |
| Baseline 1 | 2.505 ms | 2.523 ms | 2.522 ms | 2.522 ms |
| 64er-Pakete 1 | 27 ms | 3.545 ms | 51 ms | 24 ms |
| 64er-Pakete 2 | 10 ms | 3.511 ms | 50 ms | 23 ms |
| Baseline 2 | 2.166 ms | 2.182 ms | 2.181 ms | 2.181 ms |

[Rohmessung](measurement.json). Der neue Stand benötigt 218–219 Worker-Schritte. Die Schrittzeiten umfassen Worker-Roundtrip und Quellenabgleich; sie sind keine Bildschirm-Bildzeiten. Die Auswahlwerte stammen aus je zwei Abfragen und sind keine belastbare p95-Eingabelatenz. Keine eigenen Proben oder Prüfungen liefen parallel. Andere Arbeit auf dem gemeinsamen Host kann die Werte beeinflussen.

**Abwägung:** Kleine Rasterpakete vermeiden die lange Auswahlblockade, wiederholen aber mehr Randarbeit. Die vollständige kalte Farbe braucht in diesem Fixture etwa 3,5 statt 2,2–2,5 Sekunden. Das ist ein bewusst sichtbarer Kostenanstieg, keine allgemeine Beschleunigung. Weitere Arbeit muss diese Mehrarbeit verringern und fertige Details räumlich früher ausgeben.

Explorative Läufe mit [128](exploratory-128.json), [64](exploratory-64.json) und [96](exploratory-96.json) Pixeln bleiben erhalten. Sie stammen aus Zwischenständen; der erste Baseline-Build warnte über eine fehlende übergeordnete tsconfig, die vor den späteren Messungen aus dem Baseline-Commit ergänzt wurde. Die geteilte Hostlast schwankte. Die Auswahl der 64er-Pakete beruht auf kürzeren beobachteten Haltezeiten; die Tabelle oben gehört zum abschließenden festgeschriebenen Produktstand.

## Regressionen

[Zehn Projektions-/Cachefälle](projection-cache-tests.log) prüfen Pixelgleichheit des gestuften und vollständigen Rasters, lokale Invalidierung, kalte Gleichheit nach Edits, Quellenwechsel und Auswahl-/Kamerapriorität. [52 weitere Fälle](queue-tests.log) prüfen bestehende Region-, Quellen- und Terrain-Worker-Abläufe sowie die fehlerfreie Wiederaufnahme nach erwarteter Verdrängung. [Sieben abschließende Fälle](final-batch-tests.log) prüfen die finale Paketgröße und den Worker nach der letzten Bereinigungsänderung. Die Serien überlappen und werden nicht als aufsummierte Abdeckung ausgegeben. [App-TypeScript](type-check.log) und [Desktop-TypeScript](desktop-type-check.log) bestehen.

## Native Hauptkarte

Die [Repository-Probe](repository-result.json) startet den [normalen Entwicklungsbefehl](development-command.log), öffnet die Hauptkarte und zoomt während ausstehender Details. Neigen, Drehen, GPU-Höhenlinien und Exportkachelgrenzen bestehen die vorhandenen Prüfungen. Die App endet normal mit verschwundenem PID und ohne Rendererfehler. [Screenshot](main-atlas.png).

**Offener Zeitbefund:** Zwischen der ersten beobachteten Übersicht und der fertigen Detailstufe liegen in diesem nativen Lauf 9.706,5 ms, während dazwischen ein Kameraausschnitt gelesen wird. Dies ist erheblich länger als die isolierte Detailberechnung. Der Ablauf ist funktional bestanden, aber nicht als schnelle vollständige Darstellung qualifiziert. Quellenprüfung zeigt weiterhin doppelte Arbeit: `AtlasRegionReader.read` erzeugt über `AtlasLandscapeReader.read` Landschafts-PNGs; `AtlasCanvas` dekodiert deren Bildquellen, während `AtlasSpatialScene` Zeichenkommandos mit `landscapeRaster` ausdrücklich überspringt. Der zeitliche Anteil dieser Arbeit ist hier noch nicht isoliert gemessen. Nächster Schritt ist das Entfernen dieser ungenutzten Bodenbilder aus dem normalen räumlichen Lesepfad, mit eigenen Gegenproben für dichte Inhalte, Spielerfreigabe, Ausgabe und Grafikfallback.

Die [Live-Probe](live-result.json) besteht Formen, Glätten, Farbe, Escape, Fokusverlust, Profil, gekippten Zug, frisches Öffnen und einmaliges Undo. Beide Prozesse enden normal mit verschwundenen PIDs, ohne Rendererfehler.

## Wiederanlauf nach schnellen Objektänderungen

Die erste Gebäudeprobe auf dem Messstand scheiterte nach drei schnellen Höhenänderungen: Die Werte waren gespeichert, doch eine verworfene Geländeabfrage startete bereits während der Regionsaktualisierung neu. Die wiederholte alte Revision löste fälschlich den Canvas2D-Fallback aus. [Fehlerbefund](objects-before-failure.json) und [Bild](objects-before-failure.png) bleiben erhalten. Der Prozess wurde durch die Probenbereinigung beendet; dies ist kein normaler erfolgreicher Abschluss.

`TerrainSpatialUI` sperrt erneute Geländeabfragen während der Regionsaktualisierung. Nur ein bestätigtes Ergebnis oder der bestätigte Nachfolger eines überholten Auftrags hebt die Sperre auf. Eine nach bestätigtem Nachladen erneut veraltete Quelle bleibt ein Fehler; es gibt keine endlose Wiederholung. [20 gezielte Fälle](recovery-tests.log) prüfen diese Übergänge einschließlich überholter Aktualisierung und Pixelgleichheit bei ungeraden Rastergrößen, gebrochenen Ursprüngen und festen Höhenlinien. [App-TypeScript nach der Korrektur](recovery-type-check.log), [Desktop-TypeScript](recovery-desktop-type-check.log) und [Repositoryprüfung](repository-check.log) bestehen.

Der [erneute Entwicklungsstart](recovery-repository-result.json) auf `941ce9fd` besteht denselben Hauptkartenablauf mit normalem Prozessende und ohne Rendererfehler. Zwischen Übersicht und Detail liegen diesmal 7.271,2 ms; diese Einzelprobe ist keine belastbare Beschleunigungsmessung. [Geprüftes Bild](recovery-main-atlas.png): Die Karte zeigt weiterhin zu dichte und stellenweise eckige Höhenlinien sowie einen sichtbaren Abdeckungsrand. Bestandene Pixelprüfungen sind daher keine Abnahme ihrer visuellen Qualität.

Die [erneute Gebäudeprobe](recovery-objects-result.json) auf `941ce9fd` besteht Dachauswahl, drei schnelle Änderungen der Höhenbindung, unveränderte Raumgeometrie, gekachelte perspektivische PNG-Ausgabe und frisches Öffnen. Beide Prozesse enden normal mit verschwundenen PIDs und ohne Rendererfehler. Das [Bild nach den Änderungen](recovery-object-inspector.png) bestätigt den erhaltenen Hauptatlas. Dieser Ablauf qualifiziert weder die vollständige Geschossdarstellung noch deren optische Qualität.

Auch die [erneute Live-Probe](recovery-live-result.json) auf `941ce9fd` besteht Formen, Glätten, Farbe, Escape, Fokusverlust, Profil, geneigten Pinselzug, frisches Öffnen und einmaliges Undo ([Ablaufprotokoll](recovery-live.log)). Beide Prozesse enden normal mit verschwundenen PIDs und ohne Rendererfehler. Sie verwendet dieselben Produkt-Builds wie Entwicklungsstart und Gebäudeprobe.

## Offene Gesamtarbeit

Noch offen sind unter anderem zeitliche Begrenzung weiterer großer Reads, weltfeste Kacheln, frühere GPU-Ausgabe einzelner Details, geringere kalte Rasterkosten, Abdeckung bei starker Kameraneigung und die vollständige semantische Darstellung von Küsten, Straßen, Flüssen, Bewuchs, Gebäuden und Beschriftung. Die gesamte Leistungsabnahme, großen Welten und langen Sitzungen sind nicht qualifiziert. Candidate-CI am endgültigen SHA, Main-Integration, Paketierung, Installation und Nutzerabnahme stehen aus. Die drei vollständigen kritischen Abschlussprüfungen haben nicht begonnen.
