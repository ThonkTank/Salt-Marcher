# Zusammenhängendes Hex-Gelände bearbeiten

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: atlas
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Laufzeitreise, unabhängige Kampagnenkopien und verbleibende Reiseziele:
[Hexreise](hex-travel.md).

Original: [Hex Feature Requirements](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/hex/requirements/requirements-hex.md).

Ab0.125 verschiebt direktes Ziehen die vorhandene Hexkamera. Mausradzoom ändert ausschließlich die Ansichtsgröße (50–300 Prozent), ebenso
Näher/Weiter. Verschiebeschaltflächen, Alt+Pfeile und mittleres Ziehen benötigen
keinen Flush und werden durch ungültige offene Autorenfelder nicht blockiert. Ansicht zurücksetzen zeigt den Ursprung bei 100 Prozent, ohne
Auswahl, offene Hexeingaben, Route oder Karteninhalt zu ändern. Das separate
Bearbeitungsraster liegt unter Karteneinstellungen und Austausch; dessen Wechsel
sichert offene Eingaben und wählt ausdrücklich eine andere Autorenebene. Gelände malen zeichnet mit dem gewählten Gelände,
Radius und Maßstab; ausgelassene Hexes zwischen Pointerpositionen werden verbunden.
Alt oder die mittlere Taste verschiebt auch bei aktivem Pinsel. Die Kartenfläche
unterstützt Pfeiltasten zur Hexauswahl, Alt+Pfeiltasten zum Verschieben und lokale Strg+Z/Strg+Umschalt+Z-Tastaturaktionen.

Ein Strich ändert ausschließlich terrain in denselben AtlasMap-Zellen. Ende des
Strichs bzw. ein notwendiger Flush verwendet die bestehende revisionierte
World-Schreibgrenze und deren Antwortabgleich. Keine zweite Karte oder Zeituhr.
Wege, Flüsse, Höhen, Texte, Fraktionen und Unterbrechungen bleiben erhalten.

Die gebundenen [Maps Canvas Requirements](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/maps/requirements/requirements-maps-canvas.md)
verlangen passive Kameraereignisse. Zoom, Resize, Reset und Verschieben beenden
daher einen gegebenenfalls laufenden Pointerkontext ohne Speicherung. Die bereits
bemalten Zellen bleiben als genau ein rücknehmbarer, ungespeicherter Strich
sichtbar. Der Hinweis nennt „Hex speichern“; dessen vorhandener World-Flush
bestätigt die Änderungen. Nach dem Transformationswechsel wirkt ein verspätetes
Move/Up der alten Pointer-ID nicht auf neue Kartenkoordinaten. Der gewöhnliche
Pointerabschluss ohne Kameraunterbrechung speichert weiterhin. Die Änderung ist
auf diese Kameragrenze beschränkt; Escape/Pointercancel- und explizite Flushwege
sind damit nicht neu definiert. Keine Daten-/Schema-/Commandmigration.

`desktop-map-camera-passivity.test.mjs` prüft Panbuttons, Alt+Pfeile, Zoombutton,
Wheel, Resize und Reset mit gültigen/ungültigen Eingaben und offenen Strichen
gegen den echten SQLiteStore. Kein Worldcommand und unveränderte bestätigte
Bytes vor ausdrücklicher Übernahme; anschließend genau ein Strich und seine
exakte Rücknahme/Wiederholung. Der CTM ist dort kontrolliert, keine native
Koordinatenqualifikation. Zusätzlich nativ am Desktop geprüft: Verschieben mit
offener Hexprosa, echter Pointerstrich mit Mausradunterbrechung, sichtbarer
Entwurfshinweis und ausdrückliche Speicherung. Worldrecords/-history/-receipts
und Positionen bleiben bis zur Übernahme bytegleich; unabhängiges Fresh-Öffnen
erhält Gelände und exakte Prosa. Ein normaler Exit ohne Rendererfehler. Das
qualifiziert diesen Nutzerweg, weder alle Host-/Gesturevarianten noch den
[gemeinsamen passiven Canvasanschluss](spatial-runtime.md#passive-kartenfläche-und-adoptergrenze).
Rücknahme/Wiederholung stellt die exakten vorherigen expliziten Zellen bzw. deren
Abwesenheit wieder her. Eine inzwischen anders geänderte betroffene Zelle sperrt
Rücknahme, statt fremde Inhalte zu überschreiben.

Lokale History gilt bis Kartenwechsel/Neustart: maximal20Striche bzw.20.000berührte
Zellen. Ein Strich ist auf5.000Zellen begrenzt; die Grenze wird angezeigt und
bereits sichtbare Änderungen bleiben im normalen Abschluss. Ein gespeicherter
Strich bleibt nach Neustart erhalten, die lokale Rücknahmehistorie nicht.

Dies liefert direktes Malen/Kamerabedienung, keinen vollständigen Hex-Paritätsnachweis.
Installationseigener editierbarer Biomkatalog und Kopplung mit Kreaturenfiltern
bleiben eigene größere Produktarbeit; native Großwelt-/Touchqualifikation offen.

## Gemeinsame passive Kartenkamera (0.131, 15.10.2026)

Dungeonraster und Hexkarte verwenden `PassiveMapCanvas` für Viewbox, mittleres
Ziehen, Mauszeigerzoom und passive Fehler-/Leerzustände. Die Komponente kennt
weder Hexkoordinaten noch Räume, Reisebefehle, Speicherregeln oder Kartentypen.
Beide Adapter zeichnen ihre Geometrie, Labels, Relationen und Tokens in denselben
SVG-Wurzelknoten, an dem auch ihre sichtbaren Treffer hängen. Sie interpretieren
rohe Szenenpunkte selbst. SVG benötigt unter der bestehenden CSP weder WebGL
noch dynamische Codeauswertung.

Die Hexkamera verschiebt sich jetzt kontinuierlich statt auf ganze Hexes zu
springen; der Adapter leitet nur die sichtbare Nachlade-/Zeichenregion daraus
ab. Rasterwechsel bleibt eine ausdrückliche Autorenentscheidung. Mausrad und
Kameratasten speichern keine offene Hexeingabe. Im Dungeon bleiben Auswahl,
bestätigte Kontur-/Keyänderungen und Layoutwechsel im gewählten Ausschnitt;
Einpassen beziehungsweise Übersicht sind ausdrückliche Navigation. Mittleres
Ziehen legt auch bei aktivem Zeichenwerkzeug keine Geometrie an. Ein unterbrochener Hexpinselzug bleibt wie oben beschrieben ein ungespeicherter
Entwurf; Kameragesten bestätigen ihn nicht. Die gemeinsame Kamera erhält ihre
kontinuierliche Position auch bei Alt+Pfeiltasten.

Ein Fehler während des Zeichnens erhält die letzte vollständige Szene, sperrt
ihre Treffer und zeigt einen lokalen Hinweis mit „Karte erneut zeichnen“.
Navigation und Autorenfakten bleiben erhalten. Die Wiederholung baut die
aktuelle Szene neu auf, ohne zweite Pointerhandler oder einen anderen
Kampagnenstand. Eine leere Szene benötigt keine erfundenen Hexes oder Räume.

`tests/desktop-passive-map-canvas.test.mjs` prüft Kamera, Szenen-/Leerzustände und
lokale Wiederholung; die bestehende Reise-DOMprüfung prüft offene Ziel-/Hexdaten
bei Zoom und Reset. Physische Treffer-/Dragabnahme erfolgt zusätzlich am
Desktop. Ein vollständig nahtloser Atlas aller Karten, alle weiteren Canvas-
Adopter sowie die große Sichtregion-/Performanceabnahme bleiben offen. Diese
Lieferung behauptet keine vollständige Wonderdraft-/Dungeonqualifikation.

## Ortsmarken im Desktop

Bestehende World-Orte sind nach Name, Ortstyp und Kartenname suchbar; die Auswahl
zeigt Karte und Koordinaten. „Marker zeigen“ navigiert ausdrücklich, Auswahl und
Gestaltung erhalten die Kamera. Versetzen erhält Orts-ID und Darstellung; ein
belegtes Hex wird nicht still überschrieben.

Die Kartendarstellung besitzt eine eigene `place-presentation`-Revision im
bestehenden World-Record-Speicher: optionaler Titel, acht gemeinsame SVG-Symbole,
Größe, Position und Krümmung der Beschriftung. Standardwerte gelten für bisherige
Marker. Vorschau ist unmittelbar; Regler werden beim Abschluss zusammengefasst
gespeichert. Bei Konflikt wird die bestätigte Darstellung erneut gelesen.
Ortsdokument und Gelände-Revision bleiben davon unabhängig. Kampagnenkopien
übertragen die Darstellung mit neu zugeordneten Orts-IDs.

### Markerwechsel mit offener Speicherung

`world-ui.ts` hält bei einer neuen Ortsauswahl die bisherige Marker-ID und ihre
Felder bis zur bestätigten Speicherung zusammen. Die Felder sind während dieser
Übergabe gesperrt; nur die jüngste Auswahl darf anschließend einen neuen Draft
binden. Programmatisch verspätete Inputs werden nur bei passender sichtbarer ID
und editierbarer Fieldsetbasis gesammelt. Auswahl-ABA und Reaktivierung machen
ältere Auswahlantworten ungültig.

Der bestehende `raw`-Guard bindet den Markerauftrag vor IPC und seine Antwort
an das tatsächlich übergebene Draftobjekt. Kontextwechsel während vorbereitender
Flushes senden keinen alten Markercommand mehr. Ein bereits angewandter alter
Auftrag behält seinen Beleg, darf aber keine neu gelesene World-/Markersicht
überschreiben. Keine neue Commandart oder Persistenz. Bei fehlgeschlagener oder
unklarer Buchung bleibt der bisherige Ort ausgewählt; die bestehende
Originalcommand-Reconciliation klärt einen verlorenen Ausgang ohne zweiten Write.

`desktop-marker-selection.test.mjs` kontrolliert echte Store-/DOMübergaben mit
verzögerter Vorbereitung und Bestätigung, schneller A/B/A-Auswahl, gleicher
Workspace-Reaktivierung, neuerem Fremdstand, Validierungsfehler und verlorenem
IPC-Reply samt read-only Recovery. Diese lokalen Gegenproben ersetzen keine
vollständige native Marker-, Chunk-, Symbol- oder Hexabnahme.
Eine zusätzliche Electron-Bedienprobe bestätigt zwei getrennte Markersaves,
unveränderte Orts-/Geländeinhalte, Fresh-Wiederöffnung und normalen Prozessausstieg.
Die gezielt verzögerten Bestätigungen bleiben kontrollierte Store-/DOMbelege.

Noch offen im vollständigen Originalumfang: Erstellung kompletter World-Orte
direkt aus dem Hexwerkzeug, Suche nach kanonischen Tags, eigene importierte
Symbole, persistente Marker-Undohistorie und referenzbewusstes Entfernen von
Markern/Gelände. Der einfache Karten-JSON-Export enthält weiterhin nur Gelände;
die vollständige Kampagnenkopie erhält auch Orte und Marker.
Auch die Voraussetzung eines bereits gestalteten Zielhexes wird im aktuellen
Desktop-Platzierungscommand noch nicht erzwungen.

## Verbleibende ausführbare Hex-Lieferfolge

Die Feature-, Editor- und Travel-Originale bleiben gemeinsam maßgeblich. Acht
feste `Terrain`-Werte, ein kleiner Markerpicker und lokale Strichhistory sind
Teilstände, keine alternative Reduktion des Auftrags.

1. **Gemeinsame Biome vor weiteren Palette- und Reiseregeln.** `world-contracts.ts`
   und `world-model.ts` verwenden bisher feste Terrainstrings/-faktoren;
   `features/catalog/creature-catalog.ts`, Desktopkatalog und Generatorfilter
   müssen dieselben stabilen installationseigenen Biom-IDs konsumieren.
   Die 35 Originalbiome einschließlich Aliasauflösung und globaler `Any`-Tabelle
   auf vorhandene Kreaturumgebungen abbilden. Schutz gilt gegen Löschen, nicht
   gegen erlaubte Bearbeitung. Writer/Reader, serverseitige Suche/Seiten und
   virtuelle Dreierspaletten gemeinsam schließen. Bestehende Geländestrings
   verlustfrei migrieren; keine stillen neuen Reise-/Passierbarkeitswirkungen für
   historische Karten oder gespeicherte Journeybasen. Abnahme: Custom-Biom über
   Palette, Kreaturfilter, Routenvorschau, Restart und unabhängige Kopie; echte
   fehlende Definition zeigt Problem statt Fallback ohne Kennzeichnung.
2. **Paint/Erase und sichtbare Fenster auf denselben Patchwriter.**
   `hex-paint.ts`/`hex-map-gestures.ts`, Worldreader und `storage/world.ts` vom
   Whole-Map-Write zu gebundenen betroffenen Zellen/Chunks führen. Derselbe
   kanonische Axialpfad und Radius 0–9 dienen Vorschau und Writer. Echte sparse
   Abwesenheit ist Radieren, kein Paint auf das Standardbiom. Vor Erase
   `atlas_place`, `scene_position` und offene Journeys als Impact zeigen;
   ausdrücklich bestätigtes Entfernen, Reiseabbruch und Positionsclear atomar,
   ohne Ort oder PC zu löschen. Undo betrifft Kartenfakten und belebt keine
   bereinigte Position/Reise wieder. Persistierte letzte 20 Aktionen je Karte
   ersetzen die aktuelle rein lokale Strichhistory. Abnahme: gemischte Referenzen,
   Rollback mittendrin, spätere Fremdänderung, verlorene Antwort, Fresh und
   negative/große Koordinaten; Kamera bleibt erhalten. Gezeichnetes Fenster ist
   bereits begrenzt, der aktuelle Whole-Map-Reader damit noch nicht qualifiziert.
3. **World-Ort erzeugen/platzieren über bestehende Owner.** Vollständigen
   Locationeditor in `preparation.ts`/`changePreparation` aus dem Hexwerkzeug
   öffnen; aktuelles freies authored Tile ist nur ein staged Vorschlag.
   Erst bestätigte Locationanlage, dann separater revisionierter Placecommand.
   Teilfehler erhalten den angelegten Ort und aktive Auswahl. Move-/Remove- und
   neu gesetzte Marker brauchen Tile-/Map-/Placementguards im Worldwriter;
   bestehende Legacyplatzierungen bei Migration nicht still verwerfen.
   Bestätigte Locationlöschung entfernt ihre Platzierung atomar. Abnahme:
   besetztes/unbeschriebenes Tile, zwischenzeitlicher Orts-/Mapwechsel,
   wiederholte Command-ID und Platzierungsfehler nach erfolgreicher Anlage.
4. **Symbole und Markerprojektion schließen.** Den gemeinsamen Built-in-Manifest
   in `atlas-marker.ts` erhalten, eigene one-path-SVGs über begrenzte Mainauswahl,
   Utility-Parser und installationseigenen Such-/Detail-/Impactowner ergänzen.
   Import+Assignment besitzt einen idempotenten Journalpfad; Löschung ersetzt
   aktive und recoverable Referenzen vor Entfernung. World-/Chunkreader liefern
   vollständige immutable Renderdaten, keine Rendererjoins gegen Kataloge.
   Abnahme: strikte SVG-Untermenge, Parserabbruch, Restart in jeder Journalphase,
   Trashedcampaign-Referenzen und ausschließlich betroffene Invalidierungen.
5. **Runtimeprojektion und Gesamtfluss abnehmen.** `openTravel`/`liveWorld` und
   bestehende Scene-/Journeycommands gegen unabhängige Editor-Mapauswahl prüfen.
   Die kompakte Reiseoberfläche liest nur den tatsächlich fokussierten
   Laufzeitkontext; keine aktive Reise aus einer Editorwahl ableiten. Wegpunkte,
   expliziter Start, passierbare Schritte, Tempo, Pause/Abbruch und pausierte
   Präsentation nach Restart bleiben im vorhandenen [Reiseplan](hex-travel.md).
   Abnahme erst über denselben Nutzerfluss mit gültigen/fehlenden Kontexten,
   gleichzeitigen Saves, Karten-/Scenewechsel, Tastatur, 200 % und großen Daten;
   keine Gleichsetzung einzelner grüner Markerfälle mit vollständiger Hexparität.
