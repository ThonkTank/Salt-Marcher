# Roadmap: Hex-Atlas mit Wonderdraft-Parität und verbundenen Orts- und Dungeon-Keys

## 1. Ausgangspunkt und Zielbild

Der bestehende Dungeon-Editor liefert eine brauchbare Grundlage: native Kartendateien, stabile Kennungen, strukturierte Raum-Keys, Undo/Redo, konfliktgeschütztes Speichern, Zeichenwerkzeuge, Assets und eine Spielansicht. Hex-Geometrie, mehrere räumliche Maßstäbe und eine gemeinsame Verortung verschiedener Karten fehlen bislang. Die laufende Dungeondraft-Abnahme enthält außerdem noch offene Abschlussarbeiten. Grundlage sind die vorhandene [Architektur](ARCHITECTURE.md) und der [Abnahmekatalog](acceptance.json).

Die lokal installierte Wonderdraft-Version ist **1.1.8.2**. Installationsdateien und offizielle Dokumentation wurden geprüft; eine vollständige direkte Bedienabnahme steht noch aus. Die dokumentierten Kernbereiche umfassen unter anderem Landmassen, Küsten, Flüsse, Straßen, Symbolpinsel, Gestaltungsvorlagen und Beschriftungen. [Wonderdraft](https://wonderdraft.net/), [offizieller Quick Guide](https://github.com/Megasploot/Wonderdraft/wiki/Quick-Guide).

Das vereinbarte Ziel:

- **Hexes tragen die Landschaftsdaten.** Innerhalb eines Hexes sind natürliche Küsten, weiche Übergänge und frei platzierte Details möglich.
- **Alle Hex-Stufen sind bearbeitbar.** Grobe Weltgestaltung lässt sich schrittweise verfeinern.
- **3 Meilen bilden die kleinste Hex-Stufe.** Darunter folgen Stadt- und Dungeonansichten mit ihrem eigenen Detailraster.
- **Overworld, Städte und Dungeons teilen einen räumlichen Atlas.** Lage, Orientierung, Maßstab und Eingänge verbinden die Karten.
- **Alle räumlichen Detailstufen sind allein durch Zoom erreichbar.** Welt → Region → Stadt → Haus → Dungeonraum bleibt an denselben Weltpositionen.
- **Es gibt keine separaten Modi.** Navigation und Bearbeitung bleiben in einem Editor mit gemeinsamer Kamera, Werkzeugleiste, Auswahl und durchgehender Undo/Redo-Folge. Zoom wechselt keine Editoroberfläche oder Bearbeitungsart.
- **Städte und POIs erhalten `.location`-Dateien**, deren Keys wie die heutigen Dungeon-Keys bearbeitet werden.
- **Stadtpläne werden nativ erzeugt und direkt bearbeitet.** Watabous Stadtgrundrisse und Canvas of Kings dienen als Ergebnisvorbilder; die Bedienung gestalten und prüfen wir eigenständig. Die [Stadtplan-Roadmap](ROADMAP-CITIES.md) ergänzt frühe nutzbare Phasen.
- **Wonderdraft-Parität umfasst Funktionen und Bedienabläufe.** Eine ungefähr gleichwertige grafische Darstellung genügt; Pixelgleichheit ist kein Abnahmekriterium.
- **Ooke-Welt und Ooke-Kontinent dienen als Bildvorlagen.** Neue Hex-Karten entstehen nativ.

Der vollständige Nutzerablauf lautet: Welt gestalten → Region verfeinern → 3-Meilen-Hex bearbeiten → in die Stadt zoomen und Straßen/Häuser ändern → in einen Hausgrundriss zoomen und Räume ändern → Orts-/Raum-Key bearbeiten → wieder herauszoomen. Alle Karteninhalte bleiben im selben Atlas direkt bearbeitbar.

## 2. Verbindliche Architektur

### Gemeinsamer Raum und Kartenformate

- **`.overworld`** enthält Weltmaßstab, Hex-Stufen, Landschaft, räumliche Platzierungen und Verweise auf Orte und Detailkarten. Große Datenbestände liegen in zugehörigen, bei Bedarf geladenen Dateien.
- **`.location`** enthält stabile Ortskennung, Name, Typ, geordnete Markdown-Abschnitte und Verknüpfungen zu Detailkarten. Lage und Ausrichtung werden im Atlas gespeichert.
- **`.city`** enthält native Stadtgeometrie mit Straßen, Vierteln, Grundstücken und Gebäuden sowie Generatorvorgaben und manuell bearbeiteten Elementen. Orts-Keys bleiben in `.location`; die Stadt verwendet die gemeinsame Zeichen- und Speicherbasis.
- **`.dungeon` bleibt das Dungeonformat.** Raum-Keys und vorhandene Links behalten ihre Kennungen. Hausgrundrisse werden räumlich an Stadtgebäude gebunden.
- Weltpositionen werden intern in Metern geführt. Bestehende Dungeonfelder entsprechen weiterhin fünf Fuß. Verschiebung, Drehung und Maßstabsumrechnung verbinden die lokalen Kartenkoordinaten mit dem Atlas.
- Eingänge verknüpfen einen räumlichen Anker mit Dungeonkarte, Geschoss und gegebenenfalls Raum oder Durchgang. Ein Dungeon kann mehrere Eingänge besitzen.
- Geschosse bleiben getrennte Ebenen. Ihre bisherige Reihenfolge wird nicht automatisch als physische Höhe interpretiert.

Der Atlas erhält eine gemeinsame Kamera und einen durchgehenden Editor. Detailgeometrie wird abhängig von sichtbarer Größe und Ausschnitt geladen und bleibt unmittelbar bearbeitbar. Das Werkzeug und die direkt getroffene Geometrie bestimmen den Befehl und seine betroffenen Dokumente. Zoom verändert die sichtbare Detailtiefe; Werkzeug, Auswahl, Kamera und Historie bleiben erhalten. Es gibt keinen erforderlichen Karten-, Kontext- oder Moduswechsel.

### Hex-Stufen und Landschaft

Als Standard dienen **3, 9, 27, 81, 243, 729 und 2.187 Meilen**. Größere Stufen werden nach derselben Regel ergänzt, wenn die Weltgröße sie benötigt. Die Größenangabe bezeichnet den Abstand zwischen benachbarten Hex-Mittelpunkten.

- Hexes erhalten stabile Adressen aus Weltkennung, Stufe und axialen Koordinaten.
- Alle Stufen teilen Ursprung und Ausrichtung. Die Zuordnung zwischen Stufen erfolgt über Flächenüberschneidungen: Reguläre Hexes verschiedener Größen gehen geometrisch nicht exakt ineinander auf.
- Grobe Bearbeitung setzt Landschaftsvorgaben. Feinere, ausdrücklich bearbeitete Eigenschaften überschreiben diese innerhalb ihres Bereichs.
- Spätere grobe Änderungen erhalten die fein ausgearbeiteten Eigenschaften. „Zur Vorgabe zurücksetzen“ entfernt eine solche lokale Überschreibung rücknehmbar.
- Übersichtsansichten werden aus dem zusammengesetzten Landschaftsstand abgeleitet. Änderungen feiner Stufen aktualisieren die betroffenen Übersichten.
- Flüsse, Straßen und Küsten besitzen zusammenhängende Geometrie in Weltkoordinaten und einen räumlichen Hex-Index. Dadurch bleiben Übergänge über Hex- und Ladegrenzen hinweg verbunden.

Gespeichert werden Vorgaben, bearbeitete Bereiche und Details. Eine Weltkarte erzeugt beim Anlegen noch keine vollständige Sammlung aller möglichen 3-Meilen-Hexes.

### Wiederverwendung der Editorbasis

Die vorhandenen Befehle, Speichermechanismen, Assetverwaltung und Key-Oberfläche werden gezielt erweitert. Hex-Geometrie und Landschaftsregeln bilden einen eigenen Bereich; quadratische Dungeonregeln behalten ihr Verhalten.

Der Renderer erhält wiederverwendbare Kartenszenen für den gemeinsamen Atlas. Sichtbare Ausschnitte, Detailstufen und Kamerabewegung werden unabhängig von gespeicherten Geometrien behandelt.

Neue gemeinsame Schnittstellen umfassen:

- **Hex-Adresse und Landschaftsabfrage** für jede Stufe.
- **Kartenplatzierung und Koordinatenumrechnung** zwischen Atlas und Detailkarte.
- **Einheitliches Key-Ziel** für Orts-, Raum- und Abschnittslinks.
- **Dokumentindex nach stabiler Kennung**, der Dateiumbenennungen berücksichtigt.
- **Dokumentübergreifende Befehle und Speicherjournale** für zusammengehörige Änderungen.

## 3. Kleine Phasen mit früh nutzbaren Ergebnissen

Die zehn bisherigen Etappen werden durch die folgenden **29 HEX-Phasen, HEX-00 bis HEX-28**, ersetzt und um **zehn Stadtphasen CITY-00 bis CITY-09** aus der [Stadtplan-Roadmap](ROADMAP-CITIES.md) ergänzt. Alle Phasen sind zunächst geplant. Die relative HEX-Reihenfolge bleibt verbindlich; die Stadtphasen werden an den unten genannten Stellen eingeordnet. Jede Phase erweitert den zuvor geprüften Benutzerablauf. Die Architektur aus Abschnitt 2 bleibt das Ziel, ihre notwendigen Teile entstehen zusammen mit der jeweiligen Funktion.

### Arbeitsregel gegen verlorene Funktionsfähigkeit

- Jede Phase liefert einen konkret bedienbaren Ablauf im echten Obsidian und erweitert die bestehende Testkarte. Sie beginnt mit offenen Punkten und einem konkreten technischen Plan in einer Datei neben der Roadmap. Planung, Umsetzung, Review und Nachbesserung werden als eigene Arbeitsläufe mit Start, Fokus und Ergebnis geführt. Review und Nachbesserung wiederholen sich bis zur belegten Freigabe ohne offene Pflichtlücke. HEX-00 liefert die Ausgangsbasis; der erste Detailplan steht in [ROADMAP-HEX-00-PLAN.md](ROADMAP-HEX-00-PLAN.md).
- Technische Vorarbeit wird auf die unmittelbar folgende Benutzeraktion begrenzt. Beispielsweise entstehen gemeinsame Key- und Renderer-Anbindungen beim Orts-Key beziehungsweise beim ersten Dungeonübergang.
- Schon die erste Atlasansicht verwendet einen gemeinsamen Bearbeitungsablauf. Keine spätere Phase darf separate Stadt-/Dungeonmodi voraussetzen. Vor dem Stadtproduktcode wird eine kleine Ergebnisgalerie der beiden Stadtvorbilder festgelegt; deren Gesten sind keine Paritätsvorgabe.
- HEX-00 erfasst vor HEX-01 die vollständig erreichbare Wonderdraft-Oberfläche: Werkzeuge, Menüs, Optionen, Dialoge und Gesten werden direkt inventarisiert und stabilen Unterfällen sowie Produktphasen zugeordnet. Die ersten Zeichen-, Abbruch-, Speicher- und Neustartfolgen werden ebenfalls bereits direkt im Original belegt. Vor dem Produktcode jeder weiteren Werkzeugfamilie werden ihre konkreten Wirkungsvarianten gemessen. Der [Wonderdraft-Vergleichsplan](WONDERDRAFT-PARITY.md) und `acceptance.json.wonderdraftParity` sind dafür verbindlich; Paketnamen und Dokumentation ersetzen keine Originalprobe.
- Fortschritt wird in `acceptance.json` getrennt als **Nutzbarkeit des Atlasablaufs** und **Wonderdraft-Parität** ausgewiesen. Fehlende Paritätsbelege werden nicht durch einen bestandenen Praxistest geschlossen.
- Datenverlust, falsche Speicherung, Abstürze, verlorene Entwürfe, falsche Verortung und ein unterbrochener Kernablauf werden vor der nächsten Erweiterung behoben. Weitere Options-, Gesten- oder Darstellungsabweichungen erhalten einen konkreten Unterfall und einen zuständigen Nachbesserungslauf; das funktionierende Ergebnis bleibt als noch nicht vollständig gleichwertiger Teststand verfügbar.
- Ein Nachbesserungslauf bearbeitet jeweils einen benannten Befund. Nach spätestens zwei erfolglosen Versuchen oder 45 Minuten an derselben Hypothese wird anhand der Belege eine andere Vorgehensweise gewählt. Die laufende Phase wächst dabei nicht um andere Werkzeugfamilien.
- Nach jeder Fachfreigabe folgt eine eigene Aufräumphase für die eingeführten Teile und deren technische/architektonische Schwächen. Auch sie erhält getrennte Plan-, Umsetzungs- und Reviewläufe sowie erforderliche Nachbesserung mit erneutem Review. Erst ihr bestandenes Tor öffnet die nächste Fachphase. Neue Funktionen und Änderungen am vereinbarten Ziel gehören in die nächste dafür zuständige Phase. Aktueller Lauf und nächster Schritt stehen in `checkpoint.hexAtlasExecution`.

### Fortschritt veröffentlichen und eingehende Änderungen integrieren

Die Nutzeranweisung autorisiert regelmäßige Pushes und lokale Integration für die beauftragten Arbeitspakete:

1. **Vor jedem Arbeitspaket:** Remote und tatsächlichen Upstream abrufen. Eingehende Änderungen vor neuer Umsetzung lokal integrieren; vorhandene lokale Änderungen vorher sichern und erhalten. Ein abweichender veröffentlichter Verlauf wird zusammengeführt, ohne ihn umzuschreiben. Konflikte werden anhand des aktuellen Plans und der betroffenen Anforderungen gelöst.
2. **Nach jedem abgeschlossenen Paket:** Plan, Umsetzung, Review, Nachbesserung und Aufräumen jeweils in einem zusammengehörigen Commit veröffentlichen. Bei längeren Phasen zusätzlich spätestens am täglichen Arbeitsabschluss einen prüfbaren Zwischenstand pushen. Die Veröffentlichung wartet nicht auf die vollständige Roadmap.
3. **Vor jedem Push:** Remote erneut prüfen und bei neuer Integration die betroffenen Prüfungen wiederholen. Dokumentation erhält JSON-/Kennungs-/Verweis-/Diffprüfungen; Produktcode die Basisprüfungen und passenden Benutzerabläufe. Ein Zwischenstand benennt offene Original-, Host-, Bedien- und Paritätsabnahmen.
4. **Nach dem Push:** Exakten Remote-Commit mit dem lokalen Commit vergleichen. Checkpoint und Abnahmeeinträge bleiben beim tatsächlichen Stand; umfangreiche Synchronisationsbelege liegen bei den QA-Daten außerhalb des Vaults.

Nur zum Paket gehörende Änderungen werden veröffentlicht. Fremde lokale Arbeit bleibt erhalten; Force-Push und stilles Verwerfen von Änderungen sind ausgeschlossen. Repository-Synchronisation und Installation im Obsidian-Vault werden weiterhin getrennt geprüft. Der Rhythmus gilt ebenso für CITY- und Wonderdraft-Vergleichspakete.

### HEX-00 – Ausgangsbasis und gemeinsame Testregion

**Ergebnis:** Ein gesicherter, reproduzierbar prüfbarer Startpunkt. Installierten Build und Repositorystand unterscheiden, den vorhandenen Dungeon-Kernablauf einmal prüfen und einen isolierten Testvault mit einer kleinen Dungeonkopie vorbereiten. Die gemeinsame Testregion beginnt leer und wächst über alle Phasen hinweg. Der [Wonderdraft-Vergleichsplan](WONDERDRAFT-PARITY.md) enthält den Ausgangskatalog mit festen WD-Kennungen und Phasenzuordnung. Er wird in drei getrennten Referenzläufen gegen Wonderdraft 1.1.8.2 vervollständigt:

| Referenzlauf | Konkretes Ergebnis | Tor vor HEX-01 |
|---|---|---|
| **HEX-00-A – Originaloberfläche mappen** | Sämtliche erreichbaren Werkzeuge, Optionen, Menüs, Dialoge und kontextbezogenen Gesten mit exaktem UI-Pfad, Default, direkten Belegen, WD-Unterfall und zuständiger Phase erfassen. Alle lokalen Pakethinweise als Funktion oder Helfer einordnen. | Keine erreichbare Funktion oder Option bleibt unzugeordnet. |
| **HEX-00-B – Original-Startfolge messen** | Kleine Originalkarte anlegen, bewegen/zoomen, Land/Farbe bearbeiten, abbrechen, Undo/Redo, Save/Open und vollständigen Prozessneustart belegen. Kontrollkarten und logische Entsprechung für erste Hostpaare festlegen. | Die Originalregeln für den ersten nutzbaren Ablauf sind belegt. |
| **HEX-00-C – Inventarreview** | In einem eigenen Lauf Originaloberfläche, Katalog, Startbelege und Phasenzuordnung auf Lücken prüfen. Ausnahmen und Hex-Anpassungen ausdrücklich begründen. | Erst der bestandene Inventarreview öffnet HEX-01; tiefe Varianten späterer Fachgruppen behalten konkrete offene Messfälle. |

Dieses Tor fordert früh ein vollständiges Mapping und direkt belegte Startfolgen. Die vollständige Paarabnahme sämtlicher späterer Varianten bleibt bei der jeweiligen Werkzeugphase, damit der nutzbare Hex-Editor nach HEX-02 und der zusammenhängende Atlasablauf nach HEX-05 früh verfügbar werden.

**Praxistest:** Dungeon öffnen → Raum-Key lesen und bearbeiten → Undo/Redo → speichern → frischer Obsidian-Start. Bestehende offene Dungeondraft-Abnahmen, insbesondere das Phase-5-Aufräumtor, bleiben in ihrer eigenen Roadmap erhalten. Ein konkreter Fehler in einer benötigten gemeinsamen Funktion wird vor deren Wiederverwendung behoben; die gesamte übrige Dungeondraft-Parität muss nicht vor dem ersten Hex-Editor fertig sein.

### Meilenstein A – Eine Hexkarte tatsächlich bearbeiten

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im echten Obsidian |
|---|---|---|
| **HEX-01 – Karte anlegen und öffnen** | `.overworld` anlegen, benennen und öffnen. 3-Meilen-Hexes anzeigen, ein Hex treffen und seine Adresse zeigen; verschieben, zoomen und auf die Karte einpassen. Weltgröße, Ausrichtung und Weltkoordinaten von Anfang an speichern. | Neue Karte öffnen, verschiedene Hexes anklicken, Kamera bewegen und nach frischem Start dieselbe Karte mit richtigen Adressen wieder öffnen. Ein bestehender Dungeon öffnet weiterhin. |
| **HEX-02 – Gelände malen und erhalten** | Land, Meer und einfacher Geländetyp per Klick und zusammenhängendem Pinselzug setzen; lokale Bearbeitung zurücksetzen; Undo/Redo, explizites Speichern und dauerhafte Entwürfe anbieten. Bearbeitete Hexes werden bereits als spärlich belegte, getrennt ladbare Bereiche gespeichert. | Kleine Insel zeichnen, einen Zug abbrechen, einen anderen mit einem Undo zurücknehmen und wiederholen. Speichern und Neuöffnung zeigen denselben Stand; ungespeicherte Arbeit lässt sich nach Prozessende wiederherstellen. |

**Nach HEX-02 steht der erste benutzbare Hex-Editor bereit.** Sein Testbuild enthält einen vollständigen Bearbeitungs- und Speicherablauf; weitere Kartengestaltung folgt auf dieser Grundlage.

### Meilenstein B – Hex → Ort → Dungeon → Raum-Key → zurück

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im echten Obsidian |
|---|---|---|
| **HEX-03 – Stadt und POI mit Key** | Stadt oder POI an einer Weltposition anlegen. `.location` mit stabiler Kennung und zwei frei bearbeitbaren Markdown-Abschnitten öffnen, Abschnitte ordnen und direkt verlinken. Anlage von Ort und Atlasplatzierung gemeinsam rücknehmen und mit einem wiederherstellbaren Speicherjournal für die beteiligten Dateien speichern. | Ort anklicken, Text rechts bearbeiten, Abschnittslink öffnen und Ort verschieben. Undo/Redo und frischer Start erhalten Wortlaut, Abschnittskennungen und Position. Abbruch und unterbrochene Anlage hinterlassen nach Wiederherstellung keinen verwaisten Ortsverweis. |
| **HEX-04 – Einen Dungeon verorten** | Bestehende `.dungeon`-Karte über ihre Kennung am Ort platzieren. Einen lokalen Eingangsanker wählen; Weltposition, Drehung, tatsächlichen Maßstab und Kartenumriss darstellen. | Bekannte Dungeonkontur platzieren und drehen. Lokaler Eingangsanker und Weltanker stimmen überein; Rücknahme und Neuöffnung erhalten die Bindung. Die Quelldatei des Dungeons bleibt unverändert. |
| **HEX-05 – Dungeon direkt im Atlas bearbeiten** | Beim Hineinzoomen verortete Dungeon-Geometrie im selben Atlas anzeigen, Raum und Key unmittelbar bearbeiten und durch Herauszoomen zur Region gelangen. Welt-/Lokalkoordinaten werden über die Platzierung umgerechnet. Zunächst werden eine Dungeonkarte und ihre Umgebung gemeinsam sichtbar und bearbeitbar. | Nur zoomen, Hex und Dungeonraum ändern, Key bearbeiten und herauszoomen. Keine Öffnen-/Betreten-/Modusaktion; Werkzeug, Auswahl, Lage, Maßstab und durchgehendes Undo/Redo bleiben korrekt. Speichern und frischer Start erhalten dieselbe Folge. |

**Nach HEX-05 ist der erste zusammenhängende Spielablauf benutzbar.** Der zugehörige Build wird mit der gemeinsamen Testregion bereitgestellt. Mehrere gleichzeitig sichtbare Detailkarten folgen in HEX-22; die erste räumliche Verbindung und Navigation sind bereits hier prüfbar.

### Frühe Stadtphasen im selben Atlas

Nach HEX-05 folgen **CITY-01 bis CITY-04**: Stadt zeichnen, einen nutzbaren Plan erzeugen, Haus-Dungeon samt Keys unmittelbar bearbeiten und anschließend lokal verfeinern, ohne eigene Änderungen zu verlieren. CITY-00 gehört zum frühen Referenzpaket von HEX-00. Die konkreten Ergebnisse und Tests stehen in der [Stadtplan-Roadmap](ROADMAP-CITIES.md).

Danach folgen CITY-05/06 nach HEX-14, CITY-07 nach HEX-20 und CITY-08 nach HEX-22. CITY-09 wird nach HEX-27 zusammen mit HEX-28 abgenommen. Die erste Stadt und der erste Hausgrundriss werden dadurch vor vollständiger Wonderdraft-Parität nutzbar geprüft.

### Meilenstein C – Weltmaßstab, eigene Vorlage und erste Ausgabe

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im echten Obsidian |
|---|---|---|
| **HEX-06 – Alle Hex-Stufen bearbeiten** | Standardstufen von 3 bis 2.187 Meilen und erforderliche größere Stufen anbieten. Manuelle Stufenwahl und automatischer Wechsel mit Übergangsbereich; grobe Vorgaben, feine Überschreibungen und Zurücksetzen verbinden. | Auf 27 Meilen Land setzen, auf 3 Meilen eine Küste verfeinern, grobe Vorgabe ändern und ein feines Detail zurücksetzen. Alle Stufen, Ortspositionen, Übersicht und Neuöffnung zeigen den jeweils richtigen Zustand. |
| **HEX-07 – Verbundene Änderungen sicher erhalten** | Externe Änderungen, unterbrochene Mehrdatei-Speicherung, Wiederherstellung und direkte Links nach Umbenennungen ausdrücklich absichern. Vorhandene Dungeonbearbeitung aus dem verknüpften Arbeitsablauf nutzen. | Orts-Key ändern und Platzierung verschieben; Speicherunterbrechung zwischen zwei Dateien und externe Änderung im Testvault auslösen. Ein lesbarer, konsistenter Stand wird wiederhergestellt oder ein Konflikt gemeldet. Orts- und Raumlinks funktionieren nach Umbenennung. |
| **HEX-08 – Große Welt zuerst grob öffnen** | Erdgroße Welt zunächst in grober Stufe öffnen; nur sichtbare Detailbereiche laden, Anfragen beim Weiterzoomen verwerfen und ungenutzte Ressourcen freigeben. Fortschreitend größere Datenmengen prüfen. | In einer 40.000 × 20.000 km großen Welt zwischen entfernten Orten wechseln. Grobe Übersicht erscheint vor Detaildaten; Rückkehr zeigt gespeicherte Bearbeitung. Speichern, Undo und der Ort-Dungeon-Ablauf bleiben bedienbar. |
| **HEX-09 – Ooke als Nachzeichenvorlage** | Zunächst ein exportiertes Ooke-Bild laden, anhand zweier Referenzpunkte maßstäblich ausrichten und die Deckkraft ändern. Danach dieselbe Funktion für die zweite Ooke-Karte nutzen. Vorlagen sind separate Referenzassets. | Bekannte Küste und Ort nachzeichnen, Stufen wechseln und neu öffnen. Vorlage und native Landschaft bleiben ausgerichtet; die Referenz lässt sich ausblenden. Originale Wonderdraft-Dateien bleiben erhalten. |
| **HEX-10 – Erstes teilbares Kartenbild** | PNG des gewählten Welt- oder Regionsausschnitts ausgeben, Raster ein- oder ausschalten und eine Ausgabe bis 2.048 Pixel Kantenlänge anbieten. Export nutzt den gespeicherten Kartenstand und den gewählten Ausschnitt. | Testregion mit Ortsnamen exportieren und das Bild visuell öffnen. Ausschnitt und Maßstab stimmen auch bei verschobener Editorkamera; Rasteroption wirkt. Dies belegt noch keine 8.192-Pixel-Ausgabe. |

**Nach HEX-10 lässt sich eine mehrstufige Welt mit eigenen Vorlagen bearbeiten, mit Keys und Dungeon verwenden und als erstes Kartenbild teilen.** Fehler- und Größenprüfungen begleiten diesen Stand bereits.

### Meilenstein D – Eine natürliche Landschaft zeichnen

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im echten Obsidian |
|---|---|---|
| **HEX-11 – Küsten innerhalb von Hexes** | Land und Wasser auch innerhalb eines Hexes mit einem freien Pinsel bearbeiten. Zusammenhängende Küsten und weiche Übergänge darstellen; Änderungen bleiben in den betroffenen Hex-Bereichen verankert. | Eine Bucht und schmale Landzunge über mehrere Hex- und Ladegrenzen zeichnen. Zoomen, Undo/Redo, Neuöffnung und PNG-Ausgabe erhalten Verlauf und Anschlüsse ohne Naht. |
| **HEX-12 – Seen und Wasser gestalten** | See beziehungsweise Süßwasserfläche anlegen und radieren; Wasserfarbe und die für diesen Ablauf gemessenen Erscheinungsoptionen bearbeiten. | See innerhalb einer Insel zeichnen, einen Teil entfernen und Erscheinung ändern. Rücknahme, Neuöffnung und Export erhalten die Fläche; das angrenzende Land und die Ortspositionen stimmen. |
| **HEX-13 – Einen Fluss durchgehend zeichnen** | Fluss anlegen, mit den Originalgesten beenden oder abbrechen, Punkte ändern und Breite wählen. Durchgehende Geometrie über Hexes und Stufen sichern. | Fluss vom Gebirge bis ins Meer ziehen, einen Punkt verschieben und Breite ändern. Abbruch erzeugt keinen halben Fluss; Übergänge, Undo und frische Öffnung stimmen. |
| **HEX-14 – Orte mit Straßen verbinden** | Straße beziehungsweise Pfad zwischen Orten zeichnen, Punkte und Kurven bearbeiten und Stil wählen. Zuständige Originalgesten und einfache Stilvarianten prüfen. | Stadt, POI und Dungeon durch Wege verbinden. Einen Verlauf ändern; Verbindungen, Orts-Keys, Flussquerung und Ausgabe bleiben nach Neuöffnung an der richtigen Stelle. |
| **HEX-15 – Landmassen erzeugen** | Die erste Original-Generatorfamilie mit ihren gemessenen Parametern und reproduzierbarem Ausgangswert anbieten; weitere katalogisierte Muster im begrenzten Generator-Nachbesserungslauf ergänzen. Erzeugung rücknehmbar in die Landschaftsvorgaben übernehmen. | Zwei reproduzierbare Ausgangswelten erzeugen und eine davon weiterbearbeiten. Eine erneute grobe Erzeugung erhält vorhandene feine Überschreibungen und Orte; Rücknahme und Neustart erhalten den richtigen Stand. |
| **HEX-16 – Heightmap und Geländehöhe** | Heightmap als eigenes Eingangsmaterial übernehmen und Landmassen anheben beziehungsweise absenken. Die Übernahme erzeugt native, anschließend bearbeitbare Landschaftsvorgaben. | Kleine bekannte Heightmap übernehmen, Inselhöhe verändern und einen Küstenabschnitt von Hand ändern. Speicherung, Rücknahme und Neuöffnung erhalten die native Bearbeitbarkeit und räumliche Ausrichtung. |

Nach jeder neuen Landschaftsfunktion wird derselbe Insel-Ort-Dungeon-Ablauf erneut durchgespielt. Stil- oder Shaderänderungen müssen dabei auch den zuvor erzeugten PNG-Ausschnitt bestehen.

### Meilenstein E – Die Karte lesbar ausarbeiten

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im echten Obsidian |
|---|---|---|
| **HEX-17 – Ein Symbol auswählen und setzen** | Ein Symbol aus einer kleinen Bibliothek auswählen, Vorschau zeigen, platzieren, auswählen, skalieren, drehen, spiegeln, duplizieren, anordnen und entfernen. Gemessene Grundgesten verwenden. | Berg, Baum und Siedlung setzen; überlappende Symbole bearbeiten. Jeweils Karte und Trefferreihenfolge prüfen; Undo/Redo und Neustart erhalten Position, Maßstab und Ordnung. |
| **HEX-18 – Wälder und Gebirge pinseln** | Gruppenpinsel mit Dichte, Streuung und Varianten für Bäume und Berge; Radieren und rücknehmbare zusammenhängende Pinselzüge. | Wald über mehrere Hexes malen, Teilbereich radieren und einen ganzen Zug rücknehmen. Eine gebirgige Region bleibt bei Stufenwechsel, Export und Neuöffnung vollständig und bedienbar. |
| **HEX-19 – Eigene Assets und Bibliothek** | Eigene Symbolsets aufnehmen; passende Farbmodi, Suche, Paketwahl, erneutes Laden und Fehlasset-Platzhalter ergänzen. Nur benötigte Vorschauen dekodieren. | Eigenes Set einsetzen, Farbe bearbeiten, neu laden und ein Asset im Testset fehlen lassen. Bestehende Instanz bleibt erhalten; Bibliothek, Ortsnavigation und Neustart funktionieren mit großem Katalog. |
| **HEX-20 – Namen und Beschriftungen** | Freie Beschriftung, Format- und Schriftvorgaben, Drehung, mehrzeilige Texte, Name-Vorschläge und Original-Labelgesten ergänzen. Ortsgebundene Namen übernehmen die zugehörige Ortskennung. | Stadt umbenennen, Fluss beschriften, mehrzeiligen Titel setzen und bei verschiedenen Zoomstufen lesen. Ortslink, Abschnittslink, Formatierung und Export bleiben nach Neuöffnung korrekt. |
| **HEX-21 – Gebiete und Grenzen** | Politische und geografische Gebiete anlegen, Grenze und Erscheinung bearbeiten und mit einem Orts-Key verknüpfen. Gebiete benutzen dieselben Weltkoordinaten wie Landschaft und Orte. | Zwei Gebiete über mehrere Hexes zeichnen, gemeinsame Grenze ändern und den Regions-Key öffnen. Grobe und feine Ansicht, Links, Undo und PNG zeigen denselben Grenzverlauf. |

### Meilenstein F – Mehrere Detailkarten im gemeinsamen Raum

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im echten Obsidian |
|---|---|---|
| **HEX-22 – Stadt und mehrere Dungeons im Atlas** | Mehrere Detailkarten abhängig von sichtbarer Größe mit Vorschau und vollständiger Geometrie darstellen. Stadt aus CITY-03, zwei Haus-/Orts-Dungeons und mehrere Eingänge räumlich verbinden; alle sichtbaren Geometrien im selben Editor direkt bearbeitbar halten. | Ausschließlich von Welt zu Stadt und zwei Hausgrundrissen hinein-/herauszoomen; Straßen, Räume und Keys ohne Kontextwechsel bearbeiten. Nach Save/Neustart stimmen Lage, Auswahl, durchgehende Historie und Eingangszielpunkte; außer Sicht liegende Ressourcen werden freigegeben. |

Diese Phase erweitert den seit HEX-05 funktionierenden Übergang. Ihr Review prüft zusätzlich mehrere benachbarte und überlappende Karten sowie den Erhalt der ersten Ein-Karten-Folge.

### Meilenstein G – Verbleibende Wonderdraft-Werkzeugfamilien vervollständigen

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im echten Obsidian |
|---|---|---|
| **HEX-23 – Landmassenausschnitt bearbeiten** | Lasso, Flächenauswahl, Ausschneiden, Kopieren, Einfügen, Verschieben und Größenänderung für Landschaft entsprechend den gemessenen Originalabläufen anbieten. Betroffene Landschaftsdaten ändern sich als zusammengehöriger Befehl. | Inselteil auswählen, kopieren, verschieben und rücknehmen. Land, Süßwasser und andere laut Original mitbewegte Bestandteile prüfen; bestehende Ortsbindungen, gespeicherte Vorgaben und Neuöffnung bleiben konsistent. |
| **HEX-24 – Gestaltungsvorlagen und Effekte** | Kartenweite Vorlagen, Texturen, Paletten und die katalogisierten Erscheinungseffekte ergänzen. Geometrie und Key-Inhalte bleiben eigenständige Daten. | Auf derselben Testregion mehrere Vorlagen und Effekte anwenden. Beschriftungen, Wasser und Symbole bleiben lesbar; Raum- und Orts-Keys unverändert. Editor und PNG zeigen dieselbe Gestaltung. |
| **HEX-25 – Rahmen, Kompass und Maße** | Rahmen, Kompassrose, Maßstabsleiste und Messwerkzeuge nach Originalabläufen ergänzen. Größen und Entfernungen aus dem gemeinsamen Weltmaßstab ableiten. | Bekannte Strecke zwischen Orten messen und eine Maßstabsleiste setzen. Welt-, Regions- und Dungeonmaßstab, Rahmen, Undo, Neuöffnung und Export stimmen. |
| **HEX-26 – Kartenverwaltung und Vorgaben** | Kartengrenzen und Größe ändern; relevante Vorgaben, Rasteroptionen, Tastenkürzel und Vorlagen-Zeichenreihenfolge vervollständigen. Verkleinerung entfernt außerhalb liegende bearbeitete Inhalte nicht stillschweigend. | Testkarte vergrößern und verkleinern, Vorgaben ändern und neu öffnen. Verortung und Links bleiben korrekt; Konflikte beziehungsweise außerhalb liegende Inhalte sind verständlich sichtbar und rücknehmbar. |
| **HEX-27 – Vollständige Bildausgabe** | PNG/JPEG, Ausschnitt, gewählte Detailstufe, Raster, Gestaltung und Ausgabegröße bis mindestens 8.192 × 8.192 Pixel vollständig anbieten. Große Bilder werden ohne vollständiges Laden aller Welt-Detaildaten ausgegeben. | Region und Welt in beiden Formaten ausgeben, darunter ein 8.192-Pixel-Bild. Bild öffnen und gezielte Details prüfen; laufende Bearbeitung, gespeicherter Stand und Ergebnis hängen nicht von der Editorkamera ab. |

Nach bestandenem HEX-00-Tor muss die vollständige Zuordnung der Originaloberfläche vorliegen. Jede zuständige Werkzeugphase ergänzt vor ihrem Produktcode die direkten Wirkungsbelege und danach die Hostpaare. Spätestens beim jeweiligen Meilenstein werden offene Befunde als begrenzte, benannte Nachbesserungsläufe eingeordnet. HEX-28 beginnt mit einem vollständig ausgeführten Unterfallkatalog; bislang unberührte Gruppen werden nicht erst dort entdeckt.

### HEX-28 – Endstand prüfen und gesichert installieren

**Ergebnis:** Die vollständige Wonderdraft-Parität und der zusammenhängende Atlasablauf bestehen auf demselben Endbuild. Der Abnahmekatalog enthält für jede Pflichtfunktion direkte Original- und Hostbelege beziehungsweise eine ausdrücklich vereinbarte Anpassung durch die Hex-Grundstruktur. Offene Pflichtfälle verhindern die Behauptung vollständiger Gleichwertigkeit und werden in ihren zuständigen Werkzeuggruppen nachgebessert.

**Praxistest:** Kleine Testregion und große Prüfwelt aus Abschnitt 4 im echten Obsidian bearbeiten, speichern, wiederherstellen und frisch öffnen. Physische Maus-/Touchpad-Eingaben, Detailkarten, Orts- und Raumlinks sowie Ausgabebilder prüfen. Nach Sicherung des aktuellen Produktstands installieren und den Kernablauf auf dem tatsächlich installierten Build wiederholen.

### Zuordnung der ursprünglichen zehn Etappen

| Ursprüngliche Etappe | Neue zuständige Phasen |
|---|---|
| 0 – Referenz und Ausgangsbasis | HEX-00-A/B/C vor HEX-01: vollständiges Original-Mapping, belegte Startfolge und Inventarreview; tiefe Wirkungsvarianten vor der jeweiligen Werkzeugphase |
| 1 – Raum- und Hex-Fundament | HEX-01/02/04/06/07/08; notwendige Anbindungen mit HEX-03/05 |
| 2 – Erster zusammenhängender Atlas | HEX-02 bis HEX-05 |
| 3 – Landmassen und Gewässer | HEX-11/12/15/16/23 |
| 4 – Flüsse, Straßen und Pfade | HEX-13/14 |
| 5 – Symbole und Assetbibliothek | HEX-17/18/19 |
| 6 – Kartengestaltung und Ortsarbeit | HEX-03/20/21/24/25 |
| 7 – Vollständiger Atlas-Zoom | HEX-04/05/06/22 |
| 8 – Vorlagen, Ausgabe und Verwaltung | HEX-09/10/26/27 |
| 9 – Gesamtabnahme und Installation | HEX-28; laufende Funktions- und Größenprüfungen bereits in den früheren Phasen |

## 4. Abnahme, Fehlerfälle und feste Vorgaben

### Häufige Prüfungen und ein gemeinsamer Alltagsablauf

1. **Während der Änderung:** Gezielte Kernprüfungen für tatsächlich gefährdete Regeln wie Koordinatenumrechnung, Vererbung, Undo und Mehrdatei-Wiederherstellung ausführen. Eine neue sichtbare Aktion früh im echten Obsidian bedienen.
2. **Am Ende jeder Phase:** `npm run check`, `npm test` und `npm run build` ausführen; den neuen Ablauf und die bisher verfügbare Folge auf der gemeinsamen Testregion prüfen. Änderung, Abbruch, Undo/Redo, Save und frische Öffnung gehören bei betroffenen persistenten Daten dazu. Der kurze unabhängige Review kontrolliert auch den Build der Nachweise.
3. **Nach je zwei Produktphasen:** Einen überprüften Testbuild mit dem isolierten Testvault zum Ausprobieren bereitstellen; die tatsächlich getesteten Funktionen und offenen Fälle im bestehenden Checkpoint festhalten. Zusätzliche Teststände folgen an Meilensteinen A, B und C, wenn sie nicht bereits mit diesem Rhythmus zusammenfallen. Der bisher installierte Produktstand bleibt bis zur gesicherten Installation verfügbar.
4. **Nach Änderungen an Kamera, Laden, Assets oder Renderer:** Eine größere Karte und mehrfaches Hin- und Zurückzoomen prüfen. Die Testgröße wächst von der kleinen Region über 10.000 zu 100.000 bearbeiteten Hexes. Zeit, Speicher und Ressourcenfreigabe werden ab HEX-08 tatsächlich gemessen.
5. **An jedem Meilenstein:** Den bisherigen Kernablauf zusammenhängend durchspielen und gespeicherte Texte, Links, Positionen und einen bisherigen Referenzausschnitt vergleichen. Physische Bedienung beginnt mit dem ersten nutzbaren Stand; fehlende Hardware-/Nutzerprüfungen bleiben offen und werden nicht aus synthetischen Eingaben abgeleitet.

Ab HEX-05 lautet die feste Folge: **Region anzeigen → Hex ändern → Orts-Key bearbeiten → in den Dungeon zoomen → Raum und Key bearbeiten → herauszoomen → rücknehmen/wiederholen → speichern → frischer Start → denselben Ort wiederfinden.** Ab CITY-03 wird zusätzlich in Stadt und Haus gezoomt und dort Straße, Gebäude und Hausgrundriss direkt bearbeitet. Keine dieser Aktionen verlangt einen Karten-, Kontext- oder Moduswechsel. Spätere Landschafts-, Symbol- und Exportfunktionen werden in diese Testregion eingebaut. Ein reiner Editor-Neustart oder eine Sammlung isolierter Dialogtests ersetzt diese Folge nicht.

Funktionsbeleg und Paritätsbeleg werden je Unterfall getrennt festgehalten; Nachweise nennen den geprüften Build und den tatsächlichen Stand. Die Roadmap enthält keine laufenden Ergebnisprotokolle. `checkpoint.json` hält nur aktuellen Stand, offenen Befund und nächsten Schritt; `acceptance.json` hält Anforderungen und Belege. Große Testkarten, Bildpaare und Laufdaten liegen außerhalb des Nutzervaults unter `/home/aaron/.cache/dungeon-native-qa/`. Es läuft jeweils eine grafische Testinstanz.

### Funktions- und Bedienabnahme

Der [Wonderdraft-Vergleichsplan](WONDERDRAFT-PARITY.md) übernimmt den Unterfall- und Paarablauf der Dungeondraft-Abnahme. Der verbindliche Katalog unter `acceptance.json.wonderdraftParity` hält für jeden Fall fest: exakter Originalpfad und Ablauf, Optionen, Vorschau, Abschluss oder Abbruch, Undo/Redo, gespeicherter Zustand, frische Neuöffnung, Hostbuild, Review und verbleibende Abweichungen. Insbesondere werden Werkzeugvorgaben und vorhandene Instanzen, Auswahl-/Zeichenreihenfolge, Escape-Kontexte und globale beziehungsweise kartenlokale Werte getrennt geprüft. Die offiziellen [Tastatur- und Gestenabläufe](https://github.com/Megasploot/Wonderdraft/wiki/Shortcuts) dienen als Einstieg; maßgeblich bleibt das Verhalten der lokalen Version. Fehlende Originalbelege bleiben offen.

Die jeweiligen Werkzeuge behalten ihre belegten Gesten; sie wirken in der gemeinsamen Atlasansicht auf die zugehörige Geometrie. Es werden dafür keine Overworld-, Stadt- oder Dungeonmodi eingeführt. Stadtvorbilder werden hinsichtlich ihres Ergebnisses verglichen; ihre Bedienung unterliegt den eigenen Aufgabenprüfungen aus CITY-00 bis CITY-09. Texteingabe im Key-Editor darf keine Kartenaktionen auslösen.

### Zusammenhängende Prüfszenarien

- Eine grobe Insel gestalten, bis zum 3-Meilen-Hex hineinzoomen und einen Küstenbereich verfeinern. Anschließend die grobe Vorgabe ändern und den Erhalt der feinen Bearbeitung prüfen.
- Fluss und Straße über Hex-, Stufen- und Ladegrenzen bearbeiten; sämtliche Anschlüsse nach Neuöffnung kontrollieren.
- Stadt mit Orts-Key, POI und Dungeon anlegen. Verschiebung, Drehung und mehrere Eingänge einschließlich Rücknahme prüfen.
- Oberste Hex-Stufe → Region → Stadt → Haus → Raum ausschließlich zoomen; auf jeder Detailstufe direkt bearbeiten. Werkzeugleiste, Werkzeug, Auswahl und durchgehende Undo-Folge dürfen nicht durch einen Modus-/Kontextwechsel ersetzt werden.
- Direktlinks zu Orts-, Raum- und Key-Abschnitten nach Dateiumbenennung und Neustart öffnen.
- Externe Dateiänderung und unterbrochenes Speichern provozieren. Konflikte müssen sichtbar bleiben und Entwürfe wiederherstellbar sein.
- Bildvorlage, Editoransicht und Export auf denselben Ausschnitt ausrichten und ihre räumliche Übereinstimmung kontrollieren.

### Größen- und Leistungsabnahme

Die große Prüfwelt umfasst **40.000 × 20.000 Kilometer**, 100.000 ausdrücklich bearbeitete kleine Hexes, 5.000 Orte und 50 verknüpfte Detailkarten; mindestens ein Dungeon enthält über 4.000 Entitäten.

Geprüft werden Ladezeit, Reaktionszeit, Kamerabewegung, Speicherbedarf und Freigabe ungenutzter Ressourcen. Als Ziel gelten auf dem vorhandenen Laptop nach dem Laden höchstens 33 ms pro Navigationsbild im 95. Perzentil und höchstens 100 ms bis zur Werkzeugvorschau. Die Übersicht muss nutzbar werden, bevor alle Detaildaten geladen sind.

Kernprüfungen, Build, Obsidian-Bedienung, Großkartenlauf und physische Maus-/Touchpad-Abnahme werden getrennt dokumentiert.

### Gewählte Defaults

- Die Welt ist zunächst ein **ebener Atlas**; Weltkarten benötigen keine Kugelprojektion.
- Hex-Ausrichtung ist beim Anlegen wählbar und bleibt danach fest.
- Automatischer Stufenwechsel besitzt einen Übergangsbereich gegen Hin-und-her-Springen; eine manuelle Stufenwahl bleibt möglich.
- Unterhalb der 3-Meilen-Stufe entstehen keine weiteren Overworld-Hex-Stufen. Stadt- und Dungeonraster übernehmen die Detailbearbeitung.
- Orts-Keys bleiben in `.location`, Raum-Keys in `.dungeon`. Der Atlas verweist auf diese Inhalte.
- Stadtgeometrie wird in `.city` geführt. Gebäude und verankerte Haus-Dungeons erhalten stabile räumliche Bindungen; Generation schützt manuelle Änderungen und Keys.
- Der Atlas bleibt ein durchgehend bearbeitbarer Raum ohne separate Modi. Zoom allein erschließt räumliche Größenstufen; Detaildarstellung ist kein Wechsel des Editors.
- Bestehende Wonderdraft-Karten werden als Bildvorlagen verwendet; ihre Originaldateien bleiben erhalten.
- Bestehende Dungeonkarten werden durch ihre Atlasplatzierung nicht umgerechnet oder neu gezeichnet.
