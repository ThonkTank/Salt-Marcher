# Produktvertrag

Verhalten, Format und Grenzen des Atlas-Editors. Umsetzung: [Architektur](architecture.md);
Prüfstand: [Status](implementation/status.md); Befehle: [README](../README.md).

## Koordinaten, Eigentum und Lebenszyklus

| Größe                     | Vertrag                                                         |
| ------------------------- | --------------------------------------------------------------- |
| Außenkoordinaten / Winkel | Endliche Fuß innerhalb ±5.000.000 / endliche Radiant            |
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

Rezeptversion **3**: Seed, Section-/Seitenidentität und Ausgangsbestand bestimmen
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
Konfliktprüfung. Ein unvollständiger letzter Slot wird nicht platziert.
Der Zufallsstrom ist FNV-1a-u32 über ASCII `saltmarcher.parcels`, NUL, `v1`, NUL,
Seed u32LE, Section-ID-Bytelänge u32LE, UTF8-ID und Seitenbyte 0/1; Start
2166136261, Faktor 16777619, wrapping u32. Anschließend LCG
`1664525*x+1013904223`, wrapping u32, Bereich per Modulo. Die `v1`-Hashdomäne
bleibt im Rezept 3 erhalten. Skips und Suchposen ziehen keinen neuen Zufall.

Zuerst wird das Grundstück geprüft, dann werden die vorgeschlagenen Hausmaße im
Raster gesucht. Ohne Fit werden kleinere Maße innerhalb der Mindestmaße geprüft:
absteigende Fläche, bei Gleichstand absteigende Breite; keine Drehung oder
Neuwürfelung. Jede zusätzliche Größenprobe verbraucht einen Versuch. Dies gilt
nur für neue Hausvorschläge, niemals für bestehende Häuser. Die endliche lazy Suche
ordnet nach `(abs(x-x0),y,x)`, `x0=-floor(width/2)`, `y≥0`; die erste vollständig
enthaltene kollisions-/abstandsfreie Pose gewinnt. Es werden alle zulässigen
Tiefen einer bevorzugten x-Distanz vor der nächsten Distanz geprüft. Bounds
begrenzen den Suchraum konservativ, exakte Prädikate entscheiden.

Ein gültiges Grundstück ohne Hausfit bleibt leer und manuell befüllbar:
`noGridFit` bedeutet keine enthaltene Pose, `clearanceBlocked` mindestens eine
enthaltene, aber blockierte Pose. Ungültige Grundstücke werden ausgelassen.
IDs/Namen entstehen erst für den fertigen Verbund; Häuser erhalten sie nur bei
tatsächlicher Befüllung.

Limits: **200 gebundene Parzellen je Straße** (auch leere, ohne gelöste); je
Generierung **200 neue Häuser**, **100.000 neue Zellen**, **10.000 Versuche**.
Slot und jede Pose verbrauchen vor Prüfung dasselbe Versuchsbudget. Die letzte
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

## Landschaftspinsel

„Landschaft“ malt dekorative Assets für Wald, Wiese, Buschland und Felsen im
Außenbereich ab 20 % Zoom. Linke Taste ziehen streut, Loslassen übernimmt den
Strich als einen Historyschritt; Escape, Fokusverlust und Pointercancel verwerfen
die laufende Geste. Auswahl trifft sichtbare Assets; Löschen entfernt den ganzen
Strich. Einzelne Assets sind noch nicht separat verschiebbar oder radierbar.

Pinselradius: 5–500 Fuß (Vorgabe 30), Dichte: 5–100 % (65 %), Assetradius:
1–80 Fuß (8). Die Dichte bestimmt die Belegung eines versetzten Rasters;
Größenvariation 70–125 %, Drehung und vier Symbolvarianten kommen aus einem
für die Geste fixierten Seed. Die Platzierung folgt dem überstrichenen Kreis,
nicht der Häufigkeit der Pointerevents. Vorschau und Übernahme verwenden denselben
reinen Generator. Wiederholtes Übermalen legt zusätzliche Assets an.

Ein Strich enthält höchstens 4.096 Assets und 4.096 Eingabepunkte. Zu lange oder
aufwendige Striche werden atomar abgelehnt (maximal 100.000 Pfadunterteilungen
je Segment, 100.000 belegbare Rasterplätze und eine Million Kandidatenprüfungen).
Ein Strich ohne Treffer ist ein No-op. Assets sind Dekoration ohne Einfluss auf
Kollisionen, Höhen oder Bebauung; Straßen und Dächer zeichnen darüber.
Gespeichert werden Landschaftsart und konkrete Position, Radius, Drehung und
Variante jedes Assets. Zoomen, Undo/Redo und Dateiöffnung verändern sie nicht.
Die Übersicht zeigt vereinfachte Symbole, höchstens 512 gleichmäßig ausgewählte
Assets je Strich; unterhalb der sichtbaren Symbolgröße entfallen sie.
Eigene Assetimporte und Texturmalerei sind nicht Teil dieses Werkzeugs.

## Höhen, Fundamente und Höhenwasser

Natürliches Gelände ist ein dünn belegtes 5-Fuß-Höhenraster, ohne Eintrag 10 Fuß.
Höhen und globaler Wasserstand sind endlich innerhalb ±100.000 Fuß; der anfängliche
Wasserstand beträgt 0 Fuß. Interpolation teilt jede Rasterzelle entlang ihrer
Nordwest-Südost-Diagonale in lineare Dreiecke.

Das Werkzeug „Höhen“ funktioniert im gesamten Außenzoom. Vorgaben: Anheben,
25 Fuß Radius, 1 Fuß Änderung, 25 % Stärke, Zielhöhe 10 Fuß. Radius 5–500 Fuß,
Änderung 0,1–100 Fuß, Stärke 0,01–1. Ein Strich enthält höchstens 100.000
Eingabepunkte und verändert höchstens 100.000 Rasterpunkte. Wegabtastung mit
max(Radius/4, 2,5 Fuß) ist unabhängig von Ereignisrate und Zoom; wiederholtes
Überstreichen kumuliert. Glätten nähert sich dem Mittel der neun Nachbarpunkte,
Einebnen der Zielhöhe, jeweils mit radialem weichem Abfall.
Loslassen übernimmt einen Strich als einen Historyschritt; Escape, Blur und
Pointerabbruch verwerfen ihn. Ablehnungen bleiben im gemeinsamen Workflow prüfbar.

Jedes Haus besitzt eine Fundamenthöhe von 0–100 Fuß (Vorgabe 1) und eine
Übergangsbreite von 0–500 Fuß (Vorgabe 10). Die höchste natürliche Geländehöhe
unter der oberirdischen Hausgrundfläche bestimmt die ebene Plattform. Ihre
Fundamentoberkante liegt um die Fundamenthöhe darüber. Keller ohne Dachkontur
bilden keine Geländeplattform. Der Übergang außerhalb der Grundfläche läuft
weich aus; überlagerte Übergänge verwenden das Maximum. Hausgrundflächen haben
Vorrang vor fremden Übergängen. Plattformen werden ausschließlich aus natürlichem
Gelände berechnet, niemals aus anderen Aufschüttungen. Bau, Bewegung, Grundriss-
und Höhenänderungen führen sie automatisch nach; Löschen entfernt sie. Räume und
Geschosse bekommen keine eigenen Welthöhen; Straßen besitzen keine Steigungsregeln.

Höhenwasser liegt überall dort, wo die wirksame Geländeoberfläche niedriger als
der Wasserstand ist. Es blockiert weder Neubau noch Bestandsänderungen und erzeugt
keine Warnmeldungen. Wasserstand hebt Fundamente nicht an. Wasser erscheint unter
Dächern; überflutete Fundamentränder erhalten Wasserfarbe. Manuelle Wasserpolygone
behalten unabhängig davon ihre bisherigen Kollisionsregeln.

Relief und zuschaltbare Höhenlinien zeigen die Oberfläche; Höhenlinien beginnen
bei 5 Fuß Abstand und werden bei weitem Zoom ausgedünnt. Die Höhenanzeige am
Mauszeiger entspricht der dargestellten interpolierten Oberfläche. Übersichtsstufen
mitteln natürliche Höhen; Hausplattformen werden bis zu einer Abtastweite von
160 Fuß berücksichtigt. Gröbere Stufen zeigen Landschaftsformen, keine exakten
Hausfundamente. Bearbeitung bleibt stets auf dem ursprünglichen 5-Fuß-Raster.

## Bedienung

### Navigation und Oberfläche

Mitteltaste oder Leertaste+Ziehen verschiebt die Karte, Mausrad zoomt. Ein Haus
öffnet per Doppelklick oder „Innen öffnen“; die Kamera bleibt erhalten.
Außenzoom reicht bis 0,001 %. Straßen und Höhen lassen sich in der gesamten Außenübersicht bearbeiten; andere Außenobjekte und Innenräume werden ab 20 % bearbeitet. Im Parzellenkontext
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

### Straßenentwürfe und Parzellenplanung

Neue Straßen verwenden automatisch geglättete Verlaufspunkte (zentripetales
Catmull–Rom als kubische Bézier-Knoten). Klicken setzt Punkte, Ziehen bewegt sie.
Zwei Punkte ergeben eine Gerade; direkte Doppelpunktsegmente werden verhindert.
Bestandsstraßen behalten ihre Kurven. In der Übersicht erscheinen Verlaufspunkte und Verlängerungsgriffe, ab 20 % zusätzlich Bézier-Griffe. Punktbewegungen verschieben die zugehörigen Griffe gemeinsam, ohne automatische Neuglättung. Plusgriffe an den
Enden beginnen Verlängerungen; nur die neuen Kanten werden geglättet, vorhandene
Kanten bleiben erhalten. Die Anschlussrichtung folgt der äußeren Tangente.

Rauheit ist ein Entwurfswerkzeug für echte Geometrie: 0–1, Vorgabe 0,33;
„Neue Variation“ ändert den entwurfslokalen Seed. Jede Vorschau wird erneut aus
der Grundkurve berechnet. Die deterministische Querabweichung verwendet maximal
eine halbe Straßenbreite bei voller Stärke, eine Wellenlänge von mindestens
acht Straßenbreiten beziehungsweise 40 Fuß und einen weich auslaufenden Verlauf
an gesetzten Punkten. Diese Punkte und ihre Anschlussrichtungen bleiben fest.
Zusätzliche Stützpunkte gehören zur jeweiligen ursprünglichen Section.
„Verlauf aufrauen“ beginnt bei Bestandsstraßen ausdrücklich mit Stärke 0;
gewöhnliche Punktbewegungen erzeugen keine Rauheit. Übernahme speichert nur die
resultierenden kubischen Nodes, keine Rauheitsparameter. Zoom und Dateiöffnung
verändern das Ergebnis nicht. Verlängerungen verändern nur neue Kanten;
Node-/Samplelimits und alle Konfliktregeln gelten unverändert.

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

Ein interaktiver Workflow besitzt unveränderliche Kandidaten. Jede
Inhaltsänderung ersetzt Kandidat und Vorschauergebnis; Vorschau folgt nach
100 ms. Unvollständige Entwürfe bleiben lokal. Geometrieeingaben benötigen
aktuelle Szenen-/Kontext-/Auswahldaten. Canvas zeichnet den veröffentlichten
Snapshot mit der aktuellen Kamera synchron vor der nächsten Darstellung;
separate Paint-Bestätigungen existieren nicht. Navigation bleibt während Reads
möglich, die letzte vollständige Ansicht bleibt sichtbar.

Neue Straßen, Verlängerungen, Gelände und Populate werden über denselben Ablauf
mit Übernehmen, Enter oder Rechtsklick auf die Karte abgeschlossen. Rechtsklick
übernimmt ausschließlich gesetzte Punkte, nicht die schwebende Verbindung zur
Maus. Ein unvollständiger Straßenbeginn wird verworfen; ohne vollständigen
Kandidaten erfolgt kein Write. Ohne Entwurf ist Rechtsklick wirkungslos. Das
Werkzeug bleibt nach Abschluss aktiv. Escape verwirft den Entwurf; während einer
Ziehgeste wird nur diese auf ihren Ausgangszustand zurückgesetzt.
Enter und Escape in Eingabefeldern wirken lokal: gültigen Feldwert übernehmen
beziehungsweise Feldeingabe zurücksetzen, ohne die Planung abzuschließen oder
abzubrechen. Ungültige Werte bleiben mit Feldfehler korrigierbar.
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
auf leerer Karte die Ansicht. Das Straßenwerkzeug setzt und bewegt stattdessen
Verlaufspunkte. Doppelklick auf eine ausgewählte Straße fügt einen Knoten ein;
auf leerer Karte zoomt er um den angeklickten Punkt zur nächsten Ansicht
(0,064, 0,32, 1,28); „Zum Bearbeiten hineinzoomen“ erhält den Kartenmittelpunkt.
Bestehende Auswahl und Entwürfe bleiben beim Zoomwechsel erhalten. Im
Straßenzeichnen löst Doppelklick keinen Zoom aus. Geometrieaktionen benötigen
aktuelle Daten; Bestandsstraßen zusätzlich ihren vollständigen Header.
Straßenlinien haben mindestens zwei CSS-Pixel Breite. Ausgewählte und geplante
Straßen bleiben unabhängig von Kachelpriorisierung sichtbar. Beschriftungen verändern die
Hitpriorität nicht. Innenräume werden weiterhin ausdrücklich geöffnet.

Gebäude besitzen `importantPlace`, standardmäßig false, bearbeitbar als
„Wichtiger Ort“. Die Markierung ist Autorendatum mit Undo/Redo und Dateipersistenz;
sie verändert weder Kollisionen noch Innenräume. Wichtige Orte können schon in
der Stadtübersicht beschriftet werden. Namenspriorität: Auswahl, wichtige Orte,
Straßen, gewöhnliche Gebäude; danach Größe/Straßenbedeutung und stabile ID.
Straßennamen erscheinen in der Stadtübersicht erst ab 20 Fuß Straßenbreite.

Namen erscheinen in 13 CSS-Pixeln mit heller Kontur. Gebäudenamen stehen
horizontal im oder neben dem Dach, Straßennamen folgen geeigneten, ausreichend
geraden Teilstrecken und stehen nie kopfüber. Wiederholungen derselben Straße
halten mindestens 400 Pixel Abstand. Namen kollidieren weder miteinander noch
mit berücksichtigten Bearbeitungsgriffen; bei Platzmangel entfallen sie.
Gebäudenamen dürfen zwei Zeilen beanspruchen; sehr lange Namen werden nur für
die Karte gekürzt. Vollständiger Name und Namensvalidierung bleiben erhalten.
Pro Ansicht werden höchstens 3.000 priorisierte Objektkandidaten betrachtet und
500 kollisionsfreie Beschriftungen gezeichnet.

## Dateien und History

`.saltatlas`: SQLite-Format **13**, ohne Migration/Altformate. Genau fünf
STRICT-/WITHOUT-ROWID-Tabellen: `document_meta(singleton,next_identity)`,
`objects(id,kind,body)`, `house_cells(building_id,payload)`,
`terrain(x,y,z)`, `terrain_settings(singleton,water)`. Keine Arbeitsindizes,
RTrees, Views, Trigger, History oder redundanten Konturen/Bounds.

Autoritativ sind Straßeneigenschaften/Nodes/Sections/Rezept/Marker,
Road-Source gebundener Parzellen, eingefrorene Polygon/Frame-Werte gelöster
Parzellen, Hausidentität/-autoren/Wichtiger-Ort-Markierung/Räume/Verbindungen/Zähler/Placement sowie
Flächenpunkte/-material/-Order, Landschaftsstriche mit konkreten Assets, natürliche Höhenpunkte, Wasserstand und
Fundamenteinstellungen pro Haus. Hauszellen stehen ausschließlich separat.
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
