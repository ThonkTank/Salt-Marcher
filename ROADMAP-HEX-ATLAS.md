# Roadmap: Hex-Atlas mit Wonderdraft-Parität und verbundenen Orts- und Dungeon-Keys

## Atlas auf einen Blick

**Desktop 0.157:** Regionswerkzeuge für freie Küsten, Flüsse/Wege, Orts-Keys, kalibrierte Bildvorlagen, Messung und saubere PNG-/JPEG-Ausgabe bis 8192 Pixel sind im gemeinsamen Atlas ergänzt. Kleinste Hexgröße: 3 Meilen Kante zu Kante; weiteste Ansicht: erdgroß. Bedienweg und Grenzen stehen unter [Eine Region vorbereiten](docs/ATLAS.md#eine-region-vorbereiten). Die folgende ältere Bestandstabelle bleibt eine historische Einordnung.

**Aktueller Desktopumbau:** Pro Kampagne genau eine gemeinsame Karte mit räumlichen Stadt-/Gebäudebindungen und einer Autorhistorie. Bedienung, Nachweisgrenzen und offene Fachumfänge stehen in [ATLAS.md](docs/ATLAS.md). Obsidian wird nicht weiterentwickelt. Die folgende Übersicht hält den älteren Integrationsstand fest und ist keine Freigabe des Desktopumbaus.

**Ziel:** Welt → Region → Stadt → Haus → Dungeonraum durch Zoom erreichen und direkt bearbeiten; eine Kamera, eine Undo/Redo-Folge und gemeinsame haltbare Daten.

**Geprüfter Stand: 13.10.2026**, gemeinsamer Branch `active/installed-phase1`, Commit [af858153](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/commit/af85815313aac6e964e235d3e7acbdf294cce0e0). Der Atlas besitzt bereits einen benutzbaren Hex-/Ortskern, integrierte Stadt-/Dungeon-Teilabläufe und den ersten begrenzten Bildexport. Der vollständige Zielablauf und E2E-01 bleiben offen.

### Was funktioniert, was fehlt?

**Integriert** bedeutet im gemeinsamen Branch vorhanden, **Kandidat** bedeutet nur im genannten offenen PR. Die Belege bestätigen jeweils begrenzte Abläufe; vollständige Fachabnahme und lokal installierte Pluginversion sind daraus nicht ableitbar.

| Fähigkeit | Bereits umgesetzt / Beleg | Fehlt zum Ziel |
| --- | --- | --- |
| Hexgelände | **Integriert:** grenzenloser Atlas; 3-Meilen-Hexes mit Land, Meer, Wald und Farbe; Pinsel, Zurücksetzen, Undo/Redo, Speichern und Entwurf. [HEX-01/02](acceptance.json) | Vollständige Landschaftswerkzeuge und Gleichwertigkeit mit dem Original. |
| Mehrere Maßstäbe | **Teilweise:** größere Raster beim Herauszoomen; Gelände wird auf der kleinsten Stufe gespeichert. [Terrainformat](src/features/atlas/terrain-schema.ts) | Alle Hexstufen bearbeiten; grobe Vorgaben und geschützte feine Überschreibungen, HEX-06. |
| Orte und Orts-Keys | **Integriert:** Stadt-/POI-Marker anlegen, verschieben, Markdown bearbeiten; gemeinsame Rücknahme, Speichern und Neustart belegt. [Abschluss #40](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/40#issuecomment-6102165161) | Links nach Umbenennung und vollständigen Ablauf abnehmen. |
| Vorhandene Stadt bearbeiten | **Integriert:** Häuser und Straßenknoten verschieben, Hausnamen ändern und Häuser drehen. Begrenzte Obsidian-Speicher-/Neustartbelege. [Stadtabnahmen](acceptance.json) | Vollständiges Zeichnen/Neuanlegen und sämtliche Stadtfunktionen. |
| Assistierte Bebauung | **Kandidat [PR154](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/154):** Fläche/Straßen/Platz, Häuser erzeugen, Dichte/Größe/Variante, Vorschau/Abbruch und präzise Hauskorrektur; kleine Speicher-/Neustartfälle in Obsidian. | Übernahme; neue Stadt mit Dateien und Kampagnenverweisen anlegen; große Bedienprobe. [Restarbeit #149](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/149) |
| Haus und Innenraum | **Teilweise:** metrische Stadt-/Haus-/Dungeonbindungen und Dach-/Raumdarstellung im gemeinsamen Zoom. [Atlasdarstellung](src/features/atlas/spatial-canvas.ts) | Gemeinsam bearbeitetes Gebäude mit Außenform und Innenräumen; Wandänderung und Gesamtskalierung; vollständiger Key-/Regenerationsablauf, CITY-03/04. |
| Dungeon im Atlas | **Integriert:** vorhandenen Dungeon am Ort verorten; Raumkontur/Key bearbeiten und zurückkehren, gemeinsames Undo/Speichern. [Obsidian-Teilbelege #80](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80) | Restliche Bedien-/Wiederherstellungsfälle und vollständige HEX-04/05-Abnahme; mehrere Detailkarten, HEX-22. |
| Räumlicher Dungeon | **Integriert [PR158](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/158):** 3D-Volumes, Höhen, Schnitte, Flächenbearbeitung und Undo/Speichern/Neustart im Dungeon-Editor. | Vollständiger Atlasanschluss; Raumzuordnung bei Bewegung/Teilung/Vereinigung, räumliche Wege/Durchgänge, Graphentwurf, Attributvererbung, Inhaltsvorlagen und weitere [Dungeon-Fachziele](docs/SCOPE.md). |
| Speicherung und Wiederaufnahme | **Teilweise:** gemeinsame Mehrdateispeicherung, Entwurf, Kopie und direkte Wiederherstellungsfälle in Obsidian. **Integriert [PR167](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/167):** korrigierte Anzeige nach entzogener Speicherberechtigung. | Vollständige Wiederherstellungsabnahme (begrenzte Prepared-/Committed-Raumspeicherung bereits belegt); Autosave; vollständiger [Importanschluss #41](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/41); breite Fehler-/Konfliktabnahme. |
| Landschaft, Gestaltung, Ausgabe | **Teilweise integriert:** HEX-10 besitzt einen ersten PNG-/JPEG-/WebP-Export für die aktuelle Ansicht oder den belegten Atlas bis 2.048 Pixel Breite, wahlweise mit Raster. Der Export schreibt offene Autorenarbeit zuerst in den geschützten Entwurf, lädt den gewählten Umfang und blendet Auswahl-, Hover- und Bearbeitungsmarkierungen im Bild aus, ohne die Editorkamera zu verändern. | Gezielte Modulregressionen belegen Bildgröße, saubere Ausgabe und Zustandswiederherstellung; echter Hostlauf, visuelles Öffnen und räumlicher Vergleich des Bildes bleiben für HEX-10 offen. Ooke-Vorlagen, freie Küsten, Gewässer, Flüsse/Straßen, Symbole/Assets, freie Labels/Stile und Maße fehlen; HEX-27 fordert weiterhin mindestens 8.192 × 8.192 Pixel und bedarfsgerechte Großwelt-Ausgabe. |
| Größe und Gesamtqualität | **Offen:** vollständige Endqualifikation. Kandidat PR154 besteht einen 5.000-Häuser-Datenlauf; die entsprechende Bedienprobe fehlt. | Großwelt/bedarfsgerechtes Laden, große Städte/Dungeons, Reaktionszeiten, Originalvergleiche, Tastatur/200 %, physische Bedienung und installierter Endbuild. |

### Wie kommen wir zum Ziel?

**Nutzerentscheidung vom 11.10.2026: Gleichwertig bedeutet „kann dasselbe erreichen“.** Für Wonderdraft, Dungeondraft, Canvas of Kings, Watabou und Fantasy Town Generator zählen fachliche Ergebnisse, gezielte Nachbearbeitung und dauerhafte Speicherung. Oberfläche, Gesten, Algorithmen und Grafik dürfen anders sein. Mehrere Originalaktionen können dieselbe eigene Werkzeugfamilie nachweisen; eigenständige Wirkungen dürfen dabei nicht verloren gehen. Ein Bild ersetzt keine geforderte editierbare Geometrie.

Die folgende Tabelle ist die **einzige Gesamtpriorisierung: Make it Work → Make it Efficient → Make it Beautiful, unter durchgehendem KISS**. HEX-/CITY-/Dungeonkennungen bleiben Fachreferenzen; ihre Nummern bestimmen keine Lieferfolge. Bestehende Datenabhängigkeiten bleiben verbindlich. Bestehender Code ist Istbefund, keine Architekturvorgabe. Jede Übernahme wird gegen die Gesamtgrundlage geprüft; Nutzerinhalte und bestätigte Wirkungen bleiben geschützt. Ein Grundausbau schließt keine vollständige Fachphase.

| Stufe | Konkreter Nutzerablauf und Reihenfolge | Umsetzung und Abschluss |
| --- | --- | --- |
| **Work 1 – Bestehende Karte zuverlässig ändern** | Öffnen → Raum/Ort suchen → Geometrie und Key ändern → rücknehmen → automatisch speichern → frisch wiederfinden. | Neuen kleinen Kern/Store/Shell aufbauen; Originaldateien über geprüfte Adapter übernehmen. Auswahl, Textfokus, gemeinsame Commands/History und dauerhafte Speicherung am vollständigen Weg absichern. Kernablauf einschließlich Speicherfehler prüfen; vollständiger Import und breite OS-/Recoveryqualifikation bleiben eigene Fachabnahmen. |
| **Work 2 – Einen kleinen Dungeon vorbereiten** | Räume und Gänge zeichnen → Türen/einfache Treppe setzen → Geschoss wählen → nummerieren und Vorlese-/GM-Texte ergänzen → GM-/Spielerbild ausgeben. | Grundlegende Raumliste, einfache Inhalte/Verweise und Dungeonverwaltung mit Anlegen, Umbenennen, Archivieren/Wiederherstellen. Ohne fertig ausgearbeitete Region oder Stadt benutzbar; strukturierte Fallenfelder und Graphdiagnostik folgen später. |
| **Work 3 – Eine kleine Region vorbereiten** | Gelände/Küste, Fluss und Straße zeichnen → Orte benennen und beschreiben → Vorlage kalibrieren → messen → ausgeben. | Zunächst die 3-Meilen-Fachwirkung mit freien Küsten und bearbeitbaren Verläufen liefern; alle weiteren Hexstufen bleiben Pflicht im späteren Ausbau. Die Region ist unabhängig von fertiger Stadtbebauung nutzbar. |
| **Work 4 – Eine Siedlung vorbereiten** | Grenze/Platz und Straßen zeichnen → Häuser mit Dichte/Größe/Struktur vorschlagen → übernehmen → ein Haus korrigieren → Innenraum ausdrücklich anlegen und ausarbeiten. | Assistierte Bebauung mit wenigen guten Vorgaben gehört zum Grundablauf. Gebäudeaußenform und Innenräume gehören zum selben Objekt; Wandkorrektur zunächst im gewählten Geschoss. Bearbeitete Häuser, Texte und Bindungen bleiben geschützt. Einfacher Stadtfall vor dem verbundenen Leitbeispiel prüfen. |
| **Make it Efficient** | Dieselben Aufgaben mit weniger Wiederholung erledigen: Raum/Haus duplizieren → mehrfach Assets platzieren → gemeinsam ändern → Vorlage nutzen → gezielt erneuern. Präzise korrigieren, Auswahl schnell wiederfinden und größere Karten ohne störende Wartezeiten bearbeiten. | Zuerst schnelle Auswahl, Duplizieren/wiederholte Platzierung und zuletzt verwendete Assets; danach Mehrfachbearbeitung einschließlich Text-Sammeländerungen, Gruppen und Vorlagen/Prefabs. Teilbare Generierungsvorgaben und Inhaltsvorschläge erweitern diese Wiederverwendung. Präzise Tastaturbewegung, Fanghilfen und schnelle Zugänge. Erweiterte Erzeugung/Layouts, Pfad-/Flächenverteilung und geschützte lokale Neuerzeugung. Wandumfang über übereinanderliegende Abschnitte und horizontale Gesamtskalierung aller Geschosse folgen hier. Sichtbare/betroffene Records bedarfsgerecht abfragen; gemessene Engpässe bei großen Karten, Suche und Export verbessern. **Abschluss:** dieselbe Vorbereitungsaufgabe mit weniger Aktionen, Suchaufwand, Fehlern oder Wartezeit, bei unveränderter Daten- und Abbruchsicherheit. |
| **Make it Beautiful** | Den bereits brauchbaren Plan übersichtlich gestalten und als lesbare, stimmige Karte präsentieren. | Werkzeugleiste, Panel, Icons, Typografie und Rückmeldungen vereinheitlichen; Stile, Texturen, Dachdetails, grafische Lichtwirkung und Effekte ausarbeiten. Beschriftungsformat, Rahmen, Kompass und Ausgabepräsentation verfeinern. **Abschluss:** Karten und Bedienung sind bei typischen Zoomstufen und 200 % klar lesbar; dieselben Aufgaben bleiben erreichbar, Daten und Ausgabeinhalte korrekt. |

**Abschluss der Work-Abläufe:** Work 1 bestätigt Bearbeitung, Undo/Redo, automatische Speicherung und frische Wiederaufnahme einer bestehenden Karte. Work 2–4 bestätigen jeweils eigenständiges Vorbereiten, Korrigieren, Ausgeben und Weiterarbeiten nach Neustart; erst danach das verbundene Leitbeispiel prüfen. Kamera, sichtbare Suche, Auswahl, Textfokus, Vorschau/Abbruch, gemeinsame Undo/Redo-Folge und ehrliche automatische Speicherung gehören von Anfang an dazu. Kennungen, Links und geschützte Texte bleiben erhalten; Fehler erhalten offene Arbeit. Einfacher PNG-Export unterscheidet GM- und Spielerinhalt gemäß bestehendem Sichtbarkeitsvertrag. Die bisherige nutzbare Installation bleibt bis zum belegten Cutover verfügbar. Der Zielkern darf intern neu aufgebaut werden; seine Lieferung muss die benötigten Nutzerwirkungen und Daten erhalten.

**KISS ist eine Regel für jede Stufe:** eine gemeinsame Kamera, Auswahl, Command-/History-/Speichergrenze und verständliche Werkzeugfamilien; keine Pflicht zur Übernahme ihrer aktuellen Codeimplementierung. Zunächst ein klarer Standardweg und wenige verständliche Optionen; weitere Optionen nur für einen konkreten Bedarf. Eine neue Abstraktion braucht einen belegten gemeinsamen Bedarf. Sichere Abbrüche, Textfokus, Lesbarkeit und ausreichende Reaktion sind bereits Work, keine spätere Schönheitsarbeit.

Die Stufen gelten zunächst für die oben genannten Kernabläufe. Innerhalb eines Ablaufs geht eine fehlende fachliche Wirkung, die dessen Vorbereitung verhindert, vor Komfort und Politur. Efficient wird zuerst an den oben genannten Wiederholungen geprüft; ein neuer Spezialablauf darf unabhängig davon mit seinem eigenen Work beginnen. Diese Regel ersetzt ein pauschales Warten auf sämtliche späteren Funktionen. **Weitere verpflichtende Fachfähigkeiten beginnen ebenfalls mit ihrem eigenen Work und werden danach effizienter und schöner.** Es muss nicht der gesamte Vorbildumfang fertig sein, bevor die häufigen Kernaufgaben effizienter werden. Die funktionalen Erweiterungen bleiben im Werkzeugkatalog und den bestehenden Fachphasen zugeordnet: alle Hexstufen/Seen/Höhen, weitere Geometrie/Höhlen/Befestigungen, räumliche Wege und Durchgänge, Lichtblockierung, zusammengesetzte Beschreibungen/Attribute, strukturierte Features mit Fallenfeldern und Zustandsaktionen, Graph/Verteilungsdiagnostik, Bewohner/Beziehungen/Fraktionen und gemeinsame Weltzeit, Bibliotheks-/Paketfunktionen, zusätzliche 3D-/Straßenansichten, vollständige Im-/Exporte und Recovery. Eine neue fachliche Wirkung ist Work; Lichtblockierung, Bewohnerdaten oder VTT-Ausgabe werden nicht allein wegen ihrer Darstellung zu Beautiful. Kompass/Maßstabsanzeige als Messinformation und Dachgeometrie als Gebäudefunktion folgen ebenfalls ihrem Fachvertrag; ihre Gestaltung darf später verfeinert werden.

Die Reihenfolge ist eine Vorbereitungshypothese, kein gemessener Nutzungsbefund. Die bestehenden [GM-Aufgaben](ROADMAP-GM-PRODUCT-TESTING-PLAN.md) dienen als konkrete Vergleichsproben: unter anderem sechs Räume ausarbeiten, zehn Assets setzen, Inhalte finden und nach Neustart weiterarbeiten. Efficient vergleicht Aktionen, Suchaufwand, Fehler und Wartezeiten derselben Aufgabe; zusätzliche Optionen müssen dabei helfen. Vollständiger Funktionsumfang und Größen-/Host-/Exportnachweise bleiben Voraussetzung der Endabnahme, einschließlich getrennter installierter und physischer Bedienabnahme.

Das zentrale [Werkzeugverzeichnis](#konkreter-werkzeugkatalog) ordnet den Zugang und die Stufen zu; `acceptance.json` bleibt das einzige Funktions- und Nachweisregister. Fachpläne verweisen auf diese Lieferfolge und behalten ihre Details. Die [E2E-Abnahmen](docs/ROADMAP.md#lieferfolge-des-gesamtprodukts) behalten ihre fachlichen Voraussetzungen. Diese Planung vergibt keine neuen Nachweise oder PASS-Zustände.

Abnahmedetails stehen in `acceptance.json`; die folgenden Abschnitte führen Zielarchitektur, Anforderungen und Umsetzung.

## Umsetzungsplan

**Einstieg:** [Prioritäten](#wie-kommen-wir-zum-ziel) → [Lieferpakete](#lieferpakete-und-codeanschlüsse). Die Nutzerabläufe und der Werkzeugkatalog definieren weiterhin die Wirkung. Dieser Abschnitt übersetzt sie in Codearbeit; er eröffnet keine zweite Prioritäts- oder Statusliste.

### Informationsarchitektur der Oberfläche

Die Oberfläche beantwortet in dieser Reihenfolge: **Wo bin ich? Was will ich tun? Was ist ausgewählt? Ist meine Arbeit gesichert?** Der Atlas bleibt die gemeinsame Arbeitsfläche. Zoom verändert den Ausschnitt und die Detaildarstellung, nicht Werkzeug, Auswahlbesitz oder Schreibautorität.

| Fester Bereich | Inhalt und Verhalten |
| --- | --- |
| Obere Leiste | Feste Befehlsleiste mit Atlasmenü, Undo/Redo, Auswahl/Hand/Messen, Ansichtsverlauf, Zoom/Weltübersicht, Suche, Größenvergleich, Ansicht, Import/Export und Speicherstatus. Ab 1200 CSS-Pixeln einzeilig; darunter umbrechend, auch bei 200 % Skalierung. |
| Hauptseitenleiste | Bereichswahl Landschaft/Stadt/Dungeon oben links, darunter Werkzeuggruppen mit Symbol und Namen (144 Pixel). Daneben stehen die Werkzeuge der gewählten Gruppe mehrzeilig über ihren dauerhaft sichtbaren Optionen. Optionsspalte: Standardbreite 280 Pixel, verstellbar zwischen 240 und 360 Pixeln. Die gemeinsame linke Leiste lässt sich über Ansicht ausblenden; umfangreiche Bibliotheken bleiben rechts. |
| Karte | Füllt den verbleibenden Fensterraum. Die feste Maßstabsleiste zeigt die Entfernung; eine zusätzliche Anzeige der sichtbaren Ausdehnung entfällt. Seitenleistenänderungen erhalten Mittelpunkt und Meter pro Bildschirmpixel ohne Ansichtsverlauf oder Autorenänderung. |
| Zusatzbereich | Rechts Eigenschaften, Bibliothek, Raumbeschreibung, Bebauung, Analyse, Vergleich, Kalibrierung oder Export. Standardbreite 340 Pixel, verstellbar zwischen 280 und 480 Pixeln. Bei weniger als 560 Pixeln verbleibender Kartenbreite überlagert die Leiste die Karte. Manuelles Schließen bleibt beim Zoomen/Nachladen bestehen; Eingaben bleiben geschützt. |
| Rückmeldung | Normale Meldungen und Speicherzustand erscheinen kompakt im Kopf. Fehler und unklare Schreibvorgänge behalten ihre sichtbaren Klärungszugänge; keine pauschale Unterdrückung von Recoverymeldungen. |
| Aufgabenbezogene Erweiterungen | Vorhandene Stadt-, Raum- und Analyseaktionen bleiben gezielt erreichbar. Party, Reisen, Spielzeit, Musik und Spieleranzeige bleiben ausschließlich in den Spielleitungsbereichen. Die gemeinsame Kamera, Schreibautorität und Historie bleiben erhalten. |

Work liefert diese Ordnung zuerst mit den bereits nutzbaren Aktionen; ungebaute Funktionen werden nicht als scheinbar fertige Schaltflächen angeboten. Eine konkret fehlende Voraussetzung wird am betroffenen Zugang erklärt. In Efficient kommen die benötigten Optionen hinzu; Beautiful vereinheitlicht Gestaltung und Rückmeldungen. Die Regeln für Entwurf, Textfokus, Werkzeugwechsel und Speicherung stehen ausschließlich bei der [gemeinsamen Bedienung](#gemeinsame-bedienung).

### Werkzeuggruppen der Atlassteuerung

| Bereich | Gruppen |
| --- | --- |
| Landschaft | Land · Wasser · Wege & Flächen · Objekte |
| Stadt | Flächen · Straßen & Plätze · Gebäude · Objekte |
| Dungeon | Räume & Höhlen · Wände & Übergänge · Boden & Wasser · Objekte |

Nur vorhandene Werkzeuge erscheinen; leere Gruppen bleiben ausgeblendet. Landform, Landfarbe, Süßwasser und Wasserfarbe besitzen direkte Werkzeugzugänge einschließlich ihrer Radierer. Geländedaten, Hexfüllung und Zurücksetzen gehören zu Land. Flüsse gehören zu Wasser, Straßen zu Wege & Flächen und Orte zu Objekte. Stadtbefestigungen und assistierte Bebauung gehören zu Gebäude; Dungeon-Dächer und grafische Pfade zu Boden & Wasser. Licht, Text und Fallen/Features gehören zu Dungeon-Objekte. Noch fehlende Gebiets- oder Symbolwerkzeuge werden dadurch nicht als implementiert behauptet.

Beim ersten Öffnen sind Landschaft/Land und die globale Auswahl aktiv. Gruppen merken sich ihr zuletzt verwendetes Werkzeug, Bereiche ihre letzte Gruppe. Beim ersten Gruppenbesuch wird das erste verfügbare Werkzeug gewählt. Alle Wechsel durchlaufen denselben Entwurfsschutz. Werkzeugwerte bleiben während der Sitzung erhalten. Objekte öffnen ihre Bibliothek rechts, bewusste Auswahl öffnet Eigenschaften. Manuelles Schließen bleibt bis zur nächsten passenden Benutzeraktion erhalten; Nachladen und Zoom öffnen das Panel nicht erneut. „Mehr Optionen“ öffnet die vorhandenen zusätzlichen Einstellungen. Stadt/Dungeon anlegen, Raumverzeichnis und Analyse bleiben benannte Zugänge.

### Lieferpakete und Codeanschlüsse

**Technische Richtung vom 11.10.2026:** [Gesamtgrundlage](ARCHITECTURE.md),
[räumlicher Vertrag](ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md) und
[Übergang](ROADMAP-SALTMARCHER-PLATFORM-ADR.md). Geprüfter Istcode:
`116c16af48b6a073216685c8d8e2cc74fada82c3`. `storage.changed()` sichert derzeit
einen Draft; der separate Save ist noch kein automatischer Normalbetrieb.
Whole-Document-Sources, FileTransaction und imperative Sessionwrapper besitzen
keinen Bestandsschutz. Daten/Verhalten schützen, geeignete reine Teile begründet
übernehmen, gekoppelte Zustands-/Speicherstrukturen ersetzen.

| Lieferpaket | Konkrete Umsetzung im gewählten Kern | Abschluss / Fachanschluss |
| --- | --- | --- |
| **Work 1a – Datenbasis, Finden und Bearbeiten** | Aktuelle Formate/Links inventarisieren und importvergleichbar sichern. Kleine Electron-Shell, typisierte Records/IDs, ein SQLite-Schreibdienst und gemeinsame Kamera/Auswahl/Textdrafts. Bestehende reine Polygon-/Einheiten-/Such-/Controlteile nur nach passender Prüfung übernehmen. | Ort/Room finden, Kontur/Key ändern, gemeinsames Undo/Redo. Scope/Revision/Context, Textfokus und Überlagerung prüfen; kein heimlicher Formatumbau. [P01/P02](ROADMAP-SALTMARCHER-ADR-PROTOTYPES.md). |
| **Work 1b – Automatisch dauerhaft sichern** | Änderungen, Undo-Deltas und Receipt in einem Commit; pending/durable/Fehler ehrlich. A→B→A und spätes Jobresultat absichern; normaler Close/Restart ohne manuelles Save. Backup/Assetstaging für den verwendeten Datenweg anschließen. | Fehler/Crash/unknown outcome bewahren bestätigte Arbeit und offene Eingabe. Tatsächlichen Store benutzen, keinen Memory-PASS. [Campaign](ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md). |
| **Work 2 – Kleiner Dungeon und Ausgabe** | 5-Fuß-Volumes, stabile Roominhalte, Gang/Tür/einfache Treppe, Slice/Geschoss und Keys im gemeinsamen Raumvertrag. Draw/Hit/Export aus derselben Projektion; vorhandene Zeichnungsartefakte ausdrücklich übertragen. | Sechs Rooms ausarbeiten/korrigieren, GM-/freigegebenes Spieler-PNG und Reopen. Kleine unabhängige Dungeonvorbereitung; keine Pflicht zu fertiger Region/Graph/Traps. |
| **Work 3 – Kleine Region** | Sparse Landschaftsrecords, freie Küste/Fluss/Straße, Ortsreferenzen, kalibrierte Vorlage und Messung. Mehrstufige partielle Eigenschaften im Modell vorsehen; einzelne Stufen je benötigtem Weg liefern. | 3-Meilen-Region mit drei Orten, verbundenen Wegen, korrekten Metern und Ausgabe/Restart. Custombiom-/Symbolkatalog besitzt installationsweite Referenzclosure. |
| **Work 4a – Assistierte Siedlung** | Citymeterrecords, Straßen/Platz/Polygon, versionierte Seed-/Parameterrecipe, abbrechbarer Workerpreview; eine Annahme schreibt editierbare Geometrie. | Eichenfurt erzeugen, Variante verwerfen, übernehmen, Taverne korrigieren und frisch öffnen. Keine Generation beim Laden. [CITY-01/02/04](ROADMAP-CITIES-IMPLEMENTATION-PLAN.md#technische-arbeitspakete). |
| **Work 4b – Haus und Innenräume** | Ein gemeinsamer Gebäudestand, ausdrücklich leere Innenhülle, Räume/Geschosse. Keine dauerhaft synchronisierten Außen-/Innendokumente. Meterpose, Wandreichweite und horizontale Skalierung mit derselben Commandgrenze. | Außen/Innen, Türen/Anker, Text/IDs stimmen nach Zug/Undo/Restart. [Gebäude](ROADMAP-CITIES-IMPLEMENTATION-PLAN.md#gemeinsamer-gebäudezustand-erste-umsetzung). |
| **Weitere Fachfähigkeiten – eigener Work-Abschluss** | World/Plan/Katalog/Party/Scenes an denselben Store anschließen; Room-Lifecycle → Path/Passage → Features/Beschreibungen/Templates/Graph. Travel/Clock vor abhängigen Zeitfolgen; manuelle Musik/Lebensdaten benötigen keine fertige Automatik. | Jeweils sichtbarer Edit, sicherer Cancel, atomarer Commit/Restart und Fachorakel. Vollständige Lieferzuordnung bleibt [docs/ROADMAP](docs/ROADMAP.md), Umfang [SCOPE](docs/SCOPE.md). |
| **Efficient** | Duplizieren/repetitive Platzierung/schnelle Auswahl, danach Batch/Prefabs/geschützte Regeneration. Lokale Records/Chunks und Queries nach Messung verbessern. | Dieselbe Aufgabe mit weniger Aktionen, Suche, Fehlern oder Wartezeit; Fachwirkung, Abbruch und Datenintegrität erhalten. |
| **Beautiful / Gesamtqualifikation** | Kartenstile, Texturen, Beschriftung, Ausgabe und Rückmeldung verfeinern. Vollständige Original-/OS-/Installations-/Recovery-/A11y-/Lastabnahmen am Zielbuild. | Kein Ersatz für frühe Keyboard-/200%-/Lesbarkeits-/Sicherheitsanforderungen. Cutover erst bei belegten nötigen Nutzerabläufen/Datenbindungen. |

**Prüfung je Lieferung:** passende Verhalten-/Faulttests, Typecheck/Build und
Repositoryprüfung; tatsächlicher Zielhost/Store und frischer Prozess am
betroffenen Nutzerweg. Historische Obsidian-/Originalbelege bleiben datiert,
keine synthetische Übertragung ihres PASS auf den Neuaufbau. Physischer Input,
Stromverlust, OSinstallation und Fachgesamtumfang haben eigene Nachweise.

**Legacy-Speicherintegration:** Die eigenständige Consumer-Matrix prüft 18 Modellfälle;
[direkter Aufruf](README.md#lokal-entwickeln). Auf `f23912ff` bestanden 17:
M13 erwartet nach Rollback mit beobachtetem eigenem Manifestereignis einen
widerrufenen Context, tatsächlich bleibt er aktiv. Das historische 18/18 auf
`86bbbbf` belegt einen anderen Quellstand. Bei Übernahme alter Save-/Source-
Logik ist diese Erwartung gegen den gültigen Context-/Rollbackvertrag zu klären;
weder Fehlerfall verwerfen noch einen aktuellen PASS daraus ableiten.
Das verlangt keine vorgelagerte Reparatur des gesamten Altadapters vor dem neuen Store.

Work 1 benötigt den kleinen autoritativen Store, nicht schon den vollständigen
Import/Generator/Graph oder sämtliche späteren Runtimefeatures. Bei fehlendem
konkreten Anschluss genau diesen liefern; keine globale Abnahmesperre für
unabhängige fachliche Arbeit. Einzelne E2E-Gates bleiben in bestätigter Reihenfolge.

## Konkrete Nutzerabläufe

**Planungsstand: 11.10.2026.** Die folgenden Abläufe beschreiben das vereinbarte Zielverhalten, keine bereits vollständige Implementierung. Das Leitbeispiel zeigt auch spätere Erweiterungen wie alle Hexstufen, gemeinsame Wandumfänge und Neuerzeugung; die einzelnen Work-Abschlüsse verlangen diese noch nicht. Der [aktuelle Stand](#atlas-auf-einen-blick) bleibt davon getrennt. Leitbeispiel ist eine Region mit dem Dorf **Eichenfurt**, der Taverne **Zum Silbernen Ast** und dem Ruinendungeon **Alte Wacht**. Das Beispiel macht die Bedienung prüfbar; der vollständige Fachumfang der HEX-/CITY-Phasen und [Dungeonanforderungen](docs/SCOPE.md) bleibt erhalten.

### Vorbereitung: Region bis Dungeon

#### 1. Einen Atlas beginnen und erweitern

Ich öffne den Atlas meiner Kampagne und gebe ihm einen Namen. Eine leere Welt verlangt keine Breite oder Höhe. Ich verschiebe die Ansicht, zoome und beginne an der gewünschten Stelle zu zeichnen. Später kann ich jenseits des bisherigen Ausschnitts weiterarbeiten.

**Sichtbares Ergebnis:** Der bearbeitete Bereich wächst mit meinen Inhalten. Pan und Zoom erzeugen keine Landschaftsdaten; ein Übersichts- oder Exportausschnitt begrenzt die Welt nicht.

#### 2. Die Region formen

Auf der 27-Meilen-Stufe zeichne ich Land und Meer. Beim Hineinzoomen verfeinere ich auf der 3-Meilen-Stufe Küste, Wald, Hügel und Berge. Ich zeichne einen zusammenhängenden Fluss und einen regionalen Weg frei über mehrere Hexes, verschiebe Verlaufspunkte und entferne Teilstücke.

**Sichtbares Ergebnis:** Die Landschaft bleibt über Hex- und Zoomgrenzen verbunden. Eine spätere grobe Änderung erhält meine ausdrücklich verfeinerten Eigenschaften. Mit „Zur Vorgabe zurücksetzen“ entferne ich eine lokale Überschreibung gezielt und rücknehmbar.

#### 3. Eichenfurt anlegen und beschreiben

Am Fluss platziere ich einen Ort, wähle den Typ Dorf und nenne ihn Eichenfurt. Im Key-Panel ergänze ich frei benannte, geordnete Markdown-Abschnitte, etwa „Ankunft“, „Gerüchte“ und „Wichtige Personen“. Ich verlinke einen bestimmten Abschnitt aus meinen Spielnotizen.

**Sichtbares Ergebnis:** Marker und Orts-Key gehören zusammen. Nach Umbenennen oder Verschieben führen die bestehenden Links weiterhin zum richtigen Ort und Abschnitt; meine Texte bleiben erhalten.

#### 4. Straßen vorgeben und Häuser erzeugen

Ich zeichne die Siedlungsfläche, die Hauptstraße und den Marktplatz. Für die verbleibenden bebaubaren Flächen lasse ich Häuser vorschlagen. Dichte, Gebäudegrößen und Struktur ändere ich in der Vorschau und probiere eine andere Variante. Abbrechen verwirft den Vorschlag; erst Übernehmen fügt den Plan als bearbeitbare Geometrie ein. Danach korrigiere ich Straßen, Grundstücke und einzelne Häuser direkt.

**Sichtbares Ergebnis:** Meine Vorgaben und die Umgebung bestimmen die Bebauung. Übernehmen ist eine gemeinsame rücknehmbare Änderung; Abbrechen hinterlässt keine Häuser, Dateien oder neue Historieneinträge. Ein erneut geöffneter Atlas zeigt die gespeicherte Geometrie und erzeugt sie nicht neu.

#### 5. Die Taverne ausarbeiten

Ich wähle ein Haus, korrigiere seine Lage, Drehung und Außenform, benenne es „Zum Silbernen Ast“ und ergänze im Orts-Key Wirt, Angebot und Besonderheiten. Mit einer ausdrücklichen Aktion lege ich zunächst eine leere Innenraumhülle an. Hineinzoomen allein legt keine Räume oder Dokumente an.

**Sichtbares Ergebnis:** Außenform, Außenwände, Innenräume, Geschosse und Dach sind Teile **eines gemeinsam bearbeiteten Gebäudes**. Außen- und Innenansicht zeigen dasselbe Objekt in unterschiedlicher Detailtiefe. Das heutige Modell eines Hauses mit separat gebundener Dungeonkarte ist ein vorhandener technischer Teilstand; es erfüllt diese Zielentscheidung noch nicht vollständig.

#### 6. Räume, Geschosse und Gebäude ändern

Im selben Editor zeichne ich Trennwände und Türen für Schankraum, Küche und Gästezimmer, benenne die Räume und beschreibe sie. Eine Treppe verbindet Erd- und Obergeschoss; darunter ergänze ich einen Keller. Ich wähle die Höhe beziehungsweise den Schnitt, den ich bearbeiten möchte. Das Dach verdeckt keine ausgewählte oder bearbeitete Geometrie.

Bei einer späteren Änderung unterscheide ich zwei Aktionen: **Eine Wand verschieben** ändert die angrenzenden Raumgrenzen im ausdrücklich gewählten Bearbeitungsumfang gemeinsam mit der Gebäudeform. Ich kann das ausgewählte Geschoss oder übereinanderliegende Abschnitte desselben Wandverlaufs gemeinsam bearbeiten; andere Kanten und getrennte Teile bleiben separat. **„Gebäude skalieren“** ändert die Grundrisse aller Geschosse samt Außenform und Innengeometrie horizontal proportional. Höhen und Geschossabstände bleiben dabei erhalten. Verschieben und Drehen erhalten die physischen Abmessungen. Keller dürfen bewusst über den oberirdischen Umriss hinausreichen.

**Sichtbares Ergebnis:** Ich muss keinen unabhängigen Grundriss nachträglich in ein verändertes Haus einpassen. Kennungen, Texte und Links bleiben erhalten. Ein ungültiger Änderungsvorschlag wird sichtbar markiert und nicht übernommen; ich korrigiere oder verwerfe ihn. Jede bestätigte Änderung lässt sich gemeinsam zurücknehmen.

#### 7. Die Alte Wacht mit einem Dungeon versehen

Ich platziere die Ruine als POI und beschreibe sie. Ausdrücklich lege ich einen Dungeon mit einem Eingang an. Ich zeichne zuerst Räume direkt, dann Gänge, Türen und Verbindungen und ergänze Treppen, Höhen und Öffnungen. Ein weiterer Eingang führt gezielt zu einem bestimmten Raum oder Geschoss. Alternativ verorte ich einen bereits vorhandenen Dungeon über seinen Eingang.

**Sichtbares Ergebnis:** Der eigenständige Ruinendungeon liegt metrisch am richtigen Ort und bleibt unabhängig von Stadtgebäuden. Er kann mehrere Eingänge besitzen. Räume direkt zeichnen ist der normale Einstieg; Graphentwurf und vorbereitete Vorlagen bleiben weitere Einstiege in dieselben Raumdaten.

#### 8. Raum-Keys ausarbeiten und Geometrie überarbeiten

Ich benenne beziehungsweise nummeriere Räume, schreibe Vorlesetext und GM-Notizen getrennt und ergänze Geheimdurchgang, Falle, Schatz oder einen Encounterverweis. Die Raumliste führt über Suche und Nummer zum gleichen Raum; die [Key- und Inhaltsaktionen](#aktionen-am-ausgewählten-objekt) erweitern diesen einfachen Einstieg später um Beschreibungsblöcke und strukturierte Features. Aus einer Notiz springe ich über einen Raumlink zur passenden Geometrie und zum Key. Später verschiebe, teile oder vereinige ich Räume.

**Sichtbares Ergebnis:** Raumidentität und Autoreninhalt werden durch eine Geometrieänderung nicht stillschweigend ersetzt. Nach einer Teilung oder Vereinigung bleibt jeder geschriebene Inhalt erhalten. Inhalte ohne eindeutiges Ziel erscheinen sichtbar als „Nicht zugeordnet“, bis ich sie ausdrücklich einem Raum zuweise. Verschieben erhält die Raumkennung und den vorhandenen Key.

#### 9. Die Planung nachträglich ändern

Ich verlege den regionalen Weg, korrigiere eine Dorfstraße und lasse einen ausgewählten Teil Eichenfurts neu bebauen. In der Vorschau sehe ich, welche Häuser betroffen sind. Manuell bearbeitete Häuser sowie Häuser mit Innenräumen, Keys oder Bindungen sind automatisch geschützt. Bei Bedarf gebe ich ein einzelnes Element ausdrücklich für den Ersatz frei.

**Sichtbares Ergebnis:** Die Taverne, ihre Räume und meine Texte bleiben erhalten. Regeneration ersetzt nur freigegebene Inhalte; eine Freigabe allein löscht nichts. Abbrechen verwirft die Vorschau. Vor einem Ersatz mit Inhaltsverlust muss die Zuordnung beziehungsweise Erhaltung der betroffenen Texte, Räume und Verweise geklärt sein. Undo stellt den gesamten vorherigen Stand wieder her.

#### 10. Speichern und später weiterarbeiten

Bestätigte Änderungen werden automatisch dauerhaft gespeichert. Ich sehe, ob Änderungen noch ausstehen, gespeichert sind oder ein Speicherfehler vorliegt. Ich schließe das Programm vollständig, starte neu und finde Eichenfurt, die Taverne und die Alte Wacht samt Geometrie, Keys und Links wieder. Kamera und Auswahl werden wiederhergestellt, soweit das gespeicherte Ziel noch existiert.

**Sichtbares Ergebnis:** „Gespeichert“ wird erst nach erfolgreicher dauerhafter Speicherung angezeigt. Ein Fehler oder eine externe Änderung bleibt sichtbar und erhält meine offene Arbeit zur Auflösung. Gelände-, Straßen-, Gebäude-, Raum- und Key-Änderungen haben während einer Atlas-Lebensdauer eine gemeinsame Undo/Redo-Reihenfolge. Eine über vollständige Neustarts fortgesetzte Undo-Historie ist damit nicht vereinbart.

### Am Spielabend

| Meine Handlung | Erwartetes Verhalten |
| --- | --- |
| Nach „Zum Silbernen Ast“, einem Raum oder einem Key-Text suchen. | Ein Treffer fokussiert den richtigen Ort beziehungsweise Raum und zeigt seinen Key. Zurück führt zur vorherigen Ansicht. |
| Zwischen Dorf, Taverne und Ruine navigieren. | Zoom, Suche und stabile Links führen zu denselben Weltpositionen. Werkzeug und Auswahl bleiben beim Zoomen erhalten; ein Link darf sein Ziel gezielt auswählen. |
| Key neben der Karte lesen oder aktualisieren. | Textbearbeitung bleibt im gemeinsamen Editor; Tippen löst keine Zeichenwerkzeuge aus. Personen-, Gegenstands- und Encounterverweise öffnen die vorhandenen Detailansichten. |
| Eine geöffnete Tür, einen neuen Durchgang oder eine beschädigte Stelle eintragen. | Die Änderung erscheint an der betroffenen Geometrie, bleibt speicherbar und lässt sich in der gemeinsamen Reihenfolge zurücknehmen. |
| Einen Ort für Reise, Encounter oder eine Spielansicht verwenden. | Der Atlas liefert den stabilen Orts-/Raumbezug. Reisefortschritt, Weltzeit, Encounterausführung und Spielersicht verwenden ihre eigenen bestehenden Fachverträge; sie werden durch diese Planung nicht neu definiert. |

### Weitere benötigte Abläufe

| Aufgabe | Konkreter Ablauf und Ergebnis |
| --- | --- |
| Eine vorhandene Welt erweitern | Außerhalb der bisherigen Ausdehnung weiterzeichnen und Orte platzieren; bestehende Inhalte, Kennungen und Links bleiben erhalten. |
| Eine Bildvorlage nachzeichnen | Ooke oder ein anderes Referenzbild hinzufügen, anhand einer bekannten Strecke kalibrieren, ausrichten und nativ nachzeichnen. Die Vorlage lässt sich ausblenden; das Bild wird dadurch nicht zu editierbarer Landschaft. |
| Eine Stadt weiter ausarbeiten | Viertel und Nutzung festlegen, Dichte beeinflussen, Mauern/Tore/Brücken/Plätze ergänzen und Dächer, Pflanzen sowie Dekoration einzeln korrigieren. |
| Bewohner und Tagesabläufe pflegen | Bewohner ausdrücklich anlegen oder optional erzeugen; Haushalte, Gebäude, Berufe, Beziehungen, Familien und Fraktionen bearbeiten und wiederfinden. Aktivitäten folgen der gemeinsamen Weltzeit. |
| Die Karte lesbar gestalten | Freie Beschriftungen, geografische/politische Gebiete, Symbole, eigene Assets und Stile ergänzen; Geometrie, Keys und Kennungen bleiben erhalten. |
| Einen Dungeon anders beginnen | Einen abstrakten Raumgraphen entwerfen oder eine vorbereitete Vorlage wählen und räumlich ausarbeiten. Dieselben Raumidentitäten bleiben über den Übergang erhalten. |
| Mehrere Räume gemeinsam bearbeiten | Räume auswählen, gemeinsame Attribute oder Inhaltsvorlagen anwenden und individuelle Abweichungen erhalten. Ergebnis und Keys prüfen; eine gemeinsame Rücknahme stellt alle betroffenen Räume wieder her. |
| Messen und Ansichten vormerken | Entfernung zwischen Orten messen, einen Ausschnitt benennen und als Navigationsziel speichern. Messung und Lesezeichen begrenzen die Welt nicht. |
| Eine Karte ausgeben | Ausschnitt, Detailtiefe, Raster, Labels und PNG/JPEG-Auflösung unabhängig von der Editorkamera wählen; Ergebnis öffnen und prüfen. Die Quelldaten bleiben unverändert. Weitere vereinbarte Exportformate bleiben in den Fachkatalogen. |
| Inhalte kopieren oder übertragen | Eine Region oder den ganzen Atlas als unabhängige, vollständige Kopie beziehungsweise Transferpaket übernehmen. Benötigte Detaildaten und interne Verweise werden konsistent mitgeführt; der Ausgangsstand bleibt erhalten. |

### Vom Teilstand zum vollständigen Ablauf

Die [Lieferstufen Work → Efficient → Beautiful](#wie-kommen-wir-zum-ziel) bestimmen die Umsetzung des Leitbeispiels. Die Erzählfolge ist der Nutzerweg, keine zusätzliche Lieferliste. Für Gebäude werden gemeinsames Objekt, Befehle und Übernahme vorhandener Daten vor Produktänderungen im [bestehenden technischen Stadtplan](ROADMAP-CITIES-IMPLEMENTATION-PLAN.md) konkretisiert; Kennungen, Texte, Maße und Links bleiben erhalten.

Die spätere Produktabnahme spielt das Beispiel im tatsächlichen Zielhost mit isolierten Testdaten durch: Vorschauabbruch ohne Restdaten, Wandumfang gegenüber Gesamtskalierung, geschützte Regeneration, Raumteilung/-vereinigung ohne Textverlust, gemischte Undo/Redo-Folge, vollständiger Neustart, sichtbare Speicherfehler/externe Konflikte, Suche, stabile Links und Ausgabe. Bestehende Teilbelege bestätigen nur ihren bisherigen Umfang. Die Planungsänderung vergibt keinen PASS.

## Werkzeuge und Bediengefühl

**Planungsstand: 11.10.2026; vereinbartes Zielverhalten.** Dieser Katalog konkretisiert die [Nutzerabläufe](#konkrete-nutzerabläufe). Er beschreibt benötigte Werkzeuge und deren Bedienung, keine bereits vollständig implementierte Oberfläche. Der [aktuelle Stand](#atlas-auf-einen-blick), die vollständigen HEX-/CITY-/Dungeonanforderungen und deren Nachweisgrenzen bleiben getrennt.

Der Atlas soll sich wie ein Zeicheneditor anfühlen: Werkzeug wählen, Wirkung auf der Karte sehen, zeichnen und anschließend direkt korrigieren. Klar benannte Fachwerkzeuge sind direkt wählbar. Landschaft wird gepinselt; präzise Geometrie entsteht mit Klickpunkten und Rechteckziehen. Das Gefühl ist unmittelbar, nachvollziehbar und leicht korrigierbar.

### Gemeinsame Bedienung

Die feste Befehlsleiste enthält Navigation und Verwaltung. Links folgt die Werkzeugleiste **Bereich → Gruppe → Werkzeug → Optionen**. Die Bereiche **Landschaft, Stadt und Dungeon** wechseln keinen Editor oder Kartenmodus. Zoom verändert weder Werkzeug noch dessen Einstellungen. Objektauswahl ersetzt die Werkzeugliste nicht; Eigenschaften und erweiterte Optionen erscheinen im rechten Kontextbereich. Die Karte bleibt beim Bearbeiten sichtbar.

**Ein einfacher Standardweg:** Zum Korrigieren „Auswahl“ wählen und das Objekt anklicken; zum Anlegen das Fachwerkzeug wählen. Ein neuer Raum beginnt als Rechteck im gewählten Geschoss, ein Fluss/eine Straße als Punktzug, ein Asset als Einzelplatzierung und eine Siedlung mit vorgegebener Fläche/Straße. Weitere Formen und bereits verfügbare Fähigkeiten bleiben erreichbar. Im Panel stehen zuerst die für diese Aktion nötigen Felder; zusätzliche vorhandene Einstellungen werden über „Mehr Optionen“ erreichbar, ohne neue Kartenmodi. Ein Normalfall verlangt weder Graphentwurf noch Vorlage oder Generatorparameterstudium.

| Eingabe oder Zustand | Gemeinsames Verhalten |
| --- | --- |
| Vorschau vor der Änderung | Pinselradius, Verlauf, Kontur oder Platzierungsobjekt folgen dem Cursor. Ziel, Umfang und räumlicher Maßstab sind sichtbar. Werkzeugoptionen gelten für die nächste Erzeugung; Auswahl-Eigenschaften ändern nur ausdrücklich ausgewählte vorhandene Elemente. Ein Vorgabenwechsel gestaltet den Bestand nicht heimlich um. |
| Ziehen | Loslassen übernimmt eine gültige normale Kartenänderung als einen Undo-Schritt. Innerhalb eines geschützten Graphentwurfs bleibt die Änderung bis zur gemeinsamen Übernahme vorläufig. Eine ungültige Vorschau erzeugt keine Teiländerung. |
| Mehrpunktzeichnung | Klicks setzen Punkte; Enter oder „Fertig“ schließt ab. Backspace oder „Letzten Punkt entfernen“ nimmt den letzten Entwurfspunkt zurück. Escape oder „Abbrechen“ verwirft den Entwurf. |
| Vorübergehende Navigation | Leertaste und Ziehen verschieben die Ansicht. Ein ruhender Mehrpunktentwurf bleibt erhalten; danach wird mit demselben Werkzeug weitergearbeitet. |
| Nachträgliche Korrektur | Auswahl zeigt passende Punkte, Kanten und Griffe. Numerische Maße sind zusätzlich im Panel verfügbar. Ziel und Dokumentbesitzer stehen vor dem Zug fest und bleiben über Zoom-/Ladegrenzen erhalten. Mehrere mögliche Ziele erfordern die sichtbare Trefferwahl; fehlender Dungeon/Innenraum wird ausdrücklich ausgewählt oder angelegt, nicht durch Zoom erfunden. |
| Werkzeugwechsel mit Entwurf | Ohne begonnene Änderung wechselt das Werkzeug sofort; eine reine Cursorvorschau benötigt keinen Abschluss. Ein laufender Zug muss zuerst enden oder mit Escape abgebrochen werden. Ein begonnener, noch unbestätigter Punkt-/Einfügeentwurf wird ausdrücklich mit seiner Abschlussaktion übernommen oder mit „Abbrechen“ verworfen; bis dahin bleibt das bisherige Werkzeug mit kurzem Hinweis aktiv. Kamera und Ansicht bleiben beweglich. Ein Werkzeugklick speichert oder verwirft keinen Entwurf stillschweigend. |
| Mehrere Eigenschaftenwerte | Bei Mehrfachauswahl zeigt das Panel unterschiedliche Werte als „gemischt“. Nur ausdrücklich bearbeitete Felder werden angewendet; unveränderte Werte und individuelle Inhalte bleiben erhalten. Keine Vorgabe überschreibt Unterschiede allein durch Öffnen des Panels. |
| Einrasten | Das Fangziel wird vor dem Setzen sichtbar. Rasterfang und Anschlussfang sind getrennte Einstellungen; geometrisch vorgeschriebene Raster bleiben verbindlich. |
| Fehler | Ungültige Vorschauen markieren die betroffene Stelle und zeigen einen kurzen Grund. Der bestätigte Stand bleibt erhalten. |
| Textfokus | Beim Schreiben bleiben Kartenkürzel gesperrt; Kopieren/Einfügen betrifft den Text. Offene oder ungültige Texteingaben bleiben am ursprünglichen Ziel sichtbar und werden nicht auf eine neue Auswahl übertragen. Bestätigte Texte erscheinen in Key/Suche und automatischer Speicherung; Navigation verliert weder Text noch Fokus unbemerkt. |
| Umfangreiche Änderung | Erzeugung, umfangreicher Geometrieersatz und Import erhalten eine ausdrückliche Vorschau mit Übernehmen und Abbrechen. Text-Sammeländerungen werden nach ausdrücklicher Anwendung unmittelbar als ein atomarer Undo-Schritt übernommen; dafür ist keine zusätzliche Vorschau erforderlich. Kleine gültige Änderungen benötigen keinen Bestätigungsdialog. |
| Abbruch und Fokusverlust | Escape verwirft zuerst den aktiven Kartenentwurf/Zug; ohne Entwurf löst es die Auswahl. Textfelder behalten ihre eigene Escape-Behandlung. Verlorener Zeigerkontakt bricht einen unbestätigten Zug ohne Teiländerung ab; ein ruhender Punktentwurf bleibt bei Fokuswechsel erhalten und wird erst ausdrücklich fortgesetzt oder verworfen. |

Die [Ergebnisgleichwertigkeit](#wie-kommen-wir-zum-ziel) gilt für alle Vorbilder. Originalgesten werden als Referenzbeobachtung erhalten, aber nicht identisch nachgebaut. Wichtige Aktionen haben sichtbare Zugänge; Shortcuts dienen der Beschleunigung.

| Eingabe / Zugang | Eigenes Zielverhalten |
| --- | --- |
| Mausrad / Zoomanzeige | Mausrad zoomt am Cursor; Zoomanzeige bietet ganze Karte einpassen und 100 %, in Efficient zusätzlich die Auswahl einpassen. Werkzeug und Entwurf bleiben erhalten. |
| Touchpad / Tastaturnavigation | Zwei Finger verschieben die Ansicht; Pinch zoomt am Zeiger. Sichtbare Pan-/Zoomaktionen sind auch per Tastatur erreichbar. Tab erreicht Werkzeuge, Panel und Abschluss-/Abbruchaktionen; Kartenkürzel wirken nur bei Kartenfokus. |
| Finden und zurückkehren | Sichtbare Suche und Orts-/Raumliste führen zu Name/Nummer/Key. Zum Atlasort zurückkehren bleibt erreichbar. Dach, Vorlage oder Ebene gezielt ausblenden macht verdeckte Innengeometrie wählbar, ohne Inhalte zu löschen. |
| Mehrfachauswahl | Shift-Klick ergänzt/entfernt ein Element; Rahmen/Lasso, Trefferliste und Typ-/Ebenenfilter machen überlagerte Geometrie erreichbar. |
| Kontur und Kurve | Kantenaktion „Punkt einfügen“, Punktgriff ziehen und „Punkt entfernen“ korrigieren die Kontur. Gerade/Kurve und Anschluss an vorhandene Verläufe sind sichtbare Optionen. |
| Löschen / Radieren | Delete oder „Entfernen“ betrifft die Auswahl. Der Radierer entfernt gezielte Inhalte; „Zur Vorgabe zurücksetzen“ entfernt ausschließlich Landschaftsüberschreibungen. Bei geschützten Inhalten gelten Erhaltung und Ersatzvorschau. |
| Kopieren / Transformation | Ctrl+C/Ctrl+V beziehungsweise sichtbare Aktionen kopieren mit eigenen Kennungen; Einfügen zeigt vor Übernahme Position und Anker, Abbrechen hinterlässt nichts. Griffe und Zahlenfelder bewegen/drehen/skalieren, Aktionen spiegeln und ändern die Zeichenreihenfolge. Efficient ergänzt sichtbares Duplizieren und wiederholte Platzierung ohne erneute Assetsuche. |
| Präzise Korrektur | Zahlenfelder sind bereits in Work verfügbar. Efficient ergänzt Pfeiltasten zum Bewegen der Auswahl in angezeigten Schritten, sichtbare Achsen-/Winkelbindung und vorübergehendes Lösen optionaler Fanghilfen. Fachlich vorgeschriebene Geometrieraster werden dadurch nicht umgangen. |
| Werkzeuggröße und Varianten | Radius, Breite, Maßstab, Lichtreichweite und Variantenwahl sind im Panel sichtbar. Das Mausrad bleibt Zoom; keine versteckte Mehrfachbelegung ist für eine Fähigkeit erforderlich. |
| Farbe / Bibliothek | RGBA/Hex, Palette und Pipette sowie Suche, Kategorien/Tags, Sortierung und Paketwahl bleiben neben der Karte erreichbar. |
| Text und Kontext | Key-Felder verarbeiten Enter als Text; Beschriftungsfelder bieten mehrzeilige Eingabe und sichtbares Übernehmen. Kartenkürzel wirken nur bei Kartenfokus. Rechtsklick öffnet Kontextaktionen; er bestätigt oder verwirft keinen Entwurf heimlich. |

### Konkreter Werkzeugkatalog

**Work / Efficient / Beautiful** beziehen sich auf den zentralen Stufenplan. **Work (später)** bezeichnet den einfachen Grundablauf einer verpflichtenden Fachfähigkeit, die nach den Kernabläufen ergänzt wird. Die Zeilen bündeln den vollständigen Zugang, auch wenn nur ihre Grundfunktion zuerst geliefert wird.

| Werkzeugfamilie | So bediene ich sie | Wirkung und Rückmeldung | Ausbau |
| --- | --- | --- | --- |
| **Auswahl** | Anklicken, Shift-Klick, Rahmen oder Lasso; Trefferliste verwenden. | Passende Griffe; Filter nach Typ/Ebene, Gruppen, Sperren, Spiegeln, Kopieren und Anordnung. Landschaft lässt sich ebenfalls ausschneiden, verschieben und skalieren. | Work: auswählen/korrigieren; Efficient: Mehrfachauswahl, Filter, Gruppen und Transformation |
| **Hand** | Ansicht ziehen; vorübergehend Space-Ziehen. | Bewegt ausschließlich die Kamera; erhält Entwurf und Werkzeug. | Work |
| **Geländepinsel** | Land/Wasser/Geländeart wählen und malen. | Freie Küsten innerhalb von Hexes; Radius/Maßstab sichtbar; geschützte feine Bearbeitung bleibt erhalten. | Work: Grundgelände/Küste; Work (später): alle Hexstufen |
| **Zur Vorgabe zurücksetzen** | Über verfeinerte Landschaft malen. | Entfernt markierte Überschreibungen, erhält Orte/Gebäude/Keys. | Work: mit Landschaftsverfeinerung |
| **Radierer** | Zielart wählen und über Inhalte malen oder eine Teilfläche markieren. | Entfernt gezielt Landschaft, Symbole, Wasser oder Oberflächen; Wirkung vorab sichtbar und rücknehmbar. | Work: mit jeweiliger Zielart |
| **Höhenpinsel** | Anheben/Absenken und Stärke wählen. | Ändert native Landschaftshöhe; Vorschau zeigt Land-/Wasserwirkung. Höhenkartenimport entfällt nach Nutzerentscheidung vom 20.10.2026. | Work (später): Höhengeometrie |
| **Fluss** | Punkte setzen; Breite/Kurven ändern. | Durchgehende Wasserfläche mit bearbeitbaren Punkten und Anschlüssen. | Work: Verlauf/Breite; Beautiful: grafische Übergänge |
| **Straße** | Punkte setzen und Wege anschließen; Typ wählen. | Regionale Wege, Stadtstraßen/Gassen, Kreuzungen/Brücken mit sichtbaren Konflikten. | Work: Wege/Anschlüsse; Work (später): Kreuzungen/Brücken |
| **Ort** | Typ wählen und platzieren. | Dorf/Ruine/POI mit Name und Key; stabile Ortsbindung. | Work |
| **Siedlungsfläche / Platz / Viertel** | Rechteck/Ellipse ziehen, Polygon oder begrenzte Fläche füllen; Nutzung wählen. | Gebiet für Bebauung, freier Platz oder lokale Nutzung/Dichte. Zeichnen erzeugt keine Häuser. Hilfskanten begrenzen Füllung, ohne Straßen darzustellen. | Work: Fläche/Platz; Work (später): Viertel; Efficient: Füllen |
| **Gebäude** | Form zeichnen, Haus wählen und Griffe korrigieren. | Außenform, Wände, Innenräume/Geschosse/Dach gehören zu einem Objekt; Wandumfang und horizontale Gesamtskalierung sind getrennt. | Work: Hauskorrektur/Innenraum; Efficient: Wandumfang/Gesamtskalierung; Work (später): weitere Formen |
| **Gestaltungspinsel** | Zielgebäude markieren, Farbe/Höhe/Dachstil wählen und anwenden. | Ändert mehrere Häuser gezielt; bestehende Inhalte bleiben erhalten. | Efficient: gemeinsam ändern; Beautiful: Gestaltung |
| **Befestigung** | Mauerzug zeichnen; Tore/Türme setzen. | Sichtbare Anschlüsse an Straßen/Mauern; Änderungen erhalten verbundenen Plan. | Work (später): Mauer/Tor/Turm |
| **Raum / Wand** | Rechteck/Ellipse/Polygon beziehungsweise geraden/gekrümmten Wandzug zeichnen; Punkte/Kanten greifen. | Konsistente Grenzen; Ausschneiden, Verlängern, Teilung/Vereinigung und Zuordnungsaktionen erhalten Autoreninhalte. | Work: Grundformen/Korrektur; Work (später): Kurven/Teilung/Vereinigung |
| **Verbindung** | Endpunkte/Wegpunkte, Typ und Querschnitt wählen. | Gang/Treppe/Schacht mit Höhenübergang, gültiger Vorschau und korrigierbaren Segmenten; Materialisierung als feste Geometrie. | Work: Gang/einfache Treppe; Work (später): vollständige räumliche Wege |
| **Durchgang** | Tür/Fenster/Gitter/Öffnung/Geheimdurchgang wählen und gebunden oder frei setzen. | Breite/Ausrichtung und stabile Identität; Begehbarkeit, Sicht, Licht und Schall getrennt bearbeiten. | Work: Tür/Geheimdurchgang; Work (später): weitere Typen und Sicht/Licht/Schall |
| **Höhlenpinsel** | Graben oder Öffnung erzeugen; Radius wählen, radieren. | Höhlenfläche und Öffnungen mit getrennt bearbeitbarer Fels-/Bodengestaltung. | Work (später): Höhlengeometrie; Beautiful: Fels-/Bodengestaltung |
| **Flächenpinsel / Musterfläche** | Terrain, Material, Wasser, Muster oder Hintergrund wählen; pinseln, Form zeichnen oder begrenzten Bereich füllen. | Textur-/Kachelsets, Mischung, Intensität, Schichten/Anordnung, Musterwinkel, Deckkraft und Wasserübergänge sind korrigierbar. | Work (später): Flächen/Material/Wasser; Efficient: Füllen; Beautiful: Textur-/Musterwirkung |
| **Texturpfad** | Punkte/Kurven setzen, Textur/Breite/Übergang wählen. | Grafischer Pfad mit Schleife und Übergängen; erzeugt keine räumliche Gangverbindung. | Work (später): bearbeitbarer Pfad; Beautiful: Übergänge |
| **Dach** | Kontur oder schnelle Form wählen; Dachtyp und First bearbeiten. | Giebel/Walm/Gaube, Breite, Stil und Schattierung; ausgewählte Innengeometrie bleibt sichtbar. | Work: einfache Dach-/Innenansicht; Work (später): Dachformen; Beautiful: Details/Stil |
| **Licht** | Quelle platzieren; Reichweite, Stärke, Farbe und Schatten ändern. | Beleuchtungsvorschau und Lichtblockierung durch Geometrie; Umgebungslicht separat im Panel. | Work (später): Quelle/Blockierung; Beautiful: grafische Wirkung |
| **Objekt / Symbolpinsel / Streuen** | Asset platzieren oder mit Dichte/Streuung/Varianten malen. | Griffe und Spiegeln; gezieltes Radieren. Mehrere Assets, zufällige Drehung/Größe und Einzelkorrektur bleiben möglich. Pfad-/Flächenverteilung folgt als Aktion. | Work: Einzelobjekt/Assetsuche; Efficient: Wiederholen/Pinsel/Streuen |
| **Verformen** | Bereich/Ziel und Wirkung wählen, Vorschau ziehen. | Lokales Aufweiten, Zusammenziehen, Verschieben, Ausgleichen und Entspannen; globale Drehung gesondert. Messen ändert keine Geometrie. | Efficient: lokale Korrektur |
| **Beschriftung / Gebiet** | Text oder Grenze setzen; Format beziehungsweise Erscheinung wählen. | Mehrzeilige Namen und geografische/politische Grenzen; Ortsbindung optional, Namensvorschläge und Rahmen später. | Work: Name/Text; Work (später): Gebietsgrenzen; Efficient: Namensvorschläge; Beautiful: Format/Rahmen |
| **Messen** | Anfang/Ende und Wegpunkte wählen. | Reale Entfernung aus gemeinsamem Weltmaßstab ohne Datenänderung. | Work |

**Key-Bearbeitung ist kein eigener Kartenmodus:** Die Auswahl eines Ortes, Gebäudes, Raumes oder Features zeigt dessen Beschreibung im Panel. Name, Nummer, getrennte Vorlese-/GM-Texte und manuelle Inhalte wie Geheimnis, Falle, Schatz oder Encounterhinweis sind bereits in Work direkt bearbeitbar; Vorschlagsgeneratoren und Vererbung folgen später. Der Katalog bündelt den Zugang zu den vereinbarten Funktionen und streicht keine Fähigkeiten aus den vollständigen Fachkatalogen.

### Aktionen am ausgewählten Objekt

Die folgenden Funktionen verwenden das vorhandene Panel, die Bibliothek und dieselben Auswahl-/Platzierungs-/Pinselaktionen. Graph und Raumliste sind optionale Darstellungen derselben Dungeonidentitäten; die gemeinsame Atlasfläche, Kamera und History bleiben erhalten. Eine gewählte Funktion zeigt nur ihre nötigen Optionen:

| Aktion / Ansicht | Konkreter Ablauf | Ausbau |
| --- | --- | --- |
| **Bebauung erzeugen / lokal erneuern** | Fläche/Viertel → Dichte, Größen und Struktur → Variante in Vorschau → Übernehmen/Abbrechen. Manuell bearbeitete Häuser, Innenräume/Keys/Bindungen sind geschützt; Straßenänderung erzeugt nichts heimlich neu. Weitere Layout-/Bedarfs-/Anzahlvorgaben folgen. | Work: einfacher Vorschlag/Korrektur/Inhaltsschutz; Efficient: Varianten/geschützte Neuerzeugung |
| **Innenräume anlegen / übernehmen** | Gebäude → leere Hülle aus Außenform → Räume zeichnen. Bestehenden Grundriss ausdrücklich übernehmen; Maßstab und Referenzen prüfen. Zoom erzeugt nichts. | Work |
| **Geschosse / Schnitte / Zuordnung** | Höhe/Schnitt wählen, Geschoss ergänzen; dann klonen, umbenennen, umordnen, löschen und vergleichen. Decken/einzelne Flächen auswählen; nach Raumteilung/-vereinigung nicht zugeordnete Inhalte sichtbar zuweisen. | Work: einfache Geschosse/Schnitte; Efficient: Klonen/Vergleichen; Work (später): vollständige Zuordnung |
| **Objekte verteilen / gruppieren** | Pfad oder Fläche → Assetkategorien, Abstände/Dichte, Varianten und Höhenversatz → Vorschau → Übernehmen. Gruppen gemeinsam bewegen oder bewusst auflösen; Einzelkorrekturen erhalten. | Efficient |
| **Land/Dungeon/Höhle erzeugen** | Zielbereich → Parameter/Seed → Vorschau → native Geometrie übernehmen. Gespeicherte Ergebnisse werden beim Laden nicht erneut erzeugt. | Efficient: Erzeugung; Höhenkartenimport entfällt nach Nutzerentscheidung vom 20.10.2026 |
| **Generierungsvorgaben teilen / wiederherstellen** | Bei der Erzeugung Seed, Parameter und Generatorversion als Vorgabe speichern → über den vorhandenen Vorgaben-/Exportzugang teilen → importieren → Grundplan in Vorschau wiederherstellen → ausdrücklich übernehmen. Ein Seed allein ersetzt keine vollständige Vorgabe. Manuelle Änderungen gehören zum separaten Kartentransfer; Laden einer fertigen Karte erzeugt sie nicht erneut. Abweichende oder nicht verfügbare Generatorversion sichtbar erklären. | Efficient |
| **Raum-Key / Raumliste** | Raum wählen → Nummer, Name, Vorlesetext und GM-Notizen bearbeiten → Ausgänge und verknüpfte Akteure, Objekte, Encounter/Ereignisse öffnen. Nummern sind pro konzeptuellem Level eindeutig; Umnummerieren ändert keine ID, beim Levelwechsel wird ein Konflikt durch die nächste freie Nummer aufgelöst. Übergreifende Verweise zeigen Level und Nummer. Suche, Filter nach Nummer/Level/Gruppe/Feature/Geheimstatus/Zustand und Sortierung führen zur selben Auswahl in Karte und Graph. | Work: Einzel-Key/grundlegende Liste; Efficient: Filter/Sortierung/Sammeländerung |
| **Text gemeinsam ändern** | Räume wählen → Feld und Ersetzen, Voranstellen, Anhängen oder Suchen/Ersetzen wählen → ausdrücklich anwenden. Namen, Vorlesetexte, GM-Notizen und weitere unterstützte Felder bleiben erreichbar; nur gewählte Inhalte ändern sich. Ein atomarer Undo-Schritt übernimmt die Änderung ohne zusätzlichen Vorschaudialog. | Efficient |
| **Beschreibungen / Attribute** | Am Raum, beschriebenen Wand-/Boden-/Deckenbereich oder übergeordneten Dungeon/Level/Gruppe Prosa, freie Attribute und abgeleitete Fakten ansehen. Blöcke anordnen, eigene Übergangstexte einfügen oder einzelne Fakten unterdrücken. Herkunft und effektiver Wert sind sichtbar; lokal überschreiben, unterdrücken oder Vererbung wiederherstellen. Geometrieänderung aktualisiert nur betroffene Ableitungen. Pro Block/Objekt sichtbar, nur GM oder bis Entdeckung verborgen wählen; optional Suchmethode, DC, private Entdeckungshinweise und späteren Text festlegen. Eingang/Blickrichtung sowie GM-/Spieler- und entdeckt/unentdeckt-Perspektive zur Vorschau wählen; Key und Dokument verwenden stabile Kartenrichtungen. Vorschau ändert keine reale Entdeckung. | Work (später): zusammengesetzte Beschreibung/Vererbung; Beautiful: Darstellung |
| **Dungeon-Feature anlegen / zuordnen** | Im gewählten Raum „Feature anlegen“ → Encounter, Loot, Falle oder Curiosity wählen → exakten 3D-Anker mit vorhandener Platzierungsvorschau setzen → Details bearbeiten. Curiosity umfasst Rätsel und individuell beschriebene Ausstattung mit Vorlesetext, GM-Lösungsnotizen und Tags; keine automatische Rätsellösung. Encounter/Loot verweisen auf bestehende Inhalte mit einem aktuellen Anker; mehrere physische Vorkommen benötigen unabhängige Kopien. Verschieben erhält Identität; verlorene Zuordnung bleibt sichtbar zur Neuzuweisung. Featuretypen einzeln einblenden; überlagerte Anker über Trefferliste wählen. | Work: einfache Inhalte/Verweise im Key; Work (später): strukturierte Features/Anker |
| **Fallenfelder / Resetregel** | Falle wählen → Triggeroverlay zeigen → getrennte beliebige Felder mit vorhandenem Pinsel, Bereichsauswahl und Radierer bearbeiten, auch über Volumes hinweg. Felder folgen ihrer Geometrie und benachrichtigen beziehungsweise unterbrechen nur. Maximum, Resetdauer und Start bei null oder bereits unter Maximum festlegen. Die Laufzeit verbraucht erst bei GM-bestätigter Aktivierung eine Ladung; weiterer Verbrauch startet keinen laufenden Countdown neu, Reset lädt vollständig. Aktueller Stand/Countdown, manuelle Korrektur und optionale Autonomy-Ausführung folgen dem [Trap-Vertrag](docs/SCOPE.md#trap-lifecycle-zuordnung). | Work (später): Felder/Regel vorbereiten; Laufzeit gemäß SMR-07/09 |
| **Umgebungsquellen / Zustandsaktionen** | Licht oder dauerhafte Schallquelle an Geometrie, Feature, Item oder Actor binden; Umgebungslicht aus Dungeon/Level/Raum prüfen und lokal ändern. Passierbarkeit, Sicht, Licht und Schall bleiben getrennte Fakten. Benannte Aktion mit Zielzuständen von Durchgängen, Licht, Schall oder Mechanismus definieren; GM-Bestätigung oder ausdrücklich festgelegten Zeit-/Bereichs-/Dauer-/Aktionsauslöser zuordnen. Gemeinsame Wirkung bleibt atomar und beständig bis zur nächsten Aktion. Geheimstatus, Entdeckung und reale Ausführung folgen ihren eigenen bestehenden Verträgen. | Work (später): Quellen/Zustandsaktion vorbereiten; Beautiful: grafische Lichtwirkung |
| **Graph / Verteilungsdiagnostik** | Optionalen Graph öffnen → Raum oder Gruppe anlegen/verschieben/duplizieren/verbinden/entfernen → dieselben IDs in der Karte verfolgen. Detail reduzieren: echte Verzweigungen, Schleifen, Geheimwege, Höhenübergänge, Verbindungstypen und gesperrte Wege bleiben erkennbar; bloße Nachbarschaft erzeugt keine Verbindung. Reisezeiten und umschaltbare Verteilung von Encounter, Gefahr, Loot, Curiosity/Rätsel und Secrets aus strukturierten Features prüfen, absolut oder relativ zu Zeit/Ausdehnung. Bestehende Budgetmodelle mit Ziellevel und ausdrücklich zugeteilten Sessionanteilen verwenden; ohne zugeteilte Sessions bleiben Verteilungsanzeigen nutzbar, aber Budgetwarnungen aus. Hinweise bleiben erklärbar und überstimmbar. Strukturänderungen erzeugen einen geschützten Geometrieentwurf: in der Karte korrigieren → gemeinsam übernehmen oder vollständig zum Stand vor dem Graphentwurf zurückkehren, unabhängig von der Undo-Tiefe. Mehrdeutige Endpunkte bleiben zur Klärung sichtbar. | Work (später): Entwurf/Diagnostik; Efficient: Gruppenoperationen; Beautiful: Lesbarkeit |
| **Inhaltsvorlagen / Kopieren** | Autorenblöcke wählen → unabhängig kopieren oder als verknüpfte Vorlage speichern → geeigneten Inhalten zuweisen. Gewöhnliche Kopien erhalten unabhängige Identitäten; verknüpfte Instanzen übernehmen Vorlagenänderungen. Eine Instanz oder einen Block bewusst entkoppeln erhält den aktuellen Inhalt. Inhaltsvorlagen enthalten ausschließlich gewählte Autorenblöcke, keine Geometrie, Zuordnung oder Objektidentität. Geometrie-Prefabs bleiben ein eigener Bibliotheksablauf; individuelle Abweichungen bleiben sichtbar und geschützt. | Efficient |
| **Dungeonverwaltung** | Dungeon anlegen, benennen, öffnen/neu laden → umbenennen oder unabhängig duplizieren → archivieren beziehungsweise wiederherstellen. Archivierung pausiert vorhandene Erkundung und erhält Links/Laufzustand. Endgültiges Löschen folgt dem bestehenden Vertrag: 30 Tage lokaler Papierkorb mit Wiederherstellung, ausdrücklich gewählte sofortige Vernichtung separat. Duplikation erhält neue Autorenkennungen, remappt interne und erhält externe Verweise; Laufzustand, Wissen, Logs und Undo werden nicht kopiert. | Work: Grundverwaltung; Efficient: unabhängige Kopie; Löschfolgen nach Fachvertrag |
| **Dungeon-Dokument / Dungeonpaket** | Ausgabe wählen → Karten-Schnitte, reduzierten/detaillierten Graph, Dungeon-Key und optionale Feature-/GM-Anhänge zusammenstellen → Sichtbarkeitsprofil prüfen → lesbares Dokument ausgeben. Separat ein versioniertes portables Paket mit Autoreninhalt und stabilen Verweisen ausgeben/übernehmen; keine Party-/Actorpositionen, Reiselogs oder Undo-Historie. Dungeonpaket, unabhängige Duplikation und vollständiger Campaigntransfer besitzen getrennte Transferregeln; offene Runtime-/Knowledge-Fragen des Campaigntransfers bleiben bei dessen Vertrag. | Work (später): Dokument/Paket; Efficient: Ausgabevorgaben; Beautiful: Präsentation |
| **Bewohner / Siedlungsdaten** | Personen, Haushalte, Berufe, Beziehungen/Familien und Fraktionen/Regierung/Religion bearbeiten, suchen und gesammelt in Vorschau ändern. Gebäudebedarf/Anzahl, Demografie, Waren/Preise, Öffnungszeiten, Unterorte/Ressourcen, Ereignisse und Favoriten sind benannte Panelaktionen. Gebäudedaten auf andere Geometrie übertragen erhält Bewohner und Verweise. | Work (später): Daten bearbeiten; Efficient: Suche/Mehrfachänderung |
| **Weltzeit / Aktivitäten / Wetter** | Bestehende Campaignzeit wählen → Aufenthalte, Tagespläne, Ruhetag-Override, Kalender, Jahreszeit und Wetter betrachten/korrigieren. Keine zweite Uhr. | Work (später): bestehende gemeinsame Zeit verwenden |
| **Bibliothek / Farben / Vorgaben** | Assets suchen/filtern, Pakete/Sets aktivieren oder deaktivieren, fehlende Assets sichtbar ersetzen und Farben über Palette/Pipette ändern; eigene Assets/Namenslisten importieren, Vorlagen und Geometrie-Prefabs verwalten. Eigenes wiederverwendbares Stadtasset über einen Bibliothekseintrag erstellen/bearbeiten → speichern → im Entwurf einsetzen → erneut bearbeiten; vorhandene Import-/Prefab-Bausteine verwenden. Assetpakete mit Metadaten, Tags und Lizenzangaben erstellen, externe Assetquellen aufnehmen. | Work: Assetsuche/Grundfarben; Work (später): eigene Inhalte/Pakete/Quellen; Efficient: zuletzt verwendet/Vorgaben/Stadtassetbearbeitung |
| **Referenzbild** | Bild hinzufügen → bekannte Strecke kalibrieren → ausrichten → Deckkraft/Zeichenreihenfolge wählen → nachzeichnen; unabhängig ausblenden/entfernen. | Work: kalibrieren/nachzeichnen/ausblenden; Efficient: Verwaltung |
| **Gestaltung / Ansichten** | Stil/Paletten/Texturen, Gebäudeabnutzung und Lichtvorgaben anwenden; Dach-/Viertel-/Favoritendarstellung wählen. Später Effekte, Rahmen, Kompass/Maßstabsleiste und zusätzliche 3D-/Straßenansicht verwenden; Rückkehr zeigt denselben Datenstand. | Work: lesbare Grundansicht; Work (später): zusätzliche Ansichten/Messinformation; Beautiful: Gestaltung/Effekte |
| **Ausschnitt / Ausgabe / Einstellungen** | Ausschnitt, Detailstufe und Raster wählen → Vorschau → exportieren. PNG zuerst mit getrennter GM-/Spielerausgabe nach bestehendem Sichtbarkeitsvertrag; PNG/JPEG/WEBP/SVG, Geometrie-/Inhaltsdaten einschließlich JSON/GeoJSON/CSV, UniversalVTT und vereinbarte Integrationen nach ihren Formatpflichten. Später große Bilder, Geschoss-/Lichtüberlagerung und Ausgabevorgaben. Karteninformationen, Einheiten, Raster-/Snap-/Anzeige-/Kürzel-/Backupoptionen im gemeinsamen Einstellungszugang. | Work: PNG mit GM-/Spielerinhalt, nötige Einstellungen; Work (später): weitere Formate/Import/Recovery; Efficient: große Ausgabe/Vorgaben; Beautiful: Präsentation |

**Vorschau und Speicherung:** Normale bestätigte Karten-/Keyänderungen werden automatisch gespeichert. Erzeugungs-, Import- und Graphvorschauen bleiben vorläufig; Kamera, Suche und Ansichtswechsel übernehmen sie nicht. Im Graphentwurf laufen auch Karten- und Keykorrekturen am betroffenen Dungeon in denselben geschützten Gesamtentwurf. „Übernehmen“ bestätigt dessen Gesamtwirkung, „Verwerfen“ stellt den Ausgangsdungeon wieder her. Ein Wechsel zu einem anderen Bearbeitungsdungeon benötigt zuvor diese Entscheidung; bloße Atlasnavigation bleibt möglich. Speichern bestätigt nicht versehentlich einen Entwurf. Fehler oder Konflikte erhalten die ausstehende Arbeit nach dem vorhandenen Recoveryvertrag.

Die Dungeonaktionen folgen den gepinnten [Dungeonanforderungen](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon.md) und [Editoranforderungen](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon-editor.md); Hashes stehen im [Quellenregister](docs/scope-sources.json). Eine Beschreibung oder ein Attribut erzeugt keine Begehbarkeitsregel. Die Attribute folgen dem eindeutigen Dungeon-/Level-/Gruppen-/Raum-/beschriebenen-Flächenpfad der Quelle; weitere Sammlungen dienen Filtern und Diagnose, nicht zusätzlicher Vererbung. Das [räumliche Fachpaket](docs/plans/dungeon/smr04-spatial-coverage.md) bleibt Voraussetzung für vollständige Anker, Flächen und Verbindungen. Beschlossene Daten-/Command-/Transfersemantik aus [Scope](docs/SCOPE.md#erfasste-lücken-und-entschiedene-quellenkollisionen), #44 und #52 ist vor der jeweils betroffenen Produktänderung mit konkretem Codec zu implementieren und zu prüfen. Ein offener Spezialvertrag blockiert ausschließlich seinen abhängigen Ablauf; beispielsweise braucht ein manueller Key noch keinen Graph- oder Templatevertrag.

Für Stadtassetbearbeitung und teilbare Generierungsvorgaben gelten die bestehenden Inventarquellen `CO-COK-0010` (CITY-07) und `CO-WAT-0011` (CITY-02/08) in `acceptance.json.cityPlans.functionalInventory`. Beim Asseteditor bleiben konkrete Originalwirkungen und Vergleich offen; bei Generierungsvorgaben betrifft das insbesondere manuelle Änderungen und Versionsverträglichkeit. Der geplante eigene Zugang erfüllt den Aufgabenzweck, ohne dieselbe Originaloberfläche oder einen wörtlich identischen Permalink zu verlangen. Diese Zuordnung schließt keinen Original- oder Hostfall.

### Gebäudegriffe und Bearbeitungsumfang

Work ermöglicht zunächst Wandkorrektur im gewählten Geschoss. Die zweite Wandreichweite und horizontale Gesamtskalierung ergänzen dies in Efficient; der vollständige Gebäudevertrag bleibt Pflicht.

Ein Gebäude zeigt unterschiedliche Griffe für unterschiedliche Absichten:

- **Verschieben und Drehen:** Das ganze Gebäude folgt einschließlich seiner Innenräume. Maße bleiben erhalten.
- **Wand ziehen:** Der gewählte Wandabschnitt und angrenzende Raumgrenzen ändern sich gemeinsam im gewählten Bearbeitungsumfang.
- **Gebäude skalieren:** Die Grundrisse aller Geschosse samt Innengeometrie werden horizontal proportional verändert. Höhen und Geschossabstände bleiben erhalten.

Die beiden ausdrücklich wählbaren Wandumfänge, ihre räumliche Wirkung und der Default stehen verbindlich im [Gebäudevertrag](ROADMAP-CITIES.md#wandumfang-und-horizontale-gesamtskalierung). Vor dem Ziehen hebt Hover alle betroffenen Abschnitte hervor, etwa mit „betrifft drei Geschosse“. Der Umfang wechselt nicht automatisch beim Zoomen.

Beispiel: Ich ziehe die Küchenwand nach außen. Schon während des Zugs sehe ich die neue Raumfläche und alle mitbetroffenen Wände. Möchte ich stattdessen die gesamte Taverne vergrößern, benutze ich ausdrücklich den Skalierungsgriff.

### Spätere Bedienabnahme

| Probe im isolierten Testvault | Erwartetes Ergebnis |
| --- | --- |
| Work 1: Vorhandene Karte öffnen → Raum suchen → Kontur/Key ändern → Undo/Redo → automatische Speicherung abwarten → neu öffnen | Der erste vollständige Ablauf funktioniert mit wenigen Optionen; Inhalte, Kennungen und Links bleiben erhalten. Normalbetrieb verlangt keine manuelle Saveaktion; pending/durable/Fehler sind unterscheidbar. |
| Work 2: Kleine Dungeonvorbereitung aus [GM-UX-01 A/B](ROADMAP-GM-PRODUCT-TESTING-PLAN.md#gm-ux-01-ein-abenteuer-vorbereiten-und-leiten) mit sechs Räumen, verbundenen Gängen, Tür/Treppe und einfachem zweitem Geschoss → nummerieren/beschreiben → GM-/Spielerbild ausgeben | Ohne fertige Region/Stadt spielvorbereitungsfähig. Bildvorschau/Datei gemäß jeweiligem Profil prüfen; geheime Inhalte und GM-Notizen erscheinen nicht im Spielerbild. Eingabeart und Build müssen benannt sein, bevor dies einen Produktnachweis ergibt. |
| Work 3: Kleine 3-Meilen-Region mit Küste, Fluss, Straße und drei benannten Orten vorbereiten; Verlauf korrigieren, Vorlage kalibrieren, Entfernung messen und Bild ausgeben | Region ohne vollständige Stadt nutzbar; Koordinaten, Namen/Keys, Vorlage und Maßstab bleiben nach Neustart konsistent. Drei Orte sind die Testaufgabe, kein Produktlimit. Weitere Hexstufen erhalten ihre eigene Fachabnahme. |
| Work 4: Eichenfurt mit Fläche/Hauptstraße/Platz vorschlagen, abbrechen und übernehmen; ein Haus zur Taverne korrigieren und Innenraum anlegen | Siedlung eigenständig vorbereitungsfähig. Abbruch ohne Restdaten, Übernahme als native Geometrie und Hauskorrektur/Keys nach Neustart prüfen. Wandkorrektur im gewählten Geschoss reicht für diesen Zwischenstand; das gesamte Leitbeispiel folgt nach den vier Work-Abschlüssen. |
| Region zeichnen → Straße setzen → Dorf bebauen → einzelnes Haus korrigieren | Fachwerkzeuge sind direkt auffindbar; Erzeugung folgt ausdrücklicher Übernahme und Einzelkorrekturen bleiben native Geometrie. |
| Work: Innenraum anlegen → Räume zeichnen → Wand im gewählten Geschoss ändern; Efficient: ganzes Gebäude skalieren | Gemeinsames Gebäude bleibt konsistent; Wandänderung betrifft den gewählten Umfang, Skalierung alle Grundrisse ohne Änderung der Höhen. |
| Efficient: Beide Wandumfänge an gleichen Wandverläufen, Vorsprüngen und getrennten Teilen | Geschosswahl wirkt nur im gewählten Höhenbereich. Gemeinsam folgen nur übereinanderliegende Abschnitte desselben Verlaufs; andere Kanten bleiben erhalten. Hover und Vorschau zeigen genau die später betroffenen Teile. |
| Vorschau abbrechen und bestätigte Änderungen gemeinsam rücknehmen | Abbruch hinterlässt keine Restdaten; Undo/Redo erhält Geometrie, Kennungen, Keys und Referenzen. |
| Mit begonnenem Punktentwurf navigieren und zoomen; nach Abschluss überlagerte Elemente auswählen | Entwurf und Werkzeug bleiben beim Navigieren erhalten; nach Abschluss erlaubt die Trefferliste eindeutige Auswahl. Ein laufender Zug wechselt sein Ziel nicht. |
| Escape bei Zug/Punktentwurf/Auswahl; Fokus- oder Zeigerkontakt verlieren; verdeckten Raum wählen | Keine Teiländerung oder stillschweigende Übernahme; Textfokus bleibt geschützt. Ausblenden und Suche erreichen die Zielgeometrie ohne Datenverlust. |
| Werkzeug bei reiner Cursorvorschau und bei begonnenem unbestätigtem Entwurf wechseln; Werkzeugvorgabe ändern; Mehrfachauswahl mit gemischten Werten bearbeiten | Ohne begonnene Änderung sofortiger Wechsel; sonst zuerst ausdrücklich abschließen/abbrechen, ohne heimliche Übernahme oder Verlust. Werkzeugvorgaben ändern keinen Bestand; nur ausdrücklich bearbeitete Auswahlfelder wirken. Kamera/Zoom bleiben nutzbar und die Karte zeigt das ursprüngliche Ziel. |
| Graphentwurf starten, Karte/Key korrigieren, Ansicht wechseln und speichern; dann verwerfen oder übernehmen | Ansichtswechsel/Speichern bestätigt keine Vorschau; Verwerfen erhält den gesamten Ausgangsstand unabhängig von Undo-Tiefe. Übernahme bestätigt den Gesamtentwurf, anschließend erfolgt ehrliche automatische Speicherung. Konflikt erhält ausstehende Arbeit, kein halber bestätigter Dungeon. |
| Key schreiben, Speicherfehler auslösen und vollständig neu starten | Kartenkürzel wirken nicht in Textfeldern, Fehler bleiben sichtbar und offene Arbeit erhalten. Erfolgreich gespeicherte Inhalte und Links sind wieder auffindbar. |
| Work (später): Höhle, Wasser/Material/Muster, Texturpfad, Dachformen und Licht bearbeiten | Jede Familie bietet Vorschau, gezielte Änderung/Radieren und Neuöffnung. Texturpfad ist keine Gangverbindung; Lichtblockierung entspricht der gewählten Geometrie. |
| Work (später) / Efficient gemäß Katalog: Punkt/Kurve, Landschaftsauswahl, Gruppen/Ebenen und Geschosse korrigieren | Einfügen/Entfernen, Kopieren, Sperren/Anordnung und Geschossklonen erhalten Daten/IDs/Bindungen; eigene Gesten sind auffindbar. |
| Efficient / Work (später) gemäß Katalog: Generator/Vorlage verwenden und Bewohner-/Gebäudedaten ändern | Erzeugung bleibt editierbar; Abbruch ohne Restdaten, Regeneration ohne Textverlust, eindeutige Inhaltszuordnung und gemeinsame Zeitquelle. |
| Work (später): Zusätzliche Ansicht und Bild-/Daten-/VTT-Ausgabe verwenden | Rückkehr erhält denselben bearbeitbaren Stand; Formatdaten, Ausschnitt, Maßstab, Licht und relevante Inhalte entsprechen der jeweiligen Ausgabeanforderung. |
| Efficient: dieselbe GM-Aufgabe mit Duplizieren, wiederholter Platzierung, Suche/Vorgaben und geschützter Neuerzeugung | Gleiche Startkarte/Inhalte und gleiches Ziel mit Work vergleichen: Aktionen, Suchaufwand, Fehler und Produktwartezeit getrennt beobachten. Wie im GM-Plan Erstkontakt und erlernte Wiederholung trennen; Übertragungszeit nicht als Produktlatenz zählen. Verbesserung erhält Ergebnisse und Schutzregeln; ein zusätzlicher Regler allein beweist keinen Nutzen. |
| Beautiful: dieselbe Karte nach Gestaltung und Oberflächenpolitur bearbeiten/ausgeben | Lesbarkeit und Rückmeldungen verbessern sich; Werkzeuge, Geometrie, Keys und GM-/Spielerausgabe behalten ihre funktionale Wirkung. |
| Work / Efficient: Nummer, Vorlesetext und GM-Notizen ändern; Nummernkonflikt beim Levelwechsel; Key filtern/sortieren und mehrere Texte ersetzen/voranstellen/anhängen | IDs/Links bleiben erhalten; Nummern sind eindeutig und übergreifend mit Level erreichbar. Spielertext enthält keine GM-Notizen. Text-Sammeländerung ist unmittelbar atomar rücknehmbar, ohne zusätzlichen Vorschaudialog. |
| Work (später): Beschreibungsblöcke ordnen, Fakten unterdrücken, Attribute lokal ändern und Vererbung wiederherstellen; danach Geometrie ändern | Nur betroffene Ableitungen ändern sich; Prosa und Reihenfolge bleiben erhalten, effektive Werte und Herkunft stimmen. Blickrichtungs-/Entdeckungs-/Spielervorschau offenbart keine realen Geheimnisse und ändert keine Passierbarkeit. |
| Work (später): Featureanker zwischen Räumen bewegen, mehrere am selben Ort wählen und Zielgeometrie entfernen | Encounter/Loot behalten ihre externe Identität und jeweils einen aktuellen Anker. Wiederholungen sind unabhängige Kopien; Curiosity/Rätsel bleiben manuelle Inhalte. Fehlende Zuordnung ist sichtbar und ohne Textverlust korrigierbar. |
| Work (später): Zwei getrennte Fallenfelder über benachbarte Volumes zeichnen, radieren und mit Geometrie verschieben; Maximum und beide Resetpolitiken festlegen | Felder, Anker und Regeln bleiben getrennt erhalten; Undo/Redo und Neustart stimmen. Laufzeitproben für bestätigten Verbrauch, weiteren Verbrauch ohne Countdown-Neustart und volle Aufladung gehören zum bestehenden Trap-/Reisevertrag. |
| Work (später): Licht/Schall binden und benannte Mehrzustandsaktion vorbereiten; Abbruch und bestätigte Ausführung getrennt prüfen | Quellen und unabhängige sensorische Fakten bleiben konsistent. Abbruch hat keine Teilwirkung; eine zulässige Ausführung ändert alle gewählten Fakten atomar nach dem vorhandenen Zustands-/Zeitvertrag. |
| Work (später): Graph reduzieren, Gruppe verbinden, Verteilung/Budgets ansehen; Entwurf in der Karte korrigieren und trotz kurzer Undo-Historie vollständig verwerfen | Echte Entscheidungen und stabile Identitäten bleiben erhalten; Diagnose nutzt strukturierte Features ohne Doppeltzählung oder automatische Qualitätswertung von Rätselprosa. Nicht zugeteilte Sessionanteile sind sichtbar. Wiederherstellen erhält den gesamten Ausgangsstand, Übernehmen erhält den korrigierten Gesamtentwurf. |
| Efficient: Autorenblöcke unabhängig kopieren, verknüpfte Inhaltsvorlage ändern und eine Instanz entkoppeln; Geometrie-Prefab getrennt verwenden | Kopien besitzen unabhängige Identitäten; Vorlagenänderung erreicht verknüpfte Instanzen. Entkoppelte Inhalte bleiben erhalten und unabhängig. Inhaltsvorlage überträgt weder Geometrie noch Zuordnung/Identität; Undo/Redo und Neustart erhalten Bindungen. |
| Efficient: Stadtasset bearbeiten/speichern/platzieren; vollständige Generierungsvorgabe teilen, wiederherstellen und abbrechen | Asset bleibt wiederverwendbar. Gleiche verfügbare Generatorversion, Seed und Parameter erzeugen denselben Grundplan; Versionabweichung wird sichtbar. Abbruch schreibt nichts, manuelle Korrekturen bleiben im separaten Kartentransfer geschützt. Originallücken der beiden CO-Fälle bleiben offen. |
| Work / spätere Erweiterung: Dungeon umbenennen, archivieren/wiederherstellen, duplizieren und Papierkorbfolge prüfen | Links und bestehender Laufzustand bleiben bei Archivierung erhalten; Kopie remappt nur ihre Autorenidentitäten und übernimmt kein Runtime/Wissen/Logs/Undo. Wiederherstellung und ausdrückliche irreversible Löschung werden getrennt geprüft. |
| Work (später): Dokument mit Karten/Graph/Key und GM-/Spielerprofil ausgeben; Dungeonpaket separat übernehmen | Sichtbarkeitsprofil schützt Geheimnisse und GM-Anhänge; Ausgabe enthält die gewählten Teile und gültigen Verweise. Paket entspricht seinem Autoren-/Ausschlussvertrag, nicht automatisch einem vollständigen Campaigntransfer; keine Runtime-Transferlücke wird dadurch geschlossen. |
| Maus, Touchpad, Tastatur und 200 % Darstellung | Werkzeuge, Griffe, Optionen und Abschluss-/Abbruchaktionen sind erreichbar; das Panel lässt die Karte bedienbar. |

Diese Proben sind geplante Produktabnahmen, keine mit der Dokumentation ausgeführten GUI-Tests oder neuen PASS-Einträge. Die konkreten Produkt-APIs, Speicherformate und bestehenden Quellbausteine werden durch diesen Werkzeugentwurf nicht geändert.

## 1. Ausgangspunkt und Zielbild

[Atlasstand](#atlas-auf-einen-blick), [Nutzerabläufe](#konkrete-nutzerabläufe),
[Bedienung](#gemeinsame-bedienung) und [Lieferprioritäten](#wie-kommen-wir-zum-ziel)
führen das Ziel und den Weg. Die [Wonderdraft-Referenz](WONDERDRAFT-PARITY.md)
benennt Version 1.1.8.2 und ihren noch begrenzten Originalnachweis.
Ooke-Welt und Ooke-Kontinent dienen als Bildvorlagen; die neuen Hexkarten entstehen nativ.

## 2. Verbindliche Architektur

### Gemeinsamer Raum und Kartenformate

Der [räumliche Vertrag](ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md) besitzt Maßstab,
Anchors, Geometrie, Roomidentität und Queries. Eine gemeinsame Kamera,
Werkzeugoberfläche, Auswahl und History; grenzenlose positive/negative
Koordinaten, keine Size-/Resizeaktion. Zoom ändert Details, keine Autorenwerte.
Mehrere Eingänge und unverortete Dokumente sind gültig.

Der [Gesamtstore](ARCHITECTURE.md#speicherung-und-wiederherstellung) ist nach
Cutover einzige kanonische Wahrheit. `.overworld`, `.location`, `.city` und
`.dungeon` bleiben explizite bekannte Import-/Exportadapter; sie erzwingen
keine separaten Autorenowner oder Dateijournale. Alte IDs/Prosa/Links und
Formatbindungen werden geschützt. Ein Haus hat einen gemeinsamen Außen-/
Innenstand, nicht zwei unabhängig bearbeitete Konturen.

### Hex-Stufen und Landschaft

3, 9, 27, … Meilen zwischen gegenüberliegenden Kanten, Ursprung/Ausrichtung gemeinsam. Bei regelmäßigen Nachbarhexes entspricht dies ihrem Mittelpunktabstand. Kleinste Stufe: 3 Meilen; weiteste Kameraansicht: erdgroße Referenzfläche von etwa 40.000 × 20.000 km, ohne feste Weltgrenze.
Alle Stufen sind bearbeitbar, gröbere Vorgaben werden pro Eigenschaft durch
ausdrückliche feinere Werte überschrieben. Reguläre Hexes verschiedener Stufen
verschachteln sich nicht exakt: Flächenüberschneidung statt fester Kindliste.
Reset entfernt nur die gewählte Overrideeigenschaft. Freie Wege/Küsten bleiben
über Chunkgrenzen verbunden. Sparse authored Records; Pan/Zoom malt nichts.
Details/35-Biome-/Symbolclosure stehen ausschließlich im Runtimeplan.

### Wiederverwendung der Editorbasis

Jede Übernahme ist eine begründete Einzelentscheidung. Quellen/Attribution/
Golddaten und geeignete reine Geometrie-/Einheitenbausteine sind Kandidaten;
Whole-Document-History/Sources, gekoppelte Filejournale und zweite imperative
Sessionwahrheit werden ersetzt. Keine Pflicht zum Erhalt alter interner APIs.
Neue Commands, Readmodels und sparse Records tragen den vollständigen Auftrag,
kein generischer GIS-/ECS-/Mehrspielerkern. Der [Plattformübergang](ROADMAP-SALTMARCHER-PLATFORM-ADR.md)
beschreibt Importvergleich und genau eine finale Produktlinie.

## 3. Kleine Phasen mit früh nutzbaren Ergebnissen

Die zehn bisherigen Etappen werden durch die folgenden **29 HEX-Phasen, HEX-00 bis HEX-28**, ersetzt und um **zehn Stadtphasen CITY-00 bis CITY-09** aus der [Stadtplan-Roadmap](ROADMAP-CITIES.md) ergänzt. Die Phasen beschreiben den vollständigen Zielumfang; sie sind keine Aussage, dass sämtliche Funktionen noch unimplementiert wären. Den integrierten Stand, Kandidaten und offenen Rest zeigt [die Übersicht](#atlas-auf-einen-blick). Die Kennungen und Fachanforderungen bleiben erhalten; die [Lieferstufen Work → Efficient → Beautiful](#wie-kommen-wir-zum-ziel) bestimmen die Lieferung. Fachphasen dürfen in Grundfunktion und späteren vollständigen Ausbau geteilt werden. Jede Lieferung erweitert den zuvor geprüften Benutzerablauf. Die Architektur aus Abschnitt 2 bleibt das Ziel, ihre notwendigen Teile entstehen zusammen mit der jeweiligen Funktion.

### Funktions- und Datenerhalt

Jede Erweiterung erhält den vorhandenen bearbeitbaren Atlas, gemeinsame Kamera/History und stabile Kennungen. Originalwirkung und Hostablauf werden mit isolierten Daten geprüft; fehlende Paritätsbelege bleiben offen. Datenverlust, falsche Speicherung, verlorene Entwürfe und unterbrochene Kernabläufe müssen vor abhängigem Ausbau behoben sein.

### HEX-00 – Ausgangsbasis und gemeinsame Testregion

Vorhandene Referenzinventare, Quellstand und begrenzte Hostbelege verwenden. Fehlende fachliche Wirkungen anhand gleicher Nutzeraufgaben gezielt im Original klären, sobald sie für die nächste Lieferung benötigt werden. Die vollständige Inventur bleibt offen nachgeführt; sämtliche Originalgesten, Regler und Helfermodule erneut zu erfassen ist keine Voraussetzung für einen benutzbaren Ausbau. Bestehende HEX-00-A/B/C-Belege bleiben historische Referenzläufe.

Die gemeinsame Testregion wächst mit den zentralen Lieferstufen und ihren funktionalen Erweiterungen. Originalversion, Aufgabe, erreichbare Wirkung und offene Frage werden im vorhandenen Register festgehalten. Identische Eingaben, Reglerwerte oder Algorithmen sind kein Ziel; unbekannte fachliche Wirkung bleibt offen.

### Meilenstein A – Eine Hexkarte tatsächlich bearbeiten

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im tatsächlichen Zielhost |
|---|---|---|
| **HEX-01 – Atlas anlegen und öffnen** | Grenzenlosen Atlas anlegen, benennen und öffnen, ohne Größenabfrage. 3-Meilen-Hexes anzeigen, ein Hex treffen und seine Adresse zeigen; verschieben, zoomen und belegte Inhalte einpassen. Ausrichtung, Weltmaßstab und Weltkoordinaten von Anfang an speichern. | Leeren Atlas öffnen, Hexes auf beiden Seiten des Ursprungs und außerhalb des ersten Ausschnitts anklicken. Pan/Zoom belegen keine Landschaftsdaten. Nach frischem Start stimmen Kennung und Adressen; ein bestehender Dungeon öffnet weiterhin. |
| **HEX-02 – Gelände malen und erhalten** | Land, Meer und einfacher Geländetyp per Klick und zusammenhängendem Pinselzug setzen; lokale Bearbeitung zurücksetzen; Undo/Redo, explizites Speichern und dauerhafte Entwürfe anbieten. Nur bearbeitete Hexes werden als spärlich belegte, getrennt ladbare Bereiche gespeichert; Inhalt erweitert die gemeinsame Ausdehnung automatisch. | Kleine Insel zeichnen und jenseits ihres bisherigen Bereichs weiterzeichnen, auch in negativen Koordinaten. Wachstum verlangt keine Resize-Aktion und verschiebt nichts. Abbruch, Undo/Redo, Speichern, Neuöffnung und Entwurfswiederherstellung erhalten Inhalt und daraus abgeleitete Ausdehnung. |

**Nach HEX-02 steht der erste benutzbare Hex-Editor bereit.** Sein Testbuild enthält einen vollständigen Bearbeitungs- und Speicherablauf; weitere Kartengestaltung folgt auf dieser Grundlage.

### Meilenstein B – Hex → Ort → Dungeon → Raum-Key → zurück

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im tatsächlichen Zielhost |
|---|---|---|
| **HEX-03 – Stadt und POI mit Key** | Stadt oder POI an einer Weltposition anlegen. Orts-Key mit stabiler Kennung und zwei frei bearbeitbaren Markdown-Abschnitten öffnen, Abschnitte ordnen und direkt verlinken. Anlage von Ort, Abschnitten und Atlasplatzierung als einen rücknehmbaren Command dauerhaft speichern; Recovery folgt dem gemeinsamen Storevertrag. | Ort anklicken, Text rechts bearbeiten, Abschnittslink öffnen und Ort verschieben. Undo/Redo und frischer Start erhalten Wortlaut, Abschnittskennungen und Position. Abbruch und unterbrochene Anlage hinterlassen nach Wiederherstellung keinen verwaisten Ortsverweis. |
| **HEX-04 – Einen Dungeon verorten** | Vorhandenen Dungeon über seine Kennung am Ort platzieren; externe `.dungeon`-Bestände zuvor über den geprüften Adapter übernehmen. Einen lokalen Eingangsanker wählen; Weltposition, Drehung, tatsächlichen Maßstab und Kartenumriss darstellen. | Bekannte Dungeonkontur platzieren und drehen. Lokaler Eingangsanker und Weltanker stimmen überein; Rücknahme und Neuöffnung erhalten die Bindung. Die Originaldatei und der lokale Dungeoninhalt bleiben durch die Platzierung unverändert. |
| **HEX-05 – Dungeon direkt im Atlas bearbeiten** | Beim Hineinzoomen verortete Dungeon-Geometrie im selben Atlas anzeigen, Raum und Key unmittelbar bearbeiten und durch Herauszoomen zur Region gelangen. Welt-/Lokalkoordinaten werden über die Platzierung umgerechnet. Zunächst werden eine Dungeonkarte und ihre Umgebung gemeinsam sichtbar und bearbeitbar. | Nur zoomen, Hex und Dungeonraum ändern, Key bearbeiten und herauszoomen. Keine Öffnen-/Betreten-/Modusaktion; Werkzeug, Auswahl, Lage, Maßstab und durchgehendes Undo/Redo bleiben korrekt. Speichern und frischer Start erhalten dieselbe Folge. |

**Nach HEX-05 ist der erste zusammenhängende Spielablauf benutzbar.** Der zugehörige Build wird mit der gemeinsamen Testregion bereitgestellt. Mehrere gleichzeitig sichtbare Detailkarten folgen in HEX-22; die erste räumliche Verbindung und Navigation sind bereits hier prüfbar.

### Frühe Stadtphasen im selben Atlas

CITY-01–04 enthalten den Stadt-/Gebäudegrundablauf für Work und dessen spätere Beschleunigung in Efficient. Sie bauen auf der verlässlichen gemeinsamen Bearbeitung auf; die Siedlung wird zunächst eigenständig geprüft und danach mit Region und Dungeon im Leitbeispiel verbunden. Der [zentrale Stufenplan](#wie-kommen-wir-zum-ziel) ersetzt feste Einschübe zwischen HEX-Nummern. CITY-05–09 behalten ihren vollständigen Fachumfang als zugeordnete Erweiterungen; auch dort gilt Work → Efficient → Beautiful.

### Meilenstein C – Weltmaßstab, eigene Vorlage und erste Ausgabe

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im tatsächlichen Zielhost |
|---|---|---|
| **HEX-06 – Alle Hex-Stufen bearbeiten** | Standardstufen von 3 bis 2.187 Meilen und erforderliche größere Stufen anbieten. Manuelle Stufenwahl und automatischer Wechsel mit Übergangsbereich; grobe Vorgaben, feine Überschreibungen und Zurücksetzen verbinden. | Auf 27 Meilen Land setzen, auf 3 Meilen eine Küste verfeinern, grobe Vorgabe ändern und ein feines Detail zurücksetzen. Alle Stufen, Ortspositionen, Übersicht und Neuöffnung zeigen den jeweils richtigen Zustand. |
| **HEX-07 – Verbundene Änderungen sicher erhalten** | Externe Importkonflikte, unterbrochene gekoppelte Transaktion, Wiederherstellung und direkte Links nach Umbenennungen ausdrücklich absichern. Benötigte Dungeonwirkung im gemeinsamen Kern liefern. | Orts-Key ändern und Platzierung verschieben; Abbruch im gemeinsamen Commit und externe Importänderung im isolierten Zielstore auslösen. Ein lesbarer, konsistenter Stand wird wiederhergestellt oder ein Konflikt gemeldet. Orts- und Raumlinks funktionieren nach Umbenennung. |
| **HEX-08 – Große Welt zuerst grob öffnen** | Atlas mit erdgroßer belegter Ausdehnung zunächst in grober Stufe öffnen; nur sichtbare Detailbereiche laden, Anfragen beim Weiterzoomen verwerfen und ungenutzte Ressourcen freigeben. Fortschreitend größere und weiter entfernte Inhaltsbereiche prüfen. | In einem belegten Bereich von 40.000 × 20.000 km zwischen entfernten Orten wechseln und darüber hinaus neue Inhalte setzen. Grobe Übersicht erscheint vor Detaildaten; Rückkehr zeigt gespeicherte Bearbeitung. Speichern, Undo und der Ort-Dungeon-Ablauf bleiben bedienbar. |
| **HEX-09 – Ooke als Nachzeichenvorlage** | Zunächst ein exportiertes Ooke-Bild laden, anhand zweier Referenzpunkte maßstäblich ausrichten und die Deckkraft ändern. Danach dieselbe Funktion für die zweite Ooke-Karte nutzen. Vorlagen sind separate Referenzassets. | Bekannte Küste und Ort nachzeichnen, Stufen wechseln und neu öffnen. Vorlage und native Landschaft bleiben ausgerichtet; die Referenz lässt sich ausblenden. Originale Wonderdraft-Dateien bleiben erhalten. |
| **HEX-10 – Erstes teilbares Kartenbild** | PNG des gewählten Welt- oder Regionsausschnitts ausgeben, Raster ein- oder ausschalten und eine Ausgabe bis 2.048 Pixel Kantenlänge anbieten. Export nutzt den gespeicherten Kartenstand und den gewählten Ausschnitt. | Testregion mit Ortsnamen exportieren und das Bild visuell öffnen. Ausschnitt und Maßstab stimmen auch bei verschobener Editorkamera; Rasteroption wirkt. Dies belegt noch keine 8.192-Pixel-Ausgabe. |

**Nach HEX-10 lässt sich eine mehrstufige Welt mit eigenen Vorlagen bearbeiten, mit Keys und Dungeon verwenden und als erstes Kartenbild teilen.** Fehler- und Größenprüfungen begleiten diesen Stand bereits.

### Meilenstein D – Eine natürliche Landschaft zeichnen

Der Nutzerentscheid vom 19.10.2026 konkretisiert native Geländehöhe und die spätere räumliche Ansicht in der [Relief-Roadmap R0–R7](docs/plans/maps/terrain-relief.md). Sie erweitert HEX-16 und verbindet HEX-06/08 mit dem kippbaren Atlas. Gebirge werden ausschließlich mit Land formen und Glätten modelliert; spezielle Formenwerkzeuge und Höhenkartenimport entfallen nach Nutzerentscheidung vom 20.10.2026; Bergsymbolstreuung aus HEX-18 ist dafür kein Ersatz. Allgemeine Symbol- und Waldwerkzeuge bleiben erhalten. Der isolierte R0-Prototyp ist noch keine integrierte Atlasfähigkeit.

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im tatsächlichen Zielhost |
|---|---|---|
| **HEX-11 – Küsten innerhalb von Hexes** | Land und Wasser auch innerhalb eines Hexes mit einem freien Pinsel bearbeiten. Zusammenhängende Küsten und weiche Übergänge darstellen; Änderungen bleiben in den betroffenen Hex-Bereichen verankert. | Eine Bucht und schmale Landzunge über mehrere Hex- und Ladegrenzen zeichnen. Zoomen, Undo/Redo, Neuöffnung und PNG-Ausgabe erhalten Verlauf und Anschlüsse ohne Naht. |
| **HEX-12 – Seen und Wasser gestalten** | See beziehungsweise Süßwasserfläche anlegen und radieren; Wasserfarbe und die für diesen Ablauf gemessenen Erscheinungsoptionen bearbeiten. | See innerhalb einer Insel zeichnen, einen Teil entfernen und Erscheinung ändern. Rücknahme, Neuöffnung und Export erhalten die Fläche; das angrenzende Land und die Ortspositionen stimmen. |
| **HEX-13 – Einen Fluss durchgehend zeichnen** | Fluss anlegen, mit der gemeinsamen Bedienung beenden oder abbrechen, Punkte ändern und Breite wählen. Durchgehende Geometrie über Hexes und Stufen sichern. | Fluss vom Gebirge bis ins Meer ziehen, einen Punkt verschieben und Breite ändern. Abbruch erzeugt keinen halben Fluss; Übergänge, Undo und frische Öffnung stimmen. |
| **HEX-14 – Orte mit Straßen verbinden** | Straße beziehungsweise Pfad zwischen Orten zeichnen, Punkte und Kurven bearbeiten und Stil wählen. Erreichbare Wegformen und einfache Stilvarianten prüfen. | Stadt, POI und Dungeon durch Wege verbinden. Einen Verlauf ändern; Verbindungen, Orts-Keys, Flussquerung und Ausgabe bleiben nach Neuöffnung an der richtigen Stelle. |
| **HEX-15 – Landmassen erzeugen** | Die erste Original-Generatorfamilie mit ihren gemessenen Parametern und reproduzierbarem Ausgangswert anbieten; weitere katalogisierte Muster im begrenzten Generator-Nachbesserungslauf ergänzen. Erzeugung rücknehmbar in die Landschaftsvorgaben übernehmen. | Zwei reproduzierbare Ausgangswelten erzeugen und eine davon weiterbearbeiten. Eine erneute grobe Erzeugung erhält vorhandene feine Überschreibungen und Orte; Rücknahme und Neustart erhalten den richtigen Stand. |
| **HEX-16 – Heightmap und Geländehöhe** | Heightmap als eigenes Eingangsmaterial übernehmen und Landmassen anheben beziehungsweise absenken. Die Übernahme erzeugt native, anschließend bearbeitbare Landschaftsvorgaben. | Kleine bekannte Heightmap übernehmen, Inselhöhe verändern und einen Küstenabschnitt von Hand ändern. Speicherung, Rücknahme und Neuöffnung erhalten die native Bearbeitbarkeit und räumliche Ausrichtung. |

Nach jeder neuen Landschaftsfunktion wird derselbe Insel-Ort-Dungeon-Ablauf erneut durchgespielt. Stil- oder Shaderänderungen müssen dabei auch den zuvor erzeugten PNG-Ausschnitt bestehen.

### Meilenstein E – Die Karte lesbar ausarbeiten

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im tatsächlichen Zielhost |
|---|---|---|
| **HEX-17 – Ein Symbol auswählen und setzen** | Ein Symbol aus einer kleinen Bibliothek auswählen, Vorschau zeigen, platzieren, auswählen, skalieren, drehen, spiegeln, duplizieren, anordnen und entfernen. Gemeinsame Platzierungs- und Korrekturaktionen verwenden. | Berg, Baum und Siedlung setzen; überlappende Symbole bearbeiten. Jeweils Karte und Trefferreihenfolge prüfen; Undo/Redo und Neustart erhalten Position, Maßstab und Ordnung. |
| **HEX-18 – Wälder und Gebirge pinseln** | Gruppenpinsel mit Dichte, Streuung und Varianten für Bäume und Berge; Radieren und rücknehmbare zusammenhängende Pinselzüge. Bewuchs ist seit dem Nutzerentscheid vom 20.10.2026 als [geländeabhängige Landschaftsflächen mit Einzelkorrekturen](docs/plans/maps/vegetation.md) konkretisiert; Gebirge folgen den Höhenwerkzeugen. | Wald über mehrere Hexes malen, Teilbereich radieren und einen ganzen Zug rücknehmen. Eine gebirgige Region bleibt bei Stufenwechsel, Export und Neuöffnung vollständig und bedienbar. |
| **HEX-19 – Eigene Assets und Bibliothek** | Eigene Symbolsets aufnehmen; passende Farbmodi, Suche, Paketwahl, erneutes Laden und Fehlasset-Platzhalter ergänzen. Nur benötigte Vorschauen dekodieren. | Eigenes Set einsetzen, Farbe bearbeiten, neu laden und ein Asset im Testset fehlen lassen. Bestehende Instanz bleibt erhalten; Bibliothek, Ortsnavigation und Neustart funktionieren mit großem Katalog. |
| **HEX-20 – Namen und Beschriftungen** | Freie Beschriftung, Format- und Schriftvorgaben, Drehung, mehrzeilige Texte, Name-Vorschläge und gemeinsame Text- und Platzierungsaktionen ergänzen. Ortsgebundene Namen übernehmen die zugehörige Ortskennung. | Stadt umbenennen, Fluss beschriften, mehrzeiligen Titel setzen und bei verschiedenen Zoomstufen lesen. Ortslink, Abschnittslink, Formatierung und Export bleiben nach Neuöffnung korrekt. |
| **HEX-21 – Gebiete und Grenzen** | Politische und geografische Gebiete anlegen, Grenze und Erscheinung bearbeiten und mit einem Orts-Key verknüpfen. Gebiete benutzen dieselben Weltkoordinaten wie Landschaft und Orte. | Zwei Gebiete über mehrere Hexes zeichnen, gemeinsame Grenze ändern und den Regions-Key öffnen. Grobe und feine Ansicht, Links, Undo und PNG zeigen denselben Grenzverlauf. |

### Meilenstein F – Mehrere Detailkarten im gemeinsamen Raum

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im tatsächlichen Zielhost |
|---|---|---|
| **HEX-22 – Stadt und mehrere Dungeons im Atlas** | Mehrere Detailkarten abhängig von sichtbarer Größe mit Vorschau und vollständiger Geometrie darstellen. Stadt aus CITY-03, zwei Gebäudeinnenräume sowie eigenständige Orts-Dungeons und mehrere Eingänge räumlich verbinden; alle sichtbaren Geometrien im selben Editor direkt bearbeitbar halten. | Ausschließlich von Welt zu Stadt und zwei Hausgrundrissen hinein-/herauszoomen; Straßen, Räume und Keys ohne Kontextwechsel mit gemeinsamer Undo-Folge bearbeiten. Nach Save/Neustart stimmen Lage, gültige Auswahl und Eingangszielpunkte; eine über Neustarts fortgesetzte Undo-Historie ist nicht vorausgesetzt. Außer Sicht liegende Ressourcen werden freigegeben. |

Diese Phase erweitert den seit HEX-05 funktionierenden Übergang. Ihr Review prüft zusätzlich mehrere benachbarte und überlappende Karten sowie den Erhalt der ersten Ein-Karten-Folge.

### Meilenstein G – Verbleibende Wonderdraft-Werkzeugfamilien vervollständigen

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im tatsächlichen Zielhost |
|---|---|---|
| **HEX-23 – Landmassenausschnitt bearbeiten** | Lasso, Flächenauswahl, Ausschneiden, Kopieren, Einfügen, Verschieben und Größenänderung für Landschaft mit eigener Bedienung und gleichwertiger bearbeitbarer Wirkung anbieten. Betroffene Landschaftsdaten ändern sich als zusammengehöriger Befehl. | Inselteil auswählen, kopieren, verschieben und rücknehmen. Land, Süßwasser und andere laut Original mitbewegte Bestandteile prüfen; bestehende Ortsbindungen, gespeicherte Vorgaben und Neuöffnung bleiben konsistent. |
| **HEX-24 – Gestaltungsvorlagen und Effekte** | Kartenweite Vorlagen, Texturen, Paletten und die katalogisierten Erscheinungseffekte ergänzen. Geometrie und Key-Inhalte bleiben eigenständige Daten. | Auf derselben Testregion mehrere Vorlagen und Effekte anwenden. Beschriftungen, Wasser und Symbole bleiben lesbar; Raum- und Orts-Keys unverändert. Editor und PNG zeigen dieselbe Gestaltung. |
| **HEX-25 – Rahmen, Kompass und Maße** | Rahmen, Kompassrose, Maßstabsleiste und Messwerkzeuge mit gleichwertiger Wirkung ergänzen. Größen und Entfernungen aus dem gemeinsamen Weltmaßstab ableiten. | Bekannte Strecke zwischen Orten messen und eine Maßstabsleiste setzen. Welt-, Regions- und Dungeonmaßstab, Rahmen, Undo, Neuöffnung und Export stimmen. |
| **HEX-26 – Ausschnitte und Vorgaben** | Benannte Welt-/Regionsausschnitte in Meilen oder Hex-Kacheln verwalten; relevante Vorgaben, Rasteroptionen, Tastenkürzel und Vorlagen-Zeichenreihenfolge vervollständigen. Wonderdrafts endliche Karten-/Detailgrößen werden ausdrücklich auf Ausschnitte im grenzenlosen gemeinsamen Atlas abgebildet. Verfeinern benötigt keine separate Detailkarte oder Bearbeitungsansicht. | Ausschnitt vergrößern/verkleinern, Vorgaben ändern und neu öffnen. Inhalte außerhalb des Ausschnitts bleiben erhalten und direkt erreichbar. Landschaft, Stadt und Dungeon behalten Weltposition, Links und gemeinsame Bearbeitung; Ausschnittsänderungen sind rücknehmbar. |
| **HEX-27 – Vollständige Bildausgabe** | PNG/JPEG, Ausschnitt, gewählte Detailstufe, Raster, Gestaltung und Ausgabegröße bis mindestens 8.192 × 8.192 Pixel vollständig anbieten. Große Bilder werden ohne vollständiges Laden aller Welt-Detaildaten ausgegeben. | Region und Welt in beiden Formaten ausgeben, darunter ein 8.192-Pixel-Bild. Bild öffnen und gezielte Details prüfen; laufende Bearbeitung, gespeicherter Stand und Ergebnis hängen nicht von der Editorkamera ab. |

Vor jeder Lieferung müssen ihre fachlichen Ergebnisse und Datenabhängigkeiten eindeutig sein; vorhandene Originalbelege werden verwendet und unklare Wirkungen gezielt ergänzt. Die eigene Umsetzung wird anhand derselben Aufgaben auf benanntem Build geprüft. Offene spätere Fähigkeiten bleiben zugeordnet; vollständige Ergebnisabdeckung ist Voraussetzung der Endabnahme, kein Vorabtor für den ersten nutzbaren Work-Ablauf.

### HEX-28 – Endstand prüfen und gesichert installieren

**Ergebnis:** Die vollständige Wonderdraft-Parität und der zusammenhängende Atlasablauf bestehen auf demselben Endbuild. Der Abnahmekatalog enthält für jede Pflichtfunktion direkte Original- und Hostbelege beziehungsweise eine ausdrücklich vereinbarte Anpassung durch die Hex-Grundstruktur. Offene Pflichtfälle verhindern die Behauptung vollständiger Gleichwertigkeit und werden in ihren zuständigen Werkzeuggruppen nachgebessert.

**Praxistest:** Kleine Testregion und große Prüfwelt aus Abschnitt 4 im tatsächlichen Zielhost bearbeiten, speichern, wiederherstellen und frisch öffnen. Physische Maus-/Touchpad-Eingaben, Detailkarten, Orts- und Raumlinks sowie Ausgabebilder prüfen. Nach Sicherung des aktuellen Produktstands installieren und den Kernablauf auf dem tatsächlich installierten Build wiederholen.

## 4. Abnahme, Fehlerfälle und feste Vorgaben

### Häufige Prüfungen und ein gemeinsamer Alltagsablauf

1. **Während der Änderung:** Gezielte Kernprüfungen für tatsächlich gefährdete Regeln wie Koordinatenumrechnung, Vererbung, Undo und gekoppelte Recovery ausführen. Eine neue sichtbare Aktion früh im tatsächlichen Zielhost bedienen.
2. **Am Ende jeder Phase:** `npm run check`, `npm test` und `npm run build` ausführen; den neuen Ablauf und die bisher verfügbare Folge auf der gemeinsamen Testregion prüfen. Änderung, Abbruch, Undo/Redo, Save und frische Öffnung gehören bei betroffenen persistenten Daten dazu. Der kurze unabhängige Review kontrolliert auch den Build der Nachweise.
3. Einen überprüften Testbuild auf isolierten Daten ausprobieren; getestete Funktionen und offene Fälle mit direktem Beleg unterscheiden.
4. **Nach Änderungen an Kamera, Laden, Assets oder Renderer:** Eine größere Karte und mehrfaches Hin- und Zurückzoomen prüfen. Die Testgröße wächst von der kleinen Region über 10.000 zu 100.000 bearbeiteten Hexes. Zeit, Speicher und Ressourcenfreigabe werden ab HEX-08 tatsächlich gemessen.
5. **An jedem Meilenstein:** Den bisherigen Kernablauf zusammenhängend durchspielen und gespeicherte Texte, Links, Positionen und einen bisherigen Referenzausschnitt vergleichen. Physische Bedienung beginnt mit dem ersten nutzbaren Stand; fehlende Hardware-/Nutzerprüfungen bleiben offen und werden nicht aus synthetischen Eingaben abgeleitet.

Ab HEX-05 lautet die feste Folge: **Region anzeigen → Hex ändern → Orts-Key bearbeiten → in den Dungeon zoomen → Raum und Key bearbeiten → herauszoomen → rücknehmen/wiederholen → speichern → frischer Start → denselben Ort wiederfinden.** Ab CITY-03 wird zusätzlich in Stadt und Haus gezoomt und dort Straße, Gebäude und Hausgrundriss direkt bearbeitet. Keine dieser Aktionen verlangt einen Karten-, Kontext- oder Moduswechsel. Spätere Landschafts-, Symbol- und Exportfunktionen werden in diese Testregion eingebaut. Ein reiner Editor-Neustart oder eine Sammlung isolierter Dialogtests ersetzt diese Folge nicht.

Funktionsbeleg und Paritätsbeleg werden je Unterfall getrennt festgehalten; Nachweise nennen den geprüften Build und den tatsächlichen Stand.

### Funktions- und Bedienabnahme

Der [Wonderdraft-Vergleichsplan](WONDERDRAFT-PARITY.md) übernimmt den Unterfall- und Paarablauf der Dungeondraft-Abnahme. Der verbindliche Katalog unter `acceptance.json.wonderdraftParity` hält für jeden Fall fest: exakter Originalpfad und Ablauf, Optionen, Vorschau, Abschluss oder Abbruch, Undo/Redo, gespeicherter Zustand, frische Neuöffnung, Hostbuild, Review und verbleibende Abweichungen. Insbesondere werden Werkzeugvorgaben und vorhandene Instanzen, Auswahl-/Zeichenreihenfolge, Abbruch/Textfokus und globale beziehungsweise kartenlokale Werte getrennt geprüft. Die offiziellen [Tastatur- und Gestenabläufe](https://github.com/Megasploot/Wonderdraft/wiki/Shortcuts) dienen als Einstieg; maßgeblich bleibt das Verhalten der lokalen Version. Fehlende Originalbelege bleiben offen.

Die eigenen Werkzeuge erreichen die benötigten Wirkungen in der gemeinsamen Atlasansicht. Originalgesten dienen als Referenzbeobachtung, nicht als Nachbaupflicht. Es werden dafür keine Overworld-, Stadt- oder Dungeonmodi eingeführt. Alle Vorbilder werden anhand gleicher Aufgaben und bearbeitbarer Ergebnisse verglichen; die eigene Bedienung wird gesondert geprüft. Texteingabe im Key-Editor darf keine Kartenaktionen auslösen.

### Zusammenhängende Prüfszenarien

- Eine grobe Insel gestalten, bis zum 3-Meilen-Hex hineinzoomen und einen Küstenbereich verfeinern. Anschließend die grobe Vorgabe ändern und den Erhalt der feinen Bearbeitung prüfen.
- Fluss und Straße über Hex-, Stufen- und Ladegrenzen bearbeiten; sämtliche Anschlüsse nach Neuöffnung kontrollieren.
- Stadt mit Orts-Key, POI und Dungeon anlegen. Verschiebung, Drehung und mehrere Eingänge einschließlich Rücknahme prüfen.
- Oberste Hex-Stufe → Region → Stadt → Haus → Raum ausschließlich zoomen; auf jeder Detailstufe direkt bearbeiten. Werkzeugleiste, Werkzeug, Auswahl und durchgehende Undo-Folge dürfen nicht durch einen Modus-/Kontextwechsel ersetzt werden.
- Jenseits der bisherigen belegten Ausdehnung Gelände zeichnen, eine Stadt platzieren und ein Gebäude mit Innenräumen bearbeiten. Ohne Resize-/Betreten-/Kartenwechselaktion hinein- und herauszoomen; Undo/Redo und Neuöffnung erhalten alle Weltpositionen. Eine Änderung des Exportausschnitts beschneidet keinen Atlasinhalt.
- Direktlinks zu Orts-, Raum- und Key-Abschnitten nach Dateiumbenennung und Neustart öffnen.
- Externe Dateiänderung und unterbrochenes Speichern provozieren. Konflikte müssen sichtbar bleiben und Entwürfe wiederherstellbar sein.
- Bildvorlage, Editoransicht und Export auf denselben Ausschnitt ausrichten und ihre räumliche Übereinstimmung kontrollieren.

### Größen- und Leistungsabnahme

Die große Prüfwelt besitzt eine **belegte Ausdehnung von 40.000 × 20.000 Kilometern**, 100.000 ausdrücklich bearbeitete kleine Hexes, 5.000 Orte und 50 verknüpfte Detailkarten; mindestens ein Dungeon enthält über 4.000 Entitäten. Das ist ein Prüfszenario, kein Atlaslimit. Neue Inhalte jenseits dieses Bereichs gehören zur Wachstumsabnahme.

Geprüft werden Ladezeit, Reaktionszeit, Kamerabewegung, Speicherbedarf und Freigabe ungenutzter Ressourcen. Als Ziel gelten auf dem vorhandenen Laptop nach dem Laden höchstens 33 ms pro Navigationsbild im 95. Perzentil und höchstens 100 ms bis zur Werkzeugvorschau. Die Übersicht muss nutzbar werden, bevor alle Detaildaten geladen sind.

Kernprüfungen, Build, Zielhost-Bedienung, Großkartenlauf und physische Maus-/Touchpad-Abnahme werden getrennt dokumentiert.

### Gewählte Defaults

- Die Welt ist zunächst ein **ebener Atlas**; Weltkarten benötigen keine Kugelprojektion.
- Der Atlas hat keine festen Ränder und keine Größenabfrage beim Anlegen. Inhalt bestimmt die belegte Ausdehnung. Erzeugte Bereiche, Vorlagen und Ausschnitte erhalten Maße in Meilen oder Hex-Kacheln einer benannten Stufe; Pixel bestimmen nur Darstellung und Bildausgabe.
- Hex-Ausrichtung ist beim Anlegen wählbar und bleibt danach fest.
- Automatischer Stufenwechsel besitzt einen Übergangsbereich gegen Hin-und-her-Springen; eine manuelle Stufenwahl bleibt möglich.
- Unterhalb der 3-Meilen-Stufe entstehen keine weiteren Overworld-Hex-Stufen. Stadt- und Dungeonraster übernehmen die Detailbearbeitung.
- Orts-/Raum-Keys und Stadtgeometrie folgen dem [gemeinsamen Store- und Adaptervertrag](#gemeinsamer-raum-und-kartenformate). IDs, Prosa und bestehende Links bleiben beim Übergang erhalten.
- Außenform und Innenräume eines Gebäudes werden gemeinsam bearbeitet; eigenständige Dungeons bleiben stabil verortet. Generation schützt manuelle Änderungen, Innenräume und Keys.
- Der Atlas bleibt ein durchgehend bearbeitbarer Raum ohne separate Modi. Zoom allein erschließt räumliche Größenstufen; Detaildarstellung ist kein Wechsel des Editors.
- Bestehende Wonderdraft-Karten werden als Bildvorlagen verwendet; ihre Originaldateien bleiben erhalten.
- Bestehende Dungeonkarten werden durch ihre Atlasplatzierung nicht umgerechnet oder neu gezeichnet.

## Einordnung in das Gesamtprodukt

Der [Hex-Beitrag zum gemeinsamen End-to-End-Fertigstellungsplan](ROADMAP-E2E-GATES-CANDIDATE.md#räumliche-end-to-end-kriterien) verbindet die nächsten sichtbaren Phasen mit Campaign, Dungeon/City, Live-Spiel und Fehler-/Displaygates aus den [E2E-Kriterien](ROADMAP-E2E-GATES-CANDIDATE.md). Die vier gemeinsamen Abläufe ersetzen keine der hier verpflichtenden Fachphasen oder Wonderdraft-Vergleiche. Neue Integration erfolgt über geprüfte Kandidaten-SHAs mit unabhängigem Review.

R5 der Relief-Roadmap ist lokal implementiert und geprüft: [gekippter Atlas mit denselben drei Landpinseln](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/terrain-tilted-atlas-r5-20261020/README.md). R6/R7, Main-/Candidate-CI und Paket-/Installationsqualifikation bleiben offen.
