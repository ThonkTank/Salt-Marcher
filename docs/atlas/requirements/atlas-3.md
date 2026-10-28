# 4. Abnahme, Fehlerfälle und feste Vorgaben

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: atlas
Last Reviewed: 2026-10-28 (Raster-/Geländetrennung und Prüfvertrag; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## 4. Abnahme, Fehlerfälle und feste Vorgaben

### Häufige Prüfungen und ein gemeinsamer Alltagsablauf

1. **Während der Änderung:** Gezielte Kernprüfungen für tatsächlich gefährdete Regeln wie Koordinatenumrechnung, Vererbung, Undo und gekoppelte Recovery ausführen. Eine neue sichtbare Aktion früh im tatsächlichen Zielhost bedienen.
2. **Am Ende jeder Lieferung:** die betroffenen Tests und Typ-/Buildchecks nach dem [Repository-Prüfvertrag](../../project/verification/testing.md) ausführen; die sechs Pflichtchecks der exakten Candidate-SHA bleiben vor Integration verbindlich; den neuen Ablauf und die bisher verfügbare Folge auf der gemeinsamen Testregion prüfen. Änderung, Abbruch, Undo/Redo, Save und frische Öffnung gehören bei betroffenen persistenten Daten dazu. Der kurze unabhängige Review kontrolliert auch den Build der Nachweise.
3. Einen überprüften Testbuild auf isolierten Daten ausprobieren; getestete Funktionen und offene Fälle mit direktem Beleg unterscheiden.
4. **Nach Änderungen an Kamera, Laden, Assets oder Renderer:** Eine größere Karte und mehrfaches Hin- und Zurückzoomen prüfen. Die Testgröße wächst von der kleinen Region über 10.000 zu 100.000 bearbeiteten kontinuierlichen Geländeflächen. Zeit, Speicher und Ressourcenfreigabe werden ab HEX-08 tatsächlich gemessen.
5. **An jedem Meilenstein:** Den bisherigen Kernablauf zusammenhängend durchspielen und gespeicherte Texte, Links, Positionen und einen bisherigen Referenzausschnitt vergleichen. Physische Bedienung beginnt mit dem ersten nutzbaren Stand; fehlende Hardware-/Nutzerprüfungen bleiben offen und werden nicht aus synthetischen Eingaben abgeleitet.

Ab HEX-05 lautet die feste Folge: **Region anzeigen → Gelände ändern → Orts-Key bearbeiten → in den Dungeon zoomen → Raum und Key bearbeiten → herauszoomen → rücknehmen/wiederholen → speichern → frischer Start → denselben Ort wiederfinden.** Ab CITY-03 wird zusätzlich in Stadt und Haus gezoomt und dort Straße, Gebäude und Hausgrundriss direkt bearbeitet. Keine dieser Aktionen verlangt einen Karten-, Kontext- oder Moduswechsel. Spätere Landschafts-, Symbol- und Exportfunktionen werden in diese Testregion eingebaut. Ein reiner Editor-Neustart oder eine Sammlung isolierter Dialogtests ersetzt diese Folge nicht.

Funktionsbeleg und Paritätsbeleg werden je Unterfall getrennt festgehalten; Nachweise nennen den geprüften Build und den tatsächlichen Stand.

### Funktions- und Bedienabnahme

Der [Wonderdraft-Vergleichsplan](../verification/reference-comparison.md) übernimmt den Unterfall- und Paarablauf der Dungeondraft-Abnahme. Der verbindliche Katalog unter `acceptance.json.wonderdraftParity` hält für jeden Fall fest: exakter Originalpfad und Ablauf, Optionen, Vorschau, Abschluss oder Abbruch, Undo/Redo, gespeicherter Zustand, frische Neuöffnung, Hostbuild, Review und verbleibende Abweichungen. Insbesondere werden Werkzeugvorgaben und vorhandene Instanzen, Auswahl-/Zeichenreihenfolge, Abbruch/Textfokus und globale beziehungsweise kartenlokale Werte getrennt geprüft. Die offiziellen [Tastatur- und Gestenabläufe](https://github.com/Megasploot/Wonderdraft/wiki/Shortcuts) dienen als Einstieg; maßgeblich bleibt das Verhalten der lokalen Version. Fehlende Originalbelege bleiben offen.

Die eigenen Werkzeuge erreichen die benötigten Wirkungen in der gemeinsamen Atlasansicht. Originalgesten dienen als Referenzbeobachtung, nicht als Nachbaupflicht. Es werden dafür keine Overworld-, Stadt- oder Dungeonmodi eingeführt. Alle Vorbilder werden anhand gleicher Aufgaben und bearbeitbarer Ergebnisse verglichen; die eigene Bedienung wird gesondert geprüft. Texteingabe im Key-Editor darf keine Kartenaktionen auslösen.

### Zusammenhängende Prüfszenarien

- Eine grobe Insel gestalten, bis zum 3-Meilen-Hex hineinzoomen und einen Küstenbereich verfeinern. Anschließend die grobe Vorgabe ändern und den Erhalt der feinen Bearbeitung prüfen.
- Fluss und Straße über Hex-, Stufen- und Ladegrenzen bearbeiten; sämtliche Anschlüsse nach Neuöffnung kontrollieren.
- Stadt mit Orts-Key, POI und Dungeon anlegen. Verschiebung, Drehung und mehrere Eingänge einschließlich Rücknahme prüfen.
- Weltübersicht → Region → Stadt → Haus → Raum ausschließlich zoomen; auf jeder Detailstufe direkt bearbeiten. Werkzeugleiste, Werkzeug, Auswahl und durchgehende Undo-Folge dürfen nicht durch einen Modus-/Kontextwechsel ersetzt werden.
- Jenseits der bisherigen belegten Ausdehnung Gelände zeichnen, eine Stadt platzieren und ein Gebäude mit Innenräumen bearbeiten. Ohne Resize-/Betreten-/Kartenwechselaktion hinein- und herauszoomen; Undo/Redo und Neuöffnung erhalten alle Weltpositionen. Eine Änderung des Exportausschnitts beschneidet keinen Atlasinhalt.
- Direktlinks zu Orts-, Raum- und Key-Abschnitten nach Dateiumbenennung und Neustart öffnen.
- Externe Dateiänderung und unterbrochenes Speichern provozieren. Konflikte müssen sichtbar bleiben und Entwürfe wiederherstellbar sein.
- Bildvorlage, Editoransicht und Export auf denselben Ausschnitt ausrichten und ihre räumliche Übereinstimmung kontrollieren.

### Größen- und Leistungsabnahme

Die große Prüfwelt besitzt eine **belegte Ausdehnung von 40.000 × 20.000 Kilometern**, 100.000 ausdrücklich bearbeitete kontinuierliche Geländeflächen, 5.000 Orte und 50 verknüpfte Detailkarten; mindestens ein Dungeon enthält über 4.000 Entitäten. Das ist ein Prüfszenario, kein Atlaslimit. Neue Inhalte jenseits dieses Bereichs gehören zur Wachstumsabnahme.

Geprüft werden Ladezeit, Reaktionszeit, Kamerabewegung, Speicherbedarf und Freigabe ungenutzter Ressourcen. Als Ziel gelten auf dem vorhandenen Laptop nach dem Laden höchstens 33 ms pro Navigationsbild im 95. Perzentil und höchstens 100 ms bis zur Werkzeugvorschau. Die Übersicht muss nutzbar werden, bevor alle Detaildaten geladen sind.

Kernprüfungen, Build, Zielhost-Bedienung, Großkartenlauf und physische Maus-/Touchpad-Abnahme werden getrennt dokumentiert.

### Gewählte Defaults

- Die Welt ist zunächst ein **ebener Atlas**; Weltkarten benötigen keine Kugelprojektion.
- Der Atlas hat keine festen Ränder und keine Größenabfrage beim Anlegen. Inhalt bestimmt die belegte Ausdehnung. Erzeugte Bereiche, Vorlagen und Ausschnitte erhalten Maße in Meilen oder Hex-Kacheln einer benannten Stufe; Pixel bestimmen nur Darstellung und Bildausgabe.
- Reise- und Referenzraster besitzen ihren eigenen Maßstab und Ursprung; sie legen weder Gelände-Autorenauflösung noch eine neue Karte fest. Aktuelle Auswahl: [Bedienung](../guide.md#eine-region-vorbereiten). Die beim Anlegen wählbare und danach feste Rasterausrichtung bleibt ein Fachziel; dieser Dokumentationsabgleich bestätigt dafür keine Umsetzung oder Abnahme.
- Automatischer Stufenwechsel besitzt einen Übergangsbereich gegen Hin-und-her-Springen; eine manuelle Stufenwahl bleibt möglich.
- Unterhalb des kleinsten Reiserasters bleibt metrische Landschaft bearbeitbar. Stadt- und Dungeonraster ergänzen ihre eigenen Fachwerkzeuge; sie übernehmen keine Terrain-Autorenstufe.
- Orts-/Raum-Keys und Stadtgeometrie folgen dem [gemeinsamen Store- und Adaptervertrag](atlas-2.md#gemeinsamer-raum-und-kartenformate). IDs, Prosa und bestehende Links bleiben beim Übergang erhalten.
- Außenform und Innenräume eines Gebäudes werden gemeinsam bearbeitet; eigenständige Dungeons bleiben stabil verortet. Generation schützt manuelle Änderungen, Innenräume und Keys.
- Der Atlas bleibt ein durchgehend bearbeitbarer Raum ohne separate Modi. Zoom allein erschließt räumliche Größenstufen; Detaildarstellung ist kein Wechsel des Editors.
- Bestehende Wonderdraft-Karten werden als Bildvorlagen verwendet; ihre Originaldateien bleiben erhalten.
- Bestehende Dungeonkarten werden durch ihre Atlasplatzierung nicht umgerechnet oder neu gezeichnet.

## Einordnung in das Gesamtprodukt

Der [Hex-Beitrag zum gemeinsamen End-to-End-Fertigstellungsplan](../../project/verification/end-to-end.md#räumliche-end-to-end-kriterien) verbindet die nächsten sichtbaren Phasen mit Campaign, Dungeon/City, Live-Spiel und Fehler-/Displaygates aus den [E2E-Kriterien](../../project/verification/end-to-end.md). Die vier gemeinsamen Abläufe ersetzen keine der hier verpflichtenden Fachphasen oder Wonderdraft-Vergleiche. Neue Integration erfolgt über geprüfte Kandidaten-SHAs mit unabhängigem Review.

R5 der Relief-Roadmap ist lokal implementiert und geprüft: [gekippter Atlas mit denselben drei Landpinseln](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/terrain-tilted-atlas-r5-20261020/README.md). R6/R7, Main-/Candidate-CI und Paket-/Installationsqualifikation bleiben offen.
