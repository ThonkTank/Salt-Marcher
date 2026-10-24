# Version-2-Pigment im Materialflächenprototyp

M2-Zwischenschritt auf `3bdd7f3ee`, 24.10.2026.
[Aktuelle Roadmap](../../plans/maps/unified-spatial-atlas.md).
Isolierter Prototyp: keine Änderung an normaler Atlasdarstellung, Nutzerdaten,
Speicherformat oder produktiver Kachelversion.

## Quellenvertrag und Entscheidung

Der [Quellenadapter](../../../tools/atlas-prototypes/material-sources.mjs)
verarbeitet jetzt auch Version-2-Pinselzüge, einschließlich runder, weicher und
strukturierter Spitze, getrennter Zugteile, gespeicherter Stempelreihenfolge,
Wasser-/Landziel und Farbe auftragen/radieren. Der
[skalare Quellenhelfer](../../../tools/atlas-prototypes/pigment-stroke.mjs)
übernimmt die Produktionsabstände von einem halben Radius, Float32-Rundung nach
jedem Stempel und anschließende Byte-Rundung der Deckung vor der Record-Deckkraft.
Das Limit von 4000 Stempeln lehnt den ganzen Auftrag ab, statt Inhalte abzuschneiden.
Nicht darstellbare Radienquadrate, subnormale Radienquadrate und nicht endliche
Texturkoordinaten werden ausdrücklich abgewiesen.

Kreisgrenzen, Texturzellen und Byte-Stufen sind echte Unstetigkeiten. Eine bloße
Lipschitz- oder Krümmungsschranke würde dort einen nicht belegten Fehler ausweisen.
Der [Integrator](../../../tools/atlas-prototypes/material-area.mjs) verlangt für
solche Layer einen gültigen Fehlercallback. Ohne gültige Schranke wird die Kachel
abgewiesen. Konstante lokale Deckkraftintervalle dürfen weiterhin direkt integriert
werden. Der Callback erhält den kanonischen Hintergrund und eine einmalig
berechnete Schwerpunktprobe; diese Probe wird für die Schätzung wiederverwendet.

[Materialintervalle](../../../tools/atlas-prototypes/material-interval.mjs)
führen Quellenintervalle durch die ganze aktive Komposition: Grund, Wald,
Dichtekorrektur, Legacy-Pigment, Version-2-Farbe und Radieren. Source-over-Blends
werden über die Ecken ihrer Werteintervalle eingeschlossen. Der neue Farbanteil
wächst mit neuer Deckkraft und sinkt mit vorheriger Deckkraft; die Division in
unvormultiplizierten RGB-Kanälen wird darüber begrenzt. Der maximale Abstand der
Schwerpunktprobe zu den Kanalintervallen begrenzt auch den mittleren Fehler.
Geometrische Masken gehören weiterhin zur exakten Flächenpartition.

## Prüfungen

[77 gezielte Tests](tests-77.log.gz) bestehen, einschließlich aller bisherigen
61 Prototypprüfungen. Neue Belege:

- [Quellenvergleich](../../../tests/atlas-material-pigment-stroke.test.mjs):
  direkte Übereinstimmung mit gebündeltem Produktionscode für alle drei Spitzen
  an 43008 Rasterpunkten, weit entfernte Koordinaten, Überlagerung/Reihenfolge,
  Kreis-/Texturgrenzen, konstante Intervalle, Eingabeschranken und Ressourcenlimit.
- [Unstetige Integration](../../../tests/atlas-material-discontinuous-area.test.mjs):
  analytische Sprungfunktion, fehlende/ungültige Schranken, wiederverwendete
  Schwerpunktprobe und lokale Konstantenzertifikate.
- [Tatsächliche Komposition](../../../tests/atlas-material-v2-integration.test.mjs):
  analytische Kreisfläche mit korrekter Float32-/Byte-Deckkraft, echte Pinselzüge
  in beiden Auftrag-/Radierreihenfolgen, Wasserziel und erhaltener Waldkanal,
  Produktionsgegenprobe für weiche/strukturierte Deckkraft sowie drei vollständig
  in aktiven Flächen liegende Dreiecke mit Bewuchs und zwei Pigmentzügen.
  Die Dreiecksgegenprobe umfasst beide Orientierungen einer vollständigen
  gleichflächigen Unterteilung und prüft Wertebereiche und Mittelwerte.

Die numerische Gegenprobe ist kein Beweis für alle möglichen Eingaben. Die
Distanzintervalle enthalten einen binären Rundungszuschlag; dieser und die
Kompositionszuschläge sind keine vollständige Maschinen-/Clippingfehleranalyse.
Die Fehlerschranke beschreibt die Quadratur des floatbasierten Prototypvertrags.
Die Quelle übernimmt die Produktionsrundung pro Stempel exakt; finale
Record-übergreifende Farben bleiben Floatkomposition, nicht bitidentische
8-Bit-Produktionsausgabe. Capability-Verknüpfungen wurden aktualisiert; sie sind
keine vollständige Save-/Restart- oder native Produktabnahme.

## Ressourcenprobe und nächste Entscheidung

[Messwerkzeug](../../../tools/measure-atlas-material-v2.mjs),
[drei sequenzielle Messrunden](comparison.json.gz): ein Radius-1-m-Stempel in
4×4 m, wechselnde Spitzenreihenfolge, 1/255 Zellfehler, unveränderte Budgets
(2 Millionen Arbeitsschritte, 65536 offene Dreiecke). Jede erfolgreiche runde
Probe wird zusätzlich gegen die analytische Kreisfläche geprüft. Dies ist eine
synthetische Quellenprobe, keine Weltlast- oder native Reaktionsmessung.

| Pixel | Spitze | Ergebnis in 3 Runden | Median | Arbeit bei Erfolg |
| --- | --- | --- | --- | --- |
| 1×1 | round | 3/3 fertig | 59 ms | 26638 |
| 1×1 | soft | 3/3 fertig | 172 ms | 56078 |
| 1×1 | textured | 0/3 fertig; Budgetabbruch | 1116 ms | — |
| 16×16 | round | 3/3 fertig | 545 ms | 259036 |
| 16×16 | soft | 3/3 fertig | 5124 ms | 1748730 |
| 16×16 | textured | 0/3 fertig; Budgetabbruch | 4717 ms | — |
| 256×256 | round | 0/3 fertig; Budgetabbruch | 3598 ms | — |
| 256×256 | soft | 0/3 fertig; Budgetabbruch | 4704 ms | — |
| 256×256 | textured | 0/3 fertig; Budgetabbruch | 3956 ms | — |

Der Quellenanschluss ist implementiert; die Ressourcengrenze ist weiterhin offen.
Auch der einfache weiche Stempel ist bei voller Kachel noch zu teuer. Bei
strukturierter Spitze müssen nicht ausgerichtete Texturzellgrenzen immer wieder
adaptiv eingegrenzt werden. Der Zähler erfasst Integratorarbeit, aber noch nicht
jede innere Stempeloperation; Laufzeit und Quellenbudget sind getrennt zu prüfen.

| Nächster Ansatz | Qualität und Bearbeitbarkeit | Reaktion | Wartbarkeit und Risiko |
| --- | --- | --- | --- |
| Budget erhöhen | Gleiche Autorenfolge und numerische Probe | Mehr Arbeit/Speicher; kein belegter Gewinn | Einfach, löst die beobachtete Grenze nicht |
| **Quellengrenzen gezielt zerlegen, kontinuierlichen Kern gesondert integrieren** | Texturraster, Byte-Stufen und gespeicherte Deckkraftfolge müssen erhalten bleiben | Potenzial für weniger blindes Verfeinern; noch zu messen | Begrenzte Zerlegung und unabhängige Fehlergegenprobe nötig |
| Dichte feste Vorabtastung | Überlagerung leicht; kleine Flächen und Texturgrenzen können verloren gehen | Möglicherweise schneller, aber kein zertifiziertes Zellziel | Einfacherer Kern, hohes Qualitätsrisiko bei großen Pinseln |

Nächste Arbeit: den zweiten Ansatz zuerst mit derselben Quellenprobe gegenprüfen;
keine höhere Grenze oder stillschweigende Qualitätsreduktion als Ersatz akzeptieren.
Erst danach Feld-/Quellenseiten und tatsächliche Weltlast anschließen und über die
produktive Kachelversion entscheiden. M2 bleibt offen; kalte Übersicht, normale
Atlasfläche und weitere Etappen sind durch diesen Schritt nicht abgenommen.

Syntaxprüfungen, `git diff --check` und [Repositoryprüfung](check-repo.log.gz)
bestehen. Keine Main-Integration, Veröffentlichung oder native Abnahme dieses
isolierten Prototyps.
