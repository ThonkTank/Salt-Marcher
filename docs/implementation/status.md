# Aktueller Stand

Atlas V7, Dateiformat 18, Generierungsrezept 4. Stand: 6. November 2026.
[README](../../README.md) enthält Einrichtung und Abnahme, die
[Architektur](../architecture.md) Zuständigkeiten und der
[Produktvertrag](../product-contract.md) Verhalten und Grenzen.

Die Ansicht „Raum“ bleibt ein äußerer Nahzoom mit explizitem Innenraumeinstieg.
Kontexthilfe und Rückkehrbezeichnung sind angepasst; Höhen und Gewässer zeigen
Weltdurchmesser und Autorenraster einschließlich des Hinweises für kleine Pinsel.
Der Canvas-Besitzer verwendet einen sitzungsgebundenen, begrenzten Cache für
exakte Außengeometrie; die Speichergröße ist eine Schätzung, keine Messung des
nativen `Path2D`-Speichers. Bearbeitungsdaten bleiben unverändert.

Die direkte Prüfung bestätigte Typen, 39 gezielte Unit-Tests, alle fünf
Raum-Browsertests und identische Canvas-Pixel in 84 Vergleichen mit der vorherigen
Darstellung. Der Webbuild der Implementierung bestand; danach wurden ausschließlich
Tests und dieser Prüfstand geändert. Die abschließende Typ- und Formatprüfung bestand.

Ein beobachteter Werkzeugwechsel verkleinert die Karte und löst einen Ladezustand
aus; sofort folgende Testgesten kamen teils vor der Bearbeitungsfreigabe an.
Die betroffenen Tests warten nun ausdrücklich auf Layout, Darstellung und
veröffentlichten Stand. Eingaben, Freigaben und Zeichenplanung im Produkt bleiben
unverändert. Danach bestanden alle 22 gezielten Fälle einschließlich Raum sowie
alle 65 Werkzeugregressionen. Der Navigations-/Datei-/Kontextlauf bestand 38 von
39 Tests: Der bereits zuvor wechselhaft ausgefallene Parzellentest mit Hauszeichnen
und Alt-Eingabe lieferte erneut keinen Hausowner. Dieser Restbefund bleibt offen;
eine saubere Gesamtabnahme ist damit nicht erreicht. Frühere Fehlläufe und die
begrenzte Korrektur bleiben unter `src-tauri/target/cleanup/lod-review/lod00/`
belegt; aktuelle Prüfung und Korrektur stehen in `F/coordinator/` und `G/`.

Die begonnene Phase-4-Zeichenplanung und ihre Gelände-/Flusscaches sind nicht
insgesamt abgenommen. Die frühere Release-Browsermessung für Format 18 ist keine
bestandene Performanceabnahme; vollständiger Browserlauf, aktuelle große
Performanceprüfung und native Bedienabnahme gemäß README stehen aus. Der
Raumstand ist als begrenzter Checkpoint prüfbar; nächster technischer Handoff ist
der offene Parzellentest und die weitere LOD-Prüfung unter diesen Grenzen.

Für Pull Requests und Pushes auf `main` ist ein CI-Workflow für den exakten
Commit eingerichtet: Er führt `check:all` und den konfigurierten RPM-Build aus.
Der erste Lauf und seine Ergebnisse müssen noch am veröffentlichten Commit
geprüft werden. Verpackung ersetzt weder die native Bedienabnahme noch die
separaten großen Performance-Fixtures.
