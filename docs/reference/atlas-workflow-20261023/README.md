# Atlas-Arbeitsweise und feste Referenzwelt · 23.10.2026

Die [neue Arbeitsweise](../../plans/maps/unified-spatial-atlas.md#arbeitsweise-ab-23102026)
ist in AGENTS.md, Dokumentationsindex und den betroffenen Fachplänen verankert.
Diese Lieferung ändert keine Produktruntime. Sie setzt die Arbeitsregeln um und
sichert den Ausgangsbefund; eine bessere Produktivität oder eine abgeschlossene
Produktetappe wird damit noch nicht behauptet.

## Was sich an der Arbeit ändert

Ein überprüfbares Nutzerergebnis pro Etappe, ausdrückliche Richtungsentscheidung
nach zwei wirkungslosen Änderungen, Optionenvergleich bei wesentlichen Entscheidungen
und gezielte Prüfungen während der Umsetzung. Größere isolierte Ersatzentwicklungen
sind erlaubt. Die festen Releasezeiten und drei fehlerfreien Gesamtaudits entfallen;
Candidate-CI, Zehn-PR-Releasepflicht und der vollständige Produktumfang bleiben.
Aktueller Arbeitsstand und nächste Entscheidung stehen nur in der Atlas-Roadmap.
Keine neue oder wieder aktivierte Automatisierung, kein angelegtes Goal.

Überholte Vorgaben wurden abgeglichen: inkrementelle Technikbindung, eingestellter
Enginevergleich, separate orthografische Ansicht, nur senkrechte Innenraumbearbeitung
und der Ausschluss spezieller Geländeformen. Historische Belege bleiben datiert;
Feature für Hügel, Bergketten und Schluchten ist wieder ausdrücklich offen. Der
Höhenkartenimport wird dadurch nicht zusätzlich beauftragt. Quellenregister und
Abnahmekatalog wurden nicht als angeblich erfüllter Produktumfang umgeschrieben.

## Ausgangsprüfung im normalen Atlas

Quellstand `86380f28292daf59901f8d85509d683eb234f724`, Node 22.22.0,
normaler Electron-Start auf Wayland, 1440 × 900, eigenes synthetisches Profil.
[Autorenprotokoll](authoring-result.json.gz): acht Stationen von leerer Kampagne
über Kontinente/Relief/Wald und Königreich bis zu drei Straßen, sechs unabhängigen
Raumgruppen mit 95 Räumen und benanntem Schankraum; keine Stadtdokumente.
Bestand nach frischem Prozess identisch. Beide Prozesse schlossen regulär mit
Code 0, PIDs abwesend, keine Rendererfehler. Elf Runtimehashes stehen im Protokoll.
Der tatsächliche Ablauf ist mit `tools/test-desktop-world-authoring.mjs` im
Capability-Katalog verknüpft und mit `--geprueft` erfasst.

**Grenze der alten Bildaufnahme:** `terrainReady=ready` bedeutet noch nicht
vollständige Detailfarbe. Unter anderem Relief-, Wald-, Siedlungs- und Raumaufnahme
haben `terrainQuality=refining`. Die rechteckig unscharfen Bereiche im
[Reliefbild](03-continental-relief.png) belegen diesen Zwischenzustand; sie sind
kein Nachweis eines dauerhaften Kachelfehlers. Die Bilder bleiben mit ihrem Status
erhalten. [Kontinente](02-continents.png) und [Königreich](05-kingdom.png) hatten
bereits `detail`.

Die Autorenbilder zeigen weiterhin runde Pinselkontinente, eine schmale gleichförmige
Gebirgsform, große Waldstempel und eine [verstreute Siedlung](06-settlement.png).
Die Form der Quelldaten ist dabei von ihrer Darstellung zu unterscheiden.
Der ausgewählte [Raumname](07-building-room.png) ist in diesem Lauf sichtbar,
auch [nach Neustart](08-reopened.png); das widerlegt keinen früheren intermittierenden
Verdeckungsfehler. D&D-Raster und Etagenwechsel sind durch diesen Lauf nicht geprüft.
Keine Eingabe-Pixel-, große Last-, Zielgeräte- oder gestalterische Gesamtqualifikation.

## Dieselben Daten für spätere Vergleiche

[asterfall.sqlite.gz](asterfall.sqlite.gz) enthält ausschließlich diese synthetische
Welt. SQLite-Backup übernimmt auch WAL-Inhalte, ohne die Quelle zu verändern.
[fixture.json](fixture.json) bindet Quellstand, Kampagnen-ID, SHA-256 der entpackten
Datenbank und die gemessenen Kameras. Die Datenbank niemals über ein Nutzerprofil
kopieren. Die ursprünglichen Autorenbilder zeigen verschiedene Entstehungsstadien;
sie sind kein Pixelvergleich derselben fertigen Welt.

[capture-reference.mjs](capture-reference.mjs) öffnet deshalb dieselbe eingefrorene
fertige Welt in einem neuen isolierten Profil und erfasst fünf feste Maßstäbe erst
bei `terrainQuality=detail`. Jeder Prozess wird regulär geschlossen. Es werden
keine Landschaften neu erzeugt, Werkzeuge oder Produktrenderer ersetzt. Die kleine
Probe verwendet die bestehenden nativen Sitzungs- und Canvashelfer. Sie misst keine
kontinuierliche Zoomfahrt oder Eingabelatenz. Vorher und Kandidat mit gleichen
Runtimebedingungen und jeweils eigenem Ergebnisordner ausführen; Änderungen an der
Fixture sind getrennte Autorenverbesserungen, keine Rendererverbesserung.

Reproduktion aus einem Checkout mit Node 22 und installierten Abhängigkeiten:

```sh
npm run build:desktop
QA_EVIDENCE_DIR=.build/atlas-fixed-reference-repeat python3 tools/ui-session.py timeout --signal=TERM 420s node docs/reference/atlas-workflow-20261023/capture-reference.mjs
```

Den ursprünglichen Autorenablauf gesondert reproduzieren:

```sh
QA_EVIDENCE_DIR=.build/atlas-authoring-repeat python3 tools/ui-session.py timeout --signal=TERM 900s node tools/test-desktop-world-authoring.mjs
```

Die Eingabefolge ist reproduzierbar, zeitabhängige Pinselgesten erzeugen jedoch
nicht zwingend bitidentische Höhen. Deshalb für Bildvergleiche die eingefrorene
Welt verwenden. Bei späteren Schemaänderungen den Referenzstand lauffähig behalten
und eine nötige Konvertierung explizit prüfen, statt den Originalbeleg zu überschreiben.

Die große Vergleichsfixture bleibt `tools/test-desktop-world-navigation.mjs` mit
`WORLD_WARM_OPEN=1 WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_MIXED=1 WORLD_READBACK=off
WORLD_PROFILE=0 WORLD_DRAFT=1 WORLD_REPEAT=1 WORLD_PROGRESSIVE=1 WORLD_OVERLAY=1`.
Sie wurde für diese unveränderte Produktruntime nicht erneut gemessen. Vor einer
Produktänderung frisches Vergleichspaar aufnehmen; ohne Readback keine Aussage über
sichtbare Eingabelatenz. Hardware, Last, Quellen und Detailvollständigkeit festhalten.

## Fünf feste Ansichten: aktueller Befund

Die [Referenzaufnahme](fixed/result.json.gz) bestand: fünf reguläre Prozessenden,
PIDs abwesend, keine Rendererfehler, überall Detailstatus. Ihre elf Runtimehashes
sind identisch zum vorherigen Autorenlauf. Dirty betrifft nur diese Arbeitsweise
und ihre Belege, keine Produktänderung. Alle fünf Bilder wurden visuell betrachtet.

| Maßstab | Beobachtung | Konsequenz für die Produktetappe |
| --- | --- | --- |
| [Welt](fixed/world.png) | Runde Pinselabdrücke dominieren die Landformen; das große Hexraster konkurriert mit der Karte. | Quelldesign und maßstabsabhängige Autorenhilfen getrennt beurteilen. |
| [Kontinent](fixed/continent.png) | Nach vollständigem Nachladen keine rechteckigen unscharfen Zwischenflächen; Gebirge bleiben schmale Konturbänder, Wälder große Stempel. | Kartografische Darstellung prüfen; den Ladezwischenstand nicht als dauerhaften Fehler behandeln. |
| [Königreich](fixed/kingdom.png) | Lesbarer Gebietsname, monotone Waldfläche und wenig gegliederte Landschaft. | Gelände-/Symbolhierarchie und Quelldetails müssen getrennt verbessert werden. |
| [Siedlung](fixed/settlement.png) | Innenräume bereits als winzige Grundrisse sichtbar; breite Straßen und weit verstreute Häuser. | Objektmaßstab/Dachdarstellung und bewusst gestaltete Bebauung sind unterschiedliche Aufgaben. |
| [Innenraum](fixed/interior.png) | Räume, Inventar und Name sichtbar; kein sichtbares D&D-Raster. | Raster-/Geschossbedienung gezielt prüfen; deren Fehlen im Bild ist noch kein Funktionsnachweis. |

**Nächste Richtungsentscheidung:** (1) Kartografische Darstellung auf denselben
Daten, (2) bessere Formen-/Siedlungsautorenwerkzeuge, (3) Ersatz der Terrain- und
Renderinggrundlage. Weg 1 isoliert zuerst den sichtbaren Darstellungsanteil und
liefert einen Vergleich für jeden späteren Rendererersatz. Weg 2 kann die groben
Quelldaten verbessern, darf aber nicht als Renderergewinn zählen. Weg 3 bleibt
zulässig, hat durch diese Bilder allein noch keinen belegten Gesamtnutzen.
Ausgewählt ist deshalb als nächster Arbeitsblock eine zusammenhängende
Kartenstilprobe über die fünf festen Ansichten, mit explizitem Vergleich von
Geländelesbarkeit, Waldsignatur und maßstabsabhängigen Objekten/Namen. Keine
weitere Cacheoptimierung und kein automatischer Enginewechsel aus diesem Befund.
Die Probe darf isoliert entstehen; ihre Ergebnisse entscheiden über die Grundlage.

## Noch nicht abgeschlossen

Die Referenzreise ist die Ausgangsbasis der ersten Produktetappe. Die Wirksamkeit
der neuen Arbeitsweise kann erst nach deren Umsetzung beurteilt werden. Es gibt
hier weder einen beschlossenen Enginewechsel noch einen neuen Produktqualitäts-
oder Leistungsnachweis. Die weitere Umsetzung muss die Abschlusskriterien im
aktuellen Arbeitsstand erfüllen; diese Dokumentationslieferung schließt sie nicht.
