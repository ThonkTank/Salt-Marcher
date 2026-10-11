# Stadt-Pfad: technischer Gesamtplan und CITY-00

Abschnitte: [Stand und offene Arbeit](#stand-und-offene-arbeit) · [Technische Arbeitspakete](#technische-arbeitspakete) · [Stadtmodell und Codec](#stadtmodell-und-codec) · [Stadtbefehle](#stadtbefehle) · [Werkzeugentwurf](#werkzeugentwurf) · [Stadtgesten](#stadtgesten) · [Stadtzeichnung](#stadtzeichnung) · [Atlasanschluss](#atlasanschluss) · [Ziele im Atlas-Dock](#ziele-im-atlas-dock) · [Gebäudename und Hausrotation](#gebäudename-und-hausrotation)

Die [Atlasübersicht](ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick) zeigt den integrierten Stand und die offenen Kandidaten. Dieser Fachplan enthält technische Anforderungen und Pflichtfälle; seine ursprünglichen Statusangaben sind keine aktuelle Integrationsfreigabe. [Ergebnisgleichwertigkeit, KISS und Lieferstufen](ROADMAP-HEX-ATLAS.md#wie-kommen-wir-zum-ziel) bestimmen die Umsetzung; CITY-Nummern dienen der Fachzuordnung. Gemeinsame Werkzeuge und Panelaktionen stehen ausschließlich im [Atlas-Werkzeugkatalog](ROADMAP-HEX-ATLAS.md#werkzeuge-und-bediengefühl).

**Nutzerpräzisierung vom 11.10.2026:** Die [konkreten Atlasabläufe](ROADMAP-HEX-ATLAS.md#konkrete-nutzerabläufe) und der [gemeinsame Gebäudevertrag](ROADMAP-CITIES.md#gebäude-und-innenräume-als-ein-objekt) bestimmen das Ziel für Außenform und Innenräume. Das Gebäude ist ein gemeinsam bearbeitetes Objekt: Wandänderung im ausgewählten Geschoss oder an übereinanderliegenden Abschnitten desselben Wandverlaufs und horizontale Gesamtskalierung aller Grundrisse sind verschiedene Aktionen. Höhen/Geschossabstände bleiben bei Gesamtskalierung erhalten; Verschieben/Drehen erhält Maße. [Werkzeugbedienung](ROADMAP-HEX-ATLAS.md#werkzeuge-und-bediengefühl) und [Wandumfang](ROADMAP-CITIES.md#wandumfang-und-horizontale-gesamtskalierung) beschreiben Gesten, Vorschau, Default und Rücknahme. Die folgenden City-v1-/Dungeonbindungs-Verträge beschreiben vorhandene Bausteine und ihre begrenzten Nachweise. Sie beweisen dieses erweiterte Ziel noch nicht; [Speicherung, gemeinsame Befehle und Datenübernahme](#gemeinsamer-gebäudezustand-erste-umsetzung) sind unten als nächster Ausbau konkretisiert. Bestehende CTY-Kennungen und Abnahmezustände werden durch diese Dokumentation nicht neu vergeben oder geschlossen.

## Stand und offene Arbeit

Stadtmodell, gemeinsame History, Geometrie, Trefferprüfung und Renderer sind integriert. Gebäudenamen, Hausrotation und ihre Save-/Frischprozessbelege stehen unten. Assistierte Bebauung ist Kandidat in [PR154](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/154); vollständige CITY-/Original-/Bedienabnahme bleibt offen. Die [Atlasübersicht](ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick) trennt Integration, Kandidaten und fehlende Nachweise.

## Lebensdaten in der bestehenden Lieferfolge

Planungsgrundlage: Shared `e157462ee1a4c2b82b0c927df664a8c06fc38cb1`, [Issue #44](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/44), direkter Drei-Produkte-Auftrag vom 09.10.2026 und vorhandenes `acceptance.json.cityPlans.functionalInventory`. Die folgenden Lebensdatenzuordnungen dokumentieren den bisherigen Fachumfang; ihre Lieferung folgt der zentralen Atlaspriorisierung. Die Inventareinträge enthalten historische Originalbeobachtungen mit jeweils offenen Lücken; sie sind kein aktueller vollständiger Originalvergleich.

### Offene Funktionen

| Teilziel / vorhandene Quellkennung | Bestehendes Paket und Zielregel | Produktabnahme |
| --- | --- | --- |
| Bewohner: `CO-FTG-0014`, ergänzend Demografie `CO-FTG-0004` und Massenbearbeitung `CO-FTG-0017` | CITY-06; Bewohner, Haushalt, Beruf sowie Wohn-/Arbeitsgebäude mit stabilen Referenzen. Explizite Änderungen und geschützte Regeneration, keine Erzeugung beim Öffnen. | zwei Bewohner anlegen/ändern, Haushalt und Arbeitsort wechseln, mehrere Namen mit Vorschau ändern; Cancel schreibt nichts, Apply ist ein gemeinsamer Befehl. IDs, geschützte Texte und Bindungen nach Regeneration, Undo/Redo und frischem Prozess prüfen. |
| Beziehungen: `CO-FTG-0014`, Stammbaum `CO-FTG-0026` | CITY-06; Personenbindungen und navigierbarer Zusammenhang. Richtung, Beziehungstypen, reziproke Wirkung sowie Entfernen/Remap benötigen einen konkreten Fachvertrag; keine Typenliste aus Teilbeobachtung als vollständig ausgeben. | Beziehung bearbeiten, von beiden Personen aus wiederfinden, Familienansicht navigieren und nach Neustart dieselben Kennungen prüfen; Änderung/Entfernung/Undo darf keine verwaisten Referenzen hinterlassen. |
| Fraktionen: `CO-FTG-0007`, ergänzend Regierung/Wachen `CO-FTG-0005` | CITY-06; editierbare Fraktionsdaten und Zugehörigkeiten mit stabilen Personen-/Ortsbezügen. Allgemeine autonome Fraktionssimulation ist eine getrennte SaltMarcher-Frage; sie darf FTG-Funktionsumfang nicht streichen. | zwei Fraktionen anlegen, Zugehörigkeit ändern und gezielt suchen; Regeneration, Undo/Redo, Restart und vollständige Import-Referenzclosure prüfen. Umfang der Fraktionsattribute erst anhand vollständiger Inventur festlegen. |
| Tagesabläufe: `CO-FTG-0018`, manueller Ruhetag `CO-FTG-0042` | CITY-07; Aufenthalts-/Aktivitätsanzeige aus stabilen Personen-, Wohn- und Arbeitsbezügen und gemeinsamer autoritativer Campaignzeit. Kein eigener Timer, keine zweite CitySceneClock. Kalender-/Overridepolitik und Zeitport bleiben im gemeinsamen Travel/Clock/Calendar-Vertrag zu entscheiden; [E2E-03](ROADMAP-E2E-GATES-CANDIDATE.md#e2e-03--reise--kalenderclock--weltreaktion) prüft dessen Verwendung. | Arbeits-/Ruhetag und manuellen Override bei gleicher Zeit sowie Tagesgrenze/großen Zeitsprung prüfen; Rücknahme und Restart rekonstruieren identische Aktivität, Retry erzeugt keine doppelte Zeitwirkung. Positive gemeinsame Zeitintegration gehört auch in E2E-03. |

Die jeweiligen exakten `sourceUrl`, beobachteten Zeiten, Originalbelege und `gap`-Felder bleiben ausschließlich im vorhandenen Inventar nachlesbar. Mehrere Originaleingaben dürfen derselben eigenen Funktion entsprechen; Aufgabenwirkung und Erhaltung der Daten bleiben unabhängig nachzuweisen. Die Quellkennungen werden in der Scope-Tabelle ausdrücklich referenziert; CITY-00 besitzt weiterhin die vollständige Drei-Produkte-Inventur. CITY-08 berücksichtigt Ausgabe dieser Lebensdaten anhand der offenen Exportinventur; CITY-09 verlangt vollständige Funktion und gepaarte Aufgaben zur besseren Bedienung. E2E-01 ist kein Ersatz für diese späteren Fachabnahmen.

## Technische Arbeitspakete

| Phase | Umsetzung | Funktionsnachweis |
|---|---|---|
| CITY-00 | Drei Originalprodukte funktional inventarisieren; stabile CO-Kennungen pro Fähigkeit, Quellen/Version/Datum und direkte Ergebnisproben. Galerie: Dorf, ummauerte Stadt, Hafen und Detailfläche. FTG zusätzlich Bewohner-, Fraktions- und Zeitabläufe. Katalog und Roadmap auf den aktuellen Auftrag erweitern. | Jedes Inventarelement hat Quelle, eigene Zielaufgabe, technische Zuordnung und offenen/belegten Vergleich; direkte Proben getrennt von Dokumentation. |
| CITY-01 | `src/features/city/model.ts`: versionierte Metergeometrie, IDs, Straßenknoten/-kanten, Platzkonturen, Gebäude, Grundstücke und Districts. Parser validiert endliche Werte, eindeutige IDs und Referenzen. `city/commands.ts` nutzt den gemeinsamen Atlasbefehl aus HEX-05; keine zweite Undo-Historie. Renderer und Trefferprüfung verwenden denselben Transform. Native Registrierung .city im vorhandenen Host. | Straße/Platz/zwei Häuser im Atlas zeichnen, außerhalb belegter Ausdehnung wachsen, verschieben, Undo/Redo, Save, frischer Prozess. |
| CITY-02 | `city/generator.ts` als deterministischer Workerauftrag mit Seed, Version, Polygon und Vorgaben. Straßen zuerst, Blöcke/Grundstücke danach; Gebäude dürfen Straßen, Wasser und Grenzen nicht schneiden. Materialisierte Geometrie speichern. Abbrechbare Vorschau, ein atomarer Commit, niemals beim Laden generieren. | Dorf/Stadt reproduzierbar; unmittelbare Straßen-/Hausänderung; Abbruch ohne Dirty/History; ein Undo; Reload identisch. |
| CITY-03 | Gemeinsamen Gebäudezustand für Außenform, Innenwände, Räume, Geschosse und Dach festlegen; leere Innenraumhülle ausdrücklich anlegen. Vorhandene Platzierungs-/Meter-/Fünf-Fuß-Basis und Key-Panel verwenden, Speicherformat und Datenübernahme vor Umsetzung konkretisieren. Wandänderung im ausdrücklich gewählten Umfang und horizontale Gesamtskalierung aller Grundrisse bei unveränderten Höhen als gemeinsame Geometriebefehle; optionale stabile Ortsverweise und Multi-Dokument-Speicherung mit Wiederherstellung erhalten. | Ausschließlich Zoom Region→Stadt→Haus→Raum; dieselbe Werkzeugwahl, Auswahl und Historie. Wandänderung gegenüber Gesamtskalierung prüfen; Verschieben/Drehen verändert keine lokalen Raummaße. Kennungen/Texte/Links bei Datenübernahme erhalten. Fehler nach jedem Journalschritt und externe Konflikte prüfen. |
| CITY-04 | Herkunft/Schutz je Element; manuelle Änderung, Innenräume, Keys oder Bindungen schützen automatisch. Lokale Neugeneration nur in ausgewähltem Polygon; geschützte Konturen als Hindernisse, bestehende IDs unverändert. Einzelne Freigabe ausdrücklich; keine stille Löschung von Autoreninhalten. Änderungen in einem Atlasbefehl. | POI, manuelle Straße und Gebäude samt Innenräumen vor/nach byte-/wertgleich; Cancel, Undo, Save und Neustart. |
| CITY-05 | Straßen als topologischer Graph mit Klassen/Breite; Anschluss an regionale Wege. Flusskreuzungen als Brücken, Tore als Bindung von Straße und Mauer; Mauern/Türme als editierbare Pfadobjekte. Punktänderung aktualisiert betroffene Bindungen lokal. | Regionalweg→Tor→Platz ohne Lücke; Brücke passt; Torzug erhält Schutz und Bindungen. |
| CITY-06 | Viertelpolygone mit Nutzung/Dichte; Gebäudearten Markt/Hafen/Burg/Tempel/Garten. FTG-Lebensdaten: stabile Bewohner-, Haushalts-, Berufs- und Fraktionsreferenzen, Religion/Demografie und editierbare Notizen. `city/population.ts` generiert diese deterministisch nach dokumentierten Gebäudebedarfen. Keine Pflichtdatei je namenlosem Haus. | Hafen/ummauerte Stadt, POI-Suche, Ortskey, Haushalts-/Berufs-/Fraktionsänderung; Daten bleiben nach Regeneration und Neustart konsistent. |
| CITY-07 | Gemeinsame Assetbasis/Detaildarstellung: variierte Dächer, Pflanzen, Props, Farb-/Stilvorlagen, Pfad-/Flächenplatzierung und gruppierte Objekte. FTG-Zeit, Tagespläne, Tageslicht, Wetter/Jahreszeit: deterministische ableitbare Anzeige aus gemeinsamer autoritativer Campaignzeit, keine eigene CitySceneClock oder unbegrenzter Hintergrundtimer. Zeitport und Kalender-/Overridepolitik benötigen den gemeinsamen Travel/Clock/Calendar-Vertrag. `city/simulation.ts` leitet Aufenthaltsorte aus stabilen Personenbindungen ab. | Übersicht/Detail metrisch deckungsgleich, ausgewählte Geometrie sichtbar; Personen-, Wetter-/Zeitaufgaben gegen Original. |
| CITY-08 | Ausschnitt/Exportsettings unabhängig von Kamera; PNG/JPEG/SVG/JSON ausdrücklich, Raster und Vorlagen sowie zusätzliche FTG-Exportformate nach Inventar. Alle Formate verwenden denselben materialisierten Szenenstand; SVG Vektoren/Texte und JSON metrische Geometrie separat prüfen. Räumlicher Index, Viewport-Culling und Bedarfsladen; Workerabbruch, Dispose. | 5.000 Gebäude, mehrere Städte/Innenräume; p95 Navigation ≤33 ms, Vorschau ≤100 ms nach Laden; Save/Reload; Export entspricht demselben Dokumentstand. |
| CITY-09 | Vollständiges Inventar gegen denselben Endbuild prüfen; gemeinsame HEX-28-Abnahme. Isolierter Testvault, Sicherung vor Installation. | Alle Pflichtfähigkeiten, Konflikt/Undo/Neustart/Export, installierter Build, Ergebnisvergleich und physische Bedienung jeweils eigene Belege. |

Die vorhandenen Modell-, Codec-, History-, Draft-, Gesture- und Rendererbausteine sind im Atlas integriert; das gemeinsame Gebäudeobjekt und die vollständigen Arbeitspakete oben sind damit nicht abgeschlossen. Die technischen Verträge der vorhandenen Bausteine stehen in den folgenden Abschnitten. Sichtbare Gebäudenamen und Hausrotation sowie die begrenzten Save-/Frischprozessbelege sind unter [Gebäudename und Hausrotation](#gebäudename-und-hausrotation) aufgeführt. Die [Atlasübersicht](ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick) führt aktuelle Kandidaten und Lücken; vorhandene Anschlüsse sind keine vollständige CITY- oder Originalabnahme.

Die bestehenden Fähigkeiten `CO-COK-0010` (CITY-07) und `CO-WAT-0011` (CITY-02/08) erhalten ihren konkreten Bibliotheks-/Vorgabenablauf ausschließlich bei den [zentralen Atlasaktionen](ROADMAP-HEX-ATLAS.md#aktionen-am-ausgewählten-objekt). Ihre offenen Originalwirkungen und Versionsfragen bleiben im vorhandenen Inventar; diese Planergänzung vergibt keine CTY-/CO-Freigabe.

## Drei Referenzen und bisher zusätzlich fehlende Fähigkeiten

Stand 09.10.2026, offizielle Dokumentation gelesen, aktuelle Laufversionen noch nicht direkt beobachtet:

- Canvas of Kings: interaktive Pfade/Flächen/Räume, automatische Objektverteilung, Zufallsvarianten, zusammen bewegte Objektgruppen, Licht/Wetter, Exportausschnitt mit Quadrat-/Hexraster und gespeicherten Vorlagen. Quelle: https://store.steampowered.com/app/2498570/Canvas_of_Kings/ . Jede genannte Fähigkeit einzeln in CITY-00 direkt prüfen.
- Watabou: Layout, Viertel, Gassen, Dächer und Umgebung; aktuelle Laufoptionen und Exportformate vollständig direkt erfassen. Quelle: https://watabou.itch.io/medieval-fantasy-city-generator . Ein altes Quellarchiv zählt nicht als aktuelle Funktionsabnahme.
- Fantasy Town Generator: konfigurierbare Siedlung/Bevölkerung/Wasser/Viertel, Gebäudeabhängigkeiten, Bewohner/Fraktionen, editierbare Karte und Lebensdaten, lokale Neugeneration, Tagespläne/Zeit, Wetter/Jahreszeiten, Exporte und Vorlagen. Quellen: https://docs.fantasytowngenerator.com/category/create-settlements/ , https://docs.fantasytowngenerator.com/category/use-settlements/ , https://docs.fantasytowngenerator.com/category/edit-settlement/ , https://docs.fantasytowngenerator.com/category/premium-features/ . Details, Premiumfähigkeiten und Formatspezifika offen inventarisieren; keine stillschweigende Einschränkung auf Kartenbilder.

Die genannten zusätzlichen Fähigkeiten sind Planungsgegenstände, keine vollständige Originalinventur. Nicht direkt zugängliche Funktionen bleiben mit Zugangslücke offen; keinen Kauf oder fremden Login voraussetzen.

## Bedienabnahme

Identische Aufgaben in den drei Originalen und im eigenen Endbuild: Siedlung erzeugen, Straße umlegen, Tor/Brücke setzen, Viertel erneuern ohne POI-Verlust, Bewohner/Fraktion ändern, Tageszeit ändern, Hausraum und Key bearbeiten, Ausgabe erstellen. Pro Aufgabe Schritte, Zeit bis Ergebnis, Fehlversuche und benötigte Hilfe erfassen. Aufgaben, die ein Original nicht besitzt, als Projektmehrwert prüfen, nicht als vergleichbaren Geschwindigkeitsgewinn zählen. Bessere Bedienung erst aus gepaarten Aufgaben ableiten; synthetische Eingabe ersetzt keine physische Maus-/Touchpad-Abnahme.

## Bestehende Pflichtfälle: vollständiger offener Bestand

- **CTY-001.01 / CITY-01 — Stadt als native Atlasgeometrie**: Stadt, Straße und Gebäude bleiben editierbare Daten mit stabilen Kennungen und tatsächlichem Metermaßstab; sie erscheinen an der gespeicherten Atlasposition.
- **CTY-001.02 / CITY-02 — Editierbare Generation**: Siedlungsfläche mit Straßen-/Platzvorgaben und wenigen Optionen erzeugt eine Bebauungsvorschau; Übernehmen materialisiert individuell editierbare Gebäude, Abbrechen hinterlässt keine Restdaten. Gespeicherte Geometrie, Seed und Generatorversion werden nach Neustart ohne erneute Generation erhalten.
- **CTY-001.03 / CITY-02 — Einfügung in die Umgebung**: Lokale Küste, Fluss und regionale Straßen geben Referenzanker; Stadtplanung überschreibt Landschaft und bestehende Ortsinhalte nicht stillschweigend.
- **CTY-002.01 / CITY-01 — Straße unmittelbar ändern**: Im bestehenden Atlas eine Straße zeichnen, ziehen, ergänzen und rücknehmen; verbundenes Netz und Gebäude bleiben konsistent.
- **CTY-002.02 / CITY-01 — Haus unmittelbar ändern**: Gebäude direkt auswählen, verschieben, skalieren, drehen und entfernen; derselbe Editor, dieselbe Kamera und durchgehende Historie bleiben bestehen. Mit Innenräumen ab CITY-03 gilt der gemeinsame Gebäudevertrag: Wandänderung passt angrenzende Räume im gewählten Geschoss oder entlang übereinanderliegender Abschnitte desselben Verlaufs an; ausdrückliche Gesamtskalierung verändert Außen-/Innengeometrie aller Grundrisse horizontal proportional und erhält Höhen/Geschossabstände; Verschieben/Drehen erhält Maße, Kennungen und Keys.
- **CTY-002.03 / CITY-03 — Keine separaten Modi oder Editorkontexte**: Zoom verändert sichtbare Details, aber wechselt weder Werkzeugleiste, Werkzeug, Auswahl, Historie noch Kartenfenster. Aktionen richten sich nach Werkzeug und getroffener Geometrie; ein laufender Zug behält sein Ziel.
- **CTY-003.01 / CITY-04 — Gezielt neu erzeugen**: Nur gewählten Bereich erneuern; manuell bearbeitete oder verlinkte Elemente bleiben samt Kennungen, Geometrie und Keys erhalten. Eine Aktion ist vollständig rücknehmbar.
- **CTY-003.02 / CITY-04 — Varianten und Entwürfe erhalten**: Variantenvergleich und Abbruch verlieren keinen bisherigen Stand. Gespeicherte Entwürfe und zukünftige Generatorupdates verändern die materialisierte Stadt nicht beim Öffnen.
- **CTY-004.01 / CITY-05 — Zusammenhängendes Straßen- und Wegenetz**: Hauptstraße und Gassen sind verbunden; eine Straße schneidet geschützte Gebäude nicht unbemerkt. Kreuzungen, Sackgassen und Platzanschlüsse bleiben nachvollziehbar.
- **CTY-004.02 / CITY-05 — Fluss, Brücken und Befestigung**: Straßenqueren über Brücken, Mauern mit begehbaren Toren und Türmen; Anschluss an Regionalstraße erhält räumliche Kontinuität nach Änderung und Neustart.
- **CTY-004.03 / CITY-06 — Stadtformen und Viertel**: Dorf, ummauerte Stadt und Hafenstadt besitzen unterscheidbare Struktur; Viertel, Bebauungsdichte, Plätze und besondere Bauten lassen sich gezielt beeinflussen.
- **CTY-005.01 / CITY-03 — Orts- und Gebäude-Keys**: Orts-Key bleibt .location; ein beschriebenes Gebäude oder Viertel erhält einen optionalen stabilen Ortsverweis. Umbenennen, Verschieben und lokale Neugeneration erhalten Abschnittslinks.
- **CTY-005.02 / CITY-03 — Welt bis Hausinnenraum nur zoomen**: Von oberster Hex-Stufe durch Stadt und Haus bis Raum ausschließlich zoomen; vorhandene Innenräume erscheinen am tatsächlichen Gebäudeort. Keine Öffnen-/Betreten-/Modusaktion ist nötig. Das erstmalige Anlegen einer leeren Innenraumhülle ist ausdrücklich; Zoom allein erzeugt keine Daten.
- **CTY-005.03 / CITY-03 — Direkte gemischte Bearbeitung und Undo**: In einer Sitzung Hex, Straße, Haus, Dungeonraum und Key ändern; ohne Karten-/Moduswechsel rücknehmen/wiederholen und mit wiederherstellbarem Journal speichern.
- **CTY-005.04 / CITY-03 — Stadt und Gebäude gemeinsam verorten**: Stadt oder Gebäude verschieben/drehen; sämtliche Gebäudeteile folgen gemeinsam. Raumgeometrie behält bei diesen Platzierungsänderungen Maße, lokale Kennungen und Form. Wandänderung im gewählten Umfang und ausdrückliche horizontale Gesamtskalierung aller Grundrisse bei unveränderten Höhen ändern Außen-/Innengeometrie gemeinsam gemäß Gebäudevertrag; sie sind keine bloße Änderung eines unabhängigen Hausdockpunkts.
- **CTY-005.05 / CITY-08 — Zoom ohne räumliche Sprünge**: Kontrollpunkt bleibt beim Detailwechsel an derselben Weltposition und unter dem Zoomanker; Zoomgrenzen pendeln nicht, Dach-/Innenraumübergang verdeckt keine bearbeitbare Auswahl.
- **CTY-006.01 / CITY-07 — Lesbare Stadtübersicht**: Straßenhierarchie, Viertel, Plätze, Wasser, Befestigung und POIs bilden eine klare Draufsicht nach dem gewählten Watabou-Ergebnisvorbild; Lage und Maßstab bleiben erhalten.
- **CTY-006.02 / CITY-07 — Ausgearbeitete Stadtdetails**: Variierte Gebäude/Dächer, Mauern/Türme, Vegetation und Dekoration ergeben eine stimmige Draufsicht nach dem gewählten Canvas-of-Kings-Ergebnisvorbild; direkte Bearbeitung bleibt möglich.
- **CTY-006.03 / CITY-08 — Gleicher Inhalt in Übersicht, Detail und Ausgabe**: Übersicht und Dekoration sind Darstellungen derselben editierbaren Daten. Stadtausschnitt zeigt dieselbe Geometrie und POIs unabhängig von Kamera; vollständige PNG/JPEG-Ausgabe wird mit HEX-27 geprüft.
- **CTY-007.01 / CITY-08 — Große Stadt und Ressourcenfreigabe**: Auf dem vorhandenen Laptop eine Stadt mit 5.000 Gebäuden und mehreren Gebäudeinnenräumen prüfen; Zielwerte der Atlasnavigation (p95 ≤33 ms/Bild, Vorschau ≤100 ms nach Laden) messen und ungenutzte Detailressourcen freigeben.
- **CTY-007.02 / CITY-03 — Speichern, Konflikt und Wiederherstellung**: .overworld/.city/.location/.dungeon-Änderungen, externe Änderung und unterbrochenes Speichern prüfen. Konflikte bleiben sichtbar; Wiederherstellung erzeugt keine verwaisten Platzierungen oder verlorenen Texte.
- **CTY-008.01 / CITY-02 — Einfacher Einstieg**: Mit wenigen sichtbaren Vorgaben, einer direkt aufgezogenen Siedlungsfläche sowie Straßen und Platz entsteht eine Vorschau; nach Übernehmen ist der Plan im selben Atlas unmittelbar nutzbar. Kein Wizard, Moduswechsel oder verstecktes Pflichtmenü; Abbrechen erhält den bisherigen Stand.
- **CTY-008.02 / CITY-08 — Bedienbarkeit durch tatsächliche Aufgaben**: Neue Stadt erzeugen, Straße umlenken, Gebäude/POI anlegen, in Hausgrundriss zoomen und Raum-Key bearbeiten mit Maus/Touchpad prüfen; Zeiten, nötige Aktionen und Fehlversuche getrennt erfassen.
- **CTY-009.01 / CITY-09 — Endstand mit allen Atlasgrößen**: Welt → Region → Stadt → Haus → Raum und zurück nur mit Zoom; direkte Bearbeitung, Datenhaltung, Verortung, Links, Ausgabe und installierter Endbuild belegt.

## CITY-02-Parameterpräzisierung aus I12

Originalentwurf Town(~4000): American-Stufe1 = Continue, Winkelwerte0/0, Segment50m, Verzweigungsintervalle3/3; Ringed-Stufe1 = Curve around origin,5/5,37m,2/5. Dies sind beobachtete Formularwerte, keine Kartenwirkung oder allgemeine Presetkonstante für jede Größe. CITY-02 benötigt geordnete versionierte Wachstumsstufen mit Flächenanteil, Straßenverzweigung, Segmentlänge, Intervallen, Mindestviertelfläche, begrenzter Hauptstraßenverzweigung, Gebäudeplatzierung und Material-/Maueroverride. Suburb ist Restanteil nach den Stufen (60/40 im Originalentwurf belegt); Parser normalisiert keine ungültigen Summen stillschweigend. Presetdefinition und Custom-Parameter gehören mit Generatorversion/Seed zum gespeicherten Auftrag; Ergebnis bleibt materialisierte editierbare Metergeometrie. Winkelmaße und Parametergrenzen vor Implementierung direkt klären. Keine neue Geometrie-/Historybasis.

CO-FTG-0022 umfasst Namensset-Referenzen pro Bewohnerart (12 sichtbare Sets, Mehrfachauswahl Generic+Old German belegt) sowie gespeicherte Generierungsvorgaben. CITY-02 speichert versionierte Vorgaben an der gemeinsamen Dokument-/Assetbibliothek; CITY-06 verwendet dieselben Referenzen deterministisch für Bewohnernamen. Kein Kopieren einer proprietären Namensdatenbank aus Originalinternas; konkrete kompatible Namenssammlungen und Bearbeitung/Import müssen vor Umsetzung geprüft werden. Gewichte der Arten und Stufenanteile sind getrennte Parameterarten; keine unbewiesene gemeinsame Prozentregel. Eigene Naming-Ausgabe, Import/Export und Gleichwertigkeit bleiben offen.

## Gemeinsamer Gebäudezustand: erste Umsetzung

**Geplant für Work 4b / CITY-03.** Ein ausgewähltes Gebäude wird aus `CityBuilding`, seiner vorhandenen `city-building`-Platzierung und dem zugehörigen nativen `.dungeon` als ein unveränderlicher Bearbeitungsstand gelesen. `.city` hält Namen, Außenkontur und Pose; `.dungeon` hält Geschosse, Wände, Räume, Dächer und Raum-Keys; `.overworld` hält die Verortung. Jede Information behält genau einen Speicherbesitzer. Auswahl, Vorschau und Befehle adressieren das Gebäude gemeinsam. Die vorhandene feste Umrechnung bleibt 1,524 Meter je Dungeonfeld.

1. **Innenraum anlegen:** Haus wählen → „Innenraum anlegen“ → Grundrissvorschau aus der posierten Außenkontur → übernehmen. Ein gemeinsamer Auftrag erzeugt native Karte, erstes Geschoss/Raum und Placement und registriert neue Dateireferenzen über den autorisierten Campaignmanifest-Teilnehmer. Abbruch erzeugt keine Dateien; Dateinamens-/IDkonflikt übernimmt nichts. Keller und spätere Geschosse dürfen eigene Außenkonturen besitzen.
2. **Vorhandenen Innenraum verwenden:** Der Anwender wählt ausdrücklich eine bestehende Karte und den vorhandenen Eingangs-/Geschossbezug. Vorschau zeigt Maßstab und Abweichungen. Bestehende Kennungen, Texte und Links bleiben erhalten; eine unpassende Kontur wird vor Übernahme gezielt korrigiert. Alle betroffenen Quellen müssen geladen und aktuell sein.
3. **Wand im gewählten Geschoss ändern:** Der Zug hält Anfangsstand, Geschoss und Konturadresse. Vorschau berechnet die betroffene Wand sowie angrenzende Raumkonturen gemeinsam. Die Außenkontur der Stadtansicht folgt der oberirdischen Bezugsebene `surfaceFloorId`; Änderungen anderer Geschosse bleiben in deren nativer Geometrie. Topologie, Durchgangsanker und Room-IDs werden vor Apply zusammen geprüft. Mehrdeutige Nachbarschaft oder ungültige Geometrie erklärt die Vorschau und verhindert Apply.
4. **Verschieben/Drehen:** Bestehende Hauspose und Parenttransform ändern; lokale Innenmaße und Keys bleiben erhalten. **Efficient:** Wandumfang umfasst nur ausdrücklich ausgewählte übereinanderliegende Abschnitte desselben Wandverlaufs. Gesamtskalierung wirkt vom bestätigten Gebäudeanker aus auf Außenform und alle horizontalen Geschossgeometrien einschließlich ihrer gebundenen Elemente; Höhe und vertikale Abstände bleiben erhalten.
5. **Übernehmen und speichern:** Vollständige native Before-/Afterwerte aller betroffenen Dokumente bilden genau einen AtlasHistory-Befehl. Der bestehende Prospektivvalidator prüft die gesamte Referenzclosure vor Mutation; Save/Entwurf/Discard/Recovery laufen über AtlasRepository und dasselbe Journal. Cancel und stale Source ändern nichts; fehlender Childowner blockiert Apply. Generation behandelt Gebäude mit Innenräumen als geschützt.

**Abnahme:** Zwei angrenzende Räume und zwei Geschosse an einem Haus. Wand im Erdgeschoss ändern, obere Kontur erhalten; danach getrennten Wandumfang und Gesamtskalierung prüfen. Verschieben/Drehen erhält Innenmaße. Jeden Auftrag gemeinsam rücknehmen/wiederholen, speichern und frisch öffnen; Namen, Room-/Floor-/Route-/Section-IDs, Texte und Links vergleichen. Ein Konflikt in `.city` oder `.dungeon` darf keine halbe Änderung hinterlassen. Erfordert eine fachliche Ergänzung neue native Felder, wird der betroffene Codec ausdrücklich versioniert; die erste gemeinsame Bearbeitung verwendet die vorhandenen Datenbesitzer.

## Stadtmodell und Codec

Neue Dateien: `src/features/city/model.ts`, `src/features/city/codec.ts`, gezielte Tests unter `tests/core/city-codec.test.ts`. Nur ein Import im vorhandenen Testeinstieg; keine Hostregistrierung, keine Atlasänderung, keine eigene History oder Speicherpipeline.

| Daten | Vertrag |
|---|---|
| Stadt | `kind: "city"`, `version: 1`, ID, Name, `units: "meters"`; Arrays für Straßenknoten, Straßen, Plätze, Grundstücke, Viertel und Gebäude. Kein Weltursprung, kein Atlas-Elternpfad und keine feste Kartenbreite/-höhe. |
| Kennungen | Dokument-/Element-IDs nach vorhandenem Atlasvertrag `[A-Za-z0-9_-]{1,128}`; Element-IDs innerhalb des Dokuments eindeutig. Konstruktor nimmt die Dokument-ID vom Aufrufer; Laden erzeugt keine Kennungen. |
| Straßenknoten | ID und Punkt in lokalen Stadtmetern. |
| Straße | ID, Anfangs-/Endknoten-ID, innere Verlaufspunkte und positive endliche Breite in Metern. Endpunkte werden aus den Knoten abgeleitet, nicht doppelt gespeichert. Referenzen und Nullsegmente prüfen. Unverbundene Komponenten sind kein Formatfehler; Netzplanung folgt ihren Fachregeln. |
| Platz / Viertel | ID, Name und Polygon mit Außenring und Löchern in Stadtmetern. |
| Grundstück | ID und Polygon, optional gültige Viertel-ID. |
| Gebäude | ID, Name, lokaler Grundriss mit Außenring/Löchern, Position in Stadtmetern, endliche Drehung in Radiant, positive endliche Skalierung je Achse; optional gültige Grundstücks-ID. Elternplatzierung der gesamten Stadt bleibt im Atlas. Orts-/Dungeonbindungen werden nach dem tatsächlichen HEX-Vertrag ergänzt. |

Sammlungen und Konturen müssen dichte native Arrays sein; Zusatzfelder, ausgelassene oder berechnete Einträge werden vor Serialisierung abgelehnt.

Polygonringe sind implizit geschlossen, haben mindestens drei endliche Punkte und keine wiederholte Schließkopie. Vorhandene Polygon-Topologieprüfung aus `src/geometry.ts` verwenden; keine zweite Algorithmenkopie. Für die Prüfung den Polygonursprung abziehen, ohne gespeicherte Werte zu verändern. Der vorhandene Epsilonwert `1e-9` wird ausdrücklich in lokalen Meterkoordinaten getestet; numerisch nicht prüfbare/degenerierte Geometrie wird abgelehnt. Der Codec behauptet keine Straßen-/Gebäudekollisionsfreiheit oder fertige Netzplanung.

### Umsetzung

1. `model.ts` liefert ausschließlich readonly Typen und eine Formatkonstante. Vorhandene Point-/Polygon-Typen wiederverwenden; Einheiten semantisch über den CityDocument-Vertrag festlegen.
2. `codec.ts` liefert `newCityDocument`, `parseCityDocument` und `serializeCityDocument`. Eingaben vollständig prüfen und als eigene tief unveränderliche Daten zurückgeben. Keine fremde Eingabe mutieren/einfrieren; keine Generator-, Datei- oder Hostaktion.
3. Fehlende/unbekannte Versionen, Einheiten, Felder, doppelte IDs, fehlende Referenzen und ungültige Geometrie vor Übernahme ablehnen. Auch Serialisieren validiert vor JSON-Konversion, damit unbekannte Inhalte nicht still verschwinden. Namen, IDs, Reihenfolge und materialisierte Koordinaten bleiben wertgleich erhalten.
4. Grundstück-/Viertel-/Straßenreferenzen in einem zweiten Durchlauf nach ID-Erfassung prüfen. Gebäudepose auf numerisch gültige Ergebnisse prüfen; keine implizite Winkelnormalisierung oder Neugeneration.
5. Codec-, Referenz- und Geometrieregressionen im bestehenden Testlauf prüfen.

### Prüfanforderungen

Nachweisen:

- Eine kleine Stadt mit Straße, Platz und zwei Häusern samt Grundstücks-/Viertelbezügen rundet wertgleich durch den Codec; keine Pixelgrenzen oder neu erzeugten IDs.
- Negative und große lokale Positionen, gedrehte/asymmetrisch skalierte Grundrisse und Innenhöfe behalten Meterwerte und Reihenfolge.
- Unbekannte Daten, endliche Grenzfälle, Nullbreite/Nullskalierung, doppelte IDs, fehlende Referenzen, Nullsegmente, Selbstschnitt, ungültige Löcher und nicht prüfbare Pose werden abgelehnt.
- Parser/Konstruktor liefern eigene tief gefrorene Daten; der Serializer verändert das Eingabeobjekt nicht und verliert keine unbekannten Felder durch JSON-Konversion.
- Drei Basisprüfungen und gezielte Fälle tatsächlich grün; Quell- und Testergebnisse extern dokumentieren. Daraus keine funktionierende Stadtoberfläche, gemeinsame History, Mehrdateispeicherung oder Parität ableiten.

## Stadtgeometrie und Treffer

- `src/features/city/geometry.ts`: reine `cityBuildingOutline`, mit footprint, position, rotationRadians und scale als Eingabe; Außenring und Löcher werden zuerst dimensionslos skaliert, dann gedreht und in lokale Stadtmeter verschoben. Derselbe Helfer wird im Codec und in der Szene benutzt. Die vorhandene Codecprüfung auf positive/endliche Daten und gültige transformierte Polygone bleibt bestehen. Keine Winkelnormalisierung oder Mutation der Quelle.
- `src/features/city/scene.ts`: `cityScene(document): CityScene` und `hitCity(scene, point, options): CityHit | null`. Keine Rendererinstanz oder persistente Szene. Den CityDocument-Stand zuerst mit bestehendem Codec prüfen und kopieren, daraus eigene tief unveränderliche Szenendaten ableiten. Die Szene enthält ownerId, Straßenknoten mit stabiler ID und Punkt, geordnete Shapes und belegte lokale Ausdehnung oder null bei leerer Stadt.
- Shapes enthalten eine stabile Elementadresse (`ownerId`, `kind`, `elementId`), gültige lokale Geometrie und Bounds. Polygonshapes: Viertel, Grundstücke, Plätze, posierte Hausgrundrisse mit Innenhöfen. Straßen: polyline aus referenziertem Anfangsknoten, via und Endknoten plus echte widthMeters. Keine doppelt gespeicherten Endpunkte oder neu erzeugten IDs. Straßenausdehnung umfasst die halbe Breite; Orphanknoten gehören zur ausdrücklich gespeicherten Ausdehnung, begrenzen aber keine neuen Inhalte.
- `CityBounds` verwendet endliche `minX/minY/maxX/maxY` statt einer möglicherweise überlaufenden Differenzbreite. Gepufferte Straßenbounds und gesamte Ausdehnung müssen numerisch darstellbar bleiben; kontrollierter Szenenfehler erhält das Dokument und erzeugt keine teilweise Szene. Bounds sind abgeleitete Daten, keine neue Kartengrenze oder gespeicherte Canvasgröße.
- `src/geometry.ts`: `inside` wiederverwenden. Der vorhandene Abstand zur Strecke ist aktuell viermal in Dungeonhelfern eingebettet; keinen fünften Algorithmus in CITY kopieren. Einen punktbasierten `nearestSegmentPoint(point, a, b)` extrahieren und die bisherigen nearestBuildingSegment/nearestBoundary/nearestPath/nearestEdge darauf führen. Ergebnis Punkt, t und distance; Segment nuller Länge kontrolliert als Punkt behandeln. Rechnung normalisieren, damit lange Metersegmente nicht durch dx²+dy² überlaufen. Bestehende Dungeonadressen, contour/index/at, Gleichstandsreihenfolge und geschlossene Linien bleiben erhalten.
- Tests: `tests/core/city-scene.test.ts` sowie gezielte gemeinsame Segmentregressionen im vorhandenen Geometrietesteinstieg; Testimporte erhalten. Kein Hosttest oder GUIzugriff in diesem Paket. Vollständige Dungeontests prüfen den gemeinsamen Helferumbau mit.

Codec und Szene verwenden denselben `cityBuildingOutline`-Helfer für lokale Hauspose. Der punktbasierte `nearestSegmentPoint` ist aus vier bestehenden Dungeonhelfern extrahiert; normalisierte Richtung verhindert den quadrierten Nennerüberlauf bei langen Strecken. Die ursprüngliche Residualarithmetik bleibt für die Dungeon-Gleichstandsfolge erhalten. 7525 gesicherte Vorher-/Nachhervergleiche behalten Adressen exakt, Zahlenfehler unter 4e-15. Außerhalb dieses Helferblocks ist die Dungeon-Geometriequelle bytegleich. Der native HEX-02-Regressionslauf prüft zusätzlich an einer eigenen assetfreien Dungeonkarte Kantenhover, Einfügen/Ziehen, einen Befehl, exaktes Undo/Redo, Raum-Key und Save sowie eine neue Kantenadresse nach frischem Prozess. Die proprietäre Texturmatrix bleibt mangels lokaler Original-Packdatei offen; dieser begrenzte Geometriefall schließt sie nicht. Dieser Geometrienachweis umfasst keine sichtbare Hostzeichnung, Pointerrouter oder räumliche Bindungen; deren integrierten Stand beschreibt der unten stehende E2E-01-SPACE-I01b-Anschluss.

### Treffervertrag und Zeichenreihenfolge

Die Szene sortiert ausschließlich nach festen Ebenen: Viertel, Grundstücke, Plätze, Straßen, Häuser. Innerhalb einer Ebene bleibt die Dokumentreihenfolge erhalten; die spätere Zeichnung benutzt genau diese Folge, die Trefferprüfung liest sie rückwärts. Ein später hinzugefügtes überlappendes Haus ist damit sichtbar oben und wird zuerst getroffen. Keine willkürliche Entfernungssortierung über verdeckte Flächen hinweg.

`hitCity` erhält einen endlichen lokalen Punkt und Optionen mit endlicher, nichtnegativer `toleranceMeters`, optional `includeNodes` (Standard false). Der später integrierte Router berechnet diese Toleranz aus Bildschirmradius, vorhandener Kamera und tatsächlicher Platzierung; dieses Paket erzeugt keinen eigenen Zoomfaktor. Wenn Knotenhandles ausdrücklich sichtbar sind, includeNodes true: nächster Knoten innerhalb der Toleranz zuerst; bei gleichem Abstand stabile Dokumentreihenfolge. Unsichtbare Handles dürfen nicht zufällig Häuser verdrängen.

Polygoninnere trifft nur im Außenring außerhalb der Löcher. Randtreffer auf Außen-/Lochkonturen sind bei Abstand <= Toleranz möglich; der Mittelpunkt eines größeren Innenhofs trifft das Haus nicht. Vorhandenes `inside` plus gemeinsamer Streckenabstand ergeben explizite Randsemantik, kein Dungeon-Entity-Cast oder FakeRoom. Straße trifft bei Abstand zur gemeinsamen polyline <= widthMeters/2 + Toleranz. Dieser Vertrag setzt bei der späteren Darstellung runde Enden und Übergänge voraus; andere Strokeformen brauchen eine gemeinsame Geometrieänderung, keinen abweichenden Trefferweg. Bounds erweitern die Vorauswahl um die tatsächliche Toleranz und dürfen Treffer niemals allein bestätigen.

CityHit enthält ausschließlich stabile Adresse plus bei Knotentreffer node-Kind. Keine mutable Entity, Kamera oder Kopie der aktuellen CitySource. Die Szene wird aus dem tatsächlichen History-/Vorschau-Snapshot neu abgeleitet; kein zweiter Stadtstand und keine eigene Revision. Unterdrücken, LOD und Sichtbarkeit werden erst mit dem Renderer festgelegt; Zoom löscht keine Auswahl oder Werkzeuge.

### Regressionen

1. Reale Straße, Platz und zwei Häuser mit referenzierten Knoten: Shapes behalten IDs/Reihenfolge, Straßenendpunkte und Breite. Gemeinsamer Knotenedit verschiebt alle angeschlossenen Endpunkte, Hauspose transformiert Außenring und Löcher deckungsgleich mit Codecprüfung. Posewerte und Dokument bleiben unverändert.
2. Gedrehtes/asymmetrisch skaliertes Haus: Innenpunkt, Außenpunkt, Außen-/Innenrand, Ecke und Innenhofmitte. Sehr kleine Kontur und große/negative Position. Ungültige oder kollabierte Pose wird wie im Codec abgelehnt; keine scheinbar gültige Szene aus unbekannten Feldern.
3. Straße mit Knick: Mitte, Breitengrenze, Ecke, runder Abschluss und außerhalb der Grenze. Bounds enthalten Breite. Große/negative Koordinaten; gemeinsamer Segmenthelfer nimmt keine Pixel oder Dungeonfelder an. Endlicher großer Streckenfall darf nicht durch quadrierten Nenner fälschlich t=0 ergeben.
4. Überlappende Häuser, Haus über Straße/Platz und Innenhof über sichtbarer darunterliegender Fläche: Trefferfolge entspricht Zeichenfolge. Viertel/Grundstück fallen erst nach oberen Shapes durch. Sichtbare Knotenhandles sind optional, Nähe und Gleichstände reproduzierbar.
5. Leere Stadt liefert null Ausdehnung/null Treffer; isolierter Knoten besitzt Bounds und trifft nur bei includeNodes. NaN/Infinity-Punkte und negative/unendliche Toleranz werden kontrolliert abgelehnt. Szenen/Payloads teilen keine mutable Referenz und frieren Aufrufereingaben nicht ein.
6. Gemeinsame segmentbasierte Dungeonhelfer: degenerierte Strecke, Projektionspunkt außerhalb beider Enden, reguläre schiefe Strecke, geschlossener Ring, Gleichstände und richtige at/edge/index/contour. Vorhandene Gebäude-/Portal-/Pathregressionen bleiben grün; keine fachliche Dungeonänderung aus Cityeinheiten ableiten.
   Vor dem Umbau das aktuelle Geometriemodul separat für eine externe Baselinegegenprobe sichern. Bei regulären Strecken bleiben Adressen und Gleichstandsfolge exakt; numerische Ergebnisse mit ausdrücklich dokumentierter Toleranz vergleichen, keine unbelegte bitweise Gleichheit durch geänderte Rechenreihenfolge behaupten. Lange Strecken haben eigene analytisch bekannte Erwartungswerte, die den bisherigen Nennerüberlauf aufdecken.
7. Vorläufige Anschlussgegenprobe nutzt **vorhandene** worldToScreen/screenToWorld nur auf einer ausdrücklich hypothetischen Testplatzierung, keine gespeicherte API: Bildschirmtoleranz bleibt nach Pan/Zoom proportional; die lokale Szene erzeugt keinen Kamera-/Historyeintrag. Gedrehte reale Atlasplatzierung und Haus-/Dungeonbindung bleiben bis HEX-05 unbewiesen.

## Stadtbefehle

Die vorhandene History registriert jeden Owner einmal, lädt unveränderliche Ausgangswerte mit `hydrate`, liest über `read` und übernimmt mehrere Owner atomar mit `execute`. Stale Vorherwerte, doppelte Ziele und ungültige Nachherwerte werden vor Mutation abgelehnt. Ein gültiger No-op erhält Redo. Undo/Redo und Benachrichtigungen gehören ausschließlich dieser History.

Die aktuelle API hat kein `unregister`. Deshalb erzeugt der aufrufende Besitzer genau eine CitySource je geladener Stadt und Historylebensdauer; weitere Verbraucher teilen diese Quelle. Erneutes Anlegen einer Quelle für denselben Owner ist ein Fehler und darf weder hydrieren noch laufende Änderungen ersetzen. Dieses Paket ergänzt keinen Registry-/Disposevertrag; dessen Hostlebensdauer wird bei HEX-05 integriert.

### Konkrete Umsetzung

Nur `src/features/city/commands.ts`, `tests/core/city-commands.test.ts` und der bestehende Testimport werden ergänzt. Bestehende City-/Atlasdateien bleiben unverändert.

1. `CitySource(initial: CityDocument, history: AtlasHistory)` validiert und kopiert das gesamte Anfangsdokument **vor** der Registrierung mittels `serializeCityDocument`, danach JSON-Konversion. So werden auch Zusatzfelder, Sparse-Arrays und Getter vor der normalisierenden Atlas-Konversion abgelehnt. Die Quelle speichert ausschließlich History und Dokument-ID; keine zweite Baseline oder aktuelle Geometrie.
2. Owner-Validator als private Closure prüft Target exakt `document`, vollständiges Cityformat und identische Dokument-ID. `null` ist für ein vorhandenes Stadtdokument unzulässig; Stadtanlage/-entfernung samt Atlasplatzierung ist ein späterer gemeinsamer Besitzer-/Speichervertrag. Registrierung erfolgt einmal; doppelte IDs kollidieren auch mit Terrain-Ownern. Danach genau ein `hydrate` mit dem bereits geprüften Anfangswert. Ungültige Initialdaten dürfen keine Registrierung verbrauchen.
3. `read(): CityDocument` liest ausschließlich `history.read(id, "document")` und liefert über den strikten Codec eine eigene unveränderliche Stadtkopie. Keine mutable Rückreferenz, kein Nachladen, kein neuer Historyeintrag. Das vollständige Dekodieren ist zunächst bewusst; keine ungeprüften Casts oder Cacheinvalidierung.
4. `cityDocumentChange(before: CityDocument, after: CityDocument): AtlasChange` ist rein. Beide vollständigen Snapshots werden vor JSON-Konversion geprüft und besitzen dieselbe Dokument-ID. Rückgabe ist ein tief unveränderlicher Change mit Owner-ID, Target und geprüften Snapshotwerten. Dafür die bestehende generische `immutable`-Hilfe aus `src/model.ts` auf den frisch aufgebauten Change verwenden; keine zweite Freeze-/Kopierimplementierung. Keine Ausführung, keine Labelvorgabe und kein Lesen des aktuellen Zustands. Der Aufrufer kann Stadt-/Terrainchanges zu **einem** `AtlasCommand` verbinden.
5. Der Werkzeugentwurf hält `before = source.read()` beim Beginn fest, verändert nur seine transiente Kopie und baut am Abschluss den Change mit diesem Anfangsstand. Niemals den Vorherwert beim Abschluss erneut lesen: Das würde eine zwischenzeitliche Änderung überschreiben. Cancel erzeugt keinen Change und führt keinen Befehl aus. UI/Entwurf selbst bleibt außerhalb dieses Pakets.

Die JSON-Konversion ist die eindeutige Brücke zwischen den typisierten Cityinterfaces und `AtlasValue`; kein Indexsignature-Cast direkt auf unbekannte Cityeingaben. Die gemeinsame History kopiert JSONwerte vor ihrer Ownerprüfung. Ein roh direkt eingereichter Atlasbefehl kann daher fremde Objektmetadaten schon vorher normalisieren; der Cityadapter garantiert die strikte Prüfung **an seiner Eingabegrenze**, ohne die gemeinsame History umzubauen.

### Bedeutungsvolle Regressionen

- Laden erzeugt keinen Undo-/Dirtyeintrag; Lesen ist unveränderlich und verändert die Eingabe nicht. Ungültige Initialdaten lassen dieselbe ID anschließend gültig registrieren; doppelte Registrierung kollidiert.
- Kleine reale City mit Straßenreferenzen und Hausgrundriss: Straße und Haus in einem Snapshot ändern; gemeinsames Undo/Redo stellt exakt Namen, IDs, Metergeometrie und kanonische Codecbytes wieder her. Der Adapter besitzt keine Undo-/Redomethoden.
- Changekonstruktion führt nichts aus; veränderte fremde Eingaben ändern einen bereits gebauten Change nicht. Unbekannte Felder einschließlich Arrayzusätzen werden vor Konversion abgelehnt; falsche Dokument-ID ebenfalls.
- Echter `TerrainSource` mit `newOverworld`, geladenem Zellziel und echter Cityquelle an **derselben** History: beide Änderungen in einem Befehl, genau ein Undo, exakte gemeinsame Wiederherstellung und Redo.
- Mehrbesitzer-Ablehnung bei stale City-Vorherwert und bei formatwidrigem City-Nachherwert: Terrainchange steht zuerst, beide aktuellen Werte bleiben exakt erhalten, Undo-/Redo-Zustand und Benachrichtigungen ebenfalls. Zusätzlich umgekehrte Reihenfolge mit stale Terrainwert prüfen.
- Gültiger City-No-op nach Undo erhält Redo; stale No-op wird abgelehnt. Falsches Target, fremde Dokument-ID oder `null` in einem direkt eingereichten normalen JSON-Change werden vom Owner abgelehnt.
- Zwei CityOwner an derselben History bleiben unabhängig; Change/Undo der einen Stadt verändert die andere nicht. Owner-ID-Kollision mit dem echten TerrainSource wird kontrolliert abgelehnt.

### Modulgrenzen

## Werkzeugentwurf

### Konkrete Draft-API

`CityDraft` besitzt folgende readonly Zustandszugriffe und Methoden:

| API | Verhalten |
|---|---|
| `new CityDraft(source: CitySource)` | Einmal source.read als tief unveränderlichen Gestenanfangsstand aufnehmen. State editing, keine fertige Vorschau, kein Historyeintrag. Kein erneutes Registrieren/Hydrieren. |
| `before: CityDocument` | Nur der unveränderliche Beginn. Entwurf verwendet danach niemals einen frisch gelesenen Vorherstand für Apply. |
| `state` | editing, invalid, failed, applied oder cancelled. failed ist terminal für SetEdits/Apply; Cancel darf den fehlgeschlagenen Entwurf schließen. Ein neuer Zug braucht eine neue Draftinstanz. |
| `preview: CityDraftPreview \| null` | Nur das aktuelle gültige Ergebnis, mit document und daraus berechneter CityScene. Eigene tief unveränderliche Daten. Initial, nach clearPreview, Invalidität, Apply, Fehler oder Cancel null. Keine scheinbar gültige ältere Vorschau bei neuer ungültiger Bewegung. |
| `setEdits(edits: readonly CityEdit[]): CityDraftPreview` | Immer alle finalen Edits gegen before berechnen; nicht kumulativ auf voriger Vorschau. editCity und cityScene vollständig prüfen, dann die Vorschau als eine Einheit austauschen. Fehler löscht Vorschau, setzt invalid und wirft; gültiges Folgeupdate kann invalid wieder in editing überführen. Keine Historymutation. |
| `clearPreview(): void` | In editing/invalid fertige Vorschau entfernen und editing setzen. Der Router nutzt dies bei unvollständiger Kontur oder veränderter Zeichnung, bis explizites Schließen einen vollständigen CityEdit liefert. Rohpunkte sind kein gültiger gespeicherter Stadtstand. |
| `apply(label: string): boolean` | Nur editing mit vollständiger Vorschau. Nichtleeres string-Label bis 200 Zeichen vor Befehl prüfen. cityDocumentChange(before, preview.document) als einzigen Change über source.history.execute übernehmen. Erst nach erfolgreicher Rückkehr state applied und Vorschau löschen; No-op liefert false, schließt den Entwurf und erhält Redo. Echte Precommit-Ablehnung setzt failed, löscht Vorschau und wirft. Kein Retry, Rebase oder Lesen neuer Baseline. |
| `cancel(): boolean` | editing/invalid/failed → cancelled, Vorschau null. Kein Historyaufruf, keine Rückschreibung des alten before. applied/cancelled liefern false; Cancel nach Apply ist kein heimliches Undo. |

CityDraftPreview enthält ausschließlich document und scene. Kein Pixiobjekt, Callback, Pointer, persistenter Entwurf oder Cache anderer Dokumente. Nach Apply bleibt das ausgewählte Werkzeug im Atlas unverändert; die Klasse startet keine zweite Platzierung und erstellt keine neuen Kennungen. Erneuter Aufruf von Apply oder SetEdits auf einem geschlossenen/fehlgeschlagenen Draft wird kontrolliert abgelehnt.

Die Prüfung, ob ein Draft noch bearbeitbar ist, erfolgt vor dem Update-try/catch; ein abgelehnter Aufruf auf applied/cancelled/failed darf diesen Zustand nicht in invalid umschreiben. preview=null entfernt nur das Draftoverlay: Der Renderer liest die **aktuelle** CitySource und zeichnet niemals automatisch before als zurückgeschriebenen Stadtstand. Terminale Draftreferenzen gibt der Router frei. Ein offener CityDraft besitzt genau einen temporären Subscriber an der vorhandenen AtlasHistory. Deren unveränderliches AtlasCommand-Ereignis macht jede Änderung am CityOwner sichtbar, auch bei verschachtelten Undo-/Redo-Benachrichtigungen. Apply löst den Subscriber vor dem eigenen Execute; Cancel und terminale Fehler lösen ihn ebenfalls. Timer und Pointercapture besitzt der Core weiterhin nicht; Cancel bleibt der Abschlussvertrag für einen verworfenen offenen Draft.

`AtlasHistory.notify` isoliert jetzt synchrone Subscriberfehler nach Commit und meldet sie separat; auch ein defekter Diagnosesink blockiert weder weitere Subscriber noch die Rückgabe von execute/undo/redo. Validierungs-/Stalekonflikte bleiben vor gemeinsamer Mutation werfend. subscribe reicht den bestehenden immutable AtlasCommand als zusätzliches Argument weiter; argumentlose Subscriber und die normale Benachrichtigungsreihenfolge bleiben kompatibel. Echte TerrainStroke.finish und CityDraft.apply mit werfendem Subscriber sind geprüft, ohne zweiten Commit.

### Gestenvertrag für den späteren Router

- Bei Beginn eine stabile Dokument-/Elementadresse und den CityDraft aufnehmen. Lokale Pointerwerte kommen aus dem bestätigten unproject-Vertrag. Bewegung, Drehung und Skalierung werden aus Anfangspose und aktueller lokaler Eingabe berechnet; wiederholte Pointerupdates addieren keinen Drift. CityEdit bleibt Besitzer der finalen Geometrieprüfung.
- Straßen-/Hauszeichnung behält ihre rohen endlichen Punkte in einer abbrechbaren Routervorschau. Solange nicht ausdrücklich geschlossen/abgeschlossen, keine fertige Draftpreview und kein Apply. Ein gültiger Abschluss materialisiert einen Edit mit den am Zugbeginn reservierten callerbestimmten IDs. Erneutes Ändern der Rohkontur ruft clearPreview auf, damit ein alter Abschluss nicht versehentlich übernommen wird.
- Escape, Pointerabbruch und Schließen entsorgen die Vorschau über Cancel. Zwischenzeitlich fremd geänderte CitySource wird dabei erhalten; niemals before restaurieren. Zoom/Pan löschen weder Ziel noch Werkzeug, sondern verändern nur die Aufruferprojektion.
- Ein History-Ereignis für den CityOwner während des Zugs setzt den Entwurf unmittelbar auf failed und entfernt die Vorschau sowie den Subscriber, auch wenn Undo/Redo danach denselben Dokumentstand wiederherstellt. SetEdits und Apply lehnen diesen Entwurf ab; Nutzer muss ausdrücklich einen neuen Zug beginnen. Andere Besitzer und Redo bleiben erhalten. Vollständige sichtbare Bedienung, Pointercapture und Routerereignisse sind nicht Teil dieser Coreabnahme.
- Dokumentübergreifende Gesten brauchen weiterhin einen gemeinsam gebauten AtlasCommand. Dieser Draft gilt für genau einen CityOwner; Bindungsbewegung mehrerer Dokumente wird erst am echten HEX-05-Vertrag erweitert.

### Bedeutungsvolle Prüfungen

1. Neue Draftinstanz und mehrere vollständige Vorschauupdates erzeugen keine Historyeinträge, Benachrichtigungen oder Sourceänderungen. Anfangsstand unverändert; letzter Kandidat enthält nur den finalen Meterwert, keine kumulative Drift. Ergebnis und Szene tief gefroren, fremde Payloads bleiben ungefroren und nachträgliche Mutation wirkt nicht auf die Vorschau.
2. Stadtstraße und Haus in einem Paket: ein Apply/Undo, exakte gemeinsame Wiederherstellung und Redo. Cancel vor Apply erhält alle Werte, Stack und Redo; Cancel nach Apply verändert nichts. No-op erhält vorhandenes Redo, wiederholter Apply erzeugt keinen zweiten Befehl.
3. Anfänglich unvollständiger Draft, clearPreview nach validem Abschluss und ungültige Geometrie können nicht übernommen werden. Ungültiges Update löscht die vorige Vorschau; gültiges Folgeupdate kann neu vorbereitet werden. Hauskonturabschluss und Straßenabschluss per vollständigem Edit nachbilden, keine sichtbare Pointergeste aus dieser Nachbildung behaupten.
4. Reale CitySource plus TerrainSource an derselben History: fremde Cityänderung nach Beginn verhindert das ganze City-Apply, andere Besitzer bleiben erhalten. Fremder Terrainbefehl allein macht City nicht stale; Apply folgt in derselben gemeinsamen Undo-Reihenfolge. Cancel nach Fremdänderung stellt before nicht wieder her.
5. failed/applied/cancelled sind für weitere Updates geschlossen; falsches oder leeres Label wird vor Historyaufruf abgelehnt, gültige Labels werden unverändert übernommen. Kein neu erzeugtes Source-/Dokument-/Element-ID.
6. Reproduzierte Subscriberlücke als Regression: erster Listener wirft, zweiter zählt. execute, undo und redo liefern trotzdem korrekte Ergebnisse/Werte/Stacks, alle verbleibenden Subscriber werden informiert, Fehler wird separat diagnostiziert. No-op und echte Precommit-Ablehnung benachrichtigen weiterhin nicht. Ein fehlerhafter Diagnosesink darf keine falsche Apply-Ablehnung erzeugen. Zusätzlich echter TerrainStroke.finish und CityDraft.apply mit werfendem Listener, kein nachträglicher zweiter Commit.

## Stadtgesten

### Öffentlicher Vertrag

`CityGestureTarget` ist eine readonly diskriminierte Zieladresse:

| kind | weitere Felder | Wirkung |
|---|---|---|
| move-node | ownerId, nodeId | Gemeinsamen Straßenknoten bewegen; alle referenzierenden Kanten behalten IDs. |
| move-road-point | ownerId, roadId, viaIndex | Genau einen vorhandenen Via-Punkt bewegen, restliche Straße und Endknoten erhalten. |
| move-building | ownerId, buildingId | Haus bewegen, Grundriss/Poseanteile/Verweise erhalten. |
| rotate-building | ownerId, buildingId | Um die Mitte des lokalen Außenkontur-Bounds drehen. |
| scale-building | ownerId, buildingId, axes: both/x/y | Achsenskalierung an derselben Mitte; unskalierte Achse unverändert. |

Owner muss exakt source.id entsprechen, Ziele müssen im **Gestenanfangsstand** existieren und zur Art passen. viaIndex muss eine vorhandene ganze nichtnegative Position sein. Adresse und Anfangspunkt sind eigene gefrorene Kopien; keine Callerobjekte frieren. Unbekannte Felder/Tags, falsche Kennungen, berechnete Felder und nichtendliche Punkte vor Fachzug ablehnen; Accessors nicht ausführen. Nur die schmale Ziel-/Punktgrenze prüfen, keine zusätzliche CityDocument-Validierungskopie. Vor Umsetzung vorhandene City-Eingabeprüfungen zur gezielten Wiederverwendung prüfen; keine neue allgemeine Validierungsbibliothek.

`new CityGesture(source, target, startPoint)` erzeugt einmal CityDraft, bindet dessen before und findet das Ziel einmal. Fehlende Ziele oder degenerierte Dreh-/Skalierhebel erzeugen eine verständliche Ablehnung ohne Source-/Historyänderung. Die Klasse besitzt keine eigene zweite Zustandsmaschine:

- readonly target, before, state, preview delegieren an stabile Adresse beziehungsweise den einen Draft.
- `update(point): CityDraftPreview` rechnet eine finale CityEdit aus **Anfangspose und Anfangspointer**, niemals aus dem letzten Kandidaten. Vor der Rechnung `draft.clearPreview()`: Closed-Prüfung geschieht dadurch zuerst; Rechen-/Punktfehler lassen keine vorige übernahmefähige Vorschau bestehen. Bei Rechenfehler ist editing/null ausreichend, bei editCity-/Szenenfehler invalid/null. Gültige Folgeupdates dürfen sich erholen.
- `apply(label): boolean` und `cancel(): boolean` delegieren unverändert an CityDraft. Kein Auto-Apply, Retry/Rebase, zweiter Commit oder eigener Stack. Der Router kann auf Pointer-Up ausdrücklich Apply wählen, auf Escape/Pointercancel/Blur Cancel.
- before ist genau der einmalige Draftbeginn. Der Adapter registriert/hydriert keine CitySource und erzeugt keine IDs. Mehrere Dokumentbesitzer bei späteren Gebäudebindungen brauchen einen gemeinsam gebauten AtlasCommand; nicht stillschweigend nur diesen CityOwner committen.

Zeichenaktionen bleiben vollständige `add-road`/`add-building`/`add-plaza`-Edits am vorhandenen CityDraft; rohe offene Konturen gehören zum Router und werden erst bei gültigem ausdrücklichem Abschluss materialisiert. Löschen benutzt vorhandene CityEdits und einen Draft. Diese Aktionen weder als vom Transformadapter implementiert ausgeben noch aus dem CITY-01-Umfang entfernen.

### Geometrie und natürliche Griffe

Gemeinsame Punktpose als `CityBuildingPose = Pick<CityBuilding, position/rotationRadians/scale>`, `cityBuildingPoint(pose, buildingLocalPoint)` und `cityBuildingLocalPoint(pose, cityPoint)` aus vorhandenem Hausposecode ableiten. Vorwärts bleibt Scale→Rotate→Translate, inverse Translate→inverse Rotate→inverse Scale. Positive finite Achsenskalierung, finite Pose/Punkte und finite Resultate prüfen. `cityBuildingOutline` verwendet dieselbe Vorwärtsprimitive für Außenkontur und Löcher; Codec und Scene bleiben auf demselben Helfer. Bestehende Outline-Werte und Fehlergrenze erhalten, keine separate Poseformel in gestures.ts. Private Hilfsstruktur nur bei tatsächlichem Bedarf, keine Matrixbibliothek oder gespeicherter Atlastransform.

Hauspivot: Mitte des untransformierten Außenkontur-Bounds (Innenhöfe ändern sie nicht). Mittelpunkt über halbierte Min/Maxwerte berechnen, damit ein unnötiger Min+Max-Überlauf vermieden wird. Pivot über gemeinsame Punktpose nach Citymetern transformieren. Dreh-/Skaliervorschau berechnet neue Position so, dass derselbe Pivot bei neuer Pose fest bleibt; die Verschiebung ergibt sich aus `cityBuildingPoint` mit Nullposition. Numerisch nicht darstellbare Endpose scheitert kontrolliert und löscht Vorschau. Gleicher Anfangspointer und unveränderte relevante Dreh-/Skalawerte verwenden die ursprüngliche Pose direkt; eine unnötige Pivotrückrechnung darf keinen Rundungs-No-op als Änderung übernehmen. Bei x/y gilt dies auch für Bewegung ausschließlich auf der ungewählten Achse.

- Bewegung: ursprüngliche Zielposition plus current-start. Hauspose/Skala, Knoten-/Straßenkennungen und alle anderen Punkte bleiben erhalten. Initialpunkt kann innerhalb des Hauses liegen; kein Sprung auf dessen Ursprung.
- Drehung: Anfangs-/aktueller Cityvektor um Pivot müssen finite und ungleich null sein. Winkeldifferenz aus atan2-Winkeln, periodisch normalisiert; ursprünglichen Winkel addieren. Gleicher Pointerpunkt liefert exakt unveränderte Anfangspose. Keine Akkumulation und keine Abhängigkeit vom Zoom.
- Skalierung: Anfangs- und aktuelle Pointerpunkte über gemeinsame inverse **Anfangspose** in Hauskoordinaten ausdrücken, vom lokalen Pivot abziehen. Für jede gewählte Achse Verhältnis aktueller/anfänglicher Komponente auf die ursprüngliche Achsenskalierung anwenden. Jeder benötigte Anfangshebel muss ungleich null sein; Endratio muss positiv und finite sein. both erlaubt unabhängige Achsen; x/y erhalten die andere Achse exakt. Keine Spiegelung, stille Klemmung oder Annahme, dass negative Koordinaten ungültig sind. Auf der falschen Seite des Pivots ist der Kandidat ungültig; Rückbewegung kann korrigieren.

Sichtbarer Anschluss auf dem gemeinsamen Atlasfundament: Drehgriff und Eck-/Achsgriffe bleiben in Bildschirmpixeln bequem treffbar; der Router trifft nur sichtbare Griffe und liefert das zugehörige lokale Ziel. Zahlenfelder für Position/Winkel/Meterabmessungen verwenden dieselben validierten Endedits. Keine Pflicht für Modifier-Mausrad; bessere Bedienung muss später an gepaarten Aufgaben und realer Maus-/Touchpadbedienung geprüft werden.

### Routerregeln und noch fehlende Integration

1. Pointer-Down trifft dargestellte CityScene/Griffe vor Hexhintergrund und bindet Source, Owner, Element und Werkzeug. Kein erneutes Hit-Testen auf jeder Bewegung, kein Zielwechsel beim Zoom.
2. Jeder neue lokale Punkt stammt aus der **aktuellen** gemeinsamen inverse Projektionskette. Pan/Zoom verändern die Kamera, erhalten aber Adresse/Draft und Anfangspose. Keine zwischengespeicherte zweite Kamera oder Pixel-zu-Meter-Konstante im Adapter.
3. Nach Update zeichnet der gemeinsame Detailrenderer preview.scene. preview=null entfernt Overlay und zeigt aktuelle CitySource, nie automatisch before. Meldung unterscheidet unvollständige Zeichnung, ungültige Geometrie und echten Apply-Konflikt.
4. Pointer-Up übernimmt nur gültigen vollständigen Zug einmal. Cancel/Blur/Escape verwerfen Citypreview. Terrain-Escape hat derzeit bewusst eine andere Originalwirkung (finishStroke); diese nicht pauschal für City übernehmen oder verändern.
5. Nach Apply/Cancel Werkzeug und Auswahladresse erhalten; terminale Adapterreferenz freigeben. Gemeinsames Undo/Redo bleibt derselbe AtlasHistory-Stack. Geschlossene Adapter nehmen keine weiteren Updates an.
6. Router-/Detail-Lifecycle, Sichtbarkeit/Hit-Toleranz, Capture/Focus, gemischte Owner, Parentplatzierung und Mehrdateispeicherung sind ausdrücklich echte Anschluss-/Hostarbeit. I06-Coretests behaupten dafür keine Abnahme.

### Prüfanforderungen

- Bestehenden Outlinehelfer samt Quellhash als externes Modul sichern und echte Konturwerte/Fallgrenzen vor/nach Extraktion vergleichen. Vorwärts/inverse Punktpose auf asymmetrischen, gedrehten/ungleich skalierten Häusern; Außenkontur und Hofwerte vor/nach Extraktion erhalten. Große/negative Meter, Millimetergrundriss, Überlauf und nichtendliche Werte kontrolliert. Nicht passende Dungeon-Posehelfer unverändert.
- Hausbewegung aus innenliegendem Anfangspunkt ohne Sprung/Drift; mehrere Updates letzter absoluter Wert, keine Source-/Historymutation bis Apply, ein Undo/Redo. Fremde Payloadmutation unwirksam.
- Knotenbewegung am echten T-Kreuz; Via-Punktbewegung erhält Endknoten und andere Punkte. Kollabierte Straßenlänge ungültig und alter Kandidat nicht übernahmefähig; korrektes Folgeupdate möglich.
- Drehung um tatsächlichen Hauspivot, Hof und asymmetrische Kontur bleiben metrisch korrekt; Achsenskalierung both/x/y erhält Pivot und unberührte Achse. Gleicher Anfangspunkt ist No-op und erhält Redo. Degenerierter Hebel vor Beginn abgelehnt, Gegen-/Null-/Überlaufskalierung während Zug löscht alte Vorschau.
- Ungültige Zielart/Owner/viaIndex, unbekannte Felder und Accessors vor Seiteneffekt ablehnen. Fehler bei Pointerprüfung oder Rechenphase löscht vorige Vorschau; closed bleibt closed. Cancel nach fremdem Citycommit restauriert nichts, Apply stale schließt failed; fremde Terrainaktionen bleiben in derselben Historyfolge.
- Bestehende AtlasCamera-Funktionen nur im Test: projizieren/unprojizieren bei Pan, Zoom und verschiedenen Viewports liefert lokale Eingaben für denselben gebundenen Zug. Das prüft den Adaptervertrag, keine echte Parentplatzierung oder sichtbare Kamera-/UIwirkung.

## Straßen- und Hausaktionen

### Dateien und öffentliche API

Neue Datei `src/features/city/edit.ts`, gezielte Tests `tests/core/city-edit.test.ts` und ein Import im bestehenden Testeinstieg. Keine Erweiterung des Dateiformats, keine neue History oder Kopie der Topologieprüfung.

`CityEdit` ist eine readonly diskriminierte Union. Genau eine ausführende reine Funktion: `editCity(document: CityDocument, edits: readonly CityEdit[]): CityDocument`. Sie liefert eine eigene tief unveränderliche, vollständig geprüfte Stadt; sie liest keine History und führt keinen Befehl aus. Ein Aufrufer bildet `cityDocumentChange(gestureBefore, editCity(gestureBefore, edits))` und übernimmt ihn über die gemeinsame History. Mehrere Fachaktionen eines Zugs gehören in einen Change.

| Operation | Payload und Wirkung |
|---|---|
| `add-road` | Vollständige CityRoad plus Array neuer CityRoadNode. Neue IDs kommen vom Aufrufer. Vorhandene Anschlussknoten werden referenziert, nicht kopiert. Keine bestehenden Knoten oder Kanten überschreiben. |
| `move-node` | nodeId und vollständiger Point. Ersetzt nur den Punkt dieses vorhandenen Knotens; alle angrenzenden Straßen nutzen damit denselben Endpunkt. Innere Verlaufspunkte bleiben erhalten. |
| `replace-road` | roadId und vollständige CityRoad mit exakt derselben ID. Erlaubt Breite, Innenpunkte und Anschlussreferenzen zu ändern. Nur ein vorhandenes Ziel ersetzen. |
| `remove-road` | roadId. Nur die vorhandene Kante entfernen. Nicht mehr benutzte Knoten bleiben erhalten; keine implizite Bereinigung mit Identitätsverlust. |
| `remove-node` | nodeId. Nur ein vorhandenes Ziel entfernen; verbleibende Straßen dürfen nicht darauf verweisen. |
| `add-building` | Vollständige CityBuilding mit callerbestimmter ID. Neue Kontur wird erst als gültiger, abgeschlossener Grundriss übernommen. |
| `set-building-pose` | buildingId, Point position, rotationRadians, Point scale. Ersetzt ausschließlich die Pose, erhält ID, Name, Grundriss und Grundstücksbezug. |
| `set-building-footprint` | buildingId und vollständiges Polygon. Ersetzt nur den lokalen Grundriss, erhält Pose und übrige Daten; Innenhöfe sind Teil des Polygons. |
| `remove-building` | buildingId. Entfernt nur das vorhandene Haus. Grundstück, Viertel und andere Häuser bleiben erhalten. Keine externe Dungeon-/Ortsdatei löschen. |
| `add-plaza` | Vollständige CityArea. Ermöglicht den ersten CITY-01-Platz mit gültiger Kontur und callerbestimmter ID. |

Erweiterte Bindungen und deren Schutzregeln werden nach ihrem tatsächlichen HEX-Vertrag ergänzt; das heutige Modell besitzt keine Dungeon-/Ortsbindung. Dieses Paket behauptet keine Abnahme von Löschen oder Bewegen gebundener Häuser.

### Prüfung und Atomarität

1. Den vollständigen Anfangsstand durch `serializeCityDocument` und `parseCityDocument` prüfen und kopieren **bevor** irgendein Feld ersetzt/entfernt wird. Ungültige Anfangsdaten dürfen nicht durch Löschen des fehlerhaften Elements bereinigt und dabei still verloren werden.
2. Das Operationsarray muss eine dichte native Liste ohne Zusatzfelder, Getter oder Unterklasse sein. Jede Operation besitzt exakt die Felder ihres Tags und ausschließlich Daten-Descriptors; unbekannte Tags/Felder vor Zugriff ablehnen. Neue Daten werden unverändert in den Kandidaten aufgenommen und anschließend vom bestehenden Codec vollständig geprüft, keine verlustbringende JSON-Konversion ungeprüfter Payloads.
3. ID-Ziele müssen vorhanden und vom richtigen Typ sein; fehlende Ziele liefern eine konkrete Meldung statt stiller No-ops. `replace-road` darf die ID nicht ändern. Neue Elemente dürfen keine ID aus irgendeiner Sammlung des vollständigen Anfangsstands verwenden, auch wenn ein anderes Edit das ursprüngliche Element entfernt. Diese Kennungen sind während des Pakets reserviert. Das ist Schutz der Elementidentität über den Verlauf, zusätzlich zur bestehenden Codecprüfung des Endzustands.
4. Jedes Element hat höchstens ein Schreibziel im Paket; hinzugefügte Straßen samt neuen Knoten beanspruchen alle ihre IDs. Ein zweites Edit derselben ID wird kontrolliert abgelehnt, einschließlich add/remove, remove/add, mehrfacher Pose und Pose plus Grundriss. Ein Werkzeug berechnet die gewünschte Endpose vor dem Fachaufruf, anstatt denselben Hausstand mehrfach zu überschreiben. Dadurch kann kein späteres Edit ungeprüfte neue Payloadfelder aus dem Kandidaten verschwinden lassen. Verschiedene Ziele wie Kante ersetzen und referenzierten Knoten entfernen bleiben gemeinsam erlaubt. Eine spätere kombinierte Hausaktion benötigt einen ausdrücklich geprüften Vertrag, keinen stillen Mehrfachschreibweg.
5. Alle Edits sequenziell auf einem nur lokalen Kandidaten anwenden, dann **einmal abschließend** den gesamten Kandidaten codecvalidieren und kopieren. Keine Historymutation und kein Einfrieren fremder Eingaben. Ein Fehler an beliebiger Stelle liefert keinen Zwischenstand. Eine ausdrücklich geplante Knotenentfernung plus Kantenänderung ist im selben Paket erlaubt, wenn der Endzustand referenziell gültig ist; Referenzen nicht schon nach jeder Einzelaktion prüfen. Keine Kopie der Codec-Geometrie-/Referenzprüfungen.
6. Endwerte aus Payloads und Anfangsstand dürfen mit dem Aufrufer keine mutable Referenz teilen. Leere Editliste liefert wertgleichen eigenen Stand. Keine neue ID, Sortierung, Winkelnormalisierung, Knotenverschmelzung oder automatische Hausregeneration. Straßen-/Hausüberlappung und automatische Netzplanung sind spätere Fachregeln, keine bereits belegte Leistung dieses Codecs.

### Regressionen und Fachreview

- T-Verzweigung: einen gemeinsamen Anschlussknoten bewegen, alle drei Kanten behalten seine ID und nutzen den neuen Punkt. Negative Meterpositionen und frei editierter Verlauf; IDs/Reihenfolge der unbeteiligten Elemente erhalten.
- Straße mit callerbestimmten neuen Knoten ergänzen und mit vorhandener Straße verbinden. Breite/Verlauf/Anschluss ersetzen; ein gemeinsamer Historyeintrag, exaktes Undo/Redo der gesamten Stadt. Nullsegment, fehlender Anschluss und doppelte ID einschließlich Haus-/Straßenkollision abgelehnt.
- Referenzierten Knoten allein entfernen wird abgelehnt; Kante entfernen/ersetzen plus Knoten entfernen im selben Paket mit gültigem Endzustand gelingt. Fehlende und falsch typisierte IDs werden nicht still übergangen. Orphanknoten ohne explizite Aktion bleiben erhalten.
- Haus verschieben, drehen und asymmetrisch skalieren: lokaler Grundriss/Innenhof, Name, Grundstücksbezug und ID wertgleich. Grundriss ersetzen erhält Pose. Haus entfernen erhält fremde Elemente und Grundstück/Viertel. Millimeterkontur, große/negative Position, ungültige oder numerisch kollabierte Pose abgelehnt.
- Platz und zwei Häuser auf einer kleinen Straße anlegen; kanonischer Codecroundtrip mit gleicher Reihenfolge und IDs. Hauskontur mit Selbstschnitt/ungültigem Loch, Nullskalierung und unbekannte Payloadfelder abgelehnt.
- Eingabestand und alle Payloads bleiben ungefroren und unverändert. Nachträgliche Mutation fremder Eingaben ändert das Ergebnis nicht; Ergebnis tief gefroren. Ungültige Anfangsdaten bleiben auch bei entfernender Aktion abgelehnt.
- Sparse-/Accessor-/Zusatzfeld-Operationslisten, unbekannte Tags/Shapes und ID-Wechsel ablehnen; Getter darf nicht aufgerufen werden. Fehler im zweiten Edit veröffentlicht keinen ersten Edit. Leerpaket wertgleich; gemeinsamer No-op erhält Redo.
- Doppeltes Schreibziel, add/remove und remove/add derselben Kennung werden abgelehnt; eine neue Straße darf die ID eines im Paket entfernten Hauses nicht übernehmen. Neue ungültige Payload darf nicht durch spätere Ersetzung/Entfernung aus der Prüfung verschwinden. Kantenänderung und Knotenentfernung mit unterschiedlichen IDs bleiben im selben Paket möglich.
- Mit realer CitySource/AtlasHistory prüfen: ein Paket aus Straßen- und Hausänderung ist ein Undo; konkurrierende Änderung nach Gestenbeginn verhindert die gesamte Übernahme, ohne anderen Besitzer zu verändern.

## Stadtzeichnung

### Renderer-Vertrag

Neue src/features/city/renderer.ts und tests/core/city-renderer.test.ts; nötiger Import im vorhandenen Testeingang. Keine Änderungen an Atlasdateien. CityRenderer besitzt einen Container mit Basis- und Auswahlgraphics, ausschließlich aus vorhandenem Pixi 8.22.0. Keine Application, DOM-Ansicht, Kamera, History, persistente Placementkopie, Subscription, Timer oder LiveScene/SceneClock.

Geplante lokale Signatur: draw(scene: CityScene, project: (point: Point) => Point, options?: { selection?: CityHit | null; showNodes?: boolean }): void; readonly container; clear(); destroy(). Der Aufrufer liefert bei jedem Zeichnen aktuelle Scene oder preview.scene und die affine Komposition aus echter Atlas-Kamera und Platzierung. Der Callback wird nicht gespeichert. Bei nullPreview zeichnet der spätere Atlasrouter die aktuelle Source, niemals den alten Gestenanfang. Diese lokale Signatur ersetzt keinen bereits gelieferten Framevertrag.

Die Scene-Reihenfolge Viertel→Grundstück→Platz→Straße→Haus und Dokumentreihenfolge bleiben unverändert. Polygonpunkte samt Innenhöfen stammen ausschließlich aus CityScene, einschließlich bereits angewandter Hauspose. Keine separate Treffergeometrie. Erst Außenkontur füllen, dann alle Innenhofringe in EINEM gemeinsamen aktiven Pfad sammeln und EINMAL cut() aufrufen, danach Außen-/Innenringe umranden. Installiertes GraphicsContext.cut() betrachtet bis zu zwei letzte Anweisungen: wiederholte cuts auf dieselbe Füllung könnten vorige Geometrie schneiden. Ein Cut pro Füllung verhindert diese Falle; Mehrhofregression Pflicht.

Straßen folgen der Hitgeometrie: Vereinigung aus Segmentvierecken mit halber Meterbreite und runden Scheiben an jedem Stützpunkt. Segmentnormalen werden mittels Math.hypot gebildet, ihre vier lokalen Ecken durch project abgebildet. Jede Scheibe nutzt projizierten Mittelpunkt und projizierte lokale X-/Y-Radiuspunkte als sechs Werte eines temporären GraphicsContext.setTransform; circle(0,0,1) zeichnet den affinen Kreis. save/restore kapseln den Zustand. Dies ist eine Renderprimitive, keine gespeicherte Platzierung. Opaque Straßenfüllung verhindert dunklere Überlappungen. Gleichförmige und gedrehte anisotrope Projektion prüfen; keine zweite pixelsPerMeter-Annahme oder fest begrenzte Polygonkreis-Tessellation.

Alle projizierten Punkte und abgeleiteten Differenzen müssen finit sein, Eingaben bleiben unverändert. Zwei neue GraphicsContexts werden vor Veröffentlichung vollständig aufgebaut. Erst danach beide Graphics-Kontexte austauschen und alte eigene Kontexte freigeben. Bei Projektions-/Aufbaufehler neue Kandidaten freigeben, bestehende Cityzeichnung leeren und kontrolliert werfen: keine halbe oder stale Vorschau. clear entfernt nur Zeichnung; destroy ist idempotent und zerstört ausschließlich eigene Ressourcen. Kein gemeinsames Asset, Parent oder Application wird zerstört. Nach destroy ist draw kontrolliert abzuweisen.

Auswahl bleibt beim Atlas: fremder owner oder fehlendes Element bedeutet keine Hervorhebung. Keine Auswahlmutation. Passende Polygonkonturen erhalten stärkere Bildschirmumrandung; Löcher bleiben frei. Straßenauswahl markiert die editierbare Referenzlinie mit 2px, damit die vereinigten Kappen keine inneren Auswahlnahtlinien erhalten. Knoten nur bei showNodes:true als feste Bildschirmgriffe (Radius etwa 5px), stabile IDs und passende Auswahl. Der Atlas muss includeNodes bei Hitprüfung entsprechend Sichtbarkeit setzen. Via-, Dreh- und Achsgriffe sowie Pointercapture werden später mit dem Router angeschlossen; Knotendarstellung ist keine vollständige Werkzeugoberfläche.

### Darstellungsplan und Kritik vor Code

Kartografische Lesbarkeit im bestehenden Landschaftsraum: Straßen #D3D5CF, Plätze #98A6AD, Dächer #5B7287, Konturen #273C4A, Viertel #8CAFA1, Auswahl #E7B24E. Viertel/Grundstücke transparent, Dächer und Straßen deckend. Konturen etwa 1px, Auswahl etwa 2px; keine Mindesthausgröße, die Treffer und echte Kontur auseinanderzieht. Auswahl unterscheidet sich auch durch Linienstärke.

Layout ist die bestehende Atlasfläche: Landschaft → Citybasis → Auswahl/Griffe. Keine eigenen Kartenrahmen, Panels oder Hintergrundfüllung. Typografie erbt für spätere Beschriftungen die vorhandene Obsidian-UI; dieser Beitrag zeichnet noch keinen Text. Innenhöfe zeigen wirklich Landschaft/Platz/Straße darunter. Ruhige kühle Bausteine und gezielte Auswahlfarbe dienen der Stadtbearbeitung. Die Kritik gegen den Auftrag verwirft dekorative Dachtexturen und eigene UI in diesem Paket; ihre spätere CITY-07-Abnahme bleibt erforderlich. Grafikgleichwertigkeit und bessere Bedienung sind erst mit echten Original-/Hostsequenzen belegt.

### Prüfanforderungen

I07: npm run check, npm test, npm run build plus gezielte Regressionen. R11 liest die Umsetzung gegen diesen Plan und prüft Gegenfälle unabhängig von der Produktionsberechnung. Pflichtfälle: echte GraphicsContext-Anweisungen in Scene-Reihenfolge; projizierte Konturen; mindestens zwei Löcher ohne Änderung vorheriger Füllung; Straßenbreite/-kappen unter affine Rotation und Achsenskalierung; feste Pixelgriffe; fremde/fehlende Auswahl; leere Scene und verwaiste Knoten; ungültige Projektion/werfernder Callback ohne stale Frame; wiederholtes draw/clear/destroy ohne eigene Ressourcenreste.

Echte CityDraft-Vorschau/Cancel/Apply durch die Zeichnung führen und Source/AtlasHistory-/Terrainwerte auf Unverändertheit beim draw prüfen. Kontextanweisungen sind Kernnachweise, kein Pixel-/Hostbeweis. Spätere echte Pixi-/Obsidianzeichnung, Höfe über Landschaft, Zoom, Hauspose, Griffzug, Undo/Redo, Save und frischer Prozess ausschließlich im isolierten Testvault.

### R11: numerischer Pflichtbefund

CITY-RENDERER-R11-01: Eigene Modulgegenprobe akzeptiert eine gültige 0.01m-Straße bei lokalem X=10^16, caller project=(1000*(x-origin),1000*y). Erwartete 5px-Radiusachsen, tatsächlich (0,0)/(0,5). Addition des Radius an die große lokale Position rundet vor Projektion weg. Segmentnormaloffsets sind für entsprechend große lokale Achsen ebenfalls betroffen. Die aktuellen fünf Regressionen erfassen diesen Fall nicht. Beleg außerhalb Repo: r11-numeric-probe.json und eingefrorenes r11-module.cjs in city01-renderer-20261009. Kein Reviewpass.

Geplante N08: innerhalb des bestehenden affinen project-Vertrags lokale Achsrichtungen mittels darstellbarem Probeabstand um einen Straßenpunkt bestimmen; durch tatsächlichen Meterabstand teilen und gewünschte Offsetlänge erst im Bildschirmraum anwenden. Probeabstand hängt auch von der Eingabeauflösung ab; Überlauf weicht auf die Gegenrichtung aus, unauflösbare/ungültige Proben werfen kontrolliert. Segmentvierecke nutzen projizierte Mittellinienpunkte plus dieselben abgeleiteten Normaloffsets; Kappen dieselben Radiusachsen. Keine gespeicherte Matrix/Kamera oder neue gemeinsame API. Gezielt große X/Y-Positionen, Rotation, anisotrope Projektion, kleine Breite, unveränderte Scene/History und Failurecleanup prüfen. R12 prüft gegen unabhängige affine Sollwerte; voller Host-/Großkartenbeleg bleibt offen.

N08 ist implementiert: radiusVector wählt max(1m, Radius, 16*EPS*abs(Achskoordinate)) als darstellbaren Probeabstand, bei positiver Additionüberlauf die Gegenrichtung. Der tatsächlich repräsentierte Achsdelta bestimmt das Verhältnis Radius/delta. Projizierter Probedelta mal Verhältnis liefert die Radiusachse; Segmentnormalen kombinieren dieselben Radiusachsen an projizierten Endpunkten. Ausschließlich temporäre Renderwerte pro draw, keine allgemeine Platzierungskopie. Nullradius/Null-Projektionsachse und nichtfinite Werte werden kontrolliert abgewiesen. Vorhandene Polygonkonturen, Auswahl und API bleiben erhalten. Ursprüngliche Modulgegenprobe ergibt nun beide5pxAchsen;2neueTests prüfen9Koordinaten-/Matrixfälle sowie MAX_VALUE-Fallback/Failureclear. 354Tests/check/build bestanden; R12 steht aus, kein universeller Floatbeweis oder Hostnachweis.

R12 lokaler Abschluss:540unabhängigeaffineSollfälle/max3.638e-12px,4Mehrhofebenen/100Frames/200Dispose bestehen. R11-01 im lokalenRendererScope geschlossen. Gegenproben/Quellreview ergänzen die354Tests; kein fremderReviewer, universeller Float-/Pixel-/Hostbeweis. API unverändert. Reale Atlaszeichnung, Router, Platzierungen und Save/fresh bleiben vorCITY01-Abnahme erforderlich.

## Atlasanschluss

### Umfang und Beleggrenze

CITY-00-I39 erstellt den konkreten Anschlussplan aus der aktuellen Quelle. Er ersetzt keine Produktimplementierung oder HEX-05-Abnahme. Maßgeblich bleiben [Stadt-Roadmap](ROADMAP-CITIES.md), [Gesamtplan](ROADMAP-CITIES-IMPLEMENTATION-PLAN.md), `acceptance.json.cityPlans` und [Architektur](ARCHITECTURE.md). Vollständige Parität aller drei Programme bleibt CITY-09-Pflicht.

Quellstand und Hashes der ursprünglichen Anschlusstabelle stehen im externen Audit `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-i39-integration-20261009/source-audit.json`. Die Tabelle ist dieser historische Entwurfsvergleich. Aktuelle Anschlüsse im Checkout prüfen: `atlas-history.ts` und `spatial-storage.ts` liefern gemeinsame History/Persistenz; `atlas-editor.ts` verwendet CityGesture, `spatial-canvas.ts` CityRenderer. Diese vorhandenen Anschlüsse weiterverwenden. Offene Produktnachweise stehen im [Atlasstand](ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick) sowie in [#92](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/92), [#127](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/127) und [#149](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/149); ein vorhandener Anschluss ersetzt keine CITY-01-Abnahme.

CITY-01 umfasst CTY-001.01, CTY-002.01 und CTY-002.02: native Stadt am gespeicherten Ort, Straße zeichnen/ziehen/ergänzen/rücknehmen, Häuser auswählen/verschieben/skalieren/drehen/entfernen, Platz und zwei Häuser. Kamera, Auswahl, Werkzeug und History bleiben beim Zoom erhalten. Stadtfläche darf wachsen; keine feste Leinwand begrenzt die Daten.

### Stadtanteil und ursprüngliche Modulverträge

`src/features/city/model.ts` definiert ein versioniertes CityDocument mit stabiler Dokument-ID und lokalen Meterkoordinaten. Keine Pixel und keine zweite Kopie der Atlasplatzierung. Straßen besitzen Knoten und Kanten mit stabilen IDs, Endknotenreferenzen, editierbarem Verlauf und positiver Meterbreite. Plätze besitzen gültige Konturen; Gebäude besitzen lokale Kontur/Platzierung und stabile IDs. Vorgesehene Grundstücks-/Vierteldaten und optionale Orts-/Dungeonreferenzen dürfen spätere Generatorphasen erweitern; CITY-01 erzeugt keine Pflichtdatei für jedes namenlose Haus.

`src/features/city/codec.ts` liest/serialisiert ausschließlich dieses native Format. Vor Übernahme werden Version, endliche Koordinaten, ID-Eindeutigkeit, Referenzen, Konturen, positive Breiten/Skalen validiert. Das derzeitige Stadtformat besitzt keine Dokumentpfadfelder. Unbekannte inkompatible Daten bleiben unverändert erhalten und führen zu einer verständlichen Meldung. Laden liest materialisierte Geometrie; kein Generator, kein neuer Seed, keine ersetzten IDs. Umbenennung ändert weder IDs noch räumliche Bindungen.

`src/features/city/commands.ts` besitzt bereits die reine, separat reviewte CitySource und cityDocumentChange: aktuelle Werte ausschließlich in der gemeinsamen AtlasHistory, vollständige geprüfte Vorher-/Nachher-Snapshots unter Dokument-ID/Target `document`. Veraltete Vorherwerte verhindern den Commit; eine zusätzliche Cityrevision wird nicht gespeichert. Der Werkzeugzug muss den Stand vom Beginn festhalten. Die folgenden reinen Fachaktionen sind in city/edit.ts mit editCity/CityEdit implementiert und im gemeinsamen Atlas angeschlossen: Knotenbewegung aktualisiert alle referenzierenden Straßenkanten gemeinsam; Kanten teilen Anschlussknoten statt fast gleicher Punktkopien. Straßenergänzung erzeugt gültige Knoten-/Kantenreferenzen. Gebäudezug/-drehung/-skalierung ersetzt nur die betroffenen Geometriewerte; Entfernen validiert abhängige Referenzen. Der gemeinsame Atlasbefehl enthält vollständige Vorher-/Nachherwerte und geänderte Dokumentadressen. Bestehende fremde Keys, Dokumente und IDs bleiben erhalten. Der [Befehlsplan](ROADMAP-CITIES-IMPLEMENTATION-PLAN.md#stadtbefehle) beschreibt die tatsächlich geprüfte Modulgrenze; daraus folgt keine Werkzeug-/Host-/Speicherabnahme.

`src/features/city/scene.ts` liefert bereits den separat reviewten lokalen Meter-Core mit cityScene/hitCity, gemeinsamem Hausposehelfer und stabilen Treffern. Der [lokale CityGesture](ROADMAP-CITIES-IMPLEMENTATION-PLAN.md#stadtgesten) ist implementiert und reviewt; Haus/Knoten/Via, pivotfeste Drehung und Achsgriffe verwenden denselben CityDraft und gemeinsame Posepunkte. Pixi-/Atlaszeichnung und Routerverdrahtung verwenden die vorhandenen gemeinsamen Anschlüsse: dieselben Konturen für Rendern, Trefferprüfung und Vorschau; Griffe mit Bildschirmtoleranz, Geometrie in Metern. Die invers komponierte Platzierung liefert lokale Punkte auch bei gedrehter Stadt. Ein laufender Zug behält Element, Werkzeug und Dokumentbesitzer, unabhängig von Zoom-/Detailstufe. Auswahl ist eine Dokument-/Elementadresse; sie wird durch einen Sichtbarkeitswechsel nicht gelöscht. Kollidierende Straßen-/Hausänderungen werden vor Apply sichtbar erklärt, nicht stillschweigend als gültig übernommen.

`src/features/city/draft.ts` liefert bereits den separat reviewten transienten CityDraft: ein fester Anfangsstand, genau eine vollständig geprüfte document/scene-Vorschau, clearPreview, Cancel ohne Wiederherstellung alter Daten und ein Apply an derselben AtlasHistory. Ungültige Updates löschen alte Kandidaten, echte Konflikte schließen failed ohne Retry; closed bleibt closed. Der [Draftplan](ROADMAP-CITIES-IMPLEMENTATION-PLAN.md#werkzeugentwurf) beschreibt den Core und seine Regeln für die sichtbaren Gesten; die tatsächlichen Bedienbelege bleiben gesondert benannt. Der gemeinsame Router liefert lokale Punkte, hält rohe offene Konturen und gibt terminale Draftreferenzen frei. Bei nullPreview zeichnet er den aktuellen Sourcezustand. Synchrone Historyobserverfehler machen einen bereits übernommenen Befehl nicht nachträglich ungültig.

Die manuelle Hauskontur bleibt bis zum gültigen Schließen ein abbrechbarer Entwurf; das fertige Polygon wird als ein Atlasbefehl übernommen. Verschieben/Drehen hält die bekannte Dokument-/Elementadresse und lässt nach Abschluss das gewählte Werkzeug aktiv. Skaliergriffe und numerische Meterwerte bieten einen direkten Weg ohne zwingende Modifier-Mausradgeste. FTG-I40 belegt Zeichnen, sichtbare Pose und Entwurfsabbruch; die dort angebotene Strg-Mausrad-Skalierung ist noch ohne Wirkungsprobe.

Hostintegration verwendet den gelieferten Atlas-Dokumentresolver und die registrierten gemeinsamen Befehle. „Stadt hier anlegen“ erzeugt CityDocument und Elternplatzierung als einen rücknehmbaren Auftrag. Save nutzt denselben konsistenten Snapshot beider Besitzer. Es gibt keine isolierte persistente Stadt-Kamera, keine eigene Undo-Liste und keinen Zoomschalter für Stadtwerkzeuge.

### Geometrie wiederverwenden, Einheiten prüfen

`src/geometry.ts` besitzt bereits die punktbasierten Helfer `rectangle`, `inside` und `overlaps`. CITY prüft sie zuerst auf dieselbe Meter-/Kontursemantik; eine weitere Kopie dieser Algorithmen ist nicht vorgesehen. `inside` besitzt keine ausdrückliche Behandlung von Randpunkten und `overlaps` prüft nur inklusive Bounding-Box-Überlappung. Sie allein beweisen keine gültige Straße-/Hauskollision oder Polygon-Topologie.

`assertBuildingTopology` prüft zwar Konturen und Löcher, verwendet aber die feste Koordinatentoleranz `topologyEpsilon = 1e-9` und Building-spezifische Fehlermeldungen. Vor gemeinsamer Nutzung müssen Metermaßstab, Randfälle und sehr kleine/große Konturen geprüft und gegebenenfalls ein hostneutraler Kern mit expliziter Toleranz herausgezogen werden. `buildingEllipse` bemisst seine Segmentzahl anhand der Koordinatenspanne; Dungeon-Feldwerte dürfen nicht unverändert als Stadtmeter wirken. `moveEntity`, `hit`, Portalanker und `entityBounds` bleiben Dungeon-Adapter. Gemeinsame reine Geometrie wird bei Bedarf zusammen mit ihren Regressionen extrahiert; bestehende Dungeonwirkungen werden dabei erhalten. Kamera/Platzierungstransformationen stammen weiter ausschließlich aus dem gelieferten Atlasvertrag.

### Vollständiger Nutzerablauf

1. Vorhandene gemeinsame APIs und Modell-/Codec-/Befehls-, Gesten- und Rendererkerne verwenden. Region → Hex → Orts-Key → Dungeonraum/Key → zurück → Undo/Redo → Save → frischer Prozess und GM-UX-N-004 am realen Host prüfen.
2. Stadt am gespeicherten Ort anlegen → Straße/Platz/zwei Häuser bearbeiten → gemeinsames Undo/Redo → Save → frischer Prozess. Fehlende Router-/Toolbaraktionen einschließlich Verschieben, Skalieren, Drehen und Entfernen ergänzen. Vorschau/Cancel, Topologie, stale Änderungen und Referenzschutz prüfen.
3. Native Anlage/Dateiauflösung und Draft/Save/Recovery vervollständigen. Unterbrochene Anlage hinterlässt weder verwaiste Platzierung noch verlorene Datei. Externe Änderungen an World oder City sperren überholte Writes; Recovery überschreibt keine fremden Änderungen.
4. Die drei CITY-01-Fälle und Datenhaltung im isolierten Host prüfen; Installation separat mit Sicherung und installiertem Build nachweisen.

### Konkrete Abnahmesequenzen

| Pflicht | Sequenz / erwarteter Nachweis |
|---|---|
| CTY-001.01 | Auf Regionsebene Ort wählen; dort `.city`, Straße, Platz, zwei Häuser erstellen. Meterwerte und IDs sichern. Hinaus-/hineinzoomen, Stadt jenseits bisheriger Ausdehnung erweitern, speichern. Frischer Prozess lädt dieselben Dokument-IDs, Platzierung und materialisierte Geometrie. Gedrehte/verschobene Atlasplatzierung zusätzlich prüfen. |
| CTY-002.01 | Straße mit gemeinsamem Anschlussknoten zeichnen, Knoten ziehen, Straße ergänzen; beteiligte Kanten bleiben angeschlossen und Häuser unverändert. Pro abgeschlossener Geste ein Undo/Redo; Cancel, Blur und Pointer-Cancel ändern weder dauerhaftes Dokument noch Dirty/History. Ungültiger Anschluss/Kollision wird erklärt. |
| CTY-002.02 | Haus auswählen, verschieben, skalieren, drehen, entfernen; jeden Schritt rücknehmen/wiederholen. Das zweite Haus und fremde Texte bleiben unverändert. Pan/Zoom/Resize und Detailgrenze während aktiver Auswahl und laufendem Zug prüfen; kein anderes Ziel und keine zweite Historie. Save/Neustart bestätigt Endwerte. |
| Gemeinsame Speicherung | Neue Stadt samt Elternplatzierung, normale Änderung und gespeicherter Entwurf. Fehler nach jedem Journalschritt; erneutes Öffnen, Recover, Konflikt in `.city` und `.overworld` sowie Dateinamenskollision. Rohdateien/Revisionen vor und nach sichern. Weder teilweise Übernahme noch fremde Überschreibung als Erfolg melden. |
| Vergleich und Bedienung | CO-FTG-0015: direkte Straßen-/Hausbearbeitung; CO-COK-0006: Save/frisches Open; CO-COK-0007: Undo/Redo. Vorhandene Originalbelege verwenden, Umfang getrennt halten. Beide gestoppten COK-Undo-Hypothesen bleiben offen; erneute Probe braucht konkrete neue Evidenz. Gepaarte Bedienaufgaben/Schritte/Zeit/Fehlversuche und physische Maus-/Touchpad-Bedienung getrennt vom synthetischen Hostlauf prüfen. |

Produktänderungen verlangen `npm run check`, `npm test`, `npm run build` und gezielte Regressionen für die oben genannten Risiken. Grüne Codec-Tests ersetzen die gemeinsame Hostfolge nicht. CTY- und CO-Einträge bleiben bis zu passender tatsächlicher Evidenz offen.

## Integrationsanforderungen

### Konkrete Integrationsfolge

1. HEX-03 liefert stabile Orts-/Weltplatzierung und deren gemeinsam journalisierte Speicherung; HEX-04/05 liefert die tatsächlich vereinbarte Welt-/Lokalabbildung und denselben Frame-/Pointerbesitz für Dungeon und Stadt. City erfindet keine zweite Placementdatenhaltung.
2. Atlas hält CitySource und CityRenderer für die Lebensdauer des geladenen Stadtbesitzers. Quelle einmal in derselben History registrieren, Rendercontainer einmal an detailLayer hängen. Nie im Zeichenframe neu registrieren/hydrieren. Fremde oder kollidierende Kennung sichtbar ablehnen; vorhandene fachliche IDs nicht still umbenennen.
3. Im vorhandenen `draw` **vor** `application.render()` die aktuelle Szene oder gültige Vorschau mit der Platzierung und aktuellen Kamera/Viewport zeichnen. Nachgeschaltetes `changed()` ist dafür zu spät. Kein eigener RAF und kein gespeicherter Kameracallback im CityRenderer. Pan, Zoom, Resize und Historyänderung benutzen denselben Frame.
4. Vor Beginn der Stadtgeste wandelt der Atlas Pointer → Viewport → Welt → Stadtmeter um und bindet Source, Ziel-ID sowie Anfangspointer. Aktueller gemeinsamer Router führt Updates, Apply oder Cancel aus. CityGesture verändert Werkzeugwahl/Capture nicht. Trefferreihenfolge folgt sichtbarer Ebenenreihenfolge; Höfe bleiben transparent. Zwischen Hex, Stadt und Dungeon keine Kontext-/Betretenaktion.
5. Ein erfolgreicher Apply geht durch dieselbe History und bestehende Persistenzqueue. Die noch zu erweiternde gemeinsame Snapshot-/Entwurf-/Journalstrecke muss Stadtdatei und Platzierung zusammen erfassen, Konflikte vor Schreiben prüfen und frische Wiederherstellung ermöglichen. Kein lokaler Stadt-Autosave neben dem Atlasjournal. Undo/Redo und Discard erhalten Stadtbesitzer/Dateien genauso wie Terrain.
6. Flush/Save/Sourcewechsel beenden ausstehende Gesten mit ausdrücklich vereinbarter Policy. Aktuell schließt Terrain bei pointercancel/blur via finishStroke ab; CityDraft.cancel schreibt nichts. Diese unterschiedlichen Regeln dürfen nicht unbemerkt vermischt werden. Danach Capture lösen, Vorschau/Quellenbindungen entfernen und CityRenderer vor dem übergeordneten Application-Destroy genau einmal freigeben. Späte Lade-/Speicherantworten dürfen den neuen Sourcezustand nicht verändern.

### Im HEX-04/05-Plan gemeinsam festzulegen

Platzierungsbesitz und validierte Transformation; Zeitpunkt des Detailzeichnens vor Render; Auswahl-/Trefferpriorität und meterbasierte Toleranz aus Bildschirmabstand; Lebensdauer geladener Owner; gemeinsame Gestenabschluss-/Cancelpolicy; vollständige City-/Placement-Snapshot-, Journal-, Discard- und Konfliktwiederherstellung. Es existiert derzeit kein zugesagter Frame-Subscriber/Cityhitrouter. Bei nicht gleichförmiger affiner Platzierung genügt ein einzelner lokaler Kreisradius nicht für exakte konstante Bildschirmtoleranz; dies muss am tatsächlichen Transformvertrag gelöst werden.

### Abnahmefolge nach Anschluss

Native Stadt am Ort mit Straße, Platz und zwei Häusern anlegen; Straße/Knoten und Haus bewegen, drehen und skalieren; Cancel/No-op/Stale prüfen. Zwischen Stadt und Hex zoomen und bearbeiten, gemeinsame Undo/Redo-Folge, Save und frischer Prozess. Hausbindung und Dungeon-/Keyfolge anschließend in CITY-03. Viewportresize, große Weltposition, lokale Metergeometrie, Höfe und Breiten bleiben deckungsgleich. Unterbrochener Mehrdateisave, fremde Bytes und Sourcewechsel gehören zur Persistenzabnahme. Keine eigene zweite Editorinstanz; isolierte Testregion verwenden und aktive Hosts schützen. Lokale Unit-/Rendererprüfungen ersetzen diese Hostfolge nicht.

### Nachbesserung N01 aus R01

- **R01-01, relative Koordinatenkomposition:** Vorwärtszeichnung muss lokale Stadtmeter erst nach Bildung des kamera-/platzierungsrelativen großen Offsets addieren. Beim Pointerweg darf keine kleine Bildschirmverschiebung erst zu einer großen absoluten Weltkoordinate addiert und anschließend der Platzierungsanker abgezogen werden. Die konkrete gemeinsame Transformfunktion bleibt HEX-04/05-Besitz. Keine zweite Kamera, kein getrennt gespeichertes City-Weltkoordinatenmodell. Gegenprobe: Weltanker/Kameramitte1e16, .01m/Pixel, lokaler Punkt(.01,.01) muss1px Verschiebung ergeben und wieder in denselben lokalen Punkt umkehrbar sein. Rotation, Größenwechsel, große entfernte Platzierungen und unauflösbare Eingaben zusätzlich prüfen. Eine generische absolute worldToScreen-Komposition reicht dafür nicht.
- **R01-02, gültige Placement-/Entwurfsstrecke:** `OverworldDocument.placements: never[]` und `parseOverworld` lehnen derzeit belegte Platzierungen ab. `AtlasDraft.sameWorld` lässt gegenüber der Basis nur Chunkänderungen zu. HEX-03/04 muss ein explizit validiertes neues natives Placement-/Entwurfsschema einschließlich Versionsentscheidung bereitstellen. Unbekannte Formate erhalten und sichtbar abweisen; keine stillen Felder anhängen. CITY speichert Stadt- und Placementänderungen erst über die gemeinsam erweiterte Snapshot-/Journalstrecke. Tests müssen Platzierungsanlage/-verschiebung, unterbrochenes Journal, Discard und frisches Laden tatsächlich abdecken.
- **R01-03, gemeinsames Einpassen:** Die belegte Ausdehnung für Fit kommt aus Terrain sowie sichtbaren geladenen Stadt-/Dungeoninhalten und ihren tatsächlichen Weltbindungen. Stadt-only, weit entfernte Stadt und leere Szene sind explizite Fälle. `CityScene.extent === null` trägt keine falschen Ursprungspunkte bei; vorhandene Szenengrenzen werden über die vereinbarte Platzierung abgebildet. Kein privater City-Fit und keine Kameraverlagerung beim bloßen Zoom-/Detailwechsel. Große Grenzen müssen in der gleichen präzisen relativen Abbildung verarbeitet werden.

Diese Anschlussanforderungen beschreiben Zielverträge; sie belegen noch keine implementierten Shared-APIs oder sichtbare Produktfunktion.

## Ziele im Atlas-Dock

Ort auswählen → im vorhandenen Dock benannte Ziele sehen → „Stadtplan öffnen“,
ein Haus oder einen Raum auswählen → der Atlas navigiert im selben Canvas zu dessen
Geometrie/Key. Bei mehreren Zielen hilft eine unmittelbar filternde Suche.
Nicht verfügbare Ziele bleiben mit konkretem Grund erkennbar. Ein fehlerhafter
Wechsel zeigt seinen Grund und lässt einen erneuten Versuch zu. Offene ungültige
Keys behandelt der Host, bevor er eine Navigation bestätigt.

### Technische Umsetzung

`AtlasDetailEntry` und seine DOM-Prüfung sind die isolierte UI-Grenze; AtlasView/Editor/Renderer/Repository bleiben die gemeinsame Hostgrenze.

`AtlasDetailEntry` erhält ein vorhandenes `HTMLElement` und
`onNavigate(target: Readonly<AtlasNavigationTarget>): void | Promise<void>`.
`update(model)` liefert den aktuellen Ortsnamen, readonly Einträge mit `label`,
optionalem `description`, dem tatsächlichen `target` sowie optionalem
`unavailableReason`. Ein optionaler `blockedReason` sperrt alle Aktionen und
erklärt beispielsweise den laufenden Ortswechsel. Der Host liefert und validiert
IDs, Typen, Verfügbarkeit, Context-/Registry-/Sourcebindung; das UI löst weder
Dateien noch Campaignzugehörigkeit auf.

Die Komponente kopiert und friert Zielwerte eines Updates ein. Sie leitet genau
diese Werte an den Callback weiter; gleiche Anzeigenamen sind keine Identität.
Kein Repository, Renderer, Source, History, Save oder Provider wird angelegt.
Jedes Update widerruft alte UI-Callbacks durch eine lokale Darstellungsnummer.
Ein Klick auf eine abgelöste Zeile und eine verspätete Callbackantwort dürfen
die neue Darstellung nicht verändern. Das beendet keine Hostoperation; deren
Lebensdauerprüfung bleibt beim geprüften Navigationsconsumer.

Während eines Auftrags sind weitere Zielaktionen gesperrt. Erfüllung entsperrt
die aktuelle Darstellung; Ablehnung zeigt Text über `textContent` und ermöglicht
Retry. Nur die Antwort des noch gültigen UI-Auftrags verändert den Status.
`destroy()` entfernt eigene Listener/Inhalte und widerruft alle noch laufenden
UI-Antworten. Keine automatischen Wiederholungen.

### Gestaltung und Bedienung

Bestehende Obsidian-Schrift, Themefarben und native Controls verwenden; keine
zusätzliche Schrift, Palette, Animation oder zweite Seitenleiste. Der Host
montiert die kompakte Section im vorhandenen Dock. Links ausgerichtete Labels,
Suchfeld mit sichtbarer Beschriftung, normale Buttons und kurze Beschreibung.
Namen/Fehler als Text behandeln. Leere Liste erklärt „Für diesen Ort sind keine
Ziele verfügbar“, leeres Suchergebnis erlaubt Suche zurücksetzen. Eingabe,
Enter/Space und Tab bedienen native Controls; UI-Ereignisse dürfen keine
Atlas-Zeichengeste oder Undo-Abkürzung auslösen. Ein laufender Filter behält seinen
Fokus und seinen Text beim Neuzeichnen. Größenbeschränkung und Scrollen kommen
vom bestehenden Dock. UUIDs, Tokens und technische Ownerbegriffe werden nicht
als Nutzerbeschriftung erzeugt.

Gestaltungsabgleich: ein eigener Kartenmodus oder dekorative Zielkarten würden
den durchgehenden Atlasweg erschweren. Deshalb bleibt die vorhandene visuelle
Hierarchie erhalten; die direkte Aktion am benannten Ziel trägt die neue Funktion.

### Prüfbarkeit und noch offene Hostarbeit

Der isolierte DOM-Test verwendet das vorhandene `linkedom` und echte DOM-Events:

1. Benannte Stadt-/Haus-/Raumziele mit identischen Labels leiten verschiedene
   vollständige native Targets unverändert weiter; Text wird nicht als HTML aktiv.
2. Suche, Zurücksetzen, Leerzustände und unverfügbares/gesperrtes Ziel funktionieren
   ohne Callback; Fokus und Filter bleiben beim Filtern erhalten.
3. Doppelaktivierung während Promise wird verhindert; Ablehnung zeigt den Grund,
   entsperrt und ermöglicht genau einen erneuten ausdrücklichen Versuch.
4. Ortsupdate/destroy vor Promiseantwort sowie Klick auf alte abgelöste Zeile
   erzeugen weder neue Navigation noch Statusänderung im neuen Ort.
5. Caller-Mutation nach Update kann das gebundene Ziel nicht umadressieren;
   Tastatur-/Pointerereignisse aus dem Dock erreichen den Atlasrouter nicht.

Die DOM-Prüfung verwendet den vorhandenen Testlauf mit dem echten UI-Controller.

Ein Komponenten-PASS bestätigt nur die UI-Grenze. Native Ziele, Navigation und vollständiger Save-/Frischprozessablauf müssen über den tatsächlichen Hostadapter geprüft werden.

## Gebäudename und Hausrotation

Vorhandenes Haus auswählen → Namen exakt bearbeiten oder 90° drehen → gemeinsames Undo/Redo → Save → frischer Prozess erhält Namen und Geometrie. Integration: [PR93](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/93), [PR98](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/98), [PR132](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/132). Direkte Belege: [Hausname H01](docs/reference/city-building-name-h01/receipt.json), [Hausname H02](docs/reference/city-building-name-h02/receipt.json), [Rotation H01](docs/reference/city-building-rotation-h01/receipt.json), [Rotation H02](docs/reference/city-building-rotation-h02/receipt.json), [Post-Save/Tastatur](docs/reference/gm-city-postsave-reopen-20261011/README.md).

Das Textarea erhält Zeilenumbrüche, Tabs und Leerzeichen ohne Normalisierung. Geprüftes Flush vor Navigation, direkter Save und Apply/Discard benutzen dieselbe History und native Transaktion. Fehler nach Citywrite vor Campaignmanifest-CAS rollen die ursprünglichen nativen Bytes vollständig zurück. Rendererbenachrichtigungen dürfen Eingabe und Fokus nicht widerrufen; laufende IME-Komposition blockiert Escape und Strg/Cmd+S. Rotation erhält die Grundrissmitte in Stadtmetern; Außenkontur, Innenhof, IDs und Bindungen drehen gemeinsam.

Offen bleiben der native Fokusnachtest für direkten Save mit fokussiertem Namenfeld, der native IME-Nachtest, physische Eingabe, breite Recovery und vollständige Stadt-/Originalparität. H01-Save prüfte sechs fremde räumliche Dateien; erst H02 prüft zusätzlich die Campaignbytes. Managed-DOM ist kein Ersatz für diese Nachweise.

## Prüfwerkzeug: Prozessabschluss

`tools/host-test.cjs` muss auch bei Shutdownfehler ein Receipt schreiben, sofern das Ausgabeziel beschreibbar ist. Hauptfehler bleibt primär, Shutdown wird genau einmal versucht, `shutdownFailure` erhält Name/Meldung/Stack. Shutdown- oder Schreibfehler setzen `passed:false` beziehungsweise Exitcode 1; kein automatischer Neustart. Erfolg, Hauptfehler, Shutdownfehler, beide Fehler, Nicht-Error-Würfe und unbeschreibbares Ausgabeziel werden über den tatsächlichen Workflowabschluss geprüft. `tests/host-shutdown-receipt.test.mjs` deckt diese Grenze ab.

## Inspector und native Speicherung

### Inspector- und Fachaktionsbelege

Zwei direkte Gegenproben FAIL vor/PASS nach Implementierung: exakte Namensänderung
mit unveränderten übrigen Daten und Undo/Redo; ungültiger Name, fehlendes/fremdes
Element, doppeltes Schreibziel, Getter ohne Aufruf und stale Beforebasis ohne
Teilpublikation. 576 gebaute Kerntests PASS. Typprüfung/Build/Repositoryprüfung PASS. Unabhängiger Fachbefehlreview
[CITY-BUILDING-NAME-R01](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/93#pullrequestreview-5481404923) PASS auf 793a68e; dieser Befund betrifft noch nicht den neuen Inspector.

Der sichtbare Consumer ist im vorhandenen AtlasEditor umgesetzt und integriert (#92/6103962651): CityHit liefert Owner/Building-ID; ein Hausklick
öffnet ein Namenstextfeld in derselben Keyseitenleiste. Der bestehende CityDraft
bindet die Eingabe an ihre Basis und dieselbe AtlasHistory. Apply, Escape,
Zur Karte, Auswahlwechsel, Undo/Redo und Save nutzen applyKeys; ungültige und
stale Eingaben bleiben sichtbar. Zurück zur Karte übernimmt zuerst und gibt
anschließend den Fokus zurück. Alte Feldcallbacks nach Hauswechsel sowie
History-ABA und widerrufener Context können keine neue Eingabe veröffentlichen.

Ein Textarea erhält auch vorhandene Zeilenumbrüche, Tabs und Leerzeichen ohne
Normalisierung. Interne Navigation darf unter ihrer vorübergehenden UI-Sperre
geprüft flushen; direkte Feldaktionen bleiben während der Sperre blockiert.
Die Cacheidentität berücksichtigt den tatsächlichen CitySource. Explizites
Verwerfen validiert die neue Basis, bevor der alte Entwurf abgelöst wird.

### Verbleibende Umsetzung und Abnahme

Belegt sind die unten verlinkten begrenzten Hausnamen-, Apply/Discard-, Save- und Frischprozessfälle. Offen bleiben der native Fokusnachtest für direkten Save mit fokussiertem Namenfeld, native IME-Eingabe, physische Bedienung, breite Recovery und vollständige Stadt-/Originalparität. DOM-/Repository-/Modellreopen ersetzen diese Abnahmen nicht. Bestehende #80-H01-Belege bleiben in ihrem nachgewiesenen Umfang gültig.

### Tatsächliche Hostprobe

Der vorhandene isolierte Prüfer läuft über `node tools/host-test.cjs --city-building-name` und separat `--restart` (`tools/host/city-building-name.cjs`). H01 auf Produktstand `0315b13` prüft tatsächliche Hausauswahl, ungültigen Namen/Escape, exakten Unicode-/LF-/Tabtext, Undo/Redo, Rückkehr zur Karte, Save und einen frischen Prozess mit gespeicherten Hashes, Namensfeld, allen Citydaten und leerer History. Sechs fremde räumliche Dateien bleiben unverändert; die Campaignbytes werden erst in H02 zusätzlich geprüft.

[H01-Receipt](docs/reference/city-building-name-h01/receipt.json) bindet Resultate, Buildtripel, Prozessnachweise, gespeicherte Baseline, Bilder und den ersten Fehlversuch mit SHA-256. Das sind synthetische Eingaben in tatsächlichen Obsidianprozessen; unabhängige GM-, physische-, breite Recovery- und Gesamtparitätsabnahme bleiben offen.

### Direkter Save und City-Rollback (#92)

Ein offener Hausname plus direkter Save scheiterte vor Publish mit „Native Atlas-Erfassung ist veraltet“: Namensübernahme und Save überlappten die Entwurfssicherung. Der Saveconsumer wartet nun nach Keyübernahme auf diese Sicherung und prüft den Context erneut. Queue, History und Persistenz werden wiederverwendet; kein automatischer Retry.

Die DOM-/Vaultadapterregression scheiterte vor dem Fix und besteht danach: Ein Campaignmanifest-CAS-Fehler nach Citywrite rollt sämtliche ursprünglichen nativen Bytes zurück. Exakter Name, Geometrie, IDs und eine Historywirkung bleiben im selben Repository/Context für sichtbaren Retry erhalten. Der zweite Save erzeugt keine zusätzliche History; frisches Öffnen erhält die exakten Citybytes mit History0. Save-R03 ist auf PR98/6104396047 PASS und auf `73bfe22` integriert; S01-01 ist auf `0bebb85` integriert und geschlossen. Dieser direkte Saveweg erweitert H01 nicht rückwirkend.

Der isolierte Hostprüfer verwendet `--city-building-name-rollback` und separat denselben Schalter mit `--restart`. [H02-Receipt](docs/reference/city-building-name-h02/receipt.json) belegt Edit2/Fresh1 PASS auf Prüfer-/Buildquelle `1afac1d`, Produktcode bytegleich `73bfe22`, sichtbaren Fehler/Retry, ganze City-/Campaignbaseline, unveränderte Fremdbytes, genau eine Historywirkung und erhaltene Kamera/Context. Beide Prozesse endeten normal mit Exit0; Faultinjektion wird auch bei Prüferfehler zurückgenommen. Freie GM-, physische und breite Recoveryabnahme bleiben offen.

## Generation, Gestaltung und Ausgabe

- Lokale Neugeneration schützt manuell bearbeitete Elemente, Gebäude mit Innenräumen, Keys oder Bindungen und deren Kennungen. Eine ausdrückliche einzelne Freigabe löscht selbst keine Inhalte; ein Ersatz darf keine Texte, Räume oder Referenzen stillschweigend verlieren. Nur neue Elemente erhalten neue Kennungen. Generationsvorgaben dürfen eine bestehende Karte nicht beim Öffnen verändern; Undo und Konfliktwiederherstellung erhalten zusammengehörige Geometrie und Keys.

- Geplante CITY-04-Verformung ist ein Geometrieänderungsbefehl mit vollständigen Vorher-/Nachherwerten bestehender stabiler Elemente, getrennt vom Generatorersatz. Vorschau verändert keinen dauerhaften Zustand; Apply erzeugt einen gemeinsamen Atlas-History-Befehl, Cancel verwirft die Vorschau. Straßenknoten und angrenzende Konturen werden zusammen validiert. Personen, Ortsverweise, Keys und Kennungen bleiben erhalten. Geschützte Gebäude mit Innenräumen bleiben erhalten; eine ausdrücklich gewählte Gebäudegeometrieänderung folgt dem gemeinsamen Gebäudevertrag. Bisher separat gebundene Dungeonkarten werden nicht implizit durch ein Stadt-Verformungsfeld verzerrt. Save speichert Endgeometrie, ohne beim Laden die Operation zu wiederholen. I14 belegt nur Displace-Apply/Discard und visuelle lokale Neugeneration im Original; eigene Befehls-/Bindungs-/Hostabnahme offen.

- Geplante Rollen aus I15: starre Gesamtdrehung nutzt die gemeinsame Stadtplatzierung mit ihrer Transformkette und Atlas-History; sie generiert keine lokale Geometrie neu. Lokale Konturverformung bleibt ein Geometriebefehl. Messung besitzt nur transiente Endpunkte/Overlay in gemeinsamen Meterkoordinaten, ohne Dokumentmutation, Dirty oder History; Anzeige folgt den gewählten Einheiten. I15 belegt sichtbare Teilwirkungen aller weiteren Originalwerkzeuge, eine Gesamtdrehung von Stadt/Fluss/Küste und die Anzeige96m. Exakte Formeln, Drehpunkt, Kalibrierung und eigene Bindungs-/Host-/Bedienabnahme bleiben offen.

- Geplanter CITY-08-Export: PNG/JPEG, SVG und JSON lesen denselben unveränderlichen Szenen-/Dokumentstand. Weltmeter-Ausschnitt und Rasterauflösung sind von der Kamera getrennt. SVG führt Vektorpfade, Texte und nutzbare Stil-/Schriftressourcen; JSON führt explizite Schema-/Generatorversion, Koordinatenachsen/Einheiten, materialisierte Geometrie und stabile Element-/Bindungskennungen. Kein eigenes Exportmodell oder erneutes Generieren beim Ausgeben. I16 belegt drei empfangene Originaldateien und deren Struktur, PNG visuell; SVG-Sichtnachweis und eigene Format-/Host-/Bedienabnahmen bleiben offen.

- Geplanter CITY-07-Gestaltungszustand: versionierte Vorgabe mit stabiler Kennung, semantischen Farbrollen für Papier, Linien, Dächer, Wasser, Grün, Straßen, Mauern, Bäume, Beschriftung und Elemente sowie getrennten Tönungs-/Verwitterungsparametern und Darstellungsflags. Datei und Bibliothek validieren denselben Zustand vollständig vor Anwendung; Parametereinheiten und Grenzen bleiben vor Umsetzung zu vermessen. Vorschau ist transient, Cancel erhält gespeicherte Werte; Apply ist ein gemeinsamer Atlasbefehl für Gestaltung ohne Geometrieersatz oder Regeneration. Geometrie, Kennungen, Keys, Personen und Hausbindungen bleiben erhalten; Renderer und Export lesen denselben Stand. I19 belegt Vivid-Apply, tatsächliche Farbschema-Datei und bytegleiche Geometrieausgaben; vollständiges Load/History/Neustart und eigene Implementierung bleiben offen.

- Geplanter CITY-02-Vorgabenvertrag: stabile Vorgabenkennung, Name, Generatorversion und explizite Abschnittsmenge. Vollständige Validierung/Migration geht der Anwendung voraus; nur enthaltene Abschnitte werden atomar mit gemeinsamer History ersetzt, übrige Entwurfswerte bleiben erhalten. Datei und gemeinsame Bibliothek verwenden dieselbe kanonische Serialisierung. Fehlende Referenzen verhindern die Teilanwendung bis zur sichtbaren Auflösung. Cloud-Synchronisation ist noch zu vermessen. I13 belegt nur eine leere Load-Liste und einen nicht gefundenen Save-Zugang im temporären Originalformular; keine eigene API oder Original-Speicherwirkung.

- Geplante CITY-02/CITY-05-Umgebung: Gewässerkontur, Breite und Ufer-/Bauabstand liegen in gemeinsamen Meterkoordinaten und bilden Ausschlussflächen für normale Straßen/Gebäude. Querungen sind explizite Übergangselemente mit stabiler Kennung und zwei Uferanschlüssen; Vorschau validiert ihren Straßenverbund. Regionale Gewässer behalten ihren Dokumentbesitz und werden durch Stadtgeneration nicht ersetzt. I37 belegt im Original Fluss-/Straßen-/Bebauungswirkung, aber keine exakte Übergangstopologie, Parametereinheiten oder eigene Implementierung.

- Geplantes CITY-02/CITY-08-Generationsrezept: versionierter vollständiger Auftrag mit Generatorversion, getrennten Seed-/Größenvorgaben, Feature-/Anschlussstrategie, Siedlungsfläche, Umgebungsankern und Einheiten. Import validiert vor einem neuen Vorschauauftrag; kein Ausführen fremder URLs oder Netzwerkzugriff erforderlich. Reproduktion wird anhand materialisierter Geometrie geprüft. Die native Stadtdatei speichert erzeugte und manuell bearbeitete Geometrie/Keys/Bindings; normales Laden führt keine Generation aus. I35 belegt Small mit gleichzeitig neuem Seed und bytegleiche From-URL-Rückstellung im Original, keine Erhaltung manueller Bearbeitung oder eigene Implementierung.
