# Grundflächen nach tatsächlichen Farbsamples lesen

21.10.2026. Lokale Änderung auf `7a522d4bd`; Desktop neu von diesem Arbeitsstand
gebaut. Artefakthashes und schmutziger Arbeitsstand stehen in den nativen
Belegen. Host: i5-8365U / Intel UHD 620. Kein Nachweis auf dem vom Nutzer
genannten Pentium Gold 7505 und keine vollständige Leistungsabnahme.

## Änderung und Bildgleichheit

`renderTerrainColor` übergibt das tatsächliche zweifach abgetastete Farbraster
einschließlich 16-Pixel-Rand an den vorhandenen SQL-Samplefilter. Grundflächen,
deren Grenzen keinen Samplemittelpunkt enthalten, werden vor dem Lesen und
Dekodieren ihrer Nutzdaten ausgeschlossen. Höhen, Speicherinhalt und Reihenfolge
bleiben gleich. Bewuchs und Pigmente verwenden wegen ihrer weichen Ränder
weiterhin ihre eigenen Auswahlregeln. `projection.base` misst diese Phase bei
eingeschalteter Terrain-Diagnose.

[Regression](../../../tests/terrain-base-samples.test.mjs): 10.000 kleine
Grundflächen ergeben 32 gelesene Nutzdaten statt 10.000 bei byteidentischem Bild.
Die verbleibenden kleinen Flächen beeinflussen das Bild weiterhin. Weitere
Fälle vergleichen Löcher, Überlagerung, Masken, rechteckige Raster, Kachelränder,
Teilbatches sowie gebrochene und große positive/negative Koordinaten. Der Test
der gelesenen Anzahl scheitert auf dem vorherigen Code.

17 betroffene Tests bestanden: neue Grundflächentests, Höhen-Samplefilter,
Farbkacheln, vollständige Projektion und Projektionscache. Beide TypeScript-
Prüfungen und Desktop-Build bestanden.

## Isolierte Messung mit 100.000 gespeicherten Grundflächen

[Rohdaten](base-phase.json). Drei Durchläufe je Größe, wechselnde Reihenfolge,
identische Readonly-Datenbank des bisherigen großen Weltprofils, kein
Projektionscache. Gemessen sind nur Lesen und Malen der Grundflächen; andere
Schichten fehlen auf beiden Seiten. Das fertige Bild muss jeweils bytegleich
sein. Diese Zeiten sind weder gesamte Ladezeit noch Eingabelatenz.

| Farbraster | Nutzdaten vorher → nachher | Median vorher → nachher |
| --- | --- | --- |
| 64 × 64 | 100.000 → 527 | 1.902,7 → 72,2 ms |
| 128 × 128 | 100.000 → 2.210 | 1.733,1 → 122,6 ms |
| 512 × 512 | 100.000 → 34.560 | 1.847,6 → 733,9 ms |

Reproduktion: `node --test tests/terrain-base-samples.test.mjs` erzeugt das
Testmodul. Danach `node docs/reference/atlas-base-samples-20261021/measure-base-samples.cjs /pfad/zum/behaltenen/weltprofil/workbench.sqlite`.
Das Profil wird nicht verändert; Ergebnisse landen in `.build/base-samples-measurement.json`.

## Native große Welt: weiterhin offene Grenzen

Das vorhandene Weltwerkzeug erzeugt 108.076 Landschaftsobjekte, darunter
100.000 Grundflächen, 5.000 Orte sowie Gelände, Bewuchs und Straßen. Es bewegt
die normale Hauptkamera und formt Gelände mit 2.500 Meilen Radius. Die
regelmäßig angeordneten Flächen sind eine Lastfixture, keine gestalterische
Fantasy-Abnahme und nicht der vollständige Zielbestand aus Gebäuden/Dungeons.

Der Lauf mit `WORLD_PROGRESSIVE=1` **scheiterte**: Nach dem Pinselzug war die
Qualitätsstufe `detail` nach 60 Sekunden nicht erreicht.
[Fehler](progressive-failure.json), [Messdaten davor](progressive-progress.json),
[Bild beim Fehler](progressive-failure.png). Navigation: RAF p95 34,3 ms,
Maximum 250 ms. Sculpt: p95 40 ms, Maximum 204,2 ms. Erste beobachtete Änderung
im 32×32-GPU-Messbereich: 275,6 ms ab Eingabezeitstempel. Das ist eine einzelne
Messung, kein Latenzperzentil. Die Ziele 16,7 ms Navigation und 100 ms
Pinselreaktion sind nicht erfüllt. Prozess 3013470 wurde beendet und sein
Verschwinden geprüft; dieser Fehlerlauf ist kein erfolgreich abgeschlossener
nativer Ablauf.

Die getrennte [Funktionsprobe](functional-world.json) ohne Warten auf vollständige
Verfeinerung bestand: Live-Höhenarbeitsfassung während des Zugs, Abschluss ohne
verbleibenden Entwurf, gespeicherte Revision 9 sowie GPU-Pixelprüfungen für
Küsten, Höhenlinien, Hexraster und Detailkomposition. [Bild](functional-world.png).
Navigation p95 35,2 ms / Maximum 333,4 ms; Sculpt p95 40,2 ms / Maximum 152,1 ms;
erste beobachtete Pinseländerung 248,3 ms. Qualitätsstufe beim Abschluss:
`overview`. Prozess 3015050 schloss normal mit Code 0; PID verschwunden,
keine Rendererfehler. Dieser Lauf ersetzt den fehlgeschlagenen Detailtest nicht.

Die Grundflächenoptimierung beseitigt einen nachgewiesenen Teilaufwand. Die
verbleibende Rendererlast und die ausbleibende vollständige Verfeinerung bleiben
separat zu untersuchen. Speichern oder eine neue Revisionsnummer ersetzt keine
Messung der tatsächlichen sichtbaren Reaktion.
