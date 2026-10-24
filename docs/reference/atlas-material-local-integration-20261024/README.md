# Lokale Randintegration und gemeinsames Zellfehlerbudget

M2-Zwischenschritt auf `20894688`, 24.10.2026.
[Aktuelle Roadmap](../../plans/maps/unified-spatial-atlas.md).
Isolierter Materialprototyp; keine Umstellung der normalen Atlasdarstellung,
kanonischen Inhalte oder persistenten Kachelversion.

## Befund und Entscheidung

Die [vorherige Gegenprobe](../atlas-material-complex-source-20261024/README.md)
überschritt bei einem einzigen gelochten Materialfeld das Arbeitsbudget von zwei
Millionen Schritten. Die globale Lipschitz-Schranke wurde auch in unveränderlichen
Innenflächen verwendet. Zudem musste jedes kleine Dreieck dieselbe punktweise
Genauigkeit erreichen, obwohl sein Flächenanteil im fertigen Pixel zählt.

| Ansatz | Kartenqualität | Reaktion | Bearbeitbarkeit | Wartbarkeit | Umstellungsrisiko |
| --- | --- | --- | --- | --- | --- |
| Einheitliche lokale Fehlertoleranz | Konservative Schranke, unveränderte Quellen | Zielprobe überschreitet Budget | Keine Änderung der Autorendaten | Einfacher Referenzweg | Niedrig, aber für diese Last unbrauchbar |
| **Geometrische Zertifikate plus Zellfehlerbudget** | Gleiche geforderte Pixelgenauigkeit; unbekannte Bereiche bleiben adaptiv | Zielprobe endet unter gleichem Arbeitsbudget | Bestehende Quellen-/Dichtefolge bleibt erhalten | Kleine optionale Klassifikation und begrenzte Prioritätswarteschlange | Mittel; Zertifikate und Summenfehler separat zu prüfen |
| Vollständige Rand-Voronoi-Zerlegung mit analytischen Kreissektoren | Potenziell direkte Integration auch an konkaven Ecken | Noch ungemessen, zusätzliche Vorverarbeitung | Neue Ableitung bei Geometrieänderungen | Deutlich größerer geometrischer Kern und degenerierte Fälle | Höher; derzeit kein belastbarer Gesamtgewinn |

Der gewählte Ansatz verfeinert die bestehende Flächenintegration; er ersetzt
sie nicht durch eine punktabgetastete Abdeckungsmaske. Die Referenzstrategie
`uniform` bleibt für identische Gegenproben ausführbar.

## Implementierung und unabhängige Prüfung

[general-feather.mjs](../../../tools/atlas-prototypes/general-feather.mjs)
liefert optional `polynomialDegreeOnTriangle`. Die Klassifikation verwendet die
wirklichen Außen-/Lochsegmente nach Vereinigung der Quellen:

- Übersteigt der Randabstand am Dreiecksschwerpunkt abzüglich des maximalen
  Abstands zu seinen Ecken den Autorenradius sicher, ist der gesamte Teil konstant.
- Ein Abstandsvorsprung zur zweitnächsten Kante von mehr als zweimal diesem
  Dreiecksradius beweist dieselbe nächste Kante im ganzen Dreieck. Die Projektionen
  aller Ecken müssen innerhalb des Segments liegen und dieselbe Seite belegen.
- Der affine Abstand darf auch die Sättigungsgrenze des Autorenradius nicht
  überschreiten. Unklare Fälle, Endpunkte, Randwechsel und numerisch knappe
  Vergleiche bleiben unklassifiziert. Relative Koordinaten und ein konservativer
  numerischer Abstand berücksichtigen auch große Welttranslationen.

Lineare Dichte wird direkt integriert; Smoothstep-Bodenfarbe ergibt Grad drei.
Der [Quellenadapter](../../../tools/atlas-prototypes/material-sources.mjs)
überträgt diese lokalen Grade, der
[Kompositor](../../../tools/atlas-prototypes/material-area.mjs) addiert sie
über aktive Operationen. Zwei kubische Transformationen bleiben daher Grad sechs
und werden nicht fälschlich mit einer kubischen Regel integriert.

Unbekannte Dreiecke erhalten eine Mittelpunktnäherung und den konservativen
Fehlerbeitrag `Lipschitz × Dreiecksradius × Flächenanteil`. Eine Warteschlange pro
Ausgabezelle verfeinert den größten Beitrag zuerst. Sie umfasst alle geometrischen
Teilflächen und getrennten Komponenten; beim Verfeinern werden Schätzwert und
Fehler des Elternteils vor dem Einfügen der Kinder entfernt.

Die unabhängige Code-/Mathematikprüfung bestätigte diese Regeln und fand eine
numerische Schwäche der ersten Summenführung: Viele Additionen/Subtraktionen
können die inkrementelle Fehlersumme verschieben. Vor Freigabe wird deshalb die
Summe der positiven verbleibenden Beiträge erneut gebildet und um eine
konservative Summationsrundung erweitert. Es gibt kein Verstecken negativer
Summendrift durch Nullsetzen. Das ist weiterhin eine Quadraturfehlergarantie;
Geometrie-Gleitkomma und spätere 8-Bit-Ausgabe sind getrennte Fehlerquellen.

Das Arbeitsbudget bleibt bei 2000000. Zusätzlich begrenzen 65536 wartende
Dreiecke den neuen Speicherbestand. Überschreitungen von Arbeit, Tiefe oder
Warteschlange brechen ohne Teilveröffentlichung ab. Diese Zählgrenzen ersetzen
noch keine vollständige Byte-/Laufzeitqualifikation aller Quellen und Clipper.

## Gegenprobe unter identischen Anforderungen

[Messwerkzeug](../../../tools/measure-atlas-material-local.mjs),
[Rohdaten und Quellhashes](comparison.json.gz). 6×6-m-Quadrat mit 2×2-m-Loch,
Autorenradius 0,5 m, Dichte 0,4, geforderter Zellfehler 1/255. Drei Runden mit
wechselnder Reihenfolge und unveränderten Standardbudgets:

| Verfahren, eine Ausgabezelle | Ergebnis in allen drei Runden |
| --- | --- |
| Einheitliche Toleranz ohne lokale Zertifikate | Arbeitsbudget überschritten |
| Einheitliche Toleranz mit lokalen Zertifikaten | Arbeitsbudget überschritten |
| Zellfehlerbudget ohne lokale Zertifikate | Warteschlangenbudget überschritten |
| **Zellfehlerbudget mit lokalen Zertifikaten** | **Erfolgreich; 190067 Arbeitsschritte, Median 367 ms** |

Die Kombination liefert Waldmittel 0,33432607646 bei analytisch 0,33432686035.
Tatsächlicher Fehler: 0,000000784; erklärte Grenze: 0,00392111930 ≤ 1/255.
18610 wartende Dreiecke im Maximum, 7336 lokal als konstant integrierte Dreiecke.
Ein Beschleunigungsfaktor gegenüber den abbrechenden Varianten wird nicht behauptet.

Die synthetische Ausweitung auf 16×16 Ausgabezellen besteht mit 862122 Schritten
und rund 1,86 s; 256×256 überschreitet nach rund 3,08 s weiterhin das Arbeitsbudget.
Diese zwei Läufe sind Einzelproben desselben Feldes, keine native Atlas-Latenz
und keine vollständige Weltlast. Toleranz und Arbeitsbudget wurden für diese
Ergebnisse nicht gelockert.

## Validierung und nächster Schritt

[56 gezielte Tests](tests-56.log.gz) bestehen, darunter die sieben neuen
[lokalen Prüfungen](../../../tests/atlas-material-local-degree.test.mjs) und eine
[Regression der bisherigen 1/255-Budgetüberschreitung](../../../tests/atlas-material-complex-source.test.mjs).
Die bisherigen Flächen-, Quellen-, Legacy-, Loch-, Skalen- und konvexen
Quadraturprüfungen bleiben grün. Neue Fälle prüfen Sättigungs-/Kantengrenzen,
Segmentendpunkte, nicht entartete Dreiecke, Translationen, Gradaddition anhand
des analytischen Integrals von x^6, getrennte Teilflächen, Summenfehler sowie
Abbrüche bei ausgeschöpfter Tiefe oder Warteschlange.

Die volle synthetische Kachel ist noch nicht qualifiziert. Nächste Arbeit:
gekrümmte Innen-/Lochkanten mit konservativen lokalen Krümmungsfehlern oder
direkter Punktabstandsintegration günstiger behandeln und erneut gegen die
Lipschitz-Referenz prüfen. Version-2-Pinselzüge, Feld-/Quellenseitenanschluss,
Produktkacheln und native Weltlast bleiben ebenfalls offen. M2 bleibt aktiv.

[Repositoryprüfung](check-repo.log.gz), Werkzeugsyntax und `git diff --check`
bestanden. Testdateien und Messwerkzeug sind im tatsächlichen Capability-Ablauf
mit `--geprueft` vermerkt; das qualifiziert nicht die gesamte Save-/Undo-/Restart-
Kette. Kein neuer Desktopbuild, keine Main-Integration und kein nativer
Produktgewinn werden behauptet.
