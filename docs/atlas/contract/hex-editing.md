# Kontinuierliches Gelände bearbeiten

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: atlas
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Laufzeitreise, unabhängige Kampagnenkopien und verbleibende Reiseziele:
[Hexreise](hex-travel.md).

Original: [Hex Feature Requirements](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/hex/requirements/requirements-hex.md).

Die aktuelle Geländeprüfung folgt dem [gemeinsamen metrischen Atlas](../architecture/unified-spatial-atlas.md).
Landform, Höhe, Farbe und Geländeeigenschaften werden als kontinuierliche
Landschaft bearbeitet. Reise- und Referenzraster sind unabhängige Verbraucher;
sie legen weder Gelände-Zellen noch eine Autorenstufe fest.

Ein Eigenschaftspinsel verbindet ausgelassene Pointerpositionen durch seine freie
Kontur und seinen metrischen Radius. Loslassen bestätigt genau einen Zug;
getrennte Gesten erzeugen keine verbindende Fläche. Zurücksetzen entfernt nur
die gewählte Eigenschaft im berührten Bereich. Andere Eigenschaften sowie
feinere, nicht berührte Arbeit bleiben erhalten. Gemeinsames Undo/Redo und frische
Wiederöffnung verwenden die kanonische Atlas-Schreibgrenze.

Die früheren Zellfüller, Source-Cell-Indizes, lokalen Zell-Strichhistorien und
Hexstufen-Erwartungen gehören nicht mehr zur aktuellen Geländequalifikation.
Die ursprünglichen fachlichen Quellen bleiben oben und im Quellenregister
gebunden; der Wechsel des technischen Modells entfernt keinen Landschaftsumfang.

## Prüfwege

`tests/atlas/desktop-atlas-frame-loading.test.mjs` prüft freie Eigenschafts- und
Resetkonturen, lückenlose Pinselabdeckung, genau einen Releaseauftrag und die
Trennung mehrerer Gesten. `tests/atlas/desktop-atlas-region.test.mjs` prüft
Eigenschaftsvererbung, gezieltes Zurücksetzen, gemeinsame Rücknahme und Fresh.
`tests/atlas/desktop-land-mask.test.mjs` prüft daneben eine unabhängige
Archivkopie kontinuierlicher Flächen einschließlich Änderung und Löschung.
`tests/atlas/terrain-live-history.test.mjs` schützt kleine History-Deltas und
unveränderte andere Flächen bei 100.000 kontinuierlichen Geländeobjekten.

`tests/runtime/desktop-map-camera-passivity.test.mjs` bleibt eine begrenzte
Prüfung der Kamera sowie unabhängiger Beschriftungs- und Kalendereingaben im
Reiseadapter. Sie behauptet keine Prüfung eines alten Gelände-Zellpinsels.
Native Atlasproben besitzen zusätzliche Kamera-, Neustart- und Bildnachweise;
ihr tatsächlicher Laufstand bleibt von diesem Fachvertrag getrennt.

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
