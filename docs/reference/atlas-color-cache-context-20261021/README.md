# Farbkacheln trotz langer Straßenliste im Cache halten

21.10.2026, Produktänderung auf `d6233f32e`, Desktopversion 0.180.0.
Host i5-8365U / Intel UHD 620. Kein Test auf dem Pentium Gold 7505.

## Ursache und Änderung

Eine Farbkachel wird im bestehenden Projektionscache in 32×32-Pixel-Stücke
zerlegt. Jeder Schlüssel enthielt bisher die vollständige Stildefinition und
bis zu 500 IDs der als Vektoren angezeigten Straßen. In der großen Welt
belegten die Schlüssel einer einzigen 256×256-Kachel **869.312 Byte**, ihre
Pixel nur **262.144 Byte** ([Messung](key-size.json)). Die Wiederholung dieser
Metadaten verdrängte fertig berechnete Kacheln aus dem begrenzten Cache.

Der gemeinsame Rasterkern bildet jetzt einmal pro Anfrage einen SHA-256-Digest
über Höhenlinienabstand, Darstellungsmaßstab, Geländestil/-einstellungen und die
berücksichtigte Straßenliste. Jeder kleine Stückschlüssel enthält nur noch
Ausschnitt, Bildgröße und diesen Digest. Das bestehende **16-MiB-Budget**, die
räumliche Invalidierung einschließlich Schattierungsrand und die Revisions-/
Fence-Prüfung bleiben erhalten. Es gibt keinen zusätzlichen Cache.

## Wiederholtes Lesen der vollständigen Detailansicht

[Produktmessung](product-measurement.json), [vorheriges Experiment und Referenz](experiment.json).
48 Farbkacheln aus der gespeicherten nativen 108.076-Objekt-Welt; frische
Readonly-Verbindung, danach zwei vollständige Durchgänge in derselben Reihenfolge.
Die SQLite-Autorendaten wurden nicht verändert. Kein anderer eigener Build oder
nativer Lauf während der Messung. Jeder Durchgang vergleicht SHA-256 aller
Kachelbilder; alle 48 Bilder stimmen zwischen vorher/nachher und kalt/warm überein.

| Messgröße | Bisherige Schlüssel | Neuer Produktcode |
| --- | ---: | ---: |
| Erster Durchgang | 18.460,7 ms | 17.548,8 ms |
| Wiederholter Durchgang | 16.711,0 ms | 2.487,6 ms |
| Cache-Treffer beim Wiederholen | 0 | 3.072 |
| Fehlende Stücke beim Wiederholen | 3.072 | 0 |
| Verdrängungen beim Wiederholen | 3.072 | 0 |
| Belegter Cache nach Durchgang | 16.768.040 Byte | 13.455.904 Byte |

Einzelne Durchgänge, keine statistische Geschwindigkeitsgarantie. Die verbleibende
Zeit enthält auch Metadaten-/Straßenlesungen. Das vorgeschaltete Experiment
verdichtete noch den gesamten alten Schlüssel je Stück; der Produktcode
berechnet nur den gemeinsamen Kontext einmal. Beide Varianten behalten dieselben
Pixel. Diese Messung ist keine Eingabelatenz und keine native Produktabnahme.

Reproduktion mit einem behaltenen Testprofil:

```sh
node tools/measure-terrain-color-cache.mjs \
  .build/world-render-reuse-final-108k/result.json .build/color-cache.json
```

## Regressionen

[Neue Cache-Prüfung](../../../tests/terrain-color-cache-context.test.mjs):
48 Bilder und 500 Straßen-IDs in einem absichtlich kleineren Speicherbudget;
Wiederholung ohne neue Rasterlesung, lokale Änderungen mit unveränderten fernen
Bildern, Reset sowie getrennte Stile, Meereshöhen, Höhenlinien, Straßenlisten,
Vektorauswahl, Maßstäbe, Ausschnitte und Bildgrößen. Warm berechnete Bilder müssen
jeweils der ungecachten Ausgabe entsprechen.

19 betroffene Tests bestanden, einschließlich Küsten-/Höhenlinien-Goldenbildern,
Kachelnähten, Worker-Unterbrechung und Ablehnung veralteter Revisionen. Beide
TypeScript-Prüfungen und Desktop-Build bestanden.

## Zwei große Pinselzüge im normalen Atlas

[Abschließende native Messung](world.json), [Bild](world.png). Der Weltprüfweg
verwendet zusätzlich `WORLD_REPEAT=1`: Nach dem ersten gespeicherten Zug und
vollständiger Detailverfeinerung folgt derselbe 2.500-Meilen-Pinsel noch einmal.
Beide Züge müssen eine neue bestätigte Revision, geänderte tatsächliche Pixel
und erneut alle Kacheln erreichen. Pixelmessungen werden je Zug zurückgesetzt;
Bestätigungen müssen neuer als dessen Ausgangsrevision sein. Eine anfangs noch
nicht veröffentlichte Ausgangsrevision bleibt ausdrücklich `null`.

| Abschnitt | RAF p95 / Maximum | Erste beobachtete Pixeländerung | Alle Details nach Loslassen |
| --- | ---: | ---: | ---: |
| Navigation | 37,1 / 233,3 ms | nicht gemessen | nicht gemessen |
| Erster Zug | 38,5 / 157,0 ms | 387,4 ms | 36.263,2 ms |
| Zweiter Zug | 33,3 / 133,4 ms | 813,3 ms | 15.846,1 ms |

Gespeicherte Revisionen 8 und 12, jeweils Qualität `detail`, 48/48 Kacheln.
Alle GPU-Gegenproben einschließlich Cursorvergleich bestanden. Prozess 3063162
endete normal mit Code 0, PID verschwunden, keine Rendererfehler. Keine anderen
eigenen Tests, Builds oder nativen Prozesse parallel zur Messung.

Der [erste Wiederholungslauf](first-world-summary.json) zeigte 185,5 / 741,1 ms
bis zur Pixeländerung. Dabei zählte der bisherige Bestätigungszähler beim zweiten
Zug auch die bereits vorher vorhandene Revision; er wurde korrigiert und der
vollständige Ablauf erneut ausgeführt. Die Pixelmessung war davon unabhängig.
Die Unterschiede zwischen den Läufen sind kein Beleg für eine stabile
Eingabelatenz. Gemessen wird weiter nur der zentrale 32×32-GPU-Bereich ab
Ereigniszeitstempel einschließlich Referenzlesung. Der Einfluss dieses Bereichs
und der Messinstrumentierung muss separat untersucht werden.

Die schnelle Wiederverwendung im isolierten Cachetest ist nachgewiesen.
Die native zweite Bearbeitung ist jedoch kein kontrollierter Vorher-/Nachher-
Vergleich mit dem alten Produktcode; daraus wird keine kausale Beschleunigung
um einen bestimmten Faktor abgeleitet. Kaltes Nachladen und unmittelbare
Navigation/Pinselreaktion erfüllen die Produktziele weiterhin nicht.

## Autorenweg und verbleibende Produktarbeit

[Native Schritte](authoring.json), [Kontinente](continents.png),
[Wald im Kontinentmaßstab](forest.png), [erneut geöffnetes Gebäude](reopened.png).
Eine leere Kampagne wurde mit den normalen Werkzeugen aufgebaut: Kontinente,
Relief, Wald, unabhängiges Königreichsgebiet, Straße, drei Gebäudegruppen und
ein benannter Raum. Der frische Prozess stellte den gespeicherten Bestand
unverändert wieder her. Prozesse 3064456 und 3065556 endeten normal mit Code 0,
PIDs verschwunden, keine Rendererfehler.

Die Bilder wurden angesehen. Der Wald erscheint im Kontinentmaßstab weiterhin
als einfache grüne Fläche, die Kontinentformen sind sehr schematisch und das
Relief ist schwach lesbar. Das ist keine Abnahme der gewünschten Fantasyästhetik.
Die vollständigen Leistungsziele, Zielhardware und lange kombinierte Sitzungen
mit Gebäuden, Räumen und Volumenlast bleiben offen. Diese Änderung verbessert
nachweislich die Wiederverwendung bereits berechneter Farbbilder.
