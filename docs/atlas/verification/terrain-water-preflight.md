# Terrain und Wasser: Ausgangslage und Lösungswahl

Status: Istprüfung abgeschlossen; Lösungsweg in Planbasis v1 übernommen, native Nutzbarkeit und Leistungsabnahme offen.
Owner: atlas
Last Reviewed: 2026-10-25
Source of Truth: Befunde und Lösungsabwägung für die begrenzte Terrain-/Wasseretappe.

Der bestätigte Umfang steht ausschließlich im
[aktuellen Lieferfokus](../requirements/terrain-relief.md#aktueller-lieferfokus-terrain-und-wasser).
Die Intention ist ausreichend geklärt. Dieser Befund besitzt die Ausgangslage;
Pakete, Zeitplanung und Planreviews stehen im
[Umsetzungsplan](../architecture/terrain-water/plan.md).

## Was ist vorhanden, was fehlt?

| Bereich | Aktueller Anschluss | Lücke für den Lieferfokus |
| --- | --- | --- |
| Grundpinsel | `terrain-brush.ts`, `landscape-tool-settings.ts`: Anheben, Senken, Aufrauen, Glätten und gewünschte Parameter. | Native Erreichbarkeit, sichtbare Wirkung und Leistung am tatsächlichen Host qualifizieren. |
| Spezialpinsel | Vorlagen Hügel/Berg/Tal/Schlucht ändern Grundpinselparameter. | Zusammenhängende Hügelverteilung, Bergrücken/Hänge und Schluchten entlang gemalter Züge fehlen. |
| Direkte Bearbeitung | `landscape-brush-session.ts`, `atlas-surface-draft.ts`, `terrain-stroke-queue.ts`: lokale sichtbare Änderung während der Geste, kanonisches Speichern beim Loslassen. | Sichtbares und gespeichertes Resultat bei Glätten und neuen Formen über Kachel-/Detailgrenzen vergleichen. Der interne Name „preview“ erfordert keinen Vorschauschritt in der Bedienung. |
| Meer | Meeresspiegel-Einstellung und Ableitung aus Höhe sind vorhanden. | Insel/Küste direkt bearbeiten, Wasserstand ändern und Neustart nativ prüfen; keine Seen-/Flussarbeit ergänzen. |
| Kamera | Produktpfad: `CampaignAtlasWorkbench` → `AtlasCanvas` → `AtlasRasterPresentation` → `AtlasDeckSurface` mit `externalInput:true`. Mausrad zoomt weich, mittlere Taste/Handmodus schiebt; Neigung/Drehung per Mausregler. | Direkte Dreh-/Neigegeste und optionales WASD im Host ergänzen. Die deaktivierten Deck-eigenen Handler sind dafür kein Produktnachweis. |
| Maßstäbe/LOD | Numerische Zoomspanne bereits von 0,1 m Ansichtsbreite bis zur Erdübersicht; begrenzte Kacheln, Fokusverfeinerung und gemeinsame Höhe-/Materialwechsel. | Durchgehender Welt-bis-Raum-Zoom mit stabilen Küsten, Silhouetten und Kachelrändern ist nativ offen. Atomarer Kachelwechsel allein beweist keinen weichen Formübergang. |

Beim Schieben/Zoomen verwendet der Host derzeit die Fokushöhenebene; der Pinsel
trifft das wirkliche Gelände. Ein stabiler Zoomanker am hohen Berg ist deshalb
gezielt zu prüfen. Während einer gehaltenen Pinselgeste sind Kamera und
Trefferflächen absichtlich eingefroren. Die Leistungsabnahme muss Nachladung
und Navigation zwischen Gesten von dieser bewussten Gestenzuordnung unterscheiden.

## Prüfung dieses Arbeitsstands

Basis: `a2a3c4f92a66fd28f5d348c5eaab3a04fcaa8c99` mit vorhandenen lokalen Änderungen,
Node 22.22.0, nativer Wayland-Host. Fremde Änderungen wurden nicht bearbeitet.
`npm run build:desktop` und die Testvorbereitung `node build.mjs --test` bestanden.

32/32 gezielte Tests bestanden, verteilt auf:

- `tests/terrain-brush.test.mjs`: Grundoperationen, Aufrauen/Roughness, Zeitintegration,
  Korrekturen, Speicherung, Undo/Redo und frische Öffnung.
- `tests/atlas-surface-draft.test.mjs`: lokale Folgegesten, Küstenänderung und Kachelquerung.
- `tests/terrain-stroke-queue.test.mjs`: Reihenfolge, eigene Gestenidentität und ungeklärte Antworten.
- `tests/atlas-tile-plan.test.mjs`: begrenzte Detailplanung und Maßstabsübergänge.
- `tests/atlas-perspective-camera.test.mjs`: Projektion und Zoomanker.

Die native Probe `tools/test-desktop-atlas-raster-workbench.mjs` öffnet die
synthetische Kampagne, scheitert aber am ersten erwarteten Höhenzug (Zeile 48,
Timeout nach 5 Sekunden). Daher kein erfolgreicher kompletter Ablauf und kein
Pinsel-Latenzwert. Diagnose an drei Kartenpunkten: `pointerdown` erreicht
`campaign-map`, Höhe ist gewählt, Handmodus aus, Terrain `ready/detail`;
nach Halten und Loslassen bleibt die Datenbankrevision jeweils 3.
Eine ergänzende Diagnose mit aufgezeichneter Ereignisunterdrückung nimmt zwei
Züge an (Revision 3 → 4 → 5), unterdrückt aber den dritten bereits im
`pointerdown`-Wächter von `atlas-raster-presentation.ts:81–87`. Die Oberfläche
meldet dabei weiterhin `terrainReady=ready`. Die genaue Ursache innerhalb des
Wächters (laufende Geste, Framegültigkeit oder fehlender Geländetreffer) ist
noch nicht unterschieden. Es handelt sich somit um einen wechselnden
Eingabe-/Bereitschaftsbefund, nicht um einen Nachweis, dass Höhenmalen generell
unmöglich ist. Die instrumentierte Diagnose ist keine Latenzmessung.
Der Diagnoseprozess wurde normal beendet; der ursprüngliche fehlgeschlagene
Prüflauf besitzt dagegen keinen Erfolgsnachweis für normales Close/Fresh.

Lokale Belege unter `.build/atlas-raster-workbench/1792944915180-3020527/`
und `.build/terrain-preflight-diagnostic/1792945004889-3021779/` sowie
`.build/terrain-preflight-input-diagnostic/1792945118183-3023170/` enthalten
Fensteraufnahmen und Quellen-/Runtimebindung. Diese temporären lokalen Belege
sind keine veröffentlichte Produktqualifikation. Der überprüfte direkte
Pinselablauf ist im Capability-Katalog mit seinen tatsächlichen Testdateien und
`--geprueft` vermerkt; dies behauptet keinen bestandenen nativen Ablauf.

Ältere Skripte `test-desktop-terrain-live.mjs` und `terrain-timing-probe.mjs`
erwarten teils bestätigte DB-Revisionen während des gehaltenen Zuges und einen
anderen Canvas-/Rendereranschluss. Sie eignen sich unverändert nicht zum
Nachweis der ersten sichtbaren Pinselwirkung im aktuellen Host. Sichtbares
Terrainbild, Speicherabschluss und Cursorbewegung sind getrennt zu messen.

## Lösungsoptionen

| Option | Nutzen und Kosten | Einordnung |
| --- | --- | --- |
| Gemeinsame numerische Formkerne im vorhandenen Höhenpinsel | Gemalte Einflussfläche und intern abgeleiteter Verlauf erzeugen Hügel, Rücken oder Einschnitt; derselbe Kern dient direkter Darstellung und Speicherung. Bestehende Höhe, History und weitere Bearbeitung bleiben nutzbar. | Empfohlener erster Weg. |
| Lokaler Generator je gemaltem Bereich | Mehr Freiheit für die Formgestaltung; zusätzliche inkrementelle Berechnung und Abstimmung des sichtbaren mit dem gespeicherten Resultat. | Rückfalloption, falls einfache Formkerne die gestalterische Qualität nicht erreichen. |
| Neue GPU-Bearbeitung oder kompletter Rendererwechsel | Potenziell andere Rechenleistung; zusätzliche Datenübertragung, numerische Gleichheit und Integration. | Ohne gemessenen Engpass nicht als Voraussetzung begründet. |

Die Spezialpinsel verbinden überlappende Abdrücke zu einer Form. Der intern
ermittelte Verlauf ist keine zusätzliche Linienbedienung. Arbeit wird auf
betroffene Segmente/Kacheln begrenzt, statt jede lange Geste auf ihrer gesamten
umschließenden Rechteckfläche auszuwerten.

## Übernahme in die Planung

Die Fortsetzung vom 25.10.2026 übernimmt Option 1 als ersten Weg. Der Plan
beginnt mit der konkreten Eingabeursache und gültigen Ausgangsmessung; der erste
vollständige Bergpinsel prüft anschließend die Formarchitektur. Messergebnisse
und visuelle Qualität können die Rückfalloption begründen, keine vorsorgliche
Ersatzentwicklung.

Mausbelegung, Gestenabschluss und Messbedingungen stehen jetzt an der Fachquelle
unter [Ziele und Abnahme](../requirements/terrain-relief.md#ziele-und-abnahme-dieser-etappe).
Die Planung bewahrt die Unterscheidung zwischen Escape-Rücknahme und Abschluss
bei Pointerabbruch/Fokusverlust. Es bleibt offen, ob die geplante Umsetzung die
vereinbarten Formen und Leistungsziele erreicht; Einplanung ist kein Nachweis.
