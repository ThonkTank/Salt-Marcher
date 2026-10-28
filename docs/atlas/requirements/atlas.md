# Roadmap: gemeinsamer Atlas mit Wonderdraft-Parität und verbundenen Orts- und Dungeon-Keys

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: atlas
Last Reviewed: 2026-10-28 (Zuständigkeiten und metrischer Geländeumfang; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## Atlas auf einen Blick

Der aktuelle Atlas verbindet kontinuierliche Landschaft, Städte, Gebäude und Räume
in einer metrischen Kampagnenkarte. Seine Architektur und die bestätigte nächste
Lieferpriorität besitzt [Atlas: gemeinsamer Darstellungspfad](../architecture/unified-spatial-atlas.md#aktueller-arbeitsstand).
[Bedienung](../guide.md) beschreibt die vorhandenen Zugänge;
[Darstellung und Bearbeitung](../architecture/rendering.md#wo-ändern-und-prüfen)
führt zu Codebesitzern und begrenzten Prüfwegen. Diese Anforderungen besitzen den
fachlichen Zielumfang, keine zweite technische Ausführungsfolge.

**Ziel:** Welt → Region → Stadt → Haus → Dungeonraum durch Zoom erreichen und
direkt bearbeiten; eine Kamera, gemeinsame Autorhistorie und haltbare Daten.
Reise- und Referenzraster bleiben davon unabhängige Verbraucher. Landschaft wird
bei jedem Kameramaßstab in Weltmetern bearbeitet; es gibt keine zu liefernden
Gelände-Zelleditoren je Hexstufe. Grobe Gestaltung, lokale Verfeinerung und Schutz
anderer Arbeit bleiben fachliche Anforderungen im [Geländevertrag](../contract/hex-editing.md).

Die [historische Bestandstabelle und Obsidian-Paketstände](https://github.com/ThonkTank/Salt-Marcher/blob/1cb69e33dca7eda6e56916c3cf6bc2cfba803c7d/docs/atlas/requirements/atlas.md#atlas-auf-einen-blick)
sind fest gebunden. Ihre integrierten/kandidierenden Pakete, Zellformate und
Speicherbefunde sind historische Teilstände, keine aktuellen Implementierungsaufträge
oder Abnahmen. Obsidian bleibt Referenz. E2E-01 und der vollständige Zielablauf
bleiben offen; maßgeblich für Nachweisstände bleibt `acceptance.json`.

### Wie kommen wir zum Ziel?

**Nutzerentscheidung vom 11.10.2026: Gleichwertig bedeutet „kann dasselbe erreichen“.** Für Wonderdraft, Dungeondraft, Canvas of Kings, Watabou und Fantasy Town Generator zählen fachliche Ergebnisse, gezielte Nachbearbeitung und dauerhafte Speicherung. Oberfläche, Gesten, Algorithmen und Grafik dürfen anders sein. Mehrere Originalaktionen können dieselbe eigene Werkzeugfamilie nachweisen; eigenständige Wirkungen dürfen dabei nicht verloren gehen. Ein Bild ersetzt keine geforderte editierbare Geometrie.

Die folgende Tabelle ordnet den fachlichen Ausbau nach **Make it Work → Make it Efficient → Make it Beautiful, unter durchgehendem KISS** ein. Die bestätigte aktuelle Lieferpriorität steht im [Atlasplan](../architecture/unified-spatial-atlas.md#aktueller-arbeitsstand). HEX-/CITY-/Dungeonkennungen bleiben Fachreferenzen; ihre Nummern bestimmen keine Lieferfolge. Bestehende Datenabhängigkeiten bleiben verbindlich. Bestehender Code ist Istbefund, keine Architekturvorgabe. Jede Übernahme wird gegen die Gesamtgrundlage geprüft; Nutzerinhalte und bestätigte Wirkungen bleiben geschützt. Ein Grundausbau schließt keine vollständige Fachphase.

| Stufe | Konkreter Nutzerablauf und Reihenfolge | Umsetzung und Abschluss |
| --- | --- | --- |
| **Work 1 – Bestehende Karte zuverlässig ändern** | Öffnen → Raum/Ort suchen → Geometrie und Key ändern → rücknehmen → automatisch speichern → frisch wiederfinden. | Gemeinsamen Kern, Store und Shell am aktuellen Code weiterführen; Originaldateien über geprüfte Adapter übernehmen. Auswahl, Textfokus, gemeinsame Commands/History und dauerhafte Speicherung am vollständigen Weg absichern. Kernablauf einschließlich Speicherfehler prüfen; vollständiger Import und breite OS-/Recoveryqualifikation bleiben eigene Fachabnahmen. |
| **Work 2 – Einen kleinen Dungeon vorbereiten** | Räume und Gänge zeichnen → Türen/einfache Treppe setzen → Geschoss wählen → nummerieren und Vorlese-/GM-Texte ergänzen → GM-/Spielerbild ausgeben. | Grundlegende Raumliste, einfache Inhalte/Verweise und Dungeonverwaltung mit Anlegen, Umbenennen, Archivieren/Wiederherstellen. Ohne fertig ausgearbeitete Region oder Stadt benutzbar; strukturierte Fallenfelder und Graphdiagnostik folgen später. |
| **Work 3 – Eine kleine Region vorbereiten** | Gelände/Küste, Fluss und Straße zeichnen → Orte benennen und beschreiben → Vorlage kalibrieren → messen → ausgeben. | Freie Küsten und bearbeitbare Verläufe in einer metrischen Region liefern; grobe Gestaltung und gezielte Verfeinerung bleiben über Kameramaßstäbe hinweg möglich. Reise-/Referenzraster bestimmen keine Gelände-Autorenstufe. Die Region ist unabhängig von fertiger Stadtbebauung nutzbar. |
| **Work 4 – Eine Siedlung vorbereiten** | Grenze/Platz und Straßen zeichnen → Häuser mit Dichte/Größe/Struktur vorschlagen → übernehmen → ein Haus korrigieren → Innenraum ausdrücklich anlegen und ausarbeiten. | Assistierte Bebauung mit wenigen guten Vorgaben gehört zum Grundablauf. Gebäudeaußenform und Innenräume gehören zum selben Objekt; Wandkorrektur zunächst im gewählten Geschoss. Bearbeitete Häuser, Texte und Bindungen bleiben geschützt. Einfacher Stadtfall vor dem verbundenen Leitbeispiel prüfen. |
| **Make it Efficient** | Dieselben Aufgaben mit weniger Wiederholung erledigen: Raum/Haus duplizieren → mehrfach Assets platzieren → gemeinsam ändern → Vorlage nutzen → gezielt erneuern. Präzise korrigieren, Auswahl schnell wiederfinden und größere Karten ohne störende Wartezeiten bearbeiten. | Zuerst schnelle Auswahl, Duplizieren/wiederholte Platzierung und zuletzt verwendete Assets; danach Mehrfachbearbeitung einschließlich Text-Sammeländerungen, Gruppen und Vorlagen/Prefabs. Teilbare Generierungsvorgaben und Inhaltsvorschläge erweitern diese Wiederverwendung. Präzise Tastaturbewegung, Fanghilfen und schnelle Zugänge. Erweiterte Erzeugung/Layouts, Pfad-/Flächenverteilung und geschützte lokale Neuerzeugung. Wandumfang über übereinanderliegende Abschnitte und horizontale Gesamtskalierung aller Geschosse folgen hier. Sichtbare/betroffene Records bedarfsgerecht abfragen; gemessene Engpässe bei großen Karten, Suche und Export verbessern. **Abschluss:** dieselbe Vorbereitungsaufgabe mit weniger Aktionen, Suchaufwand, Fehlern oder Wartezeit, bei unveränderter Daten- und Abbruchsicherheit. |
| **Make it Beautiful** | Den bereits brauchbaren Plan übersichtlich gestalten und als lesbare, stimmige Karte präsentieren. | Werkzeugleiste, Panel, Icons, Typografie und Rückmeldungen vereinheitlichen; Stile, Texturen, Dachdetails, grafische Lichtwirkung und Effekte ausarbeiten. Beschriftungsformat, Rahmen, Kompass und Ausgabepräsentation verfeinern. **Abschluss:** Karten und Bedienung sind bei typischen Zoomstufen und 100 % klar lesbar; dieselben Aufgaben bleiben erreichbar, Daten und Ausgabeinhalte korrekt. |

**Abschluss der Work-Abläufe:** Work 1 bestätigt Bearbeitung, Undo/Redo, automatische Speicherung und frische Wiederaufnahme einer bestehenden Karte. Work 2–4 bestätigen jeweils eigenständiges Vorbereiten, Korrigieren, Ausgeben und Weiterarbeiten nach Neustart; erst danach das verbundene Leitbeispiel prüfen. Kamera, sichtbare Suche, Auswahl, Textfokus, Vorschau/Abbruch, gemeinsame Undo/Redo-Folge und ehrliche automatische Speicherung gehören von Anfang an dazu. Kennungen, Links und geschützte Texte bleiben erhalten; Fehler erhalten offene Arbeit. Einfacher PNG-Export unterscheidet GM- und Spielerinhalt gemäß bestehendem Sichtbarkeitsvertrag. Die bisherige nutzbare Installation bleibt bis zum belegten Cutover verfügbar. Der Zielkern darf intern neu aufgebaut werden; seine Lieferung muss die benötigten Nutzerwirkungen und Daten erhalten.

**KISS ist eine Regel für jede Stufe:** eine gemeinsame Kamera, Auswahl, Command-/History-/Speichergrenze und verständliche Werkzeugfamilien; keine Pflicht zur Übernahme ihrer aktuellen Codeimplementierung. Zunächst ein klarer Standardweg und wenige verständliche Optionen; weitere Optionen nur für einen konkreten Bedarf. Eine neue Abstraktion braucht einen belegten gemeinsamen Bedarf. Sichere Abbrüche, Textfokus, Lesbarkeit und ausreichende Reaktion sind bereits Work, keine spätere Schönheitsarbeit.

Die Stufen gelten zunächst für die oben genannten Kernabläufe. Innerhalb eines Ablaufs geht eine fehlende fachliche Wirkung, die dessen Vorbereitung verhindert, vor Komfort und Politur. Efficient wird zuerst an den oben genannten Wiederholungen geprüft; ein neuer Spezialablauf darf unabhängig davon mit seinem eigenen Work beginnen. Diese Regel ersetzt ein pauschales Warten auf sämtliche späteren Funktionen. **Weitere verpflichtende Fachfähigkeiten beginnen ebenfalls mit ihrem eigenen Work und werden danach effizienter und schöner.** Es muss nicht der gesamte Vorbildumfang fertig sein, bevor die häufigen Kernaufgaben effizienter werden. Die funktionalen Erweiterungen bleiben im Werkzeugkatalog und den bestehenden Fachphasen zugeordnet: maßstabsübergreifende Landschaft/Seen/Höhen, weitere Geometrie/Höhlen/Befestigungen, räumliche Wege und Durchgänge, Lichtblockierung, zusammengesetzte Beschreibungen/Attribute, strukturierte Features mit Fallenfeldern und Zustandsaktionen, Graph/Verteilungsdiagnostik, Bewohner/Beziehungen/Fraktionen und gemeinsame Weltzeit, Bibliotheks-/Paketfunktionen, zusätzliche 3D-/Straßenansichten, vollständige Im-/Exporte und Recovery. Eine neue fachliche Wirkung ist Work; Lichtblockierung, Bewohnerdaten oder VTT-Ausgabe werden nicht allein wegen ihrer Darstellung zu Beautiful. Kompass/Maßstabsanzeige als Messinformation und Dachgeometrie als Gebäudefunktion folgen ebenfalls ihrem Fachvertrag; ihre Gestaltung darf später verfeinert werden.

Die Reihenfolge ist eine Vorbereitungshypothese, kein gemessener Nutzungsbefund. Die bestehenden [GM-Aufgaben](../../project/verification/gm-workflows.md) dienen als konkrete Vergleichsproben: unter anderem sechs Räume ausarbeiten, zehn Assets setzen, Inhalte finden und nach Neustart weiterarbeiten. Efficient vergleicht Aktionen, Suchaufwand, Fehler und Wartezeiten derselben Aufgabe; zusätzliche Optionen müssen dabei helfen. Vollständiger Funktionsumfang und Größen-/Host-/Exportnachweise bleiben Voraussetzung der Endabnahme, einschließlich getrennter installierter und physischer Bedienabnahme.

Das zentrale [Werkzeugverzeichnis](atlas-2.md#konkreter-werkzeugkatalog) ordnet den Zugang und die Stufen zu; `acceptance.json` bleibt das einzige Funktions- und Nachweisregister. Fachpläne verweisen auf diese Lieferfolge und behalten ihre Details. Die [E2E-Abnahmen](../../project/delivery/roadmap.md#lieferfolge-des-gesamtprodukts) behalten ihre fachlichen Voraussetzungen. Diese Planung vergibt keine neuen Nachweise oder PASS-Zustände.

Abnahmedetails stehen in `acceptance.json`; die folgenden Abschnitte führen Zielarchitektur, Anforderungen und Umsetzung.

## Umsetzungsplan

**Einstieg:** [Prioritäten](atlas.md#wie-kommen-wir-zum-ziel) → [Lieferpakete](atlas.md#lieferpakete-und-codeanschlüsse). Die Nutzerabläufe und der Werkzeugkatalog definieren weiterhin die Wirkung. Dieser Abschnitt führt zu den zuständigen Arbeitsdokumenten; er eröffnet keine zweite Prioritäts- oder Statusliste.

### Informationsarchitektur der Oberfläche

Die fachliche Ordnung lautet: **Wo bin ich? Was will ich tun? Was ist ausgewählt?
Ist meine Arbeit gesichert?** Der Atlas bleibt eine gemeinsame Fläche. Zoom
verändert Ausschnitt und Detaildarstellung, nicht Auswahlbesitz oder Schreibautorität.

Die aktuelle Anordnung, Werkzeugnamen, Seitenleisten und Kontextregeln stehen
an einer Stelle: [Arbeitsplatz und Kartenfläche](../guide.md#arbeitsplatz-und-kartenfläche).
Bereiche und Gruppen stammen aus dem gemeinsamen Werkzeugkatalog; nur vorhandene
Werkzeuge erscheinen. Neue Fachfähigkeiten müssen in diese Zugänge passen und
Offenes sichtbar erklären. Die [gemeinsame Bedienung](atlas-2.md#gemeinsame-bedienung)
beschreibt zusätzliche Zielregeln und keine zweite Layoutspezifikation.

### Werkzeuggruppen der Atlassteuerung

Aktuelle Gruppen und Zugänge: [Bedienung](../guide.md#vorbereiten) und
[Codebesitzer](../architecture/rendering.md#wo-ändern-und-prüfen). Vollständiger
fachlicher Werkzeugumfang: [Werkzeugkatalog](atlas-2.md#konkreter-werkzeugkatalog).
Werkzeugwechsel schützen Entwürfe; Objektauswahl öffnet Eigenschaften, ohne eine
neue Karte oder einen zweiten Editor zu erzeugen.

### Lieferpakete und Codeanschlüsse

Die bestätigte technische Ausführung besitzt der
[Terrain-/Wasserplan](../architecture/unified-spatial-atlas.md#terrain-wasserlieferung-umsetzungsplan).
Die [Codeeinstiege und Prüfwege](../architecture/rendering.md#wo-ändern-und-prüfen)
führen zum aktuellen Electron-/TypeScript-/SQLite-Anschluss. Fachverträge
besitzen Wirkung und Datenregeln, etwa [Gelände](../contract/hex-editing.md),
[Reise](../contract/hex-travel.md) und [Raumgruppen](../contract/room-groups.md).

Der [frühere Work-1a–4b-Kernaufbau samt Legacy-Speicherbefunden](https://github.com/ThonkTank/Salt-Marcher/blob/1cb69e33dca7eda6e56916c3cf6bc2cfba803c7d/docs/atlas/requirements/atlas.md#lieferpakete-und-codeanschlüsse)
bleibt historisch erreichbar. Sein `storage.changed()`-Draft, separater Save,
Obsidian-Consumer-Matrix und offene Übernahmepakete beschreiben den damaligen
Stand; neue Arbeit beginnt an den aktuellen Besitzern. Die fachlichen
Work-1–4-Nutzerabläufe und ihre noch offenen Gesamtprüfungen bleiben erhalten.
Automatisierte Regression, native Qualifikation und fachliche Abnahme sind
getrennte Nachweise; diese redaktionelle Bereinigung vergibt keinen PASS.

## Konkrete Nutzerabläufe

**Planungsstand: 11.10.2026.** Die folgenden Abläufe beschreiben das vereinbarte Zielverhalten, keine bereits vollständige Implementierung. Das Leitbeispiel zeigt auch spätere Erweiterungen wie geschützte Verfeinerung, gemeinsame Wandumfänge und Neuerzeugung; die einzelnen Work-Abschlüsse verlangen diese noch nicht. Der [aktuelle Stand](atlas.md#atlas-auf-einen-blick) bleibt davon getrennt. Leitbeispiel ist eine Region mit dem Dorf **Eichenfurt**, der Taverne **Zum Silbernen Ast** und dem Ruinendungeon **Alte Wacht**. Das Beispiel macht die Bedienung prüfbar; der vollständige Fachumfang der HEX-/CITY-Phasen und [Dungeonanforderungen](../../project/requirements/scope.md) bleibt erhalten.

### Vorbereitung: Region bis Dungeon

#### 1. Einen Atlas beginnen und erweitern

Ich öffne den Atlas meiner Kampagne und gebe ihm einen Namen. Eine leere Welt verlangt keine Breite oder Höhe. Ich verschiebe die Ansicht, zoome und beginne an der gewünschten Stelle zu zeichnen. Später kann ich jenseits des bisherigen Ausschnitts weiterarbeiten.

**Sichtbares Ergebnis:** Der bearbeitete Bereich wächst mit meinen Inhalten. Pan und Zoom erzeugen keine Landschaftsdaten; ein Übersichts- oder Exportausschnitt begrenzt die Welt nicht.

#### 2. Die Region formen

In einer regionalen Übersicht forme ich Land und Meer. Beim Hineinzoomen verfeinere ich Küste, Wald, Hügel und Berge in Weltmetern. Das gewählte Referenzraster begrenzt diese Bearbeitung nicht. Ich zeichne einen zusammenhängenden Fluss und einen regionalen Weg frei über mehrere Hexes, verschiebe Verlaufspunkte und entferne Teilstücke.

**Sichtbares Ergebnis:** Die Landschaft bleibt über Hex- und Zoomgrenzen verbunden. Eine spätere grobe Änderung erhält meine ausdrücklich verfeinerten Eigenschaften; die noch offene Schutzregel für absolute Feinhöhen steht im [Terrain-Liefervertrag](terrain-relief.md#ziele-und-abnahme-dieser-etappe). Mit „Zur Vorgabe zurücksetzen“ entferne ich eine lokale Überschreibung gezielt und rücknehmbar.

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
