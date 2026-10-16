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
| 0 Ausgangsbasis | Bestehende Writer/History/Volumes/Gebäude/Reise/Player prüfen statt neu bauen. Gleiche kleine Kampagne, Großwelt, dichte/komplexe Region, 5000 Gebäude, 100000 Dungeonzellen, große Bildvorlage/Export als Vergleichsdaten. | Code-/Messbasis vorhanden; bisherige Großwald-/4000-Raumproben sind isolierte Diagnosen, keine 16-GiB-/Gesamtfreigabe. Neue Produktmessung offen. |
| 1 Gezielte Reads | `campaign-atlas-contracts`, Store, Preload/Main, Workbench: Übersicht, räumliche Seite, Objektdetail und Commitbeleg trennen. Keine vollständigen Räume/Städte für eine kleine Ansicht; begrenzte Antworten mit ausdrücklicher Fortsetzung/Zusammenfassung. | Erster Anschluss implementiert: getrennte Übersicht/Roomdetail, revisionsgebundene Metadatenseiten für Raum-/Stadt-/Landschaftssuche und kompakter Landschaftscommit. 4000-Raum-Probe ohne Vollansichten und mit unveränderter Prosa. Initialer Atlas, räumliche Stadt-/Raumseiten und andere Autorenpfade verwenden weiterhin Vollansichten; Schritt bleibt offen. |
| 2 Raum/Index | Exakte große Bereichsadresse plus lokalen Meteroffset einführen. V1 normalisiert je Achse mit 1000 m, Offset [0,1000), auch negativ; Adresse als kanonische Dezimalzeichenfolge. Lokale Geometrie bleibt unverändert. Rtree gegen Btree messen; grobe Bereichsauswahl vor lokaler Suche. | V1-Adresscodec isoliert geprüft (große +/-Adressen, Millimeternachbarn, Normalisierung); noch keine kanonische Daten-/Kameramigration. Temporäre Rtrees für Landschaft und Nichtflächen laufen am Writer mit exakter Nachfilterung, Move/Undo/Redo/Delete/Reopen; fehlgeschlagener Indexaufbau rollt vollständig zurück und fällt auf kanonische Btree-Reads zurück, ohne andere Kampagnen zu sperren. Vergleich mit Btree und restliche räumliche Verbraucher bleiben offen. |
| 3 Übersicht/Frame | Effektive grobe/feine Eigenschaften vor Aggregation bestimmen. Vereinfachte Flächen/Symbole/Kacheln schützen Landschaft beim Herauszoomen. Render/Hit publizieren denselben revisionsgebundenen Frame. | Landschaftsflächen werden in einem separaten Lese-Worker zu begrenzten, revisionsgebundenen Rasterbildern aggregiert; grobe Vorgaben und feine Übersteuerungen bleiben geordnet, Löcher erhalten. Native Linux-Probe: 100000 Flächen, sichtbar Wald → Wasser malen → Save → Neustart → Undo, tatsächliche Bildschirmfarben. Noch keine persistente Kachelpyramide, vollständige Frame-/Hit-Umstellung oder Latenzfreigabe; B01/B04 offen. |
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
  Writergrenze. Ack bestätigt Dauerhaftigkeit und nennt betroffene IDs/Bereiche;
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

Nächster zusammenhängender Anschluss ist Schritt 1: initiale Welt-/City-/Room-
Metadaten von tatsächlicher Geometrie und Prosa trennen; räumliche Seiten mit
Bytegrenze und Fortsetzung/Sammeldarstellung liefern; Detail- und Reiseverbraucher
an gezielte Queries anschließen. Danach Cache-/Indexvergleich und Adresscodec
an echter Kamera/History/Transfer qualifizieren, bevor eine persistente
Formatmigration vorgenommen wird. Weder die API-Vorbereitung noch der einzelne
Linux-Großwaldweg schließen die sieben Schritte oder die Produktabnahme ab.

### Abschlussnachweise

Die Größen-/Latenzziele im vorigen Abschnitt bleiben verbindlich, insbesondere
Atlas p95 33 ms/Preview100 ms und Dungeon 2 s/16 ms/50 ms/Commit500 ms/Player100 ms.
Referenzgerät mit 16 GiB, CPU/GPU/SSD, Auflösung/Skalierung und kalten/warmen
Zustand dokumentieren. Ein Limit auf dem größeren Entwicklungsrechner ist nur
Vorversuch. Separate Linux-/Windows-/macOS-, Tastatur-/200%- und physische
Bediennachweise bleiben offen, solange sie nicht tatsächlich vorliegen.

Zusammenhängend: Region gestalten → grobe Vorgabe ändern → feine Ausnahme
kontrollieren → Ortstext → Stadt/Haus → Volume/Room-Key → Reise/Sicht → Undo/Redo
→ Autosave → vollständiger Neustart → dieselben Inhalte und Spielzustände.
Dazu: Abbruch in Read/Preview/Commit/Migration, volle Datenträger, Cachelöschen,
negative/große Koordinaten, kalter unabhängiger Import, Player-DTO/IPC/Assets/
DOM/Fehler/Logs und Grafikverlust. Fachbelege, lokale Tests, native Bedienung,
Hardware-/OSqualifikation und Nutzerabnahme bleiben getrennte Aussagen.
