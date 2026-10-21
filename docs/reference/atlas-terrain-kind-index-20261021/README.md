# Kleine Indizes für wiederholte Geländelesungen

21.10.2026, lokale Änderungen auf `17e0723b4`, Desktopversion 0.180.0.
Host: i5-8365U / Intel UHD 620. Native JSON-Belege enthalten Build-Hashes,
Arbeitsstand, Testprofil und Prozessende. Kein Test auf dem Pentium Gold 7505.

## Änderung

Jeder Höhen-/Farbrasterblock liest Höhen, Trassen und Seen. Bisher durchsuchte
die Auswahl dafür die gesamte temporäre Metadatentabelle und sortierte die
Treffer zusätzlich. Drei partielle Indizes enthalten jetzt nur die jeweilige
Kategorie, bereits in der kanonischen Reihenfolge. Die 100.000 Grundflächen
werden nicht in diese Indizes kopiert. SQLite pflegt sie bei den vorhandenen
Metadatenänderungen; es gibt keine zweite manuell synchronisierte Datenstruktur.

Der Mutationstest deckte außerdem gerundete SQLite-Zeilennummern über 2^53 auf.
Der inkrementelle Metadatenpfad übernimmt sie jetzt wie der vorhandene Lesepfad
als Text und speichert sie wieder als exakte SQLite-Integer.

[Regression](../../../tests/terrain-kind-index.test.mjs): tatsächliche
Abfragepläne, Reihenfolge über Seitengrenzen, vollständige Nutzdaten und
Samplefilter mit/ohne Index; danach Kategorienwechsel, Löschen und Einfügen.
Die Testdaten verwenden absichtlich große Zeilennummern. Vorher scheiterte der
Abfrageplantest, danach zunächst der Kategorienwechsel; beide sind behoben.
21 betroffene Tests sowie beide TypeScript-Prüfungen und Desktop-Build bestanden.

## Drei Detailkacheln derselben großen Welt

[Rohdaten](tile-comparison.json): drei wechselnd angeordnete Vorher-/Nachher-
Durchläufe, frische Readonly-Verbindung und Metadaten je Durchlauf. Die Welt
enthält 100.000 Grundflächen; ihre Verfeinerung umfasst 48 Kacheln. Gemessen
wurden die erste, mittlere und letzte Kachel in der Laderangfolge. Alle neun
Pixelvergleiche stimmen anhand SHA-256 überein. Kein paralleler eigener
Build oder nativer Lauf während dieser Messung.

| Abschnitt | Median vorher | Median nachher |
| --- | ---: | ---: |
| Kalter Metadatenaufbau | 1.405,1 ms | 1.435,6 ms |
| Erste Kachel | 1.239,9 ms | 886,7 ms |
| Mittlere Kachel | 640,8 ms | 228,3 ms |
| Letzte Kachel | 602,4 ms | 178,7 ms |

Temporäre Datenbankseiten: 8.949.760 → 8.990.720 Byte, also 40 KiB zusätzlich.
Diese Kachelzeiten sind keine Eingabelatenz und keine Hochrechnung auf die
gesamte Verfeinerung.

## Vollständige native Verfeinerung

[Messung](world.json), [Bild](world.png). `WORLD_POPULATED=1 WORLD_LARGE=1
WORLD_DRAFT=1 WORLD_PROGRESSIVE=1 SALTMARCHER_TERRAIN_TRACE=1` mit dem vorhandenen
Weltwerkzeug, begrenzt durch `tools/ui-session.py timeout --signal=TERM 300s`.
108.076 Landschaftsobjekte und ein Pinselradius von 2.500 Meilen.

Der Prüfweg verlangt jetzt mehr als die Qualitätsbezeichnung `detail`: Nach dem
Loslassen muss die bestätigte Revision alle Kacheln veröffentlicht haben und
anschließend ihre abschließende Kontextdarstellung zeigen. Eine verfeinerte
Live-Pinselantwort allein reicht nicht aus. Das Ergebnis zeigt Revision 9,
Qualität `detail`, **48/48 Kacheln**. Dieser Zustand wurde 38.185,1 ms nach dem
Loslassen erreicht. Der vorherige Lauf ohne diese Indizes überschritt bereits
die schwächere 60-Sekunden-Prüfung; siehe den
[vorherigen Befund](../atlas-base-samples-20261021/README.md).

Navigation: RAF p95 35,8 ms / Maximum 266,6 ms. Sculpt: p95 39,9 ms / Maximum
161,7 ms. Erste beobachtete Pixeländerung im 32×32-Messbereich: 201,3 ms ab
Eingabezeitstempel einschließlich Referenz-GPU-Lesung. Einzelmessung, kein
Latenzperzentil. GPU-Prüfungen für Küsten, Höhenlinien, Hexraster, Detail und
direkte Arbeitsfassung bestanden. Prozess 3026857 schloss normal mit Code 0,
PID verschwunden, keine Rendererfehler.

Die Verfeinerung endet nun innerhalb des Testlimits; die Ziele einer unmittelbar
reagierenden Weltkarte (16,7 ms Navigation / 100 ms Pinselreaktion) sind damit
weiterhin nicht erfüllt. 38 Sekunden bis zur letzten Kachel sind kein
akzeptierter Endzustand.

## Autorenweg im normalen Atlas

[Ablauf](authoring.json), [Kontinente](continents.png), [Wald](forest.png),
[nach Neustart](reopened.png). Aus leerer Testkampagne über die normalen
Werkzeuge: Kontinente, Relief, Wald, unabhängiges Königreichsgebiet, Straße,
drei Gebäudegruppen, Raumname „Zum Silbernen Stern“, frisches Öffnen.
67 Höhendatensätze, ein Bewuchsobjekt, ein Gebiet, eine Straße, drei Gruppen
und 72 Räume bleiben erhalten; keine Stadt-Dokumente. Beide Prozesse
3025268/3026374 schlossen normal mit Code 0 und verschwanden; keine Rendererfehler.

Dies ist ein Funktionsnachweis. Die einfachen Testkontinente und flächigen
Waldzeichen erfüllen noch keine gestalterische Fantasy-Abnahme; natürliche
Küstenformen, sichtbare Kronenstruktur auf Fernmaßstab und die vollständige
Lesbarkeit über alle Zoomstufen bleiben zu bewerten und zu verbessern.
