# Flächengetreue Materialkomposition: Prototyp und Gegenproben

M2-Arbeit auf `067bbc0ef`, 24.10.2026. Die einzige Roadmap bleibt
[der Atlasplan](../../plans/maps/unified-spatial-atlas.md). Dieser mathematische
Prototyp ist **nicht im Produktpfad angeschlossen**. Kein nativer Produktgewinn,
keine neue Abnahme, keine Main-Integration.

## Befund und Umsetzung

Die [vorherige Gegenprobe](../atlas-material-stream-20261024/README.md) zeigte
0 m² grobe und etwa 301 m² feine Waldabdeckung für einen 150-m²-Streifen.
Mehr Abtastpunkte beseitigen die Ortsabhängigkeit nicht grundsätzlich. Getrennt
gemittelte Polygonanteile sind ebenfalls unzureichend: Zwei halbe Pixel können
dieselbe oder verschiedene Hälften bedecken. Materialreihenfolge, Transparenz
und Wasser müssen vor der Flächenmittelung zusammengesetzt werden.

[Der Prototyp](../../../tools/atlas-prototypes/material-area.mjs) teilt eine
Ausgabezelle deshalb durch Quellgeometrien in disjunkte Flächen. Jede Teilfläche
behält ihre geordneten Materialoperationen. Erst deren Ergebnis wird nach Fläche
gemittelt. Polygonlöcher und überlappende Teile bleiben räumlich unterscheidbar.
Höhenfelder und kanonische Autorendaten werden nicht geändert.

Die erste Variante schnitt jede Zelle gegen ganze Quellpolygone. Zwei gemessene
Nacharbeiten verbessern sie:

1. Konservative Randmarkierung: Nur Zellen ohne berührenden Quellrand dürfen
   vollständig innen/außen klassifiziert werden. Dünne Inseln, Löcher und schräge
   Kanten landen weiterhin im exakten Clipping.
2. Hierarchische Quellstücke bis zu 16-Pixel-Blöcken: Eine Randzelle verarbeitet
   nur ihr begrenztes Zwischenstück, statt immer die ganze Weltgeometrie zu schneiden.

## Geprüfte Ergebnisse

[16 Tests](tests-16.log.gz) enthalten analytische Orakel für den ursprünglichen
0,25 × 600-m-Streifen, Löcher, deckungsgleiche/getrennte transparente Flächen,
Reihenfolge, große Koordinaten, Wasser-/Pigmentkorrelation, Löschen sowie
Clear/Thin/Add-Dichteoperationen. Variable Flächen mit Löchern und getrennten
Komponenten prüfen auch die Triangulierung. Vollständiges und beschleunigtes
Clipping stimmen für diagonale Kanten, überlappende Teile und detaillierte
Ringgeometrie überein. Das sind Kompositionsmodelle; sie qualifizieren noch nicht
den Adapter für alle vorhandenen produktiven `LandscapeRecord`-Varianten.

Der Streifen liefert unquantisiert exakt **150 m²** in Übersicht und allen 16
Kindern zusammen. Mit der vorhandenen 8-Bit-Quantisierung sind es in beiden
Stufen **150,588 m²**. Die Quantisierung wird damit nicht als exakte Flächenerhaltung
ausgegeben. Die alte Produktionsabtastung liefert weiterhin 0/301,176 m².

[Vergleichsläufe](comparison.json.gz), reproduzierbar mit
`node tools/measure-atlas-material-area.mjs`:

| Gegenprobe | Vor Nacharbeit | Mit Nacharbeit | Aussage |
| --- | ---: | ---: | --- |
| Vollständig bedeckte 256²-Kachel, Innenzellen direkt übernehmen | 3.975 ms | 151 ms | Einzelpaar, gleiche Fläche; kein Produktbenchmark |
| Detaillierte Kreisgrenze, 1.024 Segmente; ganze Quelle vs. lokale Stücke | Median 5.698 ms | Median 300 ms | Drei wechselnde Runden; gleiche Fläche und identischer 8-Bit-Hash |
| Quellpunkte je Rand-Clipping bei der Kreisgrenze | 1.025 | höchstens 33 | Ursache der Einsparung |

Die [erste Messung](initial.json.gz) dokumentiert den verworfenen Vollclip-Pfad
mit rund 2,4 s für die breite Fläche. Einzelzeiten schwanken; die stärkere
Entscheidungsbasis sind gleichbleibende Ergebnisse und begrenzte lokale Geometrie.
Produktionsraster und Prototyp leisten unterschiedliche Vorbereitungsarbeit;
ihre Zeiten dürfen nicht als native Beschleunigung gegeneinander verrechnet werden.

## Grenzen und nächste Entscheidung

Weiche Ränder werden pro geometrischer Teilfläche adaptiv integriert. Die
Fehlerschranke verlangt eine vom Aufrufer belegte Lipschitz-Konstante für die
**fertig zusammengesetzten Kanäle**; ein unbekannter Wert wird abgewiesen.
Eine glatte Einheitsquadrat-Probe mit analytischem Integral 0,1 liefert bei
Toleranz 0,005 etwa 0,10000085, benötigt aber schon 131.072 Auswertungen und rund
306 ms für eine einzige Ausgabezelle. Dies ist noch kein geeigneter allgemeiner
Produktalgorithmus für weiche Vegetation.

Zusätzlich verwendet `paintCoverSteps` derzeit `max(preset.edge, displayMpp*3)`.
Bei gleichem schmalem Streifen und Autorenradius 1 m entspricht die exakt
integrierte weiche Abdeckung rechnerisch etwa 0,016 m² bei 4 m/Pixel und 0,255 m²
bei 1 m/Pixel. Diese Rechnung verwendet Einheitsdichte und die vorhandene
Smoothstep-Distanzregel. Selbst perfekte Integration kann einen wechselnden
Radius nicht maßstabsunabhängig machen.

| Nächste Vertragsoption | Qualität und Bearbeitung | Kosten/Wartung | Risiko |
| --- | --- | --- | --- |
| Zoomradius unverändert im Waldkanal behalten | Gleiche heutige Regel, aber weiterhin wechselnde semantische Abdeckung | Geringster Umbau; präzise Integration behebt Ursache nicht | Verfehlt flächenstabile Materialstufen |
| **Autorenradius für Materialabdeckung; Bildschirmweichheit separat darstellen** | Autorenform, Dichte und echte weiche Ränder bleiben weltbezogen | Klarer Kanalvertrag; getrennte Darstellung in M4 nötig | Quellenadapter und Übergänge müssen qualifiziert werden |
| Weiche Autorenränder vollständig aus Waldabdeckung entfernen | Stabile harte Fläche, aber verlorene Autorenabsicht | Einfacher und günstiger | Nicht ohne fachliche Rechtfertigung übernehmen |

Die zweite Option ist der nächste zu prüfende Anschluss. Vor produktiver
Übernahme: reale Quellenreihenfolge und Wasserklassifikation erhalten,
Pigment-/Dichtekorrekturen direkt gegen den vorhandenen Rasterizer prüfen,
weiche Integration mit tragbarer Fehlerschranke entwickeln und Cacheversionen
bei geänderter Kanalbedeutung anheben. Noch kein Produktpfad wurde ersetzt.

Grenzen für Eingabe-/Zell-/Cachepunkte, Flächen, Cacheeinträge, Klassifikationsbytes
und Arbeitszähler weisen Überlast ausdrücklich ab; es gibt keinen stillen
Qualitätsrückfall. Ein Zähler für Bibliotheksaufrufe ist **keine harte Zeitgrenze**;
einzelne Clipping-/Triangulierungsaufrufe bleiben synchron. Die unabhängige Prüfung
führte nach der Messung zusätzlich eine Grenze für Cacheeinträge ein, damit leere
Quellstücke nicht nur über ihren Punktumfang gezählt werden. Die abschließenden
16 Tests prüfen diese Grenze; die Messdatei enthält den Hash vor dieser Zählerergänzung.

Formgültige einfache Polygone und korrekt deklarierte variable Operationen sind
Voraussetzung dieses isolierten Prototyps. Er ist keine neue unvalidierte Main-
oder Preload-Schnittstelle. Worker-Unterbrechbarkeit, tatsächliche Speicherlast,
volle M0-Welt, native Darstellung und Benutzerabnahme bleiben offen. Die Testdateien
sind im bestehenden Terrainablauf des Capability-Katalogs verknüpft; dies ist kein
Nachweis der gesamten dort beschriebenen Save-/Undo-/Restart-Kette.

[Repositoryprüfung](check-repo.log.gz), Syntaxprüfungen beider Werkzeuge und
`git diff --check` bestanden. Keine Produktdatei geändert; daher kein neuer
Desktopbuild oder nativer Lauf als Beleg dieses Prototyps ausgegeben.
