# Autorenwelt vor der Höhenlinienkorrektur – 22.10.2026

Der unterbrochene Auftrag ist vollständig durchgelaufen. [Ergebnis](result.json):
Quellbasis `02673afb2e04e828a32cf17b22e86cac45fc48ea`, lokale Versionsmetadaten
0.187.0, noch die bisherige Höhenliniendarstellung. Kein veröffentlichter Pakettest.
Alle acht Bilder wurden nach Wiederaufnahme betrachtet.

Ablauf und Wiederholung entsprechen dem [Küsten-Autorenlauf](../atlas-world-authoring-coast-20261022/README.md):
aus leerer Kampagne Kontinente erhöhen/absenken/aufrauen, Buchten und Inseln,
Gebirgszug, Wald mit Freifläche, unabhängiges Königreich Aster, drei Straßen,
sechs Raumgruppen mit 95 Räumen und ein benannter Schankraum. Kein Stadtdokument.
Die Bestände bleiben nach frischem Start gleich. Beide Prozesse (4094722,4096456)
endeten normal mit Code 0, PIDs verschwunden, Rendererfehler leer.

## Sichtprüfung

Die [Kontinente](02-continents.png) bleiben stark gerundet;
[Relief und Küsten](03-continental-relief.png) sind trotz Gebirgsbearbeitung
fast ohne lesbare Höheninformation. [Wald](04-continental-forest.png) zeigt
überlappende Pinselstriche mit zu großen Kronenmustern auf dieser Distanz.
[Königreich](05-kingdom.png) hat einen sichtbaren Namen und unabhängige Grenze.
Die [Siedlung](06-settlement.png) enthält freie Gebäude und Straßen, wirkt aber
verstreut; Straßenanschlüsse und Gebäudeanordnung ergeben noch keinen Ort.
[Innenraum](07-building-room.png) und [Neustart](08-reopened.png) sind funktional,
Schrift klein, Materialien wenig ausgeprägt. Geschosswechsel/Raster sind hier
nicht qualifiziert. Der frühere sporadische Freihalten-Fehler trat diesmal nicht
auf, ist damit aber nicht als behoben nachgewiesen.

Die offizielle [Sword-Coast-Karte](https://media.wizards.com/2015/images/dnd/resources/Sword-Coast-Map_HighRes.jpg)
wurde erneut lokal betrachtet: variierte Küstendetails, lesbare Gebirgsketten,
zusammenhängende Wälder und eine deutliche Beschriftungshierarchie fehlen unserem
Ergebnis weiterhin. Die Referenz wird nicht im Repository kopiert.
Dieser Lauf zählt weder als visuelle Abnahme noch als sauberer Gesamtaudit oder
Vollwelt-/Pentium-Leistungsnachweis. Die anschließende Höhenlinienänderung benötigt
eigene Nachweise und darf diesen älteren Lauf nicht als Prüfung ihrer Pixel ausgeben.
