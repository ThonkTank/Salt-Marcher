# Quellenbegrenzung und Wiederverwendung ausreichender Fehlerschranken

M2-Zwischenschritt auf `5ee56f305`, 24.10.2026.
[Aktuelle Roadmap](../../plans/maps/unified-spatial-atlas.md).
Isolierter Materialprototyp; keine Änderung der gespeicherten Pinselzüge,
produktiven Kachelversion oder normalen Atlasdarstellung.

## Befund und Entscheidung

Die vorherige volle Mischprobe überschritt zwei Millionen Arbeitsschritte,
obwohl der Rundmittelweg keine weitere Mittelpunktunterteilung mehr brauchte.
Die Pinselquellen blieben über die gesamte synthetische 4×4-m-Fläche aktiv,
obwohl ihre Stempel nur im mittleren Bereich wirkten.

Die Gegenprüfung des Produktionspfads korrigiert die Reichweite dieser Annahme:
[LandscapeUI.colorRecord](../../../src/app/atlas-landscape-ui.ts) verwendet bereits
[brushFootprint](../../../src/app/landscape-brush.ts). Reguläre Quellen haben also
meist schon eine enge Kontur. Das Entfernen unnötiger äußerer Flächen kann die
großzügige Testquelle verbessern, beweist allein aber keinen allgemeinen
Produktgewinn. Deshalb enthält der Vergleich zusätzlich eine mit diesem echten
Produktionshelfer erzeugte Kontur und trennt die beiden Maßnahmen.

## Umsetzung

[pigment-stroke.mjs](../../../tools/atlas-prototypes/pigment-stroke.mjs) liefert
für v2-Stempel eine äußere Rechteckgrenze aus allen tatsächlich erzeugten
Stempelmittelpunkten und dem Radius. Ein koordinatenabhängiger Rundungszuschlag
und anschließendes Runden nach außen erhalten die Nachbarschaft, die auch der
gespeicherte Gleitkomma-Abstandstest noch treffen kann. Die Grenze bleibt bei
4000 Stempeln auf vier Kanten beschränkt. Sie lässt Lücken zwischen getrennten
Stempeln ausdrücklich bestehen; dies ist kein räumlicher Stempelindex.
Bei Überlauf bleibt die ursprüngliche Fläche aktiv. Leere Stempelfolgen haben
keine Wirkung; Füllungen werden nicht eingeschränkt.

Der Adapter schneidet diese Grenze mit der bereits vorhandenen Autorenfläche
und ihrer Land-/Wasserauswahl. Liegt die Zielgeometrie bereits vollständig
innerhalb der Grenze, übernimmt er sie ohne zusätzliche Polygonoperation.
Er ersetzt keine Autorenfläche durch einen idealisierten Kreis und erweitert
keine Wasser- oder Landmaske. `strokeSupport:false` erhält die Vergleichsvariante.

Der zweite Teil spart wiederholte Materialberechnung auch bei engen Konturen.
[materialIntervalError](../../../tools/atlas-prototypes/material-interval.mjs)
berechnet ohnehin Bereiche für alle 14 Kanäle. Deren Mittelpunkte und maximale
halbe Breite bilden ebenfalls einen gültigen Schätzwert samt Fehlerschranke
für das Dreiecksmittel. Dieser Kandidat bleibt nur für das aktuelle Callback-Paar
über eine schwache Kontextreferenz erhalten und wird einmal verbraucht.

Der Integrator stellt das aktuelle Zellfehlerziel im frischen Dreieckskontext
bereit. Erfüllt der Bereichskandidat dieses Ziel bereits, überspringt der Adapter
die zusätzlichen glatten und analytischen Mittelwertkompositionen. Andernfalls
bleibt der bisherige vollständige Vergleich erhalten. Die generische Auswahl
übernimmt weiterhin nur einen besseren Schätzwert; die vollständige gewichtete
Zellfehlersumme wird anschließend wie bisher geprüft. Kein Arbeits-, Speicher-,
Tiefen- oder Fehlerlimit wurde erhöht.

Ein Versuch, grundsätzlich auf Mittelwertkomposition zu verzichten, sobald ein
glatter Kandidat existiert, erhöhte Texturschnitte und Arbeit und wurde nicht
übernommen. Der endgültige frühe Ausstieg verlangt eine bereits ausreichende
Fehlerschranke.

## Prüfungen

[132 gezielte Tests](tests-132.log.gz) bestehen, einschließlich aller vorherigen
120 Prüfungen. Die neuen Tests belegen:

- [Quellengrenzen](../../../tests/atlas-material-stroke-support.test.mjs):
  Kreisränder und benachbarte Gleitkommawerte, kleine/große Koordinaten,
  kleinster akzeptierter normaler Radiusquadratswert, Überlauf, getrennte und
  bis zu 4000 Stempel, leere Folgen und Füllungen. Alle 14 Punktkanäle werden
  vor/nach Begrenzung für Pinseltypen, Land/Wasser, Malen/Radieren und Löcher
  verglichen; eine eigene Probe entfernt tatsächlich Teile einer breiten Fläche.
- [Bereichsschätzer](../../../tests/atlas-material-interval-estimate.test.mjs):
  abweichender Mittelpunkt, übersprungene aufwendige Auswertung bei ausreichender
  Schranke, Rückfall bei zu breitem Bereich, einmalige Verwendung und frische
  Kindkontexte nach Quellenschnitten, ungültige Bereiche und alle Zwischenkanäle.
- [Volle Mischkacheln](../../../tests/atlas-material-mixed-tile.test.mjs):
  unveränderte Ressourcen- und Qualitätslimits, Vergleich mit der bisherigen
  Berechnung sowie echte `brushFootprint`-Geometrie gegen ein unabhängiges
  512²-/1024²-Quellenraster. Letzteres ist numerische Konvergenzevidenz, keine
  formale Garantie des Rasterreferenzfehlers. Physisches Wasser ist in dieser
  Probe nicht enthalten; seine Zielgrenzen werden getrennt geprüft.

Die unabhängigen Entwurfsprüfungen bestätigten die nötige koordinatenabhängige
Quellenbegrenzung und den zulässigen frühen Ausstieg. Die tatsächlichen
Testdateien sind im Capability-Katalog verknüpft und geprüft markiert; das
erklärt dessen größeren Gesamtworkflow nicht für vollständig abgenommen.

## Kostenvergleich

[Messwerkzeug](../../../tools/measure-atlas-material-support.mjs) und
[drei wechselnde Runden](comparison.json.gz), jeweils 16×16 und 256×256,
identische drei Pigmentdatensätze plus Bewuchs, 1/255 Zellziel und unveränderte
Budgets. `Referenz` deaktiviert beide Maßnahmen; `Grenze` aktiviert nur die
Quellenbegrenzung; `Beide` zusätzlich die Wiederverwendung ausreichender Bereiche.
Alle Varianten benutzen dieselben aktuellen Module. Produktionshelfer und
Abhängigkeiten sind mit Quellhashes erfasst; die Hashes müssen vor und nach der
Messreihe gleich sein. Die abschließende Reihe läuft ohne parallele Tests.

| Pixel | Kontur | Referenz (Median; fertig) | Grenze (Median; fertig) | Beide (Median; fertig) | Arbeit beide |
| --- | --- | --- | --- | --- | --- |
| 16×16 | Breit | 2814 ms; 3/3 | 2709 ms; 3/3 | 2397 ms; 3/3 | 259755 |
| 16×16 | Produktionshelfer | 2725 ms; 3/3 | 2621 ms; 3/3 | 2348 ms; 3/3 | 248262 |
| 256×256 | Breit | 10280 ms; 0/3 | 10035 ms; 3/3 | 7140 ms; 3/3 | 1710441 |
| 256×256 | Produktionshelfer | 9957 ms; 3/3 | 9829 ms; 3/3 | 6867 ms; 3/3 | 1656109 |

Bei der Produktionskontur sind Geometrie, Arbeitsschrittzähler und Ergebnisse
von Referenz und reiner Begrenzung identisch; ihr kleiner Zeitunterschied ist
kein Beleg für einen Begrenzungsgewinn. Erst die Wiederverwendung ausreichender
Intervalle senkt hier den Median um rund 31 %. Sie erlaubt etwas breitere,
weiterhin gültige Schätzfehler und führt in dieser Probe zu geringfügig mehr
Texturschnitten, spart jedoch teurere wiederholte Kompositionen. Der gezählte
Arbeitsumfang ist deshalb nicht mit tatsächlicher Laufzeit gleichzusetzen.
Die maximalen Zellschranken bleiben bei beiden vollen optimierten Proben
unter 0,003921; das verbindliche Limit ist 1/255.

## Nächster Schritt und Grenzen

Die Mischkachel ist ein weiterer Quellen-/Kostenbeleg, keine tatsächliche
Weltlast und kein nativer Leistungsnachweis. Die Laufzeiten bleiben deutlich
über dem Ziel einer unmittelbar nutzbaren kalten Übersicht. M2 bleibt offen.

Als Nächstes folgt die eingefrorene M0-Welt mit vollständiger Quelleninventur
und Anschluss der kanonischen physischen Felder. Der bestehende Weg ist
`AtlasRegionReader.materialSteps` → `readTerrainMaterialSteps` mit seitenweiser
Autorendatenquelle und Terrainhöhenblöcken. Physisches Wasser und feldabhängige
Grundmaterialien sind keine bloße Liste gezeichneter Wasserpolygone.
Der Prototyp lehnt solche Basissätze und Pigmentmasken bislang ausdrücklich ab.
Die Probe muss diese Fälle benennen und korrekt auflösen; sie darf sie nicht
ausfiltern und das Ergebnis anschließend als vollständige Welt qualifizieren.

Erst danach sind Feld-/Quellenseiten, produktiver Materialpfad und Kachelversion
umzustellen. Native Übersicht, Werkzeugübernahme, Main-/Release-Lieferung und
die weiteren Etappen sind nicht durch diesen Schritt erledigt.
Syntax, `git diff --check` und [Repositoryprüfung](check-repo.log.gz) gehören
zum Abschluss dieses isolierten Schritts.
