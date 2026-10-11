# Stadtpläne im durchgehend bearbeitbaren Atlas

Diese Erweiterung gehört zur [Hex-Atlas-Roadmap](ROADMAP-HEX-ATLAS.md). **Ein Atlas, eine Kamera, dieselben Werkzeuge und eine durchgehende Bearbeitung. Es gibt keine separaten Welt-, Stadt- oder Dungeonmodi.** Von der obersten Hex-Stufe bis zum Raum eines Hauses sind alle räumlichen Detailstufen allein durch Zoom erreichbar. Auch Bearbeitung und Key-Arbeit bleiben im selben Editor.

Der gemeinsame Atlas ist grenzenlos und wächst mit seinen Inhalten. Stadtanlage, Straßen und Gebäude mit Innenräumen erweitern bei Bedarf seine belegte Ausdehnung, ohne Kartenrand-, Resize- oder Betretenaktion. Siedlungsflächen besitzen reale Maße; Meilen und Hex-Kacheln beschreiben den gewählten Bereich, Pixel nur die Darstellung beziehungsweise Bildausgabe. Orts-, Stadt- und Dungeondokumente teilen denselben räumlichen Atlas und dieselbe Bearbeitung.

Die folgenden Phasen beschreiben den vollständigen Zielumfang. Vorhandene Stadtgeometrie ist bereits teilweise im gemeinsamen Atlas bearbeitbar; die assistierte Bebauung liegt als Kandidat vor. Den datierten integrierten Stand, Kandidaten und offenen Rest führt zentral [Atlas auf einen Blick](ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick). Der Abnahmekatalog liegt unter `acceptance.json.cityPlans`; die Daten- und Raumentscheidungen stehen in der [Architektur](ARCHITECTURE.md#stadtpläne-und-durchgehende-atlas-bearbeitung).

## Ergebnisvorbilder und Vergleich

[Watabous Medieval Fantasy City Generator](https://watabou.itch.io/medieval-fantasy-city-generator) liefert das Vorbild für einen rasch verfügbaren, lesbaren mittelalterlichen Stadtgrundriss. Der Entwickler beschreibt die erzeugte Karte als gestalterisches Ergebnis; eine historische Stadtsimulation ist dafür nicht erforderlich. Die Devlogs zeigen zusätzlich Ergebnisbereiche für [Dächer und Viertel](https://watabou.itch.io/medieval-fantasy-city-generator/devlog/711706/0110-roof-details-and-district-view), [Gassen](https://watabou.itch.io/medieval-fantasy-city-generator/devlog/698858/0102-alleys-view) und [umgebende Wälder](https://watabou.itch.io/medieval-fantasy-city-generator/devlog/817711/0114-forests).

[Canvas of Kings](https://store.steampowered.com/app/2498570/Canvas_of_Kings/) liefert das Vorbild für eine ausgearbeitete Draufsicht mit variierten Gebäuden, Objekten, Mauern, Türmen und Vegetation. Die offizielle Beschreibung nennt die automatische Platzierung entlang veränderbarer Pfade und Flächen. Eine vollständig prozedural erzeugte Gesamtkarte wird dort ausdrücklich nicht angeboten. Unser Ziel kombiniert die Stadtgrundrisse des ersten Vorbilds mit der ausgearbeiteten Darstellung des zweiten.

**Auftragserweiterung vom 09.10.2026:** Die Stadtfunktionen sollen vollständig gleichwertig mit Canvas of Kings, Watabou und [Fantasy Town Generator](https://docs.fantasytowngenerator.com/) sein, bei besserer Bedienung. Dazu gehören auch Bewohner, Beziehungen, Fraktionen, Tagesabläufe und die jeweiligen Ausgabe-/Bearbeitungsfähigkeiten. Der [technische Plan](ROADMAP-CITIES-IMPLEMENTATION-PLAN.md) und `acceptance.json.cityPlans.functionalInventory` ergänzen die bestehenden CTY-Fälle. Die vollständige Originalinventur bleibt offen.

Für alle fünf Vorbilder gelten die gemeinsamen [Ergebnisgleichwertigkeit und Lieferprioritäten](ROADMAP-HEX-ATLAS.md#wie-kommen-wir-zum-ziel). Die eigene Stadtbedienung wird anhand wirklicher Aufgaben auf Verständlichkeit, Aktionszahl und Reaktionszeit geprüft. Identische Originalgesten sind auch bei wiederverwendeten Wonderdraft-/Dungeonwerkzeugen keine Pflicht.

CITY-00 sammelt vor Stadtproduktcode wenige feste Ergebnisbilder: Dorf, ummauerte Stadt und Hafenstadt sowie eine ausgearbeitete Stadtdetailfläche. Datum beziehungsweise beobachtete Version und Bildausschnitt werden festgehalten. Die feste Galerie ist in `ROADMAP-CITIES-REFERENCE-GALLERY.md` dokumentiert: eigene Watabou-/FTG-Originalbilder und ausdrücklich veröffentlichte COK-Ergebnisbilder. Datum und Ausschnitte sind festgehalten; Galerie-Laufversionen bleiben unbekannt. Die eigene COK-Demo ist separat als0.4.06 belegt. Vollständige Funktionsinventur und Produktparität bleiben offen. Das ältere öffentliche Watabou-Quellarchiv nennt selbst fehlende neuere Funktionen und ersetzt keine aktuelle Ergebnisprobe. [Originalarchiv](https://github.com/watabou/TownGeneratorOS).

## Einfacher Benutzerablauf

1. Im Atlas eine Siedlungsfläche aufziehen, Straßen und Plätze vorgeben und die verbleibenden Flächen bebauen lassen. Größe, Siedlungstyp und Dichte sind wenige sichtbare Optionen im bestehenden Panel. Eine Vorschau zeigt den Plan; Übernehmen macht ihn direkt bearbeitbar, Abbrechen verwirft ihn vollständig.
2. Eine Straße ziehen oder einen Punkt verschieben. Angrenzende Bebauung in noch generierbaren Bereichen gezielt in einer Vorschau erneuern; bereits bearbeitete oder verknüpfte Häuser bleiben erhalten.
3. Ein Haus oder Viertel anklicken, ändern und bei Bedarf beschreiben. Seine Ortsinformationen erscheinen im bestehenden Key-Panel. Für unbeschriebene Häuser müssen keine Ortsdateien einzeln angelegt werden.
4. Ein Haus ausdrücklich mit einer leeren Innenraumhülle ausarbeiten und hineinzoomen. Außenform und Innenräume sind Teile desselben Gebäudes; Wände, Räume und Keys lassen sich unmittelbar bearbeiten. Bei einem bereits ausgearbeiteten Gebäude genügt Zoom zur Navigation. Herauszoomen zeigt wieder Straße, Stadt und Region.

Dieser Ablauf benötigt keine Karte-öffnen-, Betreten-, Aktivieren- oder Modusaktion. Das Werkzeug bleibt bei Zoom erhalten; die Werkzeugleiste wird nicht durch eine andere Editoroberfläche ersetzt. Eine direkte Auswahl darf passende Eigenschaften zeigen. Die Auswahl bestimmt den Gegenstand der Änderung, nicht einen neuen Arbeitsmodus. Texteingabe erhält ihren Fokus und löst keine Kartenkürzel aus.

Bei sehr weitem Zoom erscheinen Stadtstruktur und wichtige Orte; beim Näherkommen Gebäude und Dekoration, danach verankerte Innenräume. Das sind sichtbare Details desselben räumlichen Datenstands. Kontrollpunkte, Orientierung und Metermaßstab dürfen beim Übergang nicht springen. Dachdarstellung und Innenraum müssen eine ausgewählte oder bearbeitete Geometrie sichtbar halten.

## Gebäude und Innenräume als ein Objekt

**Nutzerpräzisierung vom 11.10.2026; Zielverhalten, noch keine vollständige Implementierung.** Der vollständige [Vorbereitungs- und Spielablauf](ROADMAP-HEX-ATLAS.md#konkrete-nutzerabläufe) verwendet die Taverne „Zum Silbernen Ast“ als Beispiel. Gebäudehülle, Außen-/Innenwände, Räume, Geschosse und Dach werden gemeinsam bearbeitet. Außenansicht und Innenansicht sind verschiedene Detailtiefen desselben Objekts. Ein unabhängig veränderter Hausumriss mit nachträglich einzupassender Dungeonkarte ist nicht das Ziel.

Der [Werkzeugkatalog](ROADMAP-HEX-ATLAS.md#werkzeuge-und-bediengefühl) definiert die gemeinsame Bedienung: benannte Fachwerkzeuge, Landschaftspinsel, Klickpunkte/Rechteckziehen für präzise Geometrie, sichtbare Vorschauen und direkte Korrekturgriffe. Bebauung erzeugen und Innenräume anlegen sind ausdrückliche Aktionen am ausgewählten Objekt; Key-Arbeit bleibt im gemeinsamen Panel.

| Meine Änderung | Wirkung am gemeinsamen Gebäude |
| --- | --- |
| Innenräume anlegen | Ausdrückliche Aktion erzeugt eine leere Hülle; anschließend zeichne ich Trennwände, Räume und Türen. Zoom allein erzeugt keine Daten. |
| Eine Wand verschieben | Gebäudeform und angrenzende Raumgrenzen ändern sich im ausdrücklich gewählten Wandumfang konsistent in einem Befehl. |
| „Gebäude skalieren“ wählen | Grundrisse aller Geschosse samt Außenform und Innengeometrie werden horizontal proportional skaliert; Höhen und Geschossabstände bleiben erhalten. |
| Gebäude verschieben oder drehen | Alle Gebäudeteile folgen; physische Maße und lokale Raumform bleiben erhalten. |
| Geschoss oder Schnitt wählen | Ich bearbeite dieselbe Gebäudegeometrie in der gewählten Höhe; das Dach verdeckt meine Auswahl nicht. Ein Keller darf über den oberirdischen Umriss hinausreichen. |
| Einen ungültigen Vorschlag machen | Die Vorschau zeigt den Fehler. Ich korrigiere oder verwerfe sie; der bestätigte Stand bleibt erhalten. |

Kennungen, Texte, Abschnitts-/Raumlinks und Referenzen bleiben bei diesen Änderungen erhalten. Raumteilung/-vereinigung bewahrt Autoreninhalte und zeigt uneindeutige Zuordnungen sichtbar zur Auflösung. Manuelle Änderungen, Innenräume, Keys und Bindungen schützen ein Gebäude automatisch bei Regeneration; eine einzelne Freigabe ist ausdrücklich und löscht selbst noch nichts.

Die bisherige Haus-/Dungeonbindung, ihre Fünf-Fuß-Rasterumrechnung und begrenzten Hostbelege bleiben vorhandener Teilstand. Die technische Umsetzung des gemeinsamen Gebäudeobjekts einschließlich Speicherformat und Übernahme vorhandener Daten ist vor Produktänderungen zu konkretisieren. Eigenständige Ruinen-/Höhlendungeons bleiben unabhängig platzierbare Dungeons; ein solcher Verweis ist kein Gebäudegeschoss. Vorhandene Grundrisse können ausdrücklich als Gebäudeinnenraum übernommen werden, sobald Übernahme, Maße und stabile Referenzen geklärt sind.

### Wandumfang und horizontale Gesamtskalierung

Beim Wandwerkzeug ist der Bearbeitungsumfang ausdrücklich wählbar. Dies ist eine lokale Werkzeugeinstellung innerhalb desselben Atlas-Editors, kein Welt-/Stadt-/Dungeonmodus.

| Umfang | Wirkung |
| --- | --- |
| **Ausgewähltes Geschoss** | Ändert den Wandabschnitt im gewählten Geschoss beziehungsweise Höhenbereich und dessen angrenzende Raumgrenzen. Andere Geschosse bleiben erhalten. |
| **Überlappende gemeinsam** | Ändert zusätzlich übereinanderliegende Abschnitte desselben Wandverlaufs und deren angrenzende Raumgrenzen. Nur der tatsächlich gemeinsame Verlauf folgt; bei teilweiser Überlappung bleiben Überstände separat. Vorsprünge, andere Außenkanten und getrennte Teile werden nicht allein aufgrund überschneidender Grundflächen mitverändert. |

**Default:** Wandbearbeitung beginnt im ausgewählten Geschoss. „Überlappende gemeinsam“ wird ausdrücklich gewählt und bleibt anschließend erhalten. Zoom wechselt diesen Umfang nicht. Vor dem Ziehen hebt Hover alle betroffenen Abschnitte hervor und zeigt beispielsweise „betrifft drei Geschosse“; dieselben Teile sind in der Änderungsvorschau sichtbar. Der Umfang eines begonnenen Zugs bleibt bis Abschluss oder Abbruch fest.

**Gebäude skalieren** ist eine davon getrennte Aktion: Alle Geschossgrundrisse einschließlich Außenform, Innenwänden und Raumgeometrie werden horizontal proportional größer oder kleiner. Höhen und vertikale Geschossabstände bleiben erhalten und werden separat bearbeitet. Die Gesamtskalierung betrifft das ganze Gebäude; sie hängt nicht vom gewählten Wandumfang ab. Verschieben/Drehen verändert hingegen keine physischen Maße.

Beide Wandumfänge sind mit vollständig und teilweise übereinanderliegenden Wandabschnitten, Vorsprüngen und getrennten Teilen zu prüfen. Nach Übernahme, Undo/Redo und Neustart müssen die betroffenen Raumgrenzen konsistent und die übrigen Teile wertgleich sein. Gesamtskalierung ist an mehreren verschieden geformten Geschossen zu prüfen: sämtliche Grundrisse folgen demselben horizontalen Faktor, Höhen bleiben wertgleich, Kennungen, Texte und Verweise bleiben erhalten.

## Kleine Phasen und frühe Benutzbarkeit

Die CITY-Kennungen beschreiben Fachumfang, nicht mehr eine starre Einschubfolge zwischen HEX-Phasen. Lieferung und Teilausbau richten sich ausschließlich nach [Ergebnisgleichwertigkeit und Lieferprioritäten](ROADMAP-HEX-ATLAS.md#wie-kommen-wir-zum-ziel). Gemeinsamer Quellen-/History-/Saveanschluss geht vor Gebäudeänderungen; räumliche Identität und Inhaltsschutz gehen vor Regeneration. CITY-09 qualifiziert den vollständigen Endstand gemeinsam mit HEX-28.

Die vollständigen CITY-Anforderungen bleiben im bestehenden Katalog; Grundfunktion und späterer Ausbau dürfen über mehrere Prioritäten verteilt sein. Fehlende spätere Funktionen verhindern nur die vollständige Fachabnahme, nicht einen klar bezeichneten benutzbaren Zwischenstand.

| Phase | Nutzbarer Umfang | Praxisprüfung |
|---|---|---|
| **CITY-00 – Ergebnisvorbilder festlegen** | Kleine Referenzgalerie und Ergebnis-/Bedienkriterien festlegen. | Übersicht und Detail aller drei Vorbilder prüfen; keine Originalgeste als Pflicht übernehmen. |
| **CITY-01 – Stadt im Atlas zeichnen** | Native .city direkt am Ort anlegen; Straße, Platz und zwei Häuser im selben Editor bearbeiten. | Nur hinein-/herauszoomen; Haus verschieben, Straße ändern, Undo/Redo, speichern und frisch öffnen. |
| **CITY-02 – Nutzbare Stadt erzeugen** | Siedlungsfläche, Straßen und Platz vorgeben; Bebauung mit wenigen sichtbaren Vorgaben in Vorschau erzeugen und als direkt editierbaren Grundplan übernehmen. | Dorf und kleine Stadt erzeugen, sofort ein Gebäude und eine Straße ändern; Abbruch ohne Restdaten, Undo, Wiederöffnung. |
| **CITY-03 – Hausgrundriss und Keys direkt bearbeiten** | Gebäude mit Orts-Key und ausdrücklich angelegter Innenraumhülle gemeinsam ausarbeiten; Außenform und Räume desselben Objekts im durchgehenden Editor ändern. | Region → Stadt → Haus → Raum nur zoomen; Wandänderung gegenüber Gesamtskalierung prüfen; Straßen-, Gebäude-, Raum- und Key-Änderung mit gemeinsamer Undo-Folge und frischer Öffnung. |
| **CITY-04 – Verfeinern ohne Arbeit zu verlieren** | Ausgewählten Bereich neu erzeugen; bearbeitete Gebäude und solche mit Innenräumen, Keys oder Bindungen sowie Grenzen und Straßen schützen. | Ein Viertel erneuern; benannter POI, Gebäude samt Innenräumen und manuelle Straße bleiben wertgleich; Undo stellt Gesamtstand wieder her. |
| **CITY-05 – Straßen und Stadtbefestigung** | Hauptstraßen/Gassen, Kreuzungen, Brücken, Tore, Mauern und Türme zusammenhängend ausarbeiten. | Regionalstraße → Tor → Platz; Flussquerung; Tor oder Straßenpunkt ziehen, ohne verbundene Wege und geschützte Bauten zu verlieren. |
| **CITY-06 – Viertel, Bewohner und Fraktionen** | Viertel, besondere Gebäude und POIs; Bewohner mit Haushalten/Berufen, Beziehungen und Familienansicht sowie Fraktionen und Zugehörigkeiten stabil mit Orten verbinden. | Hafenstadt/ummauerte Stadt ausarbeiten; Bewohner, Beziehung und Fraktionszugehörigkeit einzeln und Bewohner in Vorschau gesammelt ändern; Cancel, gemeinsame Undo-Folge, geschützte Regeneration und frischen Prozess mit stabilen IDs/Bindungen prüfen. |
| **CITY-07 – Darstellung und Tagesabläufe** | Lesbare Übersicht und dekorierte Details desselben Datenstands; Tagespläne und Aktivitäten aus gemeinsamen Campaignzeit-/Kalenderdaten, einschließlich manuellem Ruhetag. | Übersicht/Detail metrisch vergleichen; Arbeits-/Ruhetag, Override bei gleicher Zeit, Tagesgrenze und großen Zeitsprung prüfen. Undo und Neustart erhalten identische Aktivitäten; keine zusätzliche City-Uhr oder doppelte Zeitwirkung bei Retry. |
| **CITY-08 – Ausgabe, große Städte und flüssige Bedienung** | Stadtausschnitte ausgeben, Großstadt/mehrere Städte messen, Detaildaten nach Bedarf laden; einfache Bedienung mit echten Aufgaben prüfen. | PNG gegen aktuellen Ausschnitt prüfen; 5.000 Gebäude und mehrere Gebäudeinnenräume bearbeiten; Navigation, Vorschau, Ressourcenfreigabe und physische Eingabe messen. |
| **CITY-09 – Gemeinsame Endabnahme** | Vollständige Funktionsziele aller drei Vorbilder einschließlich FTG-Lebensdaten und vollständigen Atlasablauf auf demselben Endbuild abnehmen; Abschluss zusammen mit HEX-28. | Welt → Region → Stadt → Haus → Raum, über alle Größen nur zoomen und direkt bearbeiten; Konflikte, Undo, Neustart, Export und Installation getrennt prüfen. |

**Nach CITY-01:** Eine kleine Stadt lässt sich unmittelbar im Atlas zeichnen und speichern. **Nach CITY-02:** Ein erzeugter Plan lässt sich sofort weiterbearbeiten. **Nach CITY-03:** Hex, Straße, Haus, Dungeonraum und Keys sind in einer Sitzung ohne Kontextwechsel bearbeitbar.

CITY-05 ergänzt die zusammenhängenden Stadtstraßen auf der bereits geprüften Linienbasis; CITY-07 nutzt die gemeinsame Asset-/Beschriftungsbasis. Erste Phasen benötigen keine vollständige Dekorationsbibliothek. Aufräumen und zusätzliche Stiloptionen dürfen den geprüften Kernweg nicht verdrängen.

## Ergebnis- und Funktionskriterien

| Ziel | Konkret zu prüfen |
|---|---|
| Stadtstruktur | Erkennbare Hauptstraßen und Gassen, Plätze, Viertel und Bebauung; unterschiedliche Dichte und passende Straßenanschlüsse. |
| Umgebung | Stadtlage an Fluss/Küste und regionalen Wegen; Brücken, Hafen, Tore und Befestigungen passen räumlich zusammen. |
| Besondere Orte | Markt, Burg, Tempel, Gärten und andere POIs können gezielt angelegt, beschrieben und stabil verlinkt werden. |
| Bewohner und Beziehungen | CITY-06: Haushalte, Berufe, Wohn-/Arbeitsorte, Beziehungen und Familienansicht direkt ändern/navigieren; gemeinsame Undo-Folge, lokale Regeneration und frischer Prozess erhalten IDs, geschützte Texte und Referenzen. |
| Fraktionen | CITY-06: editierbare Fraktionsdaten und Zugehörigkeiten nach vollständiger FTG-Inventur; Such-/Ortsbezug, Undo, Regeneration und vollständige Import-Referenzclosure prüfen. |
| Tagesabläufe | CITY-07: Aktivität und Aufenthaltsort aus gemeinsamer Campaignzeit ableiten; Tagesgrenzen, große Sprünge, Ruhetag/Override, Rücknahme und Neustart prüfen. Zeitport/Kalenderpolitik bleiben mit gemeinsamen Zeitownern zu entscheiden; E2E-03 prüft die Integration zusätzlich. |
| Ausarbeitung | Variierte Hausformen und Dächer, Vegetation und Dekoration ergeben eine stimmige, lesbare Draufsicht. |
| Eigene Eingriffe | Generatorbereiche können lokal erneuert werden; manuelle Änderungen, Gebäude mit Innenräumen und Keys bleiben erhalten. |
| Durchgehende Bearbeitung | Dasselbe Werkzeug-/Kameralayout, stabile Auswahl, gemeinsames Undo/Redo und sofortige Aktionen an sichtbarer Geometrie. |
| Räumliche Übereinstimmung | Außenansicht, Außenwände, Eingänge und angrenzende Räume verwenden denselben Gebäudezustand. Wandänderung wirkt im gewählten Umfang; Gesamtskalierung verändert alle Grundrisse horizontal und erhält Höhen. Verschieben/Drehen erhält Maße. Keller dürfen bewusst über den oberirdischen Umriss hinausreichen. |
| Haltbare Daten | Speichern, Neuöffnung, externe Änderungen und unterbrochenes Mehrdatei-Speichern erhalten Geometrie, Texte und Kennungen. |
| Ausgabe | Übersicht, Detail und PNG/JPEG verwenden denselben Datenstand; Ausschnitt und Auflösung sind von der Editorkamera unabhängig. Lebensdaten-Ausgabe und weitere Formate werden anhand der offenen FTG-Exportinventur in CITY-08 geprüft. |

Die Ergebnisbilder werden bei vergleichbarer Größe und Detailtiefe beurteilt. Straßennetz, Dichte, Formen, Lesbarkeit und Gestaltung zählen; Pixelgleichheit ist kein Ziel. Bedienqualität ist eine eigene Abnahme: Erzeugen, Straße umlenken, POI beschreiben, Hausgrundriss bearbeiten. Beobachtete Aktionszahl, Zeit, Fehlversuche und nötige Hilfestellung dokumentieren. Bewohner ändern, Beziehung wiederfinden, Fraktionszugehörigkeit wechseln und Tagesablauf kontrollieren gehören ebenfalls zu den gepaarten Original-/Endbuildaufgaben. Eine bessere Bedienung wird erst nach diesen Aufgaben behauptet.

## Häufige Tests am gesamten Atlasweg

Je Phase den neuen Ablauf früh in Obsidian bedienen, passende Kernprüfungen ausführen und den bisherigen Atlasweg auf derselben Testregion wiederholen. Fachreview und begrenzte Nachbesserung folgen getrennt; nach je zwei Produktphasen sowie den frühen Stadtmeilensteinen steht ein geprüfter Testbuild bereit.

Ab CITY-03 ist die feste Folge: **Region anzeigen → Hex ändern → in Stadt zoomen → Straße ändern → Haus ändern → weiter in Hausgrundriss zoomen → Raum ändern → Orts-/Raum-Key bearbeiten → herauszoomen → Änderungen rücknehmen/wiederholen → speichern → vollständig neuer Prozess → dieselben Stellen wiederfinden.**

Zusätzliche Pflichtproben:

- Auswahl, Werkzeug, Kamera und Undo-Folge bleiben über Zoomgrenzen erhalten. Keine Schaltfläche oder Auswahl einer „aktiven Karte“ ist für Navigation oder Bearbeitung erforderlich.
- Ein begonnener Zeichenzug behält sein Ziel, wenn der Cursor eine Detailgrenze überschreitet. Neu sichtbar werdende Geometrie übernimmt den Zug nicht unbemerkt.
- Stadt und Gebäude verschieben/drehen; Weltanker und Innenräume folgen korrekt, ohne lokale Maße zu verändern. Beide Wandumfänge und ausdrückliche Gebäudeskalierung getrennt prüfen: angrenzende Räume folgen der Wand im gewählten Umfang; Gesamtskalierung verändert Außen- und Innengeometrie aller Grundrisse horizontal proportional und erhält Höhen/Geschossabstände. Das Dungeonraster bleibt fünf Fuß je Feld; eine Größenänderung ist eine ausdrückliche Geometrieänderung, keine Umdefinition der Feldeinheit.
- Ein Viertel neu erzeugen und abbrechen; beschriebene oder manuell bearbeitete Häuser, lokale Straßen und Verknüpfungen erhalten. Neue Kennungen nur für tatsächlich neue Elemente vergeben.
- Stadt mit 5.000 Gebäuden und mehreren Gebäudeinnenräumen prüfen. Die bestehenden Atlas-Ziele von höchstens 33 ms pro Navigationsbild im 95. Perzentil und 100 ms bis zur Werkzeugvorschau nach dem Laden werden gemessen; sie sind noch nicht verifiziert.
- Physische Maus-/Touchpad-Bedienung, Großkartenlauf, Ergebnisvergleich, Ausgabe und tatsächlich installierten Endstand getrennt belegen.

Nachweise stehen bei stabilen CTY-Unterfällen in `acceptance.json`, der aktuelle Atlasstand in der Atlasübersicht. Große Ergebnisbilder und Kontrollkarten liegen unter `/home/aaron/.cache/dungeon-native-qa/city-plans/`. Dieser Plan enthält keine fortlaufenden Laufprotokolle.
