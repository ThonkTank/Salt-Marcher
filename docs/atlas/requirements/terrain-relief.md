# Roadmap: gezeichnetes Geländerelief und kippbarer Atlas

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: atlas
Last Reviewed: 2026-10-28 (begrenzte Ergebnisabschnitte und offene Klärungen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Zieländerung vom 20.10.2026: Die [Roadmap für den gemeinsamen räumlichen Atlas](../architecture/unified-spatial-atlas.md) ersetzt getrennte Drauf-/Kippdarstellung durch eine gemeinsame perspektivische Kamera. Die folgenden Implementierungs- und Prüfbefunde beschreiben den bisherigen Stand; sie belegen den neuen Atlas noch nicht.

Ursprünglicher Arbeitsplan aus dem Nutzerentscheid vom 19.10.2026. Die damalige starre Phasenfolge wird durch die ergebnisbezogenen Etappen der aktuellen Atlas-Roadmap ersetzt. R0 wurde visuell abgenommen. Seit der Nutzeranweisung „Warte bitte nicht auf abnahmen von mir. Arbeite einfach weiter.“ werden weitere Phasen ohne Abnahmepausen umgesetzt und selbst geprüft; eine Nutzerabnahme wird dadurch nicht behauptet. Der Status steht am Ende dieser Datei; ein Prototyp ist kein Produktnachweis.

Aktuelle Arbeit folgt der [Arbeitsweise und Etappe vom 23.10.2026](../architecture/unified-spatial-atlas.md#ziel). Ältere Implementierungsbelege unten bleiben historisch; direkte R3-Formpinsel sind inzwischen implementiert, ihr vollständiger Form-/Darstellungsabschluss bleibt offen. Größere isolierte Ersatzentwicklungen sind zulässig.

## Aktueller Lieferfokus: Terrain und Wasser

Bestätigter Nutzerumfang vom 25./26.10.2026; Funktions- und Leistungsabnahme bleiben offen.
Zuerst werden ausschließlich
Terrain-/Wasserbearbeitung und deren Darstellung nutzbar gemacht. Der übrige
Atlasumfang bleibt zurückgestellt, ohne bestehende Fähigkeiten oder fremde Arbeit
zu entfernen. Die breiteren R0–R7-Ziele unten bleiben langfristiger Umfang; sie
sind keine Voraussetzung, um diese begrenzte Etappe zu liefern.

**Nutzerklarstellung vom 26.10.2026 — Produktziel und technische Freiheit:**
Das Gesamtziel ist ein Karteneditor für alle Karten der eigenen Welt in einem
zusammenhängenden, Google-Maps-artigen Atlas mit ansprechender, intuitiver
Bedienung. Die technische Umsetzung entscheidet der Agent ausdrücklich frei.
Rasterstruktur, Renderer, interne Datenorganisation und selbst gesetzte
Ressourcenbudgets sind Mittel zum Produktziel, keine vom Nutzer verlangten
Lösungen. Sie dürfen begründet ersetzt oder angepasst werden, ohne dafür
erneut eine Nutzerfreigabe einzuholen. Entscheidend bleiben nutzbare Werkzeuge,
erhaltene Kartendetails, überzeugende Darstellung und reaktionsfähige Bedienung
auf dem Zielgerät. Technische Alternativen nach ihrem Nutzen und Aufwand
bewerten; bestehende Versuchsannahmen nicht zum Selbstzweck erhalten.
Der Terrain-/Meeresspiegel-Lieferfokus dieser Etappe bleibt bestehen; diese
Klarstellung zieht die übrigen Kartenwerkzeuge nicht vor.

**Bestätigt:**
- Land anheben und senken mit Radius, Stärke, Abfall zum Rand und Roughness.
- Gelände gezielt aufrauen und glätten.
- Alle Terrainwerkzeuge funktionieren durch Pinselmalen, einschließlich der
  Spezialwerkzeuge. Es gibt keine vorgeschaltete Umrissauswahl und keinen
  separaten Verlaufeditor für Bergketten oder Schluchten.
- Pinsel bearbeiten die Karte direkt während des Malens. Eine Vorschau oder
  gesonderte Übernahme ist nicht erforderlich. Diese Entscheidung ersetzt
  entsprechende Vorschauanforderungen der älteren Etappen für diesen Lieferfokus.
- Spezialwerkzeuge füllen den mit dem Pinsel bearbeiteten Bereich sinnvoll mit Hügeln,
  Bergen oder einer Schlucht. Hügel bilden eine Hügellandschaft; Berge besitzen
  zusammenhängende Hänge und Rücken; eine Schlucht bildet einen zusammenhängenden
  Einschnitt. Sie reduzieren manuelles Sculpten und wiederholtes Einstellen der
  Grundpinsel. Weitere Formen sind noch nicht konkretisiert.
- Wasserumfang der ursprünglichen Etappe: Meer mit einstellbarem Meeresspiegel.
  Der bestätigte zweite Arbeitszyklus erweitert diesen Umfang um einzeln geplante
  [Flüsse mit Pflichtpunkten und begrenztem Bettabtrag](../contract/terrain-routes.md).
  Automatische Flussnetze, Erosion und neue Seen gehören weiterhin nicht dazu.
- Bearbeitung und Darstellung mit einer drehbaren 3D-Kamera. Die vollständige
  Kamerasteuerung funktioniert allein mit der Maus; WASD ist eine zusätzliche
  Bedienmöglichkeit, keine Voraussetzung für Navigation oder Bearbeitung.
  Eine gemeinsame Kamera zoomt stufenlos von der vollständigen Weltübersicht bis
  auf die Größe einzelner Räume. Der Nutzer beschreibt das Bediengefühl mit
  Google Maps: weiches Rein-/Rauszoomen, angepasste Darstellung und reaktionsfähige
  Detailstufen (LOD). Raumgröße bezeichnet hier die Navigations- und
  Bearbeitungsskala, keinen zusätzlichen Auftrag für Raumwerkzeuge.
- Werkzeugumfang und tatsächliche Performance sind die vorrangigen Probleme.

**Bedienvorgaben für die Umsetzung:** Links malt, mittlere Maustaste schiebt,
rechts dreht/neigt um den betrachteten Geländepunkt, das Mausrad zoomt am
Geländepunkt unter dem Cursor. Der Handmodus erlaubt Verschieben mit links;
Mausregler bleiben erreichbar. WASD verschiebt relativ zur Ansicht bei
Kartenfokus, niemals beim Schreiben in Eingabefeldern. Neigung zunächst 0–75 Grad,
keine Rollbewegung und kein Durchtauchen durch Gelände; bei fehlendem Geländetreffer
kontrolliert die bestehende Fokusebene verwenden. Diese konkreten Belegungen sind
technische Ausgestaltung des bestätigten Bedienumfangs.

Die Spezialpinsel verbinden überlappende Abdrücke zu sinnvollen Formen. Der
Bedienablauf lautet: Werkzeug wählen, direkt malen, loslassen. Loslassen beendet
einen Undo-Schritt. Escape nimmt den noch laufenden Zug zurück. Pointerabbruch
und Fokusverlust schließen die bis dahin gemalte Änderung einmal ab und beenden
die Eingabe; ein losgelassener, noch speichernder Zug wird nicht verworfen.
Sinnvolle Vorgaben vermeiden ständiges Nachregeln. Während einer gedrückten
Maltaste besitzt die Pinselgeste die Eingabe; Kameraaktionen sind zwischen den
Zügen und während Nachladung möglich.

### Ziele und Abnahme dieser Etappe

Die folgenden Kriterien beschreiben den bestätigten Zielumfang und die bisherigen
Projekt-Leistungsziele. Es sind Sollwerte, keine erreichten Messungen. Eine neue
Planung leitet Reihenfolge und Termine aus dem aktuellen Codebestand ab.

| Ziel | Messbarer Abschluss |
| --- | --- |
| TW-G1 Grundbearbeitung | Anheben, Senken, Aufrauen, Glätten und Meeresspiegel wirken im nativen Atlas; jeder gültige Pinselzug wird genau einmal angenommen, Undo/Redo und Neustart erhalten die Höhen. Kein separater Vorschauschritt. |
| TW-G2 Kamera | Alle Kameraaktionen allein mit Maus, optional WASD; gleichmäßiger Welt-bis-Raum-Zoom, geschützter Textfokus und nachvollziehbarer Geländeanker. |
| TW-G3 Formen | Hügel, Berge und Schluchten entstehen durch Malen mit sinnvollen Vorgaben. Mehrere überlappende Züge verbinden sich, ohne Kegelketten oder sichtbare Strichnähte. Berge haben Rücken und Hänge, Schluchten einen zusammenhängenden Einschnitt; Formen lassen sich mit Grundpinseln weiterbearbeiten. Bildbeurteilung ergänzt numerische Tests. |
| TW-G4 Darstellung | Küsten, Rücken und Schluchten bleiben im kontinuierlichen Zoom erkennbar, ohne Löcher, Kachelnähte, Flimmern oder harte Formwechsel; angepasste Details erhalten die grobe Form. |
| TW-G5 Leistung | Erste sichtbare Terrainänderung p95 ≤ 100 ms, geladene Navigation p95 ≤ 33,3 ms pro Frame; keine verlorenen Gesten. Kaltladen und Speichern werden separat gemessen. |
| TW-G6 Lieferung | Gesamtablauf auf exaktem Quellstand und Paket geprüft, grüne Candidate-CI und Integration; Veröffentlichung nach bestehender Releasepflicht. Technische/nativer Prüfung und Nutzerabnahme getrennt berichten. |

### Begrenzte Ergebnisabschnitte

Diese Abschnitte konkretisieren TW-G1–6 im bestehenden Fachplan. Sie sind
Teilabschlüsse derselben bestätigten Terrainlieferung, keine neue Gatefolge.
Vorhandene Implementierung und begrenzte Nachweise aus dem
[Umsetzungsplan](../architecture/unified-spatial-atlas.md#nächster-produktnachweis-und-entscheidung)
werden weiterverwendet; jeder offene Punkt wird vor seinem betroffenen Ausbau
am aktuellen Code geprüft.

| Nutzerergebnis / Anforderungsbindung | Voraussetzungen und offene Fragen | Abschlusskriterium des Teilumfangs |
| --- | --- | --- |
| Grundpinsel und Meer: Küste und Relief direkt erstellen und korrigieren; TW-G1, HEX-16 | Gemeinsamer Höhenwriter, Livebild und bestätigte Speicherantwort. Radius, Stärke, Randabfall und Roughness auf ihre Wirkung prüfen; Erhalt absoluter Feinhöhen und Fehler-/Folgezugfälle bleiben gezielte offene Prüfungen. Vorhandene Wonderdraft-Landbelege lesen, fehlende Rand-/Überfahrwirkung nur bei fachlicher Relevanz gezielt ergänzen. | Anheben, Senken, Aufrauen, Glätten und Meeresspiegel mit unterscheidbarer Parameterwirkung; jeder gültige Zug genau einmal, Escape ohne Restwirkung, Pointerabbruch/Fokusverlust nach geltendem Vertrag, Folgezug, Undo/Redo und frischer Prozess. Kein separater Übernahmeschritt. |
| Welt bis Raum mit Maus bearbeiten; TW-G2, HEX-06/08 | Geländeanker, Textfokus und gleiche Kamera in allen Maßstäben; kalte Nachladung von geladener Navigation trennen. | Alle bestätigten Mausaktionen, optionales WASD und kontinuierlicher Zoom erhalten Anker und Bearbeitbarkeit; keine verlorene Eingabe oder Texteingabe als Kamerabefehl. |
| Zusammenhängende Formen und lesbare Darstellung; TW-G3/4, HEX-16 | Vorhandene Formpinsel weiterverwenden. Überlappung, Feindetailschutz, Rücken/Schlucht und LOD-Übergänge am gleichen Datenstand prüfen; weitere unbenannte Spezialformen bleiben vor späterer Aufnahme zu klären. | Hügel, Berge und Schluchten direkt malen und mit Grundpinseln korrigieren; Bildbeurteilung in allen vereinbarten Maßstäben einschließlich Übergängen, Undo/Redo und Neustart. Numerische Formtests allein schließen TW-G3/4 nicht. |
| Den gesamten bestätigten Terrainablauf flüssig nutzen und erhalten; TW-G5/6, HEX-08 | Alle vorstehenden Teile; versionierte Fixture, Zielgerät und exakter Quell-/Paketstand nach Messvertrag. Fehlende Funktions-, Leistungs- und Paketbelege getrennt ausweisen. | Sämtliche TW-G1–6 am selben Lieferstand nachweisen; Candidate-CI/Integration und Paketprüfung, Veröffentlichung nach Releasepflicht. Nutzerabnahme bleibt eine eigene Aussage. |

Der [bestätigte Flusszyklus](../contract/terrain-routes.md#begrenzter-flussabschluss)
ist ein eigener Teilabschluss des bereits bestätigten erweiterten Terrain-/Wasserumfangs.
Er wird durch diese Gliederung nicht in eine spätere Lieferung verschoben;
TW-G1–6 allein schließen diesen erweiterten Umfang nicht ab. Weitere R0–R7-Anteile,
Stadt, Dungeon und Autonomy gehören zum späteren Gesamtumfang. Bereits
vorhandene Inhalte und ihre Schutzregeln bleiben auch beim Teilabschluss gültig.
Eine offene Frage zu deren Erhalt wird deshalb vor dem betroffenen Terrainzug
geklärt; neue Stadt-/Dungeon-/Autonomywirkungen werden dadurch nicht vorgezogen.

### Geklärte Küstenwirkung und aktuelle Lieferblocker

Der [gezielte Originalabgleich vom 28.10.](../verification/reference-comparison.md#abgleich-für-terrain-meer-und-den-bestätigten-fluss--28102026)
benennt Eingaben, vorhandene Rohbelege und Grenzen für WD-005/006/008. Damit ist
für TW-G1/4 keine zusätzliche unentschiedene Küstenwirkung gefunden. Der
jüngere Auftrag besitzt metrische Höhe, Meeresspiegel, direkte Pinsel und
Spezialformen; die vollständige WD-Gestaltung bleibt späterer Umfang.

| Nutzerhandlung | Ergebnis und betroffene Daten | Erhaltung und direktes Abnahmeszenario |
| --- | --- | --- |
| Insel anheben, Bucht absenken, überlappenden Zug korrigieren | Kanonische Höhen und Meeresspiegel bestimmen Land/Wasser und die daraus abgeleitete Küste. Radius, Stärke, Randabfall und Roughness besitzen unterscheidbare Wirkungen. Farbe/Eigenschaften sind keine Höhenwerte. | Vorhandene Feinhöhen, Farbe, Eigenschaften und Orts-/Gebäude-/Raum-IDs außerhalb der tatsächlichen Höhenwirkung erhalten; keine Löschung bei Überflutung. Insel mit Feindetail und gesetzter Farbe bearbeiten, Gegenkorrektur, einmaliges Undo/Redo und Fresh; unveränderte Daten direkt vergleichen. |
| Meeresspiegel ändern und kontinuierlich zoomen | Ein Meeresspiegel ändert den Höhenschnitt und die Küstendarstellung; er schreibt keine neue Landform, Objektgeometrie oder Autorenprosa. Küste bleibt bis Raumgröße lesbar, ohne Naht/Loch/harten LOD-Formwechsel. | Vorherige Höhen/IDs und Details im gleichen Datenstand prüfen; Meeresspiegel rückgängig/wiederholen, frischen Prozess öffnen und Übersicht/Detail/Übergänge vergleichen. Zusätzliche Originalwasserstile sind kein Bestandteil dieser Probe. |
| Laufenden Zug abbrechen oder Speicherung klären | Escape nimmt nur den laufenden Zug zurück; Pointerabbruch/Fokusverlust schließen die bis dahin gemalte Änderung einmal ab. Bereits losgelassene, noch offene Speicherung bleibt zu klären. | Keine Reständerung nach Escape, keine doppelte Annahme durch Retry/Antwortverlust; anschließender Zug und Neustart erhalten ausschließlich bestätigte Arbeit. Geschützte Flüsse und bestehende Gewässer folgen ihren Fachverträgen. |

**Aktuelle Lieferblocker sind Prüf- bzw. mögliche Restimplementierungsaufgaben:**
(1) volle Parameter-/Abbruch-/Folgezugmatrix einschließlich absoluter Feinhöhen
am aktuellen Stand; (2) Mausnavigation sowie Formen-/Überlappungsbilder und
kontinuierliche Küsten-/LOD-Übergänge auf demselben Datenstand; (3) vollständige
TW-G5-Messung auf dem vereinbarten Zielgerät; (4) exakte Quell-/Runtime-/Paketbindung
und TW-G6. Der [datierte Prüfstand](../../project/verification/end-to-end.md#terrain-wasserbelege-und-zielgerät)
trennt vorhandene Teilbelege von diesen offenen Nachweisen. Ein fehlender
Nachweis ist weder ein behaupteter Implementierungsfehler noch ein Produkt-PASS.
Keine zusätzliche Originalwirkung und keine neue Aufwandszahl werden hier erfunden.

Neue Umsetzungsspannen entstehen erst nach Prüfung des aktuellen Codes und
der lieferrelevanten Fachfragen, mit Annahmen, betroffenen IDs und Restunsicherheit.
Die datierten Spannen des übernommenen Umsetzungsplans sind keine Schätzung
unbekannter Originalfunktionen. Dafür wird zunächst nur der gezielte
Klärungsaufwand geplant. Erweitert eine geklärte Anforderung diese Lieferung,
werden Quellen-/Lieferzuordnung und Umfang/Aufwand sichtbar nachgeführt;
fachliche Änderungen am Nutzerauftrag bleiben ausdrücklicher Entscheidungsbedarf.

**Messvertrag:** Zielgerät ist der vorhandene Laptop (aktuell i5-8365U,
Intel UHD 620, rund 38 GiB RAM), nativer Wayland-Start, 1920 × 1080 Fensterinhalt,
100 Prozent UI-Skalierung. CPU-/Speicherlast, tatsächliche Rendergröße,
GPU-Treiber und Runtime-/Quellhashes werden je Lauf festgehalten; keine
Systemeinstellungen ändern. Messläufe laufen ohne parallele Builds oder andere
eigene UI-Proben. Fremde Last wird offengelegt, nicht als eigener Leistungsgewinn
verrechnet.

Nutzerfortsetzung vom 25.10.2026: Die Prüfungen müssen auch bei gesperrtem
Desktop autonom möglich sein. Eine isolierte native Wayland-Testsitzung mit
eigener Ausgabe ist dafür erlaubt; die Bildschirmsperre wird weder umgangen
noch deaktiviert. Backend, tatsächlicher Renderer, Ausgabegröße und native
Fokus-/Tastaturereignisse werden gebunden. Diese Ergebnisse qualifizieren die
isolierte Sitzung, nicht die gesperrte Desktopoberfläche. Software-Rendering
kann funktionelle Prüfungen tragen, ersetzt aber keinen Leistungsnachweis auf
der vereinbarten Intel-GPU. Die Leistungs- und Bedienkriterien bleiben erhalten.

Eine deterministische, räumlich verteilte reine Terrain-Testwelt enthält grobe
Kontinentalhöhen, eine detaillierte Küsten-/Gebirgsregion und einen feinen
Ausschnitt in Raumgröße. Weltkoordinaten reichen über negative und positive
Kachelgrenzen. Fünf Ansichtsbreiten: 40.000 km, 1.000 km, 10 km, 1 km und 20 m;
Pinselradius jeweils 1/32 der Breite. Pro Werkzeug, Maßstab und Skalierung
genau 30 vorab geplante Versuche je Kombination; keine Ersatzsamples. p95 wird je Kombination separat berichtet,
fehlende Wirkung gilt als Fehler und wird nicht aus den Samples entfernt.
Sichtbare Wirkung zählt erst bei verändertem Terrainbild, ohne Cursorbewegung
oder bloßen DB-Revisionswechsel als Ersatz. Verschiedene Eventdichten und
stationäres Halten prüfen zusätzlich die Formstabilität.

Die Leistungsqualifikation verwendet eine versionierte Messfixture samt
automatisiertem Eingabereplay.
Vor der ersten Baseline werden Ausgangshöhen je Werkzeug, Pfade, Gestendauer,
Stärke, Randabfall, Roughness, Seeds, Reihenfolge und Rücksetzpunkte in einem
Manifest eingefroren. Jeder Versuch startet vom gleichen definierten Höhenstand;
Glätten erhält eine nichtflache Fläche. Genau 30 vorab geplante Versuche pro
Kombination werden ausgewertet: keine Ersatzversuche für verworfene Eingaben
oder fehlende Wirkung. Anfang/Ende werden auf derselben Renderer-Zeitbasis
gemessen: Eingang des Pointerereignisses bis zum ersten nachgewiesen geänderten
Terrainframe. Methode und Beobachteraufwand dokumentieren; Cursor-/Overlaywechsel
und LOD-Nachladung dürfen keine Pinselwirkung vortäuschen. Physische
Bildschirmausgabe wird durch GPU-/Framebelege nicht behauptet.

Vorhandene Werkzeuge erhalten die erste Baseline; noch fehlende Spezialpinsel
werden als nicht implementiert ausgewiesen. Ihre erste implementierte Baseline
bindet ebenfalls Manifest und Quellstand. Vergleichswerte benutzen immer
dieselbe Fixture-/Replayversion und dieselben Einstellungen.

Navigation: drei kontinuierliche Welt→Raum→Welt-Läufe pro Skalierung und
Neigung 0/45/75 Grad, mit festen Geländeankern und denselben Quellen. Kalte
Nachladung separat protokollieren; nach zehn Hin-/Rückfahrten dürfen Cache- und
GPU-Ressourcen nicht laufend anwachsen. Ausgeblendete Details ersetzen keinen
Leistungsnachweis bei der festgelegten Bildqualität.

Die aktuelle Implementierung und ihr Prüfstand sind am integrierten Quellstand zu
prüfen. Frühere Teilprüfungen ersetzen keine aktuelle Funktions- oder Leistungsabnahme.
Fachbindung: HEX-16 für Relief, HEX-06/08 für Maßstäbe und große Karten; Wasser
konkretisieren die [Landschaftswerkzeuge](../contract/landscape-tools.md).
Bestehende Abnahmestände und ursprüngliche Quellenbindungen bleiben erhalten.

## Ziel und festgelegter Umfang

Der Atlas erhält eine kontinuierliche Höhenlandschaft mit zusammenhängenden Gebirgen, Tälern, Pässen und Plateaus. Dieselbe perspektivische Kartenfläche zeigt das gezeichnete Gelände in Draufsicht oder geneigt; Gebäude erscheinen als Baukörper mit Dächern. Gelände, Grundrisse und Innenräume bleiben auch bei geneigter Kamera bearbeitbar.

- Höhen bestimmen Land und Meer automatisch. Küsten entstehen am Schnitt mit dem Meeresspiegel.
- Höhen, Steigungen und Streckenprofile sind abfragbar. Bestehende Höhennutzer werden angeschlossen; neue Reise- und Sichtregeln gehören nicht zu dieser Roadmap.
- Bestehende Testdaten benötigen keine Migration. Entwicklung und Abnahme verwenden neue Testkampagnen; vorhandene Daten werden nicht automatisch gelöscht.
- Gezeichnetes Relief ist der Standardstil. Höhenlinien und Höhenfarben sind zuschaltbare Analyseansichten.
- Vollständige Dungeonvisualisierung in 3D, freie Begehung, Überhänge, Höhlenmodellierung, Erosionssimulation und automatische Flusssysteme bleiben spätere Erweiterungen.

## Technische Grundlage

**Ein gemeinsames Höhenmodell.** Gelände besitzt eine Höhe in Weltmetern unabhängig vom Hexraster. Hexes bleiben räumliche Spielstruktur und Abfrageebene. Die heutige Landmaske wird für neue Geländedaten durch eine aus Höhe und Meeresspiegel abgeleitete Maske ersetzt. Farbe, Geländeart und Klima bleiben eigene Eigenschaften.

**Lokale Verfeinerung statt weltweiter Vollauflösung.** Höhen werden räumlich gekachelt und in mehreren Auflösungen verarbeitet. Feine, ausdrücklich bearbeitete Bereiche bleiben bei groben Änderungen geschützt. Zoom lädt oder vereinfacht Darstellung; er erzeugt keine Landschaft. Höhenabfragen verwenden den maßgeblichen Datenstand und melden ihre tatsächliche Auflösung.

**Eine gemeinsame Kartenfläche.** Die frühere Aufteilung in Canvas-Draufsicht und orthografische Geländeansicht ist durch die gemeinsame perspektivische Hauptkamera ersetzt. Draufsicht, Neigung und Drehung teilen Daten, Auswahl und Werkzeuge. Die Wahl der Engine ist gemäß aktueller Atlas-Roadmap offen.

**Aktuelle Speichergrenze.** Der [kanonische Store-Worker](../../project/architecture/canonical-store-worker.md) besitzt SQLite; der Renderer bekommt begrenzte Bereichsdaten über Preload. Höhenänderungen nutzen bestehende Revisionen, Transaktionen, Undo/Redo und Archive. Geometrien, Schattierungen und Übersichtskacheln sind abgeleitete Daten.

Neue fachliche Schnittstellen:
- Terrainänderungen durch Land formen und Glätten; Farbe bleibt getrennt.
- Bereichs- und Punktabfragen für Höhe, Neigung, Normalen, Auflösung und Datenrevision.
- Streckenprofile mit Entfernung, Höhenverlauf sowie Auf- und Abstieg.
- Vertikale Objektbindung: Geländeanker plus Höhenversatz oder ausdrücklich feste Höhe.
- Gemeinsamer Ansichtsstatus mit Mittelpunkt, Maßstab, Drehung, Neigung und rein visueller Höhenüberhöhung.

## Lieferetappen

### R0 — Darstellung und Bedienbarkeit als isolierten Prototyp prüfen

Eine feste Testlandschaft erstellen: Küste, verzweigtes Gebirge, breites Tal, Pass, Plateau, Fluss und Bergdorf. Dieselben Daten in Draufsicht und gekippter Ansicht zeigen. Weiche Schattierung allein und Schattierung mit zurückhaltenden Felsstrichen vergleichen. Drei Maßstäbe prüfen: Kontinent, Region und Ort. Bereits hier Kamerabewegung, Geländetreffer und einfachen Höhenpinsel im nativen Electron-Fenster erproben.

Abnahme: Gebirge und Pass sind in beiden Ansichten verständlich; Ortsnamen bleiben lesbar; die gezeichnete Variante erhält eine visuelle Nutzerabnahme. GPU-Darstellung funktioniert auf dem vorgesehenen Laptop. Erst danach beginnt Produktintegration.

### R1 — Höhenkern, Speicher und automatische Küsten

Gekacheltes Höhenmodell einschließlich lokaler Verfeinerung, gemeinsamer Abfragen und versioniertem Speicherformat einführen. Meeresspiegel ist eine Kampagneneinstellung, anfangs 0 Meter. Unbearbeitete Bereiche liegen darunter. Land und Meereswasser ausschließlich aus dem wirksamen Höhenfeld ableiten. Landwerkzeuge bearbeiten künftig dieses Feld; keine zweite unabhängig schreibbare Landmaske. Farbe bleibt getrennt.

Die Punktabfrage zeigt neben der Höhe die tatsächliche Datenauflösung. Bei Land formen und Glätten steht die Pinselauflösung direkt beim Radius. Trifft ein gröberer Pinsel auf ausdrücklich feinere Daten, erklärt ein Hinweis den Schutz und verweist auf einen kleineren Radius; nur im Bildschirmgrößenmodus hilft auch näheres Heranzoomen. Während des Malens erscheint dieselbe Rückmeldung am Kartenpunkt, damit sie auch bei vergrößerter Oberfläche und gescrollten Einstellungen sichtbar bleibt. Der Schutz selbst bleibt unverändert.

Süßwasser bleibt ein Autorenobjekt mit Wasserstand und begrenzter Fläche. Sichtbare Wasserfläche berücksichtigt Gelände; automatische Überläufe und Abflussberechnung sind ausgeschlossen.

Abnahme: Insel anheben, Meerenge absenken, rücknehmen und nach Neustart wiederfinden. Vorschau, Küste, Punktabfrage und gespeicherter Zustand stimmen auch an Kachelgrenzen überein.

### R2 — Erste benutzbare Höhenbearbeitung in Draufsicht

Drei Landpinsel: Land formen mit Erhöhen/Absenken, Stärke, Roughness und optionaler Zielhöhe; Land bemalen mit Farbradierung; Glätten mit eigener Stärke. Größe in Weltmaßen und weicher Rand sichtbar einstellbar. Eine aktive Zielhöhe begrenzt die gewählte Richtung ohne Überschwingen oder Gegenbewegung; Roughness verändert niemals die Operationsart. Küstenänderung bereits in der Vorschau. Einfache Reliefschattierung, Höhenwert am Cursor und optionale Höhenlinien. Geste = ein Undo-Schritt; Abbruch und Schreibfehler erhalten Ausgangsstand beziehungsweise Entwurf.

Abnahme: Küstenregion mit Hügeln, Hochfläche und Tal vollständig erstellen, korrigieren, speichern und als Bild ausgeben. Erster produktiv nutzbarer Zwischenstand mit echten Geländeformen und Küstenkopplung.

### R3 — Geländeformen schnell erstellen (vollständiger Abschluss offen)

Der Ausschluss spezieller Formenwerkzeuge vom 20.10.2026 ist durch den jüngeren
[verbindlichen Feature-Auftrag](../architecture/unified-spatial-atlas.md#funktionsumfang)
überholt. Hügel, Bergketten, Schluchten und vergleichbare Formen sollen mit wenigen
Eingaben entstehen und anschließend mit Sculpt und Smooth bearbeitbar bleiben.
Lokale Verfeinerung, geschützte Details und Undo/Redo bleiben erforderlich.
Für den aktuellen Lieferfokus gilt das oben bestätigte direkte Pinselmalen ohne
gesonderten Vorschauschritt. Die [direkten Formpinsel vom 27.10.](../contract/landscape-tools.md#direkte-terrainformpinsel--27102026)
sind implementiert; Grundpinsel allein erfüllen diesen Umfang nicht.
Ein Höhenkartenimport wird durch den Feature-Auftrag nicht zusätzlich beauftragt.

Abschluss: Gebirgskette und Schlucht erzeugen, lokal korrigieren, in Kontinent-,
Regions- und Ortsmaßstab sowie geneigt prüfen; Undo/Redo und frisches Öffnen
bewahren Form und feine Korrekturen. Offen sind die vollständige Form-/Darstellungs-
und Zielgerätequalifikation; der [Prüfstand](../../project/verification/end-to-end.md#terrain-wasserbelege-und-zielgerät)
trennt vorhandene Anschlüsse und begrenzte Belege von diesen Abschlüssen.

### R4 — Den gezeichneten Kartenstil ausarbeiten

Weiche Schattierung, betonte Grate und hangorientierte Felsstriche kombinieren. Flache Bereiche bleiben ruhig; Steilheit steuert Felsdarstellung. Maßstabsgerechte Details ohne Flimmern oder Kachelnähte; große Formen bleiben in Übersicht erkennbar. Palette, Licht und Strichstärke bilden gemeinsames Stilprofil.

**Ergänzung vom 23.10.2026:** Gebirge modulieren Geländefarbe und Textur anhand tatsächlicher Höhe und Hangneigung. Steile Hänge wirken steiniger; Gipfel oberhalb einer einstellbaren Schneegrenze erhalten Schnee mit weichem Übergang. Dies ersetzt den früheren Ausschluss höhenabhängigen Schnees. Die Modulation wird aus dem Höhenmodell abgeleitet und überschreibt weder gemalte Grundfarben noch gespeicherte Geländearten. Sie gilt in der gemeinsamen Atlasansicht bei Draufsicht, Neigung und Drehung sowie in der Bildausgabe. Zoom verändert die Detaildichte, nicht die physische Schneegrenze. Höhenüberhöhung ist rein visuell; sie verschiebt weder Schneegrenze noch Materialzuordnung. Die festen physischen Höhenstufen der Höhenlinien bleiben davon unabhängig.

Abnahme: R0-Landschaft mit den drei Landpinseln nachbauen und in drei Maßstäben vergleichen; Beschriftung, Straßen, Küsten und PNG visuell prüfen. Für die Ergänzung vom 23.10.2026 zusätzlich flache Hochflächen, steile Hänge und Gipfel unterhalb, innerhalb und oberhalb des Schneeübergangs vergleichen. Anheben, Absenken, Glätten und Ändern der Schneegrenze aktualisieren die Darstellung nachvollziehbar; Undo/Redo und frisches Öffnen stellen denselben Zustand wieder her. Pan, Zoom und Kameraneigung erzeugen keine wandernden Texturen, Kachelnähte oder sprunghaften Materialwechsel. Große Pinsel und volle Weltkarten behalten die gemeinsamen Reaktionsziele. Frühere R4-Nachweise belegen diese Ergänzung noch nicht. Der [Materialschritt im gemeinsamen Rasterkern](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/atlas-mountain-material-20261023/README.md) setzt Farbe, Textur und einstellbare Schneegrenze um; die unmittelbare Materialreaktion während großer Sculpt-Gesten und die vollständige Leistungs-/Gestaltungsabnahme bleiben offen.

### R5 — Kippbare Ansicht und direkte Geländebearbeitung integrieren

Prototyp-Renderer an produktive Terrainabfragen anschließen. Maßstabsabhängige Geometriedichte und kameranahe Koordinaten. Ansichten teilen Auswahl, Mittelpunkt, Werkzeuge und History; direkte Rückkehr zur Draufsicht. Höhenüberhöhung bleibt visuell. Alle drei R2-Landwerkzeuge funktionieren auf sichtbarer Oberfläche. Treffpunkt und Radius korrekt in Weltkoordinaten zurückführen, auch bei Überhöhung; verdeckte Teile nicht versehentlich mitbearbeiten.

Abnahme: Pass in gekippter Ansicht absenken, Draufsicht, Undo/Redo. Position, tatsächliche Höhe und Küste identisch.

### R6 — Straßen, Wasser, Gebäude und Höheninformationen verbinden

Der Straßen-/Flussteil ist nach dem [ergänzten Plan](../contract/terrain-routes.md) lokal implementiert; [Prüfungen und Bilder](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/terrain-routes-20261020/README.md) dokumentieren den Stand. Die folgenden Gebäude-/Dungeoneingangsarbeiten bleiben offen.

Straßen/Flüsse auf Gelände darstellen. Die Nutzerentscheidung vom 20.10.2026 erweitert diesen Teil um [geländegebundene Trassenplanung](../contract/terrain-routes.md): Autoren setzen Pflichtpunkte und Eingriffsgrenzen; Trasse und Geländeform dürfen sich innerhalb dieser Grenzen gemeinsam anpassen. Ein Schutzschalter begrenzt andernfalls den Geländepinsel örtlich, ungeschützte Konflikte bleiben sichtbar. Einfache Baukörper/Dächer aus Grundrissen; vorhandene Geschosshöhen verwenden, fehlende Bauhöhen als editierbare Vorgaben. Gebäude waagerecht, bei Bedarf Fundamente. Geländegebundene Gebäude folgen Anker als Ganzes; Grundrisse/Geschossabstände/Innenräume nicht verformen. Dungeoneingänge mit Höhenanker. Auswahl öffnet dieselben Orte/Keys; Grundrissbearbeitung führt mit Fokus in Draufsicht.

Höhe, Hangneigung und Streckenprofil anschließen. Wetter und bestehende hexbasierte Sichtprüfung lesen dasselbe Modell, übrige Regeln unverändert.

Abnahme: Bergdorf, Passstraße und Eingang platzieren, Gelände ändern und Bindungen prüfen; Streckenprofil über Pass stimmt.

### R7 — Ausgabe, große Karten und Produktabnahme

Beide Ansichten als PNG/JPEG mit gewählter Perspektive, Ausschnitt, Stil und Überhöhung. Spieleransicht/-export enthalten ausschließlich freigegebene Inhalte. Große verteilte Landschaft: grobe Übersicht zuerst, Details nachladen, überholte Anfragen verwerfen, Ressourcen freigeben. Bei GPU-Ausfall gespeicherten Stand in Draufsicht zugänglich halten.

Endabnahme: Neue Region vom leeren Meer bis Gebirge/Pass/Dorf/Eingang erstellen; in beiden Ansichten korrigieren, neu öffnen, Profil prüfen und Bilder ausgeben.

## Prüfung und Lieferung

- Daten: bekannte Höhenflächen, Küstenschnitt, negative Koordinaten, Kachelränder, Auflösungswechsel, geschützte Details, Abbruch, Undo/Redo, Schreibfehler und Archivwiederherstellung.
- Darstellung: feste Szenen für Draufsicht/Neigung; Küsten/Grate/Beschriftung/Gebäude in mehreren Maßstäben; visuelle Beurteilung zusätzlich zu Bildtests.
- Bedienung: vollständige native Abläufe mit tatsächlichen Eingaben, Werkzeugwechsel, verdeckter Auswahl und Rückkehr zur Draufsicht.
- Leistung: Die ältere R0–R7-Planung nannte ein 16-GiB-Gerät und 30 FPS. Für die aktuelle Lieferung gelten der oben festgelegte [Messvertrag und TW-G5](#ziele-und-abnahme-dieser-etappe), einschließlich des aktuellen Zielgeräts und p95 je Versuchsgruppe; dies sind Ziele, keine vorhandenen Belege.
- Pro Etappe betroffene Tests/Builds, native Prüfung und erforderliche Candidate-CI. Quellprüfung, Paketprüfung, Integration und Nutzerabnahme getrennt.
- HEX-16 konkretisiert diese Etappen; HEX-06/08 tragen Maßstäbe/große Welten. Bergsymbole in HEX-18 durch native Geländeformen ergänzen/ersetzen; allgemeine Symbol-/Waldwerkzeuge erhalten. Ursprüngliche Quellenbindungen erhalten. Testdateien nach tatsächlichem Inhalt im Fähigkeitskatalog zuordnen.
- Aktuelle Einstiege sind [docs/INDEX.md](../../INDEX.md) und die [Atlasarchitektur](../architecture/unified-spatial-atlas.md). Der frühere Verweis auf ROADMAP-HEX-ATLAS.md und die Terminregel vor R0 gehören zum historischen Etappenplan; die aktuelle Lieferung folgt den Ergebnisabschnitten oben.
