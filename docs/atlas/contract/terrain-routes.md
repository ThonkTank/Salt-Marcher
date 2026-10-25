# Geländegebundene Straßen und Flüsse

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: atlas
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Beauftragter Ausbau vom 20.10.2026. Ergänzt [Landschaftswerkzeuge](landscape-tools.md) und den Straßen-/Wasserteil von [Relief R6](../requirements/terrain-relief.md). Die ursprünglichen Quellenbindungen WD-010, WD-011 und WD-012 bleiben erhalten. Gebäude, Dungeoneingänge und eine automatische Erzeugung ganzer Flusssysteme gehören nicht zu diesem Ausbau.

## Bedienung

Bei Straße/Fluss **Geländegerecht planen** wählen; bestehende Linien bieten denselben Einstieg im Objektinspektor. Die Planung öffnet die Seitenleiste des normalen Atlas; Neigen und Drehen verwenden dessen gemeinsame Kamera. Start, Zwischenpunkte und Ziel anklicken, Punkte ziehen oder ihre Koordinaten korrigieren. Breite, Planungsgrenzen, Koordinaten und Höhenprofil folgen der gemeinsamen Auswahl **Maße** (DnD oder Metrisch), die auch in der Planungsleiste erreichbar ist. Prozentsteigungen bleiben Prozentwerte. Die Umrechnung betrifft ausschließlich Ein- und Ausgabe; Solver und Speicherung behalten Meter. Unbearbeitete Koordinaten werden beim Bearbeiten der anderen Achse nicht gerundet. Der Editor zeigt denselben Verlauf in Draufsicht und gekippt, dazu sein Höhenprofil. **Verlauf einpassen** richtet die Kamera aus.

Zwischen den vorgegebenen Punkten sucht der Planer innerhalb eines seitlichen Spielraums eine Trasse. Die Vorschau schreibt nichts. **Verlauf übernehmen** speichert die berechnete Geometrie und ihre Geländeform gemeinsam. Verwerfen, Rückgängig/Wiederholen, Löschen und erneutes Öffnen verwenden die gemeinsame Atlas-History. Geplante Objekte werden über diesen Editor bearbeitet; die bisherige freie Linienbearbeitung bleibt für ungeplante Linien erhalten.

Straßenabschnitte erlauben automatisch vorgeschlagene Ausführung, Boden, Brücke, Furt oder Tunnel. Brücken besitzen ein Deck, Tunnel eine unterirdische Profilstrecke und Portale; begehbare Innenräume sind nicht enthalten. Eine Furt wird bei mehr als einem Meter Wassertiefe abgelehnt. Brückenfreiheit und Tunnelüberdeckung laufen an den Übergängen zum Boden aus.

Flüsse besitzen ein durchgängig fallendes Wasserprofil und ein verbundenes Bett. Als Mündung sind ein freies Ziel, Meer, ein See oder ein bereits geplanter Fluss möglich. Flussanschlüsse werden von der Mündung stromaufwärts berechnet; Zyklen und unmögliche Höhenanschlüsse werden abgelehnt. Die Zielauswahl enthält Gewässer aus dem geladenen Planungsbereich.

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

`terrain-route-planner.ts` sucht deterministisch in einem begrenzten Raster und prüft das Höhenprofil auf der anschließend geglätteten Geometrie. Harte Grenzen werden durch Intervallfortpflanzung entlang des Profils geprüft. Der Solver verspricht keine global optimale Trasse: Scheitert die begrenzte Suche, muss der Autor Punkte, Ausführung oder Eingriffsgrenzen ändern.

`TerrainSampler` und `RouteSurface` liefern die wirksame Gelände-/Wasserhöhe. `linePoints` verwendet gespeicherte Profilpunkte ohne erneute Mäanderbildung. `terrain-route-view.ts` erzeugt die gemeinsamen räumlichen Bänder und Bauwerke für den Editor und den gekippten Atlas. Quellverjüngung gilt auch für Bett und Wasserbreite. Konfliktgeometrie wird rot angezeigt.

Vorschauen laufen in einem abbrechbaren Read-only-Worker mit Quellrevision und Bereichs-Fence. Die kanonische `landscape-route`-Aktion prüft diese Revision, berechnet im kanonischen Store-Worker erneut und schreibt alle betroffenen Verläufe in einer Transaktion. Direkte generische Put-/Batch-Aktionen dürfen geplante Objekte nicht an dieser Prüfung vorbeischreiben. Format 52 verhindert, dass ältere Appversionen diese Regeln umgehen; Format-50/51-Kampagnen bleiben importierbar.

Bereiche werden um betroffene Verläufe und ihre Anschlüsse erweitert. Grenzen: 128 Anker pro Objekt, 4096 Profilpunkte, 128 verbundene Verläufe, 4 MiB Verlaufsdaten und 16 MiB gelesene Bereichsdaten. Überschreitungen brechen vor Teiländerungen ab. Weltkoordinaten bleiben unabhängig von der Kamera.

## Prüfanschluss

- `tests/atlas/terrain-route.test.mjs`: Trasse, Pflichtpunkte, Steigung, Flussbett, Anschlüsse/Zyklen, Schutz/Konflikt, Bauwerke, gemeinsame Geometrie, Revisionen, Transaktion, Undo/Redo, Löschen und Neustart.
- `tests/atlas/desktop-terrain-route-units.test.mjs`: gemeinsame Umrechnung, volle Koordinatengenauigkeit, passive Einheitenwechsel, Vorschau/Übernahme und erneutes Öffnen.
- `tools/test-desktop-terrain-routes.mjs`: echte native Eingaben, Einheitenwechsel, Vorschau/Übernahme, Neigung derselben Hauptkamera, 200-%-Seitenleiste, PNG, Schutzwechsel, Löschen/Undo, Geländepinsel und frischer Prozess.
- `tests/terrain-route-display.test.mjs` und `tools/test-desktop-atlas-line-scales.mjs`: unmittelbare Bildschirmbreite, weiche Sichtbarkeit, Auswahl, Tunnelunterbrechungen und begrenzte Unterteilung langer Verläufe; [native Belege](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/atlas-route-scale-20261021/README.md).
- `tools/render-terrain-routes.mjs`: isolierter Bildvergleich mit Hangstraße, Fluss, Tunnel, Brücke und Furt.

Die [lokalen Belege](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/terrain-routes-20261020/README.md) trennen automatisierte Prüfung, native Bedienung und den synthetischen Bildvergleich. Sie ersetzen weder Benutzerabnahme noch Candidate-CI, Main-Integration oder eine installierte Paketprüfung. R6-Gebäude und R7-Leistungsqualifikation bleiben separat offen.
