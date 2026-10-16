# Eine Kampagne, eine Karte

Die Desktopanwendung verwendet eine Kampagnenwelt. Hexgelände, Städte, Gebäude und Dungeonräume liegen in derselben metrischen Fläche. Stadt und Dungeon sind räumliche Bereiche mit eigenen fachlichen Werkzeugen; sie besitzen keine unabhängig auswählbaren Karten. Die Kamera und die Auswahl bleiben beim Werkzeugwechsel erhalten. Zoomen erzeugt weder Geometrie noch Reisezeit.

## Vorbereiten

1. Kampagne öffnen und **Atlas** wählen. Unter **Landschaft** die Hexstufe und das Terrain wählen; ein gedrückter Pinselzug ist eine gemeinsame Änderung.
2. Einen Punkt anklicken, Namen eingeben, **Stadt hier anlegen**. Die Stadt liegt jetzt an diesem Weltpunkt. Unter **Stadt** Straßen, Viertel und Plätze zeichnen, Bebauung vorschlagen und übernehmen. Häuser einzeln korrigieren.
3. Ein Haus auswählen und **Innenraum anlegen**. Der Innenbereich ist zunächst leer. Raumrechteck oder freie Raumwerkzeuge verwenden. Gebäuderäume behalten ihre freien Metermaße. Gebäude bewegen/drehen oder skalieren führt gebundene Räume mit; Höhen bleiben erhalten. Geteilte Wandpunkte bleiben bei direkter Konturbearbeitung verbunden.
4. **Geschoss**, **Dächer anzeigen** und **Höhenschnitt** verändern die Ansicht. Ein Geschosswechsel wartet, bis offene Bearbeitungen abgeschlossen sind; ein begonnenes Raumrechteck bleibt auf seinem ursprünglichen Geschoss. Die Fachwerkzeuge behalten Raumtexte, Keys, Türen, Ausstattung, Volumen, Graph und Passagen. **Ort finden** findet Stadt, Haus und Raum innerhalb derselben Karte.
5. **Rückgängig/Wiederholen** umfasst Landschaft, Stadt, Räume, Keys und räumliche Bindungen. Bestätigte Schritte sind automatisch in SQLite gespeichert. Eine unbekannte IPC-Antwort bleibt mit ihrer Befehlskennung erhalten; **Speicherstand klären** fragt durch denselben idempotenten Auftrag nach. Eine spätere unvereinbare Änderung sperrt eine Rücknahme statt sie zu überschreiben.

Allgemeine Orte: Unter **Navigation** einen Kartenpunkt wählen → **Ort hier anlegen…**. Name, Beschreibung und SL-Notizen werden zusammen mit dem Marker gespeichert. Der Marker sitzt am gewählten Meterpunkt; das Reisehex bleibt damit verbunden. **Ort finden** sucht auch diese Ortsnamen. Marker wählen → **Ortsmappe öffnen** liest die kanonischen Abschnitte. **Ortstext bearbeiten…** öffnet denselben Ort im Editor; **Zur Karte: Atlas** sichert offene gültige Texte und kehrt zur Auswahl und zum vorherigen Ausschnitt zurück. Rückgängig/Wiederholen nimmt die Ortsanlage samt Marker gemeinsam zurück.

Ein Haus wählen → **Versetzen / drehen…**. Zielpunkt auf derselben Karte anklicken, mit ±90° oder dem Winkelregler ausrichten, dann **Platzierung übernehmen**. Die gestrichelte Kontur zeigt die ursprüngliche Fläche. **Verwerfen** ändert nichts; eine übernommene Platzierung ist ein gemeinsamer Rückgängig-Schritt. Notizen und Kartenausschnitt bleiben erhalten. Bei unbekanntem Speicherergebnis verwendet **Ergebnis prüfen** denselben Auftrag. Eine endgültige Ablehnung gibt die Vorschau wieder zum Verwerfen frei.

Dungeondateien werden beim Import in eine offene Kampagne am zuletzt gewählten Atlaspunkt eingefügt. Räume, Geschosse und Abschnittsbindungen bekommen kollisionsfreie lokale IDs; der originale UTF-8-Quelltext bleibt zusätzlich erhalten. Ohne offene Kampagne bleibt der Import als neue Kampagne möglich. Unabhängige Kampagnenkopien erhalten eigene IDs und eine frische Autorhistorie; räumliche Beziehungen bleiben verbunden.

## Leiten

Fokusgruppe unter Party und Leiten wählen. **Erkunden** verwendet ihre vorhandene Position, Mitgliedschaft, ihr Tempo und ihre Uhr. Ziel anklicken → **Weg prüfen** → **Reise starten** → Schritt/Runde/Wiedergabe. Ein lokaler Fußweg meidet Häuser, Wasser und Mauern; lange Strecken verwenden die vorhandene Weltreise. Die lokale Wegsuche ist eine abgeleitete Navigationshilfe und verändert keine Quellkonturen.

Raum auswählen → **Eingang verbinden** → zuerst Außenpunkt, dann Innenpunkt setzen. Am Eingang angekommen den angebotenen Eingang ausdrücklich betreten; mehrere nahe Eingänge stehen zur Auswahl. Auch das Verlassen ist ausdrücklich. Eingangskosten zählen zur selben Gruppenuhr. **Zur Gruppe** verändert nur den Ausschnitt. **Gruppe platzieren** beziehungsweise bestätigtes Tokenziehen ist ein GM-Eingriff ohne Reisezeit.

NPCs, Spuren, Wege und **Wissen und Sicht der Gruppe** verwenden vorhandene Dungeon-Laufdaten. Unpassende Geometrieänderungen, die Figuren außerhalb ihrer Räume zurückließen, werden abgewiesen; geänderte Reisegrundlagen halten laufende Wege an. Routen werden nach Neustart weiter angezeigt, automatische Wiedergabe beginnt erst auf ausdrücklichen Start.

**Wissen und Sicht der Gruppe** ersetzt die Kartenfläche durch die öffentliche Wahrnehmung der Fokusgruppe: bekannte Bereiche, freigegebene Bezeichnungen und Ortsmarker sowie ihre aktuelle Position. SL-Raumnamen und verborgene Bereiche werden darin nicht gezeichnet. Diese Vorschau verändert weder die Einstellungen noch den Inhalt des separaten Spielerfensters; sie ist auch bei ausgeblendetem Spielerfenster nutzbar. Die Karte bleibt schreibgeschützt. Unter **Erkunden** können bekannte Bereiche als Reiseziele gewählt und bestätigte Schritte verfolgt werden. Zum Bearbeiten den Filter ausschalten. Ohne gültigen Gruppenkontext bleibt die Fläche leer; bei einem Ladefehler bietet **Gruppensicht neu laden** einen erneuten Leseversuch an.

**Atlas ausgeben** erzeugt den Ausschnitt als PNG oder JPEG. GM-Ausgabe verwendet die sichtbare Bearbeitungsansicht. Die öffentliche Ausgabe wird ausschließlich aus der vorhandenen öffentlichen Wahrnehmungsprojektion aufgebaut. Ein fehlender öffentlicher Kontext wird gemeldet; GM-Knoten werden dafür nicht bloß ausgeblendet.

## Grenzen

Der gemeinsame Ablauf ersetzt die getrennten Desktopkartenflächen. Der übrige dokumentierte Fachumfang und die vollständige Produktabnahme bleiben offen. Insbesondere sind alternative Betriebssysteme, umfassende große Welt-/Datensätze und vollständige Gleichwertigkeit mit den Vorbildern hiermit nicht abgenommen. Die lokale Fußwegplanung ist auf 5 km und 60.000 Suchknoten begrenzt; für längere Strecken dient die Weltreise. Gebäude mit expliziten Rastervolumen werden nicht durch eine freie Gebäudeskalierung verzerrt.

Alte Testbestände ohne Atlaswurzel werden nicht in ein Mehrkartenmodell migriert. Historische Referenzen und Originalquellen im Repository bleiben erhalten. Neue Kampagnen starten mit einer leeren gemeinsamen Welt.

## Eine Region vorbereiten (0.157)

Die kleinste Hexstufe misst **3 Meilen / 4828,032 m zwischen gegenüberliegenden Kanten**. Weitere Stufen wachsen mit Faktor drei. Hexstufe und Kamera sind unabhängig: Städte und Räume bleiben in Metern bearbeitbar. **Weltübersicht** zoomt bis zu einer erdgroßen Referenzfläche von 40.000 × 20.000 km; je Fensterformat erscheint zusätzlicher Rand. Die Welt bleibt verschiebbar.

Unter **Landschaft → Region vorbereiten**:

1. Gelände/Küste malen oder Hexfläche füllen wählen. Geländeart, Hexstufe und Pinselradius einstellen, auf der Karte zeichnen und **Zug abschließen**. **Verwerfen** erhält den vorherigen Stand. Gelände, Höhe und Klima werden getrennt überschrieben; **Eigenschaft zur Vorgabe zurücksetzen** entfernt nur die gewählte Eigenschaft im bemalten Bereich der gewählten Stufe. Feinere Vorgaben bleiben bestehen.
2. Fluss oder Weg wählen, Punkte setzen und abschließen. Unter Auswahl einen Verlauf anklicken oder aus der Objektliste wählen. Punkte ziehen, einfügen/entfernen, am inneren Punkt teilen und Breite ändern; anschließend Auswahl speichern. Eine gezeichnete Straßenquerung ist keine Brücke.
3. Namen eingeben, Ort platzieren und abschließen. Im selben Panel die geordneten Markdown-Abschnitte bearbeiten. Die Abschnitte besitzen stabile Links; Umbenennen und Verschieben ändern ihre Kennungen nicht. Entfernen aus dem Atlas löscht die Ortsprosa nicht. Die vorhandenen Orts- und Weltfunktionen verwenden dieselben Ortskennungen.
4. Unter Nachzeichenvorlage ein PNG/JPEG/WebP laden, zwei Punkte im Bild anklicken und deren reale Entfernung in Metern eingeben. Abschließen übernimmt die Kalibrierung. Über die Objektliste die Vorlage auswählen; Deckkraft, Sichtbarkeit, Sperre und Lage bearbeiten. Nach Entsperren dienen der Ursprung und der gegenüberliegende Griff zum Verschieben beziehungsweise Skalieren/Drehen. Die importierte Vorlage wird innerhalb der Kampagne gespeichert und mitkopiert.
5. Strecke messen wählen und Wegpunkte setzen. Die Anzeige verwendet reale Meter, Kilometer und Meilen; Messen speichert keine Autorenänderung und verbraucht keine Reisezeit. Die dynamische Maßstabsleiste bleibt beim Zoomen lesbar.
6. Ausgabebereich wählen, zwei Ecken setzen und abschließen. Unter Atlas ausgeben PNG oder JPEG, Raster und längste Bildkante bis 8192 Pixel einstellen. Ohne Rahmen gilt die aktuelle Ansicht. GM-Ausgaben zeigen bestätigte Inhalte ohne Bearbeitungsgriffe, Entwürfe oder Messhilfen. Vorlagen sind standardmäßig ausgeschlossen. Öffentliche Ausgabe verwendet weiterhin die bestehende Wissensprojektion.

Landschaftsflächen und Verläufe werden räumlich indiziert gelesen. Lokale Reiseprüfungen berücksichtigen die feinen Wasserflächen; entfernte Wege verwenden weiterhin die bestehende Hexreise mit ihren GM-Entscheidungen. Kamera, Maßstab und Messung verändern keine Position oder Uhr.

Schema 46 übernimmt vorhandene Landschaftszellen als explizite Flächen mit ihren ursprünglichen metrischen Ausdehnungen. Eine neue Faktor-3-Abstufung verschiebt diese Flächen nicht. Die bisherige Autorenhistorie wird bei dieser einmaligen Landschaftsumstellung beendet; laufende Autorenarbeit und spätere Änderungen verwenden wieder die gemeinsame Historie. Über vollständige Versionswechsel fortgesetzte Undo-Historien sind kein zugesagtes Format. Schema-45-Kampagnenpakete bleiben über eine Arbeitskopie importierbar; Originalpakete werden nicht verändert.

Offen bleiben der vollständige Biom-/Symbolkatalog, Heightmaps, automatische Brücken, zusätzliche Landschafts- und Stilwerkzeuge sowie die umfassende Großwelt- und Plattformabnahme.
