# E2E-01-SPACE-P01: Ort, Stadt, Haus und Dungeon im selben Atlas

Eigener begrenzter Planlauf, 10. Oktober 2026. Basis ist der veröffentlichte
gemeinsame Kandidat PR #13 auf `3bfa5110139a53dc5d8f1d2a29ae9962e977838b`.
Der ratifizierte Gatekatalog bleibt unverändert auf `cc93c31870f461527b2f8953fe88e433dada7cd1`.
Dieser Plan konkretisiert den noch fehlenden räumlichen Eingang der
[E2E-01-Nutzerzeile](ROADMAP-E2E-GATES-CANDIDATE.md#e2e-01--kampagne-und-gemeinsamer-raum--saverestart),
Zeile 13. Er ist keine neue Gesamtrunde oder Fachratifikation. Produktcode, GUI,
Fixturepayloads und Installation werden in diesem Lauf nicht verändert.

## Zuerst benutzbar werden

Das nächste sichtbare Ergebnis ist: Vorhandenen nativen Stadtplan am Ort und
Dungeon am Haus verankern → allein hineinzoomen → Straße/Haus verschieben und
Raum-Key bearbeiten → herauszoomen → gemeinsame Undo/Redo-Folge → Save → neuer
Obsidianprozess. Ein Editor, eine Kamera, ein Werkzeugzug und eine History.
Bestehende Karten werden dafür nicht neu erzeugt. Der erste Durchlauf benutzt
den gelieferten Stadtplan, nicht einen vorgezogenen Stadtgenerator.

Der Quellenanschluss ist bereits geprüft: tatsächlicher AtlasRepository,
CitySource und DungeonAtlasSource teilen eine History; sieben native Snapshots
werden durch Undo/Redo bytegenau wiederhergestellt. Stadt ist dort noch ein
ausdrücklicher No-op. Der fehlende neue Pflichtgegenstand ist **persistierte
Verortung plus ausgeführte gemeinsame Zeichnung/Bearbeitung/Speicherung**.
Weitere allgemeine Framework-, Komfort- oder Paritätsarbeiten kommen nicht vor
dem ersten nativen verbundenen Ablauf.

## Tatsächliche Eingänge und Grenzen

| Vorhanden                                        | Folgerung für den Anschluss                                                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TerrainSource`, LocationSource, AtlasHistory    | Worldowner bleibt derselbe; Welt-/Orts-/Geländeänderung nutzt dieselbe atomare Before/After-Grenze.                                                                                               |
| `CitySource`, `cityDocumentChange`, CityGesture  | City-v1-Metergeometrie und fachliche Kennungen bleiben erhalten. Apply führt bereits genau einen Historycommit aus.                                                                               |
| `cityScene`, `hitCity`, CityRenderer             | Der Atlas liefert präzise Projektions-/Inversefunktionen und Bildschirmtoleranz, montiert einmal und zeichnet vor seinem Render.                                                                  |
| DungeonAtlasSource, `dungeonDocumentChange`      | Native V4-Bytes sind die Dungeon-/Key-Wahrheit. Keine Session-History und keine dauerhafte `Session.revision` daneben.                                                                            |
| AtlasRepository, Draft v1/v2, FileTransaction v1 | Aktuell nur World/Terrain/Locations in Snapshot und Datei-/Entwurfsstrecke. City-/Dungeonbytes müssen wirklich aufgenommen werden.                                                                |
| `MapRenderer` und DungeonEditor                  | Besitzen heute Application/Kamera beziehungsweise schreibende Session. Sie sind nicht als zweite Editorinstanz einhängbar; reine Zeichnung und Fachbefehle müssen ausdrücklich abgetrennt werden. |
| CampaignLifecyclePort                            | Unterstützt heute `create`/`rename`, nicht einen bestätigten Mehrowner-Atlas-Publish. Der angenommene Kern liefert noch keinen Vault-/Campaign- oder Complete-Importbeleg.                        |

Die neue vorgeschlagene Format-, Transform- und Speichergrenze steht ausschließlich
in [ARCHITECTURE.md](ARCHITECTURE.md#vorgeschlagener-konkreter-raumvertrag-e2e-01-space-p01).
Namen dort sind vorgeschlagene Schnittstellen, keine heute vorhandenen APIs.

## Kleine Umsetzungsschnitte mit unmittelbaren Toren

| Schnitt                                     | Konkretes Ergebnis                                                                                                                                                                                                         | Direkt erforderlicher Nachweis                                                                                                                                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I01a – räumliche Speicherbasis**          | V2-Worldbindings, relative Transformkette, prospektive Graphprüfung und wirkliche City-/Dungeon-Owneraufnahme in Snapshot/Draft/Save/Copy/Discard/Recovery. Ein unveränderter Altatlas bleibt unverändert.                 | Native codecs und echte Repositorydateien: Ankoppeln, Ort/Haus bewegen, Undo/Redo, unterbrochenes Save, externer Konflikt, Copy-Closure und frisches Repository; Präzisionsgegenprobe unten. Noch kein sichtbarer Atlas-PASS.           |
| **I01b – unmittelbar sichtbarer Anschluss** | Citycontainer und erste native Dungeon-Raumzeichnung im vorhandenen Frame, Zoomdarstellung, Hitrouter, bestehende Stadtgesten und Source-basierter Raum-Key. Verankern nutzt denselben Atlas; keine Betreten-/Modusaktion. | Vor der nächsten Fachgruppe echte isolierte Obsidianprobe: vollständige sichtbare Folge aus dem ersten Absatz einschließlich Hausbewegung, Escape, gemeinsamen Undo/Redo, Save und einem neuen Prozess. GUI-Slot zuvor neu vereinbaren. |
| **I01c – verbleibende Pflichtintegration**  | Dungeon-Geometrieaktionen über reine fachliche Changes, bestätigter Campaign/Vault-Context, persistierte Command-/Receiptgrenze und echte P02/P04-Importvariante; Katalogreferenzen aus tatsächlichen Ownerlieferungen.    | Exakte Reviewinputs und festes erweitertes Fixture; erst danach unabhängiger integrierter Code- und Hostreview nach #12. Fehlende Ownerlieferung bleibt offen, nicht durch Platzhalter verdeckt.                                        |

I01a und I01b sind aufeinanderfolgende begrenzte Läufe desselben Kandidaten, keine
parallelen Lieferpläne. Nach I01a wird als Nächstes I01b ausgeführt, sofern kein
konkreter blockierender Befund zuerst zu reparieren ist. Ein langer Ausbau der
Abstraktionen zwischen beiden ist ausdrücklich nicht der Plan. I01c wird nicht
zu E2E-02–04 erweitert. Review, Nachbesserung und abschließendes Aufräum-P/I/R
bleiben getrennte Läufe; eine passende Fachprüfung ersetzt kein Gesamttor.

## Sichtbarer Frame und Eingabe

- Source einmal je Dokument und History-Lebensdauer registrieren. Grafikcontainer
  dürfen unsichtbar werden oder freigegeben werden; Dirtyowner und Historywerte
  dürfen durch Zoom/Entladen nicht verschwinden. Geladene Childsources nach
  Discard gemeinsam an die neue History binden, alte Responses per Generation
  zurückweisen. Frühere Kamera/gewähltes Werkzeug bleiben erhalten.
- City- und Dungeonzeichnung erfolgen im `detailLayer` vor `Application.render()`.
  Der heutige nachgeschaltete `changed()`-Callback ist kein Zeichenhook. Eine
  Application, ein Resizepfad und ein Frame-Scheduler reichen aus.
- Gemeinsame sichtbare Reihenfolge: Landschaft → Stadtaussenflächen/Häuser →
  eingeblendete Dungeonräume → Auswahl/Griffe/Ortsmarkierung. Der tatsächliche
  Trefferrouter geht dieselbe Folge rückwärts. Innenhöfe bleiben transparent.
  Nur gezeichnete Griffe treffen; tolerierte Kanten werden in Bildschirmnähe
  geprüft. Der erste äußere Citytransform ist starr, sodass Citys Kreis-Toleranz
  exakt in Meter umgerechnet werden kann. Kein nicht gleichförmiger
  Elterntransform, der diese Annahme still verletzt.
- Zoom blendet Dächer aus und Räume ein, mit Hysterese nach projizierter Größe.
  Es wechselt weder Dokumentwahrheit, Werkzeug noch Kamera und verschiebt keine
  Geometrie. Zeichnung und Hit verwenden dieselbe Darstellung/Transformkette.
  Ein begonnener Zug behält Ziel und Beforewerte über einen Detailwechsel.
- Pointerup übernimmt eine gültige Vorschau einmal; Escape/pointercancel/blur
  verwerfen den laufenden unbestätigten Zug bei allen neuen räumlichen Gesten.
  Die heutige Terrain-Abschlussregel muss beim Anschluss ausdrücklich angepasst
  und regressionsgeprüft werden. Save/Flush beenden einen gültigen Zug einmal
  und sichern ihn; invalide oder stale Vorschau bzw. Keytexte bleiben sichtbar
  erhalten und blockieren Wechsel/Discard. Nach gewonnenem Publish ist ein
  Interrupt kein rückwirkendes Cancel.
- Ein Key-Adapter liest/schreibt den tatsächlichen DungeonAtlasSource-Stand und
  verwendet `dungeonDocumentChange`. Zuerst Raumname/Nummer und Markdown mit
  bestehenden Abschnitts-IDs; Passageabschnitte bleiben erhalten. Die spätere
  vollständige Dungeon-Werkzeugprojektion darf keine schreibende Session als
  Zwischenstufe benutzen. Nicht angebundene Gesten werden nicht als funktional
  ausgewiesen.

## Festes räumliches Orakel statt passend skalierter Bilder

**Konkreter neuer Fixturebefund:** Haus A im gelieferten Cityseed ist 4 × 6 Meter.
Der Dungeon-Torraum liegt von `(4,4)` bis `(14,12)` in Fünf-Fuß-Feldern, also
**15,24 × 12,192 Meter**. Ein stilles Anpassen des Dungeonmaßstabs an das kleine
Haus wäre falsch. Die bisherigen v1-Dateien und Hashes bleiben eingefroren.

Für das nächste explizite integrierte Fixture-v2 wird vorgeschlagen, Haus A mit
denselben IDs über die vorhandenen CityEdit-Aktionen auf 15,24 × 12,192 Meter
zu setzen und auf `(-18,8)` zu verschieben. Haus B und sein Hof bleiben erhalten;
damit überlappen die beiden Häuser nicht. Dungeonbytes, Raum/Key/Floor/Route-IDs
bleiben erhalten. Hauslokaler Ursprung `(0,0)` und Dungeonpunkt `(4,4)` werden
explizit ausgerichtet, ohne aus der Entrance-Route eine physische Tür zu erfinden.
Die [konkrete City-Fachantwort #7/6091472576](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/7#issuecomment-6091472576)
bestätigt diese Hausgeometrie/Pose und ihre Materialisierung durch Hex mit nativen
CityEdit-Aktionen. Die [Dungeon-Fachantwort #12/6091516581](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6091516581)
bestätigt den Dock-/Floor-/Route-/Keyteil und dasselbe v2-Orakel. Damit sind diese
engen fachlichen Eingänge bestätigt; der vollständige neue Oraclebestand ist noch
nicht materialisiert. Die eingefrorene Bereichsfixture wird dadurch nicht geändert.

Bei der späteren Materialisierung werden Grundriss und Pose über zwei aufeinander
folgende reine `editCity`-Aufrufe berechnet: Das bestehende API verbietet zwei
Schreibaktionen auf dieselbe Haus-ID in einem Aktionspaket. Erst der vollständige
Endstand wird mit dem ursprünglichen Before über einen `cityDocumentChange`
übernommen; kein Zwischenstand wird veröffentlicht und kein zweiter Historycommit
benötigt. Das ist eine aus dem tatsächlichen API gelesene Anschlussvorgabe, noch
keine ausgeführte v2-Materialisierung.

Die aktive Version wird erst nach konkreter Ownerbestätigung und Materialisierung
der vollständigen v2-Input-/Expectedbytes und SHA-Liste atomar umgestellt.
`e2e01-component-closure-v1` bleibt bis dahin die eine aktive eingefrorene
Zwischenbelegversion. Kein zweiter live geladener Satz derselben Dokument-IDs.
Dungeonfläche muss im Allgemeinen nicht im Haus liegen: Keller/Höhlen dürfen
ausgreifen. Die Deckungsgleichheit ist ein gezieltes Orakel dieser Testkarte,
keine universelle Größenbeschränkung.

## Passende Prüfungen, früh und getrennt

1. **Relative Präzision:** Weltanker und Kameraanker `1e16`, `0,01 m/px`,
   Stadtpunkt `(0,01,0,01)` → genau `(1,1)` Pixel relativ zur Mitte und korrekt
   zurück. Danach ein Pixel Pan und Zoom am Pointer. Auch negative Anker,
   Rotation, Hauspose und native 1,524 Meter pro Dungeonfeld prüfen. Nicht erst
   absolute Weltposition bilden und dann den Kameraanker abziehen.
2. **Echte Prospektivprüfung:** Cityhaus entfernen, während ein Dungeon daran
   gebunden ist; Child unbekannt/mehrdeutig/fremd; Route/Floor/Room falsch;
   gleiche Schreibziele und stale Before. Jede Ablehnung erhält alle Owner,
   Redo und Datei-/Keybytes. Preview benutzt dieselbe Prüfung wie Apply.
3. **Speicherclosure:** World, Terrain, Locations, City und Dungeon in einem
   Repositorysave; Copy remappt die tatsächliche gesamte lokale ID-/Referenz-
   Closure. Ungeladene Karten bleiben erhalten. Unbekannte Fremdkeys erhalten
   ihre sichtbare Fehlergrenze statt kopierter Ersatzpayloads.
4. **Fehler/Neustart:** Save während weiterer Keybearbeitung, Dirtyowner beim
   Entkoppeln, externer City-/Dungeonkonflikt, unterbrochenes Journal, Copy ohne
   Zielroot, Discard/Contextwechsel während Load. Quelle, fremde Texte und
   resumable Evidenz bleiben erhalten; committed wird nur vorwärts abgeschlossen.
5. **Gemeinsame Darstellung:** Empty/City-only/ferne City/mischtes Fit, Höfe,
   konstante Griffe, Resize und große negative Position. Dach und Raum bleiben
   vor/nach Zoom deckungsgleich, Pan/Zoom allokieren keine Native-Dateien.
6. **Erster nativer Ablauf:** Haus bewegen → verorteten Raum hineinzoomen →
   Keytext mit CRLF/Unicode verändern → herauszoomen → Hex verändern → Undo/Redo
   → Save → normal beenden → frischer Prozess, dieselben IDs/Bytes/Posen prüfen.
   Sichtbare Originalbilder prüfen; keine GUI-Freigabe aus einem Coretest.

Plan-/JSON-/Verweis-/Diffprüfung in diesem Lauf. Schlanke check/test/build und
die gezielten Fehlerfälle bei tatsächlichen Produktänderungen. Physische
Eingabe, große Welt, Originalparität, Zielhost und Installation bleiben eigene
Nachweise. Vollständiges E2E-01 erhält weiterhin die unveränderten harten
Campaign-/Katalog-/P02/P04-Eingänge, keine positive LiveSession-Abhängigkeit.

## Konkrete Ownerantworten und verbleibende Eingänge

| Owner         | Enge Eingangsfrage; keine allgemeine Sammelrunde                                                                                                                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stadt         | Bestätigt durch [#7/6091472576](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/7#issuecomment-6091472576) auf `a86a3a4`: starre Cityplatzierung, skalierter Hausdockpunkt ohne Dungeonverformung und neue v2-Hausgeometrie/Pose. Entfernung gebundener Häuser braucht prospektive Ablehnung oder atomare Entkopplung. Keine erneute City-Prüfrunde ohne neuen konkreten Diff/Befund. |
| Dungeon       | Bestätigt durch [#12/6091516581](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6091516581) auf `a86a3a4`: Dock `(4,4)` ↔ Hausursprung, 1,524 m/Feld, Floor32/Room31/Entrance-Route33/Key34 und direkte Source-Keyänderung ohne schreibende Session. Route33 bleibt semantisch. Der schreibfreie Geometrie-Gestureport für I01c bleibt offen und sperrt den ersten Raum-/Keyanschluss nicht; sein getrennter Ownerplan steht in [`ROADMAP-E2E01-DUNGEON-GEOMETRY-PLAN.md`](ROADMAP-E2E01-DUNGEON-GEOMETRY-PLAN.md). |
| Campaign/Data | Für den späteren echten Publish: ausführbare versionierte World-/Domain-Ownershipprojektion, Bindung an aktuellen Context und Semantik eines räumlichen Mehrownerwrites/CampaignRevision liefern. `create`/`rename` wird nicht dafür missbraucht; trusted Remapregistry kommt unabhängig von den gelieferten Inventories vom zuständigen Owner.        |

Hex übernimmt diese Antworten nicht stellvertretend. Die tatsächlichen engen
City-/Dungeon-Antworten sind in E2E-01-SPACE-R01 gegen Vertrag, native Quellen und
Fixturebytes geprüft; I01a darf beginnen. Fehlende spätere
Campaign-/Importeingänge verhindern keine entsprechend begrenzte räumliche
Probe, sperren jedoch den Gesamt-PASS. Ein konkret neuer Pflichtbefund wird
gezielt nachgebessert. Aufräumen ist ein eigener anschließender P/I/R-Zyklus,
kein versteckter Zusatz dieses Planlaufs.
