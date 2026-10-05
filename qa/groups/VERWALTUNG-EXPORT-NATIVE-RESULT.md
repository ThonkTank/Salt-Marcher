# Verwaltung-Export: direkter Originalbefund

**Referenz:** Dungeondraft 1.2.0.1, isolierte Xvnc-/XDG-Sitzung am 05.10.2026. Dies ist nur ein Originalbefund; er nimmt keinen Obsidian-Hostfall ab. SHA-256 der Originalbinärdatei: `9670325214d744194511d3ce731e910594b75e373928d95ca9e97ea30a769438`, des PCK: `f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60`. Mods und Assetpakete waren im isolierten Profil aus.

Die zwei Läufe liegen unter `/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/groups/verwaltung-export/native/runs/`: `20261005-133859-3034935` (R1: Karte, Licht, Optionen und Formatmenü) und `20261005-134626-3046382` (R2: frisches Öffnen und Ausgabe). Der isolierte Kartenstand `R1/evidence/maps/06-source-wall-portal-light.dungeondraft_map` hat SHA-256 `a9033e431aba18423463594198041ccad3463e9e6f9a343ec446c7dd9a827441` und enthält auf 8 × 8 Feldern genau eine Wand mit gebundenem Portal sowie ein Licht. Der zum Export wieder geöffnete Arbeitsstand hatte dieselbe Prüfsumme. Screenshots liegen unter `evidence/screens/`, Ausgaben von R2 unter `evidence/exports/`.

Der grafische Dateidialog `zenity` blieb im isolierten Xvnc-Lauf unsichtbar. R1 lieferte daher keinen Dateibeleg. In R2 ersetzte ein auf diesen QA-Lauf begrenzter `zenity`-Pfadhelfer **nur die Wahl des Zieldateinamens**; Dungeondraft selbst erzeugte alle Bild- und VTT-Daten. `R2/zenity-calls.log` protokolliert die vier Aufrufe und die Filter `*.png` beziehungsweise `*.dd2vtt`. Die Wirkung des systemeigenen Dateidialogs und „Show in Folder on Finish“ ist dadurch nicht belegt.

## Sichtbare Oberfläche

`R1/evidence/screens/07-export-default-options.png` zeigt den durch die Hauptleistenaktion Export geöffneten Optionsdialog. `08-export-format-menu.png` zeigt genau die angebotenen Modi **PNG, JPEG, WEBP, Universal VTT**. JPEG und WEBP wurden nur als Menüeinträge gesehen, nicht als Dateien erzeugt.

Für die 8 × 8-Karte zeigte der Startzustand PNG, Grid ON, Lighting ON, Source Level Ground, Source Lighting ON, Brightness 100 %, Focus 100 %, Overlay Level `---`, Overlay Lighting ON, Opacity 100 %, Camera Filter None, Grid Presets Custom, Grid PPI 256 und Ausgabemaße 2048 × 2048. „Show in Folder on Finish“ war anfangs ON; für die tatsächlichen Ausgaben wurde es OFF geschaltet. Crop war sichtbar, Reset Crop anfangs inaktiv. Die Werte belegen die angebotenen Bedienelemente, nicht die Wirkung unbetätigter Optionen.

## Szenario 1: PNG, Raster und Licht

Alle drei Dateien stammen aus demselben frisch geöffneten Kartenstand. Die gewählten Optionen stehen in R2 `21-png-on-before-export.png`, `23-png-grid-light-off-options.png` und `28-png-grid-off-light-on-options.png`. Alle Ausgaben sind PNG mit 8-Bit-RGBA und 2048 × 2048 Pixeln.

| Optionen | Ausgabedatei | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Grid ON, Lighting ON | `png-grid-light-on.png` | 3.682.063 | `ab6e07606bfc29c33aac5b265c6f0b26df8a9c31079bac33310d5fb545c92fc8` |
| Grid OFF, Lighting ON | `png-grid-off-light-on.png` | 3.587.806 | `272cfb369140871528c220c1149cbdc25e0d9d3075e045c8b5cb01f8b35ead89` |
| Grid OFF, Lighting OFF | `png-grid-light-off.png` | 3.536.676 | `e4e0f995aa6667db0470e119a77ae9bc1c9043e29ef5900513b1e62c70b82937` |

Zwischen den ersten zwei Dateien ändert ausschließlich Grid: 131.369 Pixel (3,13 %) unterscheiden sich; die gepunkteten Rasterlinien fallen fort. Zwischen der zweiten und dritten Datei ändert ausschließlich das obere Lighting: 594.168 Pixel (14,17 %) unterscheiden sich um die Lichtquelle; die warme Aufhellung entfällt. Wand und Portal bleiben in allen drei Bildern. `Source Lighting` blieb ON und wurde nicht gesondert variiert. Die Bilddateien belegen DD-043.02–.04, .14–.15 im gemessenen Standardwert und die Dateiausgabe .19.

## Szenario 2: Universal VTT mit Wand, Portal und Licht

`R2/evidence/screens/26-vtt-options-before-export.png` zeigt Universal VTT mit Grid OFF, Lighting ON, PPI 256. Die Ausgabedatei `wall-portal-light.dd2vtt` hat 4.784.688 Bytes und SHA-256 `5acb3f6cd8724cec43495ef43921d89dc0a7c3fbfbb3fed9140c643f6d11fae3`. Sie ist JSON mit `format: 0.3`, `resolution.map_origin: (0,0)`, `map_size: (8,8)`, `pixels_per_grid: 256` und den Schlüsseln `line_of_sight`, `objects_line_of_sight`, `portals`, `environment`, `lights`, `image`.

`line_of_sight` enthält eine siebenteilige Polygonlinie mit den Punkten `(6,3.5) → (6,4) → (4,5) → (2,2) → (4,1) → (6,2) → (6,2.5)`. Ihre Enden lassen die Portalöffnung von `(6,2.5)` bis `(6,3.5)` frei. `portals` enthält genau einen geschlossenen, gebundenen Eintrag: `position (6,3)`, dieselben Grenzen, `rotation 1.570796`, `closed true`, `freestanding false`. `lights` enthält genau einen Eintrag: `position (4,2.84375)`, `range 5`, `intensity 1`, `color ffeccd8b`, `shadows true`. `objects_line_of_sight` ist leer; `environment` enthält `baked_lighting: true` und `ambient_light: ffffffff`.

Das base64-Feld `image` dekodiert zu einem RGBA-PNG mit 2048 × 2048 Pixeln. Seine 3.587.806 Bytes und SHA-256 `272cfb369140871528c220c1149cbdc25e0d9d3075e045c8b5cb01f8b35ead89` sind **bytegleich** mit `png-grid-off-light-on.png` aus Szenario 1. Die VTT-Datei belegt damit Wand, Portal, Licht, Auflösung und Bildbeilage; ein Import in einen fremden VTT wurde nicht geprüft.

## Fallgrenzen und offene Originalwirkung

| Fälle | Stand |
| --- | --- |
| DD-043.01–.04, .15, .19, .22–.23 | Dialog beziehungsweise konkrete Ausgabewirkung direkt belegt. Bei .23 schließt X den Dialog ohne eine weitere Datei (`R2/evidence/screens/30-export-dialog-closed-with-x.png`). |
| DD-043.05–.11 | Source/Overlay und deren Licht-, Helligkeits-, Focus- und Opacity-Werte sind im Dialog sichtbar, wurden aber nicht verändert oder auf Pixelwirkung isoliert. Source/Overlay Level verlangt eine geeignete Mehr-Ebenen-Karte. |
| DD-043.12–.13 | Camera Filter None und Grid Presets Custom als Startwerte sichtbar; alternative Filter und Presets sowie deren Ausgabewirkung nicht geprüft. |
| DD-043.14 | 256 PPI ergibt sichtbar und tatsächlich 2048 × 2048 für 8 × 8 Felder; Änderung auf andere PPI und Grenzwerte offen. |
| DD-043.16–.18 | „Show in Folder“ wurde für die Ausgaben OFF geschaltet, ON-Folge nicht geprüft; Crop und Reset Crop nicht betätigt. |
| DD-043.20–.21 | JPEG und WEBP im Originalmenü vorhanden; Dateierzeugung, Qualität/Alpha und Bildwirkung offen. |

Die QA-Karte und die Ausgaben liegen ausschließlich außerhalb des Vaults. Xvnc und Dungeondraft wurden nach R2 beendet; der exklusive Grafikslot ist frei.
