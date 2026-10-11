# Gemeinsamer Atlas: räumlicher und technischer Anschluss

Stand: 11.10.2026. Normative Grundlage ist [ARCHITECTURE](ARCHITECTURE.md),
der vollständige Nutzen steht im [Atlasplan](ROADMAP-HEX-ATLAS.md).
Diese Datei besitzt Maßstab, Geometrie, räumliche Abfragen und Atlascommands.
Speicherung/Host/Extensions werden nicht nochmals hier spezifiziert.

## Gemeinsame räumliche Darstellung

Ein flacher, metrischer, unbegrenzter Atlas verbindet alle Details. Eine Kamera,
Auswahl, Werkzeugoberfläche und History; keine automatische neue Welt pro
Dungeon und kein obligatorischer Stadt-/Dungeonmodus. Ein gültiger Detailowner
kann unverortet existieren und später platziert werden. Mehrere Eingänge zeigen
auf dieselbe Instanz. Die belegte Ausdehnung ist eine abgeleitete Übersicht,
keine Bearbeitungskante. Laden, Pan, Zoom und Levelwechsel erzeugen keine Daten.

Eine Meile = 1609,344 m, fünf Fuß = 1,524 m. Physische Maße werden nicht aus
Exportpixeln oder Listenpositionen abgeleitet. Render, Hit, Navigation, Preview
und Ausgabe verwenden dieselben Transformationen. Lokale Räume bleiben nahe
ihrem Ursprung; globale große Anker und kleine metrische Offsets werden erst
relativ zur Kamera verrechnet. Große vorzeichenbehaftete Chunk-/Zelladressen
werden exakt serialisiert, nicht vorzeitig in ungenaue absolute Doubles gewandelt.
Die Kamera besitzt ebenfalls Anker plus lokalen Offset. Integeradressen können
als Dezimalzeichenfolgen/BigInt geführt werden; geometrische Differenzen werden
erst nach Bereichs-/Präzisionsprüfung in lokale Fließkommawerte umgerechnet.
Die konkrete Basisnormalisierung wird mit Work 1 festgelegt; ihre Invariante
ist bereits fest: benachbarte Meter/Zellen bleiben auch an großen positiven
und negativen Ankern unterscheidbar. Numerisch unzuverlässige Eingaben werden
erklärt abgelehnt, niemals still gerundet. Keine Produktgrenze oder zugesagte
unendliche IEEE-754-Präzision.

## Ein Raumvertrag, passende Geometrieformen

**Ein metrischer Raumvertrag** verbindet Roomidentität, räumliches Volumen,
Grenzfläche, Passage, Anchor und queries für Standbarkeit/Sicht/Licht/Schall.
Die Autorenrepräsentation kennt zwei durch Pflichtanforderungen begründete
Formen: feste Dungeonzellen und maßhaltige Gebäudegrundrisse. Das sind keine
getrennten Editoren, Kameras oder Datenbanken. Gemeinsame Auswahl-/Command-
und Projektionsregeln werden nur einmal implementiert; geometrische Operationen
werden auf der jeweiligen eindeutigen authored Form ausgeführt.

| Kandidat | Konsequenz für bekannte Anforderungen | Entscheidung |
| --- | --- | --- |
| Alles aus festen 5-Fuß-Würfeln | Einfaches Dungeonrouting; freie Hausdrehung/exakte Gesamtskalierung erfordern Rundung, veränderte Zellgröße oder eine zweite Außenkontur | Als universelles Modell verworfen: keine dieser Folgen darf still auftreten. |
| Alles als beliebige 3D-Polygone/CSG | Maßhaltige Häuser möglich; Dungeonvoxel-, Flächen-, Split- und Triggerregeln müssten über eine allgemeine Topologie erst nachgebaut werden | Als universeller Geometriekern unnötig komplex; keine freie 3D-Meshmodellierung im Auftrag. |
| Gemeinsamer metrischer Vertrag mit typisierten Zellvolumes und Grundrissprismen | Dungeonraster bleibt exakt; Häuser behalten ihre Maße. Nur die bekannten lokalen Geometrieoperationen benötigen passende Berechnung | Gewählt. Keine doppelte physische Wahrheit für dasselbe Objekt und kein allgemeines GIS-/3D-Framework. |

Ein Dungeonvolume ist ein sparsamer Satz ganzer 5-Fuß-Würfel; Standarddecke
10 Fuß, horizontale und vertikale Auflösung 5 Fuß. Floors/Walls/Ceilings und
explizit beschriebene Flächen gehören dazu. Der normale 2D-Schnitt zeigt zwei
vertikale Zellen; Slicewechsel während einer Geste bleibt möglich. Move/Copy
auf Raster und 90°-Drehung erhalten alle Zellen; freie Drehung/Skalierung ist
für diese Dungeonvolumes nicht erforderlich. Bestehende Dungeondraft-
Zeichenobjekte, Kurven, Terraintexturen und Dekoration bleiben eigene authored
Darstellungsrecords: Sie sind keine heimlichen Hindernisse oder zweite
Standbarkeitskarte. Strukturierte Räume zeigen ihre physische Grenze aus der
zugeordneten Geometrie. Eine bestehende reine Zeichnung erhält erst nach
expliziter geprüfter Zuordnung/Umwandlung physische Dungeonvolumes; kein stilles
Rasterisieren mit Text-/IDverlust beim Öffnen.

Ein Gebäude besitzt maßhaltige lokale Metergrundrisse, Geschosshöhen und
Grenzsegmente; räumliche Bereiche sind begrenzte Grundrissprismen. Außenform,
Innenraumteilung, Wände und Dach werden aus diesem gemeinsamen Zustand
abgeleitet. Freie Drehung ändert die Pose, horizontale Gesamtskalierung die
gesamte Geometrie/Anker mit demselben Faktor, niemals die Höhen. Keine autonome
City-Footprintkopie neben einem widersprechenden Dungeoninneren. Zellgebundene
Dungeoninhalte werden nicht still in freie Hausgeometrie umgedeutet. Eine
Verbindung zwischen beiden ist eine echte metrische Passage mit typisierten
Seitenankern; Umwandlung ist eine ausdrücklich geprüfte Operation. Details und
Randfälle besitzt der [Gebäudevertrag](ROADMAP-CITIES-IMPLEMENTATION-PLAN.md#gemeinsamer-gebäudezustand-erste-umsetzung).

**Messbares Orakel:** Eine 3-m-Wand auf 1,1 skalieren ergibt 3,3 m und bewahrt
die Innenraumrelation; ein Dungeonmove bewahrt 1,524-m-Würfel. Beide liegen
in derselben Kamera und History. Wand-/Türanker und Distanzabfrage stimmen nach
Undo/Reopen überein. Ein gemeinsames Raster als Bedienhilfe darf angeboten
werden, aber keine dieser Wertsemantiken heimlich ändern.

## Autorenidentität und Raum-Lifecycle

Room besitzt stabile ID, Autorenblöcke, Nummer, optionale Level-/Gruppenzuordnung
und höchstens eine zugeordnete Geometrie; ein Volume gehört höchstens einem
Room. Geometrie ist kein Room-Key. Leerer oder aktuell unzugeordneter Inhalt
ist gültig und bleibt auffindbar. Ableitung einer Navfläche erzeugt keine
Roomidentität.

Zusammenhängendes neues Zeichnen vereinigt Volumegeometrie, räumliche Trennung teilt sie automatisch; Roomzuordnung folgt dabei den folgenden Regeln, nicht einer unabhängigen Sessionkopie. Move erhält die Room-ID. Split gibt dem deterministisch bestpassenden Ergebnis
die alte ID; andere Ergebnisse erhalten neue zunächst leere Rooms. Gleichstand
verwendet eine dokumentierte stabile Geometrieregel, keine Arrayreihenfolge.
Merge ordnet einen ausgewählten bestehenden Room zu; übrige vollständige Texte
bleiben unzugeordnet erhalten. Nie vollständige Prosa auf jedes Splitstück
kopieren oder beim Merge löschen. Feature-/Surfaceanker folgen ihrer Geometrie;
ungültige Anker werden im Preview reparierbar oder unzugeordnet gezeigt.
Level ist ein konzeptioneller, nicht überlappender Z-Satz, kein neues Dokument;
ein Mehrhöhenroom wird zur Vererbung nicht geteilt.

Path ist eine nicht verzweigte parametrisierte Verbindung mit 3D-Endpunkten,
Wegpunkten, Breite/Höhe und Abschnittsform. Er materialisiert gewöhnliche
Volumengeometrie; Materialisierung ist reproduzierbare Ableitung des authored
Paths, kein unabhängig bearbeitbarer zweiter Stand. „In feste Fläche umwandeln“
übernimmt das sichtbare Ergebnis und beendet Parametrik. Endpunkt-/Wandzug
reroutet als Vorschau; unmögliches Routing verhindert Annahme und erklärt den
Konflikt. Ein gezeichneter dekorativer `MapPath` ist kein solcher Path.

Passage besitzt stabile ID und eigene Passierbarkeit sowie Sicht-/Licht-/
Schallübertragung. Dungeonseiten bestehen aus vollständigen 5-Fuß-Grenzflächen;
Hausseiten aus maßhaltigen Grenzsegmenten. Beide konsumieren denselben
metrischen Verbindungskontrakt. Dangling/unaufgelöste Passage bleibt sichtbar,
aber nicht reisbar. Entfernte Passage stellt die Wand wieder her, ohne ihre
Autorenprosa zu löschen. Gerichteter Link und Rücklink sind unabhängig;
ausdrücklich angelegtes Paar wird in einem Command gespeichert.

## Keys, Features, Templates und geschützter Graphentwurf

Geordnete Autorenblöcke erhalten Wortlaut, Whitespace und sichtbare Linktexte.
Geometriefakten, Ausgänge und wirksame Attribute sind separat ableitbar; eine
Wandänderung überschreibt keine Prosa. Attributvererbung folgt einem eindeutigen
Pfad Dungeon → optional Level → optional eine Gruppe → Room → explizite Surface;
lokaler Wert, Unterdrückung und geerbter Wert sind verschieden. Freie
Beschreibungsattribute sind keine Passierbarkeitsmechanik.

Curiosity mit optionalem Puzzle-Tag, Trap sowie Encounter-/Lootreferenz bleiben
unterschiedliche Featurearten. Ein Feature hat genau einen physischen Anker,
Traps zusätzlich beliebige zugeordnete Triggervoxel. Authored Maxcharges/
Resetregel und laufende Charges/Countdown/Entdeckung sind getrennt. Nur
bestätigte tatsächliche Aktivierung verbraucht Charges; weitere Nutzung startet
einen bestehenden Countdown nicht erneut. Der Regelmodus legt explizit Reset
ab null oder ab Unterschreiten des Maximums fest. Zeit und Reiselifecycle
konsumieren diese Fakten, sie erfinden kein narratives Ergebnis.

Clipboard/Prefab kopiert gewählte authored Inhalte mit neuen Identitäten.
Verknüpfte Templates liefern ausschließlich gewählte Inhaltsblöcke, keine
Geometrie/Roomidentität. Templateänderung propagiert auf verknüpfte aktuelle
Instanzen; lokale Bearbeitung trennt ausdrücklich unter Erhalt des aktuellen
Wortlauts. Abgeschlossene Runtimefakten werden dadurch nicht neu gerechnet.

Dungeon-/Level-/Area-Ziellevel und geplante Sessionanzahl sind authored Vorgaben; Sessionanteile werden ausdrücklich verteilt statt auf jedem Kind doppelt gezählt. Graph-/Contentbudgetdiagnostik konsumiert dieselben versionierten 2014-Encounter-/Lootberechnungen, keine zweite Graphregelmaschine.

Graph ist eine zusätzliche Inspektions-/Entwurfsansicht desselben Dungeons,
kein zweiter World- oder Topologiestore. Jeder Graphumbau bleibt ein geschützter
Gesamtdraft mit Karten-/Keyvergleich, Remap- und Konfliktanzeige. Annahme speichert
den ganzen gültigen Umbau atomar; Verwerfen lässt bestätigte Arbeit unverändert.
Undo nach Annahme bleibt möglich. Draftspeicher und große Undo-Deltas werden
separat budgetiert; ein Preview ist kein Autosave der Vorschlagswahrheit.

## Mehrstufige Landschaft und Atlasgestaltung

Hexgröße bezeichnet Mittelpunktabstand: 3, 9, 27, … Meilen mit Faktor 3;
größere Stufen bei Bedarf, gemeinsamer Ursprung/Ausrichtung. Reguläre Hexes
verschiedener Stufen verschachteln sich nicht exakt. Daher wird jede
Eigenschaft über positive Flächenüberschneidung von gröberer Vorgabe und
ausdrücklicher feinerer Überschreibung bestimmt. Kein „ein grober Hex ist
genau neun vollständige Kinder“. Gleichstufige Hexes partitionieren die Fläche;
Grenztreffer verwenden eine stabile Toleranz-/Tiebreakregel. Punktabfrage nimmt
die feinste explizite Eigenschaft an diesem Punkt; Ansicht integriert die
betroffenen Flächen. Grobe Änderung erhält explizite feinere Werte; Reset
entfernt nur die gewählte lokale Eigenschaft. Ein vollständig geschriebener
V1-Land/Farbe/Waldwert migriert zunächst als ausdrücklich gesetzter Stand;
unbekannte Autorabsicht wird nicht als „geerbt“ erfunden.

Die 35 geschützten Biome, Aliasauflösung und Encounterzuordnung kommen aus dem
gemeinsamen Installationcatalog; `Any` ist keine zusätzliche Biome-ID.
Custombiome sind such-/pagebar ohne künstliche Anzahlgrenze. Löschen ersetzt
alle aktiven/getrashten Referenzen atomar durch das nicht malbare `Zu ersetzen`
mit Graslandreisesemantik und erhält Encounter Tables. Bulk-Replace ist ein
eigener Command. Symbolimport/-zuweisung ist idempotent; Customsymbollöschung
ersetzt die gleichen Referenzklassen durch `Ort`. Palette/UIdetails dürfen
besser werden; diese Identitäts-/Wirkungsregeln sind Pflicht.

Küsten/Wasser, freie Flüsse/Straßen, Terrain-/Höhenmasken, Symbolinstanzen,
Wälder, Labels, Grenzen, Fraktions-/Klimaflächen und kalibrierte Referenzen
sind eigene sparsame authored Recordarten. Zusammenhängende Wege besitzen
zusammenhängende Geometrie; Chunkgrenzen sind Ladeindizes, keine künstlichen
Endpunkte. Rastermasken erhalten versionierte sparse Tiles und originale
Stilwerte. Messung und Kalibrierung nutzen Metertransform, nicht Exportauflösung.
Neue Felder erhalten den passenden Schema-/Codecvertrag bei der Werkzeuglieferung;
keine vorsorgliche generische „beliebige Layerdaten“-Ablage.

## Dungeon-Geometrie und Vorschau

Editoraktionen bleiben während Erkundung verfügbar. Geometriepreflight prüft
Actorpositionen, Route, Anker, Keys und Verbindungen vor Commit. Entfernter
Actorplatz zeigt die nächste gültige Position im selben Volume, danach direkt
verbundenem Volume; ohne gültige Position wird abgelehnt. Die Relocation ist
sichtbar und wird mit der Geometrie gespeichert, verbraucht keine Reisezeit und
löst keine neuen Events aus. Offene Reise hält am letzten vollendeten Segment;
Routing wird invalidiert. Ein späteres Undo darf zwischenzeitliche Reise-
oder Worldfolgen nicht durch Vollsnapshot ersetzen.

Werkzeuge haben begin/update/commit/cancel. Keine History-/DBeinträge je
Pointermove. Draft trägt Ziel-/Basisrevision und Aktivierung; Slicewechsel und
temporäres Pan erhalten ihn, Escape/Abbruch verwirft nur den betroffenen Draft.
Unklare überlagerte Treffer sind ausdrücklich wählbar, keine unsichtbare
global feste City-vor-Dungeon-Priorität. Fehler bewahrt die offene Eingabe und
die ursprüngliche Zielbindung. Ein stale Generatorresultat wird nie angewandt.

## Größen, Abfragen und Umsetzung

Sparse Records/Chunks und lokale Indizes sind von Anfang an nötig, damit
bekannte Größen keine Vollkopie voraussetzen. Chunkgrößen sind austauschbare
Implementationsparameter. Render/Hit/Preview skalieren mit sichtbaren oder
betroffenen Inhalten. Long Jobs liefern innerhalb 100 ms Feedback, bleiben
abbrechbar und lassen Kamera/Auswahl/Lesen weiter funktionieren. Livecommands
haben Priorität; Commit serialisiert nur den kurzen abschließenden Write.

| Population | Eigenständiges Ziel, kein Durchschnitt |
| --- | --- |
| Atlas: 40.000 × 20.000 km, 100.000 explizite Hexes, 5.000 Orte, 50 Details | Navigation p95 ≤33 ms, lokale Vorschau ≤100 ms |
| Stadt: 5.000 Gebäude | Teilabfragen/Griffe ohne Vollparse/-neugenerierung; gleiche Atlasbudgets |
| Dungeon: 100.000 authored Cells | Erster Viewport ≤2 s, Kamera/Hover p95 ≤16 ms, Preview ≤50 ms, gewöhnlicher Commit ≤500 ms, Playerupdate ≤100 ms |
| Gesamtprodukt RP-R/RP-L/RP-X | Exakte Populationen/Hardware/Messbedingungen aus TN; durable Ack p95 ≤1 s auf RP-R, Cold/Crashresume ≤5/10 s; Reserven/Temp-/Cancelziele separat |

Die isolierte SQLiteprobe ist kein Nachweis dieser Render-/Gesamtprofile.
Details und Rohmessungsanforderungen stehen im [Prototypplan](ROADMAP-SALTMARCHER-ADR-PROTOTYPES.md).
Bereits vorhandene RelativeFrame-/Polygon-/Volumealgorithmen werden auf diese
Invarianten geprüft und nur bei geringerem Gesamtaufwand übernommen. Die
heutigen Whole-Document-Sources, FileTransaction und SpatialCanvas-Schleifen
sind keine Ziel-API. Aktuelle native Formate bleiben explizite Import-/Export-
Adapter; die Datenbank ist nach Cutover die einzige Autorenwahrheit.

Historische Codeanschlüsse/Belege, darunter I01a–c, #80 und City-/Dungeon-H02,
stehen unverändert in `acceptance.json`, `docs/reference/` und dem Gitstand
`116c16af48b6a073216685c8d8e2cc74fada82c3:ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md`.
Sie belegen ihre damaligen Grenzen; sie verpflichten den Neuaufbau nicht auf
die damaligen internen Schnittstellen.
