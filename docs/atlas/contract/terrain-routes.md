# Geländegebundene Straßen und Flüsse

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: atlas
Last Reviewed: 2026-10-28 (begrenzter Flussabschluss und Qualifikation; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Beauftragter Ausbau vom 20.10.2026. Ergänzt [Landschaftswerkzeuge](landscape-tools.md) und den Straßen-/Wasserteil von [Relief R6](../requirements/terrain-relief.md). Die ursprünglichen Quellenbindungen WD-010, WD-011 und WD-012 bleiben erhalten. Gebäude, Dungeoneingänge und eine automatische Erzeugung ganzer Flusssysteme gehören nicht zu diesem Ausbau.

## Begrenzter Flussabschluss

Der bestätigte zweite Arbeitszyklus erweitert den aktuellen
[Terrain-/Wasserumfang](../requirements/terrain-relief.md#aktueller-lieferfokus-terrain-und-wasser).
Er besitzt den hier beschriebenen eigenen Teilabschluss; daraus folgt keine
Verschiebung in eine Lieferung nach dem vollständigen TW-G1–6-Abschluss.
Nutzerergebnis ist ein einzeln geplanter, direkt weiterbearbeitbarer Fluss von
Pflichtpunkt zu Pflichtpunkt mit durchgängig fallendem Wasserprofil und begrenztem
Bettabtrag. Quellenzuordnung: Auftrag vom 20.10.2026, bestätigter zweiter Zyklus,
HEX-13/16 und WD-010.01–03/WD-012.01–02; deren volle Originalparität bleibt separat.
Voraussetzungen sind kanonische Höhen, gemeinsame Kamera, transaktionale
Übernahme, History und Wiederaufnahme. Vorschau/Übernahme gehören zum
Flussplaner; sie ändern nicht den bestätigten direkten Terrainpinselablauf.

Offen vor diesem Abschluss: aktuelle Quellen-/Höhenbindung der Vorschau,
Mündungsbudget, Pflichtpunkte und schmale Rücken sowie Abweisung unlösbarer
Verläufe am Lieferstand gegen vorhandene Belege prüfen; verbleibende
Originalfragen zu Form-/Anschlusswirkung nur dort nachmessen, wo sie dieses
Nutzerergebnis tatsächlich verändern. Zusätzliche grafische Pfadoptionen
bleiben vor dem späteren HEX-13/14-Ausbau zu klären. Der
[Wonderdraft-Katalog](../verification/reference-comparison.md#lieferrelevante-offene-originalwirkungen)
trennt diese Fragen vom schon bestätigten Eigenauftrag.

Abschluss dieses Teilumfangs: Hang/Küste und lösbare/unlösbare Senke mit echten
Pflichtpunkten planen, Vorschau abbrechen bzw. einmal atomar übernehmen,
unzulässigen Abtrag ohne Teiländerung erklären, ausdrücklich geänderte Grenzen
erneut prüfen; Bearbeiten, Schutz, Löschen, Undo/Redo und frischer Prozess
erhalten den bestätigten Verlauf. Funktions-, Darstellungs-, Leistungs- und
Paketbelege werden getrennt berichtet. Die vorhandenen lokalen Zyklus-2-Belege
unten werden weiterverwendet; sie sind weder Gesamtterrain-/E2E- noch vollständige
Flussparitätsabnahme. Neue Seen, Erosion, automatische Flussnetze und R6-Gebäude
gehören nicht zu diesem Abschluss.

### Abgrenzung gegen offene Originalwirkungen

Der [Abgleich WD-010/012 vom 28.10.](../verification/reference-comparison.md#abgleich-für-terrain-meer-und-den-bestätigten-fluss--28102026)
findet keinen belegten Quellenkonflikt mit dem bestätigten Flusszyklus. Seine
Wirkung ist ohne weitere Produktinterpretation beschrieben: GM setzt echte
Pflichtpunkte und Grenzen, sieht Verlauf/Profil, verwirft oder übernimmt einmal;
späteres Bearbeiten/Löschen entfernt ausschließlich den jeweiligen abgeleiteten
Bettbeitrag. Basishöhen, andere Objekte und Autoreninhalte bleiben erhalten.

Mündungsbezüge sind gerichtet: Quellfluss → Zielgewässer/-fluss; sie sind keine
automatische Gegenverbindung und kein Auftrag zum Erzeugen eines Flussnetzes.
Anschlusspegel und verbundene betroffene Verläufe werden im selben Command
geprüft. Löschen/Ändern darf keinen still gültigen, verwaisten Anschluss
hinterlassen; Verhalten betroffener Anschlüsse und gemeinsame Undo-/Redo-Wirkung
gehören deshalb zur direkten Probe. Unabhängige Campaignkopie remappt die
Objekt-/Anschluss-IDs gemeinsam und hält keinen Verweis auf die Quelle.

Offen ist die **aktuelle Qualifikation**, nicht die Entscheidung für Pflichtpunkt,
fallendes Profil oder Abtragsbudget: vor dem Teilabschluss die 28.10.-Hang-/
Senkenläufe mit direkt zugänglichem Rohbericht samt Quell-/Runtime-/Hostbindung
versehen; Mündung an Meer und vorhandenem Fluss, schmalen Rücken, unveränderte
Basishöhen, Anschlussbearbeitung/-löschung, Schutz und frischen Prozess am selben
Stand nachweisen. Vorhandene numerische und native Teilbelege weiterverwenden;
fehlende Fälle gezielt ergänzen. Siehe [Beleggrenzen](../../project/verification/end-to-end.md#terrain-wasserbelege-und-zielgerät).
Weitere WD-Mäander-/Spitzen-/Stil- und Punktbearbeitungswirkungen bleiben mit
bestehenden IDs vor HEX-13/14 offen. Sollte dabei eine zusätzliche fachliche
Anschlussregel sichtbar werden, Wirkung/Alternativen/Folgen vor ihrer Aufnahme
klären; keine unbekannte Formvariante als Aufwand dieses Abschlusses schätzen.

## Bedienung

Bei Straße/Fluss **Geländegerecht planen** wählen; bestehende Linien bieten denselben Einstieg im Objektinspektor. Die Planung öffnet die Seitenleiste des normalen Atlas; Neigen und Drehen verwenden dessen gemeinsame Kamera. Start, Zwischenpunkte und Ziel anklicken, Punkte ziehen oder ihre Koordinaten korrigieren. Breite, Planungsgrenzen, Koordinaten und Höhenprofil folgen der gemeinsamen Auswahl **Maße** (DnD oder Metrisch), die auch in der Planungsleiste erreichbar ist. Prozentsteigungen bleiben Prozentwerte. Die Umrechnung betrifft ausschließlich Ein- und Ausgabe; Solver und Speicherung behalten Meter. Unbearbeitete Koordinaten werden beim Bearbeiten der anderen Achse nicht gerundet. Der Editor zeigt denselben Verlauf in Draufsicht und gekippt, dazu sein Höhenprofil. **Verlauf einpassen** richtet die Kamera aus.

Zwischen den vorgegebenen Punkten sucht der Planer innerhalb eines seitlichen Spielraums eine Trasse. Die Vorschau schreibt nichts. **Verlauf übernehmen** speichert die berechnete Geometrie und ihre Geländeform gemeinsam. Verwerfen, Rückgängig/Wiederholen, Löschen und erneutes Öffnen verwenden die gemeinsame Atlas-History. Geplante Objekte werden über diesen Editor bearbeitet; die bisherige freie Linienbearbeitung bleibt für ungeplante Linien erhalten.

Straßenabschnitte erlauben automatisch vorgeschlagene Ausführung, Boden, Brücke, Furt oder Tunnel. Brücken besitzen ein Deck, Tunnel eine unterirdische Profilstrecke und Portale; begehbare Innenräume sind nicht enthalten. Eine Furt wird bei mehr als einem Meter Wassertiefe abgelehnt. Brückenfreiheit und Tunnelüberdeckung laufen an den Übergängen zum Boden aus.

Flüsse besitzen ein durchgängig fallendes Wasserprofil und ein verbundenes Bett. Als Mündung sind ein freies Ziel, Meer, ein See oder ein bereits geplanter Fluss möglich. Ein Wasseranschluss legt den Endpegel fest, hebt aber das Abtrags-/Auftragsbudget am Endpunkt nicht auf. Liegt der Pegel außerhalb dieses zulässigen Intervalls, bleibt der Entwurf erhalten und wird ohne Speicherung abgewiesen. Flussanschlüsse werden von der Mündung stromaufwärts berechnet; Zyklen und unmögliche Höhenanschlüsse werden abgelehnt. Die Zielauswahl enthält Gewässer aus dem geladenen Planungsbereich.

| Vorgabe | Straße | Fluss |
| --- | ---: | ---: |
| Seitlicher Spielraum | 100 m | 200 m |
| Abtrag / Auftrag | 3 / 3 m | 8 / 0 m |
| Geländeübergang je Seite | 6 m | 20 m |
| Maximale Steigung / maximales Gefälle | 12 % | 100 % |
| Wassertiefe | – | 1,5 m |
| Brückenfreiheit / Tunnelüberdeckung | 4 m | – |

Die Grenzen sind editierbar. **Beim Geländeformen schützen** ist je Objekt standardmäßig eingeschaltet. Ein späterer Höhenpinselzug versucht zuerst, den bisherigen Verlauf zu erhalten, dann eine nahe Trasse zu finden. Reicht das nicht, wird der Pinsel innerhalb des geschützten Korridors örtlich abgeschwächt. Der Atlas kennzeichnet diese Begrenzung. Bei ausgeschaltetem Schutz wirkt der Pinsel vollständig; unlösbare Verläufe erhalten eine sichtbare Konfliktmarkierung. Ein Undo nimmt den gesamten Pinselzug einschließlich der geänderten Profile zurück.

## Daten und Berechnung

`terrain-route.ts` definiert das optionale `LandscapeRecord.route.version = 1`: Anker, Grenzen, Schutz, Abschnittswünsche, berechnete Profilpunkte, Mündungsbezug und Konflikt. Kanonische Basishöhen bleiben separat erhalten. Straßenbett, Flussbett und Böschungsübergänge sind abgeleitete Beiträge des Objekts. Verschieben oder Löschen hinterlässt deshalb keine eingebrannten Erdarbeiten.

`terrain-route-planner.ts` sucht deterministisch in einem begrenzten Raster und prüft das Höhenprofil auf der anschließend geglätteten Geometrie. Harte Grenzen werden durch Intervallfortpflanzung entlang des Profils geprüft. Für Flüsse werden zusätzlich Quellraster-Kreuzungen und Zwischenproben bis zum Viertel eines Quellpixels einschließlich dessen Interpolationsrand geprüft. Verletzte Zwischenproben ergänzen das bestehende Profil, bevor dieselbe Intervallrechnung erneut läuft. Ein schmaler Rücken darf dadurch nicht zwischen den breitenabhängigen Profilknoten verschwinden. Quellverjüngung verwendet für Planung und wirksames Bett dieselbe Tiefe. Die numerische Eingriffstoleranz beträgt 0,000001 m; nach höchstens zwölf Verfeinerungen oder mehr als 4096 Punkten wird ohne Teiländerung abgewiesen. Der Solver verspricht keine global optimale Trasse: Scheitert die begrenzte Suche, muss der Autor Punkte, Ausführung oder Eingriffsgrenzen ändern.

`TerrainSampler` und `RouteSurface` liefern die wirksame Gelände-/Wasserhöhe. `linePoints` verwendet gespeicherte Profilpunkte ohne erneute Mäanderbildung. `terrain-route-view.ts` erzeugt die gemeinsamen räumlichen Bänder und Bauwerke für den Editor und den gekippten Atlas. Quellverjüngung gilt auch für Bett und Wasserbreite. Konfliktgeometrie wird rot angezeigt.

Vorschauen laufen in einem abbrechbaren Read-only-Worker mit Quellrevision und Bereichs-Fence. Die kanonische `landscape-route`-Aktion prüft diese Revision, berechnet im kanonischen Store-Worker erneut und schreibt alle betroffenen Verläufe in einer Transaktion. Direkte generische Put-/Batch-Aktionen dürfen geplante Objekte nicht an dieser Prüfung vorbeischreiben. Format 52 verhindert, dass ältere Appversionen diese Regeln umgehen; Format-50/51-Kampagnen bleiben importierbar.

Bereiche werden um betroffene Verläufe und ihre Anschlüsse erweitert. Grenzen: 128 Anker pro Objekt, 4096 Profilpunkte, 128 verbundene Verläufe, 4 MiB Verlaufsdaten und 16 MiB gelesene Bereichsdaten. Überschreitungen brechen vor Teiländerungen ab. Weltkoordinaten bleiben unabhängig von der Kamera.

## Prüfanschluss

- `tests/atlas/terrain-route.test.mjs`: Trasse, Pflichtpunkte, Steigung, Flussbett, Anschlüsse/Zyklen, Schutz/Konflikt, Bauwerke, gemeinsame Geometrie, Revisionen, Transaktion, Undo/Redo, Löschen und Neustart. Die Flussfälle prüfen zusätzlich Mündungsbudget, eine lösbare und eine unlösbare querliegende Senke sowie schmale Rücken zwischen Profilknoten; unabhängige Zwischenproben bis 0,01 m prüfen das wirksame Bett.
- `tests/atlas/terrain-route-units.test.mjs`: öffentlicher `openTerrainRoute()`-Einstieg, tatsächlich erzeugtes Planermarkup und gemeinsame Einheitenfunktionen; passive Metrisch/DnD-Wechsel erhalten exakte Anker/Planungswerte, einzelne Achsen bleiben unabhängig, Abbruch erhält den bestätigten Verlauf und ausdrückliche Eingaben erzeugen genau eine metrische Übernahme. Der verzögerte Straßen-Historygegenfall hält Schreiben, Aktualisierung und Quellrücklesung einzeln an: Der Planer bleibt bis zum Ende beschäftigt und für Eingaben gesperrt; danach lassen sich Änderung verwerfen, Planung schließen und ein neuer leerer Fluss öffnen. Host/Preload sind kontrolliert; Solver und SQLite besitzen die getrennten Fachtests.
- [desktop-terrain-route-units.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/atlas/desktop-terrain-route-units.test.mjs): gemeinsame Umrechnung, volle Koordinatengenauigkeit, passive Einheitenwechsel, Vorschau/Übernahme und erneutes Öffnen.
- `tools/test-desktop-terrain-routes.mjs --river-only` (optional `--depression=4`, `--depression=12`): begrenzter Hang-/Küstenablauf mit drei echten Punktklicks, Vorschau, atomarer Übernahme, Undo/Redo und frischem Prozess. Die 12-m-Senke wird bei 8 m Abtrag abgewiesen; derselbe Entwurf lässt sich nach ausdrücklicher Änderung auf 16 m übernehmen. `tests/helpers/river-terrain.mjs` besitzt die gemeinsame Vier-Kachel-Fixture und 0,25-m-Zwischenproben; die numerische Höhentoleranz beträgt 0,00001 m. Native Bilder warten auf aktuelle Revision und fertige Detaildarstellung; Kamerabilder sind von kanonischen Höhenproben getrennte Belege.
- `tools/test-desktop-terrain-routes.mjs`: echte native Eingaben, Einheitenwechsel, Vorschau/Übernahme, Neigung derselben Hauptkamera, 100 %-Seitenleiste, PNG, Schutzwechsel, Löschen/Undo, Geländepinsel und frischer Prozess.
- `tests/atlas/terrain-route-display.test.mjs` und `tools/test-desktop-atlas-line-scales.mjs`: unmittelbare Bildschirmbreite, weiche Sichtbarkeit, Auswahl, Tunnelunterbrechungen und begrenzte Unterteilung langer Verläufe; [native Belege](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/atlas-route-scale-20261021/README.md).
- `tools/render-terrain-routes.mjs`: isolierter Bildvergleich mit Hangstraße, Fluss, Tunnel, Brücke und Furt.

Der Renderer-Hänger nach Redo der 12-m-Senke entstand durch automatische Fokusnachführung bei eintreffenden LOD-Kacheln: Unterschiedliche interpolierte Höhen ließen unmittelbar verfügbare Übersichts-/Detailpläne abwechseln und verhinderten neue Frames. Kachelankünfte führen den Fokus deshalb nicht nach; Navigationsabschluss und Ansichtssteuerung behalten diese Aufgabe. `tests/atlas/atlas-presentation-source.test.mjs` prüft die ruhende Kamera während der Verfeinerung und den weiterhin wirksamen Refokus nach Navigation. Eine gültige wiederhergestellte Pose besitzt ihren Fokus bereits vor der ersten Terrainlieferung; Übersicht und spätere Details überschreiben ihn nicht. Ohne gespeicherte Pose wird der anfängliche Fokus weiterhin aus dem geladenen Terrain bestimmt. Die bestehende Sicherheitskorrektur gegen ein Durchtauchen bleibt wirksam.

Der erneuerte lokale Zyklus-2-Nachweis vom 28.10.2026 deckt Hang/Küste bei 100 Prozent sowie die 4-m- und 12-m-Senke einschließlich identischer Redo-/Fresh-Bilder ab. Die 12-m-Senke wird bei 8 m Abtrag ohne Teiländerung abgewiesen und lässt sich nach ausdrücklich gewählten 16 m speichern, rückgängig machen und wiederherstellen. Alle qualifizierten Starts enden normal; die erzwungen beendeten Diagnoseläufe bleiben davon getrennt. Dies ist lokale Funktionsprüfung, keine Leistungs-, Paket- oder Benutzerabnahme.

Die [lokalen Belege](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/terrain-routes-20261020/README.md) trennen automatisierte Prüfung, native Bedienung und den synthetischen Bildvergleich. Sie ersetzen weder Benutzerabnahme noch Candidate-CI, Main-Integration oder eine installierte Paketprüfung. R6-Gebäude und R7-Leistungsqualifikation bleiben separat offen.
