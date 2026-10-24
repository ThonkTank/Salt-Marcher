# Wonderdraft: Originalinventar und verbindlicher Funktionsvergleich

Dieser Plan ergänzt die [Hex-Atlas-Roadmap](ROADMAP-HEX-ATLAS.md). Für die weitere Umsetzung gelten die gemeinsamen [Ergebnisgleichwertigkeit und Lieferprioritäten](ROADMAP-HEX-ATLAS.md#wie-kommen-wir-zum-ziel). Vorhandene Inventare und Belege verwenden; unklare fachliche Wirkung gezielt vor ihrer Lieferung im Original prüfen. Eine vollständige Wiederholung aller UI-/Gestenproben ist keine Voraussetzung für einen benutzbaren Ausbau. Der erste benutzbare Hex-Editor bleibt das Ziel von HEX-02; der Ort-Dungeon-Raum-Key-Ablauf das Ziel von HEX-05.

Der verbindliche Katalog steht unter **`acceptance.json.wonderdraftParity`**. Die vorhandenen Dungeondraft-Anforderungen und deren Abnahmen bleiben eigenständig. Das dortige bisherige Wurzelfeld `inventoryComplete` beschreibt keine Wonderdraft-Vollständigkeit.

Die [Stadtplan-Roadmap](ROADMAP-CITIES.md) ergänzt Ergebnisvorbilder von Canvas of Kings und Watabou; deren Bedienung wird eigenständig vereinfacht und geprüft. Für den gesamten Atlas gilt: keine separaten Modi, eine gemeinsame bearbeitbare Ansicht und sämtliche räumlichen Detailstufen allein durch Zoom. Die eigenen Werkzeuge erreichen dieselben fachlichen Ergebnisse ohne Karten-/Editorwechsel; Originalgesten sind keine Nachbaupflicht. Stadt-Ergebnisfälle stehen getrennt unter `acceptance.json.cityPlans`.

## Referenz und Aussagegrenzen

Referenz ist die lokal installierte **Wonderdraft-Version 1.1.8.2** unter `/home/aaron/.local/opt/Wonderdraft/`. Programm- und Paketprüfsummen stehen im Katalog. Die Versionskennung ist in den lokalen Paketdaten und direkten Originalaufnahmen belegt. Der aktuelle Umfang und offene Original-/Reviewpflichten stehen im Katalog; einzelne Bedienaufnahmen ersetzen keine vollständige Inventarfreigabe.

Der erste Katalog enthält **36 Inventargruppen und 79 konkrete Ausgangsproben**. Sämtliche 35 Werkzeug- und 61 UI-Modulpfade aus dem lokalen Programmpaket sind Gruppen zugeordnet. Das belegt vorhandene Paketbestandteile; Erreichbarkeit, genaue UI-Namen, Defaults und Wirkung bleiben bis zur Originalprobe offen. Hilfsmodule können dieselbe Funktion unterstützen, unbenutzt sein oder reine Programmoberfläche betreffen. Diese Unterscheidung wird im Inventarreview belegt.

Die [offizielle Funktionsübersicht](https://wonderdraft.net/), der [Quick Guide](https://github.com/Megasploot/Wonderdraft/wiki/Quick-Guide) und die [Shortcuts](https://github.com/Megasploot/Wonderdraft/wiki/Shortcuts) liefern Suchhinweise für Werkzeuge und Abläufe. Sie sind nicht auf die lokale Version festgelegt und ersetzen deren direkte Beobachtung nicht. Die Ausgangsproben sind **kein abgeschlossener Unterfallkatalog**: Eigenständige fachliche Wirkungen werden mit den vorhandenen Unterfällen verbunden. Mehrere Regler oder Eingabewege derselben Wirkung dürfen denselben eigenen Zugang verwenden; Originaldaten bleiben unverändert nachlesbar. Sammelproben werden dafür bei Bedarf aufgeteilt; IDs bleiben erhalten.

## HEX-00: bestehende Referenzläufe und offene Fachfragen

### HEX-00-A – Oberfläche vollständig zuordnen

Eine isolierte Kontrollkarte und ein eigenes Testprofil verwenden. Zunächst alle Kategorien, Werkzeugleisten und Menüs öffnen. Anschließend jeden Werkzeug-, Auswahl- und Dialogkontext durchgehen: leere Karte, begonnener Entwurf, fertig platziertes Element, Einzel-/Mehrfachauswahl, offener Farbdialog und Texteingabe. Dabei alle erreichbaren Optionen, Unterdialoge, Kontextaktionen und Tastenkürzel erfassen.

Jeder Eintrag in `uiInventory` erhält:

- Exakten Originalpfad, sichtbaren Namen, Kontext und Version.
- Steuerelement, sichtbaren Default, verfügbare Werte beziehungsweise Grenzen und unmittelbar beobachtete Validierung.
- Geste oder Shortcut einschließlich Modifier sowie Vorschau-/Commit-Zustand.
- Stabile WD-Kennung und zuständige Produktphase.
- Direkten Bildschirm-/Bedienbeleg; bei noch ungeklärter tieferer Kartenwirkung eine ausdrückliche offene Frage.

Eigenständige Wirkungen müssen ihren bestehenden Unterfällen zugeordnet bleiben; ein pauschaler Fall „Symbolwerkzeug vorhanden“ genügt nicht. Neue fachliche Funktionen werden im vorhandenen Register ergänzt. Mehrere Eingabewege bleiben als Originalbeobachtung nachlesbar, brauchen aber keine getrennten identischen Hostgesten. Ein Paketname wie `box_tool`, `warlock_panel` oder `rasterizer` wird erst nach seiner Einordnung als erreichbarer Befehl oder interner Helfer klassifiziert. Programmservices wie Update-/Nachrichtenoberflächen erhalten ebenfalls eine begründete Einordnung; sie verschwinden nicht still aus dem Inventar.

**Referenzumfang:** Die vorhandene Oberflächeninventur bleibt erhalten. Für eine Lieferung müssen ihre fachlichen Wirkungen eindeutig sein; unklare spätere Wirkungen bleiben offen zugeordnet. Das historische Inventartor behauptet keine aktuelle Ergebnisgleichwertigkeit.

### HEX-00-B – Ersten Originalablauf vollständig belegen

Auf einer kleinen Originalkarte: neu anlegen → bewegen/zoomen → kleine Insel zeichnen → Farbe ändern → Zeichnen abbrechen → Undo/Redo → speichern → Karte wechseln → vollständig neuen Wonderdraft-Prozess starten → dieselbe Karte öffnen. Neuanlagedialog und Speicherdialog zusätzlich abbrechen; Escape im Entwurf, in ruhender Vorschau und im Dialog unterscheiden.

Die Startfälle sind `WD-001.01/.02`, `WD-002.01/.02`, `WD-003.01–.03`, `WD-004.01/.02`, `WD-005.01`, `WD-007.01`, `WD-021.01` und der Neuanlageanteil von `WD-026.01`. Ihre vorhandenen Originalbelege bleiben erhalten; fehlende Aufgabenwirkungen werden gezielt vor dem betroffenen Ausbau geklärt. Der vollständige Variantenvergleich ihrer späteren Ausbauanteile folgt in den angegebenen Fachphasen.

Vorlagen, exakte Eingaben, räumlicher Ausschnitt und Assets für die späteren Hostpaare festlegen. Maße und Pinselgröße in Originalpixeln sowie der vereinbarten Atlasumrechnung festhalten. Eine isolierte Kopie eines vorhandenen Dungeons bildet zusätzlich die spätere gemeinsame Testregion; produktive Karten und Texte bleiben geschützt.

**Tor:** Startfolge, Zustandswechsel, gespeicherte Wirkung und frische Originalöffnung sind direkt belegt. Die ersten Hostläufe haben festgelegte Vergleichsdaten.

### HEX-00-C – Inventar getrennt reviewen

Oberfläche, Inventar und Unterfälle erneut abgleichen. Keine neu implementierte Oberfläche als Vorlage nehmen. Werkzeuggruppen, Dialogoptionen, Gestenkontexte, Paketkandidaten und Startfolgen auf Lücken prüfen. Jeder Ausschluss beziehungsweise jede Hex-Anpassung braucht eine nachvollziehbare Entscheidung; fehlende Beobachtung ist kein Ausschlussgrund.

**Referenzreview:** Der vorhandene Review und seine Aussagegrenzen bleiben erhalten. Neue Lieferungen benötigen eindeutige Ergebnisanforderungen und passende Aufgabenbelege, kein erneutes vollständiges Original-UI-Tor. Offene spätere Wirkungen bleiben sichtbar; Gruppen- oder Testzahlen beweisen keine Gleichwertigkeit.

## Vorläufige Original→Phase-Zuordnung

Die Namen sind Arbeitsgruppen; die exakten Original-UI-Pfade werden in HEX-00-A aufgenommen. Mehrere Phasen bedeuten zunächst eine Grundfunktion und später ihren vollständigen Ausbau. Die `.01`-Kennungen stehen für konkrete Ausgangsproben im Katalog, nicht für bereits verifizierte Originalregeln.

| Gruppe | Originalbereich / zu klärender Kandidat | Ausgangsproben | Zuständige Phasen |
|---|---|---|---|
| WD-001 | Neue Karte und Größenvorgaben | WD-001.01–.02 | HEX-01, HEX-26 |
| WD-002 | Kamera, Zoom und Werkzeugwechsel | WD-002.01–.02 | HEX-01 |
| WD-003 | Speichern, Öffnen und Kartenwechsel | WD-003.01–.03 | HEX-02, HEX-07 |
| WD-004 | Undo/Redo und Abbruch | WD-004.01–.02 | HEX-02 |
| WD-005 | Landmassenpinsel und organische Küste | WD-005.01–.02 | HEX-02, HEX-11 |
| WD-006 | Land anheben, absenken und entfernen | WD-006.01–.02 | HEX-11, HEX-16 |
| WD-007 | Bodenfarbe und Biome | WD-007.01–.02 | HEX-02, HEX-11, HEX-24 |
| WD-008 | Meer, Wasserfarbe und Erscheinung | WD-008.01–.02 | HEX-12, HEX-24 |
| WD-009 | Seen, Süßwasser und dessen Radierung | WD-009.01–.02 | HEX-12 |
| WD-010 | Fluss zeichnen | WD-010.01–.03 | HEX-13 |
| WD-011 | Straßen und Pfade zeichnen | WD-011.01–.02 | HEX-14 |
| WD-012 | Fluss- und Pfadgeometrie bearbeiten | WD-012.01–.02 | HEX-13, HEX-14 |
| WD-013 | Landmassenerzeugung | WD-013.01–.02 | HEX-15 |
| WD-014 | Heightmap und importierte Höhen | WD-014.01–.02 | HEX-16 |
| WD-015 | Landmassenauswahl und Ausschnitt | WD-015.01–.03 | HEX-23 |
| WD-016 | Einzelne Symbole platzieren | WD-016.01–.02 | HEX-17 |
| WD-017 | Symbolauswahl und Transformation | WD-017.01–.03 | HEX-17 |
| WD-018 | Wald-, Berg- und Symbolpinsel | WD-018.01–.02 | HEX-18 |
| WD-019 | Symbole radieren | WD-019.01–.02 | HEX-18 |
| WD-020 | Assetbibliothek und eigene Inhalte | WD-020.01–.03 | HEX-19 |
| WD-021 | Farbdialoge und Paletten | WD-021.01–.02 | HEX-02, HEX-11, HEX-12, HEX-19, HEX-24, HEX-20, HEX-21, HEX-25 |
| WD-022 | Beschriftungen und Textbearbeitung | WD-022.01–.03 | HEX-20 |
| WD-023 | Namensgeneratoren | WD-023.01 | HEX-20 |
| WD-024 | Gebiete und Grenzen | WD-024.01–.02 | HEX-21 |
| WD-025 | Nachzeichenvorlagen | WD-025.01–.02 | HEX-09, HEX-26 |
| WD-026 | Themen und Gestaltungsvorlagen | WD-026.01–.02 | HEX-01, HEX-24 |
| WD-027 | Karteneffekte | WD-027.01–.02 | HEX-24 |
| WD-028 | Kartenrahmen | WD-028.01–.02 | HEX-25 |
| WD-029 | Kompassrose | WD-029.01–.02 | HEX-25 |
| WD-030 | Maßstab und Messwerkzeug | WD-030.01–.02 | HEX-25 |
| WD-031 | Raster und Darstellung | WD-031.01–.02 | HEX-26 |
| WD-032 | Kartengröße und Ausschnitte | WD-032.01–.02 | HEX-26 |
| WD-033 | PNG/JPEG und Exportdialoge | WD-033.01–.03 | HEX-10, HEX-27 |
| WD-034 | Vorgaben, Tastenkürzel und Eingabegeräte | WD-034.01–.03 | HEX-26 |
| WD-035 | Ebenen- und Kontextoberfläche | WD-035.01–.02 | HEX-17, HEX-24, HEX-26, HEX-20, HEX-21, HEX-25 |
| WD-036 | Ungeklärte Oberflächen und Hilfsmodule | WD-036.01–.02 | HEX-00 |

HEX-03/04/05/06/07/08/22 enthalten zusätzlich eigene Projektanforderungen: Orts-Keys, Verortung, mehrere Hex-Stufen, Wiederherstellung und gemeinsame Detailkarten. Diese Anforderungen haben keinen behaupteten Wonderdraft-Originalfall. Kamera-, Speicher- und Darstellungsfunktionen werden dort dennoch regressiert. HEX-28 wiederholt den Gesamtkatalog am Endstand; es ist keine nachträgliche Inventarphase.

## Vorgehen je Werkzeugphase: wie beim Dungeondraft-Abgleich

Der Vergleich prüft gleiche fachliche Aufgaben und gespeicherte Ergebnisse gemäß [Ergebnisgleichwertigkeit](ROADMAP-HEX-ATLAS.md#wie-kommen-wir-zum-ziel):

1. **Original messen:** Zugeordnete Unterfälle und Inventarkontrollen lesen. Kontrollkarte, Programm/Paket, Profil und Assets festhalten. Die für die Aufgabe relevante Wirkung mit Vorschau, Abschluss, Abbruch und gespeicherten Daten beobachten. Unklare fachliche Optionen/Abhängigkeiten gezielt prüfen; keine Pflicht zur Wiederholung jeder Originalreglerkombination.
2. **Original→Editor festlegen:** Für jeden Unterfall das erreichbare fachliche Ergebnis und seinen eigenen Werkzeug-/Options-/Aktionszugang benennen. Mehrere Originalaktionen dürfen dieselbe Hostfunktion belegen. Einheiten-/Hex-Anpassung mit Begründung dokumentieren. Unbekanntes Verhalten vor dem betroffenen Produktcode nachmessen. Eine ähnlich aussehende Eigenlösung ohne geforderte editierbare Wirkung schließt keinen Originalfall.
3. **Einen kleinen Ablauf umsetzen:** Den begrenzten Phasenablauf benutzbar machen; notwendige Kernregeln prüfen. Erweiterte Optionen behalten ihre eigenen Unterfälle. Ein funktionierender früher Teststand darf mit offenen Paritätsfällen bereitstehen.
4. **Auf einem festen Build paaren:** Gleiche Assets, Startwerte und logisch gleiche Geometrie im isolierten Obsidian verwenden. Vorschau, Grafik, Klicktreffer und gespeicherten Zustand gemeinsam prüfen. Betroffene Abbruch-, Undo/Redo-, Save- und Neuöffnungsfolge mit vollständig neuem Prozess ausführen. Anschließend den bislang verfügbaren Atlas-Kernablauf prüfen.
5. **Funktionsvergleich prüfen:** Original- und Hostbelege unabhängig prüfen; kritische Proben auf demselben Build wiederholen. Offene Pflichtabweichungen benötigen Korrektur und eine passende Regression.

Pro Phase entstehen zuerst wenige repräsentative direkte Original-/Hostpaare; Varianten folgen anhand des bereits vollständigen Inventars. Jede zentrale Lieferstufe liefert einen benutzbaren, geprüften Zwischenstand. Ein grober Hex-Geländepinsel nach HEX-02 ist eine frühe Ausbaustufe; die vollständige organische Küstenwirkung wird erst durch HEX-11 und ihre Originalpaare belegt.

### Fehler aus dem Dungeondraft-Vergleich gezielt vermeiden

| Beobachtete Vergleichsfalle | Verbindliche Wonderdraft-Probe |
|---|---|
| Ein ähnlich benannter Ordnungsbefehl wurde mit einer Platzierungsvorgabe gleichgesetzt. | Platzierungsebene, nachträgliche Anordnung, sichtbare Überdeckung, Klicktreffer und gespeicherte Folge getrennt messen (`WD-017.03`, `WD-035.01`). |
| Optionsänderung und Änderung schon platzierter Instanzen wurden vermischt. | Erst A platzieren, eine Option ändern, dann B platzieren; A, B und nächste Werkzeugvorgabe vergleichen (`WD-016.02`, `WD-021.02`). |
| Eine allgemeine Auswahlregel war für Teilüberlappungen zu ungenau. | Mittelpunkt innen/außen, Konturteil und vollständige Kontur an verschiedenen Elementtypen direkt prüfen (`WD-015.01`, `WD-017.01`, `WD-019.01`). |
| Escape im Picker wurde aus Escape im ruhenden Werkzeug abgeleitet. | Entwurf, ruhende Vorschau, offene Dialoge und Textfokus getrennt prüfen (`WD-004.02`, `WD-021.01`, `WD-022.03`). |
| Gespeicherte Kartenfarbe wurde mit einer globalen Werkzeugpalette verwechselt. | Karte A → B → A plus vollständiger Prozessneustart; lokale, globale und flüchtige Werte unterscheiden (`WD-003.03`, `WD-007.02`). |
| Kachel-/Objektzahl galt als Nachweis für sichtbare und richtig ausgewählte Assets. | Reales Vorschaubild, Assetkennung, Cursor, fertige Instanz und gespeicherten Verweis zusammen prüfen (`WD-016.01`, `WD-020.01`). |

Eine frühere Dungeondraft-Regel wird dabei als Anlass für die Probe verwendet, niemals als angenommene Wonderdraft-Regel.

## Kontrollkarten und Nachweise

| Kontrollkarte | Zweck |
|---|---|
| WD-F01 | Kleine neue Karte, Kamera, erste Züge, Abbruch und History. |
| WD-F02 | Insel mit Bucht, Landzunge, See und kontrollierter Graustufen-Heightmap. |
| WD-F03 | Flussgabel, See-/Meeresanschluss und zwei Pfadstile. |
| WD-F04 | Identifizierbare überlappende Symbole, Ebenen, farbbare/nicht farbbare Testassets und Pinsel. |
| WD-F05 | Labels, Textfokus, Gebietsgrenzen und Namen. |
| WD-F06 | Kontrollbild, Referenzpunkte, Rahmen, Kompass, bekannte Strecke und Export. |
| WD-F07 | Zwei Karten, Dialogzustände, Einstellungen und Kaltstart. |

Das sind vorbereitete Prüfszenarien; ihre Karten- und Assetdateien werden erst im Originalmesslauf erzeugt beziehungsweise festgelegt. Neben den kleinen Paaren wächst dieselbe kombinierte Atlas-Testregion weiter. Sonderprüfungen dürfen den funktionierenden Gesamtweg nicht ersetzen.

Pro Unterfall werden Originalversion und exakter Ablauf, Optionsmatrix, Vorschau, Abschluss/Abbruch, gespeicherte Wirkung und Neustart festgehalten. Beim Host kommen Buildhash, tatsächlicher Testvault, gepaarter Ablauf, Ergebnis und Restabweichung hinzu. Original-Rohkarten dienen als Nachweis; es ist dafür kein Produktimport des Wonderdraft-Dateiformats erforderlich. Falls gespeicherte Semantik nicht direkt aus der Datei lesbar ist, bleiben Rohdatei, Vorher/Nachher-Probe und direkte frische Originalöffnung erhalten; daraus keine ungemessenen internen Felder ableiten.

`original.path/sequence/options/effect` stehen im Ausgangskatalog bewusst auf `null`. Die `plannedOriginalProbe` beschreibt die bevorstehende Messung. Nach der Originalaufnahme werden auch `target.path/sequence/options/effect` konkret befüllt, damit jede UI-Aktion und gespeicherte Wirkung eine prüfbare Entsprechung im Editor erhält. Paketpfade und Webquellen stehen gesondert unter Referenz und Gruppen und gelten nicht als direkte Bedienbelege. Statuswechsel benötigen die jeweiligen echten Belege:

| Stand | Erforderlicher Beleg |
|---|---|
| Inventarzuordnung | Erreichbarer Originalkontext mit UI-Pfad, Kontrollen, WD-Kennung und Phase. |
| Originalregel gemessen | Direkte Folge, Optionen, beobachtete Wirkung und betroffene Speicher-/Neuöffnungsprobe. |
| Hostpaar bestanden | Derselbe Fall auf benanntem Build mit Grafik, Bedientreffer und gespeicherter Wirkung. |
| Fachfall reviewt | Unabhängige Prüfung, keine offene Pflichtabweichung im geprüften Umfang. |
| Gesamte Parität | Alle Pflichtfälle einschließlich Endstand und tatsächlicher Installation; physische Eingabe separat. |

Große Karten, Bilder, Rohdateien und Laufberichte liegen außerhalb des Nutzervaults unter `/home/aaron/.cache/dungeon-native-qa/wonderdraft-parity/`. Ergebnisse werden bei den Fällen in `acceptance.json`, der aktuelle Atlasstand in der Atlasübersicht geführt. Dieses Dokument bleibt der Vergleichsplan.

## Vereinbarte Anpassungen

Hexes als Landschaftsdaten, Weltmeter, bearbeitbare Maßstäbe ab drei Meilen, gemeinsame Atlas-Kamera und geschützte native Formatadapter folgen der [vereinbarten Architektur](docs/development/atlas-rendering.md). Für native Größenfelder und das Original-Darstellungsraster wird die konkrete Entsprechung dokumentiert. Allgemeine „Anpassung an Hexes“ darf kein Vorwand für entfallene fachliche Fähigkeiten sein. Eigene Gesten und zusammengefasste Werkzeuge sind gemäß Ergebnisgleichwertigkeit zulässig. Weitere Abweichungen werden als konkrete offene Fälle geführt.

Nutzerpräzisierung vom 9. Oktober 2026: Der Atlas wächst grenzenlos mit Landschaft, Stadt- und Dungeoninhalt. Wonderdrafts feste Pixelgröße und separate Detailkartenerstellung sind deshalb ausdrücklich vereinbarte Anpassungen in WD-001/WD-032. Ihre Originaloberflächen und Wirkungen werden weiterhin direkt erfasst. Im Editor beziehen sich Bereichsmaße auf Meilen oder Hex-Kacheln der gewählten Stufe; Ausschnitte, Erzeugung und Verfeinerung bleiben im selben Atlas. Eine Ausschnittsänderung entfernt keine außerhalb liegenden Inhalte, Zoom allein erschließt bearbeitbare Details. Pixel sind nur Anzeige-/Exportauflösung. Der Fachreview prüft diese konkrete Entsprechung; die Vereinbarung ersetzt keinen Originalbeleg oder Hosttest.

Ooke-Karten liefern Bildvorlagen; ein Import ihres proprietären Kartenformats ist nicht vereinbart. Funktions- und Bediengleichwertigkeit sind Pflicht. Ungefähr gleichwertige Grafik genügt; einzelne Pixel dienen nur der Fehlerdiagnose. Fehlende physische Maus-, Touchpad- oder Stiftprüfungen bleiben gesondert offen.
