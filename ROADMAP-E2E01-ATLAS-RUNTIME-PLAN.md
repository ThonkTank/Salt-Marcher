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

## Passive Kartenfläche und Adoptergrenze

Original: [Maps Canvas Requirements](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/maps/requirements/requirements-maps-canvas.md).
Die Zielregel ist eine gemeinsame passive Fläche, kein zweiter Kartenowner.
Ein gemeinsamer Scene-Root liefert Zeichnung und Hitbasis; Kamera, Viewport und
Pointercapture besitzen keine Karten-/Reisecommands. Fachliche Hex-/Raumrefs,
Koordinatenumrechnung, Werkzeugbedeutung, persistierte Inhalte und Runtimepositionen
bleiben bei ihren Adoptern. Labels, Actor-/Reisetokens und optionale Overlays
sind lesende Darstellungen dieser Fakten. Empty/Placeholder legt keine Karte an.

Die Desktopkorrektur in `world-ui.ts`/`hex-map-gestures.ts` verhindert automatische
Worldwrites durch Kameraereignisse und erhält einen unterbrochenen Strich als
lokalen Entwurf. [Verhalten und begrenzte Belege](docs/plans/maps/hex-editing.md)
sind von einer vollständigen gemeinsamen Canvasimplementation getrennt. Desktop
verwendet `PassiveMapCanvas` gemeinsam für World-/Drawing-SVG und eine weitere
SVGfläche im Volume-UI; der bestehende
Hostadapter in `features/atlas` kombiniert Pixi-Renderer, RelativeFrame und
SpatialCanvas. Diese Wege sind keine gegenseitigen Plattformnachweise und
begründen keine neue parallele Autoren-/Kamerawahrheit.

Nächste ausführbare Anschlüsse in dieser Reihenfolge:

1. **Passive Eingaben in allen aktuellen Adoptern.** Die vorhandenen
   `drawing-ui.ts`-/`renderer.ts`-Handler gegen mittlere Taste, ausgewählte
   Zeichenwerkzeuge und offene Kontur-/Keyentwürfe prüfen. Im Atlas-Host
   `AtlasEditor.bind`/`applyKeys`/Inspector-Focusout und Tool-/Space-Pan prüfen:
   reine Navigation darf weder Keyübernahme verlangen noch unerledigte
   Autorenarbeit bestätigen. Erst die jeweilige Fachaktion erhält ihre
   bestehenden Current-/Revision-/Flushguards. Abnahme: ungültige Prosa neben
   Pan/Zoom, Save-/Readfehler, Pointercaptureverlust, Reflow, negative Koordinaten;
   bestätigte Sourcebytes/History bleiben unverändert. Kein allgemeines neues
   Eventframework vor zwei tatsächlich benötigten Adoptern.
2. **Gleiche Render-/Hitbasis vor gemeinsamem Umbau schließen.** Für
   `AtlasRenderer.schedule`/`screenPoint`, `SpatialCanvas.draw`/`hit` und die
   SVGadopter eine Änderung von Kamera/Viewport/Source zwischen Draw und Hit
   kontrolliert nachstellen. Hit darf weder eine neuere Quelle noch eine andere
   Transformation als das sichtbare Bild verwenden. Ein publikationsfähiger
   Frame muss Szene und Transformation gemeinsam binden; bei asynchroner
   Aufbereitung alte Antworten verwerfen. Abnahme: Raum-/Hexgrenzen, Overlays,
   verdeckte/inaktive Geometrie, Pan→Hit vor dem nächsten Frame und Resize.
3. **Rendererfehler lokal wiederaufnehmen.** `ui/atlas-view.ts`-Mount und
   `AtlasEditor.init`/`AtlasRenderer.init`/`destroy` als gemeinsamen vorhandenen
   Lifecycle prüfen. Die Oberfläche muss bei Initialisierungsfehlern Fakten und
   Navigation erhalten und einen ausdrücklichen frischen Renderer ermöglichen;
   ein memoisiertes abgewiesenes Init-Promise ist kein Retry. Abnahme unter
   echter strikter CSP ohne dynamische Codeauswertung: Initfehler, Retry,
   Close-während-Init, schneller Workspacewechsel, genau ein Canvas/Observer
   und keine neue Karte/History. Ein erfolgreicher SQLite-/DOMtest beweist
   keine CSP-/GPU-/Hostqualifikation.

Die nötigen gemeinsamen Präsentationsmechanismen erst aus diesen bewährten
Adoptergrenzen herausziehen; bestehende native Formate, IDs, metrische Geometrie
und autoritative Storecommands bleiben erhalten. Migration betrifft echte
Persistenzbindungen, nicht die bloße Wiederverwendung einer Renderfläche.

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

Hexgröße bezeichnet den Abstand gegenüberliegender Kanten: 3, 9, 27, … Meilen mit Faktor 3 (bei regelmäßigen Nachbarhexes zugleich Mittelpunktabstand). Die kleinste Stufe beträgt 3 Meilen; die weiteste Kameraansicht umfasst eine erdgroße Referenz von etwa 40.000 × 20.000 km, ohne die Welt zu begrenzen;
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


## Umstellung auf das vorläufige Atlaszielsystem

Beauftragte Ausführung vom 16.10.2026. Ausgang des neuen SaltMarcher-Zweigs ist
`53f12716307a0584bae086dae4f2471bcd8754da`; vor jeder Lieferung den tatsächlichen
Integrationsstand prüfen. Repositoryübernahme und Nutzdatenmigration sind
verschiedene Vorgänge. Die alte SaltMarcher-DB niemals als Workbench-DB öffnen.
`CampaignWorkbench`, `.kwcampaign`, `.kwmusic` und gebundene Originalformate
bleiben kompatibel. Prozessnotizen und lokale Messpfade gehören nicht ins Repo.

### Lieferstand und Reihenfolge

| Schritt | Konkreter Anschluss / Nutzerwirkung | Direkte Abnahme und aktueller Stand |
| --- | --- | --- |
| 0 Ausgangsbasis | Bestehende Writer/History/Volumes/Gebäude/Reise/Player prüfen statt neu bauen. Gleiche kleine Kampagne, Großwelt, dichte/komplexe Region, 5000 Gebäude, 100000 Dungeonzellen, große Bildvorlage/Export als Vergleichsdaten. | Code-/Messbasis vorhanden; bisherige Großwald-/4000-Raumproben sind isolierte Diagnosen, keine 16-GiB-/Gesamtfreigabe. Nativer Großwald-Teilweg belegt; 16-GiB-, Stadt-/Dungeon- und Medienprofile weiter offen. |
| 1 Gezielte Reads | `campaign-atlas-contracts`, Store, Preload/Main, Workbench: Übersicht, räumliche Seite, Objektdetail und Commitbeleg trennen. Keine vollständigen Räume/Städte für eine kleine Ansicht; begrenzte Antworten mit ausdrücklicher Fortsetzung/Zusammenfassung. | Erster Anschluss implementiert: getrennte Übersicht/Roomdetail, revisionsgebundene Metadatenseiten für Raum-/Stadt-/Landschaftssuche und kompakter Landschaftscommit. 4000-Raum-Probe ohne Vollansichten und mit unveränderter Prosa. Kampagnenaktivierung und Atlas öffnen nun über Shell und Geometrieprojektionen; der Raumeditor liest den gewählten vollständigen Raum und dessen Arbeitsentwurf gezielt. Raumtextänderungen antworten mit genau diesem Raum. Räumliche Stadt-/Raumreads sind nun bereichs- und bytebegrenzt, genaue Autorenleser getrennt; Legacy-Fachvollreader bleiben gesonderte offene Anschlüsse. Landschaft, Geometrie und genaue paginierte Auswahl verwenden jetzt denselben quellengebundenen Bereichsframe. |
| 2 Raum/Index | Exakte große Bereichsadresse plus lokalen Meteroffset einführen. V1 normalisiert je Achse mit 1000 m, Offset [0,1000), auch negativ; Adresse als kanonische Dezimalzeichenfolge. Lokale Geometrie bleibt unverändert. Rtree gegen Btree messen; grobe Bereichsauswahl vor lokaler Suche. | V1-Adresscodec isoliert geprüft (große +/-Adressen, Millimeternachbarn, Normalisierung); noch keine kanonische Daten-/Kameramigration. Temporäre Rtrees für Landschaft und Nichtflächen laufen am Writer mit exakter Nachfilterung, Move/Undo/Redo/Delete/Reopen; fehlgeschlagener Indexaufbau rollt vollständig zurück und fällt auf kanonische Btree-Reads zurück, ohne andere Kampagnen zu sperren. Raum-/Stadtprojektionen verwenden ebenfalls einen TEMP-Rtree mit atomarem Scanfallback; aktualisierte Konturen erhalten ihre kanonische Überlappungsreihenfolge. Vergleich mit Btree und restliche räumliche Verbraucher bleiben offen. |
| 3 Übersicht/Frame | Effektive grobe/feine Eigenschaften vor Aggregation bestimmen. Vereinfachte Flächen/Symbole/Kacheln schützen Landschaft beim Herauszoomen. Render/Hit publizieren denselben revisionsgebundenen Frame. | Landschaftsflächen werden in einem separaten Lese-Worker zu begrenzten, revisionsgebundenen Rasterbildern aggregiert; grobe Vorgaben und feine Übersteuerungen bleiben geordnet, Löcher erhalten. Native Linux-Probe: 100000 Flächen, sichtbar Wald → Wasser malen → Save → Neustart → Undo, tatsächliche Bildschirmfarben. Dichte Raum-/Stadtansichten verwenden nun Raster plus quellengebundenen genauen Hit; Elternframes werden unabhängig gelöst. Noch keine persistente Kachelpyramide oder Latenzfreigabe; B01/B04 offen. |
| 4 Raumfachmodelle | Vorhandene Volumes/Lifecycle weiterverwenden. Gebäude außen/innen aus einem Zustand; echte Paths/Passages getrennt von dekorativen Linien. Reine Zeichnung nur ausdrücklich mit Preview umwandeln. | Grundlagen vorhanden, vollständiger Anschluss offen. 3-m-Wand x1,1 =3,3 m; 1,524-m-Dungeonzellen bleiben exakt; gestapelte Räume, Split/Merge, Anker/Prosa und gemeinsame Kamera/History. |
| 5 Medien/Jobs | Hashreferenz von Bildtransport trennen, Auflösungsstufen/Kacheln, Bytecaches und Worker einführen. Aktive Drafts/Undo separat budgetieren. Nur Writer nimmt revisionsgebundene Ergebnisse an. | Rasterjobs sind pro Verbraucher abbrechbar und warten auf den Vorgängeraustritt; PNG-Cache 64 MiB, Bild bis 1024×1024, GM-Ausgabekacheln sequenziell bis 8192 Pixel Gesamtkante/256 MiB codiertem Bildspeicher und ausdrücklicher Abbruch, Aktivierung/Revision vor und nach dem Worker geprüft. 64/128/256-Vergleich, Vorlagenauflösungen, GPU-/Draftbudgets, Export und Assetdatei/BLOB-Entscheidung bleiben offen. |
| 6 Verbraucher | Exakte Queries für Reise/Sicht; betroffene Routen/Perception invalidieren, Actorpreflight und gemeinsame Zeit erhalten. Gefilterte Playerprojektion/Assets, bereichsgebundener Export und vollständiger Transfer. | Physische Landschaftsänderungen pausieren aktive/pausierte Welt- und Lokalreisen atomar, ohne Position/Zeit zu ändern. Gegenprobe mit aktiver Reise; dekorative Änderungen brauchen keinen Geometrievollread. GM-PNG/JPEG nutzt dieselbe wirksame Landschaft kachelweise in Ausgabeauflösung. Öffentliche Ausgabe übernimmt nur freigegebene Sicht/Erinnerung, keine aktuellen verdeckten GM-Konturen. Konservative Kampagneninvalidierung, übrige Verbraucherumstellung und volle kausale Abnahme bleiben offen. Renderbilder liefern niemals Spielregeln. |
| 7 Migration/Ablösung | Je Paket versionierte, in Kopie geprüfte Migration plus DB-/Medienbackup. Alte Adapter nach Verbraucherumstellung entfernen; keine permanente zweite Schreibautorität. | Offen. IDs, Textbytes, Links, Einheiten, Assets, Runtime und alte History vergleichen. Historische Commands/Receipts nicht wieder ausführen/umschreiben; keine pauschale Historylöschung. Bei Downgrade neuere Formate erklärt ablehnen. |

Schritt 1 begrenzt zunächst Reads ohne Schemawechsel. Schritt 2 liefert die
räumliche Grundlage; Schritt 3 verwendet sie. Schritt 4 nutzt bestehende
Fachmodelle, schließt deren tatsächliche Lücken. Schritt 5 kann nach den
Leseverträgen unabhängig fortschreiten. Schritt 6 bindet die Verbraucher an.
Jeder persistente Teil liefert sofort Migration/Recovery/Undo; Schritt 7 sammelt
nicht nachträglich vorher ungeschützte Schemaänderungen ein.

### Zielverträge

- Übersicht enthält Campaign-/Atlasidentität, belegte Ausdehnung, Revision und
  Historyzustand, keine vollständigen CityViews/Workspaces/DungeonViews.
- Bereichsanfrage bindet Aktivierung, Ausschnitt, Maßstab, Höhenschnitt und
  Basisrevision. Antwort benennt Vollständigkeit, Fortsetzung oder abgeleitete
  Zusammenfassung. Veraltete Antwort überschreibt keinen neueren Frame.
- Objektdetail liest exakt ausgewählte IDs mit geschützter Prosa und Revision.
- Autorenbefehl behält bestehende Command-ID/Fingerprint/Expected-Revision und
  Writergrenze. Unbekannte/unvollständige Aufträge erhalten weder erfolgreiche Receipts noch eine neue Revision. Ack bestätigt Dauerhaftigkeit und nennt betroffene IDs/Bereiche;
  eine anschließende fehlgeschlagene Ansicht darf diesen Ack nicht als
  unbekannten Commit umdeuten. Retry verwendet dieselbe Kennung.
- Ein Darstellungsplan ist rebuildbar, nicht editierbare zweite Welt. Genaue
  Auswahl, Reise, Sicht und Exportgrundlage bleiben an kanonischen Daten.
- Öffentliche Ausgabe und passive Liveanzeige besitzen eigene Datenfreigabe;
  keine geheimen Rohdaten in gemeinsamem ungefiltertem DTO/Assetcache.

### Beobachtung und Entscheidung

Das einzige Alternativenregister steht in
[ARCHITECTURE B01–B11](ARCHITECTURE.md#vorläufiges-atlasziel-und-überprüfbare-alternativen-16102026).
Zu jedem entschiedenen Punkt dort aktuelle Richtung, verworfene Alternative,
Messfall/Revision und verbleibende Unsicherheit nachführen. Gleich geeignete
Varianten nach geringstem Gesamtaufwand wählen. B01 zuerst begrenztes SVG gegen
Canvas2D, bei verfehlten Zielen vorhandenes Pixi/WebGL; keine Vorentscheidung
aufgrund reiner Bildrate. B02 Indexpräzision/Updatekosten, B04 Landschaftserhalt,
B06 Backup-/Assetclosure und B09 alte History sind ebenso Entscheidungskriterien.

### Aktueller Implementationsschnitt und nächste Fortsetzung

`tests/desktop-atlas-transition.test.mjs` prüft die neuen Verträge, Indexpflege,
Prosaerhalt, aktive Reise, Adressgrenzen, Rastersemantik und 100000 Flächen im
nativen SQLite-Worker. `tools/test-desktop-atlas-transition.mjs` prüft über die
bestehende UI-Sitzung den sichtbaren Desktopweg samt normalem Prozessende und
Neustart. Ein abgeschalteter alter Vollatlas-Schreibendpoint belegt dabei den
kompakten Geländeschreibweg. Rohbild- und tatsächliche Bildschirm-Pixel werden
getrennt geprüft: Eine erste Probe hatte gültige PNGs, aber durch CSP blockierte
Bilder und durfte deshalb nicht als sichtbarer Erfolg gelten. Die Bildregel
erlaubt jetzt lokale eingebettete Bilder, ohne Skript- oder Netzrechte zu öffnen.

Die Landschaftsanzeige aggregiert bei jedem Maßstab, damit dichtes kleinteiliges
Gelände auch zwischen Welt- und Detailansicht erhalten bleibt. Der Worker liest
überlappende Autorenflächen streaming und unveränderlich; Gepufferte ausgerichtete Ladebereiche werden bei kleinen Kamerabewegungen
wiederverwendet. SQL-Sortierung und Neuberechnung pro kaltem Ausschnitt sind noch kein zeitlich begrenzter
Kachellookup. Alte Welt-/Reiseinspektoren bleiben vollständig lesend: Ein bloß
abgeschnittener Landschaftsbestand würde außerhalb des Ausschnitts falsche
Geländevorgaben suggerieren. Deren Umstellung braucht zuerst ausdrückliche
Abdeckungs-/Unbekannt-Semantik und exakte Punkt-/Routenqueries.

Die isolierte 100000-Flächen-Probe auf dem belasteten Entwicklungsrechner
liefert für 40 identische Regionabfragen Rtree-Median 0,88 ms/p95 17,75 ms gegenüber
Btree 15,74/45,36 ms. Die vollständige kalte Rasterberechnung benötigt dort
8,39 s; eine Wiederholung unter höherer Last 12,65 s (Region-Rtree
11,11/47,19 ms, Btree 22,96/57,53 ms). Das stützt die Indexrichtung, zeigt
aber gerade keine bestandene
Kaltlade-/Latenzqualifikation: weitere lokale Invalidierung und Detailstufen
sind erforderlich. Andere Hardware-/Lastbedingungen nicht daraus ableiten.

Die native GM-Ausgabeprobe enthält vor der Korrektur keinen Wald, obwohl er im
Viewport sichtbar ist: Die alte Größenfilterung entfernte sämtliche kleinen
Autorenflächen. Der GM-Export verwendet nun sequenzielle Rasterkacheln in der
angeforderten Ausgabeauflösung (maximal 1024² je Job), ergänzt weiter die
Vektoren/Referenzen und lässt sich abbrechen. Der Probeweg prüft tatsächliche
PNG-Pixel und den unveränderten Vorgängerexport nach Abbruch. Gemischte
Revisionen, unvollständige Ergebnisse oder überschrittener Bildspeicher liefern
keine Datei. Der Cache bleibt separat auf 64 MiB begrenzt; Canvas-/GPU-Kopien
und maximale 8192-Ausgaben benötigen weiterhin Lastqualifikation.

Ein unabhängiger Gegenfall belegt zudem eine Informationslücke im bisherigen
öffentlichen Export: Aktuelle GM-Konturen wurden über bekannte Hexes gelegt,
auch wenn diese nur erinnert und gerade nicht gesehen waren. Neuer ungesehener
See überschreibt so alten Wald. Öffentliche Ausgabe verwendet ausschließlich
die bestehende Sicht-/Erinnerungsprojektion; sie liest dafür weder GM-Flächen
noch GM-Rasterbilder. Feinere öffentliche Küsten/Wege bleiben beauftragt und
benötigen freigegebene, bei Sicht gespeicherte Geometrie samt Erinnerungsversion.
Alte Erinnerungen nicht aus aktuellem GM-Wissen nachträglich vervollständigen.

Die Landschaftssuche hat keine stille 100-Treffergrenze mehr: Metadatenseiten
und ein exakter Objektread ersetzen den bisherigen Vollgeometriesuchread. Der
Ortsinspektor nutzt den vorhandenen gezielten `deskContent`-Read, statt sämtliche
Wissensinhalte zu laden.

Der zweite Leseschnitt trennt `WorkspaceShell`, `WorkspaceGeometry`,
`RoomSummary` und vollständigen `Room`. Aktivierung und Atlasdarstellung lesen
keine vollständigen Raumtextarrays. Konturen werden geprüft, ohne die
Markdownabschnitte als JavaScript-Objekte aufzubauen; der Reader hält jeweils
nur einen Quellpayload für dessen Prüfsumme. Das ist noch kein von der
Textmenge unabhängiger Plattenread. Unverfügbare Geometrie wird gemeldet; ein
beschädigter ausgewählter Raum bleibt gesperrt, andere Räume erreichbar.

Die sichtbare Atlassuche und das Raumverzeichnis durchsuchen weiterhin auch
Markdown. Readonly-Worker liefern standardmäßig 40 Metadaten pro Seite in
natürlicher Nummernsortierung; Fortsetzungen binden Filter, Aktivierung und
einen opaken Änderungsstand. Je Suchoberfläche läuft höchstens ein ersetzbarer
Job, der Nachfolger wartet auf dessen tatsächliches Ende. Geänderte Suchstände
werden ausdrücklich neu gestartet, nicht mit älteren Seiten vermischt. Das
Verzeichnis bleibt unter den Fachdetails erreichbar. Kontext und ausdrückliche
Aktualisierung lösen gemeinsam genau eine Suche aus, auch nach einem vorher
leeren Ergebnis. Raumtexte verwenden beim Bearbeiten denselben Helfer wie der
Key-Editor: unveränderte Rohtextspannen behalten ihre Zeilenumbrüche. Detailantworten und
schreibende Befehle akzeptieren weiterhin bestehende lange IDs.

Zeichenansichten erhalten Geometrie ohne gesamte Keys, archivierte Raumtexte
oder sämtliche Elementnotizen. Ein gewähltes Element wird vollständig
nachgelesen; die Key-Werkzeuge behalten ihre vollständigen Autorenansichten.
Vorbereitung wird bei Aktivierung zurückgesetzt und erst bei tatsächlichem
Bedarf geladen; die Liveansicht darf ihre benötigten Wissensquellen weiterhin
lesen. Normales Öffnen (`ensurePreparation`) erhält den aktiven Editor;
ausdrückliches Neuaktivieren (`activatePreparation`) lädt neu und erneuert
die Generation, damit frühere Save-/Quell-/Referenzantworten den neuen Stand
nicht ersetzen. Aktiver Raum, bestätigter Detailstand und Arbeitsentwurf sind getrennt;
Kampagnen-/Raumwechsel verwerfen keine ungültigen oder unbestätigten Entwürfe.
Die Geschosssynchronisierung erhält einen schon auf diesem Geschoss gewählten
Raum. Kompakte Raumcommits behalten die bisherigen Atlas-/Raumreceipts und
Undoabläufe; eine nachgelagerte Ansichtsfehlermeldung macht einen bestätigten
Commit nicht wieder unbekannt. Es gibt dafür keine Daten-/Archivmigration.

Unter Beobachtung: Der Volltextscan bleibt linear zur Textmenge. Ein
abgeleiteter Volltextindex ist die Alternative, falls das Suchziel verfehlt
wird; Suchbedeutung und Wiederaufbau gehören in den Vergleich. Geometrie und
Text bleiben vorerst im gemeinsamen kanonischen Payload. Eine persistente
Trennung ist erst mit nachgewiesenem Lese-/Speichervorteil und überprüfter
Migration gerechtfertigt. Die Metadatenseiten sind nach Anzahl begrenzt, noch
nicht nach Bytes; große Einzelobjekte, Geometrie, weitere Autorenantworten und
explizit geöffnete Key-Werkzeuge benötigen weiterhin die eigenen Budgets.

Die isolierte Vergleichsprobe mit 4000 identischen Raumkonturen und 4/40 KiB
Markdown je Raum verwendet jeweils drei frische Node-Prozesse und die
unveränderte Ausgangsversion als Gegenprobe. Die JSON-Größe der initialen
DTO-Folge sinkt von 52,46/494,83 MB auf 2,514/2,551 MB; der Median des maximalen
Prozess-RSS von 366/1886 MiB auf 123/125 MiB. Lese- plus JSON-Serialisierungszeit:
Median 2,32/12,60 s vorher, 0,89/3,42 s danach. Das sind weder die exakten
Electron-Transportbytes noch der gesamte App-/GPU-Speicher oder eine
p95-Qualifikation. Der Textfaktor zehn bleibt im übertragenen Datenvolumen
nur als ein ausgewähltes Raumdetail sichtbar, kostet aber weiterhin Quell-I/O
und Prüfsummenzeit. Diese verbleibende Skalierung rechtfertigt den nächsten
räumlich begrenzten Read-Anschluss und den Vergleich kompakter abgeleiteter
Geometrie mit einer persistenten Text-/Geometrietrennung.

`tests/desktop-room-reads.test.mjs` und
`tests/desktop-room-directory-dom.test.mjs` prüfen unter anderem mehrere
Scopes, verborgene Geschosse, beschädigte Einzelräume, Textsuche,
Fortsetzungsinvalidierung, Graphschatten, Sicht-/NPC-Projektion und verworfene
alte Rasterfehler. `tools/test-desktop-room-reads.mjs` ist die reproduzierbare
native Probe für sichtbare Markdownsuche, Seiten bis zum letzten langen ID,
Textcommit, ungültigen Entwurf und Fresh. Die Proben ergänzen die bestehenden
Key-/Speicher-/Atlasprüfungen; sie schließen keine Gesamtfreigabe ein.

Der dritte Leseschnitt begrenzt jetzt die gemeinsame Atlas-/Livegeometrie auf
angefragte Weltbereiche. `workspaceInitial` enthält höchstens den ausgewählten
Raum; `atlasRegion` liefert Darstellungskonturen ohne Raumprosa oder
Hausbewohner/Notizen. Ein eigener readonly Worker baut lokale Konturen und
konservative Grenzen in TEMP-SQLite auf. Der Rtree liefert Kandidaten zuerst;
bei fehlendem Rtree bleibt ein Scan derselben abgeleiteten Grenzen verfügbar.
Genaue Kontur-/Lochtests folgen erst auf die Kandidatensuche. Die Gebäude- und
Dungeontransformation wird unabhängig von im Ausschnitt sichtbaren Eltern
aufgelöst. Auch ein ausgewählter leerer oder gerade außerhalb des Bildes
liegender Innenraum behält seinen Autorenframe.

Der Writer hält ein transaktionales TEMP-Änderungsjournal (10000 Ereignisse,
höchstens 1 MiB übertragene Änderungs-IDs). Konturänderungen aktualisieren die
Projektion, bewegte Straßenknoten ihre abhängigen Straßen und Raumänderungen
verankerte Elemente. Journalüberlauf, externe SQLite-Änderung, anderer
Graphschatten oder Aktivierung führen zum Neuaufbau. Rücknahme/Rollback
benutzen dieselbe kanonische History; weder Projektion noch Index gelangen in
Archive. Die geschützte Graphkopie enthält absichtlich nur einen Dungeon.
Der Bereichsworker öffnet deshalb die bestätigte Datenbank readonly und legt
TEMP-Views darüber, die ausschließlich diesen Scope aus einer ebenfalls readonly
angehängten Vorschau ersetzen. Beide Änderungsjournale und Dateibindungen
gehören zum Source-Fence. Stadt-/Weltkontext und andere Dungeons bleiben aus
der bestätigten Quelle verfügbar. Vor Übernahme/Verwerfen werden beide
Bereichsworker beendet und gejoint, bevor die Vorschau entfernt wird.
Quelle, Aktivierung, Revision, Ausschnitt, Geschoss, Höhenschnitt und
Dachfilter binden Read und Hit. Veraltete Ergebnisse dürfen keine neue Auswahl
oder Autorenmutation begründen.

Die Grenzen sind absichtlich nach Datenklasse benannt: maximal 2 MiB kodierte
Geometrieantwort, 1500 Vektorobjekte und maximal 16 MiB kodierter aktiver
Darstellungskontext. Dichtere Raum-/Stadtansichten werden vollständig als
höchstens 512² großes Bild repräsentiert; genaue Auswahl liest die Quelle,
niemals die Pixelkontur. Die UI meldet Rastermodus und beschädigte Einträge.
Raster und Vektor verwenden dieselbe Ebenenfolge: Stadtpapier unter Dungeons,
Straßen unter Gebäudedächern. Überlappende Gegenproben prüfen die tatsächlichen
PNG-Pixel; reine Objektzählung hätte den verdeckten Dungeon nicht bemerkt.
Der serialisierte Geometriecache hat zusammen 64 MiB Nutzdatenbudget, geteilt
in 24 MiB Ansicht und 24 MiB Ausgabe sowie je 8 MiB Landschaftskacheln in beiden Bereichsworkern. Das ist keine Obergrenze des tatsächlichen
Electron-/SQLite-/GPU-Speichers. Aktive Autorenentwürfe, exakte Fachleser und
der vorhandene Landschaftsbildcache sind getrennte Klassen.

Einzelne Häuser laden ihren vollständigen kanonischen Datensatz vor einer
Änderung. Die Projektion wird nicht zum Upsert umgedeutet; Notizen, Bewohner,
Rezepte und fremde Erweiterungsfelder bleiben erhalten. Eine nicht auflösbare
Fraktionsreferenz bleibt als ausdrückliche Auswahl sichtbar; eine unabhängige
Namensänderung entfernt sie nicht. Gesamte Stadtwerkzeuge
und Zeichenarchive werden ausdrücklich geladen. Gezielte Zeichendetails
unterscheiden eine abgeleitete geheime Darstellung ohne Stilzeile von einer
tatsächlichen Autorenrevision. Globale Suche und genaue Fokusqueries erreichen
auch nicht geladene Räume, Häuser und Dungeons.

Atlaswrites und lokale Reiseaufträge liefern eine kleine dauerhafte Bestätigung.
Die anschließende Bereichs-/Detailabfrage ist ein eigener Schritt. Ihr Scheitern
meldet den gespeicherten Stand und bietet Nachlesen an; ein unbekannter
Transportausgang behält dagegen den ursprünglichen Befehl mit seiner Kennung.
Eine Kamera-/Liveumschaltung verändert weder Partyposition noch Weltzeit.
GM-Ausgaben lesen ihren eigenen Ausgabebereich und erzeugen sequenzielle
gemeinsame Landschafts-/Geometriekacheln bis 512². Jede Kachel prüft denselben Source-Fence; der Main-Prozess prüft den Source-Fence vor und nach dem Dateidialog direkt an der Quelle. Dafür wird weder eine zusätzliche Übersicht gerastert noch eine Vollansicht geladen; eine zwischenzeitlich geänderte Quelle wird vor dem Schreiben verworfen. Unterschiedliche
Revisionen, Abbruch und überschrittenes Bildbudget liefern keine Datei. Die
öffentliche Ausgabe bleibt an die exakte Sicht-/Erinnerungsprojektion gebunden.

`tests/desktop-atlas-regions.test.mjs` prüft Bereichsbegrenzung, Raster/Hit,
Elterntransformation, inkrementelle Änderungen, externe Invalidierung,
Journalüberlauf, Rtreeausfall, Höhenschnitte, fehlerhafte Quelldaten und
kompakte Receipts. Die bestehende native Raumprobe mit `--regions` ergänzt
5000 Gebäude, Text-/Erweiterungserhalt, Hausverschiebung mit Undo,
Nachlesefehler nach bestätigtem Save, gemeinsamen Livecanvas und tatsächliche
PNG-Geometriepixel. `--zoom=2` prüft denselben Ablauf bei 200 Prozent.

Unter Beobachtung bleiben die kalten Projektionskosten und die übrigen
Leseklassen. Der kanonische Payload enthält weiter Text und Geometrie, sodass
der kalte Prüfsummenread mit Prosa wächst. `tools/measure-atlas-regions.mjs`
vergleicht frische Node-Prozesse und 30 warme Reads; das ist weder ein kalter
Betriebssystemcache noch Electron-/GPU- oder physische 16-GiB-Qualifikation.
TEMP-Neuaufbau gegen eine persistente, quellgebundene abgeleitete Geometrie ist
der nächste Messvergleich; keine Text-/Historymigration ohne Übertragungs- und
Wiederaufnahmebeleg. Zuvor die Kaltphasen Storekonstruktor, Quellprüfsummen,
SQL-Statementvorbereitung, TEMP-Aufbau und Serialisierung getrennt messen. In
`storage/atlas-region.ts` verwendet jetzt vorbereitete Statements und 128er Quellbatches statt per-ID-Reads. Die Batches beenden ihren SELECT vor TEMP-Schreibvorgängen; fehlerhaftes JSON wird je Quelle isoliert. Den Nutzen gegen den alten per-ID-Read messen; am Konstruktor-/RSS-Höchststand
lässt sich der Nutzen einer Datenformatänderung noch nicht ablesen. Ein EXPLAIN-Gegenfall begründet die Rtree-zuerst-Abfrage:
ein regulärer Join wählte den Geometrietypindex und besuchte alle Raumzeilen.

Auch die Standardsuche nach dem ersten Raum war bei fehlender expliziter
Auswahl pro Frame linear. Die Shell merkt sich nur dessen ID je DB/Kampagne
und Änderungsstand; lokale Änderungen und externes `data_version` verwerfen
sie. Explizite Nutzerauswahl hat Vorrang, es wird kein Dokument dafür verändert.

Eine frühere lokale Vergleichsprobe mit 4000 beziehungsweise 12000 Räumen und 5000
Gebäuden (je 4 KiB Autorenprosa, 30 warme Reads desselben kleinen Ausschnitts)
liefert nach dieser Korrektur 4,7 KiB Bereichsantwort gegenüber 23,3/26,6 MB
Vollansicht. Warmer Median: 7,6/6,5 ms statt 1072/1426 ms, p95 10,6/9,4 ms
statt 1917/2002 ms. Der Preis bleibt der kalte TEMP-Aufbau: 8,9/14,1 s statt
2,6/1,8 s für den direkten Vollread in diesem Durchlauf. Maximum-RSS des
Node-/SQLite-Prozesses: rund 258 statt 452 MiB bei 4000 Räumen, bei 12000
Räumen in beiden Wegen rund 586 MiB. Das große Speicherziel ist damit nicht
belegt. Prozessstart/Schemaarbeit gehen in den RSS-Höchststand ein; kalte
Readzeit, OS-Cache, Systemlast, Electron und GPU sind unterschiedliche Größen.
Der Messhelfer speichert Commit, Dirty-Status und Bundlehash; diese lokale
Messung ist kein Hardware- oder Latenzfreigabebeleg.

Nach vorbereiteten Statements und 128er Quellbatches ergab eine nachfolgende
lokale Paarprobe mit4000 Räumen/5000 Gebäuden im selben Hostaufbau: Kaltaufbau
6,88→1,89s, warme Reads p95 8,67→5,82ms (30 Reads). Maximum-RSS von Node/SQLite
blieb bei rund255 MiB. Gemessen wurde ab dem Read nach Storekonstruktion in
frischen Prozessen; OS-Cache, Systemlast und Electron/GPU sind keine isolierten
Konstanten. Die vollständige Erstnutzung binnen2s und physische16-GiB-Abnahme
sind damit weiterhin offen; eine Formatmigration ist daraus nicht begründet.

Landschaftsflächen, Wege, Flüsse, Orte und Referenzen werden nun im selben
readonly Bereichsworker und Source-Fence gelesen. Bis500 Nichtflächen und
höchstens512 KiB dünne Darstellungskonturen bleiben Vektoren; fachliche Values
werden nicht übertragen. Bei höherer Dichte wird der ganze Ausschnitt als
höchstensvier weltorientierte Rasterkacheln dargestellt (maximal256² je Kachel,
kleinere Auflösung bei knappem Transportbudget). Die Antwort meldet Modus,
Objektzahl, Referenzzahl und lokalen Fehlerzustand. Landschaftsfehler entfernen
keine intakte Raum-/Stadtgeometrie. Die alte gesonderte `landscapeRegion`-API
bleibt für ausdrücklich vollständige Werkzeuge und Altfälle erhalten; die
Workbench zeichnet keine Reads aus `draw()` nach.

Klickauswahl liefert bis40 genaue Kandidaten je Seite und die Gesamtzahl;
Überlappungen werden ausdrücklich ausgewählt. Die Quellbindung wird vor und
nach dem Read geprüft. Vor Bearbeitung liest `atlasLandscapeObject` den ganzen
kanonischen Datensatz, einschließlich unbekannter Values. Pixel und dünne
Konturen werden nie zu Autoren-Upserts. Verdeckte Referenzen sind weder
gezeichnet noch in dieser Auswahl enthalten. Mehr als16 sichtbare Referenzen
werden als Umrisse zusammengefasst und ausdrücklich gemeldet. Referenzbilder
verwenden Ableitungen bis2048 Pixel/256 KiB PNG; der Originalimport antwortet
nur mit ID und Maßen. Originalbytes bleiben unverändert. Der Main-Vorschaucache
hat8 MiB, ebenso der flüchtige Vorschaucache im Renderer (kleine Vorschauen bis128 KiB PNG). Wiederholte Auswahl in dichten Referenzansichten kann ihn nicht unbegrenzt vergrößern; der vollständige native Bilddecode und dessen RSS sind weiterhin zu
qualifizieren. Die GM-Ausgabe verwendet dieselbe ausdrücklich aggregierte
Landschaftsdarstellung; sie ersetzt keine Original-/Transferausgabe.

Kameraereignisse erhalten die veröffentlichte Canvas-Szene samt Path2D-Kommandos
und verändern nur die relative Kameratransformation. Kleine Verschiebungen innerhalb des
zweifach gepufferten Ladebereichs starten keinen neuen Bereichsread. Zoom,
Filter- oder Quellenänderung benötigen einen neuen Frame; bis dahin sind
Autorenaktionen mit veralteter Geometrie gesperrt. Der Worker behält seine
TEMP-Projektion bei Kamerabewegung: eine aktive Arbeit und ein ersetzbarer
Nachfolger, statt Abbruch und Neuaufbau pro Ereignis. Landschaftskacheln werden
bei lokalen Moves/Deletes anhand alter und neuer Grenzen invalidiert; externe
Änderung/Journalüberlauf/Quellwechsel verwerfen die Ableitung. Keine neue
persistente Kachel- oder Geometriewahrheit.

Nächste Abnahmen: kalte Projektionskosten, Same-Task-Latenz/RSS,
Referenzdecode unter Last und dichte Ausgabe messen; 100000-Flächen-/große
Stadt-/lange Einzelkonturaufgaben nativ wiederholen. B01/B02/B04/B05 behalten
ihre Alternativen (persistente abgeleitete Projektion/Kachelpyramide, anderer
Index, GPU-Renderer), bis diese Messungen einen Wechsel begründen. Der
Adresscodec benötigt Kamera-/History-/Transferqualifikation vor einer
persistenten Formatmigration. Diese Änderungen schließen weder die sieben
Lieferstufen noch die Produktabnahme ab. Stiländerungen sind zurückgestellt.


### Canvas2D als Atlasdarstellung

Der gemeinsame Atlas (`campaign-atlas-ui.ts`, `atlas-canvas.ts`,
`atlas-canvas-scene.ts`) zeichnet jetzt auf eine echte Canvas2D-Fläche. Kein
Kartenobjekt erzeugt ein verbundenes SVG-/DOM-Element. Die passive Kamera
behält Ankerzoom, Pointercapture, Ansichtshistorie und Kontextcache; Landschaft,
Stadt, Innenräume, Griffe, Reise und Marker benutzen dieselbe relative Szene.
Die Szenenkommandos werden je fachlicher Änderung kompiliert; Pan und Zoom
verwenden vorhandene Path2D-Geometrie und decodierte Bilder erneut. Culling
verwendet die geladene Abdeckung, damit kleine Pans bereits geladene Häuser
und Räume am bisherigen Bildschirmrand nicht verlieren.

Native `isPointInPath`/`isPointInStroke` verwenden dieselben Pfade, Füllregeln,
Linienmaße und inversen Gruppentransformationen wie die Zeichnung. Sie liefern
nur passive semantische Griffe/Marker an den Anwender. Die vollständige
Objektauswahl in Aggregaten bleibt die quellengebundene paginierte Main-Abfrage.
Ein direkt getroffener Zeichnungsglyph öffnet wie zuvor dessen stabile ID über
Main-Fokus und vollständigen Autorenread; auch Text-/Objektränder außerhalb
des logischen Punkt-Pickradius bleiben damit auswählbar. Rasterpixel und
Darstellungskonturen werden nicht zur Schreibautorität. Hover-Namen von Markern/Zeichenobjekten stammen ebenfalls aus denselben Pfaden,
auch ohne Autoren-Auswahl; sie werden bei Gesten/Framewechsel/Fehlern entfernt.
CSS-Ränder, Kameraskalierung und Bitmap-DPI
sind getrennt. Autorenhits und Hover verlangen nicht nur die neueste Szene,
sondern auch deren erfolgreich auf die sichtbare Fläche kopierten Frame mit
aktueller Kamera und aktuellen CSS-Innenmaßen. Kameraänderungen sperren
Treffer bis zum nächsten Paint; ein Größenwechsel ist schon vor dem
ResizeObserver-Aufruf gesperrt. Eine verborgen kompilierte Szene erhält beim
Wiederanzeigen keine Treffer durch zufällig wieder passende alte Bitmapmaße.
Ein ausstehender Frame gilt für linkes Navigationsziehen nicht als leere
Kartenfläche; ausdrückliches Mitteltasten-/Alt-Navigieren bleibt möglich.
Nur der neueste vollständige Frame wird veröffentlicht; genau eine
Bilddecodierung mit einem ersetzbaren Nachfolger verhindert Decoder-Fan-out.
Verlust/Fehler der Zeichenfläche entfernt Treffer und bietet Wiederholung,
ohne gespeicherte Daten, Kamera oder Listener zu verdoppeln.

Die sichtbare Fläche und der atomare Zeichenpuffer haben jeweils höchstens
4.194.304 Pixel, höchstens4096 Pixel je Achse und maximal2x Geräteauflösung.
Eine Sichtmaske verwendet höchstens einen weiteren solchen
Puffer pro Szene; dieser und die Maskenpfade werden bei Pan wiederverwendet
und beim Szenenwechsel freigegeben; sie wird durch `destination-out` aus bekannten/sichtbaren Bereichen
gebildet. Decodierte Bilder sind flüchtige ImageBitmaps: höchstens32 pro Szene,
maximal512 Pixel je Achse, damit höchstens32 MiB pro Szene. Während des
atomaren Framewechsels kann zusätzlich die vorherige Szene gehalten werden;
alte Bitmaps werden geschlossen. Diese Zahlen begrenzen die eigenen Puffer,
sind keine Zusage über Chromium-/GPU-/Gesamt-RSS. Originalmedien und Exporte
werden dadurch nicht umgerechnet oder überschrieben.

Weiter beobachten: tatsächliche Zeichenlatenz und Prozess-/GPU-Speicher bei
langen Konturen, vielen Texten/Lichtern, sehr großen Monitoren und 200%.
512-Pixel-Vorschauen und das Pixelbudget sind veränderbare Darstellungsgrenzen;
bei unzureichender Detailqualität gezieltere Bildkacheln/LOD vergleichen.
Pixi/WebGL bleibt eine Alternative für GPU-Batching/Layerkomposition;
OffscreenCanvas für nachgewiesene Zeichenarbeit auf dem UI-Thread. Kein
vorsorglicher Shader-/Workerunterbau. Stadt-/Objektglyphgeneratoren emittieren
jetzt direkt passive Geometrie (`cityPaint`, `elementPaint`); auch ausgewählte
Zeichenobjekte und Zeichenvorschauen benötigen keinen XML-Parser oder
abgetrennte SVG-Knoten. Die bisherigen SVG-Ausgaben serialisieren dieselbe
Geometrie; Attribute und Texte werden erst am Ausgaberand maskiert. Ein
festgehaltener Vergleich mit den vorherigen Generatoren prüft alle vorhandenen
Symbolfamilien, Türzustände, Objektvarianten und Stadtlayer. Native Atlasproben
lesen die veröffentlichte Canvasfläche und Kamera statt entfernter SVG-Knoten.
Während Speichern/Framevorbereitung abgewiesene Pointergesten dürfen beim
späteren Loslassen keine neue Objektauswahl auslösen.
Ältere isolierte Karten behalten
vorläufig ihren SVG-Host; eine gemeinsame Kamerabasis erst im nächsten echten
Anschluss konsolidieren. SVG-/PNG-/JPEG-Ausgaben und die öffentliche Whitelist
bleiben eigenständige, getestete Ausgabewege. Keine Datenformatmigration,
kein Stilwechsel und keine vollständige Phase1-/Phase2-Produktabnahme.
