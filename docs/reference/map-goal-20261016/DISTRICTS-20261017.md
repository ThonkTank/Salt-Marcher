# Zwei Viertel mit eigener Bauweise · 2026-10-17

## Aufgabe und Ausgangsbefund

In der isolierten Kampagne „Gemeinsamer Atlas · Region und Marktviertel · QA“ das vorhandene Viertel erweitern: weitere Straßen zeichnen, einen locker bebauten Südmarkt anlegen, die Taverne individuell versetzen und drehen, ihren Innenraum wiederfinden und am Spieltisch verwenden. Als Ausgangsdaten lagen 99 Häuser, eine geschützte Taverne, zwei kanonische Räume und 21s bestätigte Gruppenzeit vor.

Tatsächliche UI-Nutzung: Straße mit vier Punkten gezeichnet und übernommen, erstes Viertel mit Dichte 0,65 regeneriert, dritte Straße und südliche Viertelfläche gezeichnet, „Südmarkt“ benannt und mit Dichte 0,4 bebaut. Taverne mit der Platzierungsvorschau versetzt, von 90° auf 0° gedreht und ihr vorhandener Innenraum geöffnet. Beim Wechsel zurück zum ersten Viertel blieb das gemeinsame Dichteformular auf 0,4; ein frischer Start setzte es auf 0,75. Damit musste die GM die vorherige Bauweise selbst erinnern und erneut eingeben.

## Änderung und tatsächliche Wiederholung

Eine optionale Bauweise gehört jetzt zur Viertelfläche: Seed, Dichte, Hausgröße, Straßenabstand und Nutzung. Die Vorschau schreibt nichts. Erst „Bebauung übernehmen“ speichert Bauweise und vorgeschlagene Häuser in einem bestehenden atomaren Stadtbefehl. Undo/Redo erfasst beides. Alte Viertel ohne Bauweise bleiben lesbar. Die kanonische Speicherprüfung lehnt ungültige Werte oder eine Bauweise an einem Haus ab. Unübernommene Eingaben bleiben während eines Viertelwechsels in dieser Sitzung getrennt; ein verspätetes Übernahmeergebnis überschreibt keine neuere Eingabe.

Im tatsächlichen Nachlauf behielt das Marktviertel nach Übernahme 0,65 und Südmarkt 0,4. Ein erneutes Öffnen der Kampagne über die UI und anschließender Viertelwechsel zeigte beide Werte wieder. Die zuvor überlappenden Viertelflächen wurden über die sichtbaren Eckpunkte abgegrenzt und erneut bebaut. Ergebnis: drei Straßen, zwei Viertel, 117 Häuser, eine geschützte Taverne. Die Hausnotiz einschließlich Krypta-Hinweis und der ursprüngliche Innenraum mit Schankraum, Lagerraum und Tür blieben verfügbar. Party → Karte zeigte Mira im Lagerraum und unverändert Tag 0 · 00:00:21. Es wurde keine neue Reise gebucht.

Die UI verwendete den QA-Browserhost mit kanonischem Renderer, Preload, Main, SQLite und Arbeitern; native Dialoge/Fenster sind über Adapter angebunden. Dies qualifiziert keine paketierte native Anwendung. Reguläre Nutzerdaten und fremde Prozesse wurden nicht verändert.

## Tatsächlicher Vergleich

In der bereits bearbeiteten Watabou-Stadt „Far Market“ White Pass in „Südmarkt“ umbenannt, einen Straßenzug mit Warp/Displace verschoben und mit Enter übernommen, einen südlichen Gebäudeblock über „Reroll geometry“ neu erzeugt und SVG über das sichtbare Menü exportiert. Escape verwirft die Warp-Vorschau; dieser erste Versuch zählt nicht als übernommene Änderung. Der spätere Enter-Nachlauf und die exportierte SVG enthalten die geänderte Form und Südmarkt-Beschriftung.

Watabou bietet unmittelbar zusammenhängende organische Straßen, Gebäudeblöcke und lesbare Viertelnamen. Unser Ergebnis bleibt eine deutlich einfachere, straßennahe Verteilung einzelner Rechteckhäuser. In diesem Vergleich wurden keine gleichwertige Dichtevorgabe, geschützte kanonische Hausbindung, private Notiz, Innenraum-/Party-Fortsetzung oder editierbarer Save/Fresh-Nachweis festgestellt. Das ist ein tatsächlich durchgeführter Teilvergleich, keine vollständige fachliche oder grafische Parität.

## Prüfungen und offene Arbeit

Der vorhandene 67-Fälle-Stadt-/Atlas-DOM-Lauf bestand vor der abschließenden Absicherung verspäteter Übernahme. Danach bestanden alle drei gezielten neuen Fälle einschließlich dieser Absicherung. Beide Typprüfungen, Desktop-Build, Repository-Prüfung und QA-Build werden separat protokolliert; die veröffentlichte Revision benötigt ihre eigene Candidate-CI. Der zuvor veröffentlichte 556f7a9e8 hat CI 39000833053 erfolgreich abgeschlossen und bleibt archiviert.

Belege im Chat-Arbeitsbereich: `evidence/saltmarcher-city-recipes-20261017/` mit `own-two-districts.png`, vollständigem eigenem Fensterbild, `watabou-southmarket.svg` und gerenderter PNG sowie Prüfprotokollen. Der erste neue Testlauf deckte einen fehlenden nativen option.value-Textfallback im DOM-Adapter auf; die Fixture wurde korrigiert, ihre Assertions bleiben erhalten.

Offen bleiben vollständiger vergleichbarer Stadt-/Regional-/Live-Ablauf und editierbares Scrawl Save/Fresh, natürliche Stadtgestaltung und native Spielerfenster-/Dunkelsicht-Prüfung. Im kalten Atlasstart musste eine sehr frühe Suchnavigation zweimal erneut gewählt werden, nachdem die Karte geladen war; Ursache und gezielte Reproduktion sind noch offen. Der Live-Hex-Bereich zeigte zeitweise eine nicht verfügbare Gruppenkarte, während der lokale Innenraumbereich korrekt den Lagerraum zeigte. Diese Befunde sind keine erledigten Reparaturen. Der kontinuierliche Goal-Lauf bleibt pausiert; Nutzerabnahme ist offen.
