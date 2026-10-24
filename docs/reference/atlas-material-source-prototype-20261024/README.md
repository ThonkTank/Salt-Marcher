# Autorenquellen und weltbezogene Bewuchsränder

M2-Zwischenschritt auf `3bab71bd`, 24.10.2026. [Atlas-Roadmap](../../plans/maps/unified-spatial-atlas.md).
Der Quellenadapter und die Randintegration sind isolierte Prototypen; normale
Atlasdarstellung, Speicherformat und kanonische Autoreninhalte bleiben unverändert.

## Fachlicher Vertrag

Die Oberfläche nennt `preset.edge` ausdrücklich **Waldrand in m**
([Steuerelement](../../../src/app/vegetation-controls.ts)). Die tatsächliche
Bewuchserzeugung reduziert Dichte linear mit Abstand zur Autorenkante geteilt
durch diesen Radius ([Generator](../../../src/app/vegetation.ts)). Der alte
Rasterizer verwendet dagegen Smoothstep mit `max(preset.edge, displayMpp*3)`
sowohl für Bodenfarbe als auch für den semantischen Waldkanal.

[HEX-18](../../../ROADMAP-HEX-ATLAS.md#meilenstein-e--die-karte-lesbar-ausarbeiten) und der
[Bewuchsplan](../../plans/maps/vegetation.md) verlangen beständige, bearbeitbare
Landschaftsflächen und erhaltene Autorenabsicht. Ein Mindestwaldrand von drei
Bildpixeln ist dort nicht vorgeschrieben. Eine unabhängige Quellenprüfung
bestätigt deshalb die Trennung: Autorenradius in Weltmetern für Materialdaten,
zusätzliche Bildschirmweichheit bei Bedarf in M4.

Der Prototyp bietet dafür ausdrücklich `edgePolicy: 'authored-world'` an:
normierte Waldabdeckung folgt der linearen Randregel, Bodenpigment weiterhin
Smoothstep, beide mit demselben unveränderlichen Autorenradius. Das ist eine
begründete Vertragsänderung gegenüber dem Raster-Waldkanal, keine Behauptung
identischer alter Pixel oder einer bereits freigegebenen Produktumstellung.

## Quellenadapter und Nacharbeit

[material-sources.mjs](../../../tools/atlas-prototypes/material-sources.mjs)
übernimmt die vorgegebene Reihenfolge von Basisflächen, Bewuchs und gefülltem
Version-2-Pigment. Palette und Standardlandfarbe kommen aus den echten
Produktdefinitionen. Das physische Wasser wird als bereits bestimmte Fläche
übergeben; Höhen werden weder neu interpretiert noch interpoliert. Grundfarbe,
Waldabdeckung, gesammelter Pigmentauftrag und resultierende Farbe bleiben getrennt.
Pigmentlöschen entfernt daher weder den ursprünglichen Boden noch Wald.

Eine erste Adapterversion fragte Dichtekorrekturen nur innerhalb eines
Farbcallbacks ab. Das verlor deren Teilpixelgrenzen. Die Nacharbeit führt jede
Clear-/Thin-/Dense-Fläche als eigene geometrische Operation und setzt den
Dichtezwischenwert pro Bewuchsfläche neu. Zusätzliche Gegenproben prüfen
unbemaltes Standardland/-wasser, einen Wasserfarbauftrag auf physisch trockenem
Gelände und überlappende Bewuchsflächen mit unterschiedlichen Korrekturen.

## Direkte Integration weicher Ränder

[convex-feather.mjs](../../../tools/atlas-prototypes/convex-feather.mjs) zerlegt
eine gültige konvexe Autorenfläche nach der jeweils nächsten Randkante. Voll
gesättigtes Inneres bildet eine gemeinsame Fläche. In jedem übrigen Teil ist
der Randabstand eine lineare Funktion; lineare Dichte und kubisches Smoothstep
können deshalb ohne rekursive Punktabtastung integriert werden.

Der Kompositor integriert nachgewiesene Polynomgrade bis drei direkt über
Dreiecksquadratur. Die Grade aufeinanderliegender Operationen werden addiert;
größere oder unbekannte Grade verlangen weiterhin eine erklärte Schranke der
fertigen Kanäle und adaptive Integration. Keine stille Herabstufung der Qualität.
Der Adapter liefert für seine normierten, deckenden Kanäle eine konservative
komponentenweise Schranke aus den Autorenradien. Diese gilt innerhalb der zuvor
nach allen Masken und Korrekturen geteilten Fläche.

[Drei wechselnde Vergleichsrunden](feather-comparison.json.gz), eine Ausgabezelle,
Einheitsquadrat mit Radius 1 m und analytischem Smoothstep-Integral 0,1:

| Verfahren | Median | Funktionsauswertungen | Ergebnis |
| --- | ---: | ---: | ---: |
| Adaptive Integration, Fehlertoleranz 0,005 | 196,7 ms | 131.072 | 0,10000085 |
| Nach Randstücken direkt integriertes Polynom | 3,93 ms | 16 | 0,1 |

Reproduktion: `node tools/measure-atlas-material-feather.mjs`. Diese Messung
ist weder eine 256²-Kachelmessung noch eine native Atlas-Latenz. Direkte
Polynomintegration beseitigt hier den Diskretisierungsfehler der Quadratur;
Gleitkomma- und spätere 8-Bit-Rundung bleiben bestehen.

## Prüfung und offene Übernahme

[35 Tests](tests-35.log.gz) bestehen: 16 bisherige Flächenprüfungen, acht neue
Rand-/Quadraturprüfungen und elf Quellenadapterprüfungen. Enthalten sind alle
analytischen Dreiecksmonome bis Grad drei, akzeptierte Source-over-Produkte samt
Reihenfolge, gedrehte Grenzen, Skalen von 10^-6 bis 10^6, große Translationen,
Kachelteilung, kollineare Punkte und umgekehrte Ringrichtung. Koordinaten der
Randzerlegung werden vor dem Vergleich relativ zur Flächenausdehnung normiert.

Die unterstützten harten Quellfälle werden gegen den tatsächlichen
`LandscapeRasterizer` geprüft; bis 1,1 Byte Rundungsabweichung ist für diese
Fixtures erlaubt. Der neue weiche Waldvertrag besitzt eigene analytische Orakel
und weist den beabsichtigten Unterschied zur alten Zoomregel ausdrücklich nach.
Zwei überlappende weiche Flächen prüfen den adaptiven Weg höheren Grades.

**Noch offen:** Legacy-Pigment und echte Pinselzüge, konkave/mehrteilige weiche
Flächen und Löcher, der direkte Anschluss an Feld-/Quellenseiten und persistente
Kacheln sowie volle Last und native Sichtprüfung. Solche nicht unterstützten
Eingaben werden im Prototyp abgewiesen, nicht übergangen. Die bewährte
Produktdarstellung bleibt verfügbar. Der nächste Schritt vervollständigt den
Quellenvertrag und misst die teuren Restfälle, bevor ein neuer Cacheformatstand
und die produktive Umstellung gerechtfertigt sind. M2 bleibt offen.

[Repositoryprüfung](check-repo.log.gz), Werkzeugsyntax und `git diff --check`
bestanden. Die tatsächlichen Testdateien sind im Terrainablauf des Capability-
Katalogs mit `--geprueft` vermerkt. Das qualifiziert nicht dessen gesamte
Save-/Undo-/Restart-Kette. Kein neuer Desktopbuild oder nativer Lauf behauptet.
