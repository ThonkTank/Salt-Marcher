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

Szenen- und Kampagnenwechsel entwerten alte Speicherantworten und Timer. Anlegen und Anheften behalten das beim Klick gewählte Ziel; später getippte Texte bleiben erhalten. [Editorprüfungen](tests/desktop-desk-owner-dom.test.mjs) decken diese Übergänge ab; [Storeprüfungen](tests/desktop-desk-search.test.mjs) prüfen wortgetreue Prosa und ursprüngliche Schreibrevisionen. Eine spätere fremde Revision wird nicht zur nächsten Schreibbasis. [Datenprüfungen](tests/desktop-desk-integrity.test.mjs) verhindern, dass beschädigte Pins, Revisionen oder Ortszuordnungen eine geprüfte Sicherung ersetzen; Kopien behalten unabhängig remappte Pins und unveränderte Prosa. Nicht mehr verfügbare Quellen bleiben erkennbar und lassen sich abheften.

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

Angefangene Eingaben bleiben als Entwurf erhalten, auch mit leeren Namen oder Mengen. „Schatzangaben übernehmen“ bestätigt gültige Änderungen. Vor Verschieben oder Zuweisen müssen offene Änderungen übernommen werden; „Gespeicherten Stand laden“ verwirft die offene Eingabe ausdrücklich. Datenbankformat 39 ergänzt Schatzentwürfe und übernimmt Kampagnenimporte aus den Formaten 33–38. [Speicherprüfungen](tests/desktop-treasury-integrity.test.mjs) sichern dieselben Mengen-, Referenz- und Revisionsregeln beim Schreiben, Lesen und Backup; rohe Texte und angefangene Zahlen bleiben erhalten. [Editorprüfungen](tests/desktop-treasury-owner-dom.test.mjs) sichern Kampagnenwechsel, verspätete Timer, Verwerfen und Folgeabfragen nach bestätigten Änderungen.

### Desktopstand 0.36: Monstergruppen als eigenständiger Weltinhalt

„Monstergruppen“ verwaltet vorbereitete Gruppen unabhängig vom Spielabendplan und von der aktiven Party. Eine Gruppe beginnt leer oder als eigene Kopie einer Encounter-Vorlage. Einzelne Kreaturen aus dem Katalog erhalten dauerhafte NPC-Identitäten; Name, HP, temporäre HP, Zustände, Konzentration, Vorlesetext und GM-Notizen lassen sich nachbearbeiten. Bestehende Figuren behalten ihre Identität und ihren Zustand beim Standortwechsel. Reine Textänderungen lassen ihre individuellen Aufenthaltsorte erhalten; nur eine Änderung des Gruppenorts versetzt alle verbliebenen Figuren.

Offene Eingaben werden als Rohentwurf gesichert, einschließlich leerer Namen und HP. „Gruppenangaben übernehmen“ bestätigt die Gruppe als dauerhaften Weltinhalt; sie ist danach nicht mehr an einen Planentwurf gebunden. „Aus Gruppe entfernen“ erhält die NPC-Figur und den bisherigen Verlauf. Die NPC-Notizen bleiben in der gemeinsamen Wissenssuche verfügbar. [Speicherprüfungen](tests/desktop-group-integrity.test.mjs) binden Gruppen, NPCs und Entwürfe an ihre IDs und Revisionen; alte Rohtexte bleiben auch bei später geänderten oder archivierten NPC-Profilen erhalten. [Editorprüfungen](tests/desktop-group-owner-dom.test.mjs) decken verspätete Antworten, Timer, Verwerfen und Navigation nach einem Commit ab.

Am aktuellen Szenenort erscheinen platzierte Gruppen. Die Spielleitung wählt einzelne verfügbare Figuren aus und bereitet daraus ausdrücklich eine Begegnung vor. Ankunft startet keinen Kampf. Mehrere offene Encounter-Masken je Scene verwenden den gemeinsamen Figurenstand; Einzelheiten stehen im folgenden Abschnitt. Gruppenänderungen erscheinen in der Kampagnenchronik. Datenbankformat 40 ergänzt Gruppenentwürfe und übernimmt Kampagnenimporte aus den Formaten 33–39.

### Desktopstand 0.37: Mehrere Encounter-Masken und freie Partywechsel

In derselben laufenden Scene können mehrere Begegnungen offen sein. „Weitere Begegnung“ bleibt verfügbar; der Begegnungswähler hält vorbereitete und laufende Masken vor abgeschlossenen Ergebnissen. Initiative, Runden, Notizen und Abschluss gehören weiterhin zur jeweils gewählten Begegnung. PCs und dauerhafte NPC-Figuren können in mehreren Masken gleichzeitig vorkommen; sie besitzen dabei einen gemeinsamen HP-/Zustandsstand. Änderungen in einer Maske werden in den anderen gespeichert und nach dem Wechsel sichtbar.

Ein Scene-Wechsel oder Deaktivieren entfernt die betroffenen PCs atomar aus allen offenen Encounter- und Chase-Masken. Die übrigen Teilnehmer und Maskenverläufe bleiben bestehen; die wechselnde Figur nimmt ihren aktuellen HP-/Zustandsstand mit. Eine Wiederholung desselben Auftrags entfernt niemanden erneut.

Rückgängig bleibt für Schritte der gewählten Begegnung verfügbar. Eine spätere Änderung gemeinsamer Werte in einer anderen Maske oder ein Partywechsel verwirft die älteren Rückgängig-Schritte der betroffenen Begegnung. Der Tracker zeigt den Grund, statt fremde spätere Änderungen zurückzuspulen oder verschobene Figuren wieder einzusetzen. Angefangene Werte-/Notizentwürfe bleiben erhalten und müssen bei inzwischen geändertem Stand abgeglichen werden. Datenbankformat 41 übernimmt den bisherigen aktiven Kampfstand als gemeinsame PC-Werte und ergänzt Importe der Formate 33–40.

### Desktopstand 0.38: Spielabendpläne ersetzen und wiederverwenden

„Plan ersetzen / wiederverwenden…“ bietet eine leere Timeline oder einen vorhandenen Plan als Vorlage. Die Vorschau zeigt die Besuchszahl vor und nach dem Wechsel; Planungsparty und Adventure Day lassen sich auf Wunsch aus der Vorlage übernehmen. Besuche erhalten neue Kennungen und übernehmen Reihenfolge, Ortsverweise, Notizen, Vorlesetexte und Wissensbezüge. Noch nicht angenommene Monstergruppen werden als unabhängige Entwürfe kopiert. Angenommene Gruppen und platzierte Schätze werden weiter referenziert; ihre Figuren, HP und Gegenstände werden nicht dupliziert. Bereits vergebene Besuchsbelohnungen bleiben abgeschlossen, offene Belohnungen erhalten eine neue Vorbereitungskennung.

Der Ersatz entfernt die bisherige Timeline, ihre Besuchsvorbereitung und die zugehörigen Session-Vorschläge. Angenommene Weltinhalte, globale Generatorquellen und bisherige Fakten bleiben erhalten. Gespeicherte, unbestätigte Gruppeneingaben bleiben beim Ersetzen, Löschen eines Besuchs oder Lösen einer Gruppe als unabhängige Monstergruppe erhalten. Laufende Scenes behalten ihren übernommenen Inhalt und die ursprüngliche Herkunft. Die Vorschau wird abgewiesen, wenn die betrachtete Vorbereitung zwischenzeitlich geändert wurde. „Timeline leeren“ benutzt dieselbe Ersetzung ohne Vorlage und behält den Plannamen sowie die bisherige Planungsparty. Der Vorgang erscheint im Weltverlauf und der Chronik. Datenbankformat 41 bleibt unverändert. Diese Datenhaltung prüfen die [Spielabend-Regressionen](tests/desktop-session-retention.test.mjs).

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
Kampagnenpakete behalten und remappen Quellen und Fraktions-/Ortsreferenzen. Unveränderte Weltvorschauen bleiben auch in unabhängigen Kopien übernehmbar; bereits veraltete Vorschauen bleiben gesperrt. Lesen und Sicherung prüfen Identitäten, Revisionen, Bestandswerte und kampagnengebundene Verknüpfungen.
Noch offen: direkte Weltfilter im Spielabend-Generator; der Encounter-Generator besitzt den vollständigen neuen Ablauf.

Die [Speicher- und Kopierprüfungen](tests/desktop-world-source-transfer.test.mjs) decken beschädigte Quellen, unveränderte Sicherungen, eigene Kennungen, archivierte Verknüpfungen, Vorschauübernahme und erneutes Öffnen ab. [Editorprüfungen](tests/desktop-world-source-ui.test.mjs) sichern sichtbare, ausdrücklich entfernbare Altverknüpfungen und erhaltene Bestandseingaben bei Hintergrundaktualisierungen.

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

[Speicherprüfungen](tests/desktop-npc-integrity.test.mjs) kontrollieren Profile, Entwürfe und Auftragsbelege beim Lesen und Sichern sowie eigene Kennungen und unveränderte Rohtexte nach Kopie und erneutem Öffnen. Veraltete oder archivierte Ausgangsprofile erhalten ihre offenen Entwürfe. [Editorprüfungen](tests/desktop-npc-owner-dom.test.mjs) decken Kampagnenwechsel, verspätete Antworten, Verwerfen während neuer Eingaben und doppelte Übernahme ab.

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
