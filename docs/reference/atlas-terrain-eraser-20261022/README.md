# Gelände radieren und stabile Pinselgeometrie – 22.10.2026

## Beobachtung und Nutzerkorrektur

Der Autorenlauf auf `02673afb2e04e828a32cf17b22e86cac45fc48ea` mit den noch
unintegrierten festen Höhenlinien scheiterte beim 55-m-Pinsel nahe
(-8.130.000 m, -983.700 m). [Fehlerstatus](before/failure-status.json),
[Bild](before/failure.png), [Laufdaten](before/failure.json).
`polygon-clipping` konnte eine Kante im SweepLine-Baum nicht mehr finden.
Die native Sitzung wurde im Fehlerpfad beendet; kein erfolgreicher Autorenlauf.

Der Nutzer hat den bisherigen Bedienweg „Freihalten“ ausdrücklich verworfen.
Er speicherte eine dauerhafte Unterdrückungsfläche für automatische Bäume,
während der Waldboden bestehen blieb. Das entspricht nicht dem Gelände-Radierer.
Der neue Bedienweg **Gelände radieren** entfernt den aufgetragenen Boden und
seinen zugehörigen Bewuchs. Danach lässt sich dort normal wieder malen.
Höhen, Straßen und Gebäude sind unabhängig; verknüpfte Ortsnotizen werden nicht gelöscht.
Alte gespeicherte Unterdrückungseinträge bleiben lesbar; neue Radierzüge erzeugen keine.

## Varianten und Entscheidung

1. **Lokale Gleitkommakoordinaten:** kein bewusstes Rundungsraster, geringe
   Umstellung. Die ursprünglichen 30 Varianten bestehen; ein einfacher
   geschlossener Zug scheitert weiterhin. Als vollständige Lösung verworfen.
2. **Gleitkommageometrie vorab runden:** leicht einzubauen, aber intern entstehen
   wieder ungenaue Schnittpunkte. Keine verlässliche Lösung des Algorithmusfehlers.
3. **Integer-Clipping mit direkter Linienverbreiterung:** zusätzliche Abbildung
   der Koordinaten, dafür robuste Schnitte und weniger verdeckte Geometrie.
   Gewählt; die bereits vorhandene Abhängigkeit `clipper-lib` wird wiederverwendet.

Die Bibliotheksdokumentation beschreibt Rundungsfehler als bekannte Fehlerklasse
bei [polygon-clipping](https://github.com/mfogel/polygon-clipping).
Ein [konkreter Upstream-Fall](https://github.com/mfogel/polygon-clipping/issues/173)
zeigt, warum bloßes Runden nicht allgemein genügt. Clipper verwendet für robuste
Operationen [Integer-Koordinaten](https://github.com/xaviergonz/js-angusj-clipper/blob/master/docs/faq/index.md).
Der lokale Reproduzierer bleibt der Nachweis für diesen Produktfehler.

## Ergebnis und Grenzen

Die [feste 41-Punkte-Reproduktion](../../../tests/fixtures/landscape-brush-distant-stroke.json)
scheitert vorher in allen 30 leicht versetzten Varianten, danach in keiner.
Eine lokale Gleitkommavariante brauchte für ihre 30 erfolgreichen Varianten
4.789 ms; die endgültige Variante 45 ms. Das ist ein isolierter Geometrievergleich.

Der Belastungsfall verwendet 2.000 nahezu kollineare Punkte entlang einer Welle:

| Variante | Laufzeit | Ergebnis |
| --- | ---: | --- |
| Alle Kreisflächen in einer Integer-Union | nach 68 s beendet | verworfen; kein normaler Abschluss |
| Kleine Union-Batches, ausgeglichener Merge | 6.458 ms | korrekt, weiterhin viel zu langsam |
| Direkte Linienverbreiterung | 2.906 ms | korrekt, noch zu viele Eingabepunkte |
| Linienverbreiterung mit begrenzter Pfadvereinfachung | 61,4 ms | 560 Konturpunkte statt 10.203 bei Kreis-Union |

Rohdaten: [lokale Gleitkommavariante](brush-coordinate-comparison.json),
[Integer-Batches](brush-coordinate-integer-comparison.log),
[Linienverbreiterung](brush-coordinate-offset-comparison.log),
[endgültige Variante](brush-coordinate-simplified-comparison.log).
Die Pfadabweichung ist auf Radius/1024 begrenzt. Die Bogenapproximation entspricht
der bisherigen 24-Eck-Kreisgenauigkeit. Das Integer-Raster beträgt bei üblichen
Weltgrößen 10 Mikrometer; bei extremen Ausdehnungen wird es gröber, um sicher im
Integer-Bereich zu bleiben. Bereits gespeicherte Geometrie wird nicht migriert.

Unverändert: Terrain-Sculpt verwendet seinen eigenen Höhenkachelpfad. Diese
Messung beweist weder unmittelbare App-Reaktion noch Pentium-Leistung. Strukturierte
Pinsel mit unruhigem Rand verwenden weiterhin Kreisflächen und können bei langen
Zügen teuer bleiben. Das Gesamtprodukt hat weiterhin Darstellungs- und Latenzlücken.

## Aufräumen und Prüfung

`landscape-polygon-clipping.ts` kapselt Koordinatenrahmen, Pfadvereinfachung,
Clipper und Löcher. `vegetation-erase.ts` kapselt das Entfernen des Geländeauftrags;
der Speicherpfad übernimmt Transaktion und History. Die alte UI-Auswahl ist ersetzt.
Die native Autorenprobe verwendet jetzt den Radierer. Keine neue Sperrflächenart,
keine zusätzliche Datenbanktabelle und kein neuer Darstellungsweg.

80 gezielte Tests bestanden: weit entfernte und geschlossene Züge, Löcher,
2.000 Punkte, Wiederbemalen, unabhängige Straße/Höhe, Undo/Redo, Neustart,
Leergeometrie, ungültige Löcher sowie vorhandene Farb-/Vegetationspfade.
Eine anfängliche Testannahme zu History war falsch: Ein wirkungsloser zweiter
Radierzug erzeugt keinen weiteren Undo-Eintrag. Der Test prüft nun den tatsächlichen
Vertrag, einschließlich monotoner Revisionen.

```sh
node --test tests/landscape-brush.test.mjs tests/vegetation.test.mjs tests/desktop-landscape-tools.test.mjs tests/desktop-atlas-tool-hierarchy.test.mjs tests/desktop-land-color-separation.test.mjs tests/terrain-visibility.test.mjs tests/terrain-color-tiles.test.mjs
node docs/reference/atlas-terrain-eraser-20261022/measure-brush.mjs
node docs/reference/atlas-terrain-eraser-20261022/build-authoring.mjs
QA_EVIDENCE_DIR=.build/authoring-eraser-repeat python3 tools/ui-session.py timeout --signal=TERM 600s node .build/world-authoring-eraser-study.mjs
```

Die native Autorenprobe ist unten dokumentiert. Veröffentlichungsstatus folgt aus
den jeweiligen CI-/Release-Ergebnissen, nicht aus diesen lokalen Läufen.

## Gefundene Regression: Regionsvalidierung

Der erste vollständige Autorenlauf nach der Pinseländerung erreichte den
Gelände-Radierer im Kontinentmaßstab, scheiterte dann am Königreich.
[Fehlerbild](region-regression/failure.png), [Rohdaten](region-regression/failure.json).
Die Grenze war gültig, ihre Normalisierung änderte durch die Reihenfolge der
Fließkommaberechnung die Fläche um 0,00048828125 m² bei rund 3,69 Billionen m².
Die feste Toleranz von 0,00001 m² lag unter einem darstellbaren Zahlenschritt.
Die [Reproduktion](region-regression/reproduction.json) enthält Punkte und Radius.

Gewählt ist eine begrenzte relative Rundungstoleranz (16 Maschinen-Epsilon),
mit unveränderter Untergrenze für kleine Flächen. Erneute geometrische Rundung
könnte die Form verändern; eine neue vollständige Topologieprüfung wäre breiter
als der nachgewiesene Rechenfehler. Ein zusätzlicher Store-Test speichert die
Kontinentgrenze und weist eine echte Selbstkreuzung bei derselben Größenordnung
weiterhin zurück. Der gescheiterte native Lauf bleibt als Regression dokumentiert.

27 zusätzliche Regions-/Entwurfstests bestanden. App-/Desktop-Typprüfung und
Desktop-Build bestanden. Der visuelle Vergleich mit der offiziellen
[Sword-Coast-Karte](https://media.wizards.com/2015/images/dnd/resources/Sword-Coast-Map_HighRes.jpg)
zeigt weiterhin deutliche Lücken: große glatte Pinselkonturen statt abwechslungsreicher
Küsten, gezackte schmale Gebirgsdetails, wenig flächige Reliefgestaltung und
keine vergleichbare Material- und Beschriftungshierarchie. Die Vorlage wurde
visuell betrachtet, nicht als Produktasset übernommen.

## Vollständiger Autorenlauf nach den Korrekturen

[Ergebnis](after/result.json): alle acht Stufen vom leeren Atlas über Kontinente,
Königreich und Gelände-Radierer bis zu drei Straßen, sechs Gebäuden und 95 Räumen.
Keine `city_document`-Hülle. Die vor dem Neustart gespeicherten Inventare sind
nach dem Neustart exakt gleich, einschließlich des benannten Raums. Beide
Prozesse (4132837, 4134861) schlossen normal mit Code 0; PIDs verschwunden,
keine Rendererfehler. Alle acht Bilder wurden betrachtet.

[Gelände radieren](after/04-continental-forest.png),
[Königreich](after/05-kingdom.png), [Siedlung](after/06-settlement.png),
[Innenraum](after/07-building-room.png), [Neustart](after/08-reopened.png).
Zusätzliche visuelle Lücken: verstreute Gebäudekomposition, sehr kleine Raumnamen,
kein in diesem Innenraumbild sichtbares D&D-Raster und ein auffälliger Dachkörper
neben dem Raumplan. Diese funktionale Probe ist keine ästhetische Gesamtabnahme.

Der Radierer blendet im anschließenden UI-Aufräumschritt seine wirkungslosen
Vorlagen-/Dichteeinstellungen aus; beim Malen stehen sie wieder zur Verfügung.

Die [anschließende native UI-Prüfung](options/result.json) bestätigt den sichtbaren
Radius, verborgene Vorlageneinstellungen beim Radierer und wieder sichtbare
Einstellungen beim Malen. Normaler Exit, PID verschwunden, keine Rendererfehler.
[Bild](options/eraser-options.png). Der erste Prüfansatz verwendete irrtümlich
das verborgene kanonische Radiusfeld; geprüft wird jetzt die sichtbare Eingabe
`land-radius-value`. Dafür war keine weitere Produktänderung nötig.


## Durch die vollständige CI entdeckte Farbregression

Candidate `72727d54305b5bef4e555cda673182197ad2ffe4` scheiterte im vorhandenen
Pixelvergleich für gespeicherte Farbaufträge (Run `39849364722`). Die neue
Pinselgeometrie veränderte die Rekonstruktion von Version-1-Pigment. Der
[Vergleich](pigment-regression/pigment-comparison.json) zeigt 1.067 veränderte
Pixel von 16.384, maximal 24 Kanalwerte. [Vorher](pigment-regression/pigment-baseline.png),
[fehlerhafter Kandidat](pigment-regression/pigment-candidate.png),
[Korrektur](pigment-regression/pigment-fixed.png) wurden visuell betrachtet.

Drei Möglichkeiten: vollständige Rücknahme des neuen Geometriepfades würde
die belegten Radiererfehler zurückbringen; ein neuer erwarteter Bildhash würde
die Veränderung vorhandener Karten akzeptieren; eine getrennte Rekonstruktion
der ursprünglichen 24-Punkt-Stempel erhält deren Form. Gewählt ist die dritte
Variante. Ihr Schnitt mit neuen Pinselrändern verwendet das robuste Integer-
Verfahren, weil nahezu deckungsgleiche Gleitkommakanten andernfalls scheitern.
Der bestehende erwartete Bildhash bleibt unverändert. Der feste Vergleich ist
nach der Korrektur pixelgleich (0 veränderte Pixel); das ist ein Fixture-Nachweis,
keine Garantie für jede beliebige gespeicherte Karte.

Der vollständige lokale Diagnoselauf endete mit 4.363 Tests, 4.357 erfolgreich,
fünf fehlgeschlagen und einem übersprungenen Test. Während dieses Laufs wurde
der Reparaturentwurf geändert; er ist daher keine Qualifikation eines festen
Commits. Alle fünf Fehler betreffen Farbschnitte. Die anschließenden
[19 Pigment-/Werkzeugtests](pigment-regression/release-187-pigment-fix2.log) und
[18 Küsten-/Farbreihenfolge-/Pinseltests](pigment-regression/release-187-remaining-fix.log)
bestehen nach der endgültigen Korrektur. Reproduktion aus dem Repository:
`node docs/reference/atlas-terrain-eraser-20261022/pigment-regression/reproduce.mjs`.
Die neue genaue Candidate-CI bleibt vor Integration verpflichtend.
