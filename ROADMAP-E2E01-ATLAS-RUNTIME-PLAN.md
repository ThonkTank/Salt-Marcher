# Gemeinsamer Atlas: Fachverträge

Bedienung: [Atlas](docs/ATLAS.md). Darstellung, Quellenstand und Prüfwege:
[Technischer Einstieg](docs/development/atlas-rendering.md). Offene Umsetzung:
[Atlasplan](docs/plans/maps/unified-spatial-atlas.md).
Die folgenden Regeln ergänzen die ursprünglichen Anforderungen im
[Quellenregister](docs/scope-sources.json); sie sind keine Behauptung vollständiger Umsetzung.

## Passive Kartenfläche und Adoptergrenze

Kamera, Viewport und Pointercapture besitzen keine Autoren- oder Reisebefehle.
Fachwerkzeuge übersetzen Eingaben in ausdrücklich bestätigte Aktionen. Pan,
Zoom, Reflow und ein leerer Ausschnitt verändern weder Karte noch Zeit.
Darstellung und Auswahl verwenden dieselbe Szene und Transformation.
Verspätete Quellen werden verworfen; ein Rendererfehler erlaubt einen frischen
Darstellungsversuch, aber keine Wiederholung eines Schreibbefehls.

## Ein Raumvertrag, passende Geometrieformen

**Ein metrischer Raumvertrag** verbindet Roomidentität, räumliches Volumen,
Grenzfläche, Passage, Anchor und queries für Standbarkeit/Sicht/Licht/Schall.
Die Autorenrepräsentation kennt zwei durch Pflichtanforderungen begründete
Formen: feste Dungeonzellen und maßhaltige Gebäudegrundrisse. Das sind keine
getrennten Editoren, Kameras oder Datenbanken. Gemeinsame Auswahl-/Command-
und Projektionsregeln werden nur einmal implementiert; geometrische Operationen
werden auf der jeweiligen eindeutigen authored Form ausgeführt.

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

Rechtecke und freie Raumkonturen verwenden denselben Zeichenbefehl, Namen,
Rasterfang und Übernahmepfad. Vorschau und Commit rasten an denselben Punkten ein.
Kanten-/Eckpunktzüge erhalten Anker nur bei eindeutig zuordenbarer Konturtopologie.
Ein Türpunkt auf dem erhaltenen Segment bleibt physisch stehen; sonst folgt er
seinem relativen Kantenparameter. Beliebige Konturersetzungen und Merges erhalten
keine erfundene Kantenzuordnung. Der Writer validiert vor der ersten Änderung.

Reisen verwenden transaktionale Belege. Nach Antwortverlust bleibt der ursprüngliche
Auftrag gebunden und weitere Reise-/Autorenaktionen bleiben gesperrt. Die Klärung
liest Beleg und aktuellen Stand; sie wiederholt keine Reise. Ein neues Fokusziel
übernimmt keine Berechtigung aus einer alten Antwort. Zeit und Teilrunden kommen
nach Neustart aus SQLite; Wiedergabe startet nicht automatisch.

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


Diese Populationen und Laufzeitziele bleiben eigenständige offene Abnahmen.
Lokale Regressionen und eine synthetische native Probe schließen sie nicht ab.
Messbedingungen und Gesamtprofile stehen im
[Prototypplan](ROADMAP-SALTMARCHER-ADR-PROTOTYPES.md).
