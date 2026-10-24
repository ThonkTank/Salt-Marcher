# Krümmungsfehler an echten Materialrändern

M2-Zwischenschritt auf `bd82fac3`, 24.10.2026.
[Aktuelle Roadmap](../../plans/maps/unified-spatial-atlas.md).
Isolierter Prototyp; normale Atlasdarstellung, Autoreninhalte und persistentes
Kachelformat sind unverändert.

## Entscheidung und Umsetzung

Die [vorherige Integration](../atlas-material-local-integration-20261024/README.md)
erkannte konstante Innenbereiche und affine Randabstände. An konkaven Ecken
erschienen jedoch zwei benachbarte Segmente als gleich nahe Konkurrenten, obwohl
beide dieselbe Entfernung zum gemeinsamen Endpunkt liefern. Die volle 256×256-
Probe überschritt dadurch weiterhin das Budget.

| Ansatz | Kartenqualität | Reaktion | Bearbeitbarkeit | Wartbarkeit | Umstellungsrisiko |
| --- | --- | --- | --- | --- | --- |
| Lipschitz-Schranke beibehalten | Konservativer Fehler | Volle Probe bricht ab | Autorenfolge unverändert | Einfacher Referenzweg | Niedrig, aber Last nicht tragfähig |
| **Endpunktnachweis und lokale Krümmung** | Konservativer Fehler einschließlich komponierter Kanäle | Volle Probe berechenbar; kleinere Probe deutlich günstiger | Bestehende Rand-/Dichtefolge bleibt erhalten | Gemeinsamer geometrischer Nachweis plus optionaler Fehlercallback | Mittel; Endpunkt-, Übergangs- und Kompositionsregeln separat geprüft |
| Direkte analytische Integration aller radialen Teilflächen | Potenziell ohne adaptive Radialquadratur | Noch ungemessen; benötigt weitere Teilflächenzerlegung | Zusätzliche Ableitung nach Geometrieänderung | Größerer Kern für Kreisbögen und überlagerte Materialien | Höher; bislang kein belegter Gesamtgewinn |

[general-feather.mjs](../../../tools/atlas-prototypes/general-feather.mjs)
fasst exakt identische Endpunkte zusammen. Für alle nahe liegenden Segmente
müssen die Projektionen sämtlicher Dreiecksecken auf denselben Endpunkt fallen.
Alle anderen Segmente brauchen einen sicheren Abstandsvorsprung von mehr als
zweimal dem Dreiecksradius. Nur dann gilt im ganzen Dreieck dieselbe radiale
Abstandsfunktion. Endpunktberührung, konkurrierende Merkmale, Übergänge zum
Segment und Überschreiten des Autorenradius bleiben im bisherigen adaptiven Weg.
Eine einzelne zwischengespeicherte Anfrage prüft auch die Koordinaten und wird
erst nach erfolgreicher Klassifikation aktualisiert.

Für ein Dreieck mit Schwerpunkt c und maximalem Eckabstand R ist
`dmin = d(c) - R - numerischer Sicherheitsabstand` eine untere Distanzgrenze.
Die lineare Waldkante hat dort Gradientenbetrag höchstens `1/r` und
Hesse-Norm höchstens `1/(r*dmin)`. Für `.78 * smoothstep(d/r)` ist der Gradient
höchstens `1.17/r`, die Hesse-Norm höchstens `4.68/r²`; das gilt auch für die
tangentiale Krümmung des radialen Kerns. Affine Abstandsfunktionen haben keinen
zusätzlichen radialen Waldterm, gesättigte Bereiche bleiben konstant.

Der [Quellenadapter](../../../tools/atlas-prototypes/material-sources.mjs)
führt die Schranken durch die tatsächliche Kompositionsfolge. Für normierte
Kanäle und eine Source-over-Operation gilt konservativ:
`Gneu ≤ Galt + Ga`, `Hneu ≤ Halt + Ha + 2*Galt*Ga`.
Die Dichtekorrekturen und Pigmentmasken sind innerhalb der geometrisch bereits
aufgeteilten Fläche konstant. Ein bloßes Addieren isolierter Hesse-Schranken
würde den Kreuzterm verlieren und ist deshalb nicht ausreichend.

Die mittlere Abweichung der Schwerpunktnäherung ist höchstens
`H * Summe(|Ecke-c|²) / 24`. Der
[Kompositor](../../../tools/atlas-prototypes/material-area.mjs) multipliziert
diese Schranke mit dem Flächenanteil und verwendet das Minimum aus ihr und der
bisherigen Lipschitz-Schranke. Ein unbekanntes Merkmal liefert keine neue
Schranke; negative, nicht endliche oder falsch formatierte Callbackwerte werden
abgewiesen. Die bestehende gemeinsame Fehlersumme aller Zellteilflächen bleibt
maßgeblich. Die Garantie betrifft Quadratur, nicht Geometrie-/Clippingfehler,
sämtliche Maschinenrundungen oder spätere 8-Bit-Quantisierung.

## Prüfung und Nacharbeit

Die unabhängige mathematische Prüfung bestätigte Endpunktnachweis,
Krümmungskonstanten, Kreuzterm und Schwerpunktfehler unter diesen Voraussetzungen.
Eine erste Testfassung war dagegen ungeeignet: Sie benutzte konvexe Rechtecke und
wendete auch geometrisch inaktive Stücke an. Sie wurde durch zwei echte gelochte
Bewuchsflächen und einen gemeinsamen radialen Teilbereich ersetzt. Das separate
Orakel berechnet Lochabstand und Source-over direkt; seine Dreiecksquadratur
enthält beide Orientierungen und deckt die gesamte Fläche ab.

[61 gezielte Tests](tests-61.log.gz) bestehen. Die fünf neuen
[Krümmungsprüfungen](../../../tests/atlas-material-curvature.test.mjs) ergänzen
die bisherigen 56 Flächen-, Quellen-, Rand- und Ressourcenprüfungen:
Endpunktgleichheit, konkurrierende Grenzen, Klemmübergang, Endpunktberührung,
veränderte Eingabedreiecke, wiederholt abgewiesene numerische Eingaben,
Weltmaßstäbe/Translationen, zwei überlagerte Bewuchsflächen, unbekannte Layer,
ungültige Fehlerschranken und die vollständige 256×256-Regression.
Die volle Kachel prüft Wald- und Bodenmittel gegen unabhängige analytische
Integrale sowie jede Zellschranke gegen 1/255.

## Messung und Grenzen

[Messwerkzeug](../../../tools/measure-atlas-material-curvature.mjs),
[Rohdaten einschließlich Quellhashes](comparison.json.gz): jeweils drei Runden
mit wechselnder Reihenfolge, ohne parallele Testlast. Derselbe 6×6-m-Ring mit
mittigem 2×2-m-Loch, Radius 0,5 m, Dichte 0,4, Zielgenauigkeit 1/255.
Arbeitsbudget 2000000 und Warteschlangenlimit 65536 bleiben unverändert.

| Auflösung | Bisherige lokale Integration, Median | Mit Krümmung, Median | Arbeit mit Krümmung |
| --- | --- | --- | --- |
| 1×1 | 425 ms | 385 ms | 174793 |
| 16×16 | 1900 ms | 475 ms | 259432 |
| 256×256 | Budgetabbruch in allen drei Runden | 2768 ms; alle drei Runden erfolgreich | 1717443 |

Für 256×256: Waldmittel 0,33432695358 gegenüber analytisch 0,33432686035;
Bodenmittel 0,47860517690 gegenüber 0,47860508806. Die maximale Zellschranke
beträgt 0,00392122948 ≤ 1/255, die mittlere Schranke 0,00018853129.
Die Warteschlange erreicht höchstens 308 Dreiecke. Ein Geschwindigkeitsfaktor
gegenüber einem abbrechenden Lauf wird nicht behauptet.

Der bisherige Budgetabbruch ist für diese synthetische volle Kachel behoben.
Rund 2,77 Sekunden sind trotzdem kein hinreichender Produkt-Leistungsnachweis.
Reale Quellen-/Feldseiten, große Weltlast, native Reaktion und die vollständige
M2-Abnahme bleiben offen. Nächster Schritt ist der Version-2-Pinselvertrag mit
Kreis-/Texturgrenzen und gespeicherter Deckkraftfolge, danach der Quellenanschluss
und eine erneute Messung der weiterhin hohen Materialkosten unter realer Last.

[Repositoryprüfung](check-repo.log.gz), Werkzeugsyntax und `git diff --check`
bestanden. Tatsächliche Tests und Werkzeug sind mit `--geprueft` im Capability-
Ablauf vermerkt; das ist keine komplette Save-/Undo-/Restart-Qualifikation.
Kein neuer Desktopbuild, keine Main-Integration und kein nativer Produktgewinn
werden behauptet. M2 bleibt aktiv.
