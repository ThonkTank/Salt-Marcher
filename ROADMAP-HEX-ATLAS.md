# Roadmap: Hex-Atlas mit Wonderdraft-Parität und verbundenen Orts- und Dungeon-Keys

## Atlas auf einen Blick

**Ziel:** Welt → Region → Stadt → Haus → Dungeonraum durch Zoom erreichen und direkt bearbeiten; eine Kamera, eine Undo/Redo-Folge und gemeinsame haltbare Daten.

**Geprüfter Stand: 11.10.2026**, gemeinsamer Branch `active/installed-phase1`, Commit [6a90f3ee](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/commit/6a90f3ee2f50f0be45f0e256784576f13722c319). Der Atlas besitzt bereits einen benutzbaren Hex-/Ortskern und integrierte Stadt-/Dungeon-Teilabläufe. Der vollständige Zielablauf und E2E-01 bleiben offen.

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
| Landschaft, Gestaltung, Ausgabe | **Offen:** die vollständigen Atlasfunktionen aus HEX-09–27. Dungeonwerkzeuge sind dafür keine Atlasabnahme. | Ooke-Vorlagen, freie Küsten, Gewässer, Flüsse/Straßen, Symbole/Assets, Labels/Stile, Maße, Ausschnitte und PNG/JPEG. |
| Größe und Gesamtqualität | **Offen:** vollständige Endqualifikation. Kandidat PR154 besteht einen 5.000-Häuser-Datenlauf; die entsprechende Bedienprobe fehlt. | Großwelt/bedarfsgerechtes Laden, große Städte/Dungeons, Reaktionszeiten, Originalvergleiche, Tastatur/200 %, physische Bedienung und installierter Endbuild. |

### Wie kommen wir zum Ziel?

**Nutzerentscheidung vom 11.10.2026: Gleichwertig bedeutet „kann dasselbe erreichen“.** Für Wonderdraft, Dungeondraft, Canvas of Kings, Watabou und Fantasy Town Generator zählen fachliche Ergebnisse, gezielte Nachbearbeitung und dauerhafte Speicherung. Oberfläche, Gesten, Algorithmen und Grafik dürfen anders sein. Mehrere Originalaktionen können dieselbe eigene Werkzeugfamilie nachweisen; eigenständige Wirkungen dürfen dabei nicht verloren gehen. Ein Bild ersetzt keine geforderte editierbare Geometrie.

Die folgende Tabelle ist die **einzige Gesamtpriorisierung**. P0 → P1 → P2 → P3 → P4 ersetzt die bisherige starre HEX-/CITY-/Dungeon-Lieferreihenfolge. Phasenkennungen bleiben fachliche Referenzen, keine Reihenfolgenvorgabe. Innerhalb jeder Priorität werden die genannten Fähigkeiten von links nach rechts umgesetzt; bestehende Datenabhängigkeiten gehen vor. Bereits integrierte Fähigkeiten werden angeschlossen und geprüft, nicht neu gebaut. Ein teilweiser Ausbau schließt nicht die gesamte zugehörige Fachphase.

| Priorität | Nächstes nutzbares Ergebnis | Umsetzung und Abschluss |
| --- | --- | --- |
| **P0 – Verlässliche gemeinsame Bearbeitung** | Ort → vorhandener Dungeon → Raum/Key ändern → speichern → frisch wiederfinden. | Bestehende Atlas-, Stadt- und Dungeonquellen mit Kamera, Auswahl, Textfokus, Vorschau/Abbruch und gemeinsamer Undo/Redo-Folge absichern. Kritische Mehrdatei-/Speicherfehler erhalten offene Arbeit; Kennungen und Links bleiben stabil. Basis: HEX-01–05/07 und E2E-01. Der Kernablauf wird geprüft; vollständiger Import und breite Fehler-/OS-Abnahme bleiben ausdrücklich offene Fachfälle. |
| **P1 – Eine spielbare Region vorbereiten** | Eichenfurt am Fluss anlegen → Häuser vorschlagen und korrigieren → Taverne innen ausarbeiten → Alte Wacht verbinden → Bild ausgeben. | Freie Küste, Fluss/Straße, Orte/Keys; Siedlungsfläche/Platz und assistierte Bebauung mit Dichte/Größe/Variante. Gebäude, ausdrücklich angelegte Innenraumhülle, Räume/Wände/Türen, Geschosse und einfache Treppen; Wandumfang und horizontale Gesamtskalierung. Lokale Neuerzeugung schützt eigene Inhalte. Kalibrierte Vorlage, einfache Beschriftung, Messen und erster PNG-Export. Basis: CITY-01–04, HEX-09/10/11/13/14 sowie Grundfunktionen aus HEX-20/22/25 und räumlichem Dungeon. Abschluss: gesamtes Leitbeispiel einschließlich Neustart und geschützter Taverne. |
| **P2 – Alle drei Kartenarten gründlich bearbeiten** | Landschaft, Stadt und Dungeon ohne geometrische Sackgassen korrigieren und ausgestalten. | Alle Hexstufen mit geschützten Verfeinerungen, Seen/Höhen, Landschaftsauswahl/Kopieren; Viertel, Kreuzungen, Brücken, Befestigungen, Flächenfüllung und Verformung. Dungeonformen/Kurven, Höhlen, freie Wände/Fenster/Öffnungen, vollständige räumliche Wege/Durchgänge und Raumzuordnung. Dächer, Musterflächen, Texturpfade, Terrain-/Material-/Wasserpinsel und Licht. Auswahlfilter, Ebenen/Gruppen/Sperren, Farben, Symbol-/Streupinsel und vollständige Geschossbearbeitung. Basis: HEX-06/12/16–18/21/23, CITY-05, Verformungsanteil CITY-04, Gestaltungsanteil CITY-07 und zugehörige DD-/SMR-04-Fälle. Abschluss: jede Bearbeitungsfamilie mit gezielter Korrektur, Abbruch, Undo und Neuöffnung. |
| **P3 – Wiederverwenden, erzeugen und mit Leben füllen** | Größere Vorbereitungen durch Varianten, Vorlagen und zusammenhängende Inhalte beschleunigen. | Landmassen-/Dungeonerzeugung, Höhenkartenimport, erweiterte Stadtlayouts und gezielte Neuerzeugung. Pfad-/Flächenverteilung mit Objektvariation/Gruppen; Prefabs, Graphentwurf, Attribute und Inhaltsvorlagen. Bewohner/Haushalte/Berufe, Beziehungen/Familien, Fraktionen/Regierung/Religion; Waren/Preise, Öffnungszeiten, Ressourcen, Ereignisse/Favoriten. Tagesabläufe, Kalender, Wetter/Jahreszeiten aus bestehender gemeinsamer Weltzeit. Eigene Assets/Sets/Namenslisten und wiederverwendbare Vorgaben. Basis: HEX-15, Importanteil HEX-16, HEX-19, erweiterte CITY-02/04 sowie CITY-06/07 und zugehörige DD-/Dungeon-Autorenfälle. Abschluss: Vorschauen, Bindungen, Inhaltsschutz und deterministische Wiederaufnahme bestehen. |
| **P4 – Vollständige Gestaltung, Austausch und große Szenen** | Ausgearbeitete Welten präsentieren, umfassend ausgeben und in großer Ausdehnung bearbeiten. | Kartenstile/Effekte, Beschriftungsrahmen, Kompass/Maßstabsleisten und Ausschnitt-/Vorgabenverwaltung vervollständigen. Zusätzliche Ansichten einschließlich 3D-/Straßenansicht nach Fachbedarf; Renderoptionen, Bibliotheks-/Assetpaketfunktionen und externe Assetquellen. Bild-/Vektor-/Geometrie-/Inhalts-/VTT-Ausgabe nach den bestehenden Formatpflichten; vollständiger Import-/Recoveryanschluss. Großwelt, mehrere Städte/Dungeons, große Exporte und gemeinsame Endabnahme. Basis: HEX-08/22/24–28, CITY-08/09 und verbleibende DD-/Querschnittsfälle. Abschluss: vollständige Funktionsabdeckung, Größen-/Host-/Exportnachweise und getrennte Installations-/physische Abnahme. |

Jede Priorität liefert einen benutzbaren Zwischenstand. Lesbarkeit, Reaktionsfähigkeit und Bedarfsladen beginnen in P0/P1; vollständige Größenabnahme folgt in P4. Das zentrale [Werkzeugverzeichnis](#konkreter-werkzeugkatalog) ordnet den Zugang zu; `acceptance.json` bleibt das einzige Funktions- und Nachweisregister. Fachpläne enthalten ausschließlich ihre Details und verweisen auf diese Lieferfolge. Die [E2E-Abnahmen](docs/ROADMAP.md#lieferfolge-des-gesamtprodukts) behalten ihre fachlichen Voraussetzungen; offene Produktissues und PRs enthalten konkrete Befunde und Kandidaten.

Diese Übersicht ist ein datierter Einstieg. Bei relevanter Integration oder geänderter Lücke wird sie am bestehenden Ort aktualisiert; Laufchroniken und Abnahmedetails bleiben in ihren Fachquellen. Die folgenden Abschnitte führen Zielarchitektur, vollständige Anforderungen und Phasenzuordnung.

## Konkrete Nutzerabläufe

**Planungsstand: 11.10.2026.** Die folgenden Abläufe beschreiben das vereinbarte Zielverhalten, keine bereits vollständige Implementierung. Der [aktuelle Stand](#atlas-auf-einen-blick) bleibt davon getrennt. Leitbeispiel ist eine Region mit dem Dorf **Eichenfurt**, der Taverne **Zum Silbernen Ast** und dem Ruinendungeon **Alte Wacht**. Das Beispiel macht die Bedienung prüfbar; der vollständige Fachumfang der HEX-/CITY-Phasen und [Dungeonanforderungen](docs/SCOPE.md) bleibt erhalten.

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

Ich benenne beziehungsweise nummeriere Räume und ergänze Geheimdurchgang, Falle, Schatz oder einen Encounterverweis. Aus einer Notiz springe ich über einen Raumlink zur passenden Geometrie und zum Key. Später verschiebe, teile oder vereinige ich Räume.

**Sichtbares Ergebnis:** Raumidentität und Autoreninhalt werden durch eine Geometrieänderung nicht stillschweigend ersetzt. Nach einer Teilung oder Vereinigung bleibt jeder geschriebene Inhalt erhalten. Inhalte ohne eindeutiges Ziel erscheinen sichtbar als „Nicht zugeordnet“, bis ich sie ausdrücklich einem Raum zuweise. Verschieben erhält die Raumkennung und den vorhandenen Key.

#### 9. Die Planung nachträglich ändern

Ich verlege den regionalen Weg, korrigiere eine Dorfstraße und lasse einen ausgewählten Teil Eichenfurts neu bebauen. In der Vorschau sehe ich, welche Häuser betroffen sind. Manuell bearbeitete Häuser sowie Häuser mit Innenräumen, Keys oder Bindungen sind automatisch geschützt. Bei Bedarf gebe ich ein einzelnes Element ausdrücklich für den Ersatz frei.

**Sichtbares Ergebnis:** Die Taverne, ihre Räume und meine Texte bleiben erhalten. Regeneration ersetzt nur freigegebene Inhalte; eine Freigabe allein löscht nichts. Abbrechen verwirft die Vorschau. Vor einem Ersatz mit Inhaltsverlust muss die Zuordnung beziehungsweise Erhaltung der betroffenen Texte, Räume und Verweise geklärt sein. Undo stellt den gesamten vorherigen Stand wieder her.

#### 10. Speichern und später weiterarbeiten

Bestätigte Änderungen werden automatisch dauerhaft gespeichert. Ich sehe, ob Änderungen noch ausstehen, gespeichert sind oder ein Speicherfehler vorliegt. Ich schließe Obsidian vollständig, starte neu und finde Eichenfurt, die Taverne und die Alte Wacht samt Geometrie, Keys und Links wieder. Kamera und Auswahl werden wiederhergestellt, soweit das gespeicherte Ziel noch existiert.

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

Die [Prioritäten P0–P4](#wie-kommen-wir-zum-ziel) bestimmen die Umsetzung des Leitbeispiels. Die Erzählfolge ist der Nutzerweg, keine zusätzliche Lieferliste. Für Gebäude werden gemeinsames Objekt, Befehle und Übernahme vorhandener Daten vor Produktänderungen im [bestehenden technischen Stadtplan](ROADMAP-CITIES-IMPLEMENTATION-PLAN.md) konkretisiert; Kennungen, Texte, Maße und Links bleiben erhalten.

Die spätere Produktabnahme spielt das Beispiel in einem isolierten Obsidian-Testvault durch: Vorschauabbruch ohne Restdaten, Wandumfang gegenüber Gesamtskalierung, geschützte Regeneration, Raumteilung/-vereinigung ohne Textverlust, gemischte Undo/Redo-Folge, vollständiger Neustart, sichtbare Speicherfehler/externe Konflikte, Suche, stabile Links und Ausgabe. Bestehende Teilbelege bestätigen nur ihren bisherigen Umfang. Die Planungsänderung vergibt keinen PASS.

## Werkzeuge und Bediengefühl

**Planungsstand: 11.10.2026; vereinbartes Zielverhalten.** Dieser Katalog konkretisiert die [Nutzerabläufe](#konkrete-nutzerabläufe). Er beschreibt benötigte Werkzeuge und deren Bedienung, keine bereits vollständig implementierte Oberfläche. Der [aktuelle Stand](#atlas-auf-einen-blick), die vollständigen HEX-/CITY-/Dungeonanforderungen und deren Nachweisgrenzen bleiben getrennt.

Der Atlas soll sich wie ein Zeicheneditor anfühlen: Werkzeug wählen, Wirkung auf der Karte sehen, zeichnen und anschließend direkt korrigieren. Klar benannte Fachwerkzeuge sind direkt wählbar. Landschaft wird gepinselt; präzise Geometrie entsteht mit Klickpunkten und Rechteckziehen. Das Gefühl ist unmittelbar, nachvollziehbar und leicht korrigierbar.

### Gemeinsame Bedienung

Eine feste Werkzeugleiste gruppiert **Navigation, Landschaft, Stadt, Innenräume und Ausstattung**. Diese Gruppen ordnen die Werkzeuge und wechseln keinen Editor oder Kartenmodus. Zoom verändert weder Werkzeug noch dessen Einstellungen. Ein dauerhaftes Seitenpanel zeigt Werkzeugoptionen und Eigenschaften der Auswahl; Name und Key sind direkt erreichbar. Die Karte bleibt beim Bearbeiten sichtbar.

| Eingabe oder Zustand | Gemeinsames Verhalten |
| --- | --- |
| Vorschau vor der Änderung | Pinselradius, Verlauf, Kontur oder Platzierungsobjekt folgen dem Cursor. Die betroffene Geometrie und der räumliche Maßstab sind sichtbar. |
| Ziehen | Loslassen übernimmt eine gültige Änderung als einen Undo-Schritt. Eine ungültige Vorschau erzeugt keine Teiländerung. |
| Mehrpunktzeichnung | Klicks setzen Punkte; Enter oder „Fertig“ schließt ab. Backspace oder „Letzten Punkt entfernen“ nimmt den letzten Entwurfspunkt zurück. Escape oder „Abbrechen“ verwirft den Entwurf. |
| Vorübergehende Navigation | Leertaste und Ziehen verschieben die Ansicht. Ein ruhender Mehrpunktentwurf bleibt erhalten; danach wird mit demselben Werkzeug weitergearbeitet. |
| Nachträgliche Korrektur | Auswahl zeigt passende Punkte, Kanten und Griffe. Numerische Maße sind zusätzlich im Panel verfügbar. Ein begonnener Zug behält sein Ziel über Zoom-/Ladegrenzen. |
| Einrasten | Das Fangziel wird vor dem Setzen sichtbar. Rasterfang und Anschlussfang sind getrennte Einstellungen; geometrisch vorgeschriebene Raster bleiben verbindlich. |
| Fehler | Ungültige Vorschauen markieren die betroffene Stelle und zeigen einen kurzen Grund. Der bestätigte Stand bleibt erhalten. |
| Textfokus | Beim Schreiben bleiben Kartenkürzel gesperrt. Key-Eingabe verliert bei Navigation weder Text noch Fokus unbemerkt. |
| Umfangreiche Änderung | Erzeugung, umfangreicher Ersatz und Import erhalten eine ausdrückliche Vorschau mit Übernehmen und Abbrechen. Kleine gültige Änderungen benötigen keinen Bestätigungsdialog. |

Die [Ergebnisgleichwertigkeit](#wie-kommen-wir-zum-ziel) gilt für alle Vorbilder. Originalgesten werden als Referenzbeobachtung erhalten, aber nicht identisch nachgebaut. Wichtige Aktionen haben sichtbare Zugänge; Shortcuts dienen der Beschleunigung.

| Eingabe / Zugang | Eigenes Zielverhalten |
| --- | --- |
| Mausrad / Zoomanzeige | Mausrad zoomt am Cursor; Zoomanzeige bietet Einpassen und 100 %. Werkzeug und Entwurf bleiben erhalten. |
| Mehrfachauswahl | Shift-Klick ergänzt/entfernt ein Element; Rahmen/Lasso, Trefferliste und Typ-/Ebenenfilter machen überlagerte Geometrie erreichbar. |
| Kontur und Kurve | Kantenaktion „Punkt einfügen“, Punktgriff ziehen und „Punkt entfernen“ korrigieren die Kontur. Gerade/Kurve und Anschluss an vorhandene Verläufe sind sichtbare Optionen. |
| Löschen / Radieren | Delete oder „Entfernen“ betrifft die Auswahl. Der Radierer entfernt gezielte Inhalte; „Zur Vorgabe zurücksetzen“ entfernt ausschließlich Landschaftsüberschreibungen. Bei geschützten Inhalten gelten Erhaltung und Ersatzvorschau. |
| Kopieren / Transformation | Ctrl+C/Ctrl+V beziehungsweise sichtbare Aktionen kopieren mit eigenen Kennungen; Griffe und Zahlenfelder bewegen/drehen/skalieren, Aktionen spiegeln und ändern die Zeichenreihenfolge. |
| Werkzeuggröße und Varianten | Radius, Breite, Maßstab, Lichtreichweite und Variantenwahl sind im Panel sichtbar. Das Mausrad bleibt Zoom; keine versteckte Mehrfachbelegung ist für eine Fähigkeit erforderlich. |
| Farbe / Bibliothek | RGBA/Hex, Palette und Pipette sowie Suche, Kategorien/Tags, Sortierung und Paketwahl bleiben neben der Karte erreichbar. |
| Text und Kontext | Key-Felder verarbeiten Enter als Text; Beschriftungsfelder bieten mehrzeilige Eingabe und sichtbares Übernehmen. Kartenkürzel wirken nur bei Kartenfokus. Rechtsklick öffnet Kontextaktionen; er bestätigt oder verwirft keinen Entwurf heimlich. |

### Konkreter Werkzeugkatalog

| Werkzeugfamilie | So bediene ich sie | Wirkung und Rückmeldung | Ausbau |
| --- | --- | --- | --- |
| **Auswahl** | Anklicken, Shift-Klick, Rahmen oder Lasso; Trefferliste verwenden. | Passende Griffe; Filter nach Typ/Ebene, Gruppen, Sperren, Spiegeln, Kopieren und Anordnung. Landschaft lässt sich ebenfalls ausschneiden, verschieben und skalieren. | P0; vollständig P2 |
| **Hand** | Ansicht ziehen; vorübergehend Space-Ziehen. | Bewegt ausschließlich die Kamera; erhält Entwurf und Werkzeug. | P0 |
| **Geländepinsel** | Land/Wasser/Geländeart wählen und malen. | Freie Küsten innerhalb von Hexes; Radius/Maßstab sichtbar; geschützte feine Bearbeitung bleibt erhalten. | P1; alle Stufen P2 |
| **Zur Vorgabe zurücksetzen** | Über verfeinerte Landschaft malen. | Entfernt markierte Überschreibungen, erhält Orte/Gebäude/Keys. | P2 |
| **Radierer** | Zielart wählen und über Inhalte malen oder eine Teilfläche markieren. | Entfernt gezielt Landschaft, Symbole, Wasser oder Oberflächen; Wirkung vorab sichtbar und rücknehmbar. | P1; alle Zielarten P2 |
| **Höhenpinsel** | Anheben/Absenken und Stärke wählen. | Ändert native Landschaftshöhe; Vorschau zeigt Land-/Wasserwirkung. Höhenkartenimport ist eine getrennte Aktion. | P2 |
| **Fluss** | Punkte setzen; Breite/Kurven ändern. | Durchgehende Wasserfläche mit bearbeitbaren Punkten und Anschlüssen. | P1; Gestaltung P2 |
| **Straße** | Punkte setzen und Wege anschließen; Typ wählen. | Regionale Wege, Stadtstraßen/Gassen, Kreuzungen/Brücken mit sichtbaren Konflikten. | P1; vollständig P2 |
| **Ort** | Typ wählen und platzieren. | Dorf/Ruine/POI mit Name und Key; stabile Ortsbindung. | P0/P1 |
| **Siedlungsfläche / Platz / Viertel** | Rechteck/Ellipse ziehen, Polygon oder begrenzte Fläche füllen; Nutzung wählen. | Gebiet für Bebauung, freier Platz oder lokale Nutzung/Dichte. Zeichnen erzeugt keine Häuser. Hilfskanten begrenzen Füllung, ohne Straßen darzustellen. | Fläche/Platz P1; Viertel/Füllen P2 |
| **Gebäude** | Form zeichnen, Haus wählen und Griffe korrigieren. | Außenform, Wände, Innenräume/Geschosse/Dach gehören zu einem Objekt; Wandumfang und horizontale Gesamtskalierung sind getrennt. | P1; Formen P2 |
| **Gestaltungspinsel** | Zielgebäude markieren, Farbe/Höhe/Dachstil wählen und anwenden. | Ändert mehrere Häuser gezielt; bestehende Inhalte bleiben erhalten. | P2 |
| **Befestigung** | Mauerzug zeichnen; Tore/Türme setzen. | Sichtbare Anschlüsse an Straßen/Mauern; Änderungen erhalten verbundenen Plan. | P2 |
| **Raum / Wand** | Rechteck/Ellipse/Polygon beziehungsweise geraden/gekrümmten Wandzug zeichnen; Punkte/Kanten greifen. | Konsistente Grenzen; Ausschneiden, Verlängern, Teilung/Vereinigung und Zuordnungsaktionen erhalten Autoreninhalte. | Grundformen P1; vollständig P2 |
| **Verbindung** | Endpunkte/Wegpunkte, Typ und Querschnitt wählen. | Gang/Treppe/Schacht mit Höhenübergang, gültiger Vorschau und korrigierbaren Segmenten; Materialisierung als feste Geometrie. | Einfache Treppe P1; vollständig P2 |
| **Durchgang** | Tür/Fenster/Gitter/Öffnung/Geheimdurchgang wählen und gebunden oder frei setzen. | Breite/Ausrichtung und stabile Identität; Begehbarkeit, Sicht, Licht und Schall getrennt bearbeiten. | Tür P1; vollständig P2 |
| **Höhlenpinsel** | Graben oder Öffnung erzeugen; Radius wählen, radieren. | Höhlenfläche und Öffnungen mit getrennt bearbeitbarer Fels-/Bodengestaltung. | P2 |
| **Flächenpinsel / Musterfläche** | Terrain, Material, Wasser, Muster oder Hintergrund wählen; pinseln, Form zeichnen oder begrenzten Bereich füllen. | Textur-/Kachelsets, Mischung, Intensität, Schichten/Anordnung, Musterwinkel, Deckkraft und Wasserübergänge sind korrigierbar. | P2 |
| **Texturpfad** | Punkte/Kurven setzen, Textur/Breite/Übergang wählen. | Grafischer Pfad mit Schleife und Übergängen; erzeugt keine räumliche Gangverbindung. | P2 |
| **Dach** | Kontur oder schnelle Form wählen; Dachtyp und First bearbeiten. | Giebel/Walm/Gaube, Breite, Stil und Schattierung; ausgewählte Innengeometrie bleibt sichtbar. | P2 |
| **Licht** | Quelle platzieren; Reichweite, Stärke, Farbe und Schatten ändern. | Beleuchtungsvorschau und Lichtblockierung durch Geometrie; Umgebungslicht separat im Panel. | P2 |
| **Objekt / Symbolpinsel / Streuen** | Asset platzieren oder mit Dichte/Streuung/Varianten malen. | Griffe und Spiegeln; gezieltes Radieren. Mehrere Assets, zufällige Drehung/Größe und Einzelkorrektur bleiben möglich. Pfad-/Flächenverteilung folgt als Aktion. | Einzelobjekt P1; Pinsel/Streuen P2 |
| **Verformen** | Bereich/Ziel und Wirkung wählen, Vorschau ziehen. | Lokales Aufweiten, Zusammenziehen, Verschieben, Ausgleichen und Entspannen; globale Drehung gesondert. Messen ändert keine Geometrie. | P2 |
| **Beschriftung / Gebiet** | Text oder Grenze setzen; Format beziehungsweise Erscheinung wählen. | Mehrzeilige Namen und geografische/politische Grenzen; Ortsbindung optional, Namensvorschläge und Rahmen später. | Text P1; Gebiet/Format P2; Namen P3, Rahmen P4 |
| **Messen** | Anfang/Ende und Wegpunkte wählen. | Reale Entfernung aus gemeinsamem Weltmaßstab ohne Datenänderung. | P1 |

**Key-Bearbeitung ist kein eigener Kartenmodus:** Die Auswahl eines Ortes, Gebäudes, Raumes oder Features zeigt dessen Beschreibung im Panel. Der Katalog bündelt den Zugang zu den vereinbarten Funktionen und streicht keine Fähigkeiten aus den vollständigen Fachkatalogen.

### Aktionen am ausgewählten Objekt

Die folgenden Funktionen benötigen keine zusätzlichen Zeichenwerkzeuge:

| Aktion / Ansicht | Konkreter Ablauf | Ausbau |
| --- | --- | --- |
| **Bebauung erzeugen / lokal erneuern** | Fläche/Viertel → Dichte, Größen und Struktur → Variante in Vorschau → Übernehmen/Abbrechen. Manuell bearbeitete Häuser, Innenräume/Keys/Bindungen sind geschützt; Straßenänderung erzeugt nichts heimlich neu. Weitere Layout-/Bedarfs-/Anzahlvorgaben folgen. | P1; Varianten P3 |
| **Innenräume anlegen / übernehmen** | Gebäude → leere Hülle aus Außenform → Räume zeichnen. Bestehenden Grundriss ausdrücklich übernehmen; Maßstab und Referenzen prüfen. Zoom erzeugt nichts. | P1 |
| **Geschosse / Schnitte / Zuordnung** | Höhe/Schnitt wählen, Geschoss ergänzen; dann klonen, umbenennen, umordnen, löschen und vergleichen. Decken/einzelne Flächen auswählen; nach Raumteilung/-vereinigung nicht zugeordnete Inhalte sichtbar zuweisen. | Basis P1; vollständig P2 |
| **Objekte verteilen / gruppieren** | Pfad oder Fläche → Assetkategorien, Abstände/Dichte, Varianten und Höhenversatz → Vorschau → Übernehmen. Gruppen gemeinsam bewegen oder bewusst auflösen; Einzelkorrekturen erhalten. | P3 |
| **Land/Dungeon erzeugen / Höhenkarte importieren** | Zielbereich → Parameter/Seed oder Höhenbild → Vorschau → native Geometrie übernehmen. Gespeicherte Ergebnisse werden beim Laden nicht erneut erzeugt. | P3 |
| **Graph / Vorlagen / Inhalte** | Raumgraph oder Prefab-/Inhaltsvorlage wählen, räumlich ausarbeiten; Attribute/Features und Vererbung mit individuellen Abweichungen bearbeiten. Mehrfachänderungen erhalten eigene Inhalte; Fallen/Zustände und Dokumentausgabe bleiben an ihren Fachverträgen. | P3 |
| **Bewohner / Siedlungsdaten** | Personen, Haushalte, Berufe, Beziehungen/Familien und Fraktionen/Regierung/Religion bearbeiten, suchen und gesammelt in Vorschau ändern. Gebäudebedarf/Anzahl, Demografie, Waren/Preise, Öffnungszeiten, Unterorte/Ressourcen, Ereignisse und Favoriten sind benannte Panelaktionen. Gebäudedaten auf andere Geometrie übertragen erhält Bewohner und Verweise. | P3 |
| **Weltzeit / Aktivitäten / Wetter** | Bestehende Campaignzeit wählen → Aufenthalte, Tagespläne, Ruhetag-Override, Kalender, Jahreszeit und Wetter betrachten/korrigieren. Keine zweite Uhr. | P3 |
| **Bibliothek / Farben / Vorgaben** | Assets suchen/filtern, Pakete/Sets aktivieren oder deaktivieren, fehlende Assets sichtbar ersetzen und Farben über Palette/Pipette ändern; eigene Assets/Namenslisten importieren, Vorlagen und Prefabs verwalten. Assetpakete mit Metadaten, Tags und Lizenzangaben erstellen, externe Assetquellen aufnehmen. | Auswahl/Farben P2; eigene Inhalte P3; vollständige Paketfunktionen P4 |
| **Referenzbild** | Bild hinzufügen → bekannte Strecke kalibrieren → ausrichten → Deckkraft/Zeichenreihenfolge wählen → nachzeichnen; unabhängig ausblenden/entfernen. | P1; Verwaltung P2 |
| **Gestaltung / Ansichten** | Stil/Paletten/Texturen, Gebäudeabnutzung und Lichtvorgaben anwenden; Dach-/Viertel-/Favoritendarstellung wählen. Später Effekte, Rahmen, Kompass/Maßstabsleiste und zusätzliche 3D-/Straßenansicht verwenden; Rückkehr zeigt denselben Datenstand. | Fachgestaltung P2; vollständige Gestaltung/Ansichten P4 |
| **Ausschnitt / Ausgabe / Einstellungen** | Ausschnitt, Detailstufe und Raster wählen → Vorschau → exportieren. PNG zuerst; PNG/JPEG/WEBP/SVG, Geometrie-/Inhaltsdaten einschließlich JSON/GeoJSON/CSV, UniversalVTT und vereinbarte Integrationen nach ihren Formatpflichten. Später große Bilder, Geschoss-/Lichtüberlagerung und Ausgabevorgaben. Karteninformationen, Einheiten, Raster-/Snap-/Anzeige-/Kürzel-/Backupoptionen im gemeinsamen Einstellungszugang. | PNG P1; vollständig P4 |

### Gebäudegriffe und Bearbeitungsumfang

Ein Gebäude zeigt unterschiedliche Griffe für unterschiedliche Absichten:

- **Verschieben und Drehen:** Das ganze Gebäude folgt einschließlich seiner Innenräume. Maße bleiben erhalten.
- **Wand ziehen:** Der gewählte Wandabschnitt und angrenzende Raumgrenzen ändern sich gemeinsam im gewählten Bearbeitungsumfang.
- **Gebäude skalieren:** Die Grundrisse aller Geschosse samt Innengeometrie werden horizontal proportional verändert. Höhen und Geschossabstände bleiben erhalten.

Die beiden ausdrücklich wählbaren Wandumfänge, ihre räumliche Wirkung und der Default stehen verbindlich im [Gebäudevertrag](ROADMAP-CITIES.md#wandumfang-und-horizontale-gesamtskalierung). Vor dem Ziehen hebt Hover alle betroffenen Abschnitte hervor, etwa mit „betrifft drei Geschosse“. Der Umfang wechselt nicht automatisch beim Zoomen.

Beispiel: Ich ziehe die Küchenwand nach außen. Schon während des Zugs sehe ich die neue Raumfläche und alle mitbetroffenen Wände. Möchte ich stattdessen die gesamte Taverne vergrößern, benutze ich ausdrücklich den Skalierungsgriff.

### Spätere Bedienabnahme

| Probe im isolierten Testvault | Erwartetes Ergebnis |
| --- | --- |
| Region zeichnen → Straße setzen → Dorf bebauen → einzelnes Haus korrigieren | Fachwerkzeuge sind direkt auffindbar; Erzeugung folgt ausdrücklicher Übernahme und Einzelkorrekturen bleiben native Geometrie. |
| Innenraum anlegen → Räume zeichnen → Wand ändern → ganzes Gebäude skalieren | Gemeinsames Gebäude bleibt konsistent; Wandänderung betrifft den gewählten Umfang, Skalierung alle Grundrisse ohne Änderung der Höhen. |
| Beide Wandumfänge an gleichen Wandverläufen, Vorsprüngen und getrennten Teilen | Geschosswahl wirkt nur im gewählten Höhenbereich. Gemeinsam folgen nur übereinanderliegende Abschnitte desselben Verlaufs; andere Kanten bleiben erhalten. Hover und Vorschau zeigen genau die später betroffenen Teile. |
| Vorschau abbrechen und bestätigte Änderungen gemeinsam rücknehmen | Abbruch hinterlässt keine Restdaten; Undo/Redo erhält Geometrie, Kennungen, Keys und Referenzen. |
| Mit begonnenem Punktentwurf navigieren; zoomen und überlagerte Elemente auswählen | Entwurf und Werkzeug bleiben erhalten; die Trefferliste erlaubt eindeutige Auswahl. Ein laufender Zug wechselt sein Ziel nicht. |
| Key schreiben, Speicherfehler auslösen und vollständig neu starten | Kartenkürzel wirken nicht in Textfeldern, Fehler bleiben sichtbar und offene Arbeit erhalten. Erfolgreich gespeicherte Inhalte und Links sind wieder auffindbar. |
| P2: Höhle, Wasser/Material/Muster, Texturpfad, Dach und Licht bearbeiten | Jede Familie bietet Vorschau, gezielte Änderung/Radieren und Neuöffnung. Texturpfad ist keine Gangverbindung; Lichtblockierung entspricht der gewählten Geometrie. |
| P2: Punkt/Kurve, Landschaftsauswahl, Gruppen/Ebenen und Geschosse korrigieren | Einfügen/Entfernen, Kopieren, Sperren/Anordnung und Geschossklonen erhalten Daten/IDs/Bindungen; eigene Gesten sind auffindbar. |
| P3: Generator/Vorlage verwenden und Bewohner-/Gebäudedaten ändern | Erzeugung bleibt editierbar; Abbruch ohne Restdaten, Regeneration ohne Textverlust, eindeutige Inhaltszuordnung und gemeinsame Zeitquelle. |
| P4: Zusätzliche Ansicht und Bild-/Daten-/VTT-Ausgabe verwenden | Rückkehr erhält denselben bearbeitbaren Stand; Formatdaten, Ausschnitt, Maßstab, Licht und relevante Inhalte entsprechen der jeweiligen Ausgabeanforderung. |
| Maus, Touchpad, Tastatur und 200 % Darstellung | Werkzeuge, Griffe, Optionen und Abschluss-/Abbruchaktionen sind erreichbar; das Panel lässt die Karte bedienbar. |

Diese Proben sind geplante Produktabnahmen, keine mit der Dokumentation ausgeführten GUI-Tests oder neuen PASS-Einträge. Die konkreten Produkt-APIs, Speicherformate und bestehenden Quellbausteine werden durch diesen Werkzeugentwurf nicht geändert.

## 1. Ausgangspunkt und Zielbild

Der bestehende Dungeon-Editor liefert native Kartendateien, stabile Kennungen, strukturierte Raum-Keys, Undo/Redo, konfliktgeschütztes Speichern, Zeichenwerkzeuge, Assets und eine Spielansicht. Hex-Geometrie und gemeinsame Stadt-/Dungeonverortung sind inzwischen teilweise umgesetzt; vollständige mehrstufige Landschaftsbearbeitung und durchgehende Atlasqualifikation bleiben offen. Den geprüften Funktionsstand zeigt [Atlas auf einen Blick](#atlas-auf-einen-blick). Grundlage des vollständigen Ziels sind die vorhandene [Architektur](ARCHITECTURE.md) und der [Abnahmekatalog](acceptance.json).

Die lokal installierte Wonderdraft-Version ist **1.1.8.2**. Installationsdateien und offizielle Dokumentation wurden geprüft; eine vollständige direkte Bedienabnahme steht noch aus. Die dokumentierten Kernbereiche umfassen unter anderem Landmassen, Küsten, Flüsse, Straßen, Symbolpinsel, Gestaltungsvorlagen und Beschriftungen. [Wonderdraft](https://wonderdraft.net/), [offizieller Quick Guide](https://github.com/Megasploot/Wonderdraft/wiki/Quick-Guide).

Das vereinbarte Ziel:

- **Hexes tragen die Landschaftsdaten.** Innerhalb eines Hexes sind natürliche Küsten, weiche Übergänge und frei platzierte Details möglich.
- **Alle Hex-Stufen sind bearbeitbar.** Grobe Weltgestaltung lässt sich schrittweise verfeinern.
- **3 Meilen bilden die kleinste Hex-Stufe.** Darunter folgen Stadt- und Dungeonansichten mit ihrem eigenen Detailraster.
- **Overworld, Städte und Dungeons teilen einen räumlichen Atlas.** Lage, Orientierung, Maßstab und Eingänge verbinden die Karten.
- **Dungeondrafts „New Map“, Startgrößen und Größenvorlagen sind keine direkten Bedienvorbilder.** Die Welt besitzt eine einzige Atlaskarte; Dungeon-, Stadt- und Hexinhalte werden dort integriert.
- **Der Atlas ist grenzenlos und wächst mit seinem Inhalt.** Beim Anlegen werden weder Breite/Höhe noch ein Kartenrand verlangt. Landschaft, Städte und Dungeonplatzierungen können den bislang bearbeiteten Bereich in jede Richtung erweitern.
- **Räumliche Größen werden in Meilen oder Hex-Kacheln angegeben.** Das betrifft erzeugte Bereiche, Vorlagen und gewählte Ausschnitte; Hex-Anzahlen beziehen sich auf eine ausdrücklich benannte Hex-Stufe. Pixel bestimmen ausschließlich Darstellung und Bildausgabe.
- **Alle räumlichen Detailstufen sind allein durch Zoom erreichbar.** Welt → Region → Stadt → Haus → Dungeonraum bleibt an denselben Weltpositionen.
- **Es gibt keine separaten Modi.** Navigation und Bearbeitung bleiben in einem Editor mit gemeinsamer Kamera, Werkzeugleiste, Auswahl und durchgehender Undo/Redo-Folge. Zoom wechselt keine Editoroberfläche oder Bearbeitungsart.
- **Städte und POIs erhalten `.location`-Dateien**, deren Keys wie die heutigen Dungeon-Keys bearbeitet werden.
- **Stadtpläne werden nativ erzeugt und direkt bearbeitet.** Watabous Stadtgrundrisse und Canvas of Kings dienen als Ergebnisvorbilder; die Bedienung gestalten und prüfen wir eigenständig. Die [Stadtplan-Roadmap](ROADMAP-CITIES.md) ergänzt frühe nutzbare Phasen.
- **Alle Vorbilder werden nach erreichbaren Ergebnissen verglichen.** Eigene Werkzeuge und Gesten sind zulässig; bearbeitbare Wirkung, Korrektur und Speicherung zählen. Die verbindliche [Gleichwertigkeits- und Lieferregel](#wie-kommen-wir-zum-ziel) gilt auch für Wonderdraft und Dungeon.
- **Ooke-Welt und Ooke-Kontinent dienen als Bildvorlagen.** Neue Hex-Karten entstehen nativ.

Der vollständige Nutzerablauf lautet: Welt gestalten → Region verfeinern → 3-Meilen-Hex bearbeiten → in die Stadt zoomen und Straßen/Häuser ändern → in einen Hausgrundriss zoomen und Räume ändern → Orts-/Raum-Key bearbeiten → wieder herauszoomen. Alle Karteninhalte bleiben im selben Atlas direkt bearbeitbar.

## 2. Verbindliche Architektur

### Gemeinsamer Raum und Kartenformate

- **`.overworld`** enthält Weltmaßstab, Hex-Stufen, Landschaft, räumliche Platzierungen und Verweise auf Orte und Detailkarten. Große Datenbestände liegen in zugehörigen, bei Bedarf geladenen Dateien.
- **`.location`** enthält stabile Ortskennung, Name, Typ, geordnete Markdown-Abschnitte und Verknüpfungen zu Detailkarten. Lage und Ausrichtung werden im Atlas gespeichert.
- **`.city`** enthält native Stadtgeometrie mit Straßen, Vierteln, Grundstücken und Gebäuden sowie Generatorvorgaben und manuell bearbeiteten Elementen. Orts-Keys bleiben in `.location`; die Stadt verwendet die gemeinsame Zeichen- und Speicherbasis.
- **`.dungeon` bleibt das Dungeonformat.** Eigenständige Dungeons behalten ihre räumliche Platzierung. Ein Gebäude mit Innenräumen ist fachlich ein gemeinsam bearbeitetes Objekt; Außenform und Räume werden aus demselben konsistenten Gebäudezustand dargestellt. Raum-Keys und vorhandene Links behalten ihre Kennungen. Das konkrete Speicherformat für diesen Gebäudezustand ist vor Umsetzung festzulegen; die vorhandene getrennte Haus-/Dungeonbindung ist nicht bereits die vollständige Zielarchitektur.
- Weltpositionen werden intern in Metern geführt. Bestehende Dungeonfelder entsprechen weiterhin fünf Fuß. Verschiebung, Drehung und Maßstabsumrechnung verbinden die lokalen Kartenkoordinaten mit dem Atlas.
- Eingänge verknüpfen einen räumlichen Anker mit Dungeonkarte, Geschoss und gegebenenfalls Raum oder Durchgang. Ein Dungeon kann mehrere Eingänge besitzen.
- Geschosse bleiben getrennte Ebenen. Ihre bisherige Reihenfolge wird nicht automatisch als physische Höhe interpretiert.

Der Atlas erhält eine gemeinsame Kamera und einen durchgehenden Editor. Detailgeometrie wird abhängig von sichtbarer Größe und Ausschnitt geladen und bleibt unmittelbar bearbeitbar. Das Werkzeug und die direkt getroffene Geometrie bestimmen den Befehl und seine betroffenen Dokumente. Zoom verändert die sichtbare Detailtiefe; Werkzeug, Auswahl, Kamera und Historie bleiben erhalten. Es gibt keinen erforderlichen Karten-, Kontext- oder Moduswechsel.

Eine feste Atlasgröße entfällt. Die belegte Ausdehnung wird aus ausdrücklich bearbeiteten Landschaftsbereichen, Vorlagen und räumlich platzierten Stadt-/Dungeoninhalten abgeleitet. Sie dient der Übersicht und „Alles einpassen“, begrenzt jedoch keine Bearbeitung. Leere Hexes sind unmittelbar adressierbar; erst Bearbeitung belegt Datenbereiche. Pan und Zoom allein erzeugen keine Dateien oder Hex-Datensätze. Neue Inhalte erweitern die Ausdehnung mit derselben rücknehmbaren Änderung; die Kamera bleibt dabei an ihrem Ort. Lokale Dokumentgrenzen sind keine Atlasgrenzen. Alle Dokumente tragen zum gemeinsamen Raum bei, ohne ihn jeweils neu anzulegen.

### Hex-Stufen und Landschaft

Als Standard dienen **3, 9, 27, 81, 243, 729 und 2.187 Meilen**. Größere Stufen werden nach derselben Regel ergänzt, wenn Ausschnitt oder belegte Ausdehnung sie benötigen; eine festgelegte oberste Kartenbegrenzung gibt es nicht. Die Größenangabe bezeichnet den Abstand zwischen benachbarten Hex-Mittelpunkten. Zoom verändert weder Maßstab gespeicherter Geometrie noch räumliche Ausdehnung.

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

Die zehn bisherigen Etappen werden durch die folgenden **29 HEX-Phasen, HEX-00 bis HEX-28**, ersetzt und um **zehn Stadtphasen CITY-00 bis CITY-09** aus der [Stadtplan-Roadmap](ROADMAP-CITIES.md) ergänzt. Die Phasen beschreiben den vollständigen Zielumfang; sie sind keine Aussage, dass sämtliche Funktionen noch unimplementiert wären. Den integrierten Stand, Kandidaten und offenen Rest zeigt [die Übersicht](#atlas-auf-einen-blick). Die Kennungen und Fachanforderungen bleiben erhalten; die [Prioritäten P0–P4](#wie-kommen-wir-zum-ziel) bestimmen die Lieferung. Fachphasen dürfen in Grundfunktion und späteren vollständigen Ausbau geteilt werden. Jede Lieferung erweitert den zuvor geprüften Benutzerablauf. Die Architektur aus Abschnitt 2 bleibt das Ziel, ihre notwendigen Teile entstehen zusammen mit der jeweiligen Funktion.

### Funktions- und Datenerhalt

Jede Erweiterung erhält den vorhandenen bearbeitbaren Atlas, gemeinsame Kamera/History und stabile Kennungen. Originalwirkung und Hostablauf werden mit isolierten Daten geprüft; fehlende Paritätsbelege bleiben offen. Datenverlust, falsche Speicherung, verlorene Entwürfe und unterbrochene Kernabläufe müssen vor abhängigem Ausbau behoben sein.

### HEX-00 – Ausgangsbasis und gemeinsame Testregion

Vorhandene Referenzinventare, Quellstand und begrenzte Hostbelege verwenden. Fehlende fachliche Wirkungen anhand gleicher Nutzeraufgaben gezielt im Original klären, sobald sie für die nächste Lieferung benötigt werden. Die vollständige Inventur bleibt offen nachgeführt; sämtliche Originalgesten, Regler und Helfermodule erneut zu erfassen ist keine Voraussetzung für einen benutzbaren Ausbau. Bestehende HEX-00-A/B/C-Belege bleiben historische Referenzläufe.

Die gemeinsame Testregion wächst mit P0–P4. Originalversion, Aufgabe, erreichbare Wirkung und offene Frage werden im vorhandenen Register festgehalten. Identische Eingaben, Reglerwerte oder Algorithmen sind kein Ziel; unbekannte fachliche Wirkung bleibt offen.

### Meilenstein A – Eine Hexkarte tatsächlich bearbeiten

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im echten Obsidian |
|---|---|---|
| **HEX-01 – Atlas anlegen und öffnen** | Grenzenlose `.overworld` anlegen, benennen und öffnen, ohne Größenabfrage. 3-Meilen-Hexes anzeigen, ein Hex treffen und seine Adresse zeigen; verschieben, zoomen und belegte Inhalte einpassen. Ausrichtung, Weltmaßstab und Weltkoordinaten von Anfang an speichern. | Leeren Atlas öffnen, Hexes auf beiden Seiten des Ursprungs und außerhalb des ersten Ausschnitts anklicken. Pan/Zoom belegen keine Landschaftsdaten. Nach frischem Start stimmen Kennung und Adressen; ein bestehender Dungeon öffnet weiterhin. |
| **HEX-02 – Gelände malen und erhalten** | Land, Meer und einfacher Geländetyp per Klick und zusammenhängendem Pinselzug setzen; lokale Bearbeitung zurücksetzen; Undo/Redo, explizites Speichern und dauerhafte Entwürfe anbieten. Nur bearbeitete Hexes werden als spärlich belegte, getrennt ladbare Bereiche gespeichert; Inhalt erweitert die gemeinsame Ausdehnung automatisch. | Kleine Insel zeichnen und jenseits ihres bisherigen Bereichs weiterzeichnen, auch in negativen Koordinaten. Wachstum verlangt keine Resize-Aktion und verschiebt nichts. Abbruch, Undo/Redo, Speichern, Neuöffnung und Entwurfswiederherstellung erhalten Inhalt und daraus abgeleitete Ausdehnung. |

**Nach HEX-02 steht der erste benutzbare Hex-Editor bereit.** Sein Testbuild enthält einen vollständigen Bearbeitungs- und Speicherablauf; weitere Kartengestaltung folgt auf dieser Grundlage.

### Meilenstein B – Hex → Ort → Dungeon → Raum-Key → zurück

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im echten Obsidian |
|---|---|---|
| **HEX-03 – Stadt und POI mit Key** | Stadt oder POI an einer Weltposition anlegen. `.location` mit stabiler Kennung und zwei frei bearbeitbaren Markdown-Abschnitten öffnen, Abschnitte ordnen und direkt verlinken. Anlage von Ort und Atlasplatzierung gemeinsam rücknehmen und mit einem wiederherstellbaren Speicherjournal für die beteiligten Dateien speichern. | Ort anklicken, Text rechts bearbeiten, Abschnittslink öffnen und Ort verschieben. Undo/Redo und frischer Start erhalten Wortlaut, Abschnittskennungen und Position. Abbruch und unterbrochene Anlage hinterlassen nach Wiederherstellung keinen verwaisten Ortsverweis. |
| **HEX-04 – Einen Dungeon verorten** | Bestehende `.dungeon`-Karte über ihre Kennung am Ort platzieren. Einen lokalen Eingangsanker wählen; Weltposition, Drehung, tatsächlichen Maßstab und Kartenumriss darstellen. | Bekannte Dungeonkontur platzieren und drehen. Lokaler Eingangsanker und Weltanker stimmen überein; Rücknahme und Neuöffnung erhalten die Bindung. Die Quelldatei des Dungeons bleibt unverändert. |
| **HEX-05 – Dungeon direkt im Atlas bearbeiten** | Beim Hineinzoomen verortete Dungeon-Geometrie im selben Atlas anzeigen, Raum und Key unmittelbar bearbeiten und durch Herauszoomen zur Region gelangen. Welt-/Lokalkoordinaten werden über die Platzierung umgerechnet. Zunächst werden eine Dungeonkarte und ihre Umgebung gemeinsam sichtbar und bearbeitbar. | Nur zoomen, Hex und Dungeonraum ändern, Key bearbeiten und herauszoomen. Keine Öffnen-/Betreten-/Modusaktion; Werkzeug, Auswahl, Lage, Maßstab und durchgehendes Undo/Redo bleiben korrekt. Speichern und frischer Start erhalten dieselbe Folge. |

**Nach HEX-05 ist der erste zusammenhängende Spielablauf benutzbar.** Der zugehörige Build wird mit der gemeinsamen Testregion bereitgestellt. Mehrere gleichzeitig sichtbare Detailkarten folgen in HEX-22; die erste räumliche Verbindung und Navigation sind bereits hier prüfbar.

### Frühe Stadtphasen im selben Atlas

CITY-01–04 liefern den Stadt-/Gebäudeanteil von P1. Sie bauen auf dem verlässlichen gemeinsamen Anschluss aus P0 auf; Küste, Fluss, Straße, einfache Beschriftung und erste Ausgabe werden für das Leitbeispiel gemeinsam ergänzt. Die [Priorisierung](#wie-kommen-wir-zum-ziel) ersetzt feste Einschübe zwischen HEX-Nummern. CITY-05–09 behalten ihren vollständigen Fachumfang in P2–P4.

### Meilenstein C – Weltmaßstab, eigene Vorlage und erste Ausgabe

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im echten Obsidian |
|---|---|---|
| **HEX-06 – Alle Hex-Stufen bearbeiten** | Standardstufen von 3 bis 2.187 Meilen und erforderliche größere Stufen anbieten. Manuelle Stufenwahl und automatischer Wechsel mit Übergangsbereich; grobe Vorgaben, feine Überschreibungen und Zurücksetzen verbinden. | Auf 27 Meilen Land setzen, auf 3 Meilen eine Küste verfeinern, grobe Vorgabe ändern und ein feines Detail zurücksetzen. Alle Stufen, Ortspositionen, Übersicht und Neuöffnung zeigen den jeweils richtigen Zustand. |
| **HEX-07 – Verbundene Änderungen sicher erhalten** | Externe Änderungen, unterbrochene Mehrdatei-Speicherung, Wiederherstellung und direkte Links nach Umbenennungen ausdrücklich absichern. Vorhandene Dungeonbearbeitung aus dem verknüpften Arbeitsablauf nutzen. | Orts-Key ändern und Platzierung verschieben; Speicherunterbrechung zwischen zwei Dateien und externe Änderung im Testvault auslösen. Ein lesbarer, konsistenter Stand wird wiederhergestellt oder ein Konflikt gemeldet. Orts- und Raumlinks funktionieren nach Umbenennung. |
| **HEX-08 – Große Welt zuerst grob öffnen** | Atlas mit erdgroßer belegter Ausdehnung zunächst in grober Stufe öffnen; nur sichtbare Detailbereiche laden, Anfragen beim Weiterzoomen verwerfen und ungenutzte Ressourcen freigeben. Fortschreitend größere und weiter entfernte Inhaltsbereiche prüfen. | In einem belegten Bereich von 40.000 × 20.000 km zwischen entfernten Orten wechseln und darüber hinaus neue Inhalte setzen. Grobe Übersicht erscheint vor Detaildaten; Rückkehr zeigt gespeicherte Bearbeitung. Speichern, Undo und der Ort-Dungeon-Ablauf bleiben bedienbar. |
| **HEX-09 – Ooke als Nachzeichenvorlage** | Zunächst ein exportiertes Ooke-Bild laden, anhand zweier Referenzpunkte maßstäblich ausrichten und die Deckkraft ändern. Danach dieselbe Funktion für die zweite Ooke-Karte nutzen. Vorlagen sind separate Referenzassets. | Bekannte Küste und Ort nachzeichnen, Stufen wechseln und neu öffnen. Vorlage und native Landschaft bleiben ausgerichtet; die Referenz lässt sich ausblenden. Originale Wonderdraft-Dateien bleiben erhalten. |
| **HEX-10 – Erstes teilbares Kartenbild** | PNG des gewählten Welt- oder Regionsausschnitts ausgeben, Raster ein- oder ausschalten und eine Ausgabe bis 2.048 Pixel Kantenlänge anbieten. Export nutzt den gespeicherten Kartenstand und den gewählten Ausschnitt. | Testregion mit Ortsnamen exportieren und das Bild visuell öffnen. Ausschnitt und Maßstab stimmen auch bei verschobener Editorkamera; Rasteroption wirkt. Dies belegt noch keine 8.192-Pixel-Ausgabe. |

**Nach HEX-10 lässt sich eine mehrstufige Welt mit eigenen Vorlagen bearbeiten, mit Keys und Dungeon verwenden und als erstes Kartenbild teilen.** Fehler- und Größenprüfungen begleiten diesen Stand bereits.

### Meilenstein D – Eine natürliche Landschaft zeichnen

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im echten Obsidian |
|---|---|---|
| **HEX-11 – Küsten innerhalb von Hexes** | Land und Wasser auch innerhalb eines Hexes mit einem freien Pinsel bearbeiten. Zusammenhängende Küsten und weiche Übergänge darstellen; Änderungen bleiben in den betroffenen Hex-Bereichen verankert. | Eine Bucht und schmale Landzunge über mehrere Hex- und Ladegrenzen zeichnen. Zoomen, Undo/Redo, Neuöffnung und PNG-Ausgabe erhalten Verlauf und Anschlüsse ohne Naht. |
| **HEX-12 – Seen und Wasser gestalten** | See beziehungsweise Süßwasserfläche anlegen und radieren; Wasserfarbe und die für diesen Ablauf gemessenen Erscheinungsoptionen bearbeiten. | See innerhalb einer Insel zeichnen, einen Teil entfernen und Erscheinung ändern. Rücknahme, Neuöffnung und Export erhalten die Fläche; das angrenzende Land und die Ortspositionen stimmen. |
| **HEX-13 – Einen Fluss durchgehend zeichnen** | Fluss anlegen, mit der gemeinsamen Bedienung beenden oder abbrechen, Punkte ändern und Breite wählen. Durchgehende Geometrie über Hexes und Stufen sichern. | Fluss vom Gebirge bis ins Meer ziehen, einen Punkt verschieben und Breite ändern. Abbruch erzeugt keinen halben Fluss; Übergänge, Undo und frische Öffnung stimmen. |
| **HEX-14 – Orte mit Straßen verbinden** | Straße beziehungsweise Pfad zwischen Orten zeichnen, Punkte und Kurven bearbeiten und Stil wählen. Erreichbare Wegformen und einfache Stilvarianten prüfen. | Stadt, POI und Dungeon durch Wege verbinden. Einen Verlauf ändern; Verbindungen, Orts-Keys, Flussquerung und Ausgabe bleiben nach Neuöffnung an der richtigen Stelle. |
| **HEX-15 – Landmassen erzeugen** | Die erste Original-Generatorfamilie mit ihren gemessenen Parametern und reproduzierbarem Ausgangswert anbieten; weitere katalogisierte Muster im begrenzten Generator-Nachbesserungslauf ergänzen. Erzeugung rücknehmbar in die Landschaftsvorgaben übernehmen. | Zwei reproduzierbare Ausgangswelten erzeugen und eine davon weiterbearbeiten. Eine erneute grobe Erzeugung erhält vorhandene feine Überschreibungen und Orte; Rücknahme und Neustart erhalten den richtigen Stand. |
| **HEX-16 – Heightmap und Geländehöhe** | Heightmap als eigenes Eingangsmaterial übernehmen und Landmassen anheben beziehungsweise absenken. Die Übernahme erzeugt native, anschließend bearbeitbare Landschaftsvorgaben. | Kleine bekannte Heightmap übernehmen, Inselhöhe verändern und einen Küstenabschnitt von Hand ändern. Speicherung, Rücknahme und Neuöffnung erhalten die native Bearbeitbarkeit und räumliche Ausrichtung. |

Nach jeder neuen Landschaftsfunktion wird derselbe Insel-Ort-Dungeon-Ablauf erneut durchgespielt. Stil- oder Shaderänderungen müssen dabei auch den zuvor erzeugten PNG-Ausschnitt bestehen.

### Meilenstein E – Die Karte lesbar ausarbeiten

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im echten Obsidian |
|---|---|---|
| **HEX-17 – Ein Symbol auswählen und setzen** | Ein Symbol aus einer kleinen Bibliothek auswählen, Vorschau zeigen, platzieren, auswählen, skalieren, drehen, spiegeln, duplizieren, anordnen und entfernen. Gemeinsame Platzierungs- und Korrekturaktionen verwenden. | Berg, Baum und Siedlung setzen; überlappende Symbole bearbeiten. Jeweils Karte und Trefferreihenfolge prüfen; Undo/Redo und Neustart erhalten Position, Maßstab und Ordnung. |
| **HEX-18 – Wälder und Gebirge pinseln** | Gruppenpinsel mit Dichte, Streuung und Varianten für Bäume und Berge; Radieren und rücknehmbare zusammenhängende Pinselzüge. | Wald über mehrere Hexes malen, Teilbereich radieren und einen ganzen Zug rücknehmen. Eine gebirgige Region bleibt bei Stufenwechsel, Export und Neuöffnung vollständig und bedienbar. |
| **HEX-19 – Eigene Assets und Bibliothek** | Eigene Symbolsets aufnehmen; passende Farbmodi, Suche, Paketwahl, erneutes Laden und Fehlasset-Platzhalter ergänzen. Nur benötigte Vorschauen dekodieren. | Eigenes Set einsetzen, Farbe bearbeiten, neu laden und ein Asset im Testset fehlen lassen. Bestehende Instanz bleibt erhalten; Bibliothek, Ortsnavigation und Neustart funktionieren mit großem Katalog. |
| **HEX-20 – Namen und Beschriftungen** | Freie Beschriftung, Format- und Schriftvorgaben, Drehung, mehrzeilige Texte, Name-Vorschläge und gemeinsame Text- und Platzierungsaktionen ergänzen. Ortsgebundene Namen übernehmen die zugehörige Ortskennung. | Stadt umbenennen, Fluss beschriften, mehrzeiligen Titel setzen und bei verschiedenen Zoomstufen lesen. Ortslink, Abschnittslink, Formatierung und Export bleiben nach Neuöffnung korrekt. |
| **HEX-21 – Gebiete und Grenzen** | Politische und geografische Gebiete anlegen, Grenze und Erscheinung bearbeiten und mit einem Orts-Key verknüpfen. Gebiete benutzen dieselben Weltkoordinaten wie Landschaft und Orte. | Zwei Gebiete über mehrere Hexes zeichnen, gemeinsame Grenze ändern und den Regions-Key öffnen. Grobe und feine Ansicht, Links, Undo und PNG zeigen denselben Grenzverlauf. |

### Meilenstein F – Mehrere Detailkarten im gemeinsamen Raum

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im echten Obsidian |
|---|---|---|
| **HEX-22 – Stadt und mehrere Dungeons im Atlas** | Mehrere Detailkarten abhängig von sichtbarer Größe mit Vorschau und vollständiger Geometrie darstellen. Stadt aus CITY-03, zwei Gebäudeinnenräume sowie eigenständige Orts-Dungeons und mehrere Eingänge räumlich verbinden; alle sichtbaren Geometrien im selben Editor direkt bearbeitbar halten. | Ausschließlich von Welt zu Stadt und zwei Hausgrundrissen hinein-/herauszoomen; Straßen, Räume und Keys ohne Kontextwechsel mit gemeinsamer Undo-Folge bearbeiten. Nach Save/Neustart stimmen Lage, gültige Auswahl und Eingangszielpunkte; eine über Neustarts fortgesetzte Undo-Historie ist nicht vorausgesetzt. Außer Sicht liegende Ressourcen werden freigegeben. |

Diese Phase erweitert den seit HEX-05 funktionierenden Übergang. Ihr Review prüft zusätzlich mehrere benachbarte und überlappende Karten sowie den Erhalt der ersten Ein-Karten-Folge.

### Meilenstein G – Verbleibende Wonderdraft-Werkzeugfamilien vervollständigen

| Phase | Nutzbarer Ablauf und begrenzter Umfang | Praxistest im echten Obsidian |
|---|---|---|
| **HEX-23 – Landmassenausschnitt bearbeiten** | Lasso, Flächenauswahl, Ausschneiden, Kopieren, Einfügen, Verschieben und Größenänderung für Landschaft mit eigener Bedienung und gleichwertiger bearbeitbarer Wirkung anbieten. Betroffene Landschaftsdaten ändern sich als zusammengehöriger Befehl. | Inselteil auswählen, kopieren, verschieben und rücknehmen. Land, Süßwasser und andere laut Original mitbewegte Bestandteile prüfen; bestehende Ortsbindungen, gespeicherte Vorgaben und Neuöffnung bleiben konsistent. |
| **HEX-24 – Gestaltungsvorlagen und Effekte** | Kartenweite Vorlagen, Texturen, Paletten und die katalogisierten Erscheinungseffekte ergänzen. Geometrie und Key-Inhalte bleiben eigenständige Daten. | Auf derselben Testregion mehrere Vorlagen und Effekte anwenden. Beschriftungen, Wasser und Symbole bleiben lesbar; Raum- und Orts-Keys unverändert. Editor und PNG zeigen dieselbe Gestaltung. |
| **HEX-25 – Rahmen, Kompass und Maße** | Rahmen, Kompassrose, Maßstabsleiste und Messwerkzeuge mit gleichwertiger Wirkung ergänzen. Größen und Entfernungen aus dem gemeinsamen Weltmaßstab ableiten. | Bekannte Strecke zwischen Orten messen und eine Maßstabsleiste setzen. Welt-, Regions- und Dungeonmaßstab, Rahmen, Undo, Neuöffnung und Export stimmen. |
| **HEX-26 – Ausschnitte und Vorgaben** | Benannte Welt-/Regionsausschnitte in Meilen oder Hex-Kacheln verwalten; relevante Vorgaben, Rasteroptionen, Tastenkürzel und Vorlagen-Zeichenreihenfolge vervollständigen. Wonderdrafts endliche Karten-/Detailgrößen werden ausdrücklich auf Ausschnitte im grenzenlosen gemeinsamen Atlas abgebildet. Verfeinern benötigt keine separate Detailkarte oder Bearbeitungsansicht. | Ausschnitt vergrößern/verkleinern, Vorgaben ändern und neu öffnen. Inhalte außerhalb des Ausschnitts bleiben erhalten und direkt erreichbar. Landschaft, Stadt und Dungeon behalten Weltposition, Links und gemeinsame Bearbeitung; Ausschnittsänderungen sind rücknehmbar. |
| **HEX-27 – Vollständige Bildausgabe** | PNG/JPEG, Ausschnitt, gewählte Detailstufe, Raster, Gestaltung und Ausgabegröße bis mindestens 8.192 × 8.192 Pixel vollständig anbieten. Große Bilder werden ohne vollständiges Laden aller Welt-Detaildaten ausgegeben. | Region und Welt in beiden Formaten ausgeben, darunter ein 8.192-Pixel-Bild. Bild öffnen und gezielte Details prüfen; laufende Bearbeitung, gespeicherter Stand und Ergebnis hängen nicht von der Editorkamera ab. |

Vor jeder Lieferung müssen ihre fachlichen Ergebnisse und Datenabhängigkeiten eindeutig sein; vorhandene Originalbelege werden verwendet und unklare Wirkungen gezielt ergänzt. Die eigene Umsetzung wird anhand derselben Aufgaben auf benanntem Build geprüft. Offene spätere Fähigkeiten bleiben zugeordnet; vollständige Ergebnisabdeckung ist Voraussetzung der Endabnahme, kein Vorabtor für P0/P1.

### HEX-28 – Endstand prüfen und gesichert installieren

**Ergebnis:** Die vollständige Wonderdraft-Parität und der zusammenhängende Atlasablauf bestehen auf demselben Endbuild. Der Abnahmekatalog enthält für jede Pflichtfunktion direkte Original- und Hostbelege beziehungsweise eine ausdrücklich vereinbarte Anpassung durch die Hex-Grundstruktur. Offene Pflichtfälle verhindern die Behauptung vollständiger Gleichwertigkeit und werden in ihren zuständigen Werkzeuggruppen nachgebessert.

**Praxistest:** Kleine Testregion und große Prüfwelt aus Abschnitt 4 im echten Obsidian bearbeiten, speichern, wiederherstellen und frisch öffnen. Physische Maus-/Touchpad-Eingaben, Detailkarten, Orts- und Raumlinks sowie Ausgabebilder prüfen. Nach Sicherung des aktuellen Produktstands installieren und den Kernablauf auf dem tatsächlich installierten Build wiederholen.

### Zuordnung der ursprünglichen zehn Etappen

| Ursprüngliche Etappe | Neue zuständige Phasen |
|---|---|
| 0 – Referenz und Ausgangsbasis | HEX-00: vorhandene Inventare und Belege verwenden; fachliche Unklarheiten gezielt vor der betroffenen Lieferung klären |
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
3. Einen überprüften Testbuild auf isolierten Daten ausprobieren; getestete Funktionen und offene Fälle mit direktem Beleg unterscheiden.
4. **Nach Änderungen an Kamera, Laden, Assets oder Renderer:** Eine größere Karte und mehrfaches Hin- und Zurückzoomen prüfen. Die Testgröße wächst von der kleinen Region über 10.000 zu 100.000 bearbeiteten Hexes. Zeit, Speicher und Ressourcenfreigabe werden ab HEX-08 tatsächlich gemessen.
5. **An jedem Meilenstein:** Den bisherigen Kernablauf zusammenhängend durchspielen und gespeicherte Texte, Links, Positionen und einen bisherigen Referenzausschnitt vergleichen. Physische Bedienung beginnt mit dem ersten nutzbaren Stand; fehlende Hardware-/Nutzerprüfungen bleiben offen und werden nicht aus synthetischen Eingaben abgeleitet.

Ab HEX-05 lautet die feste Folge: **Region anzeigen → Hex ändern → Orts-Key bearbeiten → in den Dungeon zoomen → Raum und Key bearbeiten → herauszoomen → rücknehmen/wiederholen → speichern → frischer Start → denselben Ort wiederfinden.** Ab CITY-03 wird zusätzlich in Stadt und Haus gezoomt und dort Straße, Gebäude und Hausgrundriss direkt bearbeitet. Keine dieser Aktionen verlangt einen Karten-, Kontext- oder Moduswechsel. Spätere Landschafts-, Symbol- und Exportfunktionen werden in diese Testregion eingebaut. Ein reiner Editor-Neustart oder eine Sammlung isolierter Dialogtests ersetzt diese Folge nicht.

Funktionsbeleg und Paritätsbeleg werden je Unterfall getrennt festgehalten; Nachweise nennen den geprüften Build und den tatsächlichen Stand. Die Roadmap enthält keine laufenden Ergebnisprotokolle.

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

Kernprüfungen, Build, Obsidian-Bedienung, Großkartenlauf und physische Maus-/Touchpad-Abnahme werden getrennt dokumentiert.

### Gewählte Defaults

- Die Welt ist zunächst ein **ebener Atlas**; Weltkarten benötigen keine Kugelprojektion.
- Der Atlas hat keine festen Ränder und keine Größenabfrage beim Anlegen. Inhalt bestimmt die belegte Ausdehnung; Ausschnitte erhalten Maße in Meilen oder Hex-Kacheln. Pixelauflösung ist eine eigene Exportangabe.
- Hex-Ausrichtung ist beim Anlegen wählbar und bleibt danach fest.
- Automatischer Stufenwechsel besitzt einen Übergangsbereich gegen Hin-und-her-Springen; eine manuelle Stufenwahl bleibt möglich.
- Unterhalb der 3-Meilen-Stufe entstehen keine weiteren Overworld-Hex-Stufen. Stadt- und Dungeonraster übernehmen die Detailbearbeitung.
- Orts-Keys bleiben in `.location`, Raum-Keys eigenständiger Dungeons in `.dungeon`. Bestehende Gebäude-Raumkeys und ihre Links bleiben erhalten; ihr Speicherformat im gemeinsamen Gebäudezustand ist vor Umsetzung festzulegen. Der Atlas verweist auf diese Inhalte.
- Stadtgeometrie wird in `.city` geführt. Außenform und Innenräume eines Gebäudes werden gemeinsam bearbeitet; eigenständige Dungeons bleiben stabil verortet. Generation schützt manuelle Änderungen, Innenräume und Keys.
- Der Atlas bleibt ein durchgehend bearbeitbarer Raum ohne separate Modi. Zoom allein erschließt räumliche Größenstufen; Detaildarstellung ist kein Wechsel des Editors.
- Bestehende Wonderdraft-Karten werden als Bildvorlagen verwendet; ihre Originaldateien bleiben erhalten.
- Bestehende Dungeonkarten werden durch ihre Atlasplatzierung nicht umgerechnet oder neu gezeichnet.

## Einordnung in das Gesamtprodukt

Der [Hex-Beitrag zum gemeinsamen End-to-End-Fertigstellungsplan](ROADMAP-E2E-GATES-CANDIDATE.md#räumliche-end-to-end-kriterien) verbindet die nächsten sichtbaren Phasen mit Campaign, Dungeon/City, Live-Spiel und Fehler-/Displaygates aus den [E2E-Kriterien](ROADMAP-E2E-GATES-CANDIDATE.md). Die vier gemeinsamen Abläufe ersetzen keine der hier verpflichtenden Fachphasen oder Wonderdraft-Vergleiche. Neue Integration erfolgt über geprüfte Kandidaten-SHAs mit unabhängigem Review.
