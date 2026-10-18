# Eine Kampagne, eine Karte

Die Desktopanwendung verwendet eine Kampagnenwelt. Hexgelände, Städte, Gebäude und Dungeonräume liegen in derselben metrischen Fläche. Stadt und Dungeon sind räumliche Bereiche mit eigenen fachlichen Werkzeugen; sie besitzen keine unabhängig auswählbaren Karten. Die Kamera und die Auswahl bleiben beim Werkzeugwechsel erhalten. Zoomen erzeugt weder Geometrie noch Reisezeit.

## Arbeitsplatz und Kartenfläche

Der Atlas verwendet die gesamte Fensterfläche mit einer 48-Pixel-Kopfleiste, einer schmalen Bedienhilfe und einer linken Werkzeugleiste. Die Produktbereiche öffnen über **☰ Atlas** als Menü. Kampagnenname, Suche, Rückgängig/Wiederholen, Speicherstatus, Party, Musik, weitere Aktionen und Ausgabe bleiben erreichbar. Menüs und Suchergebnisse überlagern die Karte, ohne sie zu verschieben. Die Musik spielt weiter, wenn ihre Transportsteuerung geschlossen ist.

**Werkzeug** zeigt Vorgaben für die nächste Kartenänderung; **Auswahl** zeigt Eigenschaften vorhandener Objekte. Landschaft, Stadt, Innenräume und Ausstattung besitzen benannte Werkzeugbuttons. Die Breite der Hauptleiste ist zwischen 280 und 400 Pixeln einstellbar; Breite und Einklappzustand bleiben als lokale Ansichtspräferenz erhalten. **Werkzeuge einklappen** gibt zusätzlichen Raum frei. **Karte maximieren** blendet die Bedienflächen aus; **Bedienung einblenden** kehrt ohne Werkzeug-, Auswahl- oder Entwurfsverlust zurück. Ein Speicherfehler holt die Bedienung wieder hervor.

Objektauswahl allein öffnet keine zweite Spalte. **Beschreibung bearbeiten**, die Objektbibliothek und **Viertel bebauen…** öffnen den passenden zusätzlichen Arbeitsbereich. Unter 1100 Pixeln nutzt dieser die Hauptleiste. Schließen verwirft keinen begonnenen Text oder Zeichenzug. Raumtexte verwenden dieselben vorhandenen Key-Records und Speicherregeln.

Das Mausrad zoomt am Zeiger. Mittlere Maustaste oder **Leertaste + Ziehen** verschieben vorübergehend die Kamera. Enter schließt einen Punktzug ab, Backspace entfernt seinen letzten Punkt, Escape verwirft ihn. Kartenkürzel wirken auf der Karte, nicht während Texteingaben. Werkzeuge und Werkzeugfamilien dürfen einen begonnenen Zug nicht stillschweigend verwerfen.

[Native Layout- und Bedienprobe mit Vorher/Nachher-Bildern](reference/atlas-workspace-layout-20261018/README.md).

## Vorbereiten

1. Kampagne öffnen und **Atlas** wählen. Unter **Landschaft** die Hexstufe und das Terrain wählen; ein gedrückter Pinselzug ist eine gemeinsame Änderung.
2. Unter **Stadt** einen Namen eingeben, **Stadt platzieren** wählen und den Punkt auf der Karte anklicken. Die Stadt liegt jetzt an diesem Weltpunkt. Unter **Stadt → Werkzeug** Straßen, Viertel und Plätze zeichnen; **Viertel bebauen…** öffnet die Erzeugungsoptionen und Vorschau. Bebauung vorschlagen und übernehmen. Häuser einzeln korrigieren.
3. Ein Haus auswählen und **Innenraumhülle anlegen**. Der Innenbereich ist zunächst leer. Raumrechteck oder freie Raumwerkzeuge verwenden. Gebäuderäume behalten ihre freien Metermaße. Gebäude bewegen/drehen oder skalieren führt gebundene Räume mit; Höhen bleiben erhalten. Geteilte Wandpunkte bleiben bei direkter Konturbearbeitung verbunden.
4. **Geschoss**, **Dächer anzeigen** und **Höhenschnitt** verändern die Ansicht. Die Fachwerkzeuge behalten Raumtexte, Keys, Türen, Ausstattung, Volumen, Graph und Passagen. **Ort finden** findet Stadt, Haus und Raum innerhalb derselben Karte.
5. **Rückgängig/Wiederholen** umfasst Landschaft, Stadt, Räume, Keys und räumliche Bindungen. Bestätigte Schritte sind automatisch in SQLite gespeichert. Eine unbekannte IPC-Antwort bleibt mit ihrer Befehlskennung erhalten; **Speicherstand klären** fragt durch denselben idempotenten Auftrag nach. Eine spätere unvereinbare Änderung sperrt eine Rücknahme statt sie zu überschreiben.

Dungeondateien werden beim Import in eine offene Kampagne am zuletzt gewählten Atlaspunkt eingefügt. Räume, Geschosse und Abschnittsbindungen bekommen kollisionsfreie lokale IDs; der originale UTF-8-Quelltext bleibt zusätzlich erhalten. Ohne offene Kampagne bleibt der Import als neue Kampagne möglich. Unabhängige Kampagnenkopien erhalten eigene IDs und eine frische Autorhistorie; räumliche Beziehungen bleiben verbunden.

## Leiten

Fokusgruppe unter Party und Leiten wählen. **Erkunden** verwendet ihre vorhandene Position, Mitgliedschaft, ihr Tempo und ihre Uhr. Ziel anklicken → **Weg prüfen** → **Reise starten** → Schritt/Runde/Wiedergabe. Ein lokaler Fußweg meidet Häuser, Wasser und Mauern; lange Strecken verwenden die vorhandene Weltreise. Die lokale Wegsuche ist eine abgeleitete Navigationshilfe und verändert keine Quellkonturen.

Raum auswählen → **Eingang verbinden** → zuerst Außenpunkt, dann Innenpunkt setzen. Am Eingang angekommen den angebotenen Eingang ausdrücklich betreten; mehrere nahe Eingänge stehen zur Auswahl. Auch das Verlassen ist ausdrücklich. Eingangskosten zählen zur selben Gruppenuhr. **Zur Gruppe** verändert nur den Ausschnitt. **Gruppe platzieren** beziehungsweise bestätigtes Tokenziehen ist ein GM-Eingriff ohne Reisezeit.

NPCs, Spuren, Wege und **Wissen und Sicht der Gruppe** verwenden vorhandene Dungeon-Laufdaten. Unpassende Geometrieänderungen, die Figuren außerhalb ihrer Räume zurückließen, werden abgewiesen; geänderte Reisegrundlagen halten laufende Wege an. Routen werden nach Neustart weiter angezeigt, automatische Wiedergabe beginnt erst auf ausdrücklichen Start.

**Atlas ausgeben** erzeugt den Ausschnitt als PNG. GM-Ausgabe verwendet die sichtbare Bearbeitungsansicht. Die öffentliche Ausgabe wird ausschließlich aus der vorhandenen öffentlichen Wahrnehmungsprojektion aufgebaut. Ein fehlender öffentlicher Kontext wird gemeldet; GM-Knoten werden dafür nicht bloß ausgeblendet.

## Grenzen

Der gemeinsame Ablauf ersetzt die getrennten Desktopkartenflächen. Der übrige dokumentierte Fachumfang und die vollständige Produktabnahme bleiben offen. Insbesondere sind alternative Betriebssysteme, umfassende große Welt-/Datensätze und vollständige Gleichwertigkeit mit den Vorbildern hiermit nicht abgenommen. Die lokale Fußwegplanung ist auf 5 km und 60.000 Suchknoten begrenzt; für längere Strecken dient die Weltreise. Gebäude mit expliziten Rastervolumen werden nicht durch eine freie Gebäudeskalierung verzerrt.

Alte Testbestände ohne Atlaswurzel werden nicht in ein Mehrkartenmodell migriert. Historische Referenzen und Originalquellen im Repository bleiben erhalten. Neue Kampagnen starten mit einer leeren gemeinsamen Welt.

## Eine Region vorbereiten (0.157)

Die kleinste Hexstufe misst **3 Meilen / 4828,032 m zwischen gegenüberliegenden Kanten**. Weitere Stufen wachsen mit Faktor drei. Hexstufe und Kamera sind unabhängig: Städte und Räume bleiben in Metern bearbeitbar. **Weltübersicht** zoomt bis zu einer erdgroßen Referenzfläche von 40.000 × 20.000 km; je Fensterformat erscheint zusätzlicher Rand. Die Welt bleibt verschiebbar.

Unter **Landschaft → Region vorbereiten**:

1. Gelände/Küste malen oder Hexfläche füllen wählen. Geländeart und Hexstufe einstellen; der Pinselradius gilt nur für freie Pinselzüge. Hexzüge füllen auch bei schneller Bewegung alle Hexes zwischen den aufgenommenen Punkten; die farbige Vorschau zeigt die spätere Fläche. Loslassen übernimmt einen Gelände-/Hexpinselzug als einen gemeinsamen rücknehmbaren Schritt. **Zug abschließen** bleibt für Punktzüge und offene Eigenschaften verfügbar. Gelände, Höhe und Klima werden getrennt überschrieben; **Eigenschaft zur Vorgabe zurücksetzen** entfernt nur die gewählte Eigenschaft im bemalten Bereich der gewählten Stufe. Feinere Vorgaben bleiben bestehen.
2. Fluss oder Weg wählen, Punkte setzen und abschließen. Unter Auswahl einen Verlauf anklicken oder aus der Objektliste wählen. Punkte ziehen, einfügen/entfernen, am inneren Punkt teilen und Breite ändern; anschließend Auswahl speichern. Eine gezeichnete Straßenquerung ist keine Brücke.
3. Namen eingeben, Ort platzieren und abschließen. Im selben Panel die geordneten Markdown-Abschnitte bearbeiten. Die Abschnitte besitzen stabile Links; Umbenennen und Verschieben ändern ihre Kennungen nicht. Entfernen aus dem Atlas löscht die Ortsprosa nicht. Die vorhandenen Orts- und Weltfunktionen verwenden dieselben Ortskennungen.
4. Unter Nachzeichenvorlage ein PNG/JPEG/WebP laden, zwei Punkte im Bild anklicken und deren reale Entfernung in Metern eingeben. Abschließen übernimmt die Kalibrierung. Über die Objektliste die Vorlage auswählen; Deckkraft, Sichtbarkeit, Sperre und Lage bearbeiten. Nach Entsperren dienen der Ursprung und der gegenüberliegende Griff zum Verschieben beziehungsweise Skalieren/Drehen. Die importierte Vorlage wird innerhalb der Kampagne gespeichert und mitkopiert.
5. Strecke messen wählen und Wegpunkte setzen. Die Anzeige verwendet reale Meter, Kilometer und Meilen; Messen speichert keine Autorenänderung und verbraucht keine Reisezeit. Die dynamische Maßstabsleiste bleibt beim Zoomen lesbar.
6. Ausgabebereich wählen, zwei Ecken setzen und abschließen. Unter Atlas ausgeben PNG oder JPEG, Raster und längste Bildkante bis 8192 Pixel einstellen. Ohne Rahmen gilt die aktuelle Ansicht. GM-Ausgaben zeigen bestätigte Inhalte ohne Bearbeitungsgriffe, Entwürfe oder Messhilfen. Vorlagen sind standardmäßig ausgeschlossen. Öffentliche Ausgabe verwendet weiterhin die bestehende Wissensprojektion.

Landschaftsflächen und Verläufe werden räumlich indiziert gelesen. Lokale Reiseprüfungen berücksichtigen die feinen Wasserflächen; entfernte Wege verwenden weiterhin die bestehende Hexreise mit ihren GM-Entscheidungen. Kamera, Maßstab und Messung verändern keine Position oder Uhr.

Schema 46 übernimmt vorhandene Landschaftszellen als explizite Flächen mit ihren ursprünglichen metrischen Ausdehnungen. Eine neue Faktor-3-Abstufung verschiebt diese Flächen nicht. Die bisherige Autorenhistorie wird bei dieser einmaligen Landschaftsumstellung beendet; laufende Autorenarbeit und spätere Änderungen verwenden wieder die gemeinsame Historie. Über vollständige Versionswechsel fortgesetzte Undo-Historien sind kein zugesagtes Format. Schema-45-Kampagnenpakete bleiben über eine Arbeitskopie importierbar; Originalpakete werden nicht verändert.

Offen bleiben der vollständige Biom-/Symbolkatalog, Heightmaps, automatische Brücken, zusätzliche Landschafts- und Stilwerkzeuge sowie die umfassende Großwelt- und Plattformabnahme.
