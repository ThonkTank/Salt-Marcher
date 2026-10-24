# Rundungshülle für den physischen Höhenprototyp

Bezug: `tools/atlas-prototypes/height-field-interval.ts` und die tatsächlich
kanonische Auswertung in `src/app/terrain-interpolation.ts`. Diese Herleitung
begründet eine zusätzliche konservative Hülle; sie ist kein maschinenverifizierter
Beweis. Die bisherigen nach außen gerundeten Operationsintervalle bleiben als
zweite Hülle erhalten; verwendet wird ihre Schnittmenge.

## Reelle Hülle mit Abstand zum Endpunkt

Für die reelle harmonische Tangente gilt bei gleichgerichteten Steigungen
`m = 2*p*q/(p+q)`, sonst `m = 0`. Relativ zum Endpunktunterschied
`delta = c-b` liegen beide Tangentenquotienten `r0`, `r1` in `[0,2]`.
Für `delta=0` liefert der kanonische Konstantenzweig unmittelbar `b`.
Mit `0 <= t <= 1` lässt sich die reelle Hermite-Kurve schreiben als:

```text
H = b*(1-w) + c*w
w = 3*t² - 2*t³ + r0*t*(1-t)² - r1*t²*(1-t)
t² <= w <= 2*t-t²
```

Beide Gewichtsgrenzen steigen monoton. Für ein t-Intervall werden deshalb
`t.lo²` und `2*t.hi-t.hi²` nach außen gerundet. Für jedes der beiden Gewichte
werden untere bzw. obere b-/c-Grenzen konvex kombiniert, dann Minimum bzw.
Maximum genommen. Das gilt auch bei fallenden Höhen; b und c werden nicht
vorab vertauscht. Die Kombinationen sind ebenfalls nach außen gerundet.
Gegenüber der bloßen Endpunkthülle erhält dies den Abstand zu einer
Nullhöhenkante. Genau dieser Abstand fehlte beim zweidimensionalen Sattel.

## Abweichung der kanonischen Gleitkommaauswertung

Es gelten `u=2^-53`, `eta=2^-1074`, `s=sqrt(2^-1022)`,
`M=max(abs(a),abs(b),abs(c),abs(d))` und `N=M+s`.
Die Zusatzhülle wird ausschließlich für endliche Eingänge mit `M<=2^500`
und `t` in `[0,1]` eingesetzt. Damit laufen die folgenden Produkte nicht über.
Für jede gerundete Operation ist der absolute Fehler höchstens
`u*abs(exaktes Ergebnis)+eta/2`. Der Aufschlag lautet:

```text
E = 16384*u*M + 16384*s
```

Die Faktoren sind absichtlich großzügig. Eine getrennte Fehlerfortpflanzung
liefert folgende kleineren Schranken:

1. **Differenzen:** Eine Steigung hat Betrag höchstens `2*M`; ihr Rundungsfehler
   ist höchstens `2*u*M+eta/2 <= 3*u*N`.
2. **Harmonische Tangente:** Die reelle Funktion ist stetig über die
   Vorzeichenwechsel hinweg und hat auf jedem gleichgerichteten Quadranten
   partielle Ableitungen mit Betrag höchstens 2. Die Störung beider Steigungen
   kostet deshalb höchstens `12*u*N`. Bei normalen Produkten gibt es in der
   gleichgerichteten Summe keine Auslöschung; Verdopplung ist exakt,
   Produkt, Summe und Quotient kosten zusammen weniger als `32*u*N`.
   Als gemeinsame normale Schranke genügt `64*u*N`.
3. **Unterlauf:** Bei subnormalem Produkt ist die kleinere Steigung höchstens
   ungefähr `s` (der Übergangsfehler ist durch den folgenden Faktor abgedeckt).
   Die reelle Tangente ist dann höchstens `2*s`. Falls der kanonische Test
   `fl(p*q)>0` gilt, ist `p*q>eta/2`; der gerundete Zähler `2*p*q` ist kleiner
   als `3*p*q`. Der gerundete Quotient bleibt unter `4*min(abs(p),abs(q))+eta`.
   Bei Produktnull liefert die Implementierung unmittelbar null. Insgesamt
   deckt `T=64*u*N+16*s` beide Fälle samt Steigungsstörung ab.
   Insbesondere wird **nicht** angenommen, dass die gerundeten
   Tangentenquotienten weiterhin in `[0,2]` liegen.
4. **Koeffizienten:** Für `q=3*delta-2*m0-m1` und
   `r=m0+m1-2*delta` genügen jeweils
   `Q=512*u*N+48*s` und `R=512*u*N+32*s`.
   Zur Kontrolle der Operationsanteile: gerundete Steigungen sind kleiner
   als `3*N`, Tangenten kleiner als `20*N`. Die q-Zwischengrößen sind durch
   `9,40,49,69` mal N begrenzt, die r-Zwischengrößen durch `40,6,46` mal N.
   Deren Rundungsanteile sind kleiner als `256*u*N` bzw. `128*u*N`;
   Parameteranteile `3*(3*u*N)+3*T` bzw. `2*T+2*(3*u*N)` passen in Q und R.
5. **Horner:** Da alle t-Potenzen höchstens eins sind, kosten gestörte
   Parameter höchstens `T+Q+R = 1088*u*N+96*s`.
   Für die sechs abschließenden Operationen genügen Größen
   `46,115,115,135,135,136` mal N; ihre gerundeten Summen samt subnormalen
   Resten sind kleiner als `1024*u*N`. Insgesamt ist
   `2112*u*N+96*s` deutlich kleiner als E.

Die inneren Zeilen werden zuerst eingeschlossen. Die äußere y-Auswertung
behandelt deren tatsächlich gerundete Ergebnisse als Eingänge und erhält
nochmals ihre eigene Hülle. Gleichheit wird nur für denselben Quellausdruck
oder exakt konstante Eingänge genutzt, nicht aus bloß gleichen Intervallgrenzen
zweier verschiedener Zeilen abgeleitet. Additive Bänder bleiben in der
kanonischen Reihenfolge und werden separat nach außen gerundet addiert.

## Prüfung und Grenzen

Die gezielten Tests vergleichen dichte kanonische Punktabfragen mit den
Intervallen: Extremstellen, geerbte NaNs, Quellengrenzen, entfernte Ursprünge,
kleine Float32-Knoten mit subnormalen Float64-Tangenten und große additive
Summen. Analytische Flächenproben prüfen Küste, schmale Insel und Sattel.
Ein unabhängiger numerischer Review bestätigte die Gewichtsherleitung und
plausibilisierte den großzügigen Rundungsaufschlag. Stichproben ersetzen
keinen allgemeinen Beweis; die zusätzliche Hülle bleibt Teil des isolierten
Prototyps. Trassenintervalle sind weiterhin ausdrücklich unbekannt.
