# Roadmap: Hex-Atlas mit Wonderdraft-Parität und verbundenen Orts- und Dungeon-Keys

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: atlas
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## Atlas auf einen Blick

**Desktop 0.157:** Regionswerkzeuge für freie Küsten, Flüsse/Wege, Orts-Keys, kalibrierte Bildvorlagen, Messung und saubere PNG-/JPEG-Ausgabe bis 8192 Pixel sind im gemeinsamen Atlas ergänzt. Kleinste Hexgröße: 3 Meilen Kante zu Kante; weiteste Ansicht: erdgroß. Bedienweg und Grenzen stehen unter [Eine Region vorbereiten](../guide.md#eine-region-vorbereiten). Die folgende ältere Bestandstabelle bleibt eine historische Einordnung.

**Aktueller Desktopumbau:** Pro Kampagne genau eine gemeinsame Karte mit räumlichen Stadt-/Gebäudebindungen und einer Autorhistorie. Bedienung, Nachweisgrenzen und offene Fachumfänge stehen in [ATLAS.md](../guide.md). Obsidian wird nicht weiterentwickelt. Die folgende Übersicht hält den älteren Integrationsstand fest und ist keine Freigabe des Desktopumbaus.

**Ziel:** Welt → Region → Stadt → Haus → Dungeonraum durch Zoom erreichen und direkt bearbeiten; eine Kamera, eine Undo/Redo-Folge und gemeinsame haltbare Daten.

**Geprüfter Stand: 13.10.2026**, gemeinsamer Branch `active/installed-phase1`, Commit [af858153](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/commit/af85815313aac6e964e235d3e7acbdf294cce0e0). Der Atlas besitzt bereits einen benutzbaren Hex-/Ortskern, integrierte Stadt-/Dungeon-Teilabläufe und den ersten begrenzten Bildexport. Der vollständige Zielablauf und E2E-01 bleiben offen.

### Was funktioniert, was fehlt?

**Integriert** bedeutet im gemeinsamen Branch vorhanden, **Kandidat** bedeutet nur im genannten offenen PR. Die Belege bestätigen jeweils begrenzte Abläufe; vollständige Fachabnahme und lokal installierte Pluginversion sind daraus nicht ableitbar.

| Fähigkeit | Bereits umgesetzt / Beleg | Fehlt zum Ziel |
| --- | --- | --- |
| Hexgelände | **Integriert:** grenzenloser Atlas; 3-Meilen-Hexes mit Land, Meer, Wald und Farbe; Pinsel, Zurücksetzen, Undo/Redo, Speichern und Entwurf. [HEX-01/02](../../../acceptance.json) | Vollständige Landschaftswerkzeuge und Gleichwertigkeit mit dem Original. |
| Mehrere Maßstäbe | **Teilweise:** größere Raster beim Herauszoomen; Gelände wird auf der kleinsten Stufe gespeichert. [Terrainformat](../../../src/features/atlas/terrain-schema.ts) | Alle Hexstufen bearbeiten; grobe Vorgaben und geschützte feine Überschreibungen, HEX-06. |
| Orte und Orts-Keys | **Integriert:** Stadt-/POI-Marker anlegen, verschieben, Markdown bearbeiten; gemeinsame Rücknahme, Speichern und Neustart belegt. [Abschluss #40](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/40#issuecomment-6102165161) | Links nach Umbenennung und vollständigen Ablauf abnehmen. |
| Vorhandene Stadt bearbeiten | **Integriert:** Häuser und Straßenknoten verschieben, Hausnamen ändern und Häuser drehen. Begrenzte Obsidian-Speicher-/Neustartbelege. [Stadtabnahmen](../../../acceptance.json) | Vollständiges Zeichnen/Neuanlegen und sämtliche Stadtfunktionen. |
| Assistierte Bebauung | **Kandidat [PR154](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/154):** Fläche/Straßen/Platz, Häuser erzeugen, Dichte/Größe/Variante, Vorschau/Abbruch und präzise Hauskorrektur; kleine Speicher-/Neustartfälle in Obsidian. | Übernahme; neue Stadt mit Dateien und Kampagnenverweisen anlegen; große Bedienprobe. [Restarbeit #149](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/149) |
| Haus und Innenraum | **Teilweise:** metrische Stadt-/Haus-/Dungeonbindungen und Dach-/Raumdarstellung im gemeinsamen Zoom. [Atlasdarstellung](../../../src/features/atlas/spatial-canvas.ts) | Gemeinsam bearbeitetes Gebäude mit Außenform und Innenräumen; Wandänderung und Gesamtskalierung; vollständiger Key-/Regenerationsablauf, CITY-03/04. |
| Dungeon im Atlas | **Integriert:** vorhandenen Dungeon am Ort verorten; Raumkontur/Key bearbeiten und zurückkehren, gemeinsames Undo/Speichern. [Obsidian-Teilbelege #80](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80) | Restliche Bedien-/Wiederherstellungsfälle und vollständige HEX-04/05-Abnahme; mehrere Detailkarten, HEX-22. |
| Räumlicher Dungeon | **Integriert [PR158](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/158):** 3D-Volumes, Höhen, Schnitte, Flächenbearbeitung und Undo/Speichern/Neustart im Dungeon-Editor. | Vollständiger Atlasanschluss; Raumzuordnung bei Bewegung/Teilung/Vereinigung, räumliche Wege/Durchgänge, Graphentwurf, Attributvererbung, Inhaltsvorlagen und weitere [Dungeon-Fachziele](../../project/requirements/scope.md). |
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

Die Reihenfolge ist eine Vorbereitungshypothese, kein gemessener Nutzungsbefund. Die bestehenden [GM-Aufgaben](../../project/verification/gm-workflows.md) dienen als konkrete Vergleichsproben: unter anderem sechs Räume ausarbeiten, zehn Assets setzen, Inhalte finden und nach Neustart weiterarbeiten. Efficient vergleicht Aktionen, Suchaufwand, Fehler und Wartezeiten derselben Aufgabe; zusätzliche Optionen müssen dabei helfen. Vollständiger Funktionsumfang und Größen-/Host-/Exportnachweise bleiben Voraussetzung der Endabnahme, einschließlich getrennter installierter und physischer Bedienabnahme.

Das zentrale [Werkzeugverzeichnis](atlas-2.md#konkreter-werkzeugkatalog) ordnet den Zugang und die Stufen zu; `acceptance.json` bleibt das einzige Funktions- und Nachweisregister. Fachpläne verweisen auf diese Lieferfolge und behalten ihre Details. Die [E2E-Abnahmen](../../project/delivery/roadmap.md#lieferfolge-des-gesamtprodukts) behalten ihre fachlichen Voraussetzungen. Diese Planung vergibt keine neuen Nachweise oder PASS-Zustände.

Abnahmedetails stehen in `acceptance.json`; die folgenden Abschnitte führen Zielarchitektur, Anforderungen und Umsetzung.

## Umsetzungsplan

**Einstieg:** [Prioritäten](atlas.md#wie-kommen-wir-zum-ziel) → [Lieferpakete](atlas.md#lieferpakete-und-codeanschlüsse). Die Nutzerabläufe und der Werkzeugkatalog definieren weiterhin die Wirkung. Dieser Abschnitt übersetzt sie in Codearbeit; er eröffnet keine zweite Prioritäts- oder Statusliste.

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

Work liefert diese Ordnung zuerst mit den bereits nutzbaren Aktionen; ungebaute Funktionen werden nicht als scheinbar fertige Schaltflächen angeboten. Eine konkret fehlende Voraussetzung wird am betroffenen Zugang erklärt. In Efficient kommen die benötigten Optionen hinzu; Beautiful vereinheitlicht Gestaltung und Rückmeldungen. Die Regeln für Entwurf, Textfokus, Werkzeugwechsel und Speicherung stehen ausschließlich bei der [gemeinsamen Bedienung](atlas-2.md#gemeinsame-bedienung).

### Werkzeuggruppen der Atlassteuerung

| Bereich | Gruppen |
| --- | --- |
| Landschaft | Land · Wasser · Wege & Flächen · Objekte |
| Stadt | Flächen · Straßen & Plätze · Gebäude · Objekte |
| Dungeon | Räume & Höhlen · Wände & Übergänge · Boden & Wasser · Objekte |

Nur vorhandene Werkzeuge erscheinen; leere Gruppen bleiben ausgeblendet. Landform, Landfarbe, Süßwasser und Wasserfarbe besitzen direkte Werkzeugzugänge einschließlich ihrer Radierer. Geländedaten, Hexfüllung und Zurücksetzen gehören zu Land. Flüsse gehören zu Wasser, Straßen zu Wege & Flächen und Orte zu Objekte. Stadtbefestigungen und assistierte Bebauung gehören zu Gebäude; Dungeon-Dächer und grafische Pfade zu Boden & Wasser. Licht, Text und Fallen/Features gehören zu Dungeon-Objekte. Noch fehlende Gebiets- oder Symbolwerkzeuge werden dadurch nicht als implementiert behauptet.

Beim ersten Öffnen sind Landschaft/Land und die globale Auswahl aktiv. Gruppen merken sich ihr zuletzt verwendetes Werkzeug, Bereiche ihre letzte Gruppe. Beim ersten Gruppenbesuch wird das erste verfügbare Werkzeug gewählt. Alle Wechsel durchlaufen denselben Entwurfsschutz. Werkzeugwerte bleiben während der Sitzung erhalten. Objekte öffnen ihre Bibliothek rechts, bewusste Auswahl öffnet Eigenschaften. Manuelles Schließen bleibt bis zur nächsten passenden Benutzeraktion erhalten; Nachladen und Zoom öffnen das Panel nicht erneut. „Mehr Optionen“ öffnet die vorhandenen zusätzlichen Einstellungen. Stadt/Dungeon anlegen, Raumverzeichnis und Analyse bleiben benannte Zugänge.

### Lieferpakete und Codeanschlüsse

**Technische Richtung vom 11.10.2026:** [Gesamtgrundlage](../../project/architecture/overview.md),
[räumlicher Vertrag](../contract/spatial-runtime.md) und
[Übergang](../../project/architecture/platform-decision.md). Geprüfter Istcode:
`116c16af48b6a073216685c8d8e2cc74fada82c3`. `storage.changed()` sichert derzeit
einen Draft; der separate Save ist noch kein automatischer Normalbetrieb.
Whole-Document-Sources, FileTransaction und imperative Sessionwrapper besitzen
keinen Bestandsschutz. Daten/Verhalten schützen, geeignete reine Teile begründet
übernehmen, gekoppelte Zustands-/Speicherstrukturen ersetzen.

| Lieferpaket | Konkrete Umsetzung im gewählten Kern | Abschluss / Fachanschluss |
| --- | --- | --- |
| **Work 1a – Datenbasis, Finden und Bearbeiten** | Aktuelle Formate/Links inventarisieren und importvergleichbar sichern. Kleine Electron-Shell, typisierte Records/IDs, ein SQLite-Schreibdienst und gemeinsame Kamera/Auswahl/Textdrafts. Bestehende reine Polygon-/Einheiten-/Such-/Controlteile nur nach passender Prüfung übernehmen. | Ort/Room finden, Kontur/Key ändern, gemeinsames Undo/Redo. Scope/Revision/Context, Textfokus und Überlagerung prüfen; kein heimlicher Formatumbau. [P01/P02](../../project/verification/architecture-experiments.md). |
| **Work 1b – Automatisch dauerhaft sichern** | Änderungen, Undo-Deltas und Receipt in einem Commit; pending/durable/Fehler ehrlich. A→B→A und spätes Jobresultat absichern; normaler Close/Restart ohne manuelles Save. Backup/Assetstaging für den verwendeten Datenweg anschließen. | Fehler/Crash/unknown outcome bewahren bestätigte Arbeit und offene Eingabe. Tatsächlichen Store benutzen, keinen Memory-PASS. [Campaign](../../campaign/contract/archive.md). |
| **Work 2 – Kleiner Dungeon und Ausgabe** | 5-Fuß-Volumes, stabile Roominhalte, Gang/Tür/einfache Treppe, Slice/Geschoss und Keys im gemeinsamen Raumvertrag. Draw/Hit/Export aus derselben Projektion; vorhandene Zeichnungsartefakte ausdrücklich übertragen. | Sechs Rooms ausarbeiten/korrigieren, GM-/freigegebenes Spieler-PNG und Reopen. Kleine unabhängige Dungeonvorbereitung; keine Pflicht zu fertiger Region/Graph/Traps. |
| **Work 3 – Kleine Region** | Sparse Landschaftsrecords, freie Küste/Fluss/Straße, Ortsreferenzen, kalibrierte Vorlage und Messung. Mehrstufige partielle Eigenschaften im Modell vorsehen; einzelne Stufen je benötigtem Weg liefern. | 3-Meilen-Region mit drei Orten, verbundenen Wegen, korrekten Metern und Ausgabe/Restart. Custombiom-/Symbolkatalog besitzt installationsweite Referenzclosure. |
| **Work 4a – Assistierte Siedlung** | Citymeterrecords, Straßen/Platz/Polygon, versionierte Seed-/Parameterrecipe, abbrechbarer Workerpreview; eine Annahme schreibt editierbare Geometrie. | Eichenfurt erzeugen, Variante verwerfen, übernehmen, Taverne korrigieren und frisch öffnen. Keine Generation beim Laden. [CITY-01/02/04](../../city/contract/city.md#technische-arbeitspakete). |
| **Work 4b – Haus und Innenräume** | Ein gemeinsamer Gebäudestand, ausdrücklich leere Innenhülle, Räume/Geschosse. Keine dauerhaft synchronisierten Außen-/Innendokumente. Meterpose, Wandreichweite und horizontale Skalierung mit derselben Commandgrenze. | Außen/Innen, Türen/Anker, Text/IDs stimmen nach Zug/Undo/Restart. [Gebäude](../../city/contract/city.md#gemeinsamer-gebäudezustand-erste-umsetzung). |
| **Weitere Fachfähigkeiten – eigener Work-Abschluss** | World/Plan/Katalog/Party/Scenes an denselben Store anschließen; Room-Lifecycle → Path/Passage → Features/Beschreibungen/Templates/Graph. Travel/Clock vor abhängigen Zeitfolgen; manuelle Musik/Lebensdaten benötigen keine fertige Automatik. | Jeweils sichtbarer Edit, sicherer Cancel, atomarer Commit/Restart und Fachorakel. Vollständige Lieferzuordnung bleibt [docs/ROADMAP](../../project/delivery/roadmap.md), Umfang [SCOPE](../../project/requirements/scope.md). |
| **Efficient** | Duplizieren/repetitive Platzierung/schnelle Auswahl, danach Batch/Prefabs/geschützte Regeneration. Lokale Records/Chunks und Queries nach Messung verbessern. | Dieselbe Aufgabe mit weniger Aktionen, Suche, Fehlern oder Wartezeit; Fachwirkung, Abbruch und Datenintegrität erhalten. |
| **Beautiful / Gesamtqualifikation** | Kartenstile, Texturen, Beschriftung, Ausgabe und Rückmeldung verfeinern. Vollständige Original-/OS-/Installations-/Recovery-/A11y-/Lastabnahmen am Zielbuild. | Kein Ersatz für frühe Keyboard-/200%-/Lesbarkeits-/Sicherheitsanforderungen. Cutover erst bei belegten nötigen Nutzerabläufen/Datenbindungen. |

**Prüfung je Lieferung:** passende Verhalten-/Faulttests, Typecheck/Build und
Repositoryprüfung; tatsächlicher Zielhost/Store und frischer Prozess am
betroffenen Nutzerweg. Historische Obsidian-/Originalbelege bleiben datiert,
keine synthetische Übertragung ihres PASS auf den Neuaufbau. Physischer Input,
Stromverlust, OSinstallation und Fachgesamtumfang haben eigene Nachweise.

**Legacy-Speicherintegration:** Die eigenständige Consumer-Matrix prüft 18 Modellfälle;
[direkter Aufruf](../../../README.md#lokal-entwickeln). Auf `f23912ff` bestanden 17:
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

**Planungsstand: 11.10.2026.** Die folgenden Abläufe beschreiben das vereinbarte Zielverhalten, keine bereits vollständige Implementierung. Das Leitbeispiel zeigt auch spätere Erweiterungen wie alle Hexstufen, gemeinsame Wandumfänge und Neuerzeugung; die einzelnen Work-Abschlüsse verlangen diese noch nicht. Der [aktuelle Stand](atlas.md#atlas-auf-einen-blick) bleibt davon getrennt. Leitbeispiel ist eine Region mit dem Dorf **Eichenfurt**, der Taverne **Zum Silbernen Ast** und dem Ruinendungeon **Alte Wacht**. Das Beispiel macht die Bedienung prüfbar; der vollständige Fachumfang der HEX-/CITY-Phasen und [Dungeonanforderungen](../../project/requirements/scope.md) bleibt erhalten.

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

Ich benenne beziehungsweise nummeriere Räume, schreibe Vorlesetext und GM-Notizen getrennt und ergänze Geheimdurchgang, Falle, Schatz oder einen Encounterverweis. Die Raumliste führt über Suche und Nummer zum gleichen Raum; die [Key- und Inhaltsaktionen](atlas-2.md#aktionen-am-ausgewählten-objekt) erweitern diesen einfachen Einstieg später um Beschreibungsblöcke und strukturierte Features. Aus einer Notiz springe ich über einen Raumlink zur passenden Geometrie und zum Key. Später verschiebe, teile oder vereinige ich Räume.

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

Die [Lieferstufen Work → Efficient → Beautiful](atlas.md#wie-kommen-wir-zum-ziel) bestimmen die Umsetzung des Leitbeispiels. Die Erzählfolge ist der Nutzerweg, keine zusätzliche Lieferliste. Für Gebäude werden gemeinsames Objekt, Befehle und Übernahme vorhandener Daten vor Produktänderungen im [bestehenden technischen Stadtplan](../../city/contract/city.md) konkretisiert; Kennungen, Texte, Maße und Links bleiben erhalten.

Die spätere Produktabnahme spielt das Beispiel im tatsächlichen Zielhost mit isolierten Testdaten durch: Vorschauabbruch ohne Restdaten, Wandumfang gegenüber Gesamtskalierung, geschützte Regeneration, Raumteilung/-vereinigung ohne Textverlust, gemischte Undo/Redo-Folge, vollständiger Neustart, sichtbare Speicherfehler/externe Konflikte, Suche, stabile Links und Ausgabe. Bestehende Teilbelege bestätigen nur ihren bisherigen Umfang. Die Planungsänderung vergibt keinen PASS.


Weitere Fachabschnitte: [Teil 2](atlas-2.md) · [Teil 3](atlas-3.md)
