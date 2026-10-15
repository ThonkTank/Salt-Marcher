# Dungeon-Editor und gemeinsame Kampagnenwerkstatt

Ein lokaler Arbeitsraum für Spielleitungen: Karten und Raum-Keys bearbeiten, Kampagnen vorbereiten und zusammenhängend live spielen. Das Repository enthält die bestehende Obsidian-Integration und einen eigenständigen Desktopkandidaten. Die endgültige Plattformentscheidung bleibt offen.

**Entwicklungsstand:** Dungeon-, Atlas-, Stadt- und Kampagnenfunktionen sind in unterschiedlicher Tiefe umgesetzt. Der dokumentierte Gesamtumfang und die plattformübergreifende Produktabnahme sind noch offen.

## Hier anfangen

- [Produktziele](docs/PRODUCT.md) und [Lieferfolge](docs/ROADMAP.md): vollständiger Funktionsumfang.
- [Atlas auf einen Blick](ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick): integrierter Atlasstand und offene Lücken.
- [Dokumentationsindex](docs/INDEX.md): Fachanforderungen und Nachweise.
- [Architektur](ARCHITECTURE.md): aktuelle Grenzen und offene Plattformentscheidung.

## Lokal entwickeln

Node.js 22 und npm verwenden; diese Version entspricht der PR-CI.

```bash
git clone https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1.git
cd Obsidian-Dungeon-Editor-Phase1
git switch active/installed-phase1
npm ci
npm run check:repo
npm run check
npm run check:desktop
npm test
npm run build
npm run build:desktop
```

`npm run build` erzeugt das Obsidian-Plugin in `main.js`; `npm run build:desktop` erzeugt den Desktopbuild unter `.build/desktop`.

### Obsidian-Testlauf

Nur einen separaten Testvault verwenden. `main.js`, `manifest.json` und `styles.css` nach `.obsidian/plugins/dungeon-editor/` kopieren, das Plugin aktivieren und in der Befehlspalette „Dungeon“ oder „Atlas“ öffnen. Obsidian Desktop benötigt mindestens Version 1.8.7 und WebGL. Build und Push installieren nichts in einem Vault.

### Desktop-Testlauf

```bash
npm run start:desktop -- --data-dir /tmp/campaign-workbench-smoke
```

Der Desktopkandidat speichert ohne `--data-dir` im lokalen Appdatenordner `CampaignWorkbench`. Er verbindet Kampagnenverwaltung, Vorbereitung, Live-Spiel, Katalog, Gegenstände, Welt/Atlas, Städte, Musik, Dungeonzeichnung und eine getrennte Spieleranzeige. Die Desktopfunktion ist ein Entwicklungsstand; offene Produktlücken und Abnahmen stehen in den Fachplänen.

Quests und Gerüchte können Mitwirkende, Ort, Status, XP und mehrere Gegenstandsbelohnungen tragen. Ihr manueller Abschluss verwendet denselben Verteilungsablauf wie Encounter. Das persönliche Beutebuch kann Mengenstapel teilen, zusammenführen und ausdrücklich an andere Figuren weitergeben.

Ein lokales Linux-x64-Paket entsteht mit:

```bash
npm run package:desktop -- /tmp/campaign-workbench-linux-x64
```

## Repositorykarte

- `src/`: gemeinsamer Produktcode, Obsidian-Anschluss und Desktopoberfläche unter `src/app/`.
- `desktop/`: privilegierter Desktopprozess und schmale Preload-Brücken.
- `tests/`: automatisierte Prüfungen und synthetische Fixtures.
- `tools/`: Build-, Paket-, Referenz-, Fixture- und Hostwerkzeuge.
- `docs/` und `ROADMAP-*.md`: Produktziele, Fachanforderungen und direkte Nachweise.
- `ARCHITECTURE.md`: Architekturentscheidungen; `acceptance.json`: Anforderungen und Abnahmen.

Historische Laufstände und Einzelpläne bleiben im Git-Verlauf zugänglich. Quellen- und Datenattribution: [NOTICE.md](NOTICE.md), [SRD 5.1](src/features/catalog/SRD-5.1-ATTRIBUTION.md) und [Itemquellen](src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md).

### Desktopstand 0.18: Dungeon leiten

Der Arbeitsbereich „Dungeon leiten“ verbindet die bestehende Zeichnung mit der fokussierten Gruppe: metrische Raum-/Geschossposition, Wegvorschau über offene Türen und Treppen, bestätigte Route, abschnittsweise Bewegung mit Szenenzeit, Pause und GM-Freigabe vor geladenen Fallen. Tempo, Zeitfaktor und Gesamtdauer sind editierbar. Geometrieänderungen erfordern eine neue Route. Ortsgebundene Zeichnungen setzen den vorhandenen Szenenort mit.

Das separate Spielerfenster zeigt aktuelle Sichtflächen und je Charakter erinnerte Geometrie des aktuellen Geschosses. Dungeon-Automatik beginnt in Dunkelheit; Lichtquellen, Sichtweite und Dunkelsicht bestimmen die Wahrnehmung. GM-Texte und geheime Räume gelangen nicht in diese Projektion; Räume können ausdrücklich freigegeben werden. NPCs besitzen eine Raumposition unter ihrer bestehenden World-Ortsposition. Reset-Jobs verwenden den Fallen-Owner im selben Raum und halten bei einer dort anwesenden Gruppe zur GM-Entscheidung an.

Kurzer nativer Kerncheck: Tür-/Treppenroute, Fallenhalt und Freigabe, 30 Sekunden bestätigte Zeit, gefilterte Spielerprojektion, lokaler NPC-Reset, Wiederöffnen und normaler Prozessabschluss. Keine umfassende Qualifikation. Datenbankformat 24; ältere Transferpakete benötigen weiterhin einen Formatadapter. NPC-Reise durch Dungeonräume, vollständige 3D-/Asset-Parität und Dungeon-Interaktionsdetails bleiben weitere Produktarbeit.

### Desktopstand 0.19: NPC-Raumjobs und bestätigte Wege

NPC-Jobs können einen Dungeonraum statt nur einen groben Kampagnenort referenzieren. Der Actor läuft über die vorhandenen begehbaren Konturen, offenen Türen und Treppen zum Job, in editierbarem metrischem Tempo. Patrouillen wechseln zwischen zwei Raumzielen; Reset-Jobs erreichen den tatsächlichen Fallenraum. Teilweise bestätigte Zeit bewegt einen NPC nur entsprechend weit. Restweg, Fortschritt und räumliche Position bleiben gespeichert; GM-Zuweisung und Abbruch werden protokolliert.

Bestätigte Zeiträume referenzieren gemeinsam gespeicherte Geometriestände. Änderungen am Dungeon unterbrechen betroffene ausstehende Wege zur GM-Klärung. NPC-Sichtweite und Dunkelsicht sind konfigurierbar. Geladene Fallen und Party-Kontakt stoppen vor weiterer Bewegung oder Wirkung. Im Bereich „Dungeon leiten“ werden NPC-Ziele, nächste Wegpunkte, Pausen und bestätigte Bewegungsspuren sichtbar. Exklusive Jobs buchen ihren referenzierten Raum, Ort oder Feature auch gegenüber anderen Angeboten auf dasselbe Ziel. Benutzerdefinierte Bedürfnisse erhalten im Jobeditor eigene Befriedigungswerte.

Kurzer nativer Kerncheck: Teilbewegung nach fünf Sekunden, Tür-/Treppenweg mit Reset im Obergeschoss, Raumjob im Editor anlegen, Pause vor Party-Kontakt am Portal, gespeicherte Spuren, Wiederöffnen und normaler Prozessabschluss. Schwere Jobs liefen einzeln mit Speichergrenzen. Datenbankformat 25. Akustische Wahrnehmung, autonome Gruppenbildung, weiterführende Konflikt-/Inventarfolgen und umfassende Qualifikation bleiben offen.

### Desktopstand 0.20: Wahrnehmung, Geräusche, Spuren und lokale Begegnungen

„Dungeon leiten“ enthält passive Wahrnehmung, ein persistentes aktives Ergebnis, explizite Bekannt-/Unbekannt-Overrides und deren Aufhebung. NPC-Heimlichkeits-SG, Sichtweite, Dunkelsicht, Hörweite und passive Wahrnehmung sind editierbar. Die neue gerichtete Kenntnis verbindet die vorhandenen Sichtflächen mit lokalen NPCs. Neue Party-Sichtungen halten weitere Reise und beteiligte Autonomie zur GM-Klärung an.

Bestätigte Bewegung erzeugt Spuren und kurzlebige Schrittgeräusche; ein Element kann eine dauerhafte Geräuschquelle mit Spielertext, Reichweite und SG anbieten. Schall verwendet die begehbare Geometrie mit einer eigenen Interpretation der Schallblockaden: eine geschlossene schalldurchlässige Tür kann hörbar bleiben. NPCs erkennen auch hörbare Party-Bewegung. Der GM kann zusätzliche Geräusche am ausgewählten Ziel bestätigen. Das Spielerfenster erhält freigegebene NPC-Marker, hörbare öffentliche Hinweise und ausdrücklich entdeckte Spuren; GM-Texte und unbekannte Actor-Identitäten bleiben außerhalb der Projektion.

Spuren besitzen Erzeugungszeit, Bewegungs-/Oberflächenprofil, Stärke und SG. Der aktuelle erste Stein-/Gehprofilstand erhöht den Such-SG je Stunde und lässt Spuren nach 24 bestätigten Stunden verfallen. Ein GM-bestätigter Suchvorgang speichert Kenntnis je Party-Mitglied; SG, Unterdrückung und Spielertext sind korrigierbar. Vorhandene NPC-Spuren aus Format 25 werden mit denselben IDs in das gemeinsame Bewegungsformat übernommen. Die Originalzeilen bleiben erhalten.

Lokale vorbereitete NPC-Gruppen bieten eine ausdrückliche Begegnungsaktion an. Sie verwendet die bestehenden World-Actor-IDs, aktuellen Trefferpunkte und Kreaturquellen und übernimmt nur nahe lebende Mitglieder auf demselben Geschoss. Eine verteilte Gruppe bleibt dieselbe Gruppe; entfernte Mitglieder werden nicht in den Kampf kopiert. Vorbereitung erzeugt keine laufende Initiative.

Kurzer nativer Kerncheck: Geräusch hinter geschlossener schalldurchlässiger Tür, aktives Ergebnis gegen NPC-SG, fortbestehender Unbekannt-Override, Spurenentdeckung und gefilterte Spieleranzeige, bestätigte Begegnung mit vorhandener Identität und HP sowie Ausschluss eines entfernten Actors, Wiederöffnen und normaler Abschluss. Datenbankformat 26. Segmentweise Spurverfolgung, weitere Oberflächen-/Bewegungsprofile, vollständige 3D-Sinne und umfassende Qualifikation bleiben offen.

### Desktopstand 0.21: Spurenprofile und abschnittsweise Verfolgung

Die Gruppe kann eine gewählte Fährte vorwärts oder rückwärts verfolgen. Ein bestätigtes Wahrnehmungs- oder Überlebensergebnis autorisiert das aktuelle Segment; Bewegung, Szenenzeit und Positionsrevisionen bleiben im vorhandenen Dungeon-Reiseowner. Ein eindeutiger Anschluss setzt die nächste gespeicherte Spur fort. Kreuzende Spuren verlangen eine ausdrückliche Wahl, schwache Spuren ein ausreichendes neues Ergebnis; Lücken und Fährtenverlust halten die Verfolgung an. Aktueller Abschnitt, besuchte Spuren, Prüfergebnis, offene Kandidaten und Entscheidung bleiben gespeichert.

Der GM kann eine manuelle Spur zwischen ausgewähltem Anfang und Ziel ergänzen, mit unbekannter Quelle oder Referenz auf einen vorhandenen NPC. Bestehende Spuren bleiben korrigierbar und unterdrückbar. Profile pro Gruppe oder NPC steuern Geh-/Schleich-/Lauf-/Kriech-/Schwimm-/Flugspuren, Oberfläche, Umwelteinfluss, Anfangsstärke und Overrides für SG, Lebensdauer und Stärkeverlust. Fliegen erzeugt im ersten Profil keine Bodenfährte; Geräusche bleiben getrennt. Räume können eine Spurenoberfläche tragen, Terrainflächen eine entsprechende Variante. Entdeckung und Spurfolgen speichern Kenntnis je Mitglied der tatsächlich beteiligten Gruppe. NPC-Zeiträume behalten das bei Bestätigung gültige Spurenprofil.

NPC-Geräuschwahrnehmung verwendet beim Nachholen nun den jeweiligen simulierten Abschnittszeitpunkt statt pauschal das Ende des gesamten bestätigten Zeitraums. Eine Namenskollision zwischen Shop-Handelsfunktion und Darstellungscontainer wurde im parallel geänderten Gegenstandseditor behoben.

Kurzer nativer Kerncheck: manuelle verbundene Fährte, Bewegungs-/Oberflächen-/Umwelt-Overrides, unterdrückte eigene Gruppenspuren, unbekannte Quelle, bestätigte Segmentpositionen und Zeit, eindeutige Fortsetzung, Abzweigung, schwache Spur mit neuem Überlebensergebnis, Fährtenverlust, Kenntnis je Mitglied, Wiederöffnen und normaler Abschluss. Datenbankformat 27. Bewegungsprofile beschreiben zunächst Spur- und Geräuscherzeugung; volle Flug-/Schwimmnavigation und 3D-Sinne bleiben weitere Produktarbeit. Umfassende Qualifikation bleibt separat.

### Desktopstand 0.22: 5-Fuß-Volumen und 3D-Laufzeitkern

Der Dialog „3D-Volumen“ ergänzt den vorhandenen Karten-/Key-Editor um einen 10-Fuß-Schnitt mit 5-Fuß-Höhenschritten, angrenzende transparente Schnitte und eine axonometrische Volumendarstellung. Raumzellen bleiben kompakte Höhenspannen statt einer dichten 3D-Matrix. Volumen können aus einer Kontur übernommen, in ihrer Höhe gesetzt und über Züge ergänzt oder entfernt werden. Böden, Decken und Wandflächen sind getrennt editierbar; PageUp/PageDown wechselt während eines Zugs den Schnitt. Neue gewöhnliche Räume erhalten Boden, 10-Fuß-Innenraum und Decke. Die Kontur ist bei vorhandenen Volumen eine abgeleitete Projektion.

Räume bleiben stabile Autorenidentitäten. Beim Volumenschnitt folgt der bestehende Room dem Ergebnis mit größter Überschneidung, weitere Komponenten erhalten leere Rooms; Keys werden nicht dupliziert. Verankerbare Elemente bleiben zugeordnet, andere bleiben ungebunden erhalten. Volumendeltas benutzen die gemeinsame Autoren-History. Rasterkonforme Verschiebung und 90-Grad-Drehung erhalten Höhenspannen und Wandflächen; die alten freieren Transformationen bleiben für Räume ohne Volumen verfügbar. Geschosskopien nehmen das zugehörige Volumen mit.

„Dungeon leiten“ bietet Gehen, Kriechen, Fliegen, Schwimmen und eine erste Navigation entlang von Wänden zum Klettern sowie eine ausdrückliche Zielhöhe. Der 3D-Kern prüft freie Körperhöhe, Standflächen, Luft/Wasser und räumliche Hindernisse. Objekt-/Wandunterkante und vertikale Ausdehnung sind im Elementeditor getrennt vom Grundriss editierbar. Licht- und Sichtlinien verwenden die gleichen Volumen, Flächen, Portalöffnungen und Höhen. Aktuelle Kenntnis bleibt je Mitglied und Höhenschnitt getrennt gespeichert; vorhandene Kenntnis an Legacy-Zeichnungsankern bleibt lesbar. Standard-Spurenprofile folgen der bestätigten Bewegungsart, ohne Flugspuren auf dem Boden zu erzeugen.

Kurzer nativer Kerncheck: 36 sparse Säulen, vorhandene Key-ID und Prosa, gemeinsame Undo/Redo-History, ein 5-Fuß-Kriechraum mit Ablehnung von Gehen, bestätigter Kriechweg, Bodenfläche aus-/einschalten, ein 10-Fuß-Hindernis blockiert den Bodenweg, Flug über das Hindernis, neue NPC-Sichtung aus der Höhe hält den Weg an, gefiltertes Spieler-DTO und Kenntnis je Höhe, Wasserraum samt Schwimmweg und Wasserspur, Wiederöffnen und normaler Abschluss. Schwere Jobs liefen einzeln in begrenzten Scopes. Konkrete Typgrenzen in der parallel bearbeiteten HP-Oberfläche wurden korrigiert.

Datenbankformat 28. Der erste Laufzeitkern benutzt feste Körperhöhen. Parametrische 3D-Verbindungs-Paths, vollständige Raum-/Volume-Reassoziation bei komplexen Umbauten und überlappenden Legacy-Ebenen, komplette Bewegungs-/Sense-/Coverprofile und umfassende Qualifikation bleiben offen. Die alte 2D-Kontur wird bei bestehenden Räumen erst nach ausdrücklicher Volumenübernahme rasterisiert; Original-Importbytes bleiben unverändert.

### Desktopstand 0.23: parametrische 3D-Verbindungen und funktionale Passagen

„3D-Verbindungen / Passagen“ verbindet zwei vorhandene Volumen mit Korridoren, Treppen, Rampen, Leitern oder Schächten. Wegpunkte, Querschnitt, Medium und Zeitfaktoren sind je Abschnitt einstellbar. Endpunktanker können automatisch vorgeschlagen oder relativ zur Volumenecke auf einer Grenzfläche gepinnt werden. Erst die bestätigte Vorschau erzeugt einen gewöhnlichen Raum mit Volumen und zwei stabilen Passagen; vorhandene Raumkeys bleiben erhalten. Bei geänderter Umgebung erscheint der Pfad als veraltet, bis eine neue Vorschau ausdrücklich übernommen wird. Die Umwandlung in eine feste Area erhält die Geometrie.

Passagen besitzen getrennte Beschreibungen, Begehbarkeit, Sicht-, Licht- und Schalldurchlass sowie Zusatzzeit je Richtung. Sie lassen sich auch eigenständig an einem Volumenanker anlegen. Ziele werden über Räume, andere Passagen oder Kampagnenorte ausgewählt; fehlende Ziele bleiben sichtbar. Das Entfernen der geometrischen Zuordnung erhält Beschreibung und Identität. Verknüpfte Passagen und Ortslinks werden vom GM ausdrücklich benutzt und schreiben Position und Zusatzzeit über die vorhandenen Szenenoperationen.

Kurzer nativer Kerncheck: Vorschau ohne Speicherung, Übernahme des Treppenvolumens, Gruppenweg ins obere Geschoss mit sieben Sekunden gerichteter Zusatzzeit, Erhalt des bestehenden Raumkeys, veraltete Verbindung nach Endraumverschiebung, bestätigte Neuberechnung mit denselben Passagen-IDs und Beschreibungen, Umwandlung mit unveränderter Geometrie und Wiederöffnen. Schwere Jobs liefen einzeln mit begrenztem Speicher. Datenbankformat 29. Komplexe Raum-/Volumenumbauten, vollständige Bewegungs-/Sense-/Coverprofile und der weitere dokumentierte Gesamtumfang bleiben in Arbeit.

### Desktopstand 0.24: Dungeon-Key, Vererbung, verknüpfte Vorlagen und Vorlesetext

„Dungeon-Key / Vorlagen“ ergänzt eine geräumige Textfläche mit Volltextsuche, Level-/Gruppen-/Geheim-/Feature-/Statusfiltern, stabilen Anzeigezahlen und Kampagnenreferenzen. Vorhandene Markdown-Abschnitte und deren IDs bleiben erhalten. Mehrere Räume können unmittelbar in einer gemeinsamen Autoren-History-Aktion bearbeitet werden: ersetzen, voranstellen, anhängen, suchen/ersetzen, Eigenschaften ergänzen, Level/Gruppe zuordnen, Tags/Status/Geheim setzen, Referenzen oder Beschreibungsblöcke kopieren und Anzeigezahlen fortlaufend vergeben. Erhaltene Räume ohne sichtbare Geometrie bleiben im Key erreichbar.

Freie Beschreibungsattribute erben entlang Dungeon → optionales konzeptuelles Level → optionale Gruppe → Raum. Level sind eigene Mengen absoluter 5-Fuß-Höhenschritte im gleichen 3D-Dungeon; sie zerlegen keine Volumen. Level dürfen keine Höhenschritte teilen, Gruppen werden nicht verschachtelt. Lokale Werte ersetzen denselben Schlüssel; !Name unterdrückt ihn und das Entfernen der lokalen Zeile stellt die Vererbung wieder her. Effektive Werte zeigen ihren Ursprung. Diese Beschreibung erzeugt keine Spielregeln.

Die geordnete Beschreibung verbindet eigene Prosa, bestehende Markdown-Keys, aktuelle Geometriefakten, effektive Eigenschaften und Ausgänge. Blöcke können bewegt, unterdrückt, privat oder bis zur Entdeckung verborgen werden. Die Vorschau unterstützt stabile Kartenrichtungen oder eine gewählte Blickrichtung. Reine Textvorlagen bleiben verknüpft, aktualisieren ihre Instanzen beim Rendern und lassen sich mit erhaltenem Text lösen; Geometrie und Objektidentität werden nicht in Vorlagen kopiert.

„Dungeon leiten“ zeigt den aktuellen Vorlesetext samt getrenntem GM-Kontext. Private Suchmethode, DC und Entdeckungsnotizen bleiben beim GM. Nur ausdrückliches Sichtbar-/Verbergen für die Gruppe ändert die pro Charakter gespeicherte Entdeckung. Das Spielerfenster erhält ausschließlich gerenderte öffentliche Texte und bestätigte verborgene Texte. Karte + Key sind zusätzlich als druckbares HTML-Dokument mit mehreren Kartenebenen und stabilen Raumlinks ausgebbar. Öffentliche Fassungen lassen GM-Blöcke und unentdeckte Inhalte aus.

Kurzer nativer Kerncheck: Raumtexte bearbeiten, Dungeonattribute erben, mehrere Räume gemeinsam ändern, eine verknüpfte Vorlage aktualisieren, öffentliche Beschreibung ohne GM-Notizen, explizite Freigabe eines verborgenen Texts, Erhalt ursprünglicher Markdown-IDs und Texte, Wiederöffnen und normaler Abschluss. Datenbankformat 30. Graph-Entwurf, beschriebene Oberflächenregionen, vollständige Geometrie-/Inhaltsreassoziation sowie weitere dokumentierte Produktfunktionen bleiben in Arbeit. Umfangreiche Qualifikation bleibt getrennt.

### Desktopstand 0.25: bearbeitbarer Dungeon-Graph mit geschützter Rasterübersetzung

„Dungeon-Graph“ zeigt Räume, authored Öffnungen, 3D-Paths, Übergänge und externe Passagenlinks als bearbeitbares Netz. Bloße geometrische Nachbarschaft erzeugt keine Kante. Blockierte, gerichtete, geheime und provisorische Verbindungen behalten unterschiedliche Zustände. Knoten auswählen, eine Anordnung ziehen, Raumgrößen grob vorgeben, Räume oder Gruppen als Einheit verschieben, unabhängig kopieren, von der Geometrie lösen und konkrete oder gruppenbezogene Verbindungen planen sind angeschlossen. Raum- und Gruppenaktionen benutzen dieselben Identitäten wie Atlas und Key. Enthaltene interne Paths und ihre Passagen werden bei vollständiger Anordnungskopie mit unabhängigen IDs mitgenommen.

Erst eine Graphänderung legt eine separate SQLite-Arbeitskopie der Dungeon-Autorenstände an; bloßes Öffnen tut das nicht. Die Kampagnenquelle und ihre normale History werden bis zur ausdrücklichen Übernahme nicht verändert. Die Arbeitskopie nutzt 8 MiB SQLite-Cache und ist auf 64 MiB Autorenpayload begrenzt. „Zur Rastervorschau“ öffnet den provisorischen Stand im normalen Karten-/Volumeneditor. Die vorhandenen Raster-, Key-, Path- und Autoren-History-Operationen bearbeiten dann die Arbeitskopie. „Ursprung vollständig wiederherstellen“ verwirft die vollständige Vorschau unabhängig vom Undo-Verlauf. Erst die Übernahme nach Rückkehr zum Raster kopiert das kombinierte Ergebnis als eine gemeinsame Autoren-History-Aktion in die Kampagne. Ein geänderter Quellenstand verwirft den Entwurf nicht stillschweigend. Dungeon-Reise und tatsächliche Trapaktivierung bleiben während der offenen Geometrievorschau gesperrt. Das passive Spielerfenster benutzt den bestätigten Stand.

Eine Gruppenverbindung mit mehreren möglichen Endräumen bleibt als Planungsabsicht erhalten, bis der GM konkrete Endpunkte auswählt. Fehlgeschlagene Pfadübersetzungen bleiben mit Ursache und Reparaturauswahl sichtbar. Bewegte Endräume werden in der Vorschau erneut verbunden; gepinnte Anker und bereits beschriebene Passagen behalten ihre Identitäten und Prosa.

Die Detailstufen zeigen einzelne Räume/Verbindungen, zusammengefasste unverzweigte Wege, Raumgruppen und eine Reduktion auf Navigationsentscheidungen. Verbindungstypen, Levelübergänge, ungewöhnliche oder geheime Wege und tatsächliche Verzweigungen bleiben relevant. Gruppen fassen interne Inhalte und Wegzeiten zusammen und zeigen interne Verbindungen, Verzweigungen und Schleifen; die übergeordnete Schleifenzahl wird aus dem vollständigen Netz abgeleitet. Kurze, inhaltslose Korridorsackgassen können in der stärksten Reduktion in ihren Nachbarknoten aufgehen, ohne Autoreninhalte zu löschen.

Heatmap-Layer zählen ausdrücklich platzierte Trap-, Encounter-, Loot-, Curiosity-, Puzzle- und Secret-Inhalte. Ein einzelner Layer nutzt eine Intensitätsskala, mehrere behalten getrennte Symbole und Werte. Anzahl und Konzentration relativ zu angrenzenden Wegzeiten sind umschaltbar; Prosa wird nicht qualitativ bewertet. XP-/Gold-/Magie-Budgetdiagnostik und explizite Sessionanteile sind noch nicht angeschlossen.

Kurzer nativer Kerncheck: provisorischen Raum erzeugen, mit normalem Volumenwerkzeug bearbeiten, unveränderte Kampagnenquelle/History, vollständige Wiederherstellung, zwei neue Räume mit materialisierter Graphroute, kombinierte Übernahme als genau eine Autorenaktion, gemeinsames Undo/Redo, unveränderte ursprüngliche Raum-/Key-Bytes und Wiederöffnen. Datenbankformat 31. Graphvorschauen sind absichtlich transient; angenommene Geometrie, Layouts und ungelöste Planungsabsichten sind persistiert. Weiterer dokumentierter Produktumfang und umfassende Qualifikation bleiben offen.

### Desktopstand 0.26: Dungeon-Budgets und referenzierte Inhalte auf Voxelankern

Der Dungeon-Graph bietet Budgetplanung für den vollständigen Dungeon, konzeptuelle Level und Raumgruppen. Ziellevel, Partygröße und Adventure-Day-Anteil erben; Spielabendanteile werden ausdrücklich zugeteilt. Unterbereichsbudgets und aktuelle Inhalte rollen ohne Doppelzählung hoch. Nicht zugeteilte Anteile und Überzuteilung bleiben sichtbar. Bereiche ohne eigene Zuteilung zeigen neutrale Inhalts-/Dichtestatistik; ihre unzugeteilten Inhalte erhalten keine künstliche XP-Unterfüllungswarnung. Hinweise sind erklärbar, ausblendbar und verändern keine Inhalte oder Regeln.

Gefahr-XP verwenden die bestehenden DMG-2014-Tageswerte und Encounter-Assessment-Multiplikatoren. Basis-XP für den geplanten Beute-Fortschritt bleiben getrennt einstellbar. Gold-Soll und Magie-Erwartungswerte verwenden die kumulative Fortschrittskurve des wirksamen Generator-Presets mit dessen sichtbarer Revision; die rationale Arithmetik und Interpolation stammen aus dem bestehenden SaltMarcher-Rewardmodell. Die Diagnose erzeugt keine Beute und führt keine Zufallsrundung aus. Nichtmagische Werte und bekannte Magie-Seltenheiten werden aus den vorhandenen Treasure-/Definitionsreferenzen ausgewertet. Unbekannte XP, Werte und Seltenheiten bleiben als unvollständige Teile sichtbar.

„Dungeon-Inhalte / Voxelanker“ platziert Encounter, Loot, Traps und Curiosities in einer genauen relativen 5-Fuß-Zelle eines vorhandenen Volumens. Encounter-Komposition und Loot verwenden die vorhandenen kanonischen Objekte; Statblocks, Geld und Gegenstände werden nicht in Features kopiert. Eine konkrete Encounter-/Loot-ID besitzt höchstens eine aktuelle Dungeonplatzierung. Entfernte Platzierung erhält Identität und Text. Raum-/Volumenverschiebungen tragen den relativen Anker mit; nach Volumenschnitten wird die ursprüngliche erhaltene Zelle neu zugeordnet, unklare oder entfernte Geometrie lässt den Inhalt ungebunden erhalten.

Curiosities bieten freie Vorlese-/öffentliche Texte, private Bedienungs-/Lösungsnotizen, Kategorien und Tags. Puzzle ist eine Curiosity-Klassifikation; die bisherige Puzzle-Auszeichnung bleibt lesbar. Keine Beschreibung programmiert Lösungsfolgen oder Effekte. Trap-XP sind ein ausdrücklich eingegebener GM-Ansatz. Die Inhaltsansicht kann die verknüpften Originale lesen. Kopierte Platzierungen behalten den Quellenbezug und verlangen für eine weitere physische Encounter-/Loot-Zuordnung eine unabhängige Inhaltsidentität.

Budget- und Inhaltsänderungen aus der Graphfläche bleiben in der geschützten Rastervorschau, bis sie gemeinsam angenommen werden. Ein kurzer nativer Kerncheck hat Root-/Levelzuteilung, sichtbaren unzugeteilten Rest, Ziel-Rollup, referenzierte Encounter-XP und exakten Nichtmagie-Kupferwert, Curiosity-/Puzzle-Auszeichnung, unveränderte Kampagnenquelle vor Annahme, Verweigerung einer doppelten physischen Referenz, mitgeführten Voxelanker, ursprüngliche Raumkey-IDs/-Prosa und Wiederöffnen bestätigt. Datenbankformat 32. Schwere Prozesse liefen einzeln mit begrenztem Speicher.

Die vollständige Laufzeitintegration aller neuen Inhaltsarten, beliebige mehrteilige Trap-Triggerfelder, weiterführende Raum-/Surface-Reassoziation und der weitere dokumentierte Gesamtumfang bleiben in Arbeit; umfassende Qualifikation ist getrennt.

### Desktopstand 0.27: mehrteilige Trap-Triggerfelder und bestätigte Aktivierung

„Fallen / Triggerfelder“ ergänzt frei markierte 5-Fuß-Voxelsets, getrennt vom exakten Fallenanker. Ein Feld kann Zellen mehrerer Volumen und Höhenschnitte enthalten. Rund-/Quadratpinsel, Radierer, Rechteckauswahl und 3D-Bereich übernehmen ihre Vorschau als eine Autorenaktion. Namen, Interrupt-/Notify-Modus und Deaktivierung gehören zum Feld. Ohne aktives Triggerfeld bleibt eine Falle manuell; der ältere Radius wird nicht mehr als automatisches Feld interpretiert. Felder verändern weder Begehbarkeit noch einen fiktionalen Ausgang.

Felder folgen ihren Volumen bei rasterkonformen Transformationen. Nach Schnitten werden erhaltene Zellen auf die resultierenden Volumen verteilt; nicht zuverlässig zuordenbare Zellen bleiben mit ihren letzten Weltzellen als ungebundene Fragmente erhalten und können ausdrücklich entfernt oder neu markiert werden. Vollständige Anordnungskopien nehmen zugehörige Felder mit unabhängigen IDs und remappten Volumenbezügen mit. Autoren-History, geschützte Graphvorschau und Kampagnentransfer verwenden dieselben Feldidentitäten.

Dungeon-Reisevorschauen teilen freie Segmente an Feld-Eintritten auf. Raumposition und zugehörige Zeitwirkung werden bis zum Eintritt bestätigt; vor weiterer Bewegung hält ein Interrupt-Feld die Reise an. Notify-Felder legen nur einen GM-Kontext an. Zusammenhängende Zellen und gleichzeitig betretene Felder derselben Falle erzeugen einen zusammengefassten Kontext; erneuter Eintritt erzeugt einen neuen. Physische Körperhöhe und Bewegungsart fließen in den Eintritt ein. Feldboxen und Spaltenindizes werden pro Geometriestand wiederverwendet, statt eine dichte 3D-Matrix aufzubauen.

Die GM-Kontexte zeigen Beschreibung, private Bedienungs-/Lösungsnotizen und bestätigte Systemfakten. Tatsächliche Aktivierung, Dismiss/Fortsetzen, Abbruch und erneutes Öffnen sind getrennt. Bloßes Betreten verbraucht keine Charge. Pro konkretem Eintrittskontext ist bestätigte Aktivierung idempotent; erneutes Öffnen verbucht denselben Verbrauch nicht nochmals. Die bestehenden Charge-/Reset-Owner behalten Maximum, aktuellen Stand, beide Countdown-Startpolitiken, keinen Neustart bei weiterem Verbrauch, gemeinsames Vollaufladen, manuelle Korrektur und den ausdrücklich beauftragten Autonomy-Reset. Die Feldansicht bietet diese Einstellungen und aktuelle Laufzustände direkt an. Kontexte, Positionen, Zeiten, Charges und Countdown bleiben nach Reopen erhalten.

Kurzer nativer Kerncheck: Falle ohne Feld bleibt manuell, ein vierzelliges Feld wird über zwei Volumen im Editor angelegt, sein Anker liegt außerhalb des Felds, Eintritt und Teilzeit werden vor dem Halt bestätigt, Eintritt verbraucht nichts, bestätigte Aktivierung verbraucht genau eine Charge, wiederholter Confirm bleibt idempotent, zusammenhängende Zellen wiederholen den Kontext nicht, erneuter Eintritt erzeugt einen neuen, weiterer Verbrauch erhält den laufenden Countdown, bestätigte Zeit lädt alle Charges zusammen auf und ein neuer Prozess erhält Felder und Kontexte. Ein konkreter Wiederholungsfehler beim Zellwechsel wurde korrigiert. Schwere Prozesse liefen einzeln mit Speicherlimit. Datenbankformat 33.

Vollständige Runtimeintegration weiterer Encounter-/Loot-/Curiosity-Kontexte, zusätzliche beschriebene Oberflächenregionen und weitere dokumentierte Produktfunktionen bleiben in Arbeit. Die genannten Kernchecks ersetzen keine umfassende Qualifikation.

### Desktopstand 0.28: räumliche Encounter-, Loot- und Curiosity-Kontexte

„Dungeon leiten“ zeigt platzierte Inhalte im aktuellen räumlichen Gruppenkontext. Wahrnehmung benutzt dieselbe 3D-Sicht, Licht- und Beobachterbasis wie der Dungeon. Neue wahrnehmbare Encounter oder erreichte private Such-DCs halten weitere Reiseabschnitte mit einem GM-Kontext an. Öffentliche Inhalte werden erinnert; verborgene Inhalte werden erst durch ausdrückliche GM-Freigabe bekannt. Die Autorenansicht ergänzt freie Suchmethode, optionalen DC, private Entdeckungshinweise und den bestätigten öffentlichen Text. Beschreibungen führen keine fiktionalen Effekte aus.

Encounter können eine Vorlage oder eine bereits vorhandene NPC-Gruppe referenzieren. Die einmalige Bindung materialisiert Vorlagen über den bestehenden Gruppenowner und setzt die tatsächlichen Actors an den Voxelanker. Weitere Aufrufe verwenden dieselbe Gruppe; gebundene Kontexte folgen aktuellen NPC-Positionen und berücksichtigen deren aktuelle Lebenspunkte. Kampfstart benutzt diese Actor-Identitäten und die aktuelle Party; erneuter Aufruf öffnet denselben laufenden Kampf. Die Inhaltsansicht bietet einen direkten Wechsel zur Kampfführung.

Loot zeigt den aktuellen Bestand der referenzierten Beute. Nach Entdeckung übergibt der GM eine Menge an ein Mitglied der laufenden Gruppe. Der vorhandene Beuteowner verbucht Bestand und Ledger; die Platzierung erzeugt keine zweite Beute. Entdeckung, Gruppenbindung, Kampfbezug und Bestand bleiben nach Neustart erhalten. Das Spielerbild erhält die bestätigten öffentlichen Texte, keine Such-DCs oder privaten Lösungsnotizen.

Kurzer nativer Kerncheck: privater Suchhinweis ohne automatische Entdeckung, ausdrückliche Freigabe im Dungeon-Tab, gefiltertes Spielerbild, einmalige Bindung von zwei Goblin-Actors, Kampf mit denselben Actor-IDs, wiederholter Start ohne Kopien, Übergabe von fünf vorhandenen Münzen an den Ledger und Wiederöffnen. Der Prozess endete regulär; Build und App liefen einzeln mit Speicherlimit. Datenbankformat 34. Weitere dokumentierte Produktfunktionen, insbesondere zusätzliche beschriebene Oberflächenregionen und erweiterte Atlasabläufe, bleiben in Arbeit; umfassende Qualifikation erfolgt getrennt.

### Desktopstand 0.29: beschriebene Wand-, Boden- und Deckenregionen

Der Dungeon-Key kann ausdrücklich beschriebene Oberflächenbereiche anlegen. Im 5-Fuß-Raster werden Wand-, Boden- oder Deckenflächen in einem Höhenschnitt markiert; zusammenhängende Flächen lassen sich als Ganzes übernehmen, einzelne Flächen per Ziehen hinzufügen oder entfernen. Nur beschriebene Regionen erhalten eigene Inhaltsidentitäten. Ein Bereich erbt Dungeon-, Level-, Gruppen- und Raumattribute und ergänzt eigene Werte, Prosa, private Notizen, Vorlagen und Entdeckungsblöcke. Beschreibungen verändern keine Begehbarkeit oder Regeln.

Flächen folgen Volumenverschiebungen und 90-Grad-Drehungen. Bei Schnitten werden erhaltene Flächen wieder zugeordnet; entfernte oder mehrdeutige Flächen bleiben mit ihrer letzten Weltlage als ungebundene Fragmente erhalten. Eine neue Zuordnung ist im Editor möglich. Region-ID und Prosa bleiben bestehen, ursprüngliche Raumtexte werden nicht dupliziert. Anordnungskopien und Geschosskopien erzeugen unabhängige Flächeninhalte; Autoren-History, geschützte Graphvorschau und Kampagnentransfer verwenden den vorhandenen Key-Owner.

Dungeon-Leiten und Karten-/Key-Ausgaben ergänzen die zugeordneten Flächenbeschreibungen. Das Spielerfenster berücksichtigt die tatsächliche Sicht der aktiven Beobachter und erhält ausschließlich öffentliche oder ausdrücklich entdeckte Texte. Vorlagen und unterdrückte Attributwerte benutzen dieselbe Darstellung wie Raumkeys.

Kurzer nativer Kerncheck: neun Bodenflächen im Key-Editor markieren, öffentliche und private Prosa bearbeiten, Raumwert erben und Material überschreiben, Spielertext ohne GM-Notiz, Volumenverschiebung, entfernte Zelle als erhaltenes ungebundenes Fragment und Wiederöffnen. Beide Prozesse endeten regulär. Eigene schwere Jobs liefen einzeln mit MemoryMax=1G, MemorySwapMax=128M und Node-Heap 512 MiB. Die ursprüngliche temporäre Prüfdatenbank war nach der Unterbrechung nicht mehr vorhanden; dieser Lauf verwendet eine neue separate, dauerhaft abgelegte Testkampagne. Der weitere dokumentierte Produktumfang bleibt in Arbeit.

### Desktopstand 0.30: manuelle Questbelohnungen und Mengenstapel im Beutebuch

Quests und Gerüchte ergänzen ihre vorhandene Notiz um offenen/geschlossenen Status, einen optionalen zugehörigen Ort, ausdrücklich gewählte Mitwirkende und vorbereitete XP-/Gegenstandsbelohnungen. Freie Notiztexte und bestehende NPC-/Fraktionsbeziehungen behalten ihren bisherigen Owner. Neue Quests beginnen ohne automatisch ausgewählte Mitwirkende. Offene gültige narrative Eingaben werden beim Wechsel der Arbeitsfläche gespeichert.

Der manuelle Abschluss verwendet denselben Verteilungsdialog wie Encounter. Mitwirkende sind die voreingestellten, weiterhin änderbaren XP-Empfänger; gleiche Anteile runden über den bestehenden XP-Owner auf. Auch inaktive Empfänger bleiben auswählbar und verwenden die vorhandenen Aktivierungshinweise. Mehrere Gegenstände können unabhängig ergänzt und verändert werden. Die Gegenstände werden als kanonische unverteilte Beute angelegt, mit Quest-/Gerücht- und Ortsherkunft. Jede Zuweisung an eine Figur bleibt eine ausdrückliche GM-Aktion. Abschluss und Belohnungsreceipt verhindern erneute Vergabe derselben Notizbelohnung. Es gibt keine automatischen Erfüllungsbedingungen oder narrativen Effekte.

Das persönliche Beutebuch ergänzt Teilen und Zusammenführen passender verfügbarer Mengenstapel gleicher Herkunft sowie die ausdrückliche Weitergabe an eine andere bestehende Figur. Quellen, Teilstücke, Vorher-/Nachherstände und Gründe bleiben im Verlauf erhalten. Der Absender behält die Weitergabe als erhaltenen Loot; die Übernahme beim Empfänger ist keine neue Belohnung und erhöht die kumulative Reward-Guidance nicht erneut. Verkäufe und Weitergaben können bestehende Shops, NPCs, Orte oder Fraktionen verknüpfen. Korrekturen behalten die bisherigen Fakten und können diese Verknüpfung berichtigen.

Datenbankformat 35 ergänzt narrative Zustände und Awardreceipts; ältere Formate 33/34 werden beim Kampagnenimport ergänzt. Der gemeinsame Ressourcen-Launcher ist unter `tools/codex-dungeon-job.py` dokumentiert. Seine Quoten bleiben unverändert; Prozessdelegation erlaubt dem Prüftreiber, von KDE verschobene eigene Electron-Prozesse samt Kindern wieder in den begrenzten Job zurückzuführen. Die gemeinsame Codex-App wird nicht begrenzt.

Nativer Kernablauf: Quest-Metadaten und Mitwirkende bearbeiten, gemeinsamen Belohnungsdialog verwenden, 101 XP auf zwei gewählte Figuren als je 51 XP verteilen, Gegenstände zunächst unvergeben lassen, zwölf Münzen zuweisen, einen Mengenstapel teilen und wieder zusammenführen, drei Münzen weitergeben und alle Zustände nach einem neuen Prozess lesen. Die weitergehende Gesamtqualifikation und der weitere dokumentierte Produktumfang bleiben offen.


### Desktopstand 0.31: Belohnung fortsetzen und Weitergaben bewerten

Quest- und Gerüchtangaben werden während der Eingabe als eigener Entwurf gespeichert. Leere Mengen, unfertige XP-Zahlen und angefangene Goldwerte bleiben unverändert erhalten und werden beim nächsten Öffnen wieder angezeigt. Vollständige Angaben lassen sich wie bisher bestätigen; unvollständige Entwürfe erlauben den Wechsel in andere Arbeitsbereiche. „Eingabe verwerfen“ stellt den bestätigten Stand wieder her. Ein inzwischen geänderter bestätigter Stand verlangt eine ausdrückliche Übernahme des geprüften Entwurfs. Ein erfolgreiches Speichern entfernt genau den übernommenen Entwurf gemeinsam mit der Statusänderung.

Figurenweitergaben behalten eine stabile Loot-Herkunft. Der kumulative Wert zählt beim ursprünglichen Empfänger einmal: noch gehaltene Mengen zum aktuellen Definitionswert, später verkaufte Mengen zum tatsächlichen Verkaufspreis. Weitere Weitergaben, Rückgaben, Teilmengen und Verkaufsberichtigungen aktualisieren dieselbe Gutschrift. Der übernehmenden Figur entstehen dadurch keine zusätzlichen Belohnungen. Auch bestehende Weitergaben aus 0.30 werden anhand ihrer erhaltenen Elternbeziehungen berücksichtigt. Stapel verschiedener Gutschriften lassen sich nicht vermischen. Der Verlauf behält die ursprünglichen Transaktionen; die Beutedetails zeigen die Herkunft und den aktuellen gutgeschriebenen Wert.

Datenbankformat 36 ergänzt die narrativen Eingabeentwürfe und Herkunftsindizes. Kampagnenimporte aus den Formaten 33–35 werden vor der Übernahme ergänzt. Die Eingabesicherung umfasst die narrativen Angaben im Vorbereitungsbereich; ein noch nicht bestätigter Abschlussdialog besitzt weiterhin keinen eigenen fortsetzbaren Entwurf.


### Desktopstand 0.32: Abschlüsse unterbrechen und fortsetzen

Der gemeinsame Abschlussdialog für Kämpfe, Quests und Gerüchte speichert nun Ergebnistext, XP-Pool, Tagesbelastung, Empfängerauswahl und mehrere Gegenstandsbelohnungen als Eingabeentwurf. Auch angefangene Zahlen, leere Mengen und unfertige Goldwerte bleiben unverändert erhalten. „Schließen · Eingabe behalten“ erlaubt eine Unterbrechung; beim erneuten Öffnen desselben Kampfes oder derselben Quest werden die Angaben wieder angezeigt, auch nach einem App-Neustart. „Entwurf verwerfen“ lädt die vorbereiteten Vorgaben neu.

Ein gespeicherter Abschlussentwurf vergibt keine XP oder Beute. Erst die ausdrückliche Bestätigung übernimmt Ergebnis und Belohnung und entfernt genau den zugehörigen Entwurf in derselben Datenbanktransaktion. Hat sich der bestätigte Kampf-/Queststand inzwischen verändert, bleibt die Eingabe erhalten und verlangt eine ausdrückliche Übernahme des geprüften Entwurfs. Kämpfe und narrative Notizen besitzen getrennte Abschlussziele, sodass ihre Eingaben sich nicht gegenseitig überschreiben.

Datenbankformat 37 ergänzt Abschlussentwürfe. Die Kampagnenübertragung erhält deren lokale Ziele, Empfänger und Gegenstandsreferenzen; Importe aus den Formaten 33–36 werden ergänzt. Die in 0.31 genannte Lücke für noch nicht bestätigte Abschlussdialoge ist damit geschlossen.


### Desktopstand 0.33: Kampagnenwissen direkt an der Szene

Der neue Szenentisch im Bereich „Party und Leiten“ verbindet die laufende Gruppe mit ihrem Kampagnenwissen. NPCs, Fraktionen, Quests, Gerüchte und Orte lassen sich nach Titel und Notiztext durchsuchen; weitere Suchbereiche zeigen Gegenstände, Kreaturen und Encountervorlagen. Treffer lassen sich öffnen und ausdrücklich an die fokussierte Szene heften. Jede Primary-/Split Scene behält ihre eigene Auswahl nach einem Neustart. Der aktuelle Ort erscheint zusätzlich als Kontext; das Entfernen eines Pins löscht keinen Kampagneninhalt.

Leichtgewichtige NPCs, Fraktionen, Quests, Gerüchte und Orte können direkt am Tisch angelegt werden. Vorlesetexte, GM-Notizen und geordnete Ortsabschnitte bleiben dort editierbar, einschließlich vorhandener Beziehungen und sonstiger Metadaten. Eingaben werden als bestehende Vorbereitungsentwürfe gesichert, auch bei leerem Titel. Gültige Angaben werden beim Inhalts-/Bereichswechsel oder mit „Angaben übernehmen“ bestätigt. „Gespeicherten Stand laden“ verwirft ausdrücklich die offene Eingabe. Eine zwischenzeitlich an anderer Stelle geänderte Eingabe wird nicht überschrieben.

Quests und Gerüchte erhalten den vorhandenen Status-/Belohnungsbereich direkt im Szenentisch und benutzen den gemeinsamen fortsetzbaren Abschlussdialog. Neu in der Szene angelegte Quests übernehmen die aktuellen Gruppenmitglieder als Mitwirkende; eine vorhandene Quest behält ihre Mitwirkenden. Kreaturen lassen sich aus der Suche direkt zur aktuellen Initiative hinzufügen, Encountervorlagen unmittelbar vorbereiten. Die Gegenstandssuche zeigt vorhandene eigene Definitionen und ihren Quellenstatus; der vollständige SRD-Itemkatalog bleibt offen. Gegenstände bleiben im Szenentisch lesbar; Zuweisung und Handel verwenden weiterhin die vorhandenen Fachabläufe.

Datenbankformat 38 ergänzt gruppenspezifische Szenenpins. Kampagnenimporte aus den Formaten 33–37 werden ergänzt; portable Verweise auf den unveränderten Kreaturkatalog behalten ihre Katalogkennungen. Die Suche liefert begrenzte Seiten mit weiteren Treffern. Zeichnungs-/Raum-Keys und Shops besitzen weiterhin ihre eigenen Such-/Arbeitsbereiche.


### Desktopstand 0.34: SRD-Gegenstände direkt verwenden

Die native Gegenstandssuche und der Szenentisch enthalten jetzt alle 289 Definitionen des vorhandenen SRD-5.1-Transkripts: Ausrüstung und die bisher erfassten magischen Gegenstände. Preis-/Gewichtsangaben, Eigenschaften, Beschreibungen sowie Rüstungs-, Schadens-, Tempo- und Traglasttexte stammen aus dieser lokalen Quelle. Nicht veröffentlichte oder nur relational beschriebene Preise bleiben unbekannt. Die Quellenseite und CC-BY-4.0-Angabe stehen am Eintrag; die Attribution wird mit dem Desktoppaket ausgeliefert.

SRD-Definitionen sind schreibgeschützt und unmittelbar in Shops, Treasures und dem persönlichen Ledger verwendbar. „Eigene Kopie anlegen“ übernimmt die beschriebenen Fakten, Quellenangabe und Herkunftshash in eine unabhängig bearbeitbare Definition. Der ursprüngliche Gegenstand bleibt unverändert. Neue erfasste Einträge werden beim Öffnen ergänzt; Änderungen eines Quelleneintrags erzeugen eine neue aufgezeichnete Definitionrevision. Vorhandene eigene Definitionen werden erhalten.

Ein Shop verlangt für Gegenstände ohne Richtwert ausdrücklich Verkaufs- und Ankaufspreise. Ein nicht veröffentlichter Preis wird nicht mehr als kostenloser Standardbestand eingesetzt. Vergaben behalten den Definitionsrichtwert oder einen unbekannten Wert; ein eigener Richtwert gehört in eine eigene Definition. Käufe und Verkäufe verwenden weiterhin die tatsächlich bestätigten Preise und vorhandenen Gegenstandsreferenzen.

Der Anschluss ersetzt keine vollständige Quelle: Das Inventar erfasst 290 von 459 Fundstellen, das Transkript enthält wegen einer zusammengeführten Fundstelle 289 Definitionen. 169 Fundstellen und die unabhängige Quellenabnahme bleiben offen. Die Oberfläche zeigt den unvollständigen Quellenstatus ausdrücklich. Datenbankformat 38 bleibt unverändert; die Definitionen verwenden die vorhandenen globalen Tabellen und Versionssnapshots.

### Desktopstand 0.35: Schätze vorbereiten, platzieren und nachbearbeiten

Der eigene Bereich „Schätze“ funktioniert auch ohne laufende Gruppe. Schätze lassen sich anlegen, benennen, an Orte legen und mit eigenen oder vorhandenen Kataloggegenständen bestücken. Mengen beziehen sich ausdrücklich auf den unverteilten Rest. Bereits zugewiesene Gegenstände behalten ihre Mengen, Definitionen und Werte im persönlichen Ledger; spätere Änderungen am Schatz schreiben diese Vergaben nicht um.

Unverteilte Mengen lassen sich in bestehende oder neue Schätze verschieben und direkt an aktive Charaktere vergeben. Verschobene Gegenstände behalten ihre ursprüngliche Schatzherkunft. Bearbeitungen und Verschiebungen erscheinen im Schatzverlauf und der Chronik. Am aktuellen Szenenort führt „Schatz öffnen und zuweisen“ zur passenden Schatzansicht; Ankunft vergibt keine Beute automatisch.

Angefangene Eingaben bleiben als Entwurf erhalten, auch mit leeren Namen oder Mengen. „Schatzangaben übernehmen“ bestätigt gültige Änderungen. Vor Verschieben oder Zuweisen müssen offene Änderungen übernommen werden; „Gespeicherten Stand laden“ verwirft die offene Eingabe ausdrücklich. Datenbankformat 39 ergänzt Schatzentwürfe und übernimmt Kampagnenimporte aus den Formaten 33–38.

### Desktopstand 0.36: Monstergruppen als eigenständiger Weltinhalt

„Monstergruppen“ verwaltet vorbereitete Gruppen unabhängig vom Spielabendplan und von der aktiven Party. Eine Gruppe beginnt leer oder als eigene Kopie einer Encounter-Vorlage. Einzelne Kreaturen aus dem Katalog erhalten dauerhafte NPC-Identitäten; Name, HP, temporäre HP, Zustände, Konzentration, Vorlesetext und GM-Notizen lassen sich nachbearbeiten. Bestehende Figuren behalten ihre Identität und ihren Zustand beim Standortwechsel.

Offene Eingaben werden als Rohentwurf gesichert, einschließlich leerer Namen und HP. „Gruppenangaben übernehmen“ bestätigt die Gruppe als dauerhaften Weltinhalt; sie ist danach nicht mehr an einen Planentwurf gebunden. „Aus Gruppe entfernen“ erhält die NPC-Figur und den bisherigen Verlauf. Die NPC-Notizen bleiben in der gemeinsamen Wissenssuche verfügbar.

Am aktuellen Szenenort erscheinen platzierte Gruppen. Die Spielleitung wählt einzelne verfügbare Figuren aus und bereitet daraus ausdrücklich eine Begegnung vor. Ankunft startet keinen Kampf. Die bestehende Beschränkung auf einen offenen Encounter pro Scene bleibt noch bestehen; mehrere gleichzeitige Encounter-Masken sind weiter offen. Gruppenänderungen erscheinen in der Kampagnenchronik. Datenbankformat 40 ergänzt Gruppenentwürfe und übernimmt Kampagnenimporte aus den Formaten 33–39.

### Desktopstand 0.37: Mehrere Encounter-Masken und freie Partywechsel

In derselben laufenden Scene können mehrere Begegnungen offen sein. „Weitere Begegnung“ bleibt verfügbar; der Begegnungswähler hält vorbereitete und laufende Masken vor abgeschlossenen Ergebnissen. Initiative, Runden, Notizen und Abschluss gehören weiterhin zur jeweils gewählten Begegnung. PCs und dauerhafte NPC-Figuren können in mehreren Masken gleichzeitig vorkommen; sie besitzen dabei einen gemeinsamen HP-/Zustandsstand. Änderungen in einer Maske werden in den anderen gespeichert und nach dem Wechsel sichtbar.

Ein Scene-Wechsel oder Deaktivieren entfernt die betroffenen PCs atomar aus allen offenen Encounter- und Chase-Masken. Die übrigen Teilnehmer und Maskenverläufe bleiben bestehen; die wechselnde Figur nimmt ihren aktuellen HP-/Zustandsstand mit. Eine Wiederholung desselben Auftrags entfernt niemanden erneut.

Rückgängig bleibt für Schritte der gewählten Begegnung verfügbar. Eine spätere Änderung gemeinsamer Werte in einer anderen Maske oder ein Partywechsel verwirft die älteren Rückgängig-Schritte der betroffenen Begegnung. Der Tracker zeigt den Grund, statt fremde spätere Änderungen zurückzuspulen oder verschobene Figuren wieder einzusetzen. Angefangene Werte-/Notizentwürfe bleiben erhalten und müssen bei inzwischen geändertem Stand abgeglichen werden. Datenbankformat 41 übernimmt den bisherigen aktiven Kampfstand als gemeinsame PC-Werte und ergänzt Importe der Formate 33–40.

### Desktopstand 0.38: Spielabendpläne ersetzen und wiederverwenden

„Plan ersetzen / wiederverwenden…“ bietet eine leere Timeline oder einen vorhandenen Plan als Vorlage. Die Vorschau zeigt die Besuchszahl vor und nach dem Wechsel; Planungsparty und Adventure Day lassen sich auf Wunsch aus der Vorlage übernehmen. Besuche erhalten neue Kennungen und übernehmen Reihenfolge, Ortsverweise, Notizen, Vorlesetexte und Wissensbezüge. Noch nicht angenommene Monstergruppen werden als unabhängige Entwürfe kopiert. Angenommene Gruppen und platzierte Schätze werden weiter referenziert; ihre Figuren, HP und Gegenstände werden nicht dupliziert. Bereits vergebene Besuchsbelohnungen bleiben abgeschlossen, offene Belohnungen erhalten eine neue Vorbereitungskennung.

Der Ersatz entfernt die bisherige Timeline, ihre Besuchsvorbereitung und die zugehörigen Session-Vorschläge. Angenommene Weltinhalte, globale Generatorquellen und bisherige Fakten bleiben erhalten. Laufende Scenes behalten ihren übernommenen Inhalt und die ursprüngliche Herkunft. Die Vorschau wird abgewiesen, wenn die betrachtete Vorbereitung zwischenzeitlich geändert wurde. „Timeline leeren“ benutzt dieselbe Ersetzung ohne Vorlage und behält den Plannamen sowie die bisherige Planungsparty. Der Vorgang erscheint im Weltverlauf und der Chronik. Datenbankformat 41 bleibt unverändert.

### Desktopstand 0.39: Begegnungen aus der Kampagnenwelt

In „Katalog und Encounter“ verknüpft die Spielleitung vorhandene Fraktionen mit
einer Haupttabelle und optionalen Beständen pro Kreatur. Leer bedeutet unbegrenzt,
0 bedeutet nicht verfügbar. Orte verknüpfen eigene Tabellen und Fraktionen.
Der Generator schneidet Ort, gewählte Fraktionen, explizite Tabellen und bestehende
Katalog-/Umgebungsfilter. Mehrere Fraktionen bündeln ihren Bestand; direkte
Ortstabellen liefern unbegrenzte Quellen. Ohne gemeinsame Quellen gibt es eine
lesbare Fehlermeldung, keinen Rückfall auf den Gesamtkatalog. Vorschläge verbrauchen
keinen Bestand; Weltfolgen bleiben ausdrückliche GM-Entscheidungen.

Die gespeicherte Vorschau hält ihren Weltquellenstand fest. Änderungen an Links
oder Beständen erfordern eine neue Vorschau vor Übernahme. Tabellenänderungen
entfernen nicht mehr zulässige Bestandseinträge in derselben Transaktion.
Kampagnenpakete behalten und remappen Quellen und Fraktions-/Ortsreferenzen.
Noch offen: NPC-Fraktionsmitgliedschaft/Disposition und direkte Weltfilter im
Spielabend-Generator; der Encounter-Generator besitzt den vollständigen neuen Ablauf.

### Desktopstand 0.40: einzelne NPCs vorbereiten und am Tisch benutzen

„NSCs und Monstergruppen“ enthält einen eigenständigen NPC-Katalog mit Namens-,
Lebenszyklus-, Fraktions- und Ortsfiltern. Name genügt für erzählerische Figuren.
Ein Kreaturverweis initialisiert dauerhafte HP aus dem bestehenden Katalog.
Aussehen, Verhalten, Geschichte, Vorlesetext und GM-Notizen bleiben getrennt;
die Figur besitzt höchstens eine Fraktion und einen Standort. Rohentwürfe bleiben
auch mit unfertigen Zahlen über Neustart und Kampagnentransfer erhalten.
„NPC übernehmen“ bestätigt Änderungen gemeinsam; „Entwurf verwerfen“ lädt den
Autorenstand. Gruppenfiguren und unabhängig angelegte NPCs verwenden dieselben
Weltidentitäten und dieselbe Gesundheit.

Die Fraktionsquelle besitzt eine Haltung −100 bis 100. Zusammen mit dem
persönlichen Modifikator ergibt sie die anfängliche Begegnungsrolle. Neue
Verbündete/neutrale NPCs beginnen mit 0 Gegner-XP und zählen nicht zum
Gegnermultiplikator; die GM kann XP und Multiplikator im Kampf weiter anpassen.
Bestehende Masken behalten ihre Rolle, während gemeinsame HP weiter synchron
sind. „Besiegt“ ist eine manuelle Weltentscheidung: sie sperrt neue Teilnahme,
beendet keine Maske und ändert keine HP. Reaktivierung heilt ebenfalls nicht.
Kampfende setzt keinen Lebenszyklus und verbraucht keinen Fraktionsbestand.
NPCs lassen sich ausdrücklich in die aktuelle Begegnung übernehmen. Eine
Platzierung an einem anderen Ort muss vorher durch die GM korrigiert werden.

Offen bleiben NPC-basierte Zufallsgenerierung und direkte Weltfilter im
Spielabendgenerator. Die Fraktionszuordnung ergänzt den bisherigen freien
Beziehungsgraphen; Fraktionen/Orte werden weiterhin in Welt und Spielabend angelegt.

### Desktopstand 0.41: Spielabend-Vorschläge aus Ort und Fraktion

Der Spielabend-Generator verwendet auf Wunsch die Weltquellen jedes gebundenen
Szenenorts. Gewählte Fraktionen und Encounter-Tabellen schneiden diese Quellen;
Fraktionen erscheinen zusätzlich als gebundene Wissensverweise. Jede Begegnung
hält ihren eigenen Generatorstand fest. Fehlende gemeinsame Quellen lassen die
gesamte Vorschau unverändert; es entsteht keine teilweise Session. Alte API-
Aufträge ohne Ortsquellenflag behalten die bisherige freie Generierung.

Eindeutig verknüpfte Beutetabellen erzeugen geplante, reproduzierbare Belohnungen
mit zunächst 0 Story-XP. Es entsteht dabei kein World-Schatz und keine Vergabe.
Einzelne Vorschläge können Titel, Vorlesetext, GM-Notizen, Ort, Wissensverweise,
Story-XP und Beuteeinträge vor ihrer Timeline-Übernahme bearbeiten. Begegnung
und Beute lassen sich separat neu erzeugen; andere Vorschläge, angenommene
Besuche und eigene Texte bleiben erhalten. Ein geänderter Quellenort verlangt
eine neue Begegnung vor der Annahme. Vorschläge lassen sich verwerfen und
wiederherstellen. Angenommene Vorschläge bleiben geschlossen; ihre Inhalte
werden über den bestehenden Besuch bearbeitet und Belohnungen separat platziert
oder vergeben. Änderungen im Vorschlagsdialog werden ausdrücklich gespeichert;
Abbrechen verwirft die noch ungespeicherten Dialogeingaben.

Bestandsgrenzen gelten pro Begegnung, nicht als Reservierung für den ganzen
Abend. Vollständiger DMG-Beutebudget-/Lootausgleich und NPC-basierte Kandidaten
bleiben offen; verknüpfte Beutetabellen ersetzen diese spätere Budgetgenerierung
nicht. Schema43 bleibt unverändert; neue Vorschlagsfelder sind optional.

### Desktopstand 0.42: kumulierter Beuteausgleich für Spielabende

Der Spielabend-Generator kann die vorhandene Beute-Fortschrittskurve des wirksamen
Presets mit bestätigten Charakter-XP und den persönlichen Loot-Ledgern verbinden.
Nur einzeln gewählte Roster-Figuren mit bekannten XP können diesen Modus nutzen.
Freie Planungszeilen bleiben bei ausgeschaltetem Beuteausgleich verwendbar.
Die Summe der erwarteten Werte nach den geplanten Encounter-/Story-XP abzüglich
bereits erhaltener Beute ergibt das neue monetäre Ziel; Überschüsse können es auf
0 senken. Käufe zählen nicht als erhaltene Belohnung, Verkäufe und Weitergaben
verwenden die bestehende Ledgerbewertung. Unbekannte relevante Werte erfordern
eine Klärung oder den manuellen Modus.

Verknüpfte Beutetabellen liefern weiterhin den Inhalt. Mengen werden auf das
Budget begrenzt; ein exakter Rest wird mit Gold-, Silber- und Kupfermünzen gefüllt.
Auch ohne Beutetabelle entstehen so eigene geplante Belohnungen. Die Vorschau
speichert Presetstand, XP, Ledgerwerte, Basis, Differenz, Ziel und Szenenanteile.
Sie erzeugt keine Vergabe, Weltbeute oder Gegenstandsdefinitionen. Einzelne
Beuteregeneration hält den gespeicherten Anteil ein; eigene Reward-Edits bleiben
erlaubt. Encounterregeneration schreibt bereits geplante Beute nicht um und die
Empfehlung bleibt als ursprünglicher Berechnungsstand lesbar. Vorschlagshistory
zeigt nach einzelner Regeneration sofort den tatsächlich offenen Run.

Die Berechnung verwendet die bereits im Projekt enthaltene versionierte
Presetkurve; sie ist keine neue Behauptung einer vollständigen publizierten
DMG-Herleitung. Automatische Magie-Seltenheitskontingente und deren kumulierter
Ausgleich bleiben offen. Schema43 bleibt unverändert.


### Desktopstand 0.43: Begegnungen mit vorhandenen NPCs

Encounter- und Spielabend-Vorschauen besitzen einen Modus für bereits vorhandene
feindliche Weltfiguren. Positive HP, aktiver Lebensstatus und ein Statblock sind
erforderlich. Ortsfilter beziehen sich auf den tatsächlichen Standort,
Fraktionsfilter auf die Zugehörigkeit. Weitere Tabellen und Katalogfilter
begrenzen die Kreaturtypen; der Textfilter findet NPC- oder Kreaturnamen.
Dieser Modus benötigt keine zusätzliche Tabellenbindung am Ort. Die Anzahl
verfügbarer NPCs begrenzt die Komposition, jeder erscheint pro Begegnung einmal.

Vorschläge zeigen Namen und halten Weltreferenzen. Sie reservieren, bewegen oder
kopieren keine NPCs. Veränderte NPC-Zustände machen die noch unangenommene
Vorschau veraltet. Nach Übernahme verwenden Vorlagen, vorbereitete Gruppen und
Live-Masken dieselben NPC-Identitäten mit aktuellen HP, Zuständen und Haltung.
Figuren an einem anderen Ort müssen ausdrücklich umplatziert werden. Manuelle
Gruppenbearbeitung und Kampagnentransfer erhalten die Referenzen. Katalogmodus
und neue Monstergruppen bleiben verfügbar.

Es handelt sich um einen eigenen Modus für benannte Gegner; gemischte
NPC-/Katalogpools und automatische magische Seltenheitsquoten bleiben offen.
Bestand wird pro Begegnung begrenzt, nicht über den ganzen Spielabend reserviert.
Schema43 bleibt unverändert, neue Entry-/Run-Felder sind optional.


### Desktopstand 0.44: magische Beute und Katalogauswahl

Der zusätzliche Magiebeute-Modus vergleicht die vorhandene versionierte
Presetkurve mit bestätigten Charakter-XP und erhaltenen Gegenständen nach
Common, Uncommon, Rare, Very Rare und Legendary. Käufe und Weitergaben werden
nicht nochmals als Belohnung gezählt; die ursprüngliche Vergabe bleibt auch
nach Verkauf oder Weitergabe berücksichtigt. Erwartungswerte bleiben als
Bruchteile gespeichert, neue ganzzahlige Kontingente werden einmal für den
ganzen Spielabend kaufmännisch gerundet und auf Szenen verteilt. Überschüsse
können die neue Menge einer Seltenheit auf0 senken.

In diesem Modus werden monetäre Beute und magische Gegenstände getrennt
berechnet. Magiebeute ohne bekannten Preis bleibt nach Seltenheit auswertbar.
Eine fehlende Seltenheit in erhaltener Magiebeute erfordert Katalogkorrektur
oder Opt-out. Der bisherige rein monetäre Modus und alte Vorschauen bleiben
verfügbar. Die Formel verwendet weiterhin das vorhandene Preset und behauptet
keine vollständige publizierte DMG-Herleitung.

Passende magische Tabellenitems bleiben im Rahmen der Kontingente erhalten;
der Katalog ergänzt konkrete revisionierte Gegenstände. Fehlende
Seltenheitsquellen erscheinen als offene Mengen mit Hinweisen. Der Generator
erfindet keine Gegenstandsdefinitionen. Einzelne Beuteregeneration verwendet
die gespeicherten Ziele, auch ohne verknüpfte Beutetabelle. Die Vorschau vergibt
keine Gegenstände und verändert weder Ledger noch platzierte Schätze.

Im Vorschlagseditor lassen sich Kataloggegenstände nach Text, Magie und
Seltenheit suchen und mit ihrer Definition zur Belohnung hinzufügen. Referenzierte
Namen/Eigenschaften bleiben gebunden; Als eigenen Eintrag bearbeiten löst diese
Bindung ausdrücklich. Mengen und freie Einträge bleiben bearbeitbar. Übernahme
in die Timeline, Platzierung und Kampagnentransfer erhalten die Referenzen.
Schema43 unverändert, zusätzliche Guidance-/Proposal-Felder optional. Gemischte
NPC-/Katalogpools und getrennte Verbrauchs-/Dauermagiequoten bleiben offen.


### Desktopstand 0.45: benannte Gegner und neue Begleiter in einer Gruppe

Der gemischte Encounter-/Spielabendmodus verwendet die bestehenden Tabellen,
Orts-/Fraktionsfilter und Bestandsgrenzen. Wenn der gewählte Kreaturtyp bei
vorhandenen feindlichen NPCs vorkommt, werden diese bevorzugt übernommen.
Die übrige Menge bleibt eine neue Tabellenbesetzung. Vorhandene NPCs werden
nicht zusätzlich auf den Bestand aufgeschlagen: zwei benannte Goblins in
einer Gruppe von drei ergeben zwei Weltreferenzen und einen neuen Goblin.

Vorschläge zeigen Namen und die übrige Menge getrennt. Benannte NPCs behalten
Identität, aktuelle HP, Zustände und Haltung. Neue Weltfiguren entstehen nur
für die übrige Menge beim Platzieren oder Übernehmen ins Live-Spiel. Ein
gemeinsamer Mob-Eintrag kann beide enthalten, ohne zusätzliche Initiativeplätze
durch den Identitätsmix. Bearbeitung, separate Regeneration und Kampagnentransfer
erhalten die Zuordnung. Gruppenbearbeitung erhält benannte Referenzen auch
bei anderer Figurenreihenfolge.

Der reine NPC-Modus bleibt ohne neue Tabellengegner verfügbar; ältere Requests
ohne includeNpcs behalten den Katalogmodus. Gebundene Orte greifen im gemischten
Modus und benötigen passende Quellenbindungen. Bestehende NPCs anderer Typen
werden nicht automatisch als Pflichtgegner ergänzt. Vorschläge reservieren
keinen gemeinsamen Abendbestand und verändern keine NPC-Zustände.

Neue Vorschauen speichern außerdem portable, revisionierte Weltquelleninputs
zusätzlich zum bisherigen Hash. Beim Kampagnentransfer werden deren Orte,
Fraktionen und Tabellen remappt; Quelländerungen werden weiter erkannt.
NPC-Kandidaten halten während der Generierung nur kleine Identitäts-/
Revisionsprojektionen statt vollständiger Profiltexte im Speicher.
Schema43 unverändert, Entry-Weltreferenzen können nun einen Teil der gesamten
Menge belegen; bestehende reine NPC-Vorlagen bleiben gültig.


### Desktopstand 0.46: verbindliche NPCs statt zufälliger Besetzung

Im Encounter-Generator und Spielabend lassen sich bestehende feindliche NPCs
suchen und verbindlich auswählen. Ihr Statblock darf außerhalb der gewählten
Monsterfilter und Tabellen liegen; die Auswahl der zusätzlichen Gegner bleibt
an diese Quellen gebunden. Der gemeinsame Selector rechnet die gesetzten XP,
Kreaturen und Initiativeplätze vor der Ergänzung mit ein. Eine Begegnung kann
auch allein aus den gesetzten NPCs bestehen. Jeder gesetzte Gegner besitzt
seinen eigenen Initiativeplatz, seine Weltidentität und den aktuellen HP-Stand.
Verfügbare Bestandsgrenzen, tatsächlicher Ort und gewählte Fraktionen bleiben
bindend. Die Vorschau erzeugt keine Weltfiguren.

Ein Spielabend verteilt die verbindlichen NPCs genau einmal: bei ausgewählten
Orten auf deren ersten Besuch, sonst reihum auf die Szenen. NPCs an einem nicht
gewählten Ort werden ausdrücklich gemeldet. Einzelne Neugenerierung hält die
Besetzung fest. Änderungen an den NPCs verlangen vor der Übernahme eine neue
Vorschau. Kampagnentransfer übersetzt die gesetzten und ausgeschlossenen IDs.
Das Tutorial erklärt die Auswahl; ältere Requests ohne Auswahl bleiben gültig.

Offen bleiben die vollständige veröffentlichte DMG-Herleitung der Beutequoten,
gezielte Gegenstandspools und getrennte Kontingente für verbrauchbare und
permanente Magiebeute. Native Gesamt- und Plattformabnahme bleiben separat.


### Desktopstand 0.47: gezielte, vielfältige Magiebeute

Die Spielabendplanung kann einen eigenen Gegenstandspool benutzen. Suche und
Seltenheitsfilter finden aktive magische Katalogdefinitionen; die Auswahl
aktiviert den Magiebeuteausgleich. Der gespeicherte Lauf bindet die konkreten
Gegenstandsversionen. Unpassende Tabellenbeute wird ausgelassen, fehlende
Seltenheiten bleiben als offene Kontingente sichtbar. Ein leerer eigener Pool
weicht nicht auf den allgemeinen Katalog aus.

Größere Seltenheitskontingente verteilen sich reproduzierbar auf verschiedene
passende Definitionen statt nur einen zufälligen Gegenstand zu vervielfachen.
Ohne eigenen Pool gilt die Auswahl auch für den allgemeinen Katalog. Der
Generator liest Kandidaten nacheinander und hält höchstens zwölf kleine
Definitionprojektionen je Seltenheit. Die Summe je Seltenheit bleibt erhalten.

„Nur Beute neu erzeugen“ hält Pool und gespeicherte Kontingente fest; einzelne
Vorschläge bleiben manuell bearbeitbar. Übernahme, Schatzplatzierung, Neustart
und Kampagnentransfer behalten die Referenzen. Geänderte, entfernte oder beschädigte Definitionen
werden bei Neugenerierung als offene Kontingente gemeldet. Die veröffentlichten
DMG-Quoten und getrennte Verbrauchs-/permanente Magiequoten bleiben offen.


### Desktopstand 0.48: Rast, Szenenzeit und Erholung zusammenführen

„Mit der Gruppe rasten“ verbindet die gewählten Figuren mit der Uhr der laufenden
Szene. Kurze Rast in Minuten und lange Rast in Stunden sind anpassbar; die Vorschau
zeigt beide Endzeiten. Zeit, Rastbudget und freigegebene Weltfolgen werden gemeinsam
übernommen. Wetter, Shop-Nachschub und autorisierte Autonomie benutzen den bestehenden
Zeitablauf. Eine wiederholte identische Bestätigung schreibt nichts ein zweites Mal.

Bei langer Rast kann der GM bekannte Figuren mit positiven HP ausdrücklich auf
volle HP setzen. 0 HP, unbekannte HP, Zustände und temporäre HP bleiben erhalten;
weitere Charakterressourcen werden am Charakterbogen geführt. Nur ausgewählte
aktive Figuren derselben Szene rasten; laufende Kämpfe oder Verfolgungen sind zuvor
abzuschließen. Ein zwischenzeitlicher Gruppen-/Uhrwechsel verlangt den aktuellen
Spieltisch. Ohne Zeitoption bleibt die bisherige Rastbudgetkorrektur möglich.

Die Anzeige aktualisiert Uhr, Wetter-/Ortskontext, Party-HP und Budget. Die Chronik
hält Dauer, Scene und ausdrückliche HP-Erholung fest. Rast und Zeitwirkungen werden
zusammen gespeichert, einschließlich Receipt; ein konkreter Fehler rollt beide
zurück. Schema43 unverändert, ältere zeitlose Rastcommands weiterhin nutzbar.


### Desktopstand 0.49: Adventure-Day-Rechner in der Kopfleiste

„Rastbudget“ zeigt den aktuellen SR-/LR-Verbrauch der aktiven Party und öffnet einen
Rechner, ohne den Arbeitsbereich zu wechseln. Die separate Party-Schaltfläche führt
zu den vorhandenen Figuren am Spieltisch. Öffnen und bestätigte Party-/Raständerungen
aktualisieren den Stand; fehlende XP oder Rastwerte bleiben ausdrücklich offen.

„Budget“ zeigt Tagesbudget, zwei Rastschwellen und Encounter-Schwierigkeiten. „XP →
Tage“ zeigt volle Tage, Teilfortschritt, Rastanzahl, Etappen und prognostizierte Level.
Die aktive Party verwendet bestätigte individuelle XP. Eigene Level-/Anzahl-Zeilen
starten am XP-Minimum ihres Levels und bleiben reine Rechnereingaben. Belastung und
XP-Verdienst lassen sich getrennt eingeben; der Verdienst wird pro Figur aufgerundet.
Die Tagesprognose nutzt das feste Budget der eingegebenen Startlevel.

Die Berechnung gehört zum Party-/Progress-Kern und verwendet dieselben XP-/Tages-
und Encountertabellen wie die vorhandenen Abläufe. Der Renderer stellt nur dar.
Große Zeiträume erzeugen höchstens 94 Etappeneinträge; weitere volle Tage werden
zusammengefasst. Rechneraktionen schreiben weder Roster, Planungsparty noch Weltzeit.
Echte XP, Rasten und Zeitfolgen bestätigt der GM anschließend am Spieltisch.


### Desktopstand 0.50: Party und Roster direkt in der Kopfleiste

Die Party-Schaltfläche (Alt+P) öffnet eine Oberfläche über dem aktuellen Arbeitsbereich.
Aktive Figuren zeigen Identität, stabile Roster-ID, XP bis zum nächsten Level, HP,
RK, Bewegung, passive Werte und Rastbelastung. Darunter durchsucht der GM alle
aktiven und inaktiven Figuren nach Namen, Spieler, Profil, Sprachen oder ID.
Die Rosterliste zeigt jeweils 40 Treffer und lädt weitere auf ausdrücklichen Klick.

Name allein genügt für eine neue, zunächst inaktive Figur. Profilwerte lassen sich
explizit speichern oder wieder leeren; Sprachen behalten ihre eingegebene Reihenfolge.
„Zur Party“ ordnet eine bestehende Figur der Gruppe im Fokus zu, „Aus Party“ entfernt
sie aus der Teilnahme. Die gespeicherte Figur und ihre Historie bleiben erhalten.
Zum ersten Aktivieren muss die Sitzung am Spieltisch gestartet sein.

Der XP-Balken öffnet eine bestätigte Korrektur: +XP, −XP bis zum aktuellen Levelfloor
oder ein ausdrücklicher Gesamtstand, auch über einen Level-Ausgangsstand. XP und Level
bleiben dieselbe bestätigte Fortschrittsquelle; Profilbearbeitung erzeugt keine XP.
Die Rastsektion wählt Figuren der Gruppe im Fokus und übernimmt kurze/lange Rast
mit optionaler gemeinsamer Szenenzeit und positiver HP-Erholung. Vorhandene Schreib-
und Belegwege halten den Spieltisch, Rastbudget und Chronik aktuell. Offene gültige
Spieltischeingaben werden vor einer bestätigten Partyänderung gespeichert.
Löschen/Archivieren von Rosterfiguren und ein wieder löschbarer unbekannter XP-Stand
sind noch offen; Teilnahme entfernen ist ausdrücklich keine Charakterlöschung.


### Desktopstand 0.51: Figuren archivieren und wiederherstellen

„Archivieren…“ in der Party-Oberfläche verlangt den genauen Figurennamen. Der Owner
entfernt die Figur und ihre Teilnahme atomar aus Party, Scenezuordnung und offenen
Kampf-/Verfolgungsmasken. Leere Split Scenes verwenden dieselbe vorhandene Retirement-
und Fokuslogik wie das Entfernen aus der Party. Ein erneuter Auftrag mit derselben
Command-ID verwendet den bestehenden Beleg.

Das Profil trägt Archivzeitpunkt und optionalen Grund. Stabile ID, XP, Raststand,
Inventar, Wissen, Reiseverlauf und abgeschlossene Kampfhistorie bleiben erhalten.
Die aktuelle Fortschritts-/Empfängerauswahl und die Beutebilanz berücksichtigen nur
Rosterfiguren. Neue Profil-, Teilnahme-, XP- und Belohnungsänderungen an archivierten
Figuren verlangen zuerst eine Wiederherstellung. Archivsuche zeigt jeweils 40 Treffer
mit weiterer Seite; Namen und IDs bleiben unterscheidbar.

„Inaktiv wiederherstellen“ holt die gleiche Figur ins Roster, ohne automatische
Teilnahme, Scenezuordnung oder erneute Aufnahme in frühere Kampfmasken. Kampagnenkopie
und -transfer erhalten den Archivstatus zusammen mit dem Profil und remappen dieselbe
Charakteridentität durch alle Verweise. Archivieren und Wiederherstellen erscheinen
in der Kampagnenchronik. Endgültiges Löschen einzelner Figuren bleibt offen.


### Desktopstand 0.52: XP-Abrechnung für den Spielabend

In der Party öffnet „Spielabend-XP abrechnen…“ bestätigte Figurenstände für eine
gemeinsame Buchung. Fokusgruppe, alle aktiven Figuren oder frei gewählte PCs erhalten
XP. Tagesbelastung hat eine eigene Summe und Empfängerauswahl; nur aktive Figuren
können Belastung erhalten. Reservefiguren können ausdrücklich XP erhalten, ohne ihre
Teilnahme zu ändern. Archivierte Figuren sind keine Empfänger.

XP und Belastung werden jeweils auf ihre Empfänger aufgeteilt, pro Figur aufgerundet
und als tatsächliche Gesamtsummen angezeigt. Die Vorschau zeigt resultierende XP und
Level. Der gemeinsame Ownerauftrag prüft Figuren- und Teilnahmeversionen und bucht
Fortschritt, Belastung, Hinweise und Chronik zusammen. Wiederholung desselben Belegs
vergibt nichts erneut. Ein veränderter Figurenstand lässt die Eingabe offen; „Stand
neu laden“ aktualisiert die Basis und behält noch verfügbare Empfängerauswahlen.
Figurenlisten und Prognosen zeigen jeweils 40 Zeilen mit weiterer Auswahlseite.

Negative Einzel-XP-Korrekturen verwenden jetzt in Topbar, Spieltisch und Schreibdienst
dieselbe Levelfloor-Regel. Nur der tatsächlich abziehbare Betrag reduziert den Stand
und die Zähler für kurze/lange Rast sowie die Rastbasis bis mindestens 0. Bereits
bestätigte Rastabschnitte bleiben bestehen. Positive manuelle XP und ausdrücklich
gesetzte Gesamtstände erhalten die Belastung; die Gruppenabrechnung setzt sie
separat. Unbekannte XP müssen vor einem Abzug eingetragen werden.


### Desktopstand 0.53: Reiseplanung direkt auf der Hexkarte

Der Atlas trennt „Karte bearbeiten“, „Ziel wählen“ und „Wegpunkte wählen“ ausdrücklich.
Im Reisemodus übernehmen Karten- und Ortsmarkerklicks Koordinaten in die Reiseplanung;
Malen und offene Geländefelder bleiben davon getrennt. Nummerierte Stationen lassen
sich ordnen und entfernen, maximal 20 Wegpunkte plus Ziel. „Route leeren“ entfernt
Entwurf und Auswertung. Karten- oder Gruppenwechsel nehmen keine alte Vorschau mit.

Die fokussierbare Karte unterstützt Pfeiltasten und Enter; eine aktive Gruppe lässt
sich ausdrücklich am Cursor platzieren. Zoom erhält Reiseziele und Cursorposition
in Basiskoordinaten. Die Vorschau kommt vom vorhandenen World-Owner und zeigt Zeit,
Hexabschnitte, Strecke, Ankunft und Warnungen; erst Bestätigen startet die Reise.
Stationen sind Eingaben, keine Zusage eines gangbaren oder optimalen Pfads.

Bestätigte Abschnitte, Pause, Fortsetzen und Abbruch verwenden weiterhin dieselbe
persistierte Reise und gemeinsame Gruppenzeit mit ihren Weltfolgen. Aktive, pausierte
und unterbrochene Reisen zeigen ihre Route; nach Ankunft oder Abbruch bleibt nur
Position und Historie. Die Statuszeile zeigt die geplante Restdauer. Weitere automatische
Präsentationsgeschwindigkeiten bleiben offen. Der direkte Anschluss an den Spieltisch
folgt in Desktopstand 0.54.


### Desktopstand 0.54: Die Reise am laufenden Spieltisch

„Reisekarte am Spieltisch“ öffnet Hexkarte und Reisekonsole direkt bei der Fokusgruppe.
Die vorhandenen Atlas-Controls werden dafür an den Spieltisch versetzt: Route,
Vorschau und angenommene Reise bleiben derselbe Zustand. Ziele, Wegpunkte, Zoom,
Kartenwissen, ausdrückliches Platzieren, Reiseabschnitte, Pause und Fortsetzen
verwenden dieselben World-Befehle wie im Atlas. Kalender und Geländebearbeitung
bleiben im Atlas erreichbar.

Ein Fokuswechsel folgt der Kartenposition der neuen Gruppe und verwirft die vorherige
Routenvorschau und Ziele. Änderungen an Uhr, Position oder Mitgliedern verwerfen eine
veraltete Vorschau. Einklappen und Wechsel zwischen Atlas und Spieltisch erhalten den
Routenentwurf derselben Gruppe und Karte. Angenommene Reisen bleiben nach Neustart
verfügbar; offene Routeneingaben sind weiterhin lokale Entwürfe.


### Desktopstand 0.55: Eine vollständige Spielabendmappe

„Spielabendmappe öffnen“ fasst den gewählten Plan in seiner Besuchsreihenfolge
zusammen. Jeder Besuch enthält getrennten Vorlesetext und GM-Notizen, die Abschnitte
seines Ortes, gebundene Weltverweise und NPC-Notizen sowie vorbereitete Begegnungen
mit Besetzung, aktuellem NPC-Zustand, Bewertung und gespeicherten Statblocks.
Belohnungen zeigen XP, Gegenstände und ihren Vergabe-/Platzierungsstand.
Die Planungsparty bleibt von der laufenden Party getrennt. Fehlende oder archivierte
Verweise werden als Lücken genannt.

Die Suche findet Inhalte aller Besuche; die Ansicht rendert jeweils den ausgewählten
Besuch. Offene Plan-/Besuchs-/Gruppeneingaben werden vor dem Lesen gespeichert.
„Aktualisieren“ holt die aktuellen Quellen. Die Markdownausgabe enthält denselben
Quellenstand einschließlich Quellenangaben der Statblocks; zwischenzeitliche Änderungen
erfordern eine Aktualisierung. Vorlesetexte und Autorenprosa behalten ihre Leerzeichen
und Zeilenumbrüche. Die Mappe enthält GM-Inhalte und ist keine Spielerfreigabe.


### Desktopstand 0.56: Spielabendfortschritt und Besuchsergebnisse

Der Spieltisch zeigt die Besuchsfolge eines Plans mit dem Stand der Fokusgruppe.
Besuche lassen sich direkt über die vorhandene Übernahmevorschau starten; erneute
Übernahmen bleiben eigenständige Durchläufe. Für den aktuell übernommenen Besuch
kann der GM ein Ergebnis bestätigen und ihn als abgeschlossen, übersprungen oder
wieder offen markieren. Änderungen hängen weitere Einträge an die Chronik an.
Die bisherige Ergebnisgeschichte bleibt erhalten; der neueste Eintrag bestimmt
den angezeigten Status dieses Durchlaufs. XP, Beute und Weltzeit ändern sich dabei
nicht. Ergebnisse und Besuchsstände erscheinen auch in der Spielabendmappe und
deren Markdownausgabe. Die fünf neuesten Übernahmen je Besuch sind dort sichtbar.

Ein Ergebnis gehört zur konkreten Gruppe und Übernahme, nicht zum Ort oder zu
gleichnamigen Besuchen. Fokus-/Übernahmewechsel und Scene-Revisionen werden bei
der Bestätigung geprüft. Unbestätigte Ergebnisfelder bleiben beim Fokuswechsel
in diesem Prozess als Entwurf erhalten; erst Bestätigen speichert sie dauerhaft.


### Desktopstand 0.57: Die GM-Mappe neben dem laufenden Spiel

„Mappe am Spieltisch öffnen“ zeigt die gewählte Spielabendmappe neben den weiterhin
bedienbaren Leitungsfunktionen. Dieselbe Mappe bleibt auch als Vorbereitungsdialog
nutzbar; es gibt keinen zweiten Plan- oder Ergebnisstand. Besuche lassen sich
durchblättern, über alle Inhalte durchsuchen und aus der Mappe über die vorhandene
Vorschau übernehmen. Vorlesetexte werden auf ausdrücklichen Klick exakt in die
laufende Scene kopiert und gespeichert. Das löst keinen Freigabebefehl aus; eine
bereits für diese Scene aktive Textanzeige folgt ihrem bestehenden Modus. Ergebnisse und neue Übernahmen aktualisieren die angebundene Mappe.

Die Party-Bearbeitung ist bei geöffneter Mappe zunächst eingeklappt und lässt sich
einblenden; die Party-Kopfleiste bleibt verfügbar. Fokus-, Plan- und Kampagnenwechsel
nehmen keine alten Mappenaktionen mit. Suche und Leseposition bleiben bei einer
Aktualisierung derselben Gruppe erhalten. Auf schmalen Fenstern steht die Mappe
unter dem Spieltisch. Markdownausgabe und Prüfung des angezeigten Quellenstands
verwenden weiterhin denselben bestehenden Exportablauf.

### Desktopstand 0.58: Vorschläge zum spielbaren Abend zusammenstellen

Die Spielabend-Vorschau hat eine gemeinsame Auswahl mit Textsuche und Statusfilter. Die Suche umfasst Titel, GM- und Vorlesetext, Orte, Weltverweise und Gegner. „Sichtbare auswählen“ nimmt nur aktuell angezeigte, übernehmbare Vorschläge in die Auswahl auf. Verdeckte ausgewählte Szenen bleiben ausdrücklich im Zähler sichtbar. Vorlesetext und Verweise lassen sich direkt auf jeder Karte aufklappen; die bestehenden Einzelbearbeitungen und Regenerationen bleiben verfügbar.

„Szenen prüfen“ zeigt die vollständige Auswahl in ihrer Vorschlagsreihenfolge. Die Bestätigung fügt alle gewählten Besuche mit ihren Inhalten, Begegnungsgruppen und vorbereiteten Belohnungen gemeinsam hinten an die Timeline an. Eine überholte Timeline oder ausgewählte Vorschlagsrevision wird abgewiesen; eine fehlgeschlagene gemeinsame Übernahme schreibt keine Teilauswahl. Bestätigte Wiederholung derselben Änderung erzeugt keine doppelten Besuche. Gruppen am Spieltisch, Zeit, Weltplatzierung und XP-/Lootvergabe werden dadurch nicht ausgeführt.

Übernommene und verworfene Vorschläge bleiben über den Statusfilter erreichbar. Die Auswahl ist ein vorläufiger UI-Zustand; nach Neustart wählst du erneut. Gespeicherte Vorschau und angenommene Timeline bleiben erhalten. „Spielabendmappe öffnen“ führt direkt zur vorbereiteten GM-Mappe.

### Desktopstand 0.59: Aufträge und Gerüchte am Spieltisch führen

„Aufträge und Gerüchte“ in der oberen Leiste öffnet ein gemeinsames GM-Journal. Es durchsucht Titel, GM- und Vorlesetexte sowie bestätigte Abschluss-Ergebnisse und filtert nach Art und offenem/geschlossenem Status. Die Liste lädt jeweils 40 Einträge nach, statt den gesamten Kampagnenbestand in die Ansicht zu kopieren. Der ausgewählte Auftrag bleibt beim Filtern rechts geöffnet.

Die Leseansicht zeigt private Notizen, Vorlesetext, Ortsbindung, Mitwirkende und Weltverweise. Rechts verwendet sie denselben narrativen Editor wie die Einzelnotiz: Status, Ort, Standardempfänger, XP und Beute vorbereiten; Eingaben sichern; mit ausdrücklichem Ergebnis manuell abschließen und Belohnung vergeben. Bereits ausgegebene Belohnungen bleiben gesperrt. Es gibt keinen zweiten Queststatus oder paralleles Belohnungsledger. Texte und Beziehungen lassen sich über die vorhandene Welt-Notizansicht bearbeiten.

An einen Spielabend gebundene Quests und Gerüchte zeigen nun auch ihren bestätigten Status, vorbereitete Belohnung und ein vergebenes Abschluss-Ergebnis in der GM-Mappe und ihrem Markdown-Export. Unbestätigte Eingaben werden als solche gemeldet und ersetzen den bestätigten Stand nicht. Die bestehende Chronik führt Status- und Abschlussbuchungen weiterhin über denselben Owner.

### Desktopstand 0.60: Zentrale GM-Schnellsuche und Referenzleser

„Schnellsuche“ in der oberen Leiste oder Strg+K findet Weltinhalte und Regeln, Kreaturen, Gegenstände und Begegnungen über ihre bestehenden Suchquellen. Ein gemeinsamer Suchtext und der Quellenfilter ersetzen die Suche in vier getrennten Arbeitsbereichen. Je Quelle wird eine begrenzte Seite geladen; weitere Treffer lassen sich separat nachladen. Pro Suchlauf laufen höchstens zwei Suchanfragen zugleich. Während ein anderer modaler Editor offen ist, bleibt dessen Bedienung vorrangig.

Der Leser zeigt private Notizen und Vorlesetext getrennt, Ortsabschnitte in ihrer Reihenfolge, vollständige Kreaturdetails, Gegenstandsbeschreibungen mit Herkunft und Begegnungsteilnehmer. Benannte Weltverweise öffnen weitere Inhalte im selben Fenster. Zurück/Vorwärts halten einen Verlauf von Verweisen und lesen beim Wiederöffnen den aktuellen gespeicherten Stand. Der Verlauf ist vorläufig und wird beim Kampagnenwechsel gelöscht.

Eine Referenz lässt sich an den Szenentisch der ausdrücklich angezeigten Fokusgruppe anheften oder dort lösen. Vorlesetexte werden mit ihren vollständigen Bytes ausdrücklich in diese laufende Szene übernommen. Für Kreaturen wählst du Anzahl und gemeinsame/eigene Initiative; Begegnungen und Kreaturen öffnen den bestehenden Vorbereitungspfad am Spieltisch. Notiz-/Ortstexte lassen sich über ihre bestehenden Editoren bearbeiten. Lesen und Anheften führen keine Zeit-, XP- oder Lootbuchung aus. Eine schon freigegebene Szene folgt bei Textübernahme ihrem bestehenden Anzeigemodus; die Übernahme erteilt keine neue Spielerfreigabe.

### Desktopstand 0.61: Soundboard direkt am Spieltisch

Die laufende Szene hat ein Soundboard für Musik und Umgebungsgeräusche. „Soundboard“ im kleinen Player führt aus jedem Arbeitsbereich direkt zu einer bereits bestehenden Gruppe; ohne laufende Gruppe bleibt der ausdrückliche Einstieg am Spieltisch erforderlich. Es zeigt den bestehenden Playerstatus, schnellen Transport und gespeicherte Kampagnenfavoriten. Die lokale Bibliothek lässt sich nach Namen, Tags und Notizen durchsuchen; Favoriten und Suchseiten laden jeweils begrenzte Ausschnitte nach.

Ein Titel startet ausdrücklich, Songs lassen sich einzeln oder als gemeinsame Auswahl vormerken, und Umgebungsgeräusche lassen sich hinzufügen, entfernen oder gegen die Automatik unterdrücken. Die Warteschlange bleibt über denselben Owner sortierbar. Favoriten, Queue und manuelle Wahl werden in den bestehenden Musikdaten gespeichert und beim Campaign-Copy/Import mit ihren Medienreferenzen erhalten. Favoriten merken verändert keine Ausgabefreigabe.

Das Soundboard verwendet denselben LocalAudioPlayer und dessen manuelle Priorität wie der Musikbereich. Ein Stopp hält auch die Automatik an. Nach erneutem Öffnen bleibt die tatsächliche Ausgabe bis zum ausdrücklichen Start stumm. „Bibliothek und Musikbezug bearbeiten“ führt zu den vorhandenen Import-, Beschreibungs-, Lautstärke- und Szenenreglern. Die GM-Mappe kann dabei am Spieltisch geöffnet bleiben.

### Desktopstand 0.67: Übergabe an den nächsten Spielabend

Der Abschluss trennt den Rückblick auf das Geschehene von der Vorbereitung des nächsten Einstiegs. Aus laufenden Kämpfen und Verfolgungen, unverteilten Schätzen, fehlender XP-Abrechnung sowie der aktuellen Gruppe und ihrem Ort entsteht eine editierbare Übergabe. Der GM kann offene Punkte weiterhin direkt öffnen und danach in denselben Abschlussentwurf zurückkehren.

Rückblick und Übergabe werden gemeinsam mit dem bestätigten Endmarker gespeichert. Die letzte Übergabe bleibt am Spieltisch sichtbar, auch nachdem der nächste Abend begonnen hat. Chronik, Suche und Markdownausgabe führen sie als eigenen Abschnitt; ältere Marker ohne Übergabe bleiben unverändert lesbar.

### Desktopstand 0.68: Den nächsten Abend direkt aufnehmen

„Nächsten Abend vorbereiten…“ öffnet vor dem Start einen gemeinsamen Leitungsstand. Er zeigt die letzte gültige Übergabe, alle fortbestehenden Gruppen mit Besetzung und Weltzeit, laufende Kämpfe und Verfolgungen sowie unverteilte Beute. Offene Masken, Schatzverteilung und XP-Abrechnung führen direkt in ihre bestehenden Arbeitsbereiche.

Jede Gruppe kann den neuen Spielabend mit einem Klick als Fokusgruppe beginnen. Der Start verwendet weiterhin denselben bestätigten Session-Marker und Gruppenfokus; die Übersicht erzeugt keinen parallelen Sitzungs- oder Szenenstand. Kampagnenwechsel und Schließen entwerten laufende Leseanfragen, damit kein alter Leitungsstand in eine andere Kampagne hineinwirkt.

### Desktopstand 0.68: Dungeon-Binder am Spieltisch

Der Dungeon-Binder ist über Karte und Dungeon leiten erreichbar. Er durchsucht sämtliche Raum- und Vorlagentexte sowie platzierte Fallen/Inhalte, filtert Dungeon/Geschoss und zeigt GM-Key, Geheimnishinweise, Attribute, Verbindungen und bestehende Fallenstände. Raumlinks blättern im Binder; Reiseziel und Keybearbeitung führen in die bestehenden Besitzer. Die öffentliche Textvorschau ist eine GM-Lesehilfe, keine neue Spielerfreigabe. Lesen verändert weder Gruppenposition noch Uhr, Entdeckung, Charges, XP oder Beute.

Die Agenda (0.69) öffnet Kalenderereignisse und Fristen zur bestätigten Gruppenzeit. Relative Minuten-/Stunden-/Tages-/Wochenangaben und eine Datumswahl im bestehenden Fantasykalender ersetzen das Rechnen mit absoluten Tageszahlen. Wiederholungen, Such-/Ortsfilter, Countdowns und drei kommende Ereignisse am Spieltisch nutzen dieselben Kalenderereignisse. Speichern läuft über den bisherigen Weltbesitzer; relative Angaben prüfen zusätzlich Kalender- und Clockbasis. Lesen/Planen erzeugt keinen Zeitfortschritt, XP oder Beute.

### Desktopstand 0.70: Besuch und Auftrag in den Wiedereinstieg holen

Der Leitungsstand vor dem nächsten Spielabend liest nun für jede fortbestehende Gruppe den nächsten vorbereiteten Besuch und zeigt ihn neben Übergabe, Gruppen, Masken und Beute. „Vorschau öffnen“ wechselt zur richtigen Gruppe und führt in die vorhandene Besuchsübernahme; der Spielabend wird dadurch noch nicht begonnen.

Bis zu sechs offene Quests und Gerüchte sowie ihre Ortsbindung stehen ebenfalls im Leitungsstand. Das gemeinsame Auftragsjournal öffnet von dort mit seinem bestehenden Status-, Ergebnis- und Belohnungsablauf. Alle Reads sind an Kampagne und offenen Leitungsstand gebunden; Schließen oder Kampagnenwechsel verwirft verspätete Ergebnisse.

Der Zeitdialog (0.72) verbindet Warten nach Dauer, Fantasy-Datum, Kalenderereignisbeginn/-ende und nächstem Tagesbeginn mit derselben Live-Clock. Auch normale Live-Tagesangaben folgen dem Kampagnenkalender. Neue Zeitbelege halten ihre Kalender-Tageslänge fest, alte relative-v1-Belege behalten 24h. Ereignis-/Kalender-/Clock-/Fokusbasis wird bei Bestätigung geprüft; dieselben bisherigen Zeitfolgen bleiben zuständig. Wetterereignisse wandern jetzt ebenfalls pro Kampagnentag. Wartezeit erzeugt keine automatische Rastwirkung; Reisewege nach einem manuellen Zeitsprung bei Bedarf im Reisebereich neu planen.

### Desktopstand 0.71: Weltlage vor dem Spielabend

Der Leitungsstand liest für jede Gruppe zusätzlich den bestätigten Kampagnentag, den aktuellen Ort, Wetter und laufende Reise. Offene Weltentscheidungen sowie die nächsten drei ortsgebundenen Kalenderereignisse der kommenden zwei Tage stehen direkt bei der betroffenen Gruppe. Damit sind getrennte Gruppen mit unterschiedlicher Zeit und Position vor dem Start vergleichbar.

Reisekarte und Agenda öffnen aus derselben Gruppenkarte. Vorher wird die gewählte Gruppe über den bestehenden Fokusbesitzer aktiviert; Reise, Zeit, Wetter und Kalender bleiben unverändert, bis der GM in ihrem jeweiligen Arbeitsbereich ausdrücklich bestätigt. Der Spielabend beginnt weiterhin ausschließlich über „Spielabend hier beginnen“.

### Desktopstand 0.73: Lagerpause und Restreise

Die Reisevorschau zeigt einen Kalenderfahrplan mit Gelände, Wetter, benannten Stationen und GM-Halten für die ersten 40 Abschnitte sowie bis zu zwölf Ereignisse an Reiseorten. Die Gesamtroute bleibt vollständig. Pausieren / warten öffnet am Spieltisch den Zeitdialog, Pausieren / rasten die vorhandene Party-Rast; beide nutzen ihre bestehenden Schreiber und bewegen die Gruppe nicht.

Nach einer Pause oder veränderter Uhr, Gruppe, Karte, Kalender oder Wetter lässt sich der Restweg neu bewerten. Bereits zurückgelegte Abschnitte werden nicht erneut gereist; die verbleibende Hexfolge und das Ziel werden erhalten und am aktuellen Stand neu berechnet. Erst die ausdrückliche Annahme ersetzt die alte Reise, mit gespeichertem Bezug zur Vorgängerreise. Frühere Enddauer-Overrides werden nicht automatisch auf den Restweg übertragen. Eine außerhalb der Route versetzte Gruppe oder ein verschobenes Ziel benötigt eine neue Route. Die Vorschau enthält keine automatisch eingeplanten Rast- oder Begegnungswirkungen.

### Desktopstand 0.74: Die Eröffnung vor dem Start lesen

Der Leitungsstand zieht den nächsten vorbereiteten Besuch jeder Gruppe nun aus derselben GM-Spielabendmappe, die später am Tisch verwendet wird. Ort und vollständiger Eröffnungstext stehen direkt am Besuch; Zähler zeigen vorhandene GM-Hinweise, Referenzen, Begegnungsblöcke und Belohnungen. Fehlende oder archivierte Mappenquellen bleiben als konkrete Warnungen sichtbar.

„Übernahme prüfen“ führt weiter in die bestehende bestätigte Besuchsübernahme. „Mappe öffnen“ fokussiert die betroffene Gruppe, bindet den richtigen Plan an den Spieltisch und öffnet die Mappe direkt beim nächsten Besuch. Das Lesen startet keinen Spielabend, übernimmt keinen Besuch und gibt keinen Text an Spieler frei.

### Desktopstand 0.75: NSC-Dossiers und Gespräche am Spieltisch

NSCs am Spieltisch liest die Figuren am tatsächlichen Gruppenort, in der ganzen Kampagne oder ohne Ortsbindung in Seiten zu 50. Die Suche umfasst die vorhandenen NPC-Texte und Profile; nur die ausgewählte Figur lädt ihre vollständigen Texte. Das Dossier verbindet Verhalten, Aussehen, Vorlesetext, Gesprächsgeschichte, HP/Zustände, Fraktion, Beziehungen in beiden Richtungen, bestehende Gruppen und den bestätigten Autonomie-/Jobstand. Statblocks öffnen bei Bedarf.

Gespräch festhalten führt mit Kalenderdatum und Gruppe in den vorhandenen NPC-Profilentwurf. Angetippte Texte werden dort über den bestehenden Entwurfsschreiber gesichert; NPC übernehmen bestätigt sie. Profil, Autonomie, Gruppe, Vorlesetext und Begegnung öffnen ihre vorhandenen Besitzer. Keine neue NPC-Identität, kein zusätzlicher Profil-/HP-/Positionsstore und keine automatische Freigabe oder Kampfaktivierung. NPC-Listen verwenden beim Filtern einen begrenzten Seitenpuffer statt vollständiger Ergebnisarrays. Gruppen-/Beziehungs-/Verhaltensauszüge bleiben begrenzt, die Originalquellen erhalten.

### Desktopstand 0.76: Vom Leitungsstand direkt in die Eröffnung

Jeder vorbereitete Besuch bietet nun einen ausdrücklichen Startweg. „Spielabend beginnen + Text in Szene“ fokussiert die zugehörige Gruppe, schreibt den normalen Sitzungsmarker, übernimmt den vorbereiteten Eröffnungstext in die laufende Szene und öffnet die GM-Mappe direkt bei diesem Besuch. Fehlt ein Eröffnungstext, beginnt derselbe Ablauf mit der Mappe.

Besuchsübernahme, Spielerfreigabe und Audio bleiben weiterhin getrennte Bestätigungen. Der Start erzeugt weder Begegnung noch Belohnung und zeigt Spielern den Text nicht automatisch; der GM kann erst in der geöffneten Mappe prüfen und anschließend die vorhandenen Aktionen verwenden.

### Desktopstand 0.78: Zusammenhangsplan für die Kampagne

Zusammenhänge verbindet NSCs, Fraktionen, Quests, Gerüchte, Regeln und Orte in einer zoombaren, per Maus und Tastatur verschiebbaren Karte. Suche und 40er-Seiten liefern begrenzte Metadaten; nur die ausgewählte Quelle lädt ihre vollständige Prosa. Ein Fokus erweitert eingehende und ausgehende Beziehungen und liest bestehende NPC-/Fraktions-/Orts- und Auftragsbindungen. Abgeleitete Bindungen bleiben bei ihren bestehenden Besitzern. Karte und Verbindungen sind eine Sicht auf dieselben Kampagnenidentitäten.

Gerichtete Beziehungen lassen sich unmittelbar hinzufügen und lösen. Gültige Eingaben werden im bestehenden Notizentwurf gesichert; die ausdrückliche Bestätigung verwendet denselben Vorbereitungs-Schreiber, dieselben Receipts und Revisionen wie der World-Editor. Originaltexte und weitere Metadaten werden nicht ersetzt. Bei Konflikten bleiben Ziel und Beziehungsname erhalten; Statusprüfung und ausdrückliches Laden der aktuellen Basis ermöglichen die Fortsetzung. Neue Weltinhalte können direkt angelegt und in ihrem bestehenden Editor weiterbearbeitet werden. Der gezielte Schreibanschluss gibt nur die betroffene Quelle zurück, statt den gesamten Vorbereitungsbestand mitzuschicken. Kein zusätzlicher Beziehungs-, Orts-, NPC- oder Fraktionsstore.

### Desktopstand 0.77: Die nächste Übergabe aus dem Spielstand

Der Abschluss des Spielabends baut seinen Übergabevorschlag nun aus dem aktuellen Leitungsstand. Er verbindet Fokusgruppe und Ort mit dem nächsten vorbereiteten Besuch, einer laufenden Reise, den nächsten drei lokalen Fristen, bis zu vier offenen Aufträgen und Weltentscheidungen sowie den bereits geprüften Kämpfen, Verfolgungen, Beute- und XP-Punkten.

Der Vorschlag bleibt neben der editierbaren Übergabe sichtbar und lässt sich nach einer erneuten Prüfung ausdrücklich übernehmen. Nur der Text im Übergabefeld wird mit dem Endmarker gespeichert; die Vorschau verändert weder Besuch, Reise, Auftrag, Agenda noch andere Gruppenstände.

### Desktopstand 0.79: Kataloge im Zusammenhangsplan

Der Zusammenhangsplan erschließt zusätzlich Kreaturen, Gegenstände und Encounter-Vorlagen. Er folgt den vorhandenen Statblock-, Teilnehmer- und Belohnungsreferenzen in beide Richtungen: vom NSC zur Kreatur und ihren Begegnungen, vom Auftrag zur Gegenstandsquelle und zurück. Die Suche lädt jeweils höchstens 40 Metadaten; Einzeltexte und Katalogdetails erst bei Auswahl. Kampagneninhalte bleiben der anfängliche Suchbereich.

„Referenz lesen / am Spieltisch verwenden“ öffnet die bestehende Schnellsuche an genau dieser Quelle. „Katalog / Vorlage öffnen“ führt zum bestehenden Editor, inklusive Gegenstandsvergabe und Encounter-Vorbereitung. Die Schnellsuche führt umgekehrt zu den Zusammenhängen ihrer Quelle. Aktuelle Katalogdefinitionen und eingefrorene Vorlagen-/Belohnungsstände werden ausdrücklich bezeichnet; Graphnavigation ändert keine Zeit, Teilnehmer oder Belohnungen. Beziehungen zwischen Weltinhalten bleiben beim vorhandenen Notizschreiber.

### Desktopstand 0.80: Einen Einstieg auch ohne vorige Übernahme finden

Hat eine Gruppe noch keinen Besuch übernommen oder das Ende ihrer bisherigen Timeline erreicht, bleibt der Leitungsstand nicht mehr leer. Er prüft die vorhandenen Spielabendpläne in ihrer gespeicherten Reihenfolge und schlägt den ersten für diese Gruppe noch ungespielten oder wieder geöffneten Besuch vor. Abgeschlossene und übersprungene Besuche werden ausgelassen; Planname, Ort, Eröffnung und Mappeninhalt bleiben sichtbar.

Der Vorschlag verwendet dieselben Übernahme-, Mappen- und Startwege wie eine direkte Timeline-Fortsetzung. Er schreibt keine neue Planwahl und verändert keinen Besuchsstatus. Sind alle vorbereiteten Besuche erledigt, benennt der Leitungsstand diesen Zustand ausdrücklich; ohne Plan fordert er zur Vorbereitung eines Spielabendplans auf.

### Desktopstand 0.81: Textverweise und eigene Suchbegriffe

„Textverweis einfügen“ wählt eine Welt-/Katalogquelle, zeigt eine Vorschau und fügt ihren Verweis am Cursor oder an der Markierung der GM-Notiz ein. Eigene Anzeigenamen werden im Bereich „Verknüpfte Begriffe“ der Schnellsuche und des Zusammenhangsplans gefunden. Der Lesetext öffnet die Zielquelle, mit dem bestehenden Verlauf zurück zur Notiz. Umbenannte Ziele bleiben gebunden, nicht verfügbare Ziele bleiben kenntlich.

Verweise werden als Markdown `[Anzeigename](dungeon-ref:kind/URI-kodierte-ID)` im bestehenden Text gespeichert; gewöhnliches Markdown und Prosa werden nicht verändert. Aktuell werden je Dokument die ersten 200 Verweise für die begrenzten Such-/Navigationsprojektionen gelesen. Es gibt keinen zweiten Autoren- oder Aliasspeicher und keine neue Datenbankschemaversion. Unabhängige Kampagnenkopien/-importe binden lokale Ziele innerhalb dieser Syntax an ihre neuen IDs; installationsweite Katalogziele folgen der vorhandenen Definitionzuordnung. Auf Spielertexten erscheinen ausschließlich Anzeigenamen statt der internen Verweisadressen.

### Desktopstand 0.82: Gruppenbereitschaft vor dem Start

Der Leitungsstand zeigt für jede fortbestehende Gruppe die aktuellen Partywerte aller aktiven Figuren. Trefferpunkte, temporäre HP, Zustände, Konzentration und Todesrettungen stehen gemeinsam mit Level, Tagesbelastung und Rastbedarf direkt vor der Wahl der Startgruppe. Fehlende Werte, 0 HP, Tod oder Stabilisierung, Zustände und eine fällige Rast werden sichtbar hervorgehoben; eine leere Party bleibt ausdrücklich als leere Startgruppe erkennbar.

„Partywerte öffnen“ fokussiert die zugehörige Gruppe und führt zu den bestehenden Figurenständen am Spieltisch. „Rast planen…“ öffnet nach demselben Fokuswechsel die vorhandene Party-Rast. Die Übersicht selbst schreibt keine HP, XP, Zustände, Rastwirkung, Zeit oder Gruppenmitgliedschaft; Änderungen entstehen weiterhin erst durch die ausdrückliche Bestätigung im jeweiligen Besitzer.

### Desktopstand 0.83: Ortsmappe für Vorbereitung und Leitung

Die Ortsmappe liest geordnete Ortsabschnitte mit anklickbaren Textverweisen und verbindet sie mit den bestehenden NSCs, Aufträgen/Gerüchten, Figurengruppen und Shops am Ort. Verzeichnis und Materialseiten laden jeweils höchstens 40 Metadaten; Einzeltexte werden erst am gewählten Ort gelesen. Direkte Übergaben öffnen die vorhandenen Fachbereiche sowie gebundene Stadt-/Dungeonkarten. Ein ausdrücklich gewählter Abschnitt kann als Vorlesetext in die benannte Fokusgruppe übernommen werden; weitere Ortsnotizen bleiben beim Ort.

Der bestehende Ortseditor legt zusätzliche Abschnitte an, benennt sie um und ordnet sie neu. IDs, originale Markdownbytes, Karten- und Keybindungen bleiben bei diesen Aktionen erhalten. Textverweise werden am Cursor oder an einer Markierung eingefügt und verwenden den vorhandenen geschützten Ortsentwurf. Es gibt keinen zweiten Orts- oder Materialschreiber und keine Schemamigration.

### Desktopstand 0.84: Startbriefing pro Gruppe

Der Leitungsstand beginnt nun mit einem eigenen Startbriefing für jede fortbestehende Gruppe. Besetzung und Spielzeit, aktuelle Orts- und Wetterlage, Reise und lokale Fristen, kritische Partywerte, offene Weltentscheidungen, laufende Kämpfe oder Verfolgungen, ortsgebundene Aufträge und die vorbereitete Eröffnung stehen in einer aufklappbaren Karte zusammen. Eine knappe Zählung zeigt bereits vor dem Aufklappen, wie viele Punkte geprüft werden sollten; die aktuelle Fokusgruppe ist zuerst geöffnet.

Aus dem Briefing öffnet der GM nach sicherem Fokuswechsel die Ortsmappe oder Partywerte. Ein vorbereiteter Besuch kann den normalen Spielabend direkt mit Eröffnungstext und GM-Mappe beginnen; alternativ bleibt der reine Sitzungsstart verfügbar. Das Briefing liest nur vorhandene Besitzer. Es schreibt weder Party- noch Weltstand, übernimmt keinen Besuch und gibt keinen Text an Spieler frei, bevor der jeweilige bestehende Ablauf ausdrücklich bestätigt wird.


### 0.85 – Weltplanung aus der Ortsmappe

Fraktionen und Kalenderfristen stehen jetzt neben NSCs, Aufträgen, Gruppen und Shops in der Ortsmappe. Ortsquellen öffnen direkt die vorhandene Fraktions-/Tabellenzuordnung; Fraktionen führen zu Originalnotizen oder Haltung und Beständen. Neue Fristen übernehmen den gewählten Ort. Die bestehende Agenda zeigt gezielt ein Ereignis oder alle Fristen dieses Ortes, einschließlich vergangener Ereignisse, und führt nach dem Bearbeiten zurück zur Ortsmappe. Gruppenzeit, Reise und Bestände ändern sich nur über ihre eigenen ausdrücklichen Aktionen. Keine neue Datenhaltung oder Schemaänderung.

### Desktopstand 0.86: Die Spielabendmappe wird zur Ablaufspur

Die angedockte GM-Spielabendmappe führt aus ihren vorhandenen Blöcken direkt in die zuständigen Arbeitsabläufe. Ortsabschnitte öffnen die Ortsmappe, Weltverweise ihre Originalquelle, eine vorbereitete Figurengruppe erzeugt nach übernommener Besuchsszene den bestehenden Kampfentwurf, und eine Belohnung öffnet exakt diesen Besuch im vorhandenen Platzierungs- und Vergabeablauf.

Jeder Aktionsblock trägt die bestätigte Quellenkennung aus dem Paket statt Titel oder Freitext erneut aufzulösen. Die Begegnungsübergabe prüft weiterhin Fokus, Mitgliedschaft, Besuchsübernahme, Szenenort und aktuellen Gruppenstand. Lesen oder Quellen öffnen verändert nichts; Kampfvorbereitung, Besuchsübernahme, Textfreigabe, Beuteplatzierung und XP-Vergabe bleiben ihre getrennten ausdrücklichen Aktionen.


### 0.88 – Material direkt am Ort anlegen

Die Ortsmappe legt benannte NSCs, Aufträge, Gerüchte und Shops für den ausgewählten Ort an und öffnet danach ihren bestehenden Fachbereich. NSCs erhalten dieselbe Weltidentität im Profil und an ihrem Ort. Aufträge und Gerüchte starten offen mit Ortsbindung und ohne Belohnung; Shops gehören dem gewählten Ort und starten ohne Waren. Ein Rückweg führt zur ursprünglichen Ortsmappe. Alle Änderungen verwenden die vorhandenen Autoren-, Entwurfs- und Bestätigungswege; keine neue Datenhaltung und keine Änderung von Gruppenzeit, XP, Beute oder Verkäufen.

### Desktopstand 0.89: Regie und Chronik direkt aus der Mappe

Jeder Besuch der angedockten GM-Mappe besitzt nun eine offene Ablaufleiste für seine Eröffnung, Hinweise, Quellen, Begegnungen, Statblocks und Belohnungen. Auch lange Besuche springen damit ohne Scrollsuche zum gewünschten Abschnitt; die Ablaufleiste bleibt beim Lesen oben erreichbar.

Jeder Mappenblock kann außerdem als Chronikmoment vorgemerkt werden. Die Mappe öffnet dafür die vorhandene Momentaufnahme neben sich, übernimmt Kategorie, Überschrift und einen begrenzten Textauszug und bewahrt eine bereits begonnene Eingabe. Erst der GM ergänzt den tatsächlichen Ausgang und speichert ausdrücklich. Dadurch entstehen weder automatisch Chronikeinträge noch Quests oder Gerüchte, und vollständige Statblocks werden nicht unbemerkt in die Chronik kopiert.
