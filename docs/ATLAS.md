# Eine Kampagne, eine Karte

Die Desktopanwendung verwendet eine Kampagnenwelt. Hexgelände, Städte, Gebäude und Dungeonräume liegen in derselben metrischen Fläche. Stadt und Dungeon sind räumliche Bereiche mit eigenen fachlichen Werkzeugen; sie besitzen keine unabhängig auswählbaren Karten. Die Kamera und die Auswahl bleiben beim Werkzeugwechsel erhalten. Zoomen erzeugt weder Geometrie noch Reisezeit.

## Vorbereiten

1. Kampagne öffnen und **Atlas** wählen. Unter **Landschaft** die Hexstufe und das Terrain wählen; ein gedrückter Pinselzug ist eine gemeinsame Änderung.
2. Einen Punkt anklicken, Namen eingeben, **Stadt hier anlegen**. Die Stadt liegt jetzt an diesem Weltpunkt. Unter **Stadt → Fachwerkzeuge und Details** Straßen, Viertel und Plätze zeichnen, Bebauung vorschlagen und übernehmen. Häuser einzeln korrigieren.
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
