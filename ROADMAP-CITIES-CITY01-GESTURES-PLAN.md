# CITY-01: Werkzeugadapter für direkte Stadtbearbeitung

## Auftrag, aktueller Stand und Grenze

CITY-01-PREP-P06 baut auf dem [reviewten CityDraft](ROADMAP-CITIES-CITY01-DRAFT-PLAN.md), [CityEdit](ROADMAP-CITIES-CITY01-EDIT-PLAN.md) und [CityScene](ROADMAP-CITIES-CITY01-SCENE-PLAN.md) auf. CTY-002.01 und CTY-002.02 verlangen direkt bearbeitbare Straßen und Häuser in derselben Atlasfläche. Vollständige Zeichnung, Anlage, Entfernung, Auswahl, Speicherung und sichtbare Bedienabnahme bleiben Pflicht des [CITY-01-Anschlusses](ROADMAP-CITIES-CITY01-INTEGRATION-PLAN.md); dieser Adapter allein schließt keinen CTY-Fall.

Quellaudit: AtlasEditor besitzt derzeit nur select/hand/TerrainTool, bindet Pointercapture und zeichnet Terrainpreview. AtlasRenderer besitzt eine gemeinsame Kamera, worldPoint und detailLayer, aber keinen City-Zeichen-/Detail-Lifecycle-Anschluss. Keine neue Atlas-API als bereits vorhanden ausgeben. Die bestätigte Grenze bleibt: Der spätere gemeinsame Router komponiert Stadtplatzierung und Atlaskamera und liefert **stadtlokale Meterpunkte** an den Adapter. Projektionscallbacks, Kamera, Pointer-ID, Capture, Werkzeugauswahl und UI bleiben beim Router. Die vorhandenen Atlasdateien werden in diesem Paket nicht geändert; aktuelles Save/Draft-Paket und exklusiver Host des Hexbesitzers bleiben erhalten.

Vor I06 eingehende Router-/Detailverträge abgleichen. P06 schlägt `src/features/city/gestures.ts` und `tests/core/city-gestures.test.ts` vor, mit Import im vorhandenen Testeinstieg. Gemeinsame Hausposepunktrechnung wird nur in `city/geometry.ts` ergänzt; keine Änderung an der Dungeonwurzel `src/geometry.ts`.

## Öffentlicher Vertrag

`CityGestureTarget` ist eine readonly diskriminierte Zieladresse:

| kind | weitere Felder | Wirkung |
|---|---|---|
| move-node | ownerId, nodeId | Gemeinsamen Straßenknoten bewegen; alle referenzierenden Kanten behalten IDs. |
| move-road-point | ownerId, roadId, viaIndex | Genau einen vorhandenen Via-Punkt bewegen, restliche Straße und Endknoten erhalten. |
| move-building | ownerId, buildingId | Haus bewegen, Grundriss/Poseanteile/Verweise erhalten. |
| rotate-building | ownerId, buildingId | Um die Mitte des lokalen Außenkontur-Bounds drehen. |
| scale-building | ownerId, buildingId, axes: both/x/y | Achsenskalierung an derselben Mitte; unskalierte Achse unverändert. |

Owner muss exakt source.id entsprechen, Ziele müssen im **Gestenanfangsstand** existieren und zur Art passen. viaIndex muss eine vorhandene ganze nichtnegative Position sein. Adresse und Anfangspunkt sind eigene gefrorene Kopien; keine Callerobjekte frieren. Unbekannte Felder/Tags, falsche Kennungen, berechnete Felder und nichtendliche Punkte vor Fachzug ablehnen; Accessors nicht ausführen. Nur die schmale Ziel-/Punktgrenze prüfen, keine zusätzliche CityDocument-Validierungskopie. Vor Umsetzung vorhandene City-Eingabeprüfungen zur gezielten Wiederverwendung prüfen; keine neue allgemeine Validierungsbibliothek.

`new CityGesture(source, target, startPoint)` erzeugt einmal CityDraft, bindet dessen before und findet das Ziel einmal. Fehlende Ziele oder degenerierte Dreh-/Skalierhebel erzeugen eine verständliche Ablehnung ohne Source-/Historyänderung. Die Klasse besitzt keine eigene zweite Zustandsmaschine:

- readonly target, before, state, preview delegieren an stabile Adresse beziehungsweise den einen Draft.
- `update(point): CityDraftPreview` rechnet eine finale CityEdit aus **Anfangspose und Anfangspointer**, niemals aus dem letzten Kandidaten. Vor der Rechnung `draft.clearPreview()`: Closed-Prüfung geschieht dadurch zuerst; Rechen-/Punktfehler lassen keine vorige übernahmefähige Vorschau bestehen. Bei Rechenfehler ist editing/null ausreichend, bei editCity-/Szenenfehler invalid/null. Gültige Folgeupdates dürfen sich erholen.
- `apply(label): boolean` und `cancel(): boolean` delegieren unverändert an CityDraft. Kein Auto-Apply, Retry/Rebase, zweiter Commit oder eigener Stack. Der Router kann auf Pointer-Up ausdrücklich Apply wählen, auf Escape/Pointercancel/Blur Cancel.
- before ist genau der einmalige Draftbeginn. Der Adapter registriert/hydriert keine CitySource und erzeugt keine IDs. Mehrere Dokumentbesitzer bei späteren Gebäudebindungen brauchen einen gemeinsam gebauten AtlasCommand; nicht stillschweigend nur diesen CityOwner committen.

Zeichenaktionen bleiben vollständige `add-road`/`add-building`/`add-plaza`-Edits am vorhandenen CityDraft; rohe offene Konturen gehören zum Router und werden erst bei gültigem ausdrücklichem Abschluss materialisiert. Löschen benutzt vorhandene CityEdits und einen Draft. Diese Aktionen weder als vom Transformadapter implementiert ausgeben noch aus dem CITY-01-Umfang entfernen.

## Geometrie und natürliche Griffe

Gemeinsame Punktpose als `CityBuildingPose = Pick<CityBuilding, position/rotationRadians/scale>`, `cityBuildingPoint(pose, buildingLocalPoint)` und `cityBuildingLocalPoint(pose, cityPoint)` aus vorhandenem Hausposecode ableiten. Vorwärts bleibt Scale→Rotate→Translate, inverse Translate→inverse Rotate→inverse Scale. Positive finite Achsenskalierung, finite Pose/Punkte und finite Resultate prüfen. `cityBuildingOutline` verwendet dieselbe Vorwärtsprimitive für Außenkontur und Löcher; Codec und Scene bleiben auf demselben Helfer. Bestehende Outline-Werte und Fehlergrenze erhalten, keine separate Poseformel in gestures.ts. Private Hilfsstruktur nur bei tatsächlichem Bedarf, keine Matrixbibliothek oder gespeicherter Atlastransform.

Hauspivot: Mitte des untransformierten Außenkontur-Bounds (Innenhöfe ändern sie nicht). Mittelpunkt über halbierte Min/Maxwerte berechnen, damit ein unnötiger Min+Max-Überlauf vermieden wird. Pivot über gemeinsame Punktpose nach Citymetern transformieren. Dreh-/Skaliervorschau berechnet neue Position so, dass derselbe Pivot bei neuer Pose fest bleibt; die Verschiebung ergibt sich aus `cityBuildingPoint` mit Nullposition. Numerisch nicht darstellbare Endpose scheitert kontrolliert und löscht Vorschau. Gleicher Anfangspointer und unveränderte relevante Dreh-/Skalawerte verwenden die ursprüngliche Pose direkt; eine unnötige Pivotrückrechnung darf keinen Rundungs-No-op als Änderung übernehmen. Bei x/y gilt dies auch für Bewegung ausschließlich auf der ungewählten Achse.

- Bewegung: ursprüngliche Zielposition plus current-start. Hauspose/Skala, Knoten-/Straßenkennungen und alle anderen Punkte bleiben erhalten. Initialpunkt kann innerhalb des Hauses liegen; kein Sprung auf dessen Ursprung.
- Drehung: Anfangs-/aktueller Cityvektor um Pivot müssen finite und ungleich null sein. Winkeldifferenz aus atan2-Winkeln, periodisch normalisiert; ursprünglichen Winkel addieren. Gleicher Pointerpunkt liefert exakt unveränderte Anfangspose. Keine Akkumulation und keine Abhängigkeit vom Zoom.
- Skalierung: Anfangs- und aktuelle Pointerpunkte über gemeinsame inverse **Anfangspose** in Hauskoordinaten ausdrücken, vom lokalen Pivot abziehen. Für jede gewählte Achse Verhältnis aktueller/anfänglicher Komponente auf die ursprüngliche Achsenskalierung anwenden. Jeder benötigte Anfangshebel muss ungleich null sein; Endratio muss positiv und finite sein. both erlaubt unabhängige Achsen; x/y erhalten die andere Achse exakt. Keine Spiegelung, stille Klemmung oder Annahme, dass negative Koordinaten ungültig sind. Auf der falschen Seite des Pivots ist der Kandidat ungültig; Rückbewegung kann korrigieren.

Sichtbarer Anschluss nach HEX-05: Drehgriff und Eck-/Achsgriffe bleiben in Bildschirmpixeln bequem treffbar; der Router trifft nur sichtbare Griffe und liefert das zugehörige lokale Ziel. Zahlenfelder für Position/Winkel/Meterabmessungen verwenden dieselben validierten Endedits. Keine Pflicht für Modifier-Mausrad; bessere Bedienung muss später an gepaarten Aufgaben und realer Maus-/Touchpadbedienung geprüft werden.

## Routerregeln und noch fehlende Integration

1. Pointer-Down trifft dargestellte CityScene/Griffe vor Hexhintergrund und bindet Source, Owner, Element und Werkzeug. Kein erneutes Hit-Testen auf jeder Bewegung, kein Zielwechsel beim Zoom.
2. Jeder neue lokale Punkt stammt aus der **aktuellen** gemeinsamen inverse Projektionskette. Pan/Zoom verändern die Kamera, erhalten aber Adresse/Draft und Anfangspose. Keine zwischengespeicherte zweite Kamera oder Pixel-zu-Meter-Konstante im Adapter.
3. Nach Update zeichnet der gemeinsame Detailrenderer preview.scene. preview=null entfernt Overlay und zeigt aktuelle CitySource, nie automatisch before. Meldung unterscheidet unvollständige Zeichnung, ungültige Geometrie und echten Apply-Konflikt.
4. Pointer-Up übernimmt nur gültigen vollständigen Zug einmal. Cancel/Blur/Escape verwerfen Citypreview. Terrain-Escape hat derzeit bewusst eine andere Originalwirkung (finishStroke); diese nicht pauschal für City übernehmen oder verändern.
5. Nach Apply/Cancel Werkzeug und Auswahladresse erhalten; terminale Adapterreferenz freigeben. Gemeinsames Undo/Redo bleibt derselbe AtlasHistory-Stack. Geschlossene Adapter nehmen keine weiteren Updates an.
6. Router-/Detail-Lifecycle, Sichtbarkeit/Hit-Toleranz, Capture/Focus, gemischte Owner, Parentplatzierung und Mehrdateispeicherung sind ausdrücklich echte Anschluss-/Hostarbeit. I06-Coretests behaupten dafür keine Abnahme.

## Bedeutungsvolle Prüfungen und getrennte Läufe

- Vor I06 bestehenden Outlinehelfer samt Quellhash als externes Modul sichern und echte Konturwerte/Fallgrenzen vor/nach Extraktion vergleichen. Vorwärts/inverse Punktpose auf asymmetrischen, gedrehten/ungleich skalierten Häusern; Außenkontur und Hofwerte vor/nach Extraktion erhalten. Große/negative Meter, Millimetergrundriss, Überlauf und nichtendliche Werte kontrolliert. Nicht passende Dungeon-Posehelfer unverändert.
- Hausbewegung aus innenliegendem Anfangspunkt ohne Sprung/Drift; mehrere Updates letzter absoluter Wert, keine Source-/Historymutation bis Apply, ein Undo/Redo. Fremde Payloadmutation unwirksam.
- Knotenbewegung am echten T-Kreuz; Via-Punktbewegung erhält Endknoten und andere Punkte. Kollabierte Straßenlänge ungültig und alter Kandidat nicht übernahmefähig; korrektes Folgeupdate möglich.
- Drehung um tatsächlichen Hauspivot, Hof und asymmetrische Kontur bleiben metrisch korrekt; Achsenskalierung both/x/y erhält Pivot und unberührte Achse. Gleicher Anfangspunkt ist No-op und erhält Redo. Degenerierter Hebel vor Beginn abgelehnt, Gegen-/Null-/Überlaufskalierung während Zug löscht alte Vorschau.
- Ungültige Zielart/Owner/viaIndex, unbekannte Felder und Accessors vor Seiteneffekt ablehnen. Fehler bei Pointerprüfung oder Rechenphase löscht vorige Vorschau; closed bleibt closed. Cancel nach fremdem Citycommit restauriert nichts, Apply stale schließt failed; fremde Terrainaktionen bleiben in derselben Historyfolge.
- Bestehende AtlasCamera-Funktionen nur im Test: projizieren/unprojizieren bei Pan, Zoom und verschiedenen Viewports liefert lokale Eingaben für denselben gebundenen Zug. Das prüft den Adaptervertrag, keine echte Parentplatzierung oder sichtbare Kamera-/UIwirkung.

I06 mit check/test/build und externe Quellen-/Outlinebaseline; danach eigener R08, nötige N/R, anschließend eigene Aufräum-P/I/R. Vor I06 Plan-Aufräum-P/I/R: Verträge und numerische Grenzen prüfen; keine unbewiesenen vorhandenen Atlasanschlüsse, zweite Zustandsmaschine, Posekopie oder still entfernte Zeichen-/Hostpflicht. Alle 24CTY/65CO bleiben offen. Belege unter `/home/aaron/.cache/dungeon-native-qa/city-plans/city01-tools-20261009/`.

## Plan-Aufräumen: P06

CITY-01-PREP-GESTURES-PLAN-CLEAN-P06 Start 2026-10-09T17:58:04.402275+00:00. Planprüfung findet eine konkrete numerische Präzisierung: Aus neuer Pivotpose zurückgerechnete Position kann trotz unveränderter Drehung/Skala Rundungsreste erzeugen und einen No-op in einen Historybefehl verwandeln. Umsetzung muss gleiche Anfangseingabe und unveränderte relevante Poseanteile unmittelbar mit ursprünglicher Pose beantworten; keinen Pivot unnötig neu berechnen. Ebenfalls prüfen: Fehler vor editCity löscht Kandidat durch vorgelagertes clearPreview, inverse Rotation/Scale bleibt nur im gemeinsamen Cityposehelfer, x/y verändert ungewählte Achse nicht. Ein Quellbaselinevergleich schützt Outlinearithmetik. Unvollständige Zeichnung und Hostpflichten bleiben im Anschlussplan. Diese Präzisierungen in getrennter CI übernehmen und danach gegen Quelle/Beispielarithmetik reviewen; keine Runtimeänderung im Plan-Aufräumen.

## Aufräumplan nach I06/R08

CITY-01-PREP-GESTURES-CLEAN-P06 Start 2026-10-09T18:07:41.308842+00:00. Vorhandenen Gesture-/Punktposekern in ARCHITECTURE kennzeichnen, sichtbaren Router weiterhin als fehlend führen. CITY-GESTURE-R08-01 bleibt dabei offen: inverse Punktpose erzeugt rundungsbedingte relevante Achsenreste. N06 soll im gemeinsamen Cityposemodul `cityBuildingLocalPrecision(pose, cityPoint)` als konservative lokale Rundungsschätzung liefern: 8 × Summe der mit Number.EPSILON gewichteten Absolutwerte von Pointer- und Poseposition, je Achse durch positive Anfangsskala geteilt. EPS zuerst multiplizieren, damit die Summe nicht unnötig überläuft. Keine feste Meter-/Pixelklemmung und kein UI-Snapping. Anfangs-/aktuelle Fehleranteile bestimmen, ob eine Achskomponentendifferenz numerisch auflösbar ist; unveränderte Komponente übernimmt exakte Originalskala. Spiegelung/Nullratio vor No-op-Behandlung prüfen, unauflösbaren Anfangshebel vor Zug ablehnen. Tests für gedrehte x/y-No-ops mit Redo, beide Achsen, negative Hebel, Null/Spiegelung, große Lage, Millimeter und echte Änderung über der Rundungsgrenze. Getrennte Aufräumumsetzung dokumentiert dies; Review prüft Quelle/Plan, dann N06.
