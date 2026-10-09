# Stadt-Pfad: technischer Gesamtplan und CITY-00

## Auftrag und Planstand

Direkter Auftrag vom 09.10.2026: vollständige Funktionsgleichwertigkeit mit Canvas of Kings, Watabou Medieval Fantasy City Generator und Fantasy Town Generator, mit besserer Bedienung. Die ältere Beschränkung auf zwei Ergebnisvorbilder reicht dafür nicht aus. Originalgesten sind weiterhin keine Vorgabe. Alle bestehenden CTY-Kennungen und fremden Nachweise bleiben erhalten.

Planungslauf CITY-P01; Ausgangspunkt bca9fbc. Repository: active/installed-phase1. Eigene Arbeitskopie, gemeinsame Veröffentlichung ohne Force-Push. Der Hex-Kollege besitzt derzeit HEX-00 und seine GUI-Testinstanz; keine parallele native Testinstanz starten. Stadtproduktcode beginnt nach CITY-00 und den vereinbarten Atlasvoraussetzungen HEX-05. Bis dahin kann die Referenzarbeit vollständig vorgezogen werden.

## Iststand und offene technische Basis

Alle 24 CTY-Unterfälle sind offen; native Stadtmodelle, Atlasintegration, Generierung, Darstellung und Stadtbedienung fehlen. `src/model.ts` beschreibt Dungeon-Dokumente, `src/session.ts` hält deren Befehle und Historie; `src/persistence.ts` besitzt Compare-and-write, Entwurf und Journal, erlaubt aber neben der Karte nur Markdown. Diese Besitz-/Journalgrenze darf nicht ungeprüft für .city/.location/.overworld aufgeweitet werden. HEX-05 ist noch nicht abgenommen. Eine neue separate Stadtansicht wäre keine Erfüllung des gemeinsamen Editors.

## Technische Arbeitspakete

| Phase | Umsetzung und Zuständigkeit | Nachweis vor Freigabe |
|---|---|---|
| CITY-00 | Drei Originalprodukte funktional inventarisieren; stabile CO-Kennungen pro Fähigkeit, Quellen/Version/Datum und direkte Ergebnisproben. Galerie: Dorf, ummauerte Stadt, Hafen und Detailfläche. FTG zusätzlich Bewohner-, Fraktions- und Zeitabläufe. Katalog und Roadmap auf den aktuellen Auftrag erweitern. | Jedes Inventarelement hat Quelle, eigene Zielaufgabe, technische Zuordnung und offenen/belegten Vergleich; direkte Proben getrennt von Dokumentation. |
| CITY-01 | `src/features/city/model.ts`: versionierte Metergeometrie, IDs, Straßenknoten/-kanten, Platzkonturen, Gebäude, Grundstücke und Districts. Parser validiert endliche Werte, eindeutige IDs und Referenzen. `city/commands.ts` nutzt den gemeinsamen Atlasbefehl aus HEX-05; keine zweite Undo-Historie. Renderer und Trefferprüfung verwenden denselben Transform. Native Registrierung .city im vorhandenen Host. | Straße/Platz/zwei Häuser im Atlas zeichnen, außerhalb belegter Ausdehnung wachsen, verschieben, Undo/Redo, Save, frischer Prozess. |
| CITY-02 | `city/generator.ts` als deterministischer Workerauftrag mit Seed, Version, Polygon und Vorgaben. Straßen zuerst, Blöcke/Grundstücke danach; Gebäude dürfen Straßen, Wasser und Grenzen nicht schneiden. Materialisierte Geometrie speichern. Abbrechbare Vorschau, ein atomarer Commit, niemals beim Laden generieren. | Dorf/Stadt reproduzierbar; unmittelbare Straßen-/Hausänderung; Abbruch ohne Dirty/History; ein Undo; Reload identisch. |
| CITY-03 | Stabile optionale Orts-/Dungeonbindungen pro Gebäude; HEX-05-Platzierungsgraph um Stadt→Gebäude→Dungeon ergänzen. Meter/Fünf-Fuß-Konversion und lokale Rotation komponieren. Bestehendes Key-Panel zeigt .location bzw. Raumkey. Multi-Dokument-Befehl samt Compare-and-write-Journal und Wiederherstellung. | Ausschließlich Zoom Region→Stadt→Haus→Raum; dieselbe Werkzeugwahl, Auswahl und Historie. Elternbewegung verändert keine lokalen Raumdaten. Fehler nach jedem Journalschritt und externe Konflikte prüfen. |
| CITY-04 | Herkunft/Schutz je Element; manuelle Änderung setzt Schutz. Orts-/Dungeonbindung schützt automatisch. Lokale Neugeneration nur in ausgewähltem Polygon; geschützte Konturen als Hindernisse, bestehende IDs unverändert. Änderungen in einem Atlasbefehl. | POI, manuelle Straße und Haus-Dungeon vor/nach byte-/wertgleich; Cancel, Undo, Save und Neustart. |
| CITY-05 | Straßen als topologischer Graph mit Klassen/Breite; Anschluss an regionale Wege. Flusskreuzungen als Brücken, Tore als Bindung von Straße und Mauer; Mauern/Türme als editierbare Pfadobjekte. Punktänderung aktualisiert betroffene Bindungen lokal. | Regionalweg→Tor→Platz ohne Lücke; Brücke passt; Torzug erhält Schutz und Bindungen. |
| CITY-06 | Viertelpolygone mit Nutzung/Dichte; Gebäudearten Markt/Hafen/Burg/Tempel/Garten. FTG-Lebensdaten: stabile Bewohner-, Haushalts-, Berufs- und Fraktionsreferenzen, Religion/Demografie und editierbare Notizen. `city/population.ts` generiert diese deterministisch nach dokumentierten Gebäudebedarfen. Keine Pflichtdatei je namenlosem Haus. | Hafen/ummauerte Stadt, POI-Suche, Ortskey, Haushalts-/Berufs-/Fraktionsänderung; Daten bleiben nach Regeneration und Neustart konsistent. |
| CITY-07 | Gemeinsame Assetbasis/Detaildarstellung: variierte Dächer, Pflanzen, Props, Farb-/Stilvorlagen, Pfad-/Flächenplatzierung und gruppierte Objekte. FTG-Zeit, Tagespläne, Tageslicht, Wetter/Jahreszeit: deterministische ableitbare Anzeige mit expliziter gespeicherter Uhrzeit, kein unbegrenzter Hintergrundtimer. `city/simulation.ts` leitet Aufenthaltsorte aus stabilen Personenbindungen ab. | Übersicht/Detail metrisch deckungsgleich, ausgewählte Geometrie sichtbar; Personen-, Wetter-/Zeitaufgaben gegen Original. |
| CITY-08 | Ausschnitt/Exportsettings unabhängig von Kamera; PNG/JPEG, Raster und Vorlagen, zusätzliche FTG-Exportformate nach Inventar. Räumlicher Index, Viewport-Culling und Bedarfsladen; Workerabbruch, Dispose. | 5.000 Gebäude, mehrere Städte/Innenräume; p95 Navigation ≤33 ms, Vorschau ≤100 ms nach Laden; Save/Reload; Export entspricht demselben Dokumentstand. |
| CITY-09 | Vollständiges Inventar gegen denselben Endbuild prüfen; gemeinsame HEX-28-Abnahme. Isolierter Testvault, Sicherung vor Installation. | Alle Pflichtfähigkeiten, Konflikt/Undo/Neustart/Export, installierter Build, Ergebnisvergleich und physische Bedienung jeweils eigene Belege. |

Neue Modulpfade sind geplant, keine bereits vorhandenen APIs. Die konkreten HEX-05-Schnittstellen werden nach dessen Review übernommen; ein eigener Stadt-Atlas würde Architektur und Auftrag verletzen.

## Drei Referenzen und bisher zusätzlich fehlende Fähigkeiten

Stand 09.10.2026, offizielle Dokumentation gelesen, aktuelle Laufversionen noch nicht direkt beobachtet:

- Canvas of Kings: interaktive Pfade/Flächen/Räume, automatische Objektverteilung, Zufallsvarianten, zusammen bewegte Objektgruppen, Licht/Wetter, Exportausschnitt mit Quadrat-/Hexraster und gespeicherten Vorlagen. Quelle: https://store.steampowered.com/app/2498570/Canvas_of_Kings/ . Jede genannte Fähigkeit einzeln in CITY-00 direkt prüfen.
- Watabou: Layout, Viertel, Gassen, Dächer und Umgebung; aktuelle Laufoptionen und Exportformate vollständig direkt erfassen. Quelle: https://watabou.itch.io/medieval-fantasy-city-generator . Ein altes Quellarchiv zählt nicht als aktuelle Funktionsabnahme.
- Fantasy Town Generator: konfigurierbare Siedlung/Bevölkerung/Wasser/Viertel, Gebäudeabhängigkeiten, Bewohner/Fraktionen, editierbare Karte und Lebensdaten, lokale Neugeneration, Tagespläne/Zeit, Wetter/Jahreszeiten, Exporte und Vorlagen. Quellen: https://docs.fantasytowngenerator.com/category/create-settlements/ , https://docs.fantasytowngenerator.com/category/use-settlements/ , https://docs.fantasytowngenerator.com/category/edit-settlement/ , https://docs.fantasytowngenerator.com/category/premium-features/ . Details, Premiumfähigkeiten und Formatspezifika offen inventarisieren; keine stillschweigende Einschränkung auf Kartenbilder.

Die genannten zusätzlichen Fähigkeiten sind Planungsgegenstände, keine vollständige Originalinventur. Nicht direkt zugängliche Funktionen bleiben mit Zugangslücke offen; keinen Kauf oder fremden Login voraussetzen.

## Bedienabnahme

Identische Aufgaben in den drei Originalen und im eigenen Endbuild: Siedlung erzeugen, Straße umlegen, Tor/Brücke setzen, Viertel erneuern ohne POI-Verlust, Bewohner/Fraktion ändern, Tageszeit ändern, Hausraum und Key bearbeiten, Ausgabe erstellen. Pro Aufgabe Schritte, Zeit bis Ergebnis, Fehlversuche und benötigte Hilfe erfassen. Aufgaben, die ein Original nicht besitzt, als Projektmehrwert prüfen, nicht als vergleichbaren Geschwindigkeitsgewinn zählen. Bessere Bedienung erst aus gepaarten Aufgaben ableiten; synthetische Eingabe ersetzt keine physische Maus-/Touchpad-Abnahme.

## Getrennte Arbeitsläufe und Aufräumen

Jede Fachphase: P (offene Punkte/technischer Plan), I (Umsetzung), R (Review gegen CTY, CO-Inventar und Plan), N (Nachbesserung), R erneut bis keine Pflichtlücke. Danach CP (Aufräumplan), CI (Bereinigung), CR (Review); bei Befunden CN/CR wiederholen. Nach JEDEM Fachlauf zusätzlich seine konkrete Aufräumprüfung getrennt planen, umsetzen und reviewen, bevor der nächste Fachlauf startet. Jeder Lauf enthält Start, Fokus, Ergebnis und nächsten Schritt im aktuellen `checkpoint.cityExecution`; keine weitere fortlaufende Statusdatei. Laufbelege unter der bestehenden QA-Wurzel.

Aufräumprüfungen: keine parallele Zustands-/Undoquelle, keine Kopie gemeinsamer Geometrie/Transformlogik, saubere Modulgrenzen, Ressourcen-/Workerfreigabe, stabile IDs und Textschutz, keine Testartefakte im Nutzervault. Auch ein Lauf ohne notwendigen Codeumbau erhält ein begründetes Ergebnis. Basisprüfungen für Produktänderungen: npm run check, npm test, npm run build plus betroffene Regressionen. Planpakete: JSON, CTY-Verweise und Diff. Vor jedem Paket und Push fetch/integrate; nur eigenes Paket committen; exakten Remote-Commit prüfen.

## Bestehende Pflichtfälle: vollständiger offener Bestand

- **CTY-001.01 / CITY-01 — Stadt als native Atlasgeometrie**: Stadt, Straße und Gebäude bleiben editierbare Daten mit stabilen Kennungen und tatsächlichem Metermaßstab; sie erscheinen an der gespeicherten Atlasposition. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-001.02 / CITY-02 — Editierbare Generation**: Siedlungsfläche mit wenigen Vorgaben erzeugt Straßen, Platz und individuell editierbare Gebäude. Gespeicherte Geometrie, Seed und Generatorversion werden nach Neustart ohne erneute Generation erhalten. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-001.03 / CITY-02 — Einfügung in die Umgebung**: Lokale Küste, Fluss und regionale Straßen geben Referenzanker; Stadtplanung überschreibt Landschaft und bestehende Ortsinhalte nicht stillschweigend. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-002.01 / CITY-01 — Straße unmittelbar ändern**: Im bestehenden Atlas eine Straße zeichnen, ziehen, ergänzen und rücknehmen; verbundenes Netz und Gebäude bleiben konsistent. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-002.02 / CITY-01 — Haus unmittelbar ändern**: Gebäude direkt auswählen, verschieben, skalieren, drehen und entfernen; derselbe Editor, dieselbe Kamera und durchgehende Historie bleiben bestehen. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-002.03 / CITY-03 — Keine separaten Modi oder Editorkontexte**: Zoom verändert sichtbare Details, aber wechselt weder Werkzeugleiste, Werkzeug, Auswahl, Historie noch Kartenfenster. Aktionen richten sich nach Werkzeug und getroffener Geometrie; ein laufender Zug behält sein Ziel. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-003.01 / CITY-04 — Gezielt neu erzeugen**: Nur gewählten Bereich erneuern; manuell bearbeitete oder verlinkte Elemente bleiben samt Kennungen, Geometrie und Keys erhalten. Eine Aktion ist vollständig rücknehmbar. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-003.02 / CITY-04 — Varianten und Entwürfe erhalten**: Variantenvergleich und Abbruch verlieren keinen bisherigen Stand. Gespeicherte Entwürfe und zukünftige Generatorupdates verändern die materialisierte Stadt nicht beim Öffnen. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-004.01 / CITY-05 — Zusammenhängendes Straßen- und Wegenetz**: Hauptstraße und Gassen sind verbunden; eine Straße schneidet geschützte Gebäude nicht unbemerkt. Kreuzungen, Sackgassen und Platzanschlüsse bleiben nachvollziehbar. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-004.02 / CITY-05 — Fluss, Brücken und Befestigung**: Straßenqueren über Brücken, Mauern mit begehbaren Toren und Türmen; Anschluss an Regionalstraße erhält räumliche Kontinuität nach Änderung und Neustart. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-004.03 / CITY-06 — Stadtformen und Viertel**: Dorf, ummauerte Stadt und Hafenstadt besitzen unterscheidbare Struktur; Viertel, Bebauungsdichte, Plätze und besondere Bauten lassen sich gezielt beeinflussen. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-005.01 / CITY-03 — Orts- und Gebäude-Keys**: Orts-Key bleibt .location; ein beschriebenes Gebäude oder Viertel erhält einen optionalen stabilen Ortsverweis. Umbenennen, Verschieben und lokale Neugeneration erhalten Abschnittslinks. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-005.02 / CITY-03 — Welt bis Haus-Dungeon nur zoomen**: Von oberster Hex-Stufe durch Stadt und Haus bis Raum ausschließlich zoomen; Innenräume erscheinen am tatsächlichen Gebäudeort. Keine Öffnen-/Betreten-/Modusaktion ist nötig. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-005.03 / CITY-03 — Direkte gemischte Bearbeitung und Undo**: In einer Sitzung Hex, Straße, Haus, Dungeonraum und Key ändern; ohne Karten-/Moduswechsel rücknehmen/wiederholen und mit wiederherstellbarem Journal speichern. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-005.04 / CITY-03 — Stadt und Gebäude gemeinsam verorten**: Stadt verschieben/drehen und ein verlinktes Gebäude verschieben; zugehörige Dungeonplatzierung folgt der Bindung. Raumgeometrie behält Maßstab, lokale Kennungen und Form. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-005.05 / CITY-08 — Zoom ohne räumliche Sprünge**: Kontrollpunkt bleibt beim Detailwechsel an derselben Weltposition und unter dem Zoomanker; Zoomgrenzen pendeln nicht, Dach-/Innenraumübergang verdeckt keine bearbeitbare Auswahl. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-006.01 / CITY-07 — Lesbare Stadtübersicht**: Straßenhierarchie, Viertel, Plätze, Wasser, Befestigung und POIs bilden eine klare Draufsicht nach dem gewählten Watabou-Ergebnisvorbild; Lage und Maßstab bleiben erhalten. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-006.02 / CITY-07 — Ausgearbeitete Stadtdetails**: Variierte Gebäude/Dächer, Mauern/Türme, Vegetation und Dekoration ergeben eine stimmige Draufsicht nach dem gewählten Canvas-of-Kings-Ergebnisvorbild; direkte Bearbeitung bleibt möglich. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-006.03 / CITY-08 — Gleicher Inhalt in Übersicht, Detail und Ausgabe**: Übersicht und Dekoration sind Darstellungen derselben editierbaren Daten. Stadtausschnitt zeigt dieselbe Geometrie und POIs unabhängig von Kamera; vollständige PNG/JPEG-Ausgabe wird mit HEX-27 geprüft. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-007.01 / CITY-08 — Große Stadt und Ressourcenfreigabe**: Auf dem vorhandenen Laptop eine Stadt mit 5.000 Gebäuden und mehreren Haus-Dungeons prüfen; Zielwerte der Atlasnavigation (p95 ≤33 ms/Bild, Vorschau ≤100 ms nach Laden) messen und ungenutzte Detailressourcen freigeben. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-007.02 / CITY-03 — Speichern, Konflikt und Wiederherstellung**: .overworld/.city/.location/.dungeon-Änderungen, externe Änderung und unterbrochenes Speichern prüfen. Konflikte bleiben sichtbar; Wiederherstellung erzeugt keine verwaisten Platzierungen oder verlorenen Texte. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-008.01 / CITY-02 — Einfacher Einstieg**: Mit wenigen sichtbaren Vorgaben und einer direkt aufgezogenen Siedlungsfläche entsteht ein nutzbarer Plan im selben Atlas; kein Wizard, Moduswechsel oder verstecktes Pflichtmenü. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-008.02 / CITY-08 — Bedienbarkeit durch tatsächliche Aufgaben**: Neue Stadt erzeugen, Straße umlenken, Gebäude/POI anlegen, in Hausgrundriss zoomen und Raum-Key bearbeiten mit Maus/Touchpad prüfen; Zeiten, nötige Aktionen und Fehlversuche getrennt erfassen. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-009.01 / CITY-09 — Endstand mit allen Atlasgrößen**: Welt → Region → Stadt → Haus → Raum und zurück nur mit Zoom; direkte Bearbeitung, Datenhaltung, Verortung, Links, Ausgabe und installierter Endbuild belegt. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.

## Planungsergebnis und nächste Grenze

Alle bestehenden CTY-Pflichten sind zugeordnet; der neue Dreiprodukt-Funktionsauftrag ist zusätzlich explizit eingeplant. CITY-P01 schließt keine Produkt- oder Referenzabnahme. Nächster Lauf: getrennte Planbereinigung (CP/CI/CR), anschließend CITY-00-I01 Originalinventur und Katalogerweiterung. CITY-01 wartet auf die Referenzgalerie und HEX-05. Die Kollegenarbeit an HEX-00 bleibt unangetastet.

## Aufräumplan CITY-P01-CP

Start 09.10.2026 nach geprüftem Planungspush 37181e1. Fokus: Plan als ausführbare, widerspruchsfreie Grundlage.

1. CLP-01: Der CO-Inventarbegriff besitzt noch kein Schema. In CI feste Felder/Status und unveränderliche Kennungen definieren, damit dokumentierte Kandidaten niemals direkte Abnahmen vortäuschen.
2. CLP-02: Gemeinsame Abhängigkeiten sind genannt, aber der Übergabevertrag fehlt. In CI Kamera/Transform, stabile Dokumentkennungen, Befehls-/Journalgrenze und Zoom-Hit-Test-Vertrag als prüfbare HEX-05-Übergabe festlegen.
3. CLP-03: Vollständige Funktionsgleichwertigkeit benötigt eine Abschlussregel jenseits der 24 alten CTY-Fälle. In CI Vollständigkeits-/Abdeckungsreview des Dreiproduktinventars und messbare Bedienverbesserung definieren.

Ergebnis: drei konkrete Planungsschwächen; kein Produktcode betroffen. Nächster eigener Lauf CITY-P01-CI; danach CITY-P01-CR prüft jeden Punkt gegen den geänderten Plan.

## Bereinigte Verträge CITY-P01-CI

### CLP-01: Referenzinventar

`acceptance.json.cityPlans.functionalInventory` erhält pro Originalfähigkeit `id` (CO-COK-0001 / CO-WAT-0001 / CO-FTG-0001), `product`, `feature`, `sourceUrl`, `observedAt`, `observedVersion` (null bis direkt bekannt), `availability` (free/premium/local/unknown), `observationKind` (documentation/direct), `originalEvidence`, `task`, `phase`, `caseIds`, `technicalPlan`, `implementationEvidence`, `hostEvidence`, `comparisonEvidence`, `usabilityEvidence`, `review` und `status`. Dokumentationskandidaten bleiben `open`; direkte Originalprobe alleine erlaubt nur `original_observed`, niemals `accepted`. `accepted` setzt Host-/Funktionsvergleich und Review auf demselben benannten Build voraus. UI-/Gestenunterschiede sind erlaubt; verlorene Fähigkeiten nicht. IDs werden nie durch Neuordnung geändert. Neue Fähigkeiten erweitern den Bestand statt bestehende Kennungen umzudeuten.

### CLP-02: HEX-05-Übergabe

Vor CITY-01 gemeinsam mit dem Hex-Pfad prüfen: (a) ein kamerageführter grenzenloser Raum mit Metertransform und präziser Hin-/Rückabbildung, (b) stabile Dokument-/Platzierungskennungen mit Elternbindung und aufgelösten Datei-Konflikten, (c) ein gemeinsam rücknehmbarer Befehl für mehrere Dokumente und alle Journalfehlerstellen, (d) Trefferprüfung/Zeichenziel bleiben während Zoom-/Ladegrenzen stabil, (e) frische Öffnung reproduziert Raum und Keys. Fehlender Vertrag bleibt Voraussetzung; CITY-Code erzeugt dafür keine zweite Kamera, Sitzung oder Speichertransaktion. Übergabe mit konkreten API-/Testverweisen im aktuellen Checkpoint dokumentieren. Nur notwendige gemeinsame Änderungen mit dem zuständigen Kollegen abstimmen.

### CLP-03: Abschlussregel

CITY-00 hat zwei getrennte Tore: alle öffentlich dokumentierten Produktbereiche sind inventarisiert, und alle Pflichtbereiche besitzen direkte Originalproben einschließlich der Galerie. Premium-/Zugangslücken bleiben offen. Nach jeder direkten Probe weitere entdeckte Fähigkeiten nachtragen; vor CITY-09 aktuelle Referenzversionen erneut prüfen. Jede Fähigkeit wird genau einer Phase und mindestens einer eigenen Zielaufgabe zugeordnet; jedes CTY-Kriterium bleibt separat prüfbar. CITY-09 schließt erst, wenn Inventarvollständigkeitsreview und sämtliche Pflichtfähigkeiten auf dem Endbuild bestanden sind und HEX-28 den gemeinsamen Atlasweg bestätigt.

Bedienverbesserung: pro vergleichbarer Aufgabe mindestens drei gleich vorbereitete Versuche, gleiche Eingabegeräte und vergleichbare Kartengröße; Medianzeit, Aktionszahl und Fehler erfassen. Ziel: keine zusätzlichen notwendigen Modus-/Kartenwechsel, keine höhere Fehlerrate und geringere Medianzeit oder weniger notwendige Aktionen pro Kernaufgabe. Kein pauschaler Geschwindigkeitsanspruch aus Einzelversuchen. Noch fehlende physische Beobachtung bleibt offen. Produktumfang ohne direkten Originalzugang wird nicht als gleichwertig freigegeben.

CI-Ergebnis: CLP-01/02/03 konkretisiert; keine Produktfähigkeit implementiert oder abgenommen. Nächster eigener Lauf CR prüft Schema, Übergabe und Abschlussregel gegen Nutzerauftrag und Roadmap.

## Aufräumreview CITY-P01-CR

09.10.2026; eigener Reviewlauf nach CI-Commit 83693f3. CLP-01 bestanden: stabiles Dreiproduktschema trennt Dokumentation, Originalprobe und eigene Abnahme. CLP-02 bestanden: fünf überprüfbare Atlasübergaben; keine zweite Kamera/History. CLP-03 bestanden: vollständiges Inventar plus CTY- und Endbuildreview, messbare gepaarte Bedienaufgaben; Zugangslücken bleiben offen. Alle 24 bestehenden CTY-Fälle sind eindeutig zugeordnet. Checkpoint-Roots des Ausgangsstands sind semantisch unverändert. JSON-/Verweisprüfung und Diffcheck bestanden.

Keine weitere Pflichtlücke im Planaufbau gefunden. Dies beendet die Bereinigung des Planungspakets, nicht CITY-00 oder die Produktparität. CITY-00-I01 beginnt mit direkten Browserproben und Erweiterung des Katalogs auf drei Originalprodukte; native QA nur nach gemeinsamer Sperrprüfung. Der vollständige Originalumfang ist noch zu ermitteln.

## Referenzpaket-Aufräumplan CITY-00-I02-CP

R01: Pauschale Zuordnung aller CTY-Fälle einer Phase entfernen. In CI eine explizite semantische Tabelle je CO-Kennung verwenden. Zusätzliche Bewohner-/Simulations-/Exportfähigkeiten ohne entsprechendes CTY-Kriterium bleiben eigenständige Funktionsanforderungen (`caseIds: []`, `independentFunctionalRequirement: true`); sie werden dadurch nicht optional. Stabile CO-/CTY-Kennungen und vorhandene Belege erhalten.

R02: Für die JSON-Exportaktion `originalProbe.exportFileState: unverified_after_download_timeout` samt Beobachtung eintragen. Datei-/Formatinhalt erst nach realer Sicherung belegen. Menübeobachtung bleibt als Teilbeleg; keine Fähigkeiten oder Qualitätsanforderungen streichen.

CI führt ausschließlich diese beiden Katalogbereinigungen aus. CR prüft vollständige Kennungs-/Belegerhaltung, die explizite CTY-Zuordnung, fehlende Abschlussbehauptungen und JSON-/Diffgültigkeit. Danach eigener Fach-Nachreview N-R, bevor das nächste Originalpaket startet. Die vollständige CITY-00-Abnahme bleibt offen.

## CITY-00-I03-P: Watabou-Referenzpaket

Offen: direkte Stadtübersicht, aktuelle Version, Größen-/Layout-/Darstellungs-/Exportfähigkeiten. Originalseite ist nach automatischer Sicherheitsprüfung erreichbar; keine manuelle Sicherheitsumgehung.

Konkreter Lauf: den auf der offiziellen itch-Seite tatsächlich eingebetteten Generator öffnen; Start-URL samt Seed/Größe/Features sichern. Eine ummauerte Küsten-/Flussstadt in Übersicht und Detail erfassen; Kontextmenü und Versionsanzeige direkt lesen. Nur beobachtete Optionswege nutzen. Ergebnisbilder, Menü-AX und Manifest mit Dateihashes in der bestehenden city-plans-QA-Wurzel sichern. Weitere echte Wirkungs-/Speicherproben getrennt durchführen, statt Menüs zu vollständiger Funktionsabnahme umzudeuten.

Review: Referenzbilder lesbar und reproduzierbare Vorgaben bekannt; jede neu entdeckte Fähigkeit mit stabiler CO-WAT-Kennung, Zielaufgabe und Phase ergänzen; keine Referenztor-/Produktfreigabe aus diesem Teilpaket. Aufräumen danach getrennt planen, umsetzen und reviewen.

## CITY-00-I03-CP: Belegmetadaten bereinigen

R01: Genau vier Menübilder (Kontext, Features, Roads, Export) und zwei Ergebnisbilder benennen; das siebte Bild stammt aus dem separaten Reloadreview. Alle Dateien im Manifest mit Hashes aufnehmen, ohne frühere Prüfnachweise zu überschreiben.

R02: Aktivierte Citadel-/Temple-/Plaza-Vorgaben getrennt von tatsächlich visuell identifizierten Merkmalen notieren. Das Bild belegt Stadtumriss, Hausformen, Straßen, Mauer/Türme, Fluss/Küste und Hafenanlagen. Die Identität eines Tempels oder anderer besonderer Gebäude bleibt einer eigenen Wirkungsprobe vorbehalten.

CI aktualisiert Belegmanifest und Checkpoint; CR prüft alle sieben Bilder/Hashes, die unveränderten 44 CO-Anforderungen sowie die korrigierten Beleggrenzen. Die Originalgesamt-/Produkt-/Bedienabnahme bleibt offen.

## CITY-00-I04-P: Canvas of Kings und gemeinsame Abschlusskoordination

Lokaler Zugang ist geprüft: Steam-App 3122210 (`Canvas of Kings Demo`) ist unter dem vorhandenen Steam-Verzeichnis installiert. Die Vollversion wird daraus nicht abgeleitet. Offizielle Produktbeschreibung nennt Pfad-/Flächenplatzierung, Objektvariation und Gruppenbewegung, Licht/Wetter sowie Ausgabeausschnitt/Raster/Vorlagen. Direkte Demo-Wirkungsproben und Unterschiede zur Vollversion bleiben offen.

Technischer nächster Lauf: vorhandenen spezialisierten Original-QA-Zugang und gemeinsame native Sperre mit dem Hex-Kollegen klären; dessen bestätigtes Veröffentlichungsfenster erhalten. Keine parallele native Instanz starten. Native CUA ist in diesem Stadtlauf deaktiviert; das ist kein Nachweis fehlender Produktfunktionen. Öffentlich sichtbare originale Ergebnisbilder können für den Grafikvergleich gesichert werden, ersetzen aber keine eigenen Wirkungsproben der Demo. Originalzugang, Demo-/Vollversionsumfang, tatsächliche Bildausschnitte und Versionsstand im Katalog getrennt festhalten.

Gemeinsamer Produktabschluss: Hex-Kollege besitzt HEX-00 und HEX-01 bis HEX-05; Stadtlauf besitzt CITY-00 bis CITY-09. Dungeonarbeit wird im bestehenden GitHub-Thema 1 nach aktuellem Bearbeiter/Übergaben abgefragt. Jede Familie erhält ihre eigenen Checkpoint-/Abnahmewurzeln. Ein identischer Endbuild muss Dungeonpflichten, Hex-/Stadtablauf, Speicher-/Konflikt-/Undoverhalten, Ergebnis-/Bedienvergleiche, Ausgabe, Installation und physische Bedienung erfüllen. Noch nicht zugängliche Original- oder Hostabnahmen bleiben offen; weitere unmittelbar nutzbare Arbeit wird fortgesetzt.

## CITY-00-I04-I: FTG-Gebäudedaten

Der zugängliche Teil des geplanten Referenzlaufs bestätigt Umbenennen, Speichern und Wiederfinden nach Browser-Reload: The Radiant Flats heißt anschließend CITY00 Protected House; sieben Bewohner bleiben zugeordnet. Eigenständige Pflicht CO-FTG-0030 in CITY-06, ohne zusätzliche Pflichtdatei für ein namenloses Gebäude. Gebäudeinformationen gehören an stabile Gebäude-IDs; Umbenennen erzeugt einen gemeinsamen Atlasbefehl und erhält Personen-/Ortsbindungen. Sichtbare Unterbereich-Tabs sind nur Inventarhinweise, keine Wirkungsnachweise. Der zweite JSON-Downloadversuch schließt den Dialog, liefert jedoch keinen bestätigten Download; keine weiteren Wiederholungen derselben Hypothese. Belege: `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-i04-20261009/manifest.json`. Canvas-of-Kings-Zugang bleibt offen.

## CITY-00-I04-CP: Belegzuordnung bereinigen

R01/R02 gezielt reparieren: Exportmenü und beide unbestätigten Dateiversuche ausschließlich CO-FTG-0020 zuordnen; die in temporärer Siedlung deaktivierten Integrationsschaltflächen CO-FTG-0021 zuordnen. CO-FTG-0019 erhält wieder den ehrlichen Dokumentationsstatus für Wetter/Jahreszeiten/Tag-Nacht ohne Exportbeleg und ohne Export-CTY-Verweis. Originalartefakte und IDs erhalten. Hashes, unabhängige Pflichtkennungen, sämtliche offenen CTY-Zustände und fremde JSON-Wurzeln prüfen. Anschließend eigener Umsetzungs- und Reviewlauf; keine Produktabnahme ableiten.

## CITY-00-I05-P: Familienstammbaum

Offen ist CO-FTG-0026: bislang nur die Schaltfläche, keine Graphwirkung. Im bestehenden CITY00 Hamlet QA Bewohner Thawn Cobblekind über CITY00 Protected House öffnen, Relations ansehen und Family tree aufrufen. Sichtbare Namen und Eltern-/Geschwisterkanten gegen die bestehenden Relations-Belege vergleichen. Graphnavigation nur soweit sichtbare Controls sie anbieten; keine verborgenen Anwendungsdaten lesen. Screenshots und AX unter city00-i05-20261009 sichern. Versionsstand bleibt unbekannt. Ergebnis beschreibt ausschließlich Originalwirkung, nicht eigene Abnahme. Technische Umsetzung in CITY-06: ein gemeinsamer Personen-/Beziehungsgraph mit stabilen Personen-IDs, abgeleitete Stammbaumdarstellung und direkte Auswahl; keine zweite Familienkopie. Review prüft Kantenrichtung, Belegumfang und verbleibende Lücken; anschließend getrennte Aufräumplanung/-umsetzung/-review.

## CITY-00-I05-CP: Stammbaumbelege aufräumen

Originalframes unverändert lassen. CO-FTG-0026 bekommt explizite Grenzen: Adoption nur im Relations-Text belegt, Graphkarten oben teilweise angeschnitten, keine Aussage über Kantenbeschriftung. CITY-06 benötigt Beziehungen mit Art und Richtung als gemeinsame Datenreferenzen; die Baumansicht wird daraus abgeleitet und öffnet vorhandene Bewohnerdaten. Sichtbarer Originalgraph darf keine zweite Familien-Datenhaltung legitimieren. Umsetzungsbeleg und Aufräumreview prüfen Manifesthashes, Semantik und offenen Status.

## CITY-00-I06-P: Canvas-of-Kings-Testadapter

Nutzer hat den isolierten RFB/VNC-Steuerungsweg am 09.10. ausdrücklich erlaubt. Unter `tools/canvas-of-kings/` eigener Starter und Identitätswächter; vorhandenen generischen RFB-Protokolltransport importieren, nicht dessen Wonderdraft-Starter/Profil/PCK-Identität übernehmen. Steam-Demo 3122210 über Appmanifest, Installationspfad, gestreamten SHA-256 des 1,89-GB-Programms und beider Bibliotheken identifizieren; Steam-buildid ist kein semantischer Versionsnachweis. Privates HOME/XDG-Profil, Anzeige, D-Bus ohne Serviceaktivierung und nur lokale RFB-Bindung. Gemeinsame flock-Sperre während der gesamten Sitzung; keine fremden Prozesse beenden. Alle eigenen Prozesskennungen mit Startticks/realem Executable prüfen, nur eigene Kinder stoppen. Neue absolute Laufverzeichnisse unter externem QA-Root, keinerlei Installation im Vault oder Änderung des Steam-Bestands.

Offline-Review vor Start: ungültige App-/Manifest-/Profilpfade ablehnen, Identität und Speicherverhalten prüfen, bestehende RFB-Gesten unverändert wiederverwenden. Hardware-Rendering zunächst unverändert; ein notwendiger Rendering-Fallback wäre gesondert als Abweichung zu belegen. Basisprüfungen plus gezielter Lifecycle-/Identitätscheck. Native Probe erst nach freiem Kollegen-Slot und Sperrerwerb. Erster enger Lauf: tatsächlicher Startframe, sichtbare Versions-/Demo-Signale, neues QA-Dokument, Pfad-/Flächenwerkzeuge und Überblick/Detail; jeden nächsten Klick aus einem frischen Bild ableiten. Originalstartfehler und fehlende Funktionen bleiben offene Befunde; kein Dummy-Renderer und keine blinden Werkzeugfolgen. Review und getrennte Aufräumläufe folgen.

## CITY-00-I06-CP: Adapter-Sperrvertrag härten

R01/R02 vor Live-Probe schließen: Starter muss echte eigene FLOCK-WRITE-Sperre aus `/proc/<pid>/fdinfo` am eigenen offenen Lock-Deskriptor mit PID und Inode nachweisen, statt allein dem Reentry-Umgebungswert zu vertrauen. Manifest erhält Sperreigentümer-PID/Startticks/Executable. Wrapper prüft diesen Eigentümer und Sperre erneut sowie Anzeigeformat, Port=5900+Display, feste Framegröße und die vier Rollen. Bibliothekhashes bleiben unabhängig gestreamt; keine RFB-Eingabe bei ungültigem Vertrag. Offline-Test mit eigener temporärer flock-Datei (nicht gemeinsamer GUI-Sperre) belegt positive Sperre und zurückgewiesene unbelegte Reentry. Dann eigener Reparatur-/Aufräumreview vor Originalstart.

## CITY-00-I06-NI: direkte Demo-Kernwirkung

Demo0.4.06 (Steam-build16643264) startet mit eigenem HOME/XDG. Pfad aus zwei Punkten, dessen Kontrollpunktverschiebung, automatisch gefüllte Plot-Kontur und Eckverschiebung direkt belegt.25 Frames unter city00-cok-i06-20261009-01. Begrüßung nennt Funktions-/Inhaltsbegrenzung und automatisch reduzierte Grafikqualität: keine volle Grafikfreigabe. Save As erreichbar, aber zwei Pfad-Eingaben bestätigen keine Datei; Hypothese beendet, Exit/Do Not Save schließt den eigenen Testentwurf mit normalem Code0. Kein fremdes Dokument verändert.

Neue direkt sichtbare Pflichtkandidaten CO-COK-0006–0011: native Save/Open und Undo/Redo an gemeinsamer Atlas-Persistenz/History; Snapping/Kollision an topology/constraints; optionale Meterhöhe an Geometrie und Darstellung; benutzerdefinierte Assetdefinitionen/Editor und Community-Assetsuche an gemeinsamer Assetbibliothek. Die konkrete Steam-Workshop-Bindung, Demozugang und funktionale Tiefe sind vor Implementierung im Original zu prüfen; ein Menülabel ist kein Integrationsnachweis. Keine eigene History, doppelte Assethaltung oder Pixelhöhe. Höhenwerte benötigen Migration/Bounds in CITY-01 und Wirkung erst mit Detaildarstellung CITY-07.

## CITY-00-I06-NCP: Originalbeleg-Metadaten bereinigen

NR01: Neue CO-COK-0006–0011 auf tatsächlichen Demoquellbezug (Steam3122210) und protokollierten Sitzungszeitraum setzen. Die frühere offizielle Vollversions-Dokumentation als eigene Herkunft erhalten; keine Vollversionsprobe daraus machen. CO-COK-0001 ursprüngliche Dokumentsichtung ausdrücklich behalten und letzte direkte Beobachtung getrennt datieren. NR02: unklare aggregierte Ergebniszahl durch konkrete Referenzliste je Produkt mit Probeumfang, Manifest und verbleibender Galerieanforderung ersetzen. Artefakte/Historie/IDs unverändert,51 unabhängige offene Pflichten, CTY- und fremde Wurzeln prüfen. Keine zweite native Sitzung hierfür.

## CITY-00-I07-P: vollständige Save-As-Folge und benannte Presets

Neue Hypothese anhand I06-Frames019–022: Absolute Pfade im File-Feld deaktivieren OK. Nach Path-Eingabe/Enter ist File leer; der schmale Path-Text zeigt nur den Anfang `/home/a` und belegt kein Zurücksetzen. I06 hat keinen einfachen Dateinamen anschließend gesetzt und keinen Speicherabschluss geprüft. Deshalb keinen Produktfehler behaupten. Neue vollständige Folge im frischen privaten HOME: kleinen klar benannten Pfad/Plot erzeugen, Save As öffnen, Path auf ein eigens angelegtes privates `home/maps` setzen, Enter, File nur `CITY00-SAVE.mommap`, aktiviertes OK bedienen. Tatsächliche Datei/Hash erst nach sichtbarem Dialogschluss feststellen. Normaler Originalabschluss, dann neuer Prozess und frische Öffnung dieser unveränderten QA-Datei. Keine Instrumentierung oder Bearbeitung der Originalkartenstruktur; Dateidialoge ausschließlich im eigenen QA-Profil. Höchstens zwei erfolglose vollständige Folgen, dann entscheiden.

Preset-Inventar: Listenansicht/Tooltip aus sichtbaren Controls für Pfad-/Plot-Assets nutzen, echte Namen sichern, verfügbare Gebäudekategorien und Demo-/Vollversionsgrenzen trennen. Kein schneller Stadtgenerator oder individuell editierbare Ergebnisobjekte aus bloßer Plotwirkung ableiten. Erst der direkte Preset-/Korrekturablauf kann diese Tiefe belegen. Native Slotkoordination vor Start; bei belegtem Hex-Slot weiter Browser-/Offlinearbeit. Umsetzung, Originalreview und Aufräumplanung/-umsetzung/-review bleiben getrennte Läufe.

## CITY-00-I07-BP: FTG-Tageslicht während reserviertem Hex-Slot

COK-Neuöffnung bleibt als I07-I ausstehend, bis der Hex-Kollege die Farben-Session beendet. Unabhängige Browserprobe für CO-FTG-0019: bestehendes eigenes CITY00 Hamlet QA verwenden, Render settings/Shadows–Sun mit aktiviertem Day/night cycle dokumentieren. Sichtbare Uhr-/Weltparameter inventarisieren; wenn zugänglich 11-Uhr-Tag gegen Abend/Nacht aufnehmen und Renderwirkung bei identischer Uhrzeit mit Zyklus an/aus vergleichen. Vor jeder Mutation Ausgangswert sichern, Rendererpräferenz anschließend auf Ausgangswert zurückstellen. Keine fremde Siedlung oder Kontodaten. Wetter/Saison getrennt nur soweit echte Controls vorhanden sind. Keine Zeit-/Wetterwirkung aus Exportmenüs ableiten.

Zusätzlich entdeckte General-/Effects-Controls als eigenständige Pflichtkandidaten inventarisieren: Dachdarstellung, Dekorationsanteil, Materialvariation, Renderer-/Qualitätsoptionen und Bildeffekte. Sichtbare 3D-/Street-view-Option hat laut Original Einschränkungen; Umfang bleibt ausdrücklich offen und benötigt eigene Wirkung/Architekturprüfung vor Annahme einer zweiten Editoroberfläche. CITY-07/08 nutzen dieselben Meterdaten, Asset- und Kamerareferenzen; Darstellungsoptionen dürfen keine doppelte Karte/History erzeugen. Originalbelege werden unter city00-i07-browser-20261009 gesichert und separat reviewt/aufgeräumt.

## CITY-00-I07-BI: Wetter-/Nachtwirkung und Darstellungsinventar

26 Originalartefakte im externen Manifest city00-i07-browser-20261009. Schnee(clear) macht den Sommerboden weiß; Winter verändert Laubbäume und Saison-Sonnenvorgaben. 23 Uhr mit Zyklus an/aus/wieder an verändert die Helligkeit; alle Ergebnisframes zeigen250m. Uhr11Montag, Clear/Summer/Northern/East mit SaisonvorgabenHigh5/21 und aktivierter Zyklus wiederhergestellt. Version unbekannt, übrige Wetter-/Sonnenfälle und Bewohner-Zeitwirkung offen.

CO-FTG-0031–0042 erweitern die offenen Pflichten um Dachmodi, Dekorationssichtbarkeit, Texturen, Materialfarben, Feldkanten, Wasserwirkung, AA/FPS, Schattenauflösung, Bildeffekte, SVG-Gerätefallback, experimentelle3D/StreetView und Ruhetagüberschreibung. Controls belegen noch keine Wirkung. CITY-07: versionierte Renderpräferenzen und feste Weltzeit; Dachmesh aus derselben Meterkontur, Texturen/Materialfarben aus gemeinsamer Assetreferenz, deterministische saisonale Vegetation und Wetterpass; Bildeffekte nur Darstellung, keine Geometrieveränderung. Schatten/Feldfade/Wasser bleiben ableitbare Renderpässe. Ruhetagoverride gehört an Weltkalender/Simulation und dieselben Personen-IDs. CITY-08: gemeinsame Qualitätspräferenzen, getrennte gemessene Renderzeiten/FPS, sichtbar reduzierte Qualität bei Gerätefallback; SVG aus denselben Geometrien, keine zweite Datenhaltung. CITY-07/08:3D/StreetView benötigt vor Implementierung eine eigene Originalprobe und Architekturentscheidung für Perspektive/Navigation auf denselben Weltmeterdaten; keine zweite Editor-/Historybasis.

Bedienziel: Darstellungsänderung erhält Kamera, Zoomanker und Auswahl; Original-Render-Save setzt hier Kamera zurück. Bessere Bedienung bleibt durch gepaarte Aufgaben nachzuweisen. Keine Produktabnahme aus Referenzbildern.

## CITY-00-I07-BCP: Referenzmetadaten bereinigen

I07-BR01: CO-FTG-0039 um die direkt sichtbaren Color-effect-Optionen None/Greyscale/Sepia/Green tint erweitern; keine Wirkung behaupten. I07-BR02: externe Ergänzung zum unveränderten Rohmanifest mit den konkreten Rückstellungsframes sowie identischem Bildausschnitt für Helligkeitswerte erzeugen. Grauwertmittel ist nur eine Zusatzmessung des Originalbildes, keine Geometrie-/Bedienabnahme. Quelldateien unverändert erhalten, Hashes erneut prüfen. Eigener Umsetzungslauf BCI, danach BCR prüft beide Befunde und fremde JSON-Wurzeln.

## CITY-00-I08-P: FTG-3D und Street View

CO-FTG-0041 bislang nur sichtbarer Control. Eigene temporäre Siedlung: General-Ausgangswerte und Tageskarte sichern, ausschließlich3D-Unstable aktivieren, Save, tatsächliche Karte und neue Navigationscontrols prüfen. Street-View nur über sichtbare Originalcontrols aufrufen; Ablauf, Lage/Orientierung und Rückkehr dokumentieren. Keine Wirkung aus Hinweistext ableiten. Anschließend3D wieder ausschalten und Ausgangsuhr/Wetter/übrige Renderwerte erhalten; Kamera nach Save am gleichen Maßstab prüfen. Höchstens zwei erfolglose Folgen. Originalartefakte in city00-i08-browser-20261009; eigener Review und getrennte Aufräumläufe. COK-I07 bleibt bis Hex-Slotfreigabe ausstehend. Architekturfolgen erst aus tatsächlicher Probe ableiten und in ARCHITECTURE.md festhalten.

## CITY-00-I08-CP: Perspektivbelege und Vertragsgrenze bereinigen

Originaldateien unverändert erhalten. Externe Bereinigung ordnet General-Controlwerte vor/nach und den tatsächlich angewandten Rückkehrframe zu. StreetView-Einstieg ist Perspektivdarstellung, keine belegte Fortbewegung; keine Aussage über Kollision oder gespeicherte Kameraposition. Das optionale Darstellungsziel darf CTY-002.03/005.02 nicht verdrängen: Region/Stadt/Haus/Raum bleiben per Zoom im gemeinsamen Editor bearbeitbar. Perspektivnavigation benötigt denselben Placementgraph, dieselben Meterdaten und stabile Auswahl; zusätzlicher Editor, Datenduplikation oder eigene History erfüllen den Auftrag nicht. Diese Anforderungen präzisieren die künftige Planung, implementierte3D-APIs existieren noch nicht. CI ergänzt Belegzuordnung; CR prüft Hashes, Präferenzwerte, Quellenumfang und erhaltene Fremdwurzeln.

## CITY-00-I07-CP: RFB-Eingaben eindeutig halten

I07-R01: COK-Wrapper übergibt wiederholte Optionen an den generischen Parser; bei zwei --click bleibt nur das letzte. Eigener COK-Vorparser prüft unterstützte Stringoptionen und Parser-Tokens auf doppelte Namen, auch --click=Form, vor Dateilesen/Identitätsprüfung/Verbindung. Der generische Wonderdraft-Transport bleibt unangetastet. Ein CLI-Regressionstest mit absichtlich nicht existierender Session belegt den frühen Duplicate-Fehler; gültige Kombinationsaufrufe und Text mit Optionszeichen bleiben möglich. README verlangt einen Klick je Aufruf. check/test/build und separater Reparaturreview; Rohframes und gespeicherte Originalkarte unverändert. Normaler Originalexit0 trotz verfrüht geschlossenem Screenshottransport bleibt getrennt dokumentiert.

## CITY-00-I09-P: kleine Ergebnisgalerie und offene Umsetzungspflichten

Das bestehende CITY-00-Tor fordert eine kleine feste Galerie, nicht die vollständige Hostabnahme jedes späteren Features vor CITY-01. Galerie bündelt eigenes FTG-Dorf, Watabou-Mauer-/Hafenübersicht und Detail, zusätzlich ein kleines Watabou-Dorf/eine Binnen-Mauerstadt aus sichtbaren Originalcontrols sowie eine ausgearbeitete COK-Draufsicht. Offiziell veröffentlichte COK-Bilder dürfen als Ergebnisvorbild dienen, werden ausdrücklich als veröffentlichte Galerie statt eigener Vollversionsprobe bezeichnet; Datum, Quelle, unveränderte Bildbytes/Hash und Ausschnitt dokumentieren. Demo-Market-Kleinkarte bleibt eigener Wirkungsbeleg und ersetzt keine Gebäude-/Stadtgalerie. Kein Kauf oder Vollversionszugang wird vorausgesetzt.

63 funktionale Pflichten bleiben vollständig erhalten und nach Zielphase geordnet. Übersicht zeigt getrennt: Inventarquelle, direkte Originalwirkung, eigene Umsetzung, Hostvergleich und Bedienvergleich. Control-only bedeutet keine Funktionsfreigabe. Fehlende Details werden spätestens vor dem entsprechenden Produktpaket nachgemessen. Veraltete referenceGate-Formulierung gegen Werkzeuginventur im Review mit dem erweiterten Funktionsauftrag abgleichen; keine Originalgestenpflicht daraus machen. Nur wenn alle vier Galerieformen, Grenzen und Ergebniskriterien belegt sind, das Ergebnistor schließen; Vollinventur-/Paritätsabschluss und HEX-05 getrennt offenhalten. Artefakte unter city00-i09-gallery-20261009. Eigener Review, danach getrennte Aufräumplanung/-umsetzung/-review.

## CITY-00-I09-CP: Galerieabschluss und Metadaten bereinigen

I09-R01: Galerietor nur für die vier Ergebnisformen schließen; vollständiges Funktionsinventar, eigene Wirkung und bessere Bedienung ausdrücklich offen. Keine Originalgeste als Pflicht, aber Funktionsinventur erforderlich. I09-R02: aktuelle Referenz-/Galerieangaben auf das feste Manifest verweisen und den Demoquelltext mit erfolgreicher I07-Speicherung/Neuöffnung berichtigen; historische Beobachtungen und alle63 Kandidaten/24 CTY-Fälle unverändert erhalten. CITY-00 als Referenzpaket bleibt wegen voller Inventur offen, HEX-05 weiter eigenständige Voraussetzung. I09-R03: veröffentlichten Nahbildnamen auf bridge-detail berichtigen, Hash und Quellenumfang erhalten; AVIF-Banner aus der Ergebnisgalerie ausschließen. Eigener Umsetzungslauf mit JSON-Wurzelschutz; danach unabhängiger Review von Hashes, Ausschnitten, Gategrenzen und Pflichtstatus. Keine Produktcodeänderung für diese Metadatenphase.
