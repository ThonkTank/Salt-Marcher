# Stadtpläne im durchgehend bearbeitbaren Atlas

Diese Erweiterung gehört zur [Hex-Atlas-Roadmap](ROADMAP-HEX-ATLAS.md). **Ein Atlas, eine Kamera, dieselben Werkzeuge und eine durchgehende Bearbeitung. Es gibt keine separaten Welt-, Stadt- oder Dungeonmodi.** Von der obersten Hex-Stufe bis zum Raum eines Hauses sind alle räumlichen Detailstufen allein durch Zoom erreichbar. Auch Bearbeitung und Key-Arbeit bleiben im selben Editor.

Der gemeinsame Atlas ist grenzenlos und wächst mit seinen Inhalten. Stadtanlage, Straßen und Haus-Dungeons erweitern bei Bedarf seine belegte Ausdehnung, ohne Kartenrand-, Resize- oder Betretenaktion. Siedlungsflächen besitzen reale Maße; Meilen und Hex-Kacheln beschreiben den gewählten Bereich, Pixel nur die Darstellung beziehungsweise Bildausgabe. Orts-, Stadt- und Dungeondokumente teilen denselben räumlichen Atlas und dieselbe Bearbeitung.

Alle folgenden Phasen sind geplant. Der Abnahmekatalog liegt unter `acceptance.json.cityPlans`; die geplanten Daten- und Raumentscheidungen stehen in der [Architektur](ARCHITECTURE.md#stadtpläne-und-durchgehende-atlas-bearbeitung).

## Ergebnisvorbilder und Vergleich

[Watabous Medieval Fantasy City Generator](https://watabou.itch.io/medieval-fantasy-city-generator) liefert das Vorbild für einen rasch verfügbaren, lesbaren mittelalterlichen Stadtgrundriss. Der Entwickler beschreibt die erzeugte Karte als gestalterisches Ergebnis; eine historische Stadtsimulation ist dafür nicht erforderlich. Die Devlogs zeigen zusätzlich Ergebnisbereiche für [Dächer und Viertel](https://watabou.itch.io/medieval-fantasy-city-generator/devlog/711706/0110-roof-details-and-district-view), [Gassen](https://watabou.itch.io/medieval-fantasy-city-generator/devlog/698858/0102-alleys-view) und [umgebende Wälder](https://watabou.itch.io/medieval-fantasy-city-generator/devlog/817711/0114-forests).

[Canvas of Kings](https://store.steampowered.com/app/2498570/Canvas_of_Kings/) liefert das Vorbild für eine ausgearbeitete Draufsicht mit variierten Gebäuden, Objekten, Mauern, Türmen und Vegetation. Die offizielle Beschreibung nennt die automatische Platzierung entlang veränderbarer Pfade und Flächen. Eine vollständig prozedural erzeugte Gesamtkarte wird dort ausdrücklich nicht angeboten. Unser Ziel kombiniert die Stadtgrundrisse des ersten Vorbilds mit der ausgearbeiteten Darstellung des zweiten.

**Auftragserweiterung vom 09.10.2026:** Die Stadtfunktionen sollen vollständig gleichwertig mit Canvas of Kings, Watabou und [Fantasy Town Generator](https://docs.fantasytowngenerator.com/) sein, bei besserer Bedienung. Dazu gehören auch Bewohner, Beziehungen, Fraktionen, Tagesabläufe und die jeweiligen Ausgabe-/Bearbeitungsfähigkeiten. Der [technische Plan](ROADMAP-CITIES-IMPLEMENTATION-PLAN.md) und `acceptance.json.cityPlans.functionalInventory` ergänzen die bestehenden CTY-Fälle. Die vollständige Originalinventur bleibt offen.

**Funktionen und Ergebnisse sind maßgeblich.** Originalgesten, Menüs oder Arbeitsmodi der drei Werkzeuge sind keine Vorgabe. Eigene Bedienung wird anhand wirklicher Aufgaben auf Verständlichkeit, Aktionszahl und Reaktionszeit geprüft. Wonderdrafts bereits vereinbarter Funktions-/Gestenvergleich bleibt für die entsprechenden übernommenen Werkzeuge bestehen.

CITY-00 sammelt vor Stadtproduktcode wenige feste Ergebnisbilder: Dorf, ummauerte Stadt und Hafenstadt sowie eine ausgearbeitete Stadtdetailfläche. Datum beziehungsweise beobachtete Version und Bildausschnitt werden festgehalten. Die feste Galerie ist in `ROADMAP-CITIES-REFERENCE-GALLERY.md` dokumentiert: eigene Watabou-/FTG-Originalbilder und ausdrücklich veröffentlichte COK-Ergebnisbilder. Datum und Ausschnitte sind festgehalten; Galerie-Laufversionen bleiben unbekannt. Die eigene COK-Demo ist separat als0.4.06 belegt. Vollständige Funktionsinventur und Produktparität bleiben offen. Das ältere öffentliche Watabou-Quellarchiv nennt selbst fehlende neuere Funktionen und ersetzt keine aktuelle Ergebnisprobe. [Originalarchiv](https://github.com/watabou/TownGeneratorOS).

## Einfacher Benutzerablauf

1. Im Atlas das Siedlungswerkzeug wählen und eine Fläche aufziehen. Eine sinnvolle Vorgabe erzeugt sofort einen bearbeitbaren Plan; Größe, Siedlungstyp und Dichte sind wenige sichtbare Optionen im bestehenden Panel.
2. Eine Straße ziehen oder einen Punkt verschieben. Angrenzende Bebauung passt sich nur innerhalb noch generierbarer Bereiche an; bereits bearbeitete oder verknüpfte Häuser bleiben erhalten.
3. Ein Haus oder Viertel anklicken, ändern und bei Bedarf beschreiben. Seine Ortsinformationen erscheinen im bestehenden Key-Panel. Für unbeschriebene Häuser müssen keine Ortsdateien einzeln angelegt werden.
4. Zum Haus hineinzoomen. Der verankerte Grundriss wird an derselben Position sichtbar; Wände, Räume und Keys lassen sich unmittelbar bearbeiten. Herauszoomen zeigt wieder Straße, Stadt und Region.

Dieser Ablauf benötigt keine Karte-öffnen-, Betreten-, Aktivieren- oder Modusaktion. Das Werkzeug bleibt bei Zoom erhalten; die Werkzeugleiste wird nicht durch eine andere Editoroberfläche ersetzt. Eine direkte Auswahl darf passende Eigenschaften zeigen. Die Auswahl bestimmt den Gegenstand der Änderung, nicht einen neuen Arbeitsmodus. Texteingabe erhält ihren Fokus und löst keine Kartenkürzel aus.

Bei sehr weitem Zoom erscheinen Stadtstruktur und wichtige Orte; beim Näherkommen Gebäude und Dekoration, danach verankerte Innenräume. Das sind sichtbare Details desselben räumlichen Datenstands. Kontrollpunkte, Orientierung und Metermaßstab dürfen beim Übergang nicht springen. Dachdarstellung und Innenraum müssen eine ausgewählte oder bearbeitete Geometrie sichtbar halten.

## Kleine Phasen und frühe Benutzbarkeit

CITY-00 wird im Referenzpaket von HEX-00 eingeordnet. **CITY-01 bis CITY-04 folgen nach HEX-05**, bevor die Hex-Roadmap mit HEX-06 weitergeht. Dadurch werden Stadt, Generierung und direkt bearbeitbarer Hausgrundriss früh geprüft. Die relative Reihenfolge der HEX-Phasen bleibt erhalten.

Danach folgen CITY-05/06 nach HEX-14, CITY-07 nach HEX-20 und CITY-08 nach HEX-22. CITY-09 und HEX-28 bilden die gemeinsame Endabnahme nach HEX-27. Es läuft jeweils ein Arbeitslauf und eine grafische Testinstanz; diese Zuordnung verlangt keine parallele Entwicklung. Die Voraussetzungen stehen zusätzlich im Katalog.

| Phase | Nutzbarer Umfang | Praxisprüfung |
|---|---|---|
| **CITY-00 – Ergebnisvorbilder festlegen** | Kleine Referenzgalerie und Ergebnis-/Bedienkriterien festlegen. | Übersicht und Detail aller drei Vorbilder prüfen; keine Originalgeste als Pflicht übernehmen. |
| **CITY-01 – Stadt im Atlas zeichnen** | Native .city direkt am Ort anlegen; Straße, Platz und zwei Häuser im selben Editor bearbeiten. | Nur hinein-/herauszoomen; Haus verschieben, Straße ändern, Undo/Redo, speichern und frisch öffnen. |
| **CITY-02 – Nutzbare Stadt erzeugen** | Siedlungsfläche aufziehen und direkt einen editierbaren Grundplan mit Straßen, Platz und Gebäuden erzeugen; wenige sichtbare Vorgaben. | Dorf und kleine Stadt erzeugen, sofort ein Gebäude und eine Straße ändern; Abbruch, Undo, Wiederöffnung. |
| **CITY-03 – Hausgrundriss und Keys direkt bearbeiten** | Gebäude mit Orts-Key und vorhandener Dungeonkarte verbinden; Stadt und Innenräume in einem durchgehenden Editor bearbeiten. | Region → Stadt → Haus → Raum nur zoomen; Straßen-, Haus-, Raum- und Key-Änderung mit gemeinsamer Undo-Folge und frischer Öffnung. |
| **CITY-04 – Verfeinern ohne Arbeit zu verlieren** | Ausgewählten Bereich neu erzeugen; bearbeitete und verlinkte Gebäude, Grenzen und Straßen schützen. | Ein Viertel erneuern; benannter POI, Haus-Dungeon und manuelle Straße bleiben wertgleich; Undo stellt Gesamtstand wieder her. |
| **CITY-05 – Straßen und Stadtbefestigung** | Hauptstraßen/Gassen, Kreuzungen, Brücken, Tore, Mauern und Türme zusammenhängend ausarbeiten. | Regionalstraße → Tor → Platz; Flussquerung; Tor oder Straßenpunkt ziehen, ohne verbundene Wege und geschützte Bauten zu verlieren. |
| **CITY-06 – Viertel und besondere Gebäude** | Viertel mit Dichte/Nutzung, Markt, Hafen, Burg, Tempel, Gärten und POIs anlegen und verknüpfen. | Hafenstadt und ummauerte Stadt ausarbeiten; Viertel ändern, Orts-Key öffnen und benanntes Haus wiederfinden. |
| **CITY-07 – Lesbare Übersicht und ausgearbeitete Details** | Klare Stadtübersicht und dekorierte Draufsicht desselben Datenstands; Dächer, Vegetation, Props, Farben, Labels und Gestaltungsvorgaben. | Gleiche Stadt in Übersicht und Detail vergleichen; Maßstab, Straßen und POIs bleiben deckungsgleich, Gebäude lassen sich weiterhin direkt bearbeiten. |
| **CITY-08 – Ausgabe, große Städte und flüssige Bedienung** | Stadtausschnitte ausgeben, Großstadt/mehrere Städte messen, Detaildaten nach Bedarf laden; einfache Bedienung mit echten Aufgaben prüfen. | PNG gegen aktuellen Ausschnitt prüfen; 5.000 Gebäude und mehrere Haus-Dungeons bearbeiten; Navigation, Vorschau, Ressourcenfreigabe und physische Eingabe messen. |
| **CITY-09 – Gemeinsame Endabnahme** | Ergebnisziele beider Vorbilder und vollständigen Atlasablauf auf demselben Endbuild abnehmen; Abschluss zusammen mit HEX-28. | Welt → Region → Stadt → Haus → Raum, über alle Größen nur zoomen und direkt bearbeiten; Konflikte, Undo, Neustart, Export und Installation getrennt prüfen. |

**Nach CITY-01:** Eine kleine Stadt lässt sich unmittelbar im Atlas zeichnen und speichern. **Nach CITY-02:** Ein erzeugter Plan lässt sich sofort weiterbearbeiten. **Nach CITY-03:** Hex, Straße, Haus, Dungeonraum und Keys sind in einer Sitzung ohne Kontextwechsel bearbeitbar.

CITY-05 ergänzt die zusammenhängenden Stadtstraßen auf der bereits geprüften Linienbasis; CITY-07 nutzt die gemeinsame Asset-/Beschriftungsbasis. Erste Phasen benötigen keine vollständige Dekorationsbibliothek. Aufräumen und zusätzliche Stiloptionen dürfen den geprüften Kernweg nicht verdrängen.

## Ergebnis- und Funktionskriterien

| Ziel | Konkret zu prüfen |
|---|---|
| Stadtstruktur | Erkennbare Hauptstraßen und Gassen, Plätze, Viertel und Bebauung; unterschiedliche Dichte und passende Straßenanschlüsse. |
| Umgebung | Stadtlage an Fluss/Küste und regionalen Wegen; Brücken, Hafen, Tore und Befestigungen passen räumlich zusammen. |
| Besondere Orte | Markt, Burg, Tempel, Gärten und andere POIs können gezielt angelegt, beschrieben und stabil verlinkt werden. |
| Ausarbeitung | Variierte Hausformen und Dächer, Vegetation und Dekoration ergeben eine stimmige, lesbare Draufsicht. |
| Eigene Eingriffe | Generatorbereiche können lokal erneuert werden; manuelle Änderungen, verankerte Haus-Dungeons und Keys bleiben erhalten. |
| Durchgehende Bearbeitung | Dasselbe Werkzeug-/Kameralayout, stabile Auswahl, gemeinsames Undo/Redo und sofortige Aktionen an sichtbarer Geometrie. |
| Räumliche Übereinstimmung | Stadtumriss, Gebäude, Eingang und Innenraum sind metrisch deckungsgleich; Stadt-/Hausbewegung erhält die zugehörigen Bindungen. |
| Haltbare Daten | Speichern, Neuöffnung, externe Änderungen und unterbrochenes Mehrdatei-Speichern erhalten Geometrie, Texte und Kennungen. |
| Ausgabe | Übersicht, Detail und PNG/JPEG verwenden denselben Datenstand; Ausschnitt und Auflösung sind von der Editorkamera unabhängig. |

Die Ergebnisbilder werden bei vergleichbarer Größe und Detailtiefe beurteilt. Straßennetz, Dichte, Formen, Lesbarkeit und Gestaltung zählen; Pixelgleichheit ist kein Ziel. Bedienqualität ist eine eigene Abnahme: Erzeugen, Straße umlenken, POI beschreiben, Hausgrundriss bearbeiten. Beobachtete Aktionszahl, Zeit, Fehlversuche und nötige Hilfestellung dokumentieren. Eine bessere Bedienung wird erst nach diesen Aufgaben behauptet.

## Häufige Tests am gesamten Atlasweg

Je Phase den neuen Ablauf früh in Obsidian bedienen, passende Kernprüfungen ausführen und den bisherigen Atlasweg auf derselben Testregion wiederholen. Fachreview und begrenzte Nachbesserung folgen getrennt; nach je zwei Produktphasen sowie den frühen Stadtmeilensteinen steht ein geprüfter Testbuild bereit.

Ab CITY-03 ist die feste Folge: **Region anzeigen → Hex ändern → in Stadt zoomen → Straße ändern → Haus ändern → weiter in Hausgrundriss zoomen → Raum ändern → Orts-/Raum-Key bearbeiten → herauszoomen → Änderungen rücknehmen/wiederholen → speichern → vollständig neuer Prozess → dieselben Stellen wiederfinden.**

Zusätzliche Pflichtproben:

- Auswahl, Werkzeug, Kamera und Undo-Folge bleiben über Zoomgrenzen erhalten. Keine Schaltfläche oder Auswahl einer „aktiven Karte“ ist für Navigation oder Bearbeitung erforderlich.
- Ein begonnener Zeichenzug behält sein Ziel, wenn der Cursor eine Detailgrenze überschreitet. Neu sichtbar werdende Geometrie übernimmt den Zug nicht unbemerkt.
- Stadt und Gebäude verschieben/drehen; Weltanker und Haus-Dungeon folgen korrekt. Dungeonfelder bleiben fünf Fuß; originale Raumdaten werden durch die Platzierung nicht verzerrt.
- Ein Viertel neu erzeugen und abbrechen; beschriebene oder manuell bearbeitete Häuser, lokale Straßen und Verknüpfungen erhalten. Neue Kennungen nur für tatsächlich neue Elemente vergeben.
- Stadt mit 5.000 Gebäuden und mehreren Haus-Dungeons prüfen. Die bestehenden Atlas-Ziele von höchstens 33 ms pro Navigationsbild im 95. Perzentil und 100 ms bis zur Werkzeugvorschau nach dem Laden werden gemessen; sie sind noch nicht verifiziert.
- Physische Maus-/Touchpad-Bedienung, Großkartenlauf, Ergebnisvergleich, Ausgabe und tatsächlich installierten Endstand getrennt belegen.

Nachweise stehen bei stabilen CTY-Unterfällen in `acceptance.json`, aktueller Stand und nächster Schritt in `checkpoint.json`. Große Ergebnisbilder und Kontrollkarten liegen unter `/home/aaron/.cache/dungeon-native-qa/city-plans/`. Dieser Plan enthält keine fortlaufenden Laufprotokolle.
