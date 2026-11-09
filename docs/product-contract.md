# Produktvertrag

Verhalten, Format und Grenzen des Atlas-Editors. Umsetzung: [Architektur](architecture.md);
Prüfstand: [Status](implementation/status.md); Befehle: [README](../README.md).

Die bestehenden Abschnitte beschreiben den weiterhin aktiven Atlas V7. Für den
separat gestarteten, begrenzten P0-Höhenversuch gilt ausschließlich der ergänzende
[P0-Abschnitt](#optionaler-atlas-p0-versuch); er übernimmt noch nicht den gesamten
V7-Funktionsumfang oder die Arbeitspakete P1–P9.

## Koordinaten, Eigentum und Lebenszyklus

| Größe                     | Vertrag                                                         |
| ------------------------- | --------------------------------------------------------------- |
| Außenkoordinaten / Winkel | Endliche Fuß innerhalb ±100.000.000 / endliche Radiant          |
| Innenraster               | 5 × 5 Fuß; ganzzahlige Zellkoordinaten innerhalb ±1.000.000     |
| Geschosse                 | i32; negative Werte sind Keller                                 |
| Namen                     | 1–120 Unicode-Codepoints, nicht ausschließlich Unicode-Leerraum |

Ungültige Namen bleiben mit Feldfehler korrigierbar, ohne Kürzung oder Übernahme.
Fehler und No-ops verändern weder Autorendaten noch Zähler oder History.

Eine Parzelle besitzt Polygon und Rasterrahmen auch ohne Haus. Dessen Ursprung
liegt in der Frontmitte, lokale +y zeigt von der Straße weg. Höchstens ein Haus
gehört über `placement.parcelId` zu einer Parzelle; beliebig getrennte
Raumgruppen bleiben unter diesem Hausowner. Seine `gridPose` enthält ganzzahlige
`xCells/yCells` (auch negativ) und `quarterTurns` aus 0,1,2,3. Weltpose entsteht
kanonisch aus Rahmen, Zelloffset und Vierteldrehung. Das gilt auch nach dem Lösen
der Parzelle von der Straße und bei Alt-Eingabe. Rotation erfolgt um den
Hausrasterursprung, nicht um den Bounds-Mittelpunkt. Freie Häuser besitzen einen
freien Welttransform und ein hauslokales Raster. Über Grundstücksgrenzen ziehen
führt zu keiner impliziten Umzuordnung oder Hausvereinigung.

`contours` ist die Dachkontur aller nichtnegativen Geschosse mit erhaltenen
Löchern; Keller bleiben unsichtbar unter dem Dach. `occupancyContours` projiziert
dagegen alle Geschosse einschließlich Keller und bestimmt Grundstückscontainment
sowie Kollisionen mit Häusern, Straßen, Wasser und fremden Parzellen. Nachbarhäuser behalten ihr Dach, während
ein Haus geöffnet ist.

Erstes Zeichnen auf einer leeren Parzelle erzeugt auf dem gewählten Geschoss
einen Hausowner; weitere getrennte Räume ergänzen ihn. Mit dem letzten Raum
entfällt das Haus, die Parzelle bleibt erneut bebaubar.

| Aktion               | Folge                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Haus löschen         | Parzelle bleibt leer                                                                               |
| Parzelle löschen     | Haus entfällt mit                                                                                  |
| Straße löschen       | Gebundene Parzellen samt Häusern entfallen; gelöste bleiben                                        |
| Parzelle herauslösen | Polygon, Rahmen und Raster einfrieren; Hauspose/Innenraum erhalten; Undo stellt Bindung wieder her |

## Straßen, Gelände und Konflikte

Straßen besitzen Breite 2–100 Fuß, Material `earth`/`stone` und kubische Bézier-Knoten.
Knoten-/Section-IDs bleiben stabil; jede Kante gehört einer Section, deren Kanten
einen zusammenhängenden orientierten Block bilden. Sections speichern bearbeitete
Seiten. Parzellenintervalle verwenden relative Sectionbogenlänge
`0 ≤ start < end ≤ 1`. Kreuzungen sind erlaubt, ein Verkehrsgraph existiert nicht.

`createRoad` und `extendRoad` erhalten neue Nodes ohne IDs und eine ausdrücklich
nullable Population. `updateRoad` erhält exakt die gespeicherte Node-ID-Sequenz;
Sections, Marker und Rezept vergibt der Kern. Topologie ändern ausschließlich:

- `insertRoadNode`: Kante über `afterNodeId` und `0<t<1`; De-Casteljau-Split im
  Kern, beide Teilkanten behalten die Section-ID.
- `deleteRoadNode`: Binnenknoten nur bei gleicher Nachbarsection; mindestens
  zwei Nodes bleiben. Belegte Sections dürfen nicht verschwinden, Grenzen
  unterschiedlicher Sections werden nicht implizit vereint.
- `extendRoad`: neue Abschnitte an Anfang/Ende ohne Umnummerieren alter
  Nodes/Sections oder Wechsel der Seitennamen. Der alte äußere freie Griff darf
  angepasst werden; bestehende Kanten bleiben erhalten. Startverlängerung kehrt
  nur neue Nodes samt Griffen in endgültige Straßenrichtung um.

Abflachung verwendet 0,05 Fuß Genauigkeit, höchstens 512 Nodes und 32.768 Samples
für die ganze Straße. Jede Section benötigt positive Länge; Nullsegmente unter
`1e-7` entfallen. Straßenkollision verwendet den abgeflachten Pfad mit runden
Kappen. Ein Kurvensplit erhält dieselbe Mittellinie innerhalb der
Abflachungsgenauigkeit; verstärkte Offset-/Tangenten-/Hausposeänderungen werden
kanonisch neu abgeleitet und vollständig geprüft.

Materialflächen sind einfache geschlossene Polygone mit 3–2.048 Punkten und Material
`grass`, `earth`, `stone` oder `water`; `Area.order` bestimmt ihre
Erstellungsreihenfolge. Wasser bleibt auch unter späteren Flächen ein Hindernis.
`createArea/updateArea` erhalten keine leeren IDs und kein clientseitiges Order.
Nichtwasser-Gelände darf überlagert werden.

Kollisionen prüfen Haus gegen Haus/Straße/Wasser und Parzelle gegen fremde
Parzelle/Hausbelegung/Straße/Wasser. Der eigene Hausowner ist ausgenommen, seine
Allfloor-Belegung muss aber vollständig im Grundstück liegen. Randberührung ist
zulässig; Überschneidung oberhalb der Toleranz blockiert die gesamte Aktion ohne
Herauslösung, Reparatur oder Teilübernahme. Die Regeln gelten symmetrisch auch
für freie Häuser, reine Kellerhäuser und Innenraumerweiterungen.

Parzellenfront und Rücken entstehen als Miter-Offsetketten mit Limit 4 und
geraden Endkanten. Spitzen, Umkehr, Selbstschnitt/-berührung, Nullfläche,
Weltüberschreitung oder mehr als 2.048 Polygonpunkte sind ungültig. Ringe sind
offen, positiv orientiert, mit lexikographisch kleinstem Startpunkt; der Rahmen
liegt in der Bogenlängenmitte der Front, am Join mit Winkelhalbierendentangente.
Zur Tangente `(tx,ty)` ist links `(ty,-tx)`, rechts `(-ty,tx)`; keine Spiegelung.

Robuste Parzellenprädikate verschieben beide Operanden um den gemeinsamen Boundsmittelpunkt.
Mit `M = max(1, größte absolute ursprüngliche Weltkoordinate)` gilt
`epsilon = 1e-6 + 1e-12*M` Fuß. Containment prüft erst exaktes Covers, dann das um
epsilon gepufferte Grundstück. Schnittfläche ist Konflikt oberhalb
`epsilon*min(UmfangA,UmfangB) + PI*epsilon²`, einschließlich Lochumfängen.
Prüfpuffer werden nicht gespeichert. Eine gebundene Weltpose toleriert allein
Rechenrauschen bis `1e-8` Zellen und `1e-10` Radiant vor exakter kanonischer
Komposition; halbe Zellversätze oder freie Winkel werden nicht eingerastet.

## Deterministische Bebauung

Rezeptversion **4**: Seed, Section-/Seitenidentität und Ausgangsbestand bestimmen
den Verbund deterministisch. Bebauung startet mit „Parzellen und Häuser“; alternativ stehen „Nur Parzellen“
und „Keine“ zur Wahl. Modus und Vorgaben bleiben sitzungsweit erhalten. Bestehende Straßen laden ihr
Rezept. „Neue Variante“ betrifft nur offene Kandidaten/neue Parzellen, niemals
bestehende Häuser oder Maße.

| Einstellung              | Standard und Grenze                         |
| ------------------------ | ------------------------------------------- |
| Seiten                   | beide; wählbar links/rechts/beide           |
| Straßenabstand `setback` | 5 Fuß; 0–1.000 Fuß                          |
| Hausabstand `gap`        | 10 Fuß; 0–1.000 Fuß                         |
| Breite                   | 4–7 Zellen; Bereich 1–64                    |
| Tiefe                    | 4–8 Zellen; Bereich 1–64                    |
| Seed                     | 1; u32                                      |
| Parzellentiefe           | Auto: `5*maxDepth+gap`; manuell 5–2.000 Fuß |

Front liegt bei Straßenhalbbreite plus Setback ohne Rasterrundung. Für gewürfelte
Breite `w` ist Frontage `5*(w+w%2)+gap`; bevorzugte Hauspose ist
`(-floor(w/2),0,0)`. Ungerade Breiten dürfen sichtbar 2,5 Fuß asymmetrisch sein,
bleiben aber vollständig im Raster. Hausabstand ist eine Generierungsvorgabe;
nach manueller Bearbeitung gelten Containment und Kollisionsfreiheit.

Reihenfolge: Sections in Straßenreihenfolge, links/rechts, Slots vom
Abschnittsanfang. Jeder Slot zieht genau Breite, Tiefe und Dachindex vor
Konfliktprüfung. Die letzte Front wird auf die verbleibende Abschnittslänge
gekürzt und ebenfalls geprüft.
Der Zufallsstrom ist FNV-1a-u32 über ASCII `saltmarcher.parcels`, NUL, `v1`, NUL,
Seed u32LE, Section-ID-Bytelänge u32LE, UTF8-ID und Seitenbyte 0/1; Start
2166136261, Faktor 16777619, wrapping u32. Anschließend LCG
`1664525*x+1013904223`, wrapping u32, Bereich per Modulo. Die `v1`-Hashdomäne
bleibt im Rezept 4 erhalten. Skips und Suchposen ziehen keinen neuen Zufall.

Die automatische Planung probiert zuerst die bevorzugte Front und Tiefe.
Bei Geometriefehlern, Kollisionen oder fehlendem Hausfit folgen flachere Grundstücke
in 5-Fuß-Schritten bis zur Mindesthaustiefe, dann kürzere Fronten in 5-Fuß-Schritten
bis 2,5 Fuß. Auch ein kurzes Mittellinienintervall kann an der Außenkurve eine
ausreichend breite Front ergeben; die exakte Hausprüfung entscheidet. Zusätzlich werden für Innenkurven um 5 beziehungsweise
10 Fuß und auf das 1,5-Fache verbreiterte Fronten geprüft. Fronten werden auf den
Abschnittsrest begrenzt; doppelte Varianten entfallen. Abstand, Mindesthausmaße,
Raster und Kollisionsregeln bleiben verbindlich. Nach vollständig erfolgloser
Suche geht es nur 2,5 Fuß weiter, statt eine ganze Hausbreite zu überspringen.
Explizit angepasste Planungen behalten ihre Fronten und Tiefen unverändert.

Zuerst wird das Grundstück geprüft, dann werden die vorgeschlagenen Hausmaße im
Raster gesucht. Ohne Fit werden kleinere Maße innerhalb der Mindestmaße geprüft:
absteigende Fläche, bei Gleichstand absteigende Breite; keine Drehung oder
Neuwürfelung. Jede zusätzliche Größenprobe verbraucht einen Versuch. Dies gilt
nur für neue Hausvorschläge, niemals für bestehende Häuser. Die endliche lazy Suche
ordnet nach `(abs(x-x0),y,x)`, `x0=-floor(width/2)`, `y≥0`; die erste vollständig
enthaltene kollisions-/abstandsfreie Pose gewinnt. Es werden alle zulässigen
Tiefen einer bevorzugten x-Distanz vor der nächsten Distanz geprüft. Bounds
begrenzen den Suchraum konservativ, exakte Prädikate entscheiden.

Automatische Hausplanung reserviert nach erfolgloser Variantensuche kein leeres
Grundstück, das spätere Hausplätze blockieren würde. Explizite Planungen und bewusst
unterhalb der Mindesthaustiefe eingestellte Grundstücke dürfen leer bleiben:
`noGridFit` bedeutet keine enthaltene Pose, `clearanceBlocked` mindestens eine
enthaltene, aber blockierte Pose. „Nur Parzellen“ benötigt weiterhin keinen Hausfit.
Ungültige Grundstücke werden ausgelassen.
IDs/Namen entstehen erst für den fertigen Verbund; Häuser erhalten sie nur bei
tatsächlicher Befüllung.

Limits: **200 gebundene Parzellen je Straße** (auch leere, ohne gelöste); je
Generierung **200 neue Häuser**, **100.000 neue Zellen**, **10.000 Versuche**.
Slot, jede zusätzliche Grundstücksvariante und jede Pose verbrauchen vor Prüfung dasselbe Versuchsbudget. Die letzte
erlaubte Pose darf abschließen; Budgetende im Slot verwirft nur diesen Slot ohne
Erzeugungs-/Skip-/Unplaced-Zählung. Fertige Vorgänger bleiben vorgeschlagen.
Bei gleichzeitig erreichten Limits hat die Parzellengrenze Vorrang.

Begonnene Sectionseiten gelten auch bei ausschließlich ausgelassenen Kandidaten
als bearbeitet; noch nicht begonnene bleiben offen. Erneutes Populate befüllt
keine alten leeren oder gelöschten Parzellen nach. Einstellungen gelten für neue
Parzellen; bestehende Intervalle, Setback, Tiefe und Innenräume bleiben erhalten.
Ein Rezeptupdate allein kann eine Revision erzeugen; identischer Aufruf ohne
offene Seiten ist No-op. Straßenänderungen prüfen sämtliche abhängigen
Parzellen und Hausheader gemeinsam und erhalten lokale Innenbytes/Gridpose.

Vorschau und erfolgreicher Commit liefern `generationSummary`,
`generationDiagnostics` und `generationLimit`. Die Summary zählt nur neue
Kandidaten, keine Followheader. Es gilt
`emptyParcels = createdParcels-createdHouses`; `unplacedHouses` entspricht der Anzahl
der Hausdiagnosen. Bei „Nur Parzellen“ sind leere Grundstücke beabsichtigt und
haben keine Hausdiagnose; `skippedParcels` zählt Grundstücksdiagnosen.
`limited = (generationLimit !== null)` mit
`boundParcels|newHouses|newCells|attempts|null`. Ein Limit ist kein Skip.
Parzellendiagnosen `invalidParcelGeometry|parcelCollision` tragen Source und
Slot, aber keine erfundene Parcel-ID; Hausdiagnosen tragen die echte ID der
behaltenen Parzelle. Bei ungültigem Gesamtplan sind dies ausschließlich
vorgeschlagene Daten; andere Intents liefern Nullwerte/leere Diagnostik.

## Innenräume und stabile lokale Identitäten

Ein Raum enthält zusammenhängende 4-Nachbarzellen eines Geschosses. Draw vereint die Auswahl mit den durch ausgewählte Zellen getroffenen Räumen;
das älteste `created` erhält ID und Namen. Der resultierende Draw-/Assign-Raum
muss zusammenhängend sein; leere Auswahl und doppelte
Zellen folgen den unveränderten No-op-/Aktionslimitregeln. Erase zerlegt
betroffene Räume: größter Rest behält die Identität, Gleichstand entscheidet
kleinstes `(y,x)`; andere Teile erhalten neue lokale IDs/Namen. Assign überträgt
nur tatsächlich belegte ausgewählte Zellen. Leere Räume entfallen.

Raumbewegung erlaubt Selbstüberlappung und Nullmove, lehnt Kollision und
Koordinaten-/Rechenüberlauf atomar ab und verschmilzt berührte Räume nicht.
Eigene Außentüren wandern mit; innere Öffnungen und Treppen behalten ihre
ursprünglichen Endpunkte und Position oder werden entfernt, wenn dort ungültig.
Eine fremde Außentür am neuen Zielrand wird nach denselben Geometrieregeln
bereinigt. Geometrieänderungen dürfen gültige Verbindungen retargeten;
Raumbewegung erfindet keine neuen Endpunkte.

Türen und Durchgänge liegen auf horizontalen/vertikalen Wänden, innen zwischen
zwei Räumen oder außen. Create/Convert/Delete prüfen Seitenbelegung,
Überlappung und Duplikate. Neue Öffnungen besitzen Offset 0; bestehende IDs
behalten Offset 0 oder 0,5. Bei halbem Offset muss auch das zweite Wandsegment
durchgehend dieselbe Seitenbelegung besitzen, sonst entfällt die Öffnung.

Treppen verbinden benachbarte Geschosse in vier Richtungen mit Länge **2–64
Zellen**, ohne halben Zelloffset. Up/down normalisiert dieselbe physische Treppe.
Ihr vollständiger Fußabdruck gehört je Geschoss genau einem Raum, ohne Lücke
oder Treppenüberlappung, auch auf nur einem gemeinsamen Geschoss. Dies gilt
auch für Keller, Raumreassignment, Undo/Redo und Reopen.

Lokale Raum-/Connectionzähler überspringen bereits belegte syntaktische IDs und
Namenskollisionen. IDs, Namen, `created`, Zähler und kanonische Reihenfolge sind
Autorendaten, auch bei getrennten Raumgruppen. Duplikate, ungültige Referenzen,
Floors/Owner, negative/zu kleine Zähler oder Überlauf werden geprüft.
Draw-/Erase-/Assign-Auswahlen sind pro Aktion auf 100.000 Eingabeeinträge
begrenzt, vor dem Entfernen doppelter Zellen; rechteckige Hausgründung erzeugt
höchstens 100.000 Zellen;
es gibt keine allgemeine Gesamtzellgrenze pro Haus. Ein durch mehrere Aktionen
auf über 100.000 Zellen gewachsener Raum bleibt bewegbar.

## Bildschirmpinsel

Boden, klassische Höhenmodi, Gewässer, Landschaft und Regionen verwenden einen runden Pinsel mit 8–512
CSS-Pixeln Durchmesser, Vorgabe 80. `[`/`]` und Alt+Mausrad ändern ihn um etwa
zehn Prozent. Der Kreis bleibt zwischen Strichen beim Zoomen gleich groß;
Pointerdown fixiert den daraus berechneten Weltradius für die Geste. Aktive
Pinselgesten blockieren Zoom. Assetgröße, Stärke, Deckkraft und Farbfluss bleiben
unabhängig. Arbeitsbudgets gelten weiterhin; zu große Striche werden vollständig
abgelehnt statt still verkleinert. Bei Überschreitung der Höhenpunktgrenze nennt
die Fehlermeldung kleinere Pinsel beziehungsweise kürzere Striche als Abhilfe. Höhen prüfen vor Rasterarbeit zusätzlich
höchstens 400.000 Kandidatenpositionen pro Abdruck. Höhen und Gewässer zeigen
Weltdurchmesser und Höhenrasterabstand in Metern beziehungsweise ab einem Kilometer
in Kilometern mit höchstens drei signifikanten Ziffern; kleine Pinsel zwischen
Rasterpunkten können ohne Höhenänderung bleiben.

Der Höhenpinsel begrenzt seinen Auftrag an der Weltgrenze; ein überstehender
Pinselrand verwirft nicht den Strich innerhalb der Welt. Der Startpunkt muss
innerhalb der Welt liegen. Außerhalb wird keine Kartenfläche dargestellt;
beim Zeigen erscheint ein Hinweis auf die Weltgrenze.

## Regionen

„Regionen“ funktioniert im gesamten Außenzoom. Malen ergänzt die ausgewählte
Region, Radieren entfernt nur deren Fläche. Loslassen übernimmt einen Strich als
einen atomaren Historyschritt; Escape, Blur, Pointercancel und Werkzeugwechsel
verwerfen ihn. Ein Auswahlmodus trifft exakte Regionsflächen der aktiven Rangstufe.
Getrennte Teilflächen, Löcher und benannte leere Regionen sind erlaubt.

Regionen besitzen Namen, Rangstufe, Farbe, Fülltransparenz und Randstil.
Vorgaben: 15 % Füllung, 2 CSS-Pixel Rand, durchgezogen; alternativ gestrichelt
oder gepunktet. Randbreite 0,5–12 Pixel, Füllung 0–100 %. Keine Küstenerkennung,
Grenzrauheit oder Lasso. Füllung liegt unter Landschaft/Straßen/Häusern, Grenzen
und Namen darüber; Griffe behalten Vorrang.

Kategorien sind frei benennbar, sortierbar und ein-/ausblendbar. Jede besitzt
geordnete, bearbeitbare Rangstufen von klein nach groß. Neue Dokumente enthalten:

- Politisch: Viertel, Stadtteil, Ortschaft, Bezirk, Grafschaft, Herzogtum,
  Königreich, Kaiserreich. „Ortschaft“ umfasst Städte und Dörfer; dies ist eine
  bearbeitbare Fantasyvorlage, keine universelle Verwaltungsordnung.
- Geographisch: Örtlichkeit, Landschaft, Großlandschaft, Subkontinent, Kontinent.
- Ortschaften: Gehöft, Dorf, Stadt, Metropole. Dies sind gewöhnliche Regionen, keine zusätzlichen Objekte oder Hausowner.
- Eigene Kategorien starten mit „Gebiet“.

Politisch und Ortschaften sind zunächst sichtbar, Geographisch verborgen. Übermalen überträgt
Gebiet ausschließlich zwischen Regionen derselben Rangstufe. Andere Rangstufen
und Kategorien bleiben unverändert. Ein Wechsel der Regionszuordnung lehnt
Flächenkonflikte auf der Zielrangstufe ab. Löschen einer Region löscht keine
räumlich zugeordneten Regionen; Kategorie-/Ranglöschung entfernt die explizit
enthaltenen Einträge nach Bestätigung ihrer Anzahl. Änderungen verlangen erneute
Bestätigung. Die gesamte Aktion ist rückgängig machbar.

Zugehörigkeiten sind geometrische N:N-Beziehungen innerhalb einer Kategorie:
Jede untere Region gehört zu jeder höheren mit positiver Schnittfläche, unabhängig
von Zwischenstufen. Randberührung zählt nicht. Numerisches Flächenrauschen bis
`(1e-6 + 1e-12*M)²` Quadratfuß zählt als null, mit `M` als maximaler absoluter
Boundskoordinate beider Regionen, mindestens 1. Es gibt weder Elterncontainment
noch transitive Ersatzbeziehungen. Das Panel gruppiert Beziehungen nach Rangstufe
und zeigt den überdeckten Anteil der jeweils unteren Region.

Automatische Anzeige wählt pro sichtbarer Kategorie die nichtleere Rangstufe,
deren Median von `sqrt(Fläche)` projiziert 400 CSS-Pixeln am nächsten liegt
(logarithmischer Abstand). Die bisherige Stufe bleibt innerhalb von `ln(1,2)`
Abstand zur besten Wahl erhalten. Eine feste Rangstufe überschreibt die Automatik;
während der Bearbeitung ist die aktive Rangstufe sichtbar. Kategorieordnung
bestimmt die Zeichenreihenfolge.

Namen liegen standardmäßig an einem stabilen Innenanker des größten Flächenteils.
Sie erscheinen bei 80–1.400 Pixeln projizierter `sqrt(Fläche)` mit 14–28 Pixeln
Schriftgröße. Namensposition und unterer/oberer Anzeigezoom sind pro Region
anpassbar und auf Automatik zurücksetzbar. Auswahl und wichtige Orte haben vor
Regionsnamen Vorrang, danach folgen Straßen/Gebäude. Gemeinsame Kollisionsprüfung
und das Limit von 500 Beschriftungen bleiben erhalten.

Kategorien können „Kleine Regionen als Ortssymbole“ verwenden; für Ortschaften
ist dies vorgegeben. Ihre Rangstufen werden gemeinsam angezeigt. Unter 80 Pixeln
projizierter Flächengröße erscheint ein Punkt mit 13-Pixel-Beschriftung, auch
wenn die eigentliche Fläche kleiner als ein Pixel wird. Eine leere Region kann über
„Name platzieren“ einen Weltanker erhalten. Kategorien und Regionen bleiben frei
umbenennbar. Diese Darstellung erzeugt weder Bebauung noch Besitzbeziehungen.

Limits: 64 Kategorien, 512 Rangstufen, 100.000 Regionen; 100.000 Konturpunkte pro
Region, 4.096 Pfadpunkte pro Strich. Räumliche Reads betrachten höchstens 10.000
Bounds-Treffer, liefern höchstens 2.000 Regionen und 250.000 Konturpunkte.
Übersichten wählen vor dem Laden der Geometrien höchstens 1.000 Regionen nach
Flächengröße und ID; ausdrücklich angefragte Details bleiben enthalten. Auch
das Übersichtsverzeichnis ist auf 1.000 Einträge begrenzt. Erst das aktive
Regionswerkzeug lädt das vollständige Verzeichnis.
Übertragung und Beziehungsabfragen begrenzen ihre Geometriearbeit auf zwei
Millionen Konturpunkte. Grenzenfehler sind atomar. Regionen speichern kanonische
Multipolygone; Darstellung darf sie vereinfachen, Bearbeitung verwendet exakte
Flächen. Vorgegebene Katalogeinträge besitzen reservierte `builtin-`-IDs;
neu angelegte Kategorien, Rangstufen und Regionen nutzen den globalen Allocator.

## Bodenfarbpinsel

„Boden“ ersetzt das Erstellen neuer Materialpolygone in der Werkzeugleiste.
Bestehende Flächenobjekte bleiben auswählbar und bearbeitbar. In jeder Außenansicht
malt Ziehen oder Halten mit der linken Taste Bodenfarbe; Loslassen übernimmt einen
Strich als einen Historyschritt. Escape, Blur, Pointercancel und Werkzeugwechsel
verwerfen die laufende Geste. Deckkraft begrenzt den Auftrag pro Strich; Farbfluss
steuert den zeitlichen Aufbau. Erneutes Übermalen verstärkt beziehungsweise mischt
Farbe. Einstellungen werden beim Beginn eines Strichs fixiert.

Spitzen: weich, hart und wolkig; Vorgabe weich. Größe folgt dem gemeinsamen [Bildschirmpinsel](#bildschirmpinsel). Deckkraft und Farbfluss: 1–100 %, Vorgabe jeweils 100 %.
Farbvorlagen: Gras `#9db58b`, Erde `#c8b99b`, Stein `#aaa9a3`; Vorgabe Gras.
Freie Farbauswahl und Pipette ergänzen die Vorlagen. Die Pipette nimmt die ungeschattete
Farbe der gewählten Ebene in der dargestellten Rasterstufe auf, ohne Schnee oder
Schattierung. Der lokale Radierer entfernt nur Farbe dieser Ebene und legt ihren
natürlichen Grundton frei; er verwendet dieselben
Spitzen und Auftragsparameter. Größenänderung und Zoom folgen dem gemeinsamen Bildschirmpinselvertrag.

„Farbebene“ wählt Boden oder Fels. Beide speichern ihren Farbauftrag unabhängig.
Fels erscheint an steilen Hängen mit weichem Übergang zwischen 30 und 45 Grad;
sein natürlicher Grundton ist steingrau. Hohe Gipfel werden zwischen 3500 und
5000 Metern über Meeresspiegel zunehmend schneeweiß. Schnee liegt über beiden
Farben. Höhenänderungen passen die sichtbaren Materialbereiche an; verborgene
Farbaufträge bleiben erhalten. Die Regeln gelten auch ohne vorherige Bodenmalerei.

Bodenfarbe verwendet dünn belegte 64×64-Pixel-Autorenkacheln mit zwei getrennten
vormultiplizierten RGBA-Ebenen (Boden, dann Fels; insgesamt 32.768 Bytes). Die beim Strichbeginn feste Auflösung beträgt 2^Stufe Fuß (Stufen 0–24),
maßstabsabhängig ungefähr ein halbes bis ein Bildschirmpixel, mindestens einen Fuß.
Feinere Kacheln erben grobe Farbe; spätere grobe Striche bearbeiten vorhandene
Feinkacheln mit demselben Farbauftrag, ohne leere Feinraster anzulegen. Radierte
transparente Autorenwerte verdecken geerbte Farbe. Die Darstellung interpoliert weich,
erhält die Reliefschattierung und liegt unter Wasser, Landschaft, Straßen und
Gebäuden. Vollständig leere Darstellungskacheln übertragen einen leeren Pixelstring;
dies betrifft beide Farbebenen einschließlich ihrer Ränder und löscht keine Autoren.
Bodenfarbe verändert keine Höhen, Fundamente oder Kollisionen.
Ein Strich enthält höchstens 100.000 zeitgestempelte Pfadpunkte, dauert höchstens
eine Stunde und bearbeitet höchstens eine Million Rasterpixel einschließlich
betroffener vorhandener Feinkacheln. Die Berechnung ist
zusätzlich auf 100.000 Abdrücke und 40 Millionen Pixelprüfungen begrenzt; Überschreitung
lehnt den gesamten Strich ab. Weg- und Zeitabtastung sind von der Eingabeereignisrate
unabhängig; die Wolkenmaske ist durch den Seed reproduzierbar. Vorschau und Commit
teilen die Berechnung. Kein globales Füllen, Symbol-Einfärben oder Texturimport.

## Landschaftspinsel

„Landschaft“ malt zusammenhängenden Landschaftsbestand im gesamten Außenzoom.
Vorlagen sind Wald, Buschland, Wiese und Felsgebiet. Felsgebiet bezeichnet
landschaftliche Felsen; es ist unabhängig vom steilen Felsmaterial und dessen
Bodenfarbe. Pinselgröße folgt dem gemeinsamen Bildschirmpinsel. Zieldichte (5–100 %, Vorgabe 65 %)
bestimmt den gewünschten Bestand. Wiederholtes Übermalen nähert sich dieser
Dichte und erzeugt keine zusätzlichen gespeicherten Einzelobjekte. Andere
Landschaftsanteile werden dabei anteilig verdrängt. „Entfernen“ radiert alle
Landschaftsanteile lokal; Boden-/Felsfarbe und Höhen bleiben erhalten.

Loslassen übernimmt einen Strich als einen Historyschritt. Escape, Fokusverlust,
Pointercancel und Werkzeugwechsel verwerfen die laufende Vorschau. Einstellungen
und Autorenauflösung werden beim Beginn fixiert. Grobe Autoren werden beim
Hineinzoomen vererbt; spätere grobe Striche aktualisieren bestehende feine Autoren
mit demselben Auftrag, ohne ein leeres Feinraster über die ganze Welt anzulegen.
Explizit leere Autoren erhalten lokale Lichtungen gegenüber geerbtem Bestand.

Ein Strich erlaubt höchstens 100.000 zeitgestempelte Pfadpunkte, eine Stunde
Dauer, eine Million bearbeitete Rasterpixel einschließlich vorhandener Feinautoren,
100.000 Abdrücke und 40 Millionen Pixelprüfungen. Überschreitungen lehnen den
gesamten Strich ab. Je Darstellung werden höchstens 64 Kacheln angefordert;
Einzelsymbole verwenden höchstens 16.384 Kandidaten einschließlich Kronenrand.

Gespeichert werden dünn belegte 64×64-Kacheln mit Auflösung 2^Stufe Fuß (0–24)
und vier normierten Gewichten für Wald, Buschland, Wiese und Felsgebiet. Die Summe
ist höchstens 255. Diese Gewichte beschreiben alternative Landschaftsanteile
und Bestandsdichte, keine vier frei übereinanderliegenden Ebenen. Wald enthält
seinen Unterwuchs; ein einzelner Felsen im Wald ist nicht durch eine zusätzliche
Felsgebiet-Ebene modelliert. Autorendaten bleiben beim Zoomen unverändert.

Nah erscheinen deterministisch aus Weltkoordinaten erzeugte Bäume und andere
Symbole. Baumkronen erscheinen als unregelmäßige, fein konturierte Federzeichnungen
mit gedeckten Grünfarben; Blattdetails folgen der sichtbaren Größe. Mehr Dichte ergänzt stabile Kandidaten statt vorhandene Positionen neu
zu würfeln. Mittlere Maßstäbe zeigen Wald als zusammenhängende Blätterdächer:
Die gemalte Zieldichte bestimmt sichtbare Lücken und den Kronenschluss. Lokale
Lichtungen bleiben erhalten. Buschland, Wiese und Felsgebiet verwenden sparsame
kartographische Signaturen aus kleinen Gruppen; ferne Maßstäbe
ausschließlich Flächenfarben. Übersichten entstehen
direkt aus den Deckungen, ohne zuerst unsichtbare Einzelbäume zu erzeugen.
Mittlere Blätterdächer beziehungsweise Signaturen und nahe Symbole gehen überlappend ineinander über;
beim Wechsel gibt es kein ausschließlich durch den Zoom verursachtes Leerband.
Das gemeinsame Kandidatenbudget gilt auch während dieses Übergangs. Auf großen
Ansichtsflächen bleibt das Blätterdach länger sichtbar, bis die Einzelbäume in
das Arbeitsbudget passen; Verschieben allein verändert die Überblendung nicht.
Die Darstellung ist auf den sichtbaren Ausschnitt und ein festes Symbolbudget
begrenzt; bei zu großem Detailumfang bleibt die zusammenhängende Flächendarstellung.
Wasser maskiert Landschaft, ohne darunterliegende Autoren zu löschen. Schnee
bleibt sichtbar. Landschaft verändert weder Höhen, Fundamente noch Kollisionen.

Der bestehende Objekttyp dekorativer Landschaftsstriche behält konkrete Assets
und bleibt auswählbar und als ganzer Strich löschbar. Die neue Malerei erzeugt
solche Striche nicht mehr. Einzelobjektplatzierung, lokale Verschiebeausnahmen,
Feldumrisse und eigene Assetimporte sind noch nicht Bestandteil dieser Ausbaustufe.

## Höhen und Fundamente

Neue Welten beginnen als Ozean mit Meeresspiegel 0 Fuß und natürlichem Untergrund
−100 Fuß. Land/Meer im Höhenwerkzeug erzeugt im Inneren +10 beziehungsweise
−10 Fuß als Mindest-/Höchstwert. Ein vorzeichenbehaftetes Randprofil mit zwei
Rasterweiten Stützbereich verbindet den Strich mit der vorhandenen Oberfläche. Lokale Seen behalten ihren eigenen Pegel und haben
innerhalb ihrer Kontur Vorrang vor dem Ozean. Höhen sind endlich innerhalb
±100.000 Fuß.

Die natürliche Oberfläche kombiniert dünn belegte Raster mit Abständen
`5 × 2^level` Fuß, Level 0–21. Fehlende Werte erben die gröbere Oberfläche;
feinere absolute Werte haben Vorrang. Unbelegte Randstützpunkte interpolieren
zur gröberen Oberfläche. Lokale Details bleiben bei späterer großräumiger
Bearbeitung erhalten. Undo entfernt zuvor fehlende Stützpunkte wieder vollständig.
Die Rasterwerte sind Kontrollwerte einer positiven kubischen B-Spline-Fläche.
Fehlende Kontrollwerte mischen die gröbere Oberfläche ein. Küsten und
Höhenabfragen verwenden dieselbe Rekonstruktion; grobe Reliefmittelwerte
bestimmen nicht die Meer-/Landgrenze.

„Höhen“ funktioniert im gesamten Außenzoom. Vorgaben: Land, 80 CSS-Pixel
Durchmesser, 1 Fuß Änderung, 25 % Stärke, Zielhöhe 10 Fuß. Anheben, Absenken,
Glätten und Einebnen ergänzen Land/Meer. Änderung 0,1–100 Fuß, Stärke 0,01–1.
Bergkette, Hügel und Schlucht erzeugen Relief entlang des Strichs. Die Größenwahl
koppelt reale Breite und Reliefhöhe/-tiefe: Bergkette bietet Kleiner Berg
(6 km / 300 m), Alpenmassiv (40 km / 2500 m) und Achttausender (100 km / 8500 m);
Hügel bietet Sanfte Hügel (800 m / 30 m), Hügelland (2500 m / 100 m) und Hohe
Hügel (6 km / 300 m); Schlucht bietet Kerbe (200 m / 30 m), Schlucht
(1500 m / 200 m) und Großer Canyon (12 km / 1500 m). Breite (10–200.000 m)
und Relief (1–9000 m) können einzeln geändert werden. Die Reliefangabe ist eine
Formstärke relativ zum bestehenden Gelände, keine garantierte Gipfelhöhe über
Meer; Wegüberlappungen verstärken den Auftrag. Wiederholtes Malen macht Hügel
höher, Bergketten ausgeprägter und Schluchten tiefer. Halten allein verstärkt nicht.
Unter Meeresspiegel entsteht Wasser; kleine Hügel auf tiefem Meeresboden können
unter Wasser bleiben. Zum Aufbau einer Landschaft zuerst Land anlegen.

Diese drei Modi behalten ihre reale Breite beim Zoomen. Modus- und Vorlagenwahl
passen die Ansicht auf etwa 160 Pixel Pinseldurchmesser an; „Auf Pinselgröße zoomen“
stellt diese Ansicht auch nach manueller Größenänderung her. Größenkurzbefehle
ändern ihre reale Breite. Die Autorenauflösung hängt vom Radius ab (etwa 32–64
Rasterintervalle pro Radius, mindestens 5 Fuß), nicht vom Kamerazoom. Bergketten
verwenden unregelmäßige Grate, Hügel weiche ortsfeste Kuppen, Schluchten ein
steiles negatives Querprofil. Die Form bleibt über Paketgrenzen stabil. Jeder
Strich ist ein Undo-Schritt; gespeichert werden nur die entstandenen Höhenwerte.

Land/Meer bietet die Küstenformen „Rund“ (Vorgabe) und „Kräuselig“.
Kräuselig beginnt mit 65 % Küstenrauheit; der Regler reicht von 5 bis 100 %.
Die Struktur formt Buchten und Landzungen innerhalb des Pinselkreises. Mehr
Rauheit verstärkt die Einbuchtungen, ohne isoliertes Zufallsrauschen ins Innere
zu streuen. Gleicher Weg, Ort, Radius und Rauheit erzeugen dieselben Autorenwerte,
unabhängig von Paketaufteilung und Zeichengeschwindigkeit; wiederholter Auftrag
mit denselben Einstellungen würfelt die Küste nicht neu aus. Zoomen skaliert die
bereits geschriebene Küste unverändert. Andere Höhenmodi verwenden keine Küstenrauheit.
Für Land/Meer wird beim Pointerdown eine Autorenauflösung mit höchstens zwei
CSS-Pixeln Rasterabstand gewählt, begrenzt durch das feinste 5-Fuß-Raster.
Anheben, Absenken, Glätten und Einebnen folgen ungefähr acht CSS-Pixeln. Die Auflösung bleibt
während des Strichs fixiert und ist unabhängig von Kachelbudgets und Darstellung.
Ein grober Strich schreibt keine feineren Rasterpunkte. Land/Meer verwendet den
Abstand zur gesamten überstrichenen Linie einschließlich runder Enden; die
Aufteilung in Eingabeereignisse und Transportpakete verändert das Ergebnis nicht.
Andere Höhenmodi tasten den Weg mit max(Radius/4, halber Rasterweite) ab und
führen den verbleibenden Abstand über Paketgrenzen weiter. Glätten verwendet
neun Nachbarpunkte; Einebnen nähert sich der Zielhöhe. Halten vertieft nicht weiter.

Höhenstriche ändern das Dokument während des Ziehens direkt und verwenden keine
getrennte Vorschau. Bei bereitem Dokument können sie auch beginnen, während nach
einem Zoom- oder Ansichtswechsel noch Darstellungskacheln laden. Die aktuelle
Kamera bestimmt den Pfad und die Autorenauflösung; der Kern liest die Höhenwerte.
Dateiaktionen, unsicherer Dokumentstatus und noch laufende Änderungen sperren
weiterhin den Beginn eines neuen Strichs. Auch während ausstehender Writes erscheinen dafür keine
Übernehmen-/Abbrechen-Aktionen; Beenden behält das Gemalte, Rückgängig entfernt
den Strich. Höchstens ein Abschnitt ist unterwegs; weitere Punkte werden
geordnet gesammelt. Der Editor sendet höchstens 32 neue Pfadpunkte je Paket,
ohne angenommene Punkte auszulassen. Jeder Abschnitt ist atomar, der gesamte Strich ein
Undo-Schritt. Loslassen, Escape, Blur, Pointerabbruch und Werkzeugwechsel beenden
den Strich und behalten das Gemalte. Auch vor History-, Dateioperationen und
Unmount werden angenommene Punkte abgeschlossen. Ein Fehler verwirft nur den
fehlgeschlagenen Abschnitt, beendet den Strich und lässt den bestätigten Bestand
rückgängig machbar. Es erfolgt keine automatische Fortsetzung nach einem Fehler.

Ein direkter Strich erlaubt insgesamt 4.096 Pfadpunkte und 100.000 veränderte
Kontrollwerte; ein Abschnitt höchstens 400.000 vorbereitete Rasterkandidaten.
Die Einzelaktionsschnittstelle erlaubt lokal weiterhin 100.000 Pfadpunkte.
Die Oberfläche wird erst nach erfolgreicher atomarer Übernahme des Abschnitts im Kern als bestätigt angezeigt.
Es gibt keine lokale Näherungsvorschau und keine feste Bildratengarantie.

Alle Höhen-LODs übertragen fertige Relief- und Wasserraster sowie Höhenlinien;
Autorenkontrollfelder und abgeleitete Offsetfelder verlassen den Kern nicht.
Die Darstellung verwendet kleinere Kacheln mit nominell vier CSS-Pixeln je
Stützrasterweite; bei großen Ausschnitten greift das gemeinsame Kachelbudget.
Die Rasterauflösung folgt Maßstab, DPR und Speicherbudget. Die API verwendet
standardmäßig 512 Pixel je Kante; zulässig sind Zweierpotenzen von 32 bis 1.024,
mit insgesamt höchstens 16.777.216 inneren Rasterpixeln und 64 Kacheln je Anfrage.
Ein zusätzlicher Pixelrand dient der nahtlosen Filterung. Konstante Raster dürfen
als Einzelwert übertragen werden. Die Übersicht übernimmt nicht die
100.000-Kontrollwerte-Grenze exakter Bearbeitungsreads. Autorendaten und
Aktionslimits bleiben von der Darstellungsauflösung unabhängig.
Die Cursorhöhe stammt aus einem versionsgebundenen Kernread; veraltete Antworten
werden nicht angezeigt. Ein solcher Read umfasst höchstens 64 Weltpunkte.

Jedes Haus besitzt eine Fundamenthöhe von 0–100 Fuß (Vorgabe 1) und eine
Übergangsbreite von 0–500 Fuß (Vorgabe 10). Die höchste natürliche Geländehöhe
unter der oberirdischen Hausgrundfläche bestimmt die ebene Plattform. Ihre
Fundamentoberkante liegt um die Fundamenthöhe darüber. Keller ohne Dachkontur
bilden keine Geländeplattform. Der Übergang außerhalb der Grundfläche läuft
weich aus; überlagerte Übergänge verwenden das Maximum. Hausgrundflächen haben
Vorrang vor fremden Übergängen. Plattformen werden ausschließlich aus natürlichem
Gelände berechnet, niemals aus anderen Aufschüttungen. Bau, Bewegung, Grundriss-
und Höhenänderungen führen sie automatisch nach; Löschen entfernt sie. Räume und
Geschosse bekommen keine eigenen Welthöhen; Straßen besitzen keine harte Steigungsgrenze.

Lokales Gewässerwasser blockiert weder Neubau noch Bestandsänderungen und erzeugt
keine Warnmeldungen. Wasser hebt Fundamente nicht an und erscheint unter Dächern.
Manuelle Wasserpolygone behalten ihre bisherigen Kollisionsregeln.

Relief und zuschaltbare Höhenlinien zeigen die Oberfläche; Höhenlinien beginnen
bei 5 Fuß Abstand und werden bei weitem Zoom ausgedünnt. Die Höhenanzeige am
Mauszeiger entspricht der dargestellten interpolierten Oberfläche. Übersichtsstufen
mitteln natürliche Höhen; Hausplattformen werden bis zu einer Abtastweite von
160 Fuß berücksichtigt. Gröbere Stufen zeigen Landschaftsformen, keine exakten
Hausfundamente. Die Übersicht gewichtet lokale Verfeinerungen nach ihrem belegten Flächenanteil;
sie ist keine exakte Einzelpunktmessung.

## Bedienung

### Navigation und Oberfläche

Auswählbare, durch den Maßstab gesperrte Werkzeuge zeigen statt einer
Zeicheneinladung einen Hinweis zum Hineinzoomen. Der Name der Ansicht allein
garantiert keine Bearbeitungsfreigabe.

Mitteltaste oder Leertaste+Ziehen verschiebt die Karte, Mausrad zoomt.
Fenstergrößen- und Werkzeugleistenwechsel erhalten den Weltmittelpunkt und den
Maßstab innerhalb der Weltgrenzen. Öffnet oder schließt eine Auswahl per
Kartenklick den Inspector, bleibt der Punkt unter dem Zeiger stehen. Ein Haus
öffnet per Doppelklick oder „Innen öffnen“; die Kamera bleibt erhalten.
Außenzoom reicht bis 0,000002 CSS-Pixel pro Fuß. Straßen, Boden, Landschaft, Regionen und Höhen
lassen sich in der gesamten Außenübersicht bearbeiten. Lokale Gewässer
benötigen mindestens 0,32 CSS-Pixel pro Fuß, andere
Außenobjekte und Innenräume mindestens 1,28. Im Parzellenkontext
verwendet Fit immer Polygonbounds, auch ohne Haus; ein fehlender Owner bedeutet
leer, nicht fehlendes Grundstück. Entferntes Kontextobjekt führt nach außen.

Grenzen erscheinen in der Außenbearbeitung im Auswahl-, Straßen- und Hauswerkzeug sowie bei
offenem/ausgewähltem Grundstück oder zugehörigem Haus. Rasterlinien werden auf Polygon und Viewport
geclippt und unter vier Bildschirmpixeln je Zelle ausgeblendet; das fachliche
Raster bleibt bestehen. Zeichenfolge: Gelände, Parzellen, Straßen, Häuser/
Innenräume, Raster/Auswahl, Vorschau/Griffe. Hitpriorität: aktive Innenräume/
Griffe, Haus, Straße, sichtbare Parzelle, jüngstes Gelände.

Links stehen ausschließlich beschriftete Werkzeuge. Rechts erscheint genau ein
kontextabhängiger Bereich: ausgewählte Entwurfsparzelle, laufende Planung, aktives
Zeichenwerkzeug oder ausgewähltes Bestandsobjekt. Ohne Auswahl ist der
Objektbrowser eingeklappt. Gemeinsame Bebauungsdetails und Objektlisten sind
standardmäßig geschlossen. Kurze Bedienhinweise stehen an der Karte. Vorschauzusammenfassung,
Generierungsdiagnosen und Aktionsfehler stehen einmalig in der gemeinsamen
Aktionsleiste unter den Einstellungen, auch bei ausgewählter Entwurfsparzelle.
Die Aktionsleiste enthält Übernehmen, Abbrechen und bei Bedarf Vorschau erneut
prüfen. Dokument- und Verbindungsfehler stehen im Statusbereich. Feldgrenzen werden am Feld angezeigt und verhindern ungültige Writes.

### Geländeabhängige Straßen

„Gelände folgen“ ist für neue Straßen und Verlängerungen standardmäßig aktiv.
Spielraum: 0–30 %, Vorgabe 10 %, bezogen auf die direkten Abstände der gesetzten
Punkte. Start und Ziel bleiben exakt. Zwischenpunkte werden in Reihenfolge innerhalb
eines Radius aus Spielraum mal kürzerer Nachbarstrecke erreicht; jede Teilstrecke
hat ihren eigenen kapselförmigen Suchkorridor. Ohne Geländefolge gilt die bisherige
Kurvenzeichnung. Bestehende Straßen werden nie automatisch umgeplant.

Eine deterministische Suche mit acht Nachbarn, Richtungszustand und geordneten
Zielbereichen optimiert natürliche Höhen und Wasser. Hausplattformen zählen nicht.
Pro Streckenlänge gelten Grundkosten 1, Längssteigung² × 100, Querneigung² × 25
und Wasserzuschlag 100; Richtungswechsel kosten Straßenbreite × Winkel² (Radiant),
Zwischenpunktverschiebungen ihre Distanz. Wasser umfasst lokale Gewässerflächen, Flusswasser und Wasserpolygone; deren bisherige Kollisionsregeln bleiben erhalten.
Steile und unvermeidbar überflutete Strecken sind keine eigenen Ablehnungsgründe.

Höchstens 200.000 Suchzustände, mindestens fünf Fuß Rasterweite, bei großen
Korridoren zunächst gröber und danach lokale Verfeinerung im verbleibenden Budget.
Der direkte Verlauf ist der vollständige Ausgangskandidat; Budgetende behält den
besten vollständigen gefundenen Kandidaten. Auch Originalpunkte sind Suchknoten.
Die Kostenintegration verwendet mindestens fünf Fuß Abtastweite, bei sehr langen
Routen gröber (direkte Gesamtlänge / 16.000). Diese endliche Suche garantiert kein
globales Optimum und keine Erkennung beliebig kleiner Hindernisse zwischen Samples.

Vereinfachung, kubische Glättung und anschließende Rauheit müssen Zielbereiche,
Korridore und Kosten erhalten. Griffe werden verkürzt; nötigenfalls bleiben gerade
Teilstücke. An Verlängerungen bleibt die alte Geometrie erhalten, der neue Anschluss
behält seine Tangentenrichtung; bei Spielraum null kann sein Griff praktisch null
lang werden. Rauheit wird maximal achtmal halbiert, sonst weggelassen. Das gilt
zusätzlich zu den bisherigen 512-Knoten-/32.768-Samplegrenzen. Auf ebenen direkten
Verbindungen kann dadurch die zusätzliche Rauheit vollständig entfallen.

`createRoad`/`extendRoad` akzeptieren optional `terrainFollow: { tolerance }`;
fehlende Einstellungen behalten für direkte Kernaufrufe das frühere Verhalten.
Sections bleiben den gesetzten Teilstrecken zugeordnet; Bebauung erfolgt erst am
fertigen Verlauf. Die Geländeroute ist zoomunabhängig; nur zusätzliche Rauheit
verwendet weiterhin Bildschirmmaße. Vorschau und Commit rechnen denselben Entwurf
auf derselben Revision. Gespeichert werden ausschließlich resultierende Nodes;
keine neue Formatversion, Abflachung, Brücken, Tunnel oder Bestandsumplanung.

### Straßenentwürfe und Parzellenplanung

Ohne Geländefolge verwenden neue Straßen automatisch geglättete Verlaufspunkte (zentripetales
Catmull–Rom als kubische Bézier-Knoten). Klicken setzt Punkte, Ziehen bewegt sie.
Zwei Punkte ergeben eine Gerade; direkte Doppelpunktsegmente werden verhindert.
Bestandsstraßen behalten ihre Kurven. In der Übersicht erscheinen Verlaufspunkte und Verlängerungsgriffe, ab 20 % zusätzlich Bézier-Griffe. Punktbewegungen verschieben die zugehörigen Griffe gemeinsam, ohne automatische Neuglättung. Plusgriffe an den
Enden beginnen Verlängerungen; nur die neuen Kanten werden geglättet, vorhandene
Kanten bleiben erhalten. Die Anschlussrichtung folgt der äußeren Tangente.

Rauheit ist ein Entwurfswerkzeug für echte Geometrie: 0–1, Vorgabe 0,33;
„Neue Variation“ ändert den entwurfslokalen Seed. Jede Vorschau wird erneut aus
der Grundkurve berechnet. Die Oberfläche übergibt den aktuellen Entwurfszoom:
Die deterministische Querabweichung hat bei voller Stärke eine maximale
Auslenkung von 24 CSS-Pixeln und eine Wellenlänge von mindestens 128 CSS-Pixeln.
Weltmaße ergeben sich durch Division durch den Kameramaßstab; Straßenbreite
und Pixeldichte verändern die Bildschirmmaße nicht. Zoomänderungen berechnen
aktive Straßen-, Verlängerungs- und Aufrauentwürfe erneut mit demselben Seed.
Der Verlauf läuft an gesetzten Punkten weich aus; diese Punkte und ihre
Anschlussrichtungen bleiben fest. Zusätzliche Stützpunkte gehören zur jeweiligen
ursprünglichen Section. Kernaufrufe ohne optionalen `viewScale` verwenden weiterhin
höchstens eine halbe Straßenbreite Auslenkung und mindestens acht Straßenbreiten
beziehungsweise 40 Fuß Wellenlänge.
„Verlauf aufrauen“ beginnt bei Bestandsstraßen ausdrücklich mit Stärke 0;
gewöhnliche Punktbewegungen erzeugen keine Rauheit. Übernahme speichert nur die
resultierenden kubischen Nodes, keine Rauheits- oder Zoomparameter. Zoom und
Dateiöffnung verändern übernommene Straßen nicht. Verlängerungen verändern nur
neue Kanten.
Pro Aufrauen wird höchstens die Hälfte der noch freien Knotenplätze verwendet.
Zusätzliche Stützpunkte werden proportional zum Unterteilungsbedarf verteilt;
Rundungsreste erhalten die Kanten in ihrer Reihenfolge. Bei knappen Budgets
werden die Wellen gröber (höchstens eine Welle je vier Teilstücke). Kanten ohne
zusätzliche Stützpunkte bleiben unverändert; ohne Budget ist Aufrauen ein No-op.
Überschreitet erst die erzeugte Rauheit das Samplelimit, wird das Zusatzbudget
halbiert und erneut aus der Grundkurve gerechnet. Ungültige Ausgangsgeometrie
und Konflikte werden weiterhin abgelehnt. Node-/Samplelimits bleiben erhalten.

Bebauung kann bereits in der Übersicht erzeugt, geprüft und übernommen werden.
Gemeinsame Einstellungen sind verfügbar; einzelne Parzellen auswählen, auslassen
oder über Griffe bearbeiten erfordert den Nahzoom. Bereits angepasste Aufteilungen
bleiben beim Zoomwechsel erhalten.

Geplante Parzellen sind auf der Karte auswählbar. Griffe ändern Anfang/Ende am
Straßenabschnitt, Straßenabstand und Tiefe; rechts sind diese Werte numerisch
bearbeitbar. Griffe und Verlaufspunkte haben Vorrang vor Grundstücksflächen.
Der erste individuelle Eingriff fixiert die gesamte vorgeschlagene Aufteilung
über entwurfslokale Schlüssel und relative Sectionintervalle. Straßenänderungen
führen diese Intervalle mit. Einzelne Vorschläge können ausgelassen und im
Detailbereich wieder eingeschaltet werden; Nachbarn rücken nicht nach.
„Aufteilung neu erzeugen“ verwirft individuelle Anpassungen und gibt gemeinsame
Maße wieder frei. Ein neuer Entwurf übernimmt keine alte individuelle Aufteilung.

`population.houses` ist optional (Standard true), `population.layout` ist eine
optionale explizite Planung mit höchstens 200 eindeutigen Schlüsseln, Sectionindex
in Straßenreihenfolge, Seite, Intervall, Abstand, Tiefe, vorgeschlagenen Hausmaßen,
Dachindex und Auslassen-Zustand. Sie gilt für Create/Extend/Populate, wird aber
nicht im Rezept gespeichert: Persistiert werden nur die endgültigen Grundstücke
und Häuser. Explizite Konflikte werden abgelehnt statt still ausgelassen.
`updateParcel` ändert Intervall, Abstand und Tiefe einer gebundenen Parzelle;
Hausrasterpose und Innenräume bleiben erhalten und werden gemeinsam geprüft.

Die letzte Vorschaugeometrie bleibt bei ausstehender Neuberechnung sichtbar,
ist aber nicht über ihre veralteten Grundstücksflächen bearbeitbar. Numerische
Entwurfsänderungen dürfen laufende Kandidaten ersetzen. Rechtsklick übernimmt
den aktuellen Kandidaten unabhängig vom Abschluss der Rückmeldung.

### Hauszeichnen

Das Hauswerkzeug fixiert beim Pointerdown Grundstück und Rahmen. Eine
revisionsgleiche Ownerauflösung prüft auch Offscreen-Häuser; Pointerup wartet
darauf. Ein belegtes Grundstück verlangt Ergänzung im bestehenden Haus;
ein Grenzübertritt erzeugt keinen freien Ausweichowner. Escape, Blur, neue
Interaktion und Unmount widerrufen noch nicht angenommene Ownerarbeit.

## Vorschau und Nebenläufigkeit

Höhenstriche folgen der direkten Bearbeitung unter [Höhen und Fundamente](#höhen-und-fundamente).
Aktive Boden-, Gewässer- und Regionsstriche starten ihre erste exakte Vorschau sofort. Höchstens eine
Berechnung läuft; währenddessen bleibt nur der neueste wartende Stand erhalten.
Fertige Zwischenstände desselben Strichs dürfen als Darstellung erscheinen, ohne
den aktuellen Kandidaten zu bestätigen. Die letzte gültige Oberfläche bleibt bis
zur nächsten Antwort sichtbar. Version, Kontext, Strichidentität und Lebensdauer
sperren alte Antworten nach Abbruch, Werkzeug-/Dokumentwechsel und Unmount.
Pointerup verwirft wartende Vorschauen und übernimmt den vollständigen finalen Pfad.
Es gibt keine lokale Näherungsberechnung oder feste Bildratengarantie.

Ein interaktiver Workflow besitzt unveränderliche Kandidaten. Jede
Inhaltsänderung ersetzt Kandidat und Vorschauergebnis; Vorschau folgt nach
100 ms. Unvollständige Entwürfe bleiben lokal. Geometrieeingaben benötigen
aktuelle Szenen-/Kontext-/Auswahldaten. Canvas zeichnet den veröffentlichten
Snapshot mit der aktuellen Kamera im geplanten Zeichenframe. Aktuelle Daten
und abgeschlossene Zeichnung sind unterschiedliche Zustände; ein verschwundener
Ladehinweis garantiert allein noch keinen abgeschlossenen Canvas-Paint. Navigation
bleibt während Reads möglich, die letzte vollständige Ansicht bleibt sichtbar.

Neue Straßen, Verlängerungen und Populate werden über denselben Ablauf
mit Übernehmen, Enter oder Rechtsklick auf die Karte abgeschlossen. Rechtsklick
übernimmt ausschließlich gesetzte Punkte, nicht die schwebende Verbindung zur
Maus. Ein unvollständiger Straßenbeginn wird verworfen; ohne vollständigen
Kandidaten erfolgt kein Write. Ohne Entwurf ist Rechtsklick wirkungslos. Das
Werkzeug bleibt nach Abschluss aktiv. Escape verwirft den Entwurf; während einer
Ziehgeste wird nur diese auf ihren Ausgangszustand zurückgesetzt.
Enter und Escape in Eingabefeldern wirken lokal: gültigen Feldwert übernehmen
beziehungsweise Feldeingabe zurücksetzen, ohne die Planung abzuschließen oder
abzubrechen. Ungültige Werte bleiben mit Feldfehler korrigierbar.
Nach einer gültigen Zahleneingabe in einem Zeichenwerkzeug verwendet bereits
der erste anschließende Kartenklick den neuen Wert; vorheriges Tab oder Enter
ist nicht erforderlich.
Ein vollständiger Kandidat darf auch während einer laufenden Vorschau bestätigt
werden; bekannte ungültige, unveränderte oder veraltete Kandidaten verlangen
Korrektur beziehungsweise Neuprüfung. Vorhandene Geometrieänderungen senden den
finalen Pointerup-/Feldwert direkt zur atomaren Prüfung und Übernahme an den Kern.
Vorschauen sind Rückmeldung und keine Übernahmevoraussetzung. Ein finaler No-op
endet nach Kernprüfung ohne Mutation oder Historyeintrag. Abgelehnte Änderungen
bleiben mit Fehler als korrigierbarer Entwurf erhalten. Doppelte Übernahme ist
ausgeschlossen.

Escape, Werkzeug-/Kontextwechsel und Unmount widerrufen nicht angenommene
Arbeit. Pointercancel, LostCapture, Blur und Größenwechsel verwerfen die laufende
Geste; ein neuer Mehrknotenentwurf kehrt zum letzten abgeschlossenen Knoten
zurück. Reguläres Captureende, Blur oder Pan nach Pointerup widerrufen einen
bereits angenommenen Commit nicht. Fit verwirft verspätete Ergebnisse nach
neuer Navigation, Kontext-/Dokumentwechsel oder Unmount.

Exakte Aktionen beginnen/übernehmen nur bei leerer Schreibqueue, sicherem
Dokumentstatus und ohne Dateireservierung. Fremde Versionen machen sie stale.
„Vorschau erneut prüfen“ liest frische Header, erhält die gewünschte relative
GridPose und komponiert den aktuellen Parzellenrahmen. Geänderte Owner oder
Node-ID-Topologie verlangen eine neue Aktion. Veraltete Einstellungen werden
nicht still rebased; Neuprüfung reaktiviert keine automatische Übernahme.

Raum-, Connection-, Namens- und Dachaktionen gehen durch dieselbe serielle
Queue. Nach Annahme gehört der unveränderliche Write der Queue: Escape/Unmount
nehmen ihn nicht zurück; eine neue Geste darf beginnen. Ein älterer
Queueabschluss darf keine neuere Geste oder Auswahl abbrechen. Session-,
Kontext-, Interaktions- und Requestidentitäten verwerfen alte Antworten auch
nach A→B→A. Ein unsicherer Commit wird niemals wiederholt: nicht gesendete
Arbeit wird verworfen, Status abgeglichen, Workflow danach idle.

Löschen nutzt Backendvorschau mit vollständigen Offscreen-Kaskadenzahlen und
`deletedIds`; `removed` bezeichnet auch ersetzte Darstellungen. Das gemeinsame
Modal bestätigt genau diese Version/Zahlen. Neue Version verlangt Neuprüfung
und neue Bestätigung; Cancel ändert nichts. Bereits entferntes Ziel beendet das
Modal. Fokus, Tabbegrenzung, Escape, deaktivierte Aktionen und Fehleranzeige
gehören zum Modalvertrag.

Fachfehler: `invalidInput` mit `DomainIssue` (Code, IDs, Nachricht, optional
sichere getaggte Bounds-/Point-/Path-/Polygongeometrie). Codes sind
`parcelGeometry`, `parcelContainment`, `collision`, `gridAlignment`,
`occupiedParcel`, `boundSection`, `limit`, `invalidInput`; sie werden nicht aus
Fehlertexten abgeleitet. Preview/Commit liefern dieselbe erste Verletzung.
`storage`/`staleVersion` bleiben getrennt; ungültige Geometrie erscheint nicht
als reguläres Overlayobjekt.

## Atlasansichten

Die flache Karte umfasst rund 60.960 km je Achse, ohne Kugelprojektion oder
umlaufende Ränder. Weltkoordinaten bleiben Fuß, die Maßstabsleiste zeigt Meter
oder Kilometer. Navigation wird am Weltrand begrenzt. Innenräume werden
weiterhin ausdrücklich geöffnet und behalten Geschosswahl und Hausraster.

Die Ansichtsbezeichnung basiert auf der Kartenbreite bei 1.000 CSS-Pixeln,
unabhängig von Fenstergröße und Pixeldichte. Zehn Prozent Hysterese verhindert
Flackern. Inhalts- und Kachelgrenzen werden beim Hineinzoomen am Sollwert
aktiviert und beim Herauszoomen über einen Rücklaufbereich von zehn Prozent
gehalten; die Koordinatentransformation bleibt unverändert. Die Auswahl springt um den Kartenmittelpunkt; freie Doppelklicks zoomen
zur nächsten feineren Außenansicht. Im exakten Außenraum gilt dies mit dem
Auswahlwerkzeug auf freier Karte bei frischen Trefferdaten und ohne laufende
Geste oder Planung. Dafür genügen aktuelle Trefferdaten am Zeiger einschließlich
Trefferrand; ein noch ladender, neu sichtbarer Kartenrand blockiert diesen Zoom
nicht. Objektaktionen haben Vorrang; in der feinsten Ansicht
gibt es keinen weiteren Schritt. Auswahl und Entwürfe bleiben erhalten.

| Ansicht                 | Referenzbreite  |
| ----------------------- | --------------- |
| Raum                    | bis 15 m        |
| Haus                    | 15–60 m         |
| Grundstück              | 60–240 m        |
| Straßenzug              | 240–600 m       |
| Quartier / kleines Dorf | 600 m–1,5 km    |
| Dorf / Stadtteil        | 1,5–4 km        |
| Stadt                   | 4–15 km         |
| Umland                  | 15–50 km        |
| Teilregion              | 50–150 km       |
| Region                  | 150–500 km      |
| Land                    | 500–1.500 km    |
| Großregion              | 1.500–4.000 km  |
| Kontinent               | 4.000–12.000 km |
| Welt                    | ab 12.000 km    |

„Quartier / kleines Dorf“ dient der Orientierung und Planung über mehrere Straßen.
Straßenführung, Bebauungsgruppen, größere Freiräume, wichtige Orte sowie Wasser
und Landschaft bilden das Ortsbild. Ausreichend große Dächer können einzeln
erscheinen; kleinere oder durch die Darstellungsgrenzen verdrängte Gebäude tragen
weiterhin zur Bebauungsdichte bei. Die Übersicht zeigt keine exakten
Grundstücksgrenzen oder Innenraumdetails. Namen werden nach den Regeln der
Stadtübersicht und der Regionen priorisiert und begrenzt.

Innerhalb dieser benannten Ansicht liegt die Inhaltsgrenze für gewöhnliche
Gebäudenamen sowie Gewässerbearbeitung. Die Ansichtsauswahl landet
im gröberen Teil: Gewöhnliche Gebäude außerhalb der Auswahl tragen dort keine
Namen, und der Gewässerpinsel ist gesperrt. Beim Hineinzoomen können diese Namen
und Werkzeuge bei gleichbleibendem Ansichtsnamen verfügbar werden. Es gelten
die Inhaltsgrenzen und Rücklaufbereiche der Stadtübersicht und der Werkzeugregeln.
Bestehende Bodenfarben, Gewässer und Landschaft bleiben auch bei gesperrtem
Malwerkzeug Teil der Darstellung. Haus- und Innenbearbeitung
benötigen weiterhin den Nahzoom; ein Innenkontext wird ausdrücklich geöffnet.

„Dorf / Stadtteil“ dient der Orientierung und räumlichen Planung im gesamten
Dorf oder einem größeren Stadtteil. Zusammenhängende Bebauung und ihre Ränder,
größere Freiräume, verbindende Straßen, wichtige Orte sowie Wasser und Landschaft
sollen das Ortsgefüge erkennbar machen. Größere Dächer ergänzen die
Bebauungsdichte; kleine oder durch die Darstellungsgrenzen verdrängte Einzelobjekte
müssen nicht separat erscheinen. Die Übersicht vermittelt keine exakten
Grundstücksgrenzen oder Innenraumdetails.

Diese benannte Ansicht bleibt vollständig im Übersichtsbereich. Gewöhnliche
Gebäude außerhalb der Auswahl tragen hier keine Namen; wichtige Orte,
Regions- und Ortschaftsnamen sowie Straßennamen werden nach den gemeinsamen
Größen-, Prioritäts- und Kollisionsregeln dargestellt. Bestehende Bodenfarben,
Gewässer bleiben Teil des Ortsbilds, auch wenn ihr Werkzeug
gesperrt ist; Landschaft bleibt auf dieser Stufe bearbeitbar. Kleine Geometrien und Symbole dürfen nach den Darstellungsgrenzen
entfallen; die Übersicht garantiert nicht die Anzeige jedes Einzelobjekts.

Auswahl und Navigation sowie Straßen-, Fluss-, Höhen- und Regionsbearbeitung
bleiben nach ihren Werkzeugregeln verfügbar. Boden und Landschaft bleiben in allen Außenmaßstäben bearbeitbar; der Gewässerpinsel benötigt
einen feineren Maßstab; Haus- und Innenbearbeitung weiterhin den
Nahzoom. Ein Innenkontext wird ausdrücklich geöffnet. Der Ansichtsname legt
weder eine Regionsrangstufe noch eine Verwaltungsordnung fest.

Diese Bereiche sind keine Verwaltungsordnung. Kachelanfragen sind je Schicht
auf 64 Kacheln begrenzt und wählen bei Bedarf eine gröbere Darstellung.
Flussübersichten laden höchstens 128 priorisierte Verläufe mit je 128 Samples;
explizit gewählte Flüsse und die Flussbearbeitung laden exakte Daten.
Grobe Oberflächenkacheln begrenzen lokale Seen auf 32 nach Größe priorisierte
Flächen mit jeweils höchstens 64 Konturpunkten. Diese Auswahl und Begrenzung
gilt ebenso für Vorschauoberflächen und bestätigte Zwischenstände. Bei gleichem
Dokumentstand und gleicher Kachelanfrage stimmen sie mit frisch geladenen
Oberflächen überein. Exakte Bearbeitung wird niemals
stillschweigend gekürzt. Einzelne Straßen unter acht Bildschirmpixeln Länge
entfallen in der Übersicht; ausgewählte Straßen behalten ihren exakten Header.

## Stadtübersicht und Kartenbeschriftung

Der Maßstab bezeichnet CSS-Pixel pro Fuß; 100 % entsprechen 6,4 Pixeln pro Fuß.
Unter 0,064 zeigt die Stadtübersicht zusammengefasste Bebauung, Gelände und
Straßen ab 12 Fuß Breite. Ab 0,064 können einzelne Dächer ab sechs Pixeln
sichtbarer Größe erscheinen, ab 0,32 auch gewöhnliche Gebäudenamen. Ab 1,28
(20 %) werden vollständige exakte Szenen und die Detailbearbeitung freigegeben.
Die Straßenbearbeitung lädt auch darunter gezielt den revisionsgleichen exakten
Straßenheader; vereinfachte Kachelpfade sind keine Bearbeitungsgeometrie.
Die Übersicht darf bei hoher Dichte kleinere Einzelobjekte durch Bebauungsdichte
ersetzen; sie behauptet keine exakten Grundstücks- oder Gebäudegrenzen.

Übersichtskacheln besitzen 32 × 32 Dichtezellen; ihre Auflösung folgt dem Maßstab
mit einer Hysterese von zehn Prozent an den vorgesehenen Pixelgrenzen.
Je Abruf sind höchstens 64 Kacheln zulässig; je Kachel werden maximal 128
Geometrien je Art bereitgestellt, nach Größe beziehungsweise Straßenbedeutung
priorisiert. Komplexe Geometrie wird für die Darstellung stärker vereinfacht.
Die vollständige Bebauungsdichte bleibt davon unabhängig erhalten. Überladene
exakte Ausschnitte mit mehr als 5.000 Objekten verlangen weiteres Hineinzoomen;
es gibt keine still gekürzte Bearbeitungsszene.

In der Übersicht verschiebt Ziehen mit der linken Taste im Auswahlwerkzeug
auf leerer Karte die Ansicht. Ein momentan gesperrter Höhen-, Boden-, Gewässer-,
Landschafts- oder Regionspinsel deutet linkes Ziehen nicht als Verschieben um.
Navigation mit mittlerer Maustaste oder Leertaste bleibt möglich.
Normale, durch Breiten- oder Größenschwelle
verborgene Straßen sind keine Auswahlziele und fangen weder dieses Verschieben
noch den freien Doppelklick-Zoom ab. Eine ausgewählte Straße mit vorhandenem
exaktem Header bleibt auch unter diesen Schwellen sichtbar und treffbar;
Geometrieaktionen benötigen weiterhin aktuelle Daten. Das Straßenwerkzeug setzt
und bewegt stattdessen Verlaufspunkte. Doppelklick auf eine ausgewählte Straße fügt einen Knoten ein;
auf leerer Karte zoomt er um den angeklickten Punkt zur nächsten Ansicht
gemäß den Atlasansichten; „Zur Detailansicht“ erhält den Kartenmittelpunkt.
Bestehende Auswahl und Entwürfe bleiben beim Zoomwechsel erhalten. Im
Straßenzeichnen löst Doppelklick keinen Zoom aus. Geometrieaktionen benötigen
aktuelle Daten; Bestandsstraßen zusätzlich ihren vollständigen Header.
Straßenlinien haben mindestens zwei CSS-Pixel Breite. Ausgewählte und geplante
Straßen bleiben unabhängig von Kachelpriorisierung sichtbar. Beschriftungen verändern die
Hitpriorität nicht. Innenräume werden weiterhin ausdrücklich geöffnet.

Rechteckige einzelne Dachkonturen erhalten in der Nahansicht dekorative
Walmdachflächen und Firstlinien mit gemeinsamer Beleuchtung aus Nordwesten.
Die Details blenden nach Bildschirmgröße und Zoom ein; unter 0,32 CSS-Pixeln
pro Fuß und bei weniger als 12 Pixeln schmaler Dachseite entfallen sie.
Dachfarbe, Grundriss und Auswahl bleiben maßgeblich. Innenhöfe, getrennte oder
konkave Konturen erhalten keine vereinfachte Walmdachkonstruktion. Diese
Darstellung ist kein gespeicherter Dachtyp und beeinflusst Innenräume nicht.

Gebäude besitzen `importantPlace`, standardmäßig false, bearbeitbar als
„Wichtiger Ort“. Die Markierung ist Autorendatum mit Undo/Redo und Dateipersistenz;
sie verändert weder Kollisionen noch Innenräume. Wichtige Orte können schon in
der Stadtübersicht beschriftet werden. Namenspriorität: Auswahl, wichtige Orte,
Straßen, gewöhnliche Gebäude; danach Größe/Straßenbedeutung und stabile ID.
Im groben Inhaltsband unter 0,064 CSS-Pixeln pro Fuß erscheinen Straßennamen
erst ab 20 Fuß Straßenbreite; der bestehende Rücklaufbereich der Inhaltshysterese
gilt auch hier. In feineren Inhaltsbändern, einschließlich Straßenzug, dürfen
bei ausreichendem Platz auch schmalere Straßen Namen tragen.

Kartenbeschriftungen verwenden eine gemeinsame lokale Serifenschrift (Georgia,
Times New Roman oder System-Serif). Vermessung und Zeichnen verwenden dieselbe
Schrift; Bedienhinweise behalten ihre UI-Schrift. Objekt- und Straßennamen
erscheinen in 13 CSS-Pixeln mit heller Kontur. Gebäudenamen stehen
horizontal im oder neben dem Dach, Straßennamen folgen geeigneten, ausreichend
geraden Teilstrecken und stehen nie kopfüber. Wiederholungen derselben Straße
halten mindestens 400 Pixel Abstand. Namen kollidieren weder miteinander noch
mit berücksichtigten Bearbeitungsgriffen; bei Platzmangel entfallen sie.
Gebäudenamen dürfen zwei Zeilen beanspruchen; sehr lange Namen werden nur für
die Karte gekürzt. Vollständiger Name und Namensvalidierung bleiben erhalten.
Pro Ansicht werden höchstens 3.000 priorisierte Objektkandidaten betrachtet und
500 kollisionsfreie Beschriftungen gezeichnet.

## Dateien und History

`.saltatlas`: SQLite-Format **22**, ohne Migration/Altformate. Genau elf
STRICT-/WITHOUT-ROWID-Tabellen: `document_meta(singleton,next_identity)`,
`objects(id,kind,body)`, `house_cells(building_id,payload)`,
`terrain(x,y,z)`, `terrain_layers(level,x,y,z)`, `waters(id,body)`, `ground_tiles(level,x,y,pixels)`, `landscape_tiles(level,x,y,pixels)`, `region_catalog(singleton,body)`, `regions(id,body)`, `rivers(id,body)`. Keine Arbeitsindizes,
RTrees, Views, Trigger, History oder redundanten Konturen/Bounds.

Autoritativ sind Straßeneigenschaften/Nodes/Sections/Rezept/Marker,
Road-Source gebundener Parzellen, eingefrorene Polygon/Frame-Werte gelöster
Parzellen, Hausidentität/-autoren/Wichtiger-Ort-Markierung/Räume/Verbindungen/Zähler/Placement sowie
Flächenpunkte/-material/-Order, Landschaftsstriche mit konkreten Assets, natürliche Höhenpunkte, lokale Gewässerflächen/-pegel und
Fundamenteinstellungen pro Haus, Bodenfarbkacheln, Landschaftsdeckungskacheln sowie Regionskatalog,
Regionsflächen, Namen, Stile und Beschriftungseinstellungen sowie Flussknoten,
Breiten, Einstellungen und resultierende Verläufe. Regionsbeziehungen
werden aus den Flächen abgeleitet. Transparente Bodenfarbkacheln bleiben als explizite Überschreibungen erhalten; ihre Übersichtspyramide wird beim Öffnen neu aufgebaut. Hauszellen stehen ausschließlich separat.
Gebundene Welttransforms und Konturen werden beim Öffnen neu berechnet.

Unbekannte und doppelte verschachtelte JSON-Felder, zusätzliche Schemaobjekte,
falsche Spalten/PK-Struktur/Collation, fehlende oder zusätzliche Zellpayloads,
ID-/Kindabweichungen, ungültige globale IDs, Zähler, Eigentümer, Referenzen,
Section-/Seitenmarker, Geometrie und Kollisionen werden abgelehnt. Äquivalente
DDL-Formatierung ist zulässig. Die Quelldatei und aktive Session bleiben bei
Fehlern erhalten; es gibt keine stille Reparatur.

Öffnen erzeugt eine temporäre Arbeitskopie, Speichern ersetzt das Ziel atomar.
Speicherfehler erhalten die alte Zieldatei sowie Path/Saved/Dirty/History/Session.
Dateioperationen reservieren eine Grenze und warten auf akzeptierte Writes;
nach Dialogen werden Session/Revision erneut geprüft. Ein abgebrochener Dialog
übernimmt nichts; erhaltene Drafts müssen neu geprüft werden. Schmutzige
Dokumente können bei Neu/Open/Close gespeichert, verworfen oder beibehalten
werden. Strg+S speichert, Strg+Z und Strg+Umschalt+Z führen Undo/Redo aus.

Jede Compoundaktion/Kaskade ist genau ein atomarer Historyschritt mit Objekten,
Indizes und Zählern. Bis zu 100 Aktionen bleiben temporär rückgängig/wiederholbar;
Reopen lädt keine History. Globale Objekt-/Node-/Section-IDs kommen aus einem
monotonen Allocator getrennt vom Erstellungs-/Historyzähler. Preview reserviert
nur lokal; Fehler/No-op verbrauchen nichts. Undo senkt den globalen Allocator
nicht; Überlauf wird vor Mutation abgelehnt. SQL-Rollback veröffentlicht weder
Revision noch Dirtyzustand vor dem Commit.

## Flüsse

Das Werkzeug „Fluss“ arbeitet im gesamten Außenzoom mit gesetzten Verlaufspunkten.
Enter, Rechtsklick und Doppelklick übernehmen; Escape, Fokusverlust und
Werkzeugwechsel verwerfen den Entwurf. Auswahl und Punktverschiebung erfolgen im
Flusswerkzeug. Punkte lassen sich einfügen und entfernen, beide Enden verlängern,
Namen und Breiten bearbeiten. Eine Aktion ist ein atomarer Undo-Schritt.

Vorgaben: Breite 20 Fuß (2–1.000), Geländespielraum 10 % (0–30), Windungsstärke
50 % (0–100), Mäanderweite 40 Fuß (0–10.000), schmale Quelle aktiv.
Breiten gelten je Verlaufspunkt; Weltmaße bleiben beim Zoomen unverändert.
Varianten besitzen einen gespeicherten Seed. Endhöhen bestimmen die anfängliche
Richtung, bei Gleichstand die Zeichenrichtung; der Entwurf erlaubt Umkehrung.
Anschlüsse orientieren neue Zuflüsse zur Einmündung. Vorschaupfeile zeigen die
berechnete Richtung. Gespeicherte Richtungen ändern sich bei Höhenmalerei nicht.

Die begrenzte Suche bevorzugt kurze Verläufe und vermeidet Anstiege innerhalb des
Suchkorridors. Sie nutzt insgesamt höchstens 200.000 Zustände je Flussroute,
verteilt auf deren Teilstrecken; ein vollständiger direkter Ausgangskandidat
bleibt verfügbar. Mäander bleiben im Korridor. Der Planer garantiert kein globales
Minimum des Aushubs. Starke Einschnitte werden ab 10 Fuß orange und ab 30 Fuß rot
markiert und mit der maximalen Tiefe angegeben. Sie blockieren keine Übernahme
und benötigen keine Bestätigung. Technische Geometrie- und Höhengrenzen gelten weiter.

Flüsse besitzen gemeinsame stabile Verbindungsknoten. Ein neuer Verlauf endet
beim ersten Schnitt mit einem bestehenden Fluss; Endpunkte rasten innerhalb von
acht Bildschirmpixeln an dessen Verlauf ein. Einmündungen teilen eine Wasserhöhe.
Mehrere Zuflüsse sind erlaubt, Teilungen, Selbstkreuzungen und Zyklen nicht.
Das Bewegen gemeinsamer Knoten führt die angeschlossenen Verläufe mit. Ein
Verbindungsknoten kann nicht einzeln entfernt werden; das Löschen seines
Hauptflusses lässt verbleibende Zuflüsse als freie Enden bestehen.

Wasserprofile sind stückweise linear und niemals ansteigend; ebene Abschnitte sind
zulässig. Der Solver propagiert die niedrigste vorgelagerte Höhe stromabwärts und
berücksichtigt lokale Gewässerpegel als Anschlussbedingungen. Niedrige Zuflüsse
können den folgenden Hauptfluss absenken; ein höheres empfangendes Gewässer erzeugt
Rückstau stromaufwärts. Widersprüchliche feste Anschlusspegel werden abgelehnt.
Untergetauchte Abschnitte gehen optisch im Gewässer auf. Freie Enden sind erlaubt. Manuelle Wasserpolygone erhalten keine
eigene hydrologische Anschlusshöhe. Deltas, Abflussmengen, Wasserfallanimationen,
Überschwemmungsausbreitung und automatische Brücken werden nicht simuliert.

Das Grundhöhenraster bleibt erhalten. Ein abgeleitetes Flussbett senkt die
Oberfläche bis zwei Fuß unter das Wasserprofil ab, mit weichem Übergang über etwa
eine Flussbreite. Zur Darstellung schmaler Kanäle wird der Stützbereich des
5-Fuß-Rasters berücksichtigt. Es gibt keine Aufschüttung. Verschieben und Löschen
entfernen die alte Flusswirkung, eigene Höhenbearbeitungen bleiben erhalten.
Höhenmalerei berechnet betroffene Wasserprofile und Betten neu, ohne die
Kartenverläufe umzuplanen. Die Fundamentberechnung verwendet das Gelände nach der
Flussabsenkung. Überlagerungen mit Häusern, Grundstücken und Straßen sind in beiden
Richtungen erlaubt; Flusswasser zählt für die Straßenroutensuche als Wasser.
Relief, Höhenlinien und Höhenanzeige berücksichtigen das Bett. Grobe
Übersichtshöhen bleiben eine Darstellung, keine exakte Kanalquerschnittmessung.

Grenzen: 512 Verlaufspunkte und 32.768 Samples je Fluss; 2.000 Flüsse und 200.000
Samples je bearbeitetem Netz beziehungsweise geladener Ansicht. Zu große oder
ungültige Entwürfe bleiben korrigierbar und werden nicht teilweise übernommen.
Die gespeicherten Flussdaten und abgeleiteten Werte sind unter
[Dateien und History](#dateien-und-history) festgelegt.

## Gewässerpinsel

„Gewässer“ malt lokale Seen ab 0,32 CSS-Pixeln pro Fuß ohne Objektauswahl, Namen
oder Radierer. Meere und großräumige Küsten entstehen über Land/Meer im
Höhenwerkzeug. Lokale Wasserflächen besitzen einen eigenen konstanten Pegel. Pinselgröße: gemeinsamer Bildschirmpinsel, Vorgabe
80 Pixel. Absenkung: 0,1–100 Fuß, Vorgabe 1 Fuß. Ziehen senkt das tatsächliche
5-Fuß-Höhenraster mit Abtastung und weichem Profil des Höhenpinsels; wiederholtes
Übermalen vertieft es. Halten ohne Bewegung vertieft nicht weiter.

Ohne Wasserkontakt bestimmt die Geländeoberfläche am Strichbeginn vor der
Absenkung den Pegel, einschließlich Flussbett, ohne Hausplattformen. Berührt der
Strich vorhandene Gewässer oder Flusswasser, gewinnt der niedrigste vorhandene
Kontaktpegel. Die verbundenen Gewässer werden vereinigt; trockenfallende Teile
entfallen. Bestehende Becken werden bei einer Pegelsenkung nicht automatisch
vertieft. Hohe Bereiche benötigen gegebenenfalls mehrere Striche, bis Wasser
sichtbar wird. Wasser breitet sich nicht außerhalb der gemalten Fläche aus.

Niedriges Gelände am äußeren Ufer wird bis zum Pegel aufgeschüttet, mit einem
weichen Übergang über ein Viertel des Weltradius, mindestens fünf Fuß. Höheres
Gelände und Wasseranschlüsse erhalten keinen zusätzlichen Wall. Bei nachträglicher
Höhenbearbeitung verschwinden trockengelegte Teile dauerhaft aus der Wasserfläche.
Späteres Absenken allein stellt sie nicht wieder her. Inseln und getrennte
Restgewässer entstehen aus der verbleibenden Fläche; vollständiges Trockenlegen
entfernt das Gewässer. Land und Wasser teilen einen atomaren Undo-/Redo-Schritt.

Live-Vorschau, Pointerup und Abbruch folgen
[Vorschau und Nebenläufigkeit](#vorschau-und-nebenläufigkeit).
Der Kern berechnet Pegel und Vorschau aus dem bestätigten Ausgangszustand.
Gewässeränderungen führen betroffene Flussprofile und Fundamente nach; Flussverläufe
bleiben erhalten. Straßenrouten berücksichtigen lokale Wasserflächen.

Technische Grenzen: 4.096 Pfadpunkte, 100.000 geänderte Höhenpunkte einschließlich
Ufer, 400.000 Rasterkandidaten im Strichrechteck und 200.000 Konturpunkte je Aktion
oder geladener Ansicht. Pegeländerungen bestehender Gewässer erlauben höchstens
100.000 Rasterkandidaten je betroffenem Gewässerrechteck; Flusskontaktabtastung ist
auf insgesamt 200.000 Prüfungen begrenzt. Die Gewässernachführung grober
Höhenänderungen erlaubt insgesamt 100.000 verschiedene betroffene 5-Fuß-Rasterzellen
je Abschnitt. Dafür zählt die Überlappung des geänderten Spline-Einflussbereichs
mit den umschließenden Gewässerrechtecken; überlappende Einflüsse zählen einmal.
Lokale Höhenautoren
bleiben bei groben Änderungen erhalten. Zu große Aktionen werden vollständig
abgelehnt. Persistenz und Import folgen [Dateien und History](#dateien-und-history).

## Optionaler Atlas-P0-Versuch

P0 ist ein eigener, ausdrücklich gewählter Höheneditor. Er bietet Verschieben
und Zoom vom Nahbereich bis zur Welt, Raster ein/aus, Anheben und Absenken,
Undo/Redo sowie Neu, Öffnen, Speichern und Speichern unter. Die Pinselgröße wird
in Bildschirmpixeln, die Höhenänderungsrate in Metern pro Sekunde eingestellt;
die Berechnung verwendet Fuß und Sekunden. Straßen, Häuser, Innenräume,
Landschaft, Regionen und lokale
Gewässerwerkzeuge gehören weiter zur V7-Anwendung und sind im P0-Fenster nicht
verfügbar.

Eine neue P0-Welt ist Ozean mit natürlicher Höhe −100 Fuß und Meeresspiegel 0.
Die natürliche Oberfläche entsteht aus der Summe relativer Höhenfelder mit
Abständen von `5 × 2^level` Fuß auf Stufen 0–21. Erst die vollständig
rekonstruierte Summe wird auf ±100.000 Fuß begrenzt. Weltkoordinaten müssen
endlich und innerhalb ±100.000.000 Fuß sein. Grobes Anheben oder Absenken lässt
die feineren Restwerte unverändert; an den Höhenlimits kann die abschließende
Begrenzung Relief abschneiden. Küsten folgen der zusammengesetzten Oberfläche,
sie besitzen keine getrennten Höhenautoren.

Für die Farbdarstellung werden Höhen höchstens `0,000001` Fuß von den
Klassengrenzen 0 oder 12 Fuß entfernt auf die jeweilige Grenze gesetzt. Dieses
Band von rund 0,3 Mikrometern stabilisiert Farbklassen bei abweichender
CPU-/GPU-Rundung. Es beschreibt die numerische Toleranz der Darstellung;
Farbentscheidungen unmittelbar an einer Bandgrenze werden auf dieser
Höhengenauigkeit verglichen. Die Regel betrifft ausschließlich die Darstellung; Autorenwerte, exakte
Höhenabfragen, Undo und gespeicherte Daten behalten ihre `Float64`-Werte.

**Bearbeitung beginnt auf sichtbarem, lokal bereitem Gelände.** Diese Freigabe
gilt auch ohne Diagnosemodus. Die nötigen Quellen müssen vorhanden oder
bestätigt leer sein; der sichtbare Wirkbereich muss zur aktuellen Ansicht und
Werkzeugvorbereitung passen und von der GPU fertig gezeichnet sein. Ein Submit
allein ist keine solche Bestätigung. Diese Rückmeldung belegt noch nicht die
erste physische Bildschirmpräsentation.

Eine reguläre numerische Übersicht auf dem gewählten Maßstab und ein gezeichneter
leerer Ozean sind gültige Grundlagen. Ein alter Ersatzframe, eine Ladefläche oder
bloß vorhandene Daten genügen nicht. Die Pinselfläche muss das Fenster mit
positiver Fläche schneiden. Ein über den Fensterrand ragender Pinsel benötigt
nur für den sichtbaren Teil ein Bild; die Daten für den vollständigen Eingriff
bleiben erforderlich. Fehlende entfernte Bildteile sperren einen bereiten
lokalen Ort nicht. Noch ungezeichnete Flächen sind schraffiert. Pinsel und Status
zeigen fehlende Bereitschaft; Fehler bieten einen erneuten Ladeversuch an.
Navigation bleibt bedienbar. Der lokale Quellenbedarf folgt auch dem Zeiger und
Änderungen der Pinselgröße ohne aktive Geste.

Ein Druck vor Freigabe wird abgewiesen. Er erzeugt keine Modelländerung, keinen
Undo-Schritt und keine vorgemerkte Wirkung. Auch wenn die Taste bis nach dem
Laden gehalten wird, beginnt kein Strich automatisch. Der Nutzer muss loslassen
und erneut drücken; bei gehaltener Taste erklärt ein Hinweis diesen Zustand.
Wartezeit und Wege vor der Freigabe werden nicht nachgeholt.

Ein Strich hält Autorenstufe und Pinselparameter bis zum Abschluss fest.
**Gedrücktes Halten vertieft die Stelle. Langsame Züge wirken stärker als
schnelle, weil mehr Zeit auf die betroffenen Stellen entfällt.** C1 verwendet
je Stützstelle den größeren Wert aus einer einmaligen räumlichen Mindestwirkung
und kumulierter angenommener Zeitwirkung: `V = max(F, T)`. Die räumliche
Mindestwirkung folgt dem größten quartischen Kernelwert auf der vollständigen
angenommenen Polylinie, multipliziert mit 1/60 Sekunde der fixierten Rate.
Der Anfangsklick gehört zu diesem einmaligen Anteil. Er wird auf die Zeitwirkung
angerechnet; wiederholte Nullzeitbesuche stapeln keine neuen Mindestimpulse.
Dies ist die in R1 ausgewählte Semantik.

Bewegungs- und Haltezeit werden auf derselben kausalen Uhr einmal verbucht.
Gleiche Zeitstempel erhalten ihre Ecken; ihre neue Zeit verteilt sich nach
Weglänge. Verspätete Ereignisse erhalten ihre noch nicht aufgenommene Geometrie,
erzeugen aber keine bereits verbuchte Zeit erneut. Pro Annahmefenster werden
höchstens 50 ms Zeit proportional auf seine Teilstrecken verteilt. Überzählige
Zeit verfällt und erzeugt später keinen Nachholauftrag. Die Rate bleibt fest.

Vor jeder Annahme werden Quellen, sichtbare Grundlage, Arbeit und Speicher
geprüft und die vollständige Wirkung reserviert. Je Stützstelle dürfen angewandte
und reservierte, noch nicht passend bestätigte Beiträge gemeinsam höchstens
50 ms der fixierten Rate ausmachen. Ein ausgeschöpfter Ort verwirft keinen
anderen zulässigen Ort, auch nicht in derselben Autorenkachel. Vollständige,
passende Renderbestätigungen geben nur ihre tatsächlich dargestellte Wirkung
frei. Teilbilder und alte Belege zählen nicht.

Eigene spätere Änderungen entwerten die beim Beginn nachgewiesene Grundlage
nicht. Neu berührte Orte müssen jedoch ebenfalls sichtbar bereit sein. Fehlen
Quellen oder sichtbare Grundlage, endet die Eingabe vor dem unzulässigen
Abschnitt; der bereits angenommene Teil bleibt erhalten und ein neuer Druck
ist erforderlich. Quellen- und Bildprüfungen erhalten die Ecken des Wegs.
Es gibt kein globales Warten auf eine einzelne eigene Dosis.

Zusammengefasste Mausereignisse werden in ihrer gelieferten Reihenfolge
aufgenommen; ihr zusammenfassendes Ereignis wird nicht doppelt gezählt.
Die gemeinsame noch nicht abgearbeitete Eingabe ist auf 128 Punkte begrenzt.
Nichtterminale Eingabe lässt einen Platz für Up frei. Ein tatsächlicher
Kapazitätsüberlauf wird vor Annahme verständlich abgewiesen und beendet die
weitere Eingabe. Er kürzt keine zuvor angenommene Arbeit und malt keine
Abkürzung durch eine Kurve. Eine langsame Zeichenrunde verwirft keinen schon
angenommenen Weg.

**Loslassen beendet die Eingabe, der Aktionsabschluss folgt nach der letzten
angenommenen Arbeit.** Up reserviert seinen tatsächlichen Endpunkt samt noch
zulässiger Zeit vor Rückkehr des Handlers, auch ohne vorangegangenes Move.
Danach wird keine zusätzliche Zeit oder Geometrie angenommen. Die begrenzte
Fortsetzung kann weitere Frames benötigen; der Status zeigt den Abschluss an.
Die gesamte Geste erzeugt genau einen Undo-Schritt. Nach dem tatsächlichen
Aktionsabschluss erfolgt keine weitere Autorenmutation für diese Geste.

Escape, Fokusverlust, Pointercancel und ausdrücklicher Ansichtwechsel beenden
die Eingabe und erhalten die bereits angenommene Arbeit einschließlich ihrer
Fortsetzung. Ein vollständig aktueller Endstand benötigt keinen künstlichen
identischen Terrainframe. Ausstehende Darstellung bleibt ausstehend.
Schnelle Klickfolgen dürfen weder eine noch abschließende Aktion überholen noch
auf ungesehenem eigenem Gelände unsichtbare Schritte stapeln.

Während einer gehaltenen Bewegung folgt das tatsächliche Gelände dem Pinsel
kontinuierlich. Wenige frühe Zwischenbilder und ein korrektes Endbild genügen
dafür nicht. Cursor und Pinselkreis ersetzen die laufende Ergebnisdarstellung
nicht; Eingabe, lokale Änderung, exakter Renderstand und Pointerup werden getrennt
beobachtet. Verfehlte Live- oder Zeitziele bleiben im Prüfstand ausdrücklich offen.

Grobe Ansichten verwenden numerische Übersichten feiner Höhenbeiträge. Sie
erhalten den Einfluss lokaler Details auf die zusammengesetzte Oberfläche und
deren Küste; sie verlangen keine vollständige Feindatenabdeckung im aktiven
Editor. Genaue beliebige Punktabfragen bleiben bei ungeladenen Feindaten
unbekannt, bis die betreffende Detailansicht geladen ist. Für die lokale
Bearbeitungsfreigabe werden die Quellen der gewählten Autorenstufe und gröbere
Beiträge benötigt.

P0-Projekte verwenden `.saltatlas` als SQLite-Format **24** mit Schemakennung
`atlas-p0-height-2`. Gespeichert werden sparse relative Höhenkacheln,
Projektmetadaten und abgeleitete numerische Übersichten desselben bestätigten
Sequenzstands. Dieses Versuchsformat ist getrennt vom V7-Format 22; auch das
frühere P0-Format 23 wird verständlich abgelehnt und nicht migriert.
Öffnen arbeitet auf einer temporären Kopie; Undo/Redo bleibt
auf die Sitzung begrenzt. Eine lokale Änderung, ihre Bestätigung in der
Arbeitskopie und ihre Speicherung in der Projektdatei sind verschiedene Zustände.
Speichern veröffentlicht den reservierten Stand atomar. Spätere Bearbeitungen
bleiben ungespeichert, bis ein weiterer Speichervorgang auch sie erfasst.
Das Lesen benötigter Ausschnitte kann während des asynchronen Speicherns
weiterlaufen. Schreibaufträge und Projektwechsel bleiben geordnet; die Datei
enthält weiterhin genau den reservierten Stand.

Undo/Redo, Speichern, Recovery, Neu, Öffnen und Schließen verwenden dieselbe
Aktionsbarriere. Sie versiegeln zunächst die Eingabe und warten auf sämtliche
angenommene Restarbeit, bevor History, Writer oder Dateisnapshot ihren Stand
auswählen. Neu, Öffnen und Schließen warten außerdem auf ausstehende Schreibaufträge. Bei ungespeicherten Änderungen stehen
**Speichern, Verwerfen und Abbrechen** zur Wahl. Abbrechen erhält den vollständigen
abgeschlossenen Strich samt History und lässt das Dokument geöffnet. Ein
fehlgeschlagenes Öffnen erhält ihn ebenfalls. Erfolgreicher Dokumentwechsel
und Disposal invalidieren alte Fortsetzungen und verspätete Antworten. Ein Fehler
beim Speichern oder eine fehlende Bestätigung des Editors schließt das Fenster nicht.

Nach einem Schreibfehler bleiben die angenommenen Änderungen im Editor und der
Fehler sichtbar. Weitere Bearbeitungen und Historyaktionen pausieren; Navigation
bleibt möglich. **Speicherstand prüfen** gleicht die erhaltenen Änderungen mit der
Arbeitskopie ab und versucht eine sichere Fortsetzung. Speichern nutzt bei Bedarf
denselben Weg. Schlägt er fehl, bleiben Fehler und Änderungen erhalten. Neu,
Öffnen oder Schließen ermöglichen weiterhin das ausdrückliche Verwerfen; andere
Bedienelemente dürfen den Speicherfehler nicht als „Bereit“ verbergen.

Der normale Start sammelt kein ausführliches Diagnosejournal und zeigt keine
künstlichen Belastungswerkzeuge. Eine ausdrücklich gestartete Diagnose darf
das Verhalten nur beobachten. Prüfverfahren stehen im
[Neubauplan](implementation/atlas-rebuild-plan.md#6-prüf--und-performancevertrag),
der erreichte Stand und offene Abnahmen im [Status](implementation/status.md).
