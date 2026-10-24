# Trassenintervalle: Auswahl, Komposition und Rundung

Der isolierte Prototyp in `tools/atlas-prototypes/route-field-interval.ts`
umschließt den unveränderten `RouteSurface.at`-Pfad aus
`src/app/terrain-route.ts`. Er ersetzt weder dessen Punktabfrage noch die
kanonischen Autorendaten. Die folgenden Argumente sind eine überprüfbare
Herleitung, kein maschinenverifizierter Beweis.

## Index und nächste Segmente

Zellgröße, Segmentpadding, Floor-Indizes, Einfügereihenfolge und fortgeschriebene
Station entsprechen dem kanonischen Index. Jede Abfrage besucht alle berührten
Indexzellen, einschließlich nur am Rand berührter Zellen. Innerhalb jeder Zelle
wird die Abfrage zugeschnitten; die Ergebnisse werden vereinigt. Die zusätzlichen
geschlossenen Randpunkte können die Hülle verbreitern, schließen aber keine
kanonische Auswahl aus. Mehr als 64 berührte Zellen ergeben explizite Unsicherheit
und einen Schnittvorschlag; der Index selbst erlaubt höchstens 300.000 Referenzen.

Alle Segmentabstände einer Route werden zunächst eingeschlossen. Ein Segment
bleibt möglich, wenn seine untere Abstandsgrenze nicht größer als die kleinste
obere Grenze der Route ist. Exakte Gleichstände behalten vorsichtshalber alle
Möglichkeiten; kanonisch gewinnt das erste Segment. Jedes mögliche Segment behält
Profil, Station, Struktur und Abstandsintervall zusammen, bis sein eigener
Beitrag berechnet ist. Erst danach werden die Beiträge einer Route vereinigt.
Pro Route geht weiterhin genau ein Beitrag in die Kreuzungsrechnung ein.

## Operationsintervalle und Abstand

Addition, Subtraktion, Produkt und Quotient werden nach außen gerundet.
Exakte Einzelwerte wiederholen die entsprechende kanonische JS-Operation.
Der Nenner der Projektion behält ausdrücklich `dx*dx+dy*dy || 1`, auch für
Nullsegmente. Für `Math.hypot` erhält die Hülle einen zusätzlichen Aufschlag von
16 Maschinen-Epsilons ihres oberen Betrags plus 16 kleinsten Subnormalzahlen.

Liegt die gesamte unbeschnittene Projektion in `[0,1]`, gibt es außerdem eine
unabhängige Hülle aus dem senkrechten Abstand zur Segmentgeraden. Sie vermeidet
die falsche Unabhängigkeit eines Punkts von seiner eigenen Projektion. Für
Segmentlängen zwischen `2^-450` und `2^450` und Koordinatenbeträge bis `2^450`
werden Projektion und Abstand durch `64*EPS*max(1,Koordinatenbetrag)+64*MIN`
gepolstert. Die Skala deckt Subtraktion, Skalarprodukt, Division, Rückprojektion
und Hypotenuse ab: ein Projektionsparameterfehler proportional `u*M/L` wird
bei der Rückprojektion wieder mit L multipliziert. Auslöschung wird deshalb
absolut mit M und nicht relativ zum möglicherweise winzigen Abstand bezahlt.
Außerhalb dieser Größenbedingungen bleibt nur die Operationshülle.

## Nichtnegative Beiträge und Nullgewicht

Der Radius folgt dem kanonischen Quellen-Fade aus der Station. Wasser wird vor
der Brücken-/Tunnelprüfung bestimmt. Der Strukturwechsel verwendet `t < .5`.
Gewichte entstehen aus dem kanonischen Smoothstep; sie sind nichtnegativ.
Unsichere Struktur oder Einflussgrenze nimmt zusätzlich den Nullbeitrag auf.

Für Basis B, begrenzte Ziele T_i und Gewichte w_i ist die reelle Komposition:

```text
S = sum(w_i), W = sum(T_i*w_i), A = max(w_i)
H = B + (W/S-B)*A       für S > 0
H = B                   für S = 0
```

Reell liegt `A` in `[0,1]`; H liegt damit in der Hülle aus B und allen T_i.
Die kanonische Rechnung darf durch Rundung geringfügig abweichen. Mit
`EPS=2^-52`, `MIN=2^-1074`, n möglichen Routen und
`M=max(1,abs(B),abs(T_i))` erhält die zusätzliche Hülle den Aufschlag:

```text
E = 64*(n+1)*(EPS*M + MIN)
```

Voraussetzung ist `M<=2^450`; andernfalls bleibt die Höhe unbekannt. n ist
kleiner als die Indexreferenzgrenze, also `n*EPS << 1`.
Smoothstep-Gewichte weichen höchstens um einige u von `[0,1]` ab. Bei positiven
Summanden hat die Summe relative Fehlergröße `gamma_n=n*u/(1-n*u)`;
subnormale positive Summen sind, solange subnormal, exakt darstellbare Vielfache
von MIN. Es gibt hier keine Summenauslöschung.

Die gewichteten Produkte kosten höchstens `u*abs(T_i*w_i)+MIN/2` je Beitrag.
Auch bei verschieden signierten T_i bleibt die absolute Summenfehlergröße durch
`gamma_n*M*S + n*MIN/2` begrenzt. Division durch S vergrößert den subnormalen
Rest zunächst. In der abschließenden Höhe wird er aber wieder mit A
multipliziert: `A <= sum(w_i)`, bis auf den schon berücksichtigten positiven
Summenfehler. Es verbleibt ein Fehler proportional `n*MIN`, kein unbeschränkter
Faktor `1/S`. Quotient, Differenz, Produkt und Schlussaddition kosten weitere
konstante Vielfache von `u*M`. Der Faktor 64 überdeckt diese Anteile und die
kleine Überschreitung von A über eins.

Bei möglichem Nullnenner liefert deshalb diese gepolsterte Bewegungshülle einen
endlichen Bereich, statt die Trasse als unverändertes Gelände zu behandeln.
Bei sicher positivem Nenner wird sie mit der Operationshülle geschnitten.
Wasseranwesenheit wird unabhängig davon vereinigt; Flusswasser darf auch bei
noch breiter Höhenhülle sicher sein.

Bei genau einer Route sind Zähler und Nenner vom selben Gewicht abhängig.
Reell vereinfacht sich die Komposition zu `B+(T-B)*A`, einschließlich des
Nullgewichtsfalls. Eine weitere Intervallhülle dieser Form erhält denselben
Aufschlag E für die kanonische Multiplikation/Division und die abweichende
Auswertungsreihenfolge. Bei unsicherer nächster Segmentwahl werden deren Ziele
vereinigt; inaktive Möglichkeiten nehmen B auf. Es wird keine bitgenaue
algebraische Kürzung der Gleitkommarechnung behauptet. Diese zusätzliche
Abhängigkeitsinformation ist insbesondere am wasserführenden Straßeneinschnitt
wichtig, wo die Flächenfarbe von der effektiven Höhe abhängt.

## Prüfgrenzen

Dichte Vergleiche mit der kanonischen Punktabfrage prüfen feste und variable
Basisintervalle, Abtrag/Auftrag, Quellverjüngung, mehrere Routen, gleich weit
entfernte Segmente, Bauwerke, Nullsegmente sowie entfernte und negative
Koordinaten. Analytische Flächenproben prüfen Wasseranteile von Flussbändern,
Kreuzungen und einem wasserführenden Straßeneinschnitt. Ein unabhängiger Review
fand keinen konkreten Gegenfall, ersetzt jedoch keine formale Verifikation.
Echte Segmentwechsel können unstetig sein; dort wird keine Konvergenz auf einen
einzigen Wert über beide Seiten behauptet. Die Hülle muss beide Seiten erhalten.
