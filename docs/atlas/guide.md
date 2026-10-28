# Eine Kampagne, eine Karte

Status: Current; offene Ziele sind als solche beschrieben.
Owner: atlas
Last Reviewed: 2026-10-28 (Bedienung am aktuellen Code abgeglichen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Die Desktopanwendung verwendet eine Kampagnenwelt. Kontinuierliches Gelände, Städte, Gebäude und Dungeonräume liegen in derselben metrischen Fläche. Stadt und Dungeon sind räumliche Bereiche mit eigenen fachlichen Werkzeugen; sie besitzen keine unabhängig auswählbaren Karten. Die Kamera und die Auswahl bleiben beim Werkzeugwechsel erhalten. Zoomen erzeugt weder Geometrie noch Reisezeit.

## Arbeitsplatz und Kartenfläche

Der Atlas verwendet die gesamte Fensterfläche. Die feste obere Befehlsleiste enthält das Atlasmenü mit Kampagnenverwaltung, Einstellungen, Hilfe und Rückkehr zur Kampagnenübersicht, Rückgängig/Wiederholen, Auswahl/Hand, Ansichtsverlauf, Zoom und Weltübersicht. Suche, Größenvergleich, Ansicht, Import, Export und Speicherstatus bleiben unabhängig vom Werkzeug erreichbar. Ab 1200 CSS-Pixeln steht die Leiste in einer Zeile, darunter in zwei Zeilen. Menüs und Suchergebnisse überlagern die Karte. Party, Reise, Spielzeit, Musik und Spieleranzeige gehören ausschließlich zu den Spielleitungsbereichen; Alt+P öffnet im Editor keine Partyansicht.

Ganz links steht eine 48 Pixel breite Werkzeugleiste mit Symbolen und kurzen Namen. Die Bereichswahl in den danebenliegenden Werkzeugeinstellungen bietet **Landschaft**, **Stadt** und **Räume**; die Werkzeugleiste zeigt die passenden Gruppen und Zugänge. Ein Werkzeugklick öffnet die zugehörigen Werkzeugeinstellungen. Die Symbolleiste bleibt erreichbar. Räume und Ausstattung verwenden gemeinsame Werkzeuge. Geschosse stehen bei den Raumwerkzeugen. Eine Objektauswahl ersetzt die Werkzeugleiste nicht. Die Einstellungsleiste ist standardmäßig 240 Pixel breit und zwischen 220 und 360 Pixeln verstellbar. **Ansicht** bietet das Ausblenden der linken oder beider Seiten; die Befehlsleiste bleibt sichtbar.

Eigenschaften einer ausdrücklichen Auswahl, **Beschreibung bearbeiten**, Objektbibliothek, **Viertel bebauen**, Analyse, Nachzeichenvorlage, Größenvergleich und Bildexport öffnen ihren Kontext rechts. Diese Leiste ist standardmäßig 340 Pixel breit und zwischen 280 und 480 Pixeln verstellbar. Bei einer Auswahl und engem Platz klappen die Werkzeugeinstellungen vorübergehend ein; die Eigenschaften bleiben neben der Geometrie. Für andere Kontexte überlagert die rechte Leiste die Karte, wenn weniger als 560 Pixel Kartenbreite verbleiben. Schließen erhält den aktuellen Kontext und offene Eingaben; Zoomen und Nachladen öffnen sie nicht wieder. Der Schalter oben blendet den Kontext erneut ein. Eine offene Raumbeschreibung wird nicht automatisch durch einen anderen Kontext verdrängt. Raumtexte verwenden dieselben Key-Records und Speicherregeln.

Breiten und Sichtbarkeit der linken Leisten bleiben als eigene lokale Ansichtspräferenz erhalten. Seitenleistenänderungen erhalten Kartenmittelpunkt und Meter pro Bildschirmpixel, ohne Autorenänderung oder Eintrag im Ansichtsverlauf. Die Maßstabsleiste bleibt als nicht bedienbare Kartenanzeige sichtbar; ihre Balkenlänge folgt gut lesbaren Entfernungen.

Das Mausrad zoomt am Zeiger. Mittlere Maustaste oder **Leertaste + Ziehen** verschieben vorübergehend die Kamera. Enter schließt einen Punktzug ab, Backspace entfernt seinen letzten Punkt, Escape verwirft ihn. Kartenkürzel wirken auf der Karte, nicht während Texteingaben. Werkzeuge und Werkzeugfamilien dürfen einen begonnenen Zug nicht stillschweigend verwerfen.

[Historische Layoutprobe vom 18.10.2026](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/atlas-workspace-layout-20261018/README.md).

## Vorbereiten

1. Kampagne öffnen und **Atlas** wählen. Unter **Landschaft → Land** Landform oder Farbe wählen und einen metrischen Pinselradius einstellen; ein gedrückter Pinselzug ist eine gemeinsame Änderung.
2. Unter **Stadt** einen Namen eingeben, **Stadt platzieren** wählen und den Punkt auf der Karte anklicken. Die Stadt liegt jetzt an diesem Weltpunkt. Unter **Stadt** Straßen, Viertel und Plätze zeichnen; **Viertel bebauen…** öffnet die Erzeugungsoptionen und Vorschau. Bebauung vorschlagen und übernehmen. Häuser einzeln korrigieren.
3. **Einzelhaus** oder **Raumgruppe anlegen** wählen. Die gemeinsame Vorschau erzeugt je nach Art passende Räume, Geschosse, Türen und Einrichtung. Übernehmen speichert sie zusammen; hineinzoomen zeigt dieselben bearbeitbaren Räume. Gebäude und Raumgruppe haben dieselbe Kennung. Außenformen werden aus den Räumen abgeleitet. [Details und Schutzregeln](contract/room-groups.md).
4. **Geschoss**, **Dächer anzeigen** und **Höhenschnitt** verändern die Ansicht. Die Fachwerkzeuge behalten Raumtexte, Keys, Türen, Ausstattung, Volumen, Graph und Passagen. **Ort finden** findet auch benannte Ortsmarken sowie Städte, Häuser und Räume innerhalb derselben Karte. Ein gefundener Ort öffnet seine vorhandene Beschreibung direkt in den Eigenschaften. Unter **Objekte → Objekt auswählen** bleibt die Auswahl beim Ortskontext; Bewuchs besitzt weiterhin seine eigene Auswahl. Bei Ortsmarken stehen Name und Beschreibung vor der aufklappbaren **Position**. **Vorige Ansicht** kehrt nach dem Speichern zum vorherigen Kartenausschnitt zurück.
5. **Rückgängig/Wiederholen** umfasst Landschaft, Stadt, Räume, Keys und räumliche Bindungen. Bestätigte Schritte sind automatisch in SQLite gespeichert. Eine unbekannte IPC-Antwort eines Autorenauftrags bleibt mit ihrer Befehlskennung erhalten; **Speicherstand klären** liest den Ausgang dieses ursprünglichen Autorenauftrags ohne erneute Ausführung. Eine spätere unvereinbare Änderung sperrt eine Rücknahme statt sie zu überschreiben.

Dungeondateien werden beim Import in eine offene Kampagne am zuletzt gewählten Atlaspunkt eingefügt. Räume, Geschosse und Abschnittsbindungen bekommen kollisionsfreie lokale IDs; der originale UTF-8-Quelltext bleibt zusätzlich erhalten. Ohne offene Kampagne bleibt der Import als neue Kampagne möglich. Unabhängige Kampagnenkopien erhalten eigene IDs und eine frische Autorhistorie; räumliche Beziehungen bleiben verbunden.

Für Wälder, Wiesen, Buschland und Felsen gibt es **Landschaft → Bewuchs &
Felsen**. Eine Vorlage verbindet Bodenbild und Geländeart mit einem automatisch
verteilten Bestand. Pinsel, Polygon und Hecke/Baumreihe legen Flächen an;
Freihalten, Ausdünnen und Verdichten korrigieren sie. Bäume und Felsen lassen
sich einzeln auswählen und geschützt bearbeiten. **Räumliche Landschaft**
zeigt und bearbeitet dieselben Bestände auf dem Höhengelände.
[Bedienung, Datenregeln und Grenzen](requirements/vegetation.md).

## Gelände formen und Ansicht kippen

**Landschaft → Land** enthält **Land formen**, **Land bemalen** und **Glätten**. Land formen hebt oder senkt mit Stärke, Roughness und optionaler Zielhöhe; die Höhe bestimmt die Küste am Meeresspiegel. Farbe bleibt unabhängig.

**Ansicht → Atlas kippen** zeigt denselben Höhenbestand räumlich. Neigung, Drehung und Höhenüberhöhung ändern nur die Darstellung. Die drei Landpinsel bearbeiten die sichtbare Oberfläche in Weltmetern; verdeckte Höhenknoten werden geschützt. **Draufsicht** kehrt unmittelbar zurück, mit derselben Kamera, Auswahl und gemeinsamen Rückgängig-Schritten. Andere Gelände- und Grundrisswerkzeuge sowie der bestehende Bildexport führen zur Draufsicht. Wissens- und Sichtmasken verwenden weiterhin die gefilterte Draufsicht.

[Lokale R5-Prüfung und offene R6-/R7-Grenzen](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/terrain-tilted-atlas-r5-20261020/README.md).

## Speicherstand klären und weiterarbeiten

„Gespeichert“ bezeichnet bestätigte Autorenarbeit, keine bloß sichtbare Vorschau.
Dieser Ablauf beschreibt Autoren- und Terrainaufträge. Geschlossene Pinselzüge warten in ihrer ursprünglichen Reihenfolge auf Bestätigung.
Bleibt die Antwort aus, wird der Speicherstatus automatisch geprüft. Ist der erste Zug bereits gespeichert, bestätigt sein Beleg genau diesen Zug; ein bereits geschlossener Folgezug läuft ohne Ersatzgeste weiter. Vorübergehende Lesefehler halten die Arbeit und werden mit Abstand erneut geprüft.

Ist der ursprüngliche Zug sicher nicht gespeichert und seine Quelle unverändert, wird derselbe Auftrag automatisch erneut versucht. Bei einer tatsächlich geänderten Quelle erscheint der unaufdringliche Hinweis **Letzter Pinselzug nicht übernommen**. Über den Speicherstatus stehen optional **Erneut anwenden** und **Verwerfen** bereit; ein Dialog wird nicht erzwungen. Erneut anwenden verwendet ausdrücklich das aktuelle Gelände für die noch nicht übernommenen Züge. Bereits gespeicherte Züge werden dabei nicht doppelt angewandt.
Neue Gesten, Rücknahme, Kampagnenwechsel und normales Schließen dürfen ungeklärte
Züge nicht übergehen. Kamera und Ansichtsladen entfernen die Warteschlange nicht.
Diese gehaltene Eingabe ist kein dauerhaftes Entwurfsjournal: Für erzwungenen
Prozessabbruch besteht keine Zusage zur Erhaltung unbestätigter Gesten.

Nach normaler Wiederöffnung sind bestätigte Inhalte erneut lesbar. Die gemeinsame
Autorhistorie verbindet die Atlaswerkzeuge; eine über vollständige Appneustarts
fortgesetzte Undo-Bedienfolge wird damit nicht allgemein zugesagt. Reisecheckpoints
besitzen ihre eigene kausale Rücknahme. Code, Receiptregeln und begrenzte Nachweise:
[Speicherklärung im Atlas](architecture/rendering.md#speicherklärung-im-atlas).

## Leiten

Außerhalb des Atlaseditors unter **Leiten** die Fokusgruppe wählen. Die dortige Atlasansicht verwendet ihre vorhandene Position, Mitgliedschaft, ihr Tempo und ihre Uhr. Ziel anklicken → **Weg prüfen** → **Reise starten** → Schritt/Runde/Wiedergabe. Ein lokaler Fußweg meidet Häuser, Wasser und Mauern; lange Strecken verwenden die vorhandene Weltreise. Die lokale Wegsuche ist eine abgeleitete Navigationshilfe und verändert keine Quellkonturen.

Raum auswählen → **Eingang verbinden** → zuerst Außenpunkt, dann Innenpunkt setzen. Am Eingang angekommen den angebotenen Eingang ausdrücklich betreten; mehrere nahe Eingänge stehen zur Auswahl. Auch das Verlassen ist ausdrücklich. Eingangskosten zählen zur selben Gruppenuhr. **Zur Gruppe** verändert nur den Ausschnitt. **Gruppe platzieren** beziehungsweise bestätigtes Tokenziehen ist ein GM-Eingriff ohne Reisezeit.

NPCs, Spuren, Wege und **Wissen und Sicht der Gruppe** verwenden vorhandene Dungeon-Laufdaten. Unpassende Geometrieänderungen, die Figuren außerhalb ihrer Räume zurückließen, werden abgewiesen; geänderte Reisegrundlagen halten laufende Wege an. Routen werden nach Neustart weiter angezeigt, automatische Wiedergabe beginnt erst auf ausdrücklichen Start.

**Export** erzeugt den Ausschnitt als PNG oder JPEG. **Dungeon-Grundriss** rahmt alle nicht ausgeblendeten Räume und Zeichnungen des aktuellen Dungeon-Geschosses mit Rand ein, einschließlich außerhalb der Ansicht liegender Inhalte. Der Rahmen folgt späteren bestätigten Größenänderungen. Die Vorschau passt neben eine überlagernde Exportleiste; eine ausgegebene Maßstabsleiste erhält Platz unter dem Grundriss. **Aktuelle Ansicht** und **Bereich aufziehen** bleiben für freie Ausschnitte verfügbar. **Maßstab ausgeben** ergänzt standardmäßig eine Leiste im oben gewählten Einheitensystem; für eine Ausgabe ohne Leiste das Häkchen entfernen. Sehr flache Bilder unter 100 Pixel Höhe bieten dafür keinen lesbaren Platz. GM-Ausgabe verwendet die sichtbare Bearbeitungsansicht. Die öffentliche Ausgabe wird ausschließlich aus der vorhandenen öffentlichen Wahrnehmungsprojektion aufgebaut. Ein fehlender öffentlicher Kontext wird gemeldet; GM-Knoten werden dafür nicht bloß ausgeblendet.

**Export → Ausgabe: Bearbeitbare Kampagne → Kampagne sichern…** speichert ein bearbeitbares Kampagnenpaket einschließlich Karten, Raumtexten, GM-Inhalten und Medien. Die Auswahl für öffentliche Bilder beschränkt diese Sicherung nicht. Über **Atlas → Pakete und Kopien** lässt sich das Paket als unabhängige Kampagne importieren. PNG und JPEG bleiben in derselben Exportansicht erreichbar. Solange das Exportpanel offen ist, macht die linke Zeichenleiste der Kartenansicht Platz. Bei der Rückkehr zur Bearbeitung gilt wieder ihre vorherige Anordnung.

## Grenzen

Der gemeinsame Ablauf ersetzt die getrennten Desktopkartenflächen. Der übrige dokumentierte Fachumfang und die vollständige Produktabnahme bleiben offen. Insbesondere sind alternative Betriebssysteme, umfassende große Welt-/Datensätze und vollständige Gleichwertigkeit mit den Vorbildern hiermit nicht abgenommen. Die lokale Fußwegplanung ist auf 5 km und 60.000 Suchknoten begrenzt; für längere Strecken dient die Weltreise. Gebäude mit expliziten Rastervolumen werden nicht durch eine freie Gebäudeskalierung verzerrt.

Alte Testbestände ohne Atlaswurzel werden nicht in ein Mehrkartenmodell migriert. Historische Referenzen und Originalquellen im Repository bleiben erhalten. Neue Kampagnen starten mit einer leeren gemeinsamen Welt.

## Eine Region vorbereiten

Die kleinste Hexstufe misst **3 Meilen / 4828,032 m zwischen gegenüberliegenden Kanten**. Weitere Reise- und Referenzraster entsprechen 1 Tag (24 Meilen), 1 Woche (168), 1 Monat (720), 3 Monaten (2.160) und 12 Monaten (8.640). Grundlage sind 3 Meilen/Stunde, 8 Reisestunden/Tag, 7 Tage/Woche und 30 Tage/Monat. Diese Größenreferenzen verändern die tatsächliche Reiseberechnung nicht. Das Raster legt keine Gelände-Zellen oder Autorenauflösung fest; vorhandene kontinuierliche Flächen behalten ihre metrische Geometrie. Hexstufe und Kamera sind unabhängig: Städte und Räume bleiben unabhängig davon in realen Längenmaßen bearbeitbar. **Weltübersicht** zoomt bis zu einer erdgroßen Referenzfläche von 40.000 × 20.000 km; je Fensterformat erscheint zusätzlicher Rand. Die Welt bleibt verschiebbar.

Im Atlas den Bereich **Landschaft** wählen. **Maße** bestimmt die angezeigten Einheiten; gespeicherte Geometrie bleibt in Metern:

1. Unter **Land → Land formen** mit Anheben/Absenken, Stärke, Radius und optionaler Zielhöhe die Landfläche anlegen. Loslassen speichert einen rücknehmbaren Pinselzug. **Landschaft → Geländedaten** bietet freie Eigenschaftspinsel; Gelände, Höhe und Klima bleiben eigene Eingaben. **Eigenschaft zurücksetzen** entfernt nur die gewählte Eigenschaft im bemalten Bereich. Feinere Eigenschaftsvorgaben bleiben bestehen. Der Schutz absoluter Feinhöhen ist davon getrennt und noch nicht vollständig qualifiziert.
2. Unter **Wasser → Fluss zeichnen** oder **Wege & Flächen → Weg zeichnen** Punkte setzen und abschließen. Unter Auswahl einen Verlauf anklicken oder aus der Objektliste wählen. Punkte ziehen speichert den Verlauf beim Loslassen; er bleibt für die nächste Punktkorrektur ausgewählt. Punkte einfügen/entfernen, am inneren Punkt teilen oder die Breite ändern und anschließend Auswahl speichern. Eine gezeichnete Straßenquerung ist keine Brücke.
3. Unter **Objekte → Ort platzieren** einen Namen eingeben, den Ort setzen und abschließen. Die Koordinaten einer Auswahl stehen unter **Position**. Im selben Panel die geordneten Markdown-Abschnitte bearbeiten. Die Abschnitte besitzen stabile Links; Umbenennen und Verschieben ändern ihre Kennungen nicht. Entfernen aus dem Atlas löscht die Ortsprosa nicht. Die vorhandenen Orts- und Weltfunktionen verwenden dieselben Ortskennungen.
4. Unter Nachzeichenvorlage ein PNG/JPEG/WebP laden, zwei Punkte im Bild anklicken und deren reale Entfernung in der angezeigten Einheit eingeben. Abschließen übernimmt die Kalibrierung. Über die Objektliste die Vorlage auswählen; Deckkraft, Sichtbarkeit, Sperre und Lage bearbeiten. Nach Entsperren dienen der Ursprung und der gegenüberliegende Griff zum Verschieben beziehungsweise Skalieren/Drehen. Die importierte Vorlage wird innerhalb der Kampagne gespeichert und mitkopiert.
5. Oben **Messen** wählen und Wegpunkte setzen. Die Anzeige verwendet das gewählte Einheitensystem; Messen speichert keine Autorenänderung und verbraucht keine Reisezeit. Ein Werkzeugwechsel beendet die Messung ohne zusätzlichen Abschluss. Die dynamische Maßstabsleiste bleibt beim Zoomen lesbar.
6. Oben **Export** öffnen, bei Bedarf **Bereich aufziehen** wählen und zwei Ecken setzen. Unter **Bildoptionen** PNG oder JPEG, Raster und längste Bildkante bis 8192 Pixel einstellen. Ohne Rahmen gilt die aktuelle Ansicht. GM-Ausgaben zeigen bestätigte Inhalte ohne Bearbeitungsgriffe, Entwürfe oder Messhilfen. Vorlagen sind standardmäßig ausgeschlossen. Öffentliche Ausgabe verwendet weiterhin die bestehende Wissensprojektion.

Die [native Regionsprobe](../../tools/test-desktop-region-export.mjs) bereitet mit den aktuellen Höhenwerkzeugen drei Orte auf ausdrücklich gezeichnetem Land, einen sichtbaren Fluss und ihren Verbindungsweg vor. Sie prüft die metrische und die DnD-Messanzeige gegen dieselben gespeicherten Meterpunkte, die Wegkorrektur mit Undo/Redo, Land und Flussufer im PNG sowie unveränderte Quellen nach Ausgabe und Neustart bei echtem 100-/200-%-Browserzoom. Der gemeinsame native Prüfhelfer bindet den Build und verlangt reguläre Prozessenden. Schrift über internen Ausgabekachelgrenzen bleibt eine zusätzliche Gegenprobe; ein unsichtbarer Fluss auf einer reinen Ozeanfläche gilt nicht als erfolgreiche Regionsvorbereitung.

Unter **Geländedaten → Hexfläche füllen** begrenzt die gewählte Rasterkontur eine
kontinuierliche Eigenschaftsfläche. Der Auftrag speichert Polygongeometrie, keinen
Gelände-Zellbestand. Freie Eigenschaftspinsel sind nicht auf Hexkonturen begrenzt.

Die leere Standardzeichnung ist ein Bearbeitungsrahmen, kein zusätzlicher Kartenort. Sie liefert weder eine Beschriftung noch einen unsichtbaren Treffpunkt. Ausdrücklich angelegte leere Dungeons und Zeichnungen mit Inhalt bleiben Kartenorte.

Landschaftsflächen und Verläufe werden räumlich indiziert gelesen. Lokale Reiseprüfungen berücksichtigen die feinen Wasserflächen; entfernte Wege verwenden weiterhin die bestehende Hexreise mit ihren GM-Entscheidungen. Kamera, Maßstab und Messung verändern keine Position oder Uhr.

Offen bleiben der vollständige Biom-/Symbolkatalog, Heightmaps, automatische Brücken, zusätzliche Landschafts- und Stilwerkzeuge sowie die umfassende Großwelt- und Plattformabnahme.

## Maßstab und geografische Vergleiche

Die Leiste unten verwendet runde Entfernungen in 1/2/5-Abstufungen mit einer
passenden Balkenlänge bis 160 Bildschirmpixeln, in kleinen Fenstern höchstens
einem Drittel der Kartenbreite. Entfernung und Einheit folgen Zoom und Maßeinstellung. Mausrad und
Trackpad zoomen um den Mauszeiger, die Plus-/Minustasten um die Ansichtsmitte.
**Vorige Ansicht** nimmt eine zusammenhängende Zoomgeste zurück. Reduzierte
Bewegung in den Systemeinstellungen schaltet die Übergangsanimation aus.

**Größe vergleichen** bietet 346 offline verfügbare Länder/Gebiete, Bundesländer,
Städte, Inseln, Kontinente und die Weltreferenz. Namen suchen oder Kategorie
wählen. Der Rahmen hat die angezeigte geografische Breite und Höhe; es ist kein
flächengleiches Quadrat. Rahmen ziehen oder mit Pfeiltasten verschieben
(Shift für größere Schritte); mittlere Maustaste verschiebt die Kartenansicht.
**Rahmen vollständig anzeigen** macht einen außerhalb der Ansicht liegenden
Rahmen sichtbar. **Bereich fokussieren** passt den Ausschnitt mit Rand an und
schließt den Vergleich. **Abbrechen** oder Escape entfernt die Vorschau ohne
Kartenänderung. Begonnene Zeichnungen müssen vorher abgeschlossen oder
verworfen werden.

Maße sind gerundete Näherungen aus dokumentierten geografischen Grenzen.
Überseegebiete erscheinen getrennt; bei Städten sind abweichende Gebiete im
Namen angegeben. Quellen und Datenstand stehen in der Auswahl unter
**Maße und Quellen**, Attribution auch in `NOTICE.md`.

Die automatische Hexgröße richtet sich nach der sichtbaren Größe der Felder;
benachbarte Reisestufen werden kurz überblendet. Manuelle Auswahl fixiert die
Größe. Während eines Zeichenentwurfs bleibt die Hexgröße gesperrt. Bildausgaben
verwenden genau die ausgewählte Größe ohne Übergangsüberblendung.


## Regionen malen und Karten beschriften

Unter **Landschaft → Regionen** werden Regionen primär mit dem Pinsel bearbeitet; Punkte dienen anschließend der Grenzkorrektur. Geografische, politische und eigene Ebenen besitzen Typen, Bedeutung und optionale Oberregionen. Straßen-, Gewässer-, Regions- und Gebäudenamen verwenden eine gemeinsame zoomabhängige Anordnung. Bedienung, Speicherung und Prüfgrenzen stehen im [Fachvertrag zur Kartenbeschriftung](contract/atlas-cartography.md).
## Größen beim Bearbeiten und Maßeinheiten

**Maße** in der oberen Atlasleiste schaltet zwischen **DnD** (Standard: Fuß und
Meilen, Flächen in Quadratfuß/Quadratmeilen) und **Metrisch** (Meter/Kilometer,
Quadratmeter/Quadratkilometer) um. Die Einstellung gilt für den Atlas, seine
Maßeingaben, Messung, Größenvergleiche und den Bildmaßstab und bleibt lokal über
Neustarts erhalten. Auch Breite und Tiefe neu erzeugter Raumgruppen, Punktlisten und die räumlichen Dungeonwerkzeuge folgen
der Auswahl; diskrete 3D-Werkzeuge behalten ihre bisherigen Rasterabstände.
Raumgruppen verwenden für Vorschau und Übernahme denselben metrischen Rezeptwert;
40 × 25 Fuß ergeben 12,192 × 7,62 Meter. Interne Geometrie, Entwürfe und
Speicherformate behalten ihre bisherigen Einheiten.
Ein Wechsel speichert keine Kartenänderung. Ungültige offene Maßtexte müssen vor
dem Wechsel korrigiert werden.

Beim Zeichnen oder Auswählen steht die aktuelle Größe direkt an der Geometrie:
Verläufe zeigen Länge und Breite, Flächen ihren Inhalt sowie Breite und Höhe,
Pinsel Radius und Durchmesser, Objekte ihre Abmessungen und Licht/Features ihre
Reichweite. Flächen berücksichtigen Löcher; gekrümmte Landschaftswege verwenden
den dargestellten Verlauf. Gebäudemaße beziehen sich auf ihre eigene Kontur und
ändern sich nicht beim Drehen. Die Anzeige folgt dem Entwurf und den Griffen,
bleibt ohne Autorenwirkung und wird nicht in Kartenbilder übernommen. Die aktuelle
Höhe, ihre Auflösung und eine laufende Höhenvorschau werden aus numerischen Werten
in der gewählten Einheit formatiert; der Wechsel benötigt keine neue Höhenabfrage.

Bei eingeschaltetem und darstellbarem Hexraster ergänzt der Maßstab die aktuelle
Hexgröße **zwischen gegenüberliegenden Kanten** und eine **Reise-Richtzeit**.
Sie verwendet Normaltempo auf Ebene: 3 Meilen pro Stunde, 8 Reisestunden pro Tag,
7 Tage pro Woche und 30 Tage pro Monat. Die konkrete Gruppenreise berechnet
Tempo, Gelände und Wetter weiterhin separat. Automatische Stufenwechsel
aktualisieren die Anzeige; ohne Raster entfällt die Hexinformation. Im Bildexport
erscheint sie nur zusammen mit Raster und Maßstab.

Gezielte Prüfungen: [desktop-atlas-measurements.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/atlas/desktop-atlas-measurements.test.mjs),
`tests/atlas/desktop-atlas-navigation.test.mjs` und
`tools/test-desktop-atlas-measurements.mjs`. Der native Ablauf verwendet eine
synthetische Kampagne und prüft Wegentwurf, Einheitenwechsel, Raumzug mit
Undo/Redo, Viertelfläche, Gebäudevorschau und -übernahme, Export und metrische
Wiederöffnung. Gebäudemaße und gespeicherte Geometrie werden nach Einheitenwechsel
und Neustart verglichen; der Gebäude-Dialog wird bei tatsächlichem 200-%-Zoom
bedient. Die gemeinsame Native-Session-Prüfung verlangt normale Prozessenden.
Diese Fälle sind keine vollständige Abnahme aller Werkzeugvarianten. Auch der
geländegebundene Trassenplaner verwendet die gemeinsame Maßeinstellung für Breite,
Planungsgrenzen, Punktkoordinaten und Höhenprofil. Sein Dialog bietet dieselbe
Auswahl; Prozentsteigungen bleiben unverändert. Einheitenwechsel benötigen weder
eine neue Geländeplanung noch einen Schreibvorgang. Unbearbeitete Koordinaten
behalten ihre volle Genauigkeit. Zugehörige Prüfungen stehen in
[desktop-terrain-route-units.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/atlas/desktop-terrain-route-units.test.mjs) und
`tools/test-desktop-terrain-routes.mjs`.
