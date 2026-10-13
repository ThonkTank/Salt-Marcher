# Ein Reiseziel wechseln und unterwegs wieder aufnehmen

## Reproduzierter Ausgangspunkt

Iri steht auf Hex 0,0. Die GM wählt Kartenhex 1,0, danach den benannten Ort „Ruine“ auf 3,0. Zurück zu „Ausgewähltes Hex“ bleibt das Reiseziel fälschlich auf 3,0. Eine manuelle Änderung auf 2,0 hält zugleich die Ortsbindung der Ruine fest. Die UI beschreibt damit ein anderes Ziel als den ausgewählten Kartenpunkt beziehungsweise übergibt einen widersprüchlichen Orts-/Koordinatenauftrag ([Daten](2026-10-13-travel-target-before.json), [Bild](2026-10-13-travel-target-before.png)). Der gewöhnliche Kartenklick selbst funktionierte bereits korrekt.

## Änderung und Vergleich

Die Rückkehr zum Hexziel übernimmt wieder das ausgewählte Kartenhex, einschließlich der bestehenden Maßstabsumrechnung. Manuelle Koordinaten lösen die frühere Ortsbindung und invalidieren die alte Vorschau. Der Zielmodus heißt verständlich „Hex aus Karte oder Koordinaten“. Die benannte Ortswahl bleibt ausdrücklich erhalten, wenn die GM einen Ort auswählen möchte. Keine Ortsdaten, Karten oder Positionen werden durch diese Anzeigeänderung umgeschrieben.

[Owlbear Rodeo dokumentiert direktes Messen und Bewegen auf Hexkarten](https://docs.owlbear.rodeo/docs/measure/), einschließlich passender Kilometer-/Meilenskalen. Das unterstützt die Erwartung, dass der tatsächlich gewählte Kartenpunkt zählt. Kein hier bedienter Owlbear-Account und kein Geschwindigkeitsnachweis. Eine einfache [Markdown-Reisenotiz](2026-10-13-travel-target-paper.md) führt Ziel, Zwischenstopp und Zeiten eindeutig; sie wurde geschrieben und bytegleich erneut gelesen. Menschliche Editor-/Papierzeitvergleiche bleiben offen.

## Praktischer Nachweis

Die native Ausgangsprobe scheitert nach normalem Close absichtlich am falschen Zielwert 3 statt 1. Nach der Änderung liefert dieselbe GMbedienung Hex 1 als Rückkehrziel und ein ungebundenes manuelles Ziel 2,0. Vorschau: 2 km, zwei Abschnitte, ausdrücklich gesetzte Enddauer zwei Stunden ([Daten](2026-10-13-travel-target-after.json), [Bild](2026-10-13-travel-target-after.png)).

„Bis zur nächsten Grenze weiter“ stoppt an den frischen Spuren auf 1,0, nach exakt einer Stunde; ein weiterer Abschnitt ist bis zur GMentscheidung gesperrt. Nach echtem Close/Neustart bleibt diese Unterbrechung vorhanden. Fortsetzen und Weiterführen erreichen 2,0 nach insgesamt exakt zwei Stunden. Ein frischer Core bestätigt zwei Zeitbuchungen, keine doppelte Buchung durch Neustart und unveränderte geschützte Ortsprosa. Beide Appstarts und beide Closewege endeten normal mit Exit 0, ohne Pageerrors.

59 betroffene Travel-/World-/Chronicle-/Narrative-Regressionen sowie Desktop-Typecheck und Build bestanden. Zwei neue DOMtests prüfen den Zielwechsel und den tatsächlich an den realen Vorschauwriter übergebenen manuellen Auftrag; bestehende verzögerte/stale Vorschauprüfungen bleiben grün.

Alle schweren Jobs liefen über `codex-dungeon-job qa`, ein Testworker. Eigener Nativebaum im QAservice, kein Swap, Peak 475,8 MiB. Alle eigenen Nativeprozesse beendet; gemeinsame Codex-App, fremde Prozesse und Nutzerdaten unangetastet. Der private DBusproxy verhindert nur im Prüfprozess Chromiums Scopewechsel.

```sh
/home/aaron/.local/bin/codex-dungeon-job qa -- node tools/build-desktop.mjs
/home/aaron/.local/bin/codex-dungeon-job qa -- npm run test:desktop-travel-target
/home/aaron/.local/bin/codex-dungeon-job qa -- node tools/test-desktop-travel-target.mjs
```

Linux mit `xdg-dbus-proxy`, eine isolierte fiktive Campaign und kleine Route. Reise-/Wetter-/Gruppen-/Konfliktkombinationen, andere Plattformen, breite Recovery sowie Gesamtproduktvorteile bleiben gesondert offen.
