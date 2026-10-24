# Flächenmittel für runde Pigmentstempel

M2-Zwischenschritt auf `4b71862b9`, 24.10.2026.
[Aktuelle Roadmap](../../plans/maps/unified-spatial-atlas.md).
Isolierter Prototyp; produktive Kachelversion, Autorenquellen und normaler Atlas
sind durch diesen Schritt nicht umgestellt.

## Entscheidung und Vertrag

Die vorherige Quellenintegration brachte weiche und strukturierte Einzelstempel
innerhalb der bestehenden Budgets. Eine volle Rundstempelkachel scheiterte weiter:
Punktintervalle behandeln jeden Kreisschnitt als beliebig verteilte Deckkraft.
Eine engere Abstandsprüfung hatte diesen Kostenfall bereits nicht gelöst.

| Ansatz | Kartenqualität | Reaktion | Bearbeitbarkeit | Wartbarkeit | Umstellungsrisiko |
| --- | --- | --- | --- | --- | --- |
| Punktintervalle weiter unterteilen | Bisheriges Fehlerziel erhalten | Volle Rundprobe scheitert weiter | Quellen unverändert | Einfacher Rückfallpfad | Niedrig, Kostenproblem bleibt |
| **Analytische Kreisflächen und sichere Mittelwertkomposition** | Gleiche Zellschranke, gespeicherte Deckkraft und Reihenfolge erhalten | Einzelne und überlappende Rundkacheln jetzt berechenbar | Ableitung aus unveränderten Quellen | Eigene Geometrie- und Momenthelfer | Mittel; Überlappung, Radieren und numerische Unsicherheit geprüft |
| Kreise polygonalisieren und komplett schneiden | Zusätzlicher Näherungsfehler muss begrenzt werden | Viele Stempel können große Schnittanordnungen erzeugen; hier nicht gemessen | Quellen bleiben erhalten | Nutzt vorhandene Polygonoperationen, benötigt zusätzliche Auflösungsregel | Mittel bis hoch; Kosten und Fehler bei vielen Überlappungen offen |

[circle-triangle.mjs](../../../tools/atlas-prototypes/circle-triangle.mjs)
integriert orientierte Dreieckskanten als Kreisabschnitte beziehungsweise
Geradenstücke. Verschiebung und Skalierung begrenzen Zwischenwerte. Zuschläge
für Rechenoperationen, Kreisrandunsicherheit und Dreieckskanten gehen in den
Flächenfehler ein. Nicht auflösbare Radien, entartete Dreiecke und zu unsichere
Normierung liefern keinen Schätzwert. Der vorhandene Intervallweg bleibt zuständig.
Dies ist keine formale Zertifizierung der Host-Mathematikbibliothek oder des
gesamten Polygon-Clippings.

[round-stroke-mean.mjs](../../../tools/atlas-prototypes/round-stroke-mean.mjs)
nutzt eine Eigenschaft des gespeicherten Formats: Innerhalb eines runden
Pigmentdatensatzes haben alle Stempel denselben Fluss. Der Alpha-Wert hängt daher
nur von der Trefferzahl ab. Eine Tabelle reproduziert Float32 nach jedem Treffer
und die abschließende Byte-Rundung einschließlich Datensatzdeckkraft.
Stempel am selben Mittelpunkt treffen gemeinsam und werden entsprechend gruppiert.

Bei nur einer teilweise getroffenen Gruppe ist ihr Mittel direkt aus der
Kreisfläche berechenbar. Bei mehreren Gruppen liefert die Summe ihrer gewichteten
Flächen die erwartete Trefferzahl. Untere konvexe und obere konkave Hüllen der
Alpha-Tabelle begrenzen daraus das Alpha-Mittel für **jede** gemeinsame Verteilung
der Treffer. Es wird weder Unabhängigkeit angenommen noch die überlappende Farbe
einfach addiert. Unterschiedliche Datensätze werden weiter in Autorenreihenfolge
komponiert.

[material-mean.mjs](../../../tools/atlas-prototypes/material-mean.mjs)
führt Wertebereiche und Mittelwertintervalle für alle 14 privaten Materialkanäle.
McCormick-Schranken begrenzen die Produkte in `X(1-A)+yA`. Beim Radieren in einen
räumlich veränderlichen Untergrund gilt `E[X]-E[XA]+E[YA]`, mit getrennten
Produktgrenzen aus Wertebereichen und ersten Momenten. Diese Grenzen müssen auch
entgegengesetzte räumliche Zusammenhänge zulassen. Die Mittelwerte allein legen
diese Zusammenhänge nicht fest.

Weiche und strukturierte Quellen liefern weiterhin glatte Näherungen samt
Quantisierungsfehler oder ihre bisherigen Werteintervalle. Der Adapter wählt
zwischen vollständigem glattem Schätzwert und vollständiger Mittelwertkomposition;
ein Kreiswert allein ersetzt keine ungeprüfte Materialfolge. Die neuen
Momentberechnungen werden nur bei aktiven Rundstempeln angefordert.

## Prüfungen und Nacharbeit

[120 gezielte Prüfungen](tests-120.log.gz) bestehen, einschließlich der bisherigen
102 Prüfungen. Neue Belege:

- [Kreis-Dreieck-Geometrie](../../../tests/atlas-material-circle-triangle.test.mjs):
  vollständige, halbe und Viertelkreise, Tangenten, Windung, Partitionierung,
  große Verschiebungen, sehr kleine/große Skalen und unaufgelöste dünne Dreiecke.
- [Mittelwertzustand](../../../tests/atlas-material-mean-state.test.mjs):
  konstante und veränderliche Blendziele, korrelierte Gegenproben, Bewuchs,
  Legacy-Deckkraft und Datensatzreihenfolge.
- [Quellenanschluss](../../../tests/atlas-material-round-mean.test.mjs):
  bis zu 4000 gemeinsame Stempel, ungleiche wiederholte Gruppen, analytische
  Kreisüberschneidung, volle Rundkachel, Malen/Radieren in beiden Reihenfolgen
  und alle Materialkanäle einer Mischquelle gegen zwei dichte Quellenraster.
  Der Rastervergleich ist numerische Evidenz, kein Beweis seiner eigenen
  Diskretisierungsgrenze.

Die Durchsicht vor Anschluss korrigierte einen fehlerhaften Entwurf für
veränderliche Radierziele und ergänzte dessen Gegenprobe. Numerische Rand- und
Koordinatenzuschläge wurden vor der abschließenden Messung ergänzt; unaufgelöste
Geometrie wird abgelehnt. Eine weitere unabhängige Durchsicht fand anschließend
keinen konkreten Fehler. Das ersetzt weder die Tests noch native Abnahme.
Die tatsächlichen Testdateien sind im Capability-Katalog verknüpft und geprüft
markiert; damit wird keine vollständige Abdeckung des dortigen Gesamtworkflows behauptet.

## Kosten und nächste Arbeit

[Messwerkzeug](../../../tools/measure-atlas-material-round-mean.mjs),
[drei wechselnde Vergleichsrunden](comparison.json.gz): 4×4 m, 1/255 Zellziel,
unveränderte Arbeits-, Warteschlangen- und Tiefenlimits. Die Referenz schaltet
nur den neuen Rundmittelweg aus; glatte Schätzwerte und Texturschnitte bleiben
auf beiden Seiten aktiv. Die abschließenden Runden laufen nacheinander ohne
parallele Tests. Quellhashes vor und nach der Reihe müssen übereinstimmen.

| Pixel | Quelle | Referenz (Median; fertig) | Rundmittel (Median; fertig) | Arbeit neu |
| --- | --- | --- | --- | --- |
| 1×1 | Einzelstempel | 74 ms; 3/3 | 1 ms; 3/3 | 28 |
| 1×1 | Zwei überlagerte Stempel | 68 ms; 3/3 | 2 ms; 3/3 | 200 |
| 1×1 | Mischquelle | 1599 ms; 3/3 | 320 ms; 3/3 | 29978 |
| 16×16 | Einzelstempel | 611 ms; 3/3 | 13 ms; 3/3 | 2698 |
| 16×16 | Zwei überlagerte Stempel | 474 ms; 3/3 | 28 ms; 3/3 | 3314 |
| 16×16 | Mischquelle | 2412 ms; 3/3 | 2639 ms; 3/3 | 245428 |
| 256×256 | Einzelstempel | 3562 ms; 0/3 | 640 ms; 3/3 | 595942 |
| 256×256 | Zwei überlagerte Stempel | 3502 ms; 0/3 | 700 ms; 3/3 | 597922 |
| 256×256 | Mischquelle | 3850 ms; 0/3 | 9676 ms; 0/3 | 2000001 |

Die Mischprobe verbindet Bewuchs mit rundem und weichem Farbauftrag sowie einem
strukturierten Radierer. Ihre volle Kachel bleibt offen. Weniger Unterteilungen
allein garantieren keinen Laufzeitgewinn: Die zusätzliche Mittelwertkomposition
hat eigene Kosten, und die flächendeckend aktiven Quellen verursachen weiterhin
Arbeit auch außerhalb ihrer tatsächlichen Pinselwirkung. Die Messung begründet
als nächsten Versuch eine konservative räumliche Begrenzung der aktiven
Pinselquellen; der Gewinn dieses Ansatzes ist noch nicht gemessen.

Danach folgen tatsächliche Weltlast, Feld-/Quellenseitenanschluss und produktive
Cacheumstellung. Keine Aussage über native Reaktion, kalte Übersicht unter zwei
Sekunden, Main-Integration oder Release. M2 und das Gesamtziel bleiben offen.
Syntaxprüfungen, `git diff --check` und [Repositoryprüfung](check-repo.log.gz)
gehören zum Abschluss dieses Prototypschritts.
