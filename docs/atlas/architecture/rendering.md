# Atlas: Darstellung und Bearbeitung

Status: Current; offene Ziele sind als solche beschrieben.
Owner: atlas
Last Reviewed: 2026-10-29 (Screenzug und gemeinsame Terrain-Sichtbarkeitsgeometrie; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Der Atlas verbindet Landschaft, Städte und Räume in Weltmetern. Der [kanonische Store-Worker](../../project/architecture/canonical-store-worker.md)
besitzt SQLite und alle Store-Schreibvorgänge; Main besitzt den privilegierten Hostanschluss. Der Renderer erhält ausschließlich
die geprüften Fähigkeiten der Preload-Brücke.

Die [Architektur und bestätigte Lieferpriorität](unified-spatial-atlas.md) gelten
für alle folgenden Anschlüsse. Dieses Dokument besitzt Codeeinstiege und Prüfwege;
[guide.md](../guide.md) besitzt aktuelle Bedienung und Werkzeugnamen. Fachverträge
besitzen Wirkung und Datenregeln, [Atlasanforderungen](../requirements/atlas.md)
den vollständigen Zielumfang. Historische Adapter- oder Paketstände sind nur an
festen Gitrevisionen Referenzen, keine zusätzlichen aktuellen Arbeitspläne.

## Zuständigkeiten und Datenfluss

1. **Arbeitsbereich und Werkzeuge** wählen Kampagne, Ausschnitt, Geschoss und
   Bearbeitungsaktion. Temporäre Entwürfe gehören ihrer jeweiligen Sitzung. Autoren-Gesten verwenden gemeinsame `hasDraft`-/Abbruchregeln; Regions- und Reisezustand werden nur über ihre eigenen Befehle geändert.
2. **Lesedienst und Worker** lesen einen bestätigten Quellenstand. Fertige,
   quellengültige Kacheln werden zuerst aus dem Cache verwendet. Nur fehlende
   Produkte benötigen Indexsynchronisation und erneute Berechnung.
3. **Kamera und Darstellung** verwenden Meterkoordinaten und lokale GPU-Puffer.
   Kamerabewegung verändert die Transformation, keine Autorendaten.
4. **Schreibwarteschlange** übergibt abgeschlossene Gesten in Reihenfolge an Main.
   Jede Geste bleibt ein Historyschritt. Ungeklärte Bestätigungen sperren davon
   abhängige Änderungen, bis der Speicherstand ausdrücklich geklärt wurde.
5. **Export und Spieleranzeige** konsumieren bestätigte Szenen. Öffentliche
   Inhalte stammen ausschließlich aus der freigegebenen Spielerprojektion.

### Zustandsbesitzer und Übergänge

`CampaignAtlasWorkbench` verbindet die Besitzer und koordiniert angenommene
Übergänge. Sie erhält keine zusätzliche Schreibautorität über ihre Fachzustände.
Die `createAtlas…`-Anschlüsse übergeben konkrete Lese-/Aktionsfähigkeiten; weder
Gesamt-Workbench noch `opts` werden weitergereicht.

| Zustand | Einziger Schreiber | Leser / angeforderte Aktionen | Abmeldung / Reset |
| --- | --- | --- | --- |
| Geschlossene Terrainzüge, zugehöriger Token, Recovery-Sperre und einmaliger automatischer Retry | `AtlasTerrainEdits`, intern `TerrainStrokeQueue` / `TerrainQueueRecovery` | Landgesten reihen ein; UI liest `view` und fordert Klären, Anwenden, Verwerfen oder Drain an; Receipt-, Quellen- und Projektionsports sind getrennt | `hide` stoppt eigene Timer und entwertet Lesefortsetzungen; `activate` verweigert fremde Kampagnen bei gehaltenen Zügen; nur `releaseSettled` entfernt eine leere bestätigte Queue |
| Auswahl, Stadt, Raumgruppe, Geschoss, Platzierungsabsicht und Autorenentwurf | `AtlasAuthor` | Klick, Treffer, Suche und Navigation fordern fachliche Auswahloperationen an; Darstellung und Layout lesen denselben Kontext | `hide` entwertet Auswahlleases; `resetContext` räumt nur Autorenkontext/Gesten auf; `changeTool` beendet den leeren Werkzeugcursor erst nach angenommener Grenze |
| Aktive Kampagne, Sichtbarkeit, Werkzeugfamilie und koordinierte Übergangsgeneration | `CampaignAtlasWorkbench` | Workspace und Live-Portal fordern Aktivierung, Öffnen, Verbergen, Flush oder Werkzeugwechsel an | Eigene Such-/Treffergeneration, Öffnungsauftrag und Laufzeit-Refresh-Timer werden stillgelegt; Fachresets werden delegiert |
| Anfragegeneration, Regions-Timer, bestätigte Projektion und Bereitschaft | `AtlasRegions` | Autoren, Reise, Darstellung und Ausgabe lesen bestätigte Quellen und fordern Refresh an | `cancel` beendet eigene Leseaufträge/Timer, `resetContext` zusätzlich die alte Projektion |
| Reisevorschau, ungeklärter Reiseauftrag und Wiedergabe | `AtlasJourney` | Controls fordern Reise-/Recoveryaktionen an; Regionen melden Lesekontext | `hide` entwertet Vorschau und stoppt Wiedergabe; `drainPlayback` wartet auf ihr tatsächliches Ende; `activate` setzt den eigenen Reisekontext zurück |
| Wiederverwendbare Zeichengeometrie und Beschriftungslayout | `AtlasDrawing` | Zeichnet bestätigte Regionsdaten und sichtbare Autorenentwürfe | `invalidateGeometry` / `resetContext` besitzen nur abgeleitete Darstellung |
| Ausgabebereich, Zeigergeste und Exportauftrag | `AtlasOutput` | UI fordert Ausgabeaktionen an, Darstellung liest die Auswahl | `cancel` bricht den eigenen Exportkanal ab, `reset` räumt seine Bereichswahl auf |
| Kamera / gespeicherte Ausschnitte und Live-Einbettung | `AtlasCanvas` / `LiveAtlasPortal` jeweils für den eigenen Zustand | Workbench fokussiert; das Portal bewegt dieselbe Fläche und dieselben Controls | Kampagnenkontext wechselt über `camera.context`; Verbergen und Live-Docking erzeugen keine zweite Kamera oder Fachauswahl |

Die gemeinsame Reihenfolge bleibt in `activate`, `hide`, `open`, `flush` und
`setFamily` sichtbar. Aktivierung prüft zuerst die Terrain-Abgabepflicht; danach
entwertet sie Regions-/Treffer-/Reise-/Ausgabeantworten, veröffentlicht den neuen
Workspace und delegiert Landschafts-, Autoren-, Darstellungs- und Kamerakontext.
Verbergen entwertet zuerst die Workbenchgeneration, dann Terrain-Recovery,
Analyse, Projektion, Regionslesen, Export, Treffer, Reise und Autorenantworten;
erst danach wird die Fläche verborgen. Angenommene Writes werden nicht abgebrochen.
Öffnen aktiviert Terrain-Recovery, lädt Terrain und Region und nimmt erst für
dieselbe noch sichtbare Generation den Werkzeugmodus an. Ein alter Öffnungsauftrag
kann eine neu geöffnete Ansicht nicht übernehmen.

Flush wartet zuerst auf Terrain-Drain und danach auf das Ende der
Reisewiedergabe; ungeklärte Commands, offene Fachentwürfe und Placementänderungen
verweigern die Übergabe. Navigation verwendet diese Grenze vor jedem Targetread,
zusätzlich zum bestehenden Editorflush. Eine Autorenlease schützt die Übernahme
über weitere Reads und Auswahloperationen hinweg. Werkzeugwechsel prüft die
Grenzen vor seiner ersten Mutation; ein verweigerter Wechsel erhält Auswahl und
Entwurf. Erst die angenommene Grenze übergibt der fachlichen Auswahloperation den
neuen Kontext und aktiviert die passende Werkzeugfamilie. Diese Regeln verwenden
weiterhin bestehende Tokens, Receipts und Entwurfssicherung, keine allgemeine
Zustandsverwaltung.

Funktionsumfang und Regressionsziele stehen im
[Atlasplan](unified-spatial-atlas.md). Technische Nachweise ersetzen
keine vollständige Produktabnahme.

## Wo ändern und prüfen?

| Verhalten | Einstieg | Regression |
| --- | --- | --- |
| Arbeitsbereich, Werkzeugnamen und Seitenleisten | `src/app/atlas/campaign-atlas-ui.ts`, `src/app/atlas/atlas-workspace-layout.ts`, `src/app/atlas/atlas-tool-catalog.ts`, `src/app/atlas/atlas-workspace.css` | `tools/test-desktop-atlas-cleanup.mjs` |
| Kamera, GPU-Lebenszyklus und Weltkoordinaten | `src/app/atlas/atlas-deck-surface.ts`, `src/app/atlas/atlas-metric-camera.ts` | `tests/atlas/atlas-deck-surface.test.mjs`, `tools/test-desktop-atlas-deck.mjs` |
| Zeichenbefehle und genaue Auswahl | `src/app/atlas/atlas-deck-drawing.ts`, `src/app/atlas/atlas-drawing-geometry.ts` | `tests/atlas/atlas-drawing-geometry.test.mjs`, `tools/test-desktop-dungeon-groundplan.mjs` |
| Maßstab, Waldzeichnung und stabile Instanzen | `src/app/atlas/atlas-cartographic-style.ts`, `src/app/atlas/atlas-cartographic-texture.ts`, `src/app/atlas/atlas-vegetation-layer.ts` | `tests/atlas/atlas-cartographic-scale.test.mjs`, `tools/test-desktop-atlas-multiscale.mjs` |
| Kacheln und gemeinsame Nachladung | `src/app/atlas/atlas-surface-tile-stream.ts`, `src/app/atlas/atlas-raster-tile-stream.ts` | `tests/atlas/atlas-surface-stream.test.mjs` |
| Quellenauswertung und Material | `src/app/atlas/landscape-raster.ts`, `src/app/atlas/atlas-raster-kernel.ts` | `tests/atlas/atlas-bounded-material.test.mjs`, `tests/atlas/atlas-raster-kernel.test.mjs` |
| Asynchrone Leseaufträge | `desktop/atlas-region.ts`, `desktop/atlas-region-worker.ts` | `tests/atlas/atlas-first-product-worker.test.mjs`, `tests/atlas/atlas-presentation-source.test.mjs` |
| Persistente Produkte und Cache | `src/app/storage/atlas-cache-scope.ts`, `src/app/storage/atlas-tile-cache.ts` | Terrain-/Material-/Geometriekacheltests |
| Pinselentwurf und Bestätigung | `src/app/atlas/landscape-brush-session.ts`, `src/app/atlas/terrain-stroke-queue.ts` | [Speicherklärung und enge Gegenproben](#speicherklärung-im-atlas) |
| Ausgabe | `src/app/atlas/atlas-output.ts` | `tools/test-desktop-region-export.mjs`, `tools/test-desktop-atlas-cleanup.mjs` |

## Gelände ändern

Vom [Index](../../INDEX.md) führt dieser Weg über die
[Bedienung der Landwerkzeuge](../guide.md#gelände-formen-und-ansicht-kippen) zum Writer:
`atlas-landscape-ui.ts` / `landscape-brush-session.ts` halten Eingabe und Vorschau;
`atlas-terrain-edits.ts` besitzt die geschlossenen Höhenzüge samt Recovery;
`terrain-stroke-queue.ts` ordnet ihre unveränderlichen Aufträge. `campaign-atlas-author.ts`
übergibt den Auftrag ausschließlich über Preload/Main. Der kanonische Einstieg
ist `CampaignStore.executeAtlasCommit` in `src/app/storage/store.ts`, mit
`campaign-atlas.ts`, `landscape-brush-edit.ts`, `atlas-landscape.ts` und den
gezielten Record-/Terrainmodulen als Fachbesitzern. Die UI schreibt keine SQLitewerte.

Datenvertrag: [kontinuierliche Geländewirkung](../contract/hex-editing.md),
[Land, Farbe und Wasser](../contract/landscape-tools.md#aktuelle-landwerkzeuge--r2-vereinheitlichung-20102026)
und [aktuelle Terrainziele samt offenem Feinhöhenschutz](../requirements/terrain-relief.md#ziele-und-abnahme-dieser-etappe).
Reise-/Referenzhexes sind keine Autoren-Zellen. Eigenschaftsvererbung ist nicht
mit dem noch offenen Schutz absoluter Feinhöhen gleichzusetzen.

Automatisierte Quellprüfungen: [desktop-atlas-region.test.mjs](../../../tests/atlas/desktop-atlas-region.test.mjs)
für Eigenschaften, partielle Rücksetzung, gemeinsame History und Fresh;
[desktop-land-mask.test.mjs](../../../tests/atlas/desktop-land-mask.test.mjs) für
Höhen-/Küstenkopplung, atomaren Commit und unabhängige Kopie kontinuierlicher Flächen;
[terrain-scale-worker.test.mjs](../../../tests/atlas/terrain-scale-worker.test.mjs)
für den tatsächlichen Bearbeitungsdatenpfad zwischen Worker, Store und Entwurf,
mehrere Maßstäbe, History und frische Wiederöffnung.
Native Grundpinselprobe: [test-desktop-terrain-brush.mjs](../../../tools/test-desktop-terrain-brush.mjs),
Folgezüge und Speicherfehler siehe [Speicherklärung](#speicherklärung-im-atlas).
Testinhalt ist ein gezielter Prüfweg; ein vorhandenes Skript ist kein neuer Laufbeleg.

Die Welt-Autorenprobe (`tools/test-desktop-world-authoring.mjs`) wartet vor dem
Höhenzug nach dem Hover auf die vollständige Autorenbasis für den tatsächlich
gewählten Radius und dieselbe Terrainrevision. Ein fertiges Anzeigebild reicht
hier nicht: Die Produktionsgrenze nimmt während der Autorenladung keinen
Pointer-down an; daraus entstehen weder Vorschau noch Speicherauftrag.
Der Kontinentradius von 2.200.000 Metern und die kanonische Commitassertion
bleiben Teil der Probe. Abgeschlossene Straßenzüge warten vor der nächsten
Eingabe auf ihre kanonische Revision und die vom Writer freigegebenen Controls;
ein noch fertiger Anzeigeframe ist kein Nachweis einer abgeschlossenen Sicherung.
Alle drei gezeichneten Straßen werden im kanonischen Bestand verlangt.

`prepareHeightBrush` indiziert die unveränderlichen Dabs nach Radiuszellen.
Die Dosis summiert räumlich relevante Kandidaten in unveränderter ursprünglicher
Reihenfolge. Das Arbeitsbudget zählt deren lokale Kachel-/Knotenkombinationen;
ein langer Zug wird nicht mehr durch die Multiplikation aller Dabs mit dem
gesamten umschließenden Rechteck abgewiesen.
`tests/atlas/terrain-brush-budget.test.mjs` vergleicht die numerische Dosis mit
der vollständigen geordneten Integration an Zellgrenzen und entfernten
Koordinaten, erzeugt Höhenrecords für den Kontinentpfad und prüft die weiterhin
bestehende Ablehnung tatsächlich übermäßiger lokaler Arbeit.

## Reise ändern

Vom [Index](../../INDEX.md) über [Leiten](../guide.md#leiten) zu
`src/app/atlas/atlas-journey.ts` und `src/app/runtime/world-ui.ts` für Anzeige und
Reisebedienung. Kanonisch verbinden `CampaignStore.executeWorld`,
`src/app/storage/world-command-flow.ts`, `world-commands.ts` und
`travel-history.ts` Reiseabschnitt, Zeitfolgen, Checkpoint und Receipt innerhalb
der bestehenden Transaktion. Lokale Atlaswege besitzen daneben ihren Anschluss
in `src/app/storage/atlas-travel.ts`. Besitzaufteilung und Folgeordnung stehen bei
den [fachlichen Speicherbesitzern](../../project/architecture/storage-ownership.md#fachübergreifende-abläufe).

Datenvertrag: [Journeygrundlagen und Grundkosten](../contract/hex-travel.md#vorhandener-ablauf-und-datenregeln),
[Passierbarkeit](../contract/hex-travel-2.md) sowie
[Checkpoint, Wiederaufnahme und kausale Rücknahme](../contract/hex-travel-3.md#checkpoint-und-wiederaufnahme-auf-der-aktuellen-atlasfläche).
Das axiale Reiseraster, gespeicherte Journeybasis und Terrain-Umgebungsrevision
bleiben gültig; daraus folgt kein Zellwriter für die Landschaft. Autorhistorie und
kausale Reisehistory sind getrennt. Geänderte Landschaft kann eine Reisebasis
entwerten; bloßer Zoom, Rasterwahl oder Kamera erzeugen keine Zeitbuchung.

Automatisierte Quellprüfungen: [desktop-travel.test.mjs](../../../tests/runtime/desktop-travel.test.mjs)
für mehrere Checkpoints, Replay, kausale Rücknahme, spätere Prosa, Restart und
Rollback; [desktop-campaign-atlas.test.mjs](../../../tests/atlas/desktop-campaign-atlas.test.mjs)
für lokale Wege, ausdrückliche Eingänge und dieselbe Gruppenuhr.
Native Probe: [test-desktop-travel-checkpoints.mjs](../../../tools/test-desktop-travel-checkpoints.mjs).
Mehrkarten-/Welttabbelege bleiben historisch; `SMR-AC-08/09` bleiben eigene offene
Gesamtabnahmen.

## Speicherklärung im Atlas

Vom [Index](../../INDEX.md) über den
[sichtbaren Klärungsablauf](../guide.md#speicherstand-klären-und-weiterarbeiten)
zu `AtlasTerrainEdits` mit `TerrainStrokeQueue`, `campaign-atlas-author.ts` und dem Klärungszugang in
`campaign-atlas-ui.ts`. `CampaignStore.reconcileAtlasCommit` ist der kanonische
Read für den Originalauftrag. [Store-Worker](../../project/architecture/canonical-store-worker.md)
und [Speicherports](../../project/architecture/storage-ports.md) besitzen
Transaktion, Belegdecodierung und die privilegierte Grenze; der Renderer bleibt
auf die Preloadfähigkeiten beschränkt.

Dieser Klärungsvertrag gilt für Autoren- und Terrainaufträge. Lokale Reiseaufträge
behalten ihren eigenen idempotenten Commit-/Checkpointpfad unter [Reise ändern](#reise-ändern).

Geschlossene Terrainzüge behalten ursprüngliche Kennung, unveränderliche Aktion
und Reihenfolge auch nach endendem Transportversuch. `reconcilePendingAtlasCommit` liefert
typisiert `applied`, `not-applied` oder `unknown`. Nur ein zu Kampagne und
Command-ID passender Beleg samt bestätigter Revision/Fence entfernt den Kopf und
autorisiert seinen Folgezug genau einmal. Gleichzeitige Klärungen teilen einen
Read. Unknown, temporäre Lesefehler oder beschädigte Receipts sind keine sichere
Ablehnung und lösen keinen Write aus. `TerrainQueueRecovery` prüft solche Antworten automatisch mit begrenzter Wiederholungsfrequenz und beendet seine Timer bei Abmeldung. Nach `not-applied` darf derselbe Originalauftrag auf unveränderter Quelle automatisch wiederholt werden; ein wiederholtes Scheitern bleibt gehalten. Eine geänderte Quelle verlangt die ausdrückliche Entscheidung „Erneut anwenden“ oder „Verwerfen“. Der Hinweis „Letzter Pinselzug nicht übernommen“ erzwingt keinen Dialog. Nur noch nicht bestätigte Züge werden auf die aktuelle Quelle gesetzt; ein bereits bestätigter Kopf bleibt entfernt.


Kamera und Ansichtsladen setzen die Queue nicht zurück; Undo, Wechsel und normales
Schließen dürfen ungeklärte Züge nicht überspringen. Der Sitzungsentwurf ist kein
persistentes Journal unbestätigter Eingaben. Eine über vollständige Appneustarts
fortgesetzte Autor-Undo-Bedienfolge wird nicht allgemein zugesagt. Checkpoint-
Wiederaufnahme folgt weiterhin dem eigenen Reisevertrag. Beim Kampagnenimport
entwertet die frühe [Editorstilllegung](../../project/architecture/editor-lifecycle.md)
alte Regionsantworten; der neue bestätigte Besitzer darf echte Ladefehler weiter
zeigen.

Automatisierte Besitzerprüfungen:
[atlas-terrain-edits.test.mjs](../../../tests/atlas/atlas-terrain-edits.test.mjs)
verwendet den vollständigen Terrainbesitzer mit Queue und Recovery für verlorene
Erstantwort, genau einmalige Folgefortsetzung, Quellenkonflikt mit Anwenden/Verwerfen,
Kampagnenwechsel, alte versteckte Antworten und Wiederöffnung.
[atlas-ownership-boundaries.test.mjs](../../../tests/atlas/atlas-ownership-boundaries.test.mjs)
verwendet den vollständigen Workbenchkonstruktor und Produktionsmarkup für
verweigerte Auswahl-/Werkzeugwechsel, konkurrierende Navigation, A–B–A,
späte Antworten und dieselbe Auswahl/Kamera beim Live-Docking.
Die frühere private Queue-Nachbildung in `terrain-commit-display.test.mjs` ist
durch diese Besitzerprüfungen ersetzt; deren Darstellungsprüfungen bleiben erhalten.

Weitere automatisierte Quellprüfungen: [terrain-stroke-queue.test.mjs](../../../tests/atlas/terrain-stroke-queue.test.mjs)
für Originalaktionen, Reihenfolge, Retry und Quellenkonflikt;
[terrain-queue-recovery.test.mjs](../../../tests/atlas/terrain-queue-recovery.test.mjs)
für automatische, zusammengefasste Leseversuche und Timerende;
[desktop-atlas-commit-recovery.test.mjs](../../../tests/atlas/desktop-atlas-commit-recovery.test.mjs)
für Receiptread und tatsächliche Worker-/Host-/Preloadgrenze;
[workspace-editor-registry.test.mjs](../../../tests/workspace/workspace-editor-registry.test.mjs)
für frühe Stilllegung und aktuelle Fehler;
[desktop-storage-values.test.mjs](../../../tests/shared/desktop-storage-values.test.mjs)
für beschädigte gespeicherte Werte/Receipts und unveränderte Originalbytes.
Native Probe: [test-desktop-atlas-terrain-stroke.mjs](../../../tools/test-desktop-atlas-terrain-stroke.mjs)
mit `--recovery` und `--recovery --source-conflict`; `--recovery --drop-followup` muss eine fehlende B-Wirkung erkennen.
Der enge lokale Folgezugnachweis ist abgeschlossen; vollständiges G1, physischer
Input, 100 %, Plattform-/Paketqualifikation und Produktabnahme folgen daraus nicht.

## Quellenstand und Veröffentlichung

Ein sichtbarer Frame ist nur für die Kamera, Fenstergröße, Kampagne und Revision
gültig, für die er aufgebaut wurde. Ein altes Bild darf während der Nachladung
stehen bleiben; es erteilt keine neue Schreib- oder Auswahlberechtigung.
Verspätete Antworten werden verworfen. Ein Abbruch beendet auch die laufende
Arbeit, bevor ein Ersatz denselben begrenzten Rechenplatz übernimmt.

Eintreffende LOD-Kacheln verändern die Fokushöhenebene der ruhenden Kamera
nicht. Unterschiedliche interpolierte Höhen dürfen keinen Wechsel zwischen
sofort verfügbaren Kachelplänen und dadurch eine endlose Ladefolge auslösen.
Eine gespeicherte vollständige Kamerapose behält ihren Fokus auch beim ersten
Überblick nach einer frischen Öffnung; dessen gröbere Höhen ersetzen die
gespeicherte Augenposition nicht.
Der Abschluss einer Navigation und die Ansichtssteuerung führen den Fokus nach;
die Sicherheitskorrektur bei neu bekanntem Terrain unter der Kamera bleibt aktiv.
`tests/atlas/atlas-presentation-source.test.mjs` prüft beide Zuständigkeiten.

Höhe und Material werden gemeinsam veröffentlicht. Eine Elternkachel bleibt
sichtbar, bis ihre benötigten Kinder vollständig sind. Cachebudget und
Verdrängung zählen sichtbare und vorbereitete Daten mit. Cacheinhalte sind
ableitbar; beschädigte eigene Bestände werden kontrolliert neu aufgebaut.
Bei einem Quellenwechsel kann der Readonly-Worker einen begrenzten Verlauf
zwischen exakter Basis- und Zielrevision samt Fence bestätigen. Der Surface-Stream
übernimmt dann ausschließlich disjunkte Kacheln mit unveränderten Produktparametern
in neue Metadatenhüllen; Höhen- und Materialarrays bleiben gemeinsam erhalten.
Der Abstandscheck umfasst den Materialhalo und eine zusätzliche Gitterzelle.
Fehlende oder gekürzte History, Worker-Neustart, globale Einstellungen und
unbekannte Objektabhängigkeiten erzwingen reguläre Leseaufträge. Vollständige
Autorenpakete werden ebenfalls neu gelesen: ihre ganzen Zeilenpayloads sind
durch räumlich verengte Höhenknotenänderungen nicht abgesichert. Revision und
Fence bleiben an beiden Endpunkten verbindlich; alte Produkte werden nie mutiert.
Kameraposition, Fenstergröße und Licht gehören nicht zur Identität gespeicherter
Autorendaten. Änderungen berücksichtigen Nachbarknoten, Quellenränder und Eltern.

Der sichtbare Ausschnitt erhält bis zu 32 Detailkacheln, bei Neigung mit feineren
Blättern am Arbeitsbereich und groben Kacheln in der Ferne. Der Puffer zum
Vorladen darf diesen Ausschnitt nicht vergröbern: Erst nach dessen vollständiger
Verfeinerung werden bis zu acht grobe Nachbarkacheln geladen. Sichtbare,
vorbereitete und zwischengespeicherte Oberflächen teilen sich 64 Kacheln und
64 MiB. Die Reserve erlaubt den atomaren Eltern-Kind-Austausch. In einer
1920 × 1080-Draufsicht sind lokal etwa ein bis zwei CSS-Pixel pro Materialtexel
das Ziel; stark geneigte Fernbereiche dürfen gröber sein. Die Horizontblende
gilt auch im gekachelten Export.

Die Diagnosedaten `terrainCache` zählen gemeinsam gehaltene CPU-Oberflächendaten;
`terrainGpu` meldet die von luma registrierten GPU-Puffer und Texturen der
Anwendung. Letzteres ist keine Messung des gesamten Grafikspeichers oder eine
zusätzliche 64-MiB-Grenze.

## Geometrie, Material und Auswahl

Die metrische Kamera besitzt Projektion und Auswahlstrahlen. Ein naher Ursprung
hält GPU-Koordinaten präzise; kanonische Weltpositionen bleiben doppelt genau.
Gebäude und Räume beziehen ihre physischen Höhen aus denselben Quellen wie die
Darstellung. Versteckte Geschosse verändern keine physische Bauhöhe.

Geländepinsel binden die Kamera an die vollständige, disjunkte Partition der
angezeigten Terrainkacheln. `terrain-surface-layout.ts` prüft deren kanonische
Adressen, vollständige Kameraabdeckung und bestehende Kachelgrenzen. Fehlende
Kacheln oder Abdeckung ergeben „noch nicht vollständig geladen“. Sie gelten
nicht als verdecktes Gelände. Der privilegierte Lesedienst rekonstruiert die
65×65-Kachelgitter aus der angefragten Revision samt Fence; Rendererhöhen oder
Sichtbarkeitsmasken werden nicht als Autorenquelle angenommen.

Picking und Autorensichtbarkeit schneiden dieselben Dreiecke über
`atlas-terrain-ray.ts`; Wasser ist Bestandteil der dargestellten Oberfläche.
Kamera, Layout und Basismeshes bleiben innerhalb der Geste eingefroren.
`AtlasSurfaceDraft` verwendet diese Basismeshes direkt statt eines neu gesampelten
Fokusgitters. Ein feinerer Autorenknoten wird gegen die sichtbare Meshoberfläche
an seiner Weltposition geprüft; Vordergrundterrain schützt verdeckte Knoten.
Geteilte LOD-Kanten verwenden die oberste dort vorhandene Oberfläche, unabhängig
von der Kachelreihenfolge. Der abgeschlossene Zug bleibt ein Historyschritt;
Folgezüge erhalten weiterhin die vorhandenen lokalen Autorenergebnisse und die
kanonische Schreibreihenfolge. Automatisierte Regressionen, native Qualifikation
und Nutzerabnahme bleiben getrennte Nachweise.

### Bildschirmgebundene Höhen- und Seezüge

Neue Höhen- und Seeaufträge tragen optional `screenInput: {version: 1, events}`.
Jedes Ereignis enthält `u`, `v` im bei Pointerdown eingefrorenen Viewport und
`t` in echten Millisekunden seit Pointerdown. Kamera, Seitenverhältnis, Layout,
Revision und Fence sind gemeinsam gebunden. Zwischen erhaltenen Ereignissen
verläuft der Zug linear in Bildschirmkoordinaten und Zeit. Ereignisse außerhalb
des Viewports werden nicht an dessen Rand geklemmt. Main prüft endliche Werte,
Zeitordnung, höchstens 20.000 Ereignisse und 2 MiB UTF16-Eingabe. Die alten
Welt-Samples wählen bei diesen Aufträgen weder Dosis noch Autorenquellen.
Gespeicherte Aufträge ohne das versionierte Feld behalten ihren bisherigen
Vertrag; History/Redo spielen weiterhin tatsächliche Deltas ab.

`atlas-screen-triangle.ts` schneidet kanonische Dreiecke vor der perspektivischen
Division gegen Near/Far und Viewport. `atlas-screen-segment.ts` partitioniert die
Screenstrecke analytisch an Polygonintervallen und Tiefenwechseln aktiver
Dreiecke. Inverse Kameratiefe ist perspektivisch affin; orthografisch gilt dies
für die Kameratiefe. Jeder offene Abschnitt besitzt ein konkretes vorderstes
Dreieck. Baryzentrik mit Clip-w liefert die Weltposition und ihre einseitigen
Grenzwerte; ein Grenzray oder eine gleiche Kachel darf Abschnitte nicht verbinden.
Halten auf einer gemeinsamen Kante wird genau einmal dosiert. Degenerierte
projizierte Flächen erfinden keine Fläche. Der vorhandene Einzelraykern bleibt
eine unabhängige Interior-Gegenprüfung und der Besitzer der Autoren-Sichtbarkeit.

`terrain-screen-geometry.ts` beschleunigt wiederholte Planung ausschließlich
innerhalb einer gebundenen Geste. Token, Revision, Fence, vollständige Kamera und
Layout sowie die Identität aller unveränderten Mesh-Höhenarrays binden den Plan.
Er hält konservative Float64-Dreiecksgrenzen (höchstens 64 MiB) und nur die
aktuellen, weiterhin auf 20.000 begrenzten exakten Kandidaten. Größere Geometrien
nutzen die unveränderte exakte Projektion ohne Cache; das Speicherbudget ändert
keine Wirkung oder Komplexitätsgrenze. Commit, Abbruch, Quellenwechsel und
Deaktivierung geben den Besitzer frei. Neue Screenereignisse berechnen Dosis
und Abschnitte erneut; spekulative Endzeiten werden nicht zwischengespeichert.
Der innerhalb eines Vorschau-/Schreibauftrags berechnete Wirkungsplan wird für
Support und Anwendung gemeinsam genutzt. Main rekonstruiert ihn unabhängig aus
seiner kanonischen Quelle und übernimmt keinen Rendererplan.

Die kleine native Effizienzgegenprobe vom 29.10.2026 bindet dieselbe geladene
75°/10-m-Originalszene bei 100 % und je fünf feste Höhen-/Scattereingaben ohne
Verlängerung bis zum Liveframe. Gegen die gesicherte alte Runtime sinkt
Pointer-up → vollständiger Frame p95 von 21,45 auf 17,38 s (Höhe) und von 30,31
auf 17,09 s (Scatter); die nächste Bedienbarkeit verbessert sich ebenfalls.
Alle zehn tatsächlichen optimierten Eingaben liefern dieselben vollständigen
Autorenbytes wie der gepinnte Originaloperator `3586325c8`. Dieser kleine
Vergleich ist keine Leistungsfreigabe: Alle zehn Liveframes fehlen weiterhin,
Navigation liegt mit p95 117,6 ms über dem 33,3-ms-Ziel, und der Gesamtpeak steigt
von 2.031.165.440 auf 2.127.310.848 Byte. Beide Vergleichsläufe bleiben ohne
`memory.high`, PSI oder OOM; ihre Peakphasen sind wegen der nur im optimierten
Lauf enthaltenen Navigation nicht identisch qualifiziert. 200%-Gegenprobe,
30er-Editserien, längere Retention und erneuter nativer Folgegesten-/Fresh-Schutz
bleiben nach dem angeordneten Rundenabschluss offen. Rohbelege, Runtimebindung,
Prüfungen und Grenzen liegen unter `.build/cycle3-point4/efficiency-final-summary.json`
und `.build/cycle3-point4/efficiency-final-handoff.md`; die akzeptierte vorherige
Screen-Funktionsreparatur bleibt davon getrennt.

`terrain-screen-input.ts` erzeugt geordnete Abschnitte und Zeitgewichte. Die
Mittelpunktsintegration begrenzt jedes Teilintervall auf 1/60 Sekunde und einen
metrischen XY-Weg von Radius/32; die maximale projektive Geschwindigkeit des
Abschnitts bestimmt die Wegunterteilung. Jede Probe wird direkt auf ihrem
Besitzerdreieck ausgewertet; identische stationäre Zentren fassen ihre Zeitgewichte exakt zusammen. Redundante Beobachtungen derselben zeitparametrisierten
Screenlinie werden bis auf 2^-42 eines Viewports normalisiert. Zeit über Himmel
oder außerhalb des Viewports hat keine Wirkung und wird nicht umverteilt.
Fehlende deklarierte Kacheln oder nicht endliche Höhen sind dagegen ein
Ladefehler. Sie dürfen kein Himmelintervall vortäuschen. Der Radius eines
Bildschirmzugs darf am Viewportrand über die gebundene Partition hinausreichen:
Autorknoten ohne Dreieck in dieser vollständig geprüften Partition haben keine
sichtbare Wirkung. Das ergänzt keine unbekannten Höhen außerhalb des Meshs.

Grundpinsel, Glätten und Zielhöhe konsumieren dieselbe Dosis. Formen behalten
getrennte Centrelines je Dreiecksbesitzer und integrieren deren Wirkzeit exakt
je Abschnitt. Sie benötigen keine radialen Quadraturpunkte für ihr räumliches
Feld. Über Silhouetten entsteht kein
Berg-/Schluchtkorridor. Ihre Wirkzeit gehört nur zur Vereinigung der tatsächlich
überstrichenen Abschnitte. See-Dig/Erase und Scatter verwenden deren wirkliche
Kreis-/Kapsel-Footprints. Welt- und Seedidentitäten der Streubecken bleiben
unverändert. Eine gemeinsame Abschnittsgrenze besitzt keine zusätzliche Zeitdosis.

`terrain-stroke-support.ts` bestimmt tatsächliche Dab-/Autorenkachelpaare sowie
Kapsel-Supports für geometrische Footprints. `editHeight` und der Scale-Leser
iterieren explizite Kacheln und Halos. Autorenpakete deklarieren einzelne
`editingSupports`; deren zusammenfassende Box autorisiert keine dazwischenliegende
Quelle. See-/Flussabhängigkeiten werden vollständig aufgelöst; die unabhängige
Okkluderpartition bleibt vollständig. 256 Autorenkacheln, 20.000 Dabs und 60 Mio.
Knotenauswertungen bleiben Grenzen, keine still gekürzten Resultate.

Der Abschlussbesitzer wartet auf die vollständige finale Quelle und deren
angewandte Vorschau, bevor er den unveränderlichen Zug einreiht und den Entwurf
freigibt. Ein Quellenfehler verwirft den aktiven Entwurf ohne Teilcommit.
Ein gesamter Zug bleibt eine Transaktion und ein Historyschritt.

Direkte Regressionen: `tests/atlas/terrain-screen-stroke.test.mjs` mit konservativ
extrahierten echten Revision-85/86-Zellen und den ursprünglichen Ausschlussknoten;
`terrain-scale-worker.test.mjs`, `terrain-lake-source.test.mjs`,
`terrain-brush-draft.test.mjs` und `terrain-author-cache.test.mjs` prüfen die
angeschlossenen Writer-, Abschluss- und Quellenverträge. Native Bedienung,
Paket-/Mainqualifikation und Nutzerabnahme sind eigene Nachweise.

Höhen, Pigment, Wasser und Bewuchs bleiben fachlich getrennt. Kleine Flächen,
Löcher und Inseln dürfen nicht durch eine reine Mittelpunktprobe verschwinden.
Materialreduktion gewichtet Farbe nach Alpha und erhält Wasser-Teilflächen für
abhängige Cachekanäle. Beleuchtung und Schneegrenze verändern Darstellung,
keine gemalten Grundfarben. Die TypeScript-Reduktion arbeitet in begrenzten Blöcken.

Die gezeichnete Darstellung verwendet den lokalen Maßstab in CSS-Pixeln.
Laubwald, Nadelwald, Gras, Sträucher, Geröll, Schilf und Ackerfurchen besitzen
getrennte gewichtete Materialkanäle. Die Landschaftsvorlagen verwenden weiterhin
ihre gespeicherten Grundfarben und Anteile; diese Kanäle sind keine Autorendaten.
Flächengrenzen, Löcher, dünne Säume sowie Freihalten/Ausdünnen/Verdichten bleiben
in den Masken. Wasser unterdrückt normalen Bewuchs; Schilf und Sumpfmaterial erhalten die
definierte flache Wassereignung aus Bodenhöhe und Pegel. Die Wassermaske bleibt
unverändert. Feine Ackerfurchen folgen dem gespeicherten Reihenabstand im
Bodenraster; die Übersicht verwendet weltfeste parallele Striche. Der persistente Materialcache besitzt
eine neue ableitbare Formatkennung; Kampagnen brauchen dafür keine Migration.

Zwei einmal erzeugte, pro GPU-Gerät gemeinsam gehaltene RGBA-Strichtexturen
tragen Kronen, Nadeln, Gras, Buschwerk, Steine und Schraffur. Mipmaps begrenzen
Flimmern. Ineinander übergehende, weltfeste Musterstufen vermeiden Texturwandern;
ihre Perioden teilen die lokale Koordinatenperiode auch an fernen Kachelrändern.
Ab 8 m/CSS-Pixel trägt die Maske die Flächenzeichnung, zwischen 2 und 8 m/Pixel
blendet sie zu den vorhandenen Einzelobjekten über. Zwischen 128 und 512 m/Pixel
weicht der Bewuchs ruhigen Farbflächen. Zoomen erzeugt keine neuen Bestände.

Ein RGBA-Reliefprodukt enthält physische Makronormale und konvexe Rückenstärke.
Es wird mit symmetrischen Höhenproben und Kachelrand berechnet. Im gezeichneten
Modus steuert es breite Beleuchtung, zurückhaltende Schraffur und Rückenlinien;
Schraffur und Rücken verschwinden zwischen 512 und 2048 m/Pixel. Fels und Schnee
verwenden weiterhin physische Höhen und Hänge. Höhenfarben und Schattierungsmodus
bekommen keine zusätzliche Zeichnung. Der Höhenpinsel aktualisiert die sichtbare
Reliefableitung bereits lokal; die Bestätigung ersetzt sie durch kanonische Daten.

Instanzdaten und physische Matrizen bleiben beim Zoomen erhalten. Automatische
Kronen wachsen höchstens auf das Doppelte; geschützte Objekte bleiben maßhaltig.
Linien verwenden die [Kartenprominenz](../contract/atlas-cartography.md#kartenprominenz)
und halten im lesbaren Bereich mindestens 1,4 CSS-Pixel. Beschriftungen haben
einen hellen Saum. Export verwendet dieselben Materiallayer. Freigegebene
Spielerflächen verwenden die gemeinsame dekorative Waldtextur ausschließlich
auf offengelegten Polygonen, ohne private Materialkanäle zu erhalten.

Auswahl verwendet die sichtbare Geometrie, ihre Objektkennung und Verdeckung.
Transparente Autorenkonturen können bewusst auswählbar sein. Kontextverlust
entwertet GPU-Ressourcen und Treffer, wiederholt aber keinen Schreibauftrag.

## Ausgabe und Datenschutz

Ein Ausgabeauftrag friert Quellenstand, Kamera, Ausschnitt, Geschoss, Raster,
Maßstab, Vorlagen und Dateiformat ein. Gemischte Revisionen oder unvollständige
Quellen erzeugen keine vermeintlich vollständige Datei. Beschriftungen werden
über das gesamte Ausgabebild platziert, nicht unabhängig pro Bildkachel.
Die Komposition bleibt bei höherer Auflösung gleich; Texturen werden entsprechend
feiner. GPU-Zwischenbilder bleiben auf 1024 × 1024 Pixel begrenzt, das fertige
Bild darf bis zu 8192 Pixel Kantenlänge besitzen.

Öffentliche Ausgabe und Spieleranzeige erhalten nur ihre freigegebene Projektion.
Das Ausblenden von GM-Knoten im Renderer ersetzt diese Datengrenze nicht.
Nach Export und Abbruch müssen Werkzeuge, Menüs und Navigation weiter funktionieren.

## Prüfwege und offene Qualifikation

```sh
node build.mjs --test
npm run check
npm run check:desktop
npm run build:desktop
node tools/test-desktop-atlas-terrain-stroke.mjs --basic-tools --scale=1
node tools/test-desktop-atlas-terrain-stroke.mjs --recovery --source-conflict
QA_DRAWN=1 QA_EXACT_SCALE=1 node tools/test-desktop-atlas-multiscale.mjs
node tools/test-desktop-atlas-prominence.mjs
node tools/test-desktop-atlas-raster-workbench.mjs
node tools/test-desktop-atlas-cleanup.mjs
node tools/test-desktop-world-authoring.mjs
node tools/test-desktop-region-export.mjs
node tools/test-desktop-dungeon-groundplan.mjs
node tools/test-desktop-atlas-camera-coverage.mjs
node tools/test-desktop-atlas-mixed-workbench.mjs
node tools/test-desktop-player-map-reveal.mjs
```

Native Proben verwenden isolierte, erzeugte Testkampagnen. Verglichen werden
sichtbare Ergebnisse, erste Eingabereaktion, Folgezug, Undo/Redo und Wiederöffnung.
Die dichte Stadtprobe `tools/test-desktop-room-reads.mjs --regions --zoom=1`
erzeugt 5.000 Häuser über den gemeinsamen Fachwriter auf
trockenem Gelände. Einzelne SQL-Hauszeilen ohne Raumgruppen, Geschosse und
Eingangsbindungen bilden diesen Bestand nicht ab. Gebäude und Eingangsanker
teilen das Projektionsbudget; der Regionsleser wechselt vor dessen Überschreitung
auf begrenzte Bildgeometrie. Die Probe trennt bestätigte Rasterdaten,
Kameramaßstab und Dachpixel im nativen Bild. Stadtpapier ist keine Weltgeometrie;
Häuser unter zwei CSS-Pixeln werden nach der bestehenden Maßstabsregel ausgeblendet.
Die große Mischwelt prüft Last; kleine Szenen lokalisieren Fehler. Ein Link oder
eine Testanzahl belegt keine vollständige Produktabnahme. Tatsächliche Testdateien
und geprüfte Abläufe stehen im gemeinsamen Capability-Katalog.

Die begrenzte Welt-bis-Raum-Funktionsmatrix vom 29.10.2026 ist auf Produktstand
`8f18faf7995700bdb2f4320c2555118babc16c0d` bei 100 % und 200 % geprüft.
`tools/test-desktop-atlas-world-continuity.mjs` bindet eine gefüllte kanonische
Kampagne, Neigungen 0/45/75°, Welt → 10 m → Welt, kontinentale/lokale Edits,
Undo/Redo/Fresh, vier Biome, 2/8-mpp-Grenzen, physische Assetmaße und hohe
Weltkoordinaten. Der 100%-Nachweis setzt 32 frühere Teilkontrollen und 30 neue
Restkontrollen mit einem doppelt geprüften Einstieg zu 61 verschiedenen
Kontrollpunkten zusammen; er ist kein ununterbrochener neuer Lauf. Bei 200 %
bestehen alle 61 Kontrollpunkte in derselben neuen Kampagne. Die Fortsetzung
bindet identische SQLitebytes und History; die pfadabhängige Fence wird für die
neue Profilkopie ausdrücklich neu gebunden und innerhalb jeder Sitzung strikt
geprüft. Die Runtime ist gegenüber dem Produktstand bytegleich.

Belege: `.build/cycle3-point3/selective-reuse/remaining-qualification-binding.json`
und die dort gebundenen Quellen-, Frame-, Bild-, Lifecycle- und Ressourcenbelege.
Navigation/Fresh besitzen ein vorab festgelegtes 300-s-Funktionsbudget,
Edit/Undo/Redo 120 s, benötigte Produkte höchstens 60 s ohne Abschlussfortschritt.
Frühere Fehlversuche bleiben fehlgeschlagen. Die längste neue Framewartezeit
beträgt 161,913 s; bei 200 % wurden 18.288 `memory.high`-Ereignisse ohne OOM
aufgezeichnet. Alle acht Electron-Starts der beiden erfolgreichen neuen Läufe
und ihre isolierten KWin-Sitzungen enden normal. Dies ist keine Leistungs-,
Langzeitressourcen-, Gestaltungs-, Paket- oder Nutzerabnahme. Ein zusätzlicher
Einstiegsstop wegen des unzulässigen Fencevergleichs zwischen verschiedenen
Datenbankpfaden bleibt als Prüfhelferfehler separat erhalten.

Beim Rechteckabschluss unterscheidet `AtlasAuthor` Schreiben und bestätigte
Nachauswahl. Die Nachauswahl darf den Workspace-Flush passieren; Kameraeingaben
und automatisches Öffnen der Eigenschaften bleiben bis zum Abschluss gesperrt.

Automatische Regressionen für diese Darstellung liegen in
`tests/atlas/atlas-fantasy-cartography.test.mjs`, [atlas-prominence-editor.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/atlas/atlas-prominence-editor.test.mjs),
`tests/atlas/atlas-material-tiles.test.mjs`, `tests/atlas/atlas-surface-draft.test.mjs` und
[desktop-terrain-route-units.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/atlas/desktop-terrain-route-units.test.mjs). Die native Maßstabsprobe nimmt mit
`QA_DRAWN=1 QA_EXACT_SCALE=1` sechs Maßstäbe (2048, 128, 16, 4, 1, 0,25 m/Pixel), drei Neigungen
(0°, 45°, 75°) und 100 Prozent UI-Skalierung auf. `QA_PERF=1` misst Kameragesten;
`QA_EXPORT=1 QA_EXPORT_SIZES=1024,2048,8192` prüft gekachelte Ausgaben.
Messwerte und Bilder liegen im gewählten `QA_EVIDENCE_DIR`; die Zielwerte
p95 ≤ 33,3 ms pro Navigationsframe und ≤ 100 ms erste Pinselreaktion bleiben
getrennt von Funktionstests und visueller Eigentümerabnahme zu bewerten.
