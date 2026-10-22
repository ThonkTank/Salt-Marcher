# Waldsignatur im normalen Atlas, 22.10.2026

Lokaler Anschluss auf `37a7914f14510b4d08033320761d4150ade41e35`, nach dem
[separat geprüften Maskenbaustein](../atlas-forest-coverage-20261022/README.md).
Die vorhandene Atlasfläche und ihre Hauptkamera verwenden nun die Fernsignatur.
Es gibt keinen zusätzlichen Benutzeransichtsmodus. Gestaltung und vollständige
Leistungsqualifikation der Welt bleiben offen.

## Daten und Darstellung

Der kanonische Gelände-Reader erzeugt den Waldkanal zusammen mit RGBA. Beide
Kanäle teilen die vorhandenen 32-Pixel-Cacheteile, räumliche Invalidierung,
Quellrevision und Cachegrenze. Farbkacheln und komplette Projektionen tragen den
Kanal einschließlich lokaler Pinselverfeinerungen. Er erhöht die Nutzdaten um
ein Byte je Farbtexel; es gibt keine neue Weltabfrage pro Kameraänderung.

`TerrainFrame` überträgt Änderungen des Kanals als eigene Rechtecke. Auch eine
reine Waldänderung ohne geänderte RGB-Werte erhält ein Delta. Fehlende
Vorgängerkanäle erzwingen einen vollständigen Frame. Die Bytezählung umfasst die
Masken direkt; sie serialisiert sie nicht versehentlich als große JSON-Objekte.

`TerrainDetailTiles` hält Farbe und Wald gemeinsam in seinem bisherigen
32-MiB-Cache. Beim Maßstabwechsel wird die vorherige Abdeckung unter denselben
Weltkoordinaten übernommen, bei Änderungen gemeinsam gelöscht. Der aktive
zusammengesetzte Detailpuffer wächst von vier auf fünf Bytes pro Texel; seine
bestehende maximale Kachelzahl bleibt erhalten. Die Worker-Cachegrenze bleibt
16 MiB. Diese Grenzen ersetzen keine Messung des gesamten Prozessspeichers.

Das vorhandene `TerrainDetailMaterial` überblendet Basis, Pinselpatch und
Detailkanal mit denselben Gewichten. Verfügbarkeit und Transparenz behalten ihre
bisherigen Aufgaben. Kleine Änderungen aktualisieren nur die entsprechenden
GPU-Rechtecke; der gemeinsame Texture-Upload unterstützt jetzt auch einbyteige
Rotkanäle. Detailfortschritt ersetzt nicht die Basismaske.

`TerrainForestPattern` besitzt eine kleine wiederholte Kronentextur und die
Weltphase. Kameraänderungen aktualisieren ausschließlich Uniforms. Zwei
benachbarte Zweierpotenzmaßstäbe blenden weich ineinander; die Phase wird relativ
zum lokalen Renderursprung reduziert. Implizite Mip-Derivate werden außerhalb
fragmentabhängiger Verzweigungen ausgewertet.

Die Signatur wird vor Konturzeichnung und vor der vorläufigen Wasserkorrektur
des Sculpt-Werkzeugs aufgetragen. Abgesenktes Wasser erhält dadurch sofort seine
Wasserfarbe ohne alte Waldtextur. Die nahe Bildausgabe verwendet dieselbe Kamera
und denselben Materialpfad; öffentliche Quellen ohne freigegebenen Waldkanal
bleiben ohne diese zusätzliche Information.

## Visuelle Entscheidung

Die erste integrierte Fassung blendete die Signatur zwischen 40 und 80 m/Pixel
aus. Die echte 60-km- und 6-km-Ansicht zeigte dabei erneut verstreute Einzelkronen
auf weitgehend flacher Bodenfarbe. Die endgültige Fassung hält die Waldmasse
über die regionalen Kronenstufen und blendet zwischen 8 und 2 m/Pixel zu den
nahen Einzelbäumen aus. Dies ist eine Darstellungsregel, keine Änderung an
Autorenflächen, Baumpositionen oder Dichte.

Die Textur bleibt eine erste kartographische Verbesserung. Gleichförmige
Kronen, scharf polygonale Außenformen, dominantes Hexraster und schlichte Straßen
entsprechen noch nicht dem angestrebten publizierten D&D-Kartenbild.

## Prüfungen

Die lokalen Tests umfassen Wald-only-Deltas, Kachelgleichheit, Cache-Wiederverwendung,
Invalidierung und Rücknahme, immutabele Vorgänger, Fehler bei fehlender Basis,
Quellenwechsel, Quoten, semantische Übergänge und einbyteige Texture-Uploads.
Vorhandene Küsten-/Farb-Goldens bleiben unverändert.

Die GPU-Probe verwendet jetzt den **Produktshader**, nicht mehr eine zweite
Musterimplementierung. Der frühere Prototypshader wurde entfernt. Sie prüft
Weltursprung, Exportkacheln, einen sichtbaren LOD-Übergang, vollständiges
Ausblenden auf einer bewaldeten Nahfläche, Detail-vor-Basis, identische Bilder
bei Teil-/Vollupload und die Wasserfarbe des Live-Sculpt-Materials.
Sie ist weiterhin eine begrenzte Grafikprobe und keine volle Weltmessung.

59 unterschiedliche lokale Tests bestanden. Nach der letzten Änderung des
Ausblendbereichs wurden die beiden betroffenen Mustertests erneut bestanden;
die übrigen 57 Fälle blieben unverändert. App- und Desktop-Typprüfung sowie
Desktop-Build bestanden. Die Quellen- und Loghashes stehen in `tests.json`.

Die [GPU-Probe](gpu.json) ergab pixelgleiche Bilder bei Ursprungsverschiebung,
gekacheltem Export, Teil-/Vollupload, verdeckender Detailmaske und neuem Wasser.
Der sichtbare LOD-Grenzübergang weicht maximal um einen Kanalwert ab. 79 gemessene
Frames: RAF-p95 17,3 ms, CPU-Zeichenaufruf-p95 0,6 ms, ein Drawcall, vier Texturen.
Das ist weder GPU-Laufzeit noch volle Welt, Pentium- oder FPS-Abnahme.

Der [normale Atlasablauf](normal-atlas.json) prüfte 80 km, 60 km, 6 km, 1,2 km,
300 m, die um 45 Grad geneigte Hauptkamera sowie Welt- und Nah-PNG. Die
Autorenobjekte und die geschützte Eiche blieben unverändert. Der Welt-PNG-Ausschnitt
innerhalb einer ebenen Waldfläche enthält 183 Farbtöne; dort befinden sich keine
Konturen, Beschriftungen, Hexlinien oder nahen Einzelbäume. Zusammen mit der
GPU-Gegenprobe belegt dies den Produktpfad bis in die Ausgabe.

Ein erster Exportablauf scheiterte nach erfolgreicher Welt-PNG-Ausgabe daran,
dass der Test die im Exportmodus unsichtbare Suche anklickte. Der Test kehrt nun
über den tatsächlichen Button „← Karte bearbeiten“ zurück. Der fehlgeschlagene
Lauf bleibt in [export-harness-failure.json](export-harness-failure.json) erhalten;
der anschließende vollständige Ablauf schloss regulär ohne Rendererfehler.

### Sichtprüfung

[Frühes Ausblenden](rejected-early-fade.png) und [endgültiger Übergang](transition.png)
zeigen die Änderung auf 60-km-Maßstab. [Welt-PNG](world-export.png),
[regionale Ansicht](region.png) und [geneigte Nah-Ausgabe](near-export.png) wurden
visuell geprüft. Die Waldmasse bleibt zusammenhängend erkennbar, nahe Bäume
bleiben eigenständige Geometrie. Die sehr geraden Ränder und der gleichmäßige
Kronenteppich sind weiterhin gestalterische Schwächen. Auch Straßen wirken noch
wie schlichte Farbbänder; dies ist keine Fantasy-Kartenabnahme.

### Gefüllte Welt und großer Pinsel

Die [native Lastprobe](world.json) arbeitet auf einer privaten Kopie der
synthetischen Welt mit 100.000 Terrainzuweisungen, 5.000 Orten, 5.000 eingerichteten
Gebäudegruppen und einem Dungeon mit über 4.000 Räumen. Der Pinselradius beträgt
2.500 Meilen. Das ist keine fertige, absichtlich gestaltete Fantasy-Welt und
keine Messung auf dem Pentium-Laptop.

Im ersten Lauf waren die Bedienelemente 2,67 s nach Loslassen freigegeben, die
Karte aber erst nach **5,21 s tatsächlich erneut bearbeitbar**. Der zweite echte
Pinselstrich wurde bereits vor Abschluss der Detailkacheln angenommen und war
nach 3,14 s abgeschlossen. Am Ende sind 36/36 Detailkacheln sowie sichtbare,
Autoren- und [gespeicherte SQLite-Revision](persisted.json) 14 identisch. Die
[Aufnahme](world-brush.png) zeigt das synthetische Raster; sie belegt keine
Kartenästhetik. Die erste Bearbeitbarkeit ab Öffnen dauerte 10,74 s. Die genannten
Zeiten enthalten den normalen UI-Ablauf; insbesondere ist „ready“ nicht dieselbe
Messgröße wie erste sichtbare Pixel.

Die langen Wartezeiten und Renderer-Aussetzer bleiben offen. Die zusätzliche
Waldabdeckung ist eine Darstellungsfunktion, kein Nachweis einer
Leistungsverbesserung. Die [direkte Kontrolle](world-control.json) verwendete denselben Probeablauf und
dieselbe Ausgangsdatenbank mit dem vollständig gebauten Stand `37a7914f`, also
vor der Produktintegration. Der separate bestehende Integrationscheckout wurde
dafür ohne Änderung seines früheren Branches auf diesen Commit gestellt; der
aktuelle Produktbuild blieb unverändert. Vergleich der Einzelmessungen:

| Messgröße | Kontrolle ohne Anschluss | Aktueller Anschluss |
| --- | ---: | ---: |
| Öffnen bis bearbeitbar | 11,35 s | 10,74 s |
| Loslassen bis Bedienelemente frei | 2,77 s | 2,67 s |
| Loslassen bis wirklich bearbeitbar | 5,55 s | 5,21 s |
| Zweiter Strich bis bearbeitbar | 2,83 s | 3,14 s |

Die Sekundenverzögerung besteht in beiden Ständen. Diese zwei Läufe sind keine
statistische Leistungsqualifikation; die schwankenden Differenzen sind kein
Nachweis einer Verbesserung oder Gleichwertigkeit. Das aktuelle Rendererprofil
weist unter anderem 184 ms Eigenzeit für `retainPrevious` und 165 ms für
`invalidateTerrainDetail` über den beobachteten Ablauf aus. Dazu kommen
Meshaufbau, Shaderkompilierung und Hintergrundreads. Diese Summen sind keine
Dauer eines einzelnen Frames und erklären noch nicht die gesamte Verzögerung.

Alle erfolgreichen nativen Läufe schlossen regulär mit Code 0 und verschwundenem
Prozess; ihre elf Buildhashes wurden gegen den aktuellen Produktbuild geprüft.
Kein neuer Release, keine Installation und kein physischer Pentium-Nachweis sind
mit diesem lokalen Beleg behauptet.
