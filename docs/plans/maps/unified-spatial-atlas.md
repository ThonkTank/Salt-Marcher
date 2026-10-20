# Roadmap: ein durchgehend räumlicher SaltMarcher-Atlas

Stand: 20.10.2026. Im Gespräch vorgeschlagene und zur Umsetzung beauftragte Roadmap, anschließend auf Nutzerwunsch im Repository abgelegt. Die Ablage ist kein Implementierungs- oder Abnahmenachweis; P0–P8 sind durch diese Ablage nicht abgeschlossen.

## 1. Verbindliches Produktziel

SaltMarcher erhält **eine gemeinsame Kartenfläche mit einer perspektivischen Kamera**. Sie schaut standardmäßig senkrecht nach unten und lässt sich jederzeit drehen und neigen. Welt, Landschaft, Stadt, Gebäude und Innenraum gehören zu derselben bearbeitbaren Welt.

Der Zoom verändert kontinuierlich die Darstellung und Informationsdichte: Küsten bleiben scharf, Höhenlinien werden sinnvoll ergänzt, Straßen und Flüsse bleiben lesbar, Namen wechseln nach Bedeutung und verfügbarem Platz. Städte erscheinen je nach Maßstab als Marker, Fläche oder Bebauung. Auswahl, Werkzeuge und History bleiben durchgehend erhalten.

Festgelegt:

- **Ebener, wachsender Meterraum**, ohne feste Kartenränder oder Weltkugel.
- Perspektivische Kamera mit 360° Drehung und zunächst 0–75° Neigung aus der Senkrechten. Draufsicht und Nordausrichtung sind unmittelbar erreichbar.
- **Räumliche Bearbeitung auch innerhalb von Gebäuden und Dungeons.** Keine erzwungene Rückkehr zur Draufsicht.
- Gesamter vorhandener Atlasumfang einschließlich Terrain, Bewuchs, Straßen, Gewässern, Regionen, Beschriftungen, Stadt-/Dungeonwerkzeugen, Ausgabe und Spieleranzeige.
- Noch offene, davon unabhängige Stadt-/Dungeon-Paritätsfeatures bleiben in ihren Fachroadmaps.
- Bestehende Kampagnen sind unwichtige Testdaten: neue Testkampagnen und erforderliche Schemaänderungen sind zulässig. Bestehende Dateien werden nicht gelöscht oder stillschweigend umgedeutet.
- Electron, TypeScript, SQLite, lokale Offline-Nutzung und Main als einzige Schreibinstanz bleiben die Grundlage.

Die neue Roadmap ersetzt die bisherigen Vorgaben für getrennte Drauf-/Kippdarstellung. Bereits belegte Fachfunktionen werden übernommen; ihre Eignung im neuen Atlas wird erneut geprüft.

Einordnung: [Atlas-Roadmap](../../../ROADMAP-HEX-ATLAS.md), [bisherige Relief-Roadmap](terrain-relief.md), [Architektur](../../../ARCHITECTURE.md), [räumliche Dungeonanforderungen](../dungeon/smr04-spatial-coverage.md) und [Spieleranzeige](../runtime/player-projection.md). Die bisherigen Dokumente und Belege bleiben als Ausgangsstand erhalten; P0 gleicht ihre widersprechenden Zielvorgaben mit dieser Roadmap ab.

## 2. Technische Leitentscheidungen

**Ein Darstellungsweg für den gesamten Atlas.** Terrain, Kartenlinien, Gebäude, Innenräume und Bearbeitungsgriffe teilen Kamera, Koordinatentransformation und Tiefeninformationen. DOM bleibt für Bedienelemente und Texteingabe zuständig.

**Engineentscheidung durch einen frühen integrierten Vergleich.** Kandidat A ist MapLibre mit eigener ebener Projektion und eingebundenen räumlichen Zeichenebenen im selben Grafik-Kontext. Kandidat B ist ein gemeinsamer Three.js-Renderer mit eigener Kachel-, Kartografie- und Beschriftungsverwaltung. MapLibre bietet die dafür relevanten [Projektionsschnittstellen](https://maplibre.org/maplibre-gl-js/docs/guides/custom-crs/) und [Custom Layers](https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/); deren Eignung für unsere Bearbeitung ist damit noch nicht bewiesen.

Die Entscheidung folgt festen Regeln: Beide müssen dieselben Funktions- und Leistungsprüfungen bestehen. Bestehen beide, erhält MapLibre wegen der vorhandenen Karten- und Beschriftungsfunktionen Vorrang. Scheitert es an Weltkoordinaten, räumlicher Bearbeitung, gemeinsamer Tiefe oder Leistung, wird Three.js gewählt. Besteht keiner, bleibt diese Phase offen; es erfolgt keine Integration eines ungeeigneten Fundaments. Im Produkt wird anschließend nur der gewählte Weg weitergeführt.

**Kamera, Nachladen und Schreiben arbeiten unabhängig.** Kamerabewegung und Stiländerungen verwenden vorhandene GPU-Daten. Hintergrundarbeit liefert feste, räumlich adressierte Detailkacheln. Speichern erzeugt lokale Änderungen und Invalidierungen, keinen vollständigen Kartenneuaufbau.

**Darstellungsauflösung und Bearbeitungsauflösung bleiben getrennt.** Weniger sichtbare Details verändern weder gespeicherte Höhen noch Geometrien. Große Pinsel bearbeiten grobe Höhenanteile, ohne sämtliche feinen Weltkacheln durchlaufen zu müssen; lokale Details bleiben erhalten.

Die gemeinsamen internen Schnittstellen werden entsprechend aufgeteilt:

- **Kamerazustand:** Weltfokus, Abstand/Maßstab, Drehung, Neigung und Projektionsparameter; gemeinsame Projektion und Treffpunktberechnung.
- **Szenenkacheln:** räumliche Adresse, Detailstufe, Quellenrevision, Objekt-IDs sowie begrenzte Geometrie-/Höhen-/Materialpuffer. Vollständige Antworten und örtliche Änderungen.
- **Kartografische Darstellung:** Objektklasse, Bedeutung, übergeordnete Region, Beschriftungsanker und Darstellungsregeln. Marker, Fläche und Detailgeometrie verweisen auf dieselbe Objekt-ID.
- **Bearbeitungssitzung:** Gesten-ID, gültige Ausgangsrevision, Eingaben, unmittelbare Arbeitsfassung und bestätigte Änderungen. Main validiert und speichert; eine Geste bleibt ein Undo-Schritt.

## 3. Lieferphasen und Abschlusskriterien

### Beauftragte Umsetzung: vorhandenen Atlas weiterentwickeln

Der Nutzer hat die inkrementelle Umsetzung auf dem bestehenden Atlas bestätigt und den Enginevergleich ausdrücklich beibehalten. Vorhandene Oberfläche, Weltkoordinaten, Gelände-, Stadt- und Raummodelle, Werkzeughandler, stabile IDs, Main/SQLite-Befehle, Undo und Freigaben bleiben Grundlage. P0 ist eine begleitende Bestandsaufnahme, keine vorgeschaltete Neuentwicklung.

Als nächstes werden Kamera, Projektion, räumliche Treffer, Szenenaktualisierung und Ressourcenfreigabe hinter dem bestehenden Atlas angeschlossen. Der Three.js-Kandidat erweitert vorhandene Gelände-/Objektmodule; der MapLibre-Kandidat verwendet dieselben Daten und Gesten in derselben Hauptoberfläche und bindet räumliche Geometrie in den gemeinsamen GL-/Tiefenkontext ein. Es entstehen keine zwei neuen Anwendungen. Nach dem Vergleich bleibt ein Produktrenderer.

Für den ersten sichtbaren Ausschnitt werden bestehende Kampagnen und Prüfwelten verwendet; die bereits angelegte kleine Prüfwelt ergänzt Lücken. Große Lastfälle entstehen bei den jeweiligen Umsetzungsschritten. Der gesondert zu prüfende Landschaftsindex blockiert den Kameraanschluss nicht. Laufende Änderungen im gemeinsamen Checkout bleiben erhalten; benötigte Terrainverbesserungen werden gezielt in den isolierten Arbeitsstand übernommen.

Nach jedem Schritt: betroffene Typ-/Buildprüfungen und Regressionen, tatsächlicher nativer Ablauf, visuelle Kontrolle sowie je nach Änderung Speichern, Undo und frisches Öffnen. Gefundene Fehler werden vor abhängigen Schritten korrigiert. Die Reihenfolge P2–P8 und sämtliche Endkriterien bleiben verbindlich. P1 und der frühe Kameraanschluss aus P2 werden zusammen entwickelt; eine Engine wird erst nach dem gemeinsamen Funktions- und Leistungsvergleich ausgewählt.


### P0 — Umfang und vergleichbare Ausgangsbasis sichern

Arbeitsstand: [gesicherte Quellen, Inventar und reproduzierbare Prüfwelt](unified-atlas-baseline.md). P0 ist in Arbeit; seine Abschlusskriterien sind noch offen.

Alle vorhandenen Atlaswerkzeuge und Verbraucher inventarisieren und den zugehörigen Anforderungen zuordnen. Gemeinsamen Arbeitsstand einschließlich laufender Änderungen unverändert sichern; Implementierung später isoliert auf aktuellem `origin/main` beginnen und benötigte Änderungen gezielt übernehmen.

Eine reproduzierbare Prüfwelt erstellen: Küste, Inseln, Gebirge, Tal, Fluss, Straßen, Wald, hierarchische Regionen, Stadt mit Stadtteilen, Dorf und mehrgeschossige Innenräume. Kleine und große Varianten verwenden dieselben Gestaltungselemente. Große Varianten begleiten P3–P8 und sind keine Voraussetzung für den ersten integrierten Kameraausschnitt.

**Abschluss:** Werkzeugliste, feste Eingabefolgen, Screenshots und Messungen für den Ausgangsstand liegen vor. Die neue Roadmap ist mit `docs/INDEX.md`, den bestehenden Atlas-/Reliefplänen und den betroffenen Abnahme-IDs verbunden; ursprüngliche Quellenbindungen bleiben erhalten.

### P1 — Architektur mit einem vollständigen Ausschnitt entscheiden

Erster lokaler Teilanschluss: [perspektivische Kamera und Navigation mit ausstehenden Detailaufträgen im vorhandenen Three.js-Atlas](../../reference/atlas-perspective-camera-20261020/README.md). Der Enginevergleich und P1 bleiben offen.

Beide Kandidaten führen dieselbe kurze Aufgabe aus: Weltübersicht → Dorf → Gebäudeinnenraum, dabei drehen und neigen, Höhenlinien und Namen wechseln lassen, Gelände mit großem Pinsel bearbeiten, eine Wand ändern und beides rückgängig machen.

Bereits hier prüfen: negative und weit entfernte Weltkoordinaten, kleine Raumdetails, Gelände-Verdeckung, Geschossschnitt, scharfe Linien, Quellenwechsel und laufende Datenanforderungen. Beide Prototypen laufen im nativen Electron-Fenster auf dem Zielhost.

**Abschluss:** Ein Kandidat erfüllt den funktionalen Mindestumfang und die Leistungsziele. Die Entscheidung dokumentiert verbleibende Implementierungsarbeit; ein reiner Kartenbetrachter zählt nicht als bestandener Prototyp.

### P2 — Gemeinsame Kamera und räumliche Atlasfläche integrieren

Den gewählten Renderer hinter die bestehende Atlasoberfläche setzen. Eine Kamera steuert sämtliche Inhalte, Auswahlrahmen, Griffe und Messungen. Kameranahe GPU-Koordinaten und geeignete Tiefenbereiche verhindern Zittern und Flächenflimmern zwischen Welt- und Raummaßstab.

Zoom bleibt am anvisierten Weltpunkt verankert. Fenstergrößenwechsel, Suchsprünge und Rückkehr zur Draufsicht erhalten den räumlichen Zusammenhang. Neigen oder Drehen erzeugt keinen Ansichtswechsel.

**Abschluss:** Die gesamte Prüfwelt ist in einer Fläche navigierbar und auswählbar. Mittelpunkt, Auswahl und Werkzeug bleiben über alle Kamerabewegungen stabil.

### P3 — Weltweites Streaming und Detailstufen aufbauen

Feste Weltkacheln mit vereinfachten Darstellungen und lokal feineren Daten einführen. Die sichtbare Größe beziehungsweise der projizierte Fehler entscheidet über die benötigte Detailstufe; bei geneigter Kamera erhält der Vordergrund mehr Details.

Vorhandene gröbere Kacheln bleiben bis zur Ablösung sichtbar. Nachbarschaft und erwartetes Zoomziel werden begrenzt vorgeladen. Überholte Aufgaben werden abgebrochen, fertige Puffer schrittweise hochgeladen. Änderungen invalidieren nur betroffene Kacheln und deren notwendige Ableitungen.

Caches bleiben begrenzt. Im Vergleich werden 64/128/256 MiB je relevanter Cacheklasse geprüft; die kleinste Konfiguration, die die Ziele erreicht, wird festgelegt. GPU-, Arbeits- und Prozessspeicher werden zusätzlich erfasst.

**Abschluss:** Kalte und warme Navigation bleiben bedienbar; Weltgröße führt nicht zu vollständigen Weltlesungen. Nach wiederholten Reisen zwischen entfernten Orten werden ungenutzte Ressourcen freigegeben. Lokale Bearbeitung wird nicht wegen eines anderswo fehlenden Details gesperrt.

### P4 — Semantischen Zoom und kartografische Gestaltung vervollständigen

Für alle Objektklassen gemeinsame Maßstabsregeln einführen:

- Küsten bleiben eigene scharfe Konturen; Relief und Bodenfarben werden getrennt gestaltet.
- Höhenlinien behalten ihre tatsächlichen Höhen. Hauptlinien bleiben bestehen, Zwischenlinien werden schrittweise ergänzt; automatische Intervalle sind Standard, feste Intervalle bleiben wählbar.
- Straßen und Flüsse erhalten vereinfachte Verläufe, kontrollierte Bildschirmbreiten und maßstabsabhängige Namen.
- Regionen, Städte und Stadtteile erhalten hierarchische Flächen, Grenzen und Beschriftungen. Bedeutende Siedlungen wechseln zwischen Marker, Fläche und Bebauung.
- Namen verwenden Prioritäten, alternative Positionen, Linienbeschriftung und gemeinsame Überlappungsprüfung über Kachelgrenzen hinweg.
- Ein-/Ausblendschwellen besitzen Übergangsbereiche gegen Flackern. Übergänge beginnen unmittelbar; kurze Überblendungen ersetzen verspätetes Aufpoppen.
- Automatische Platzierung erhält manuelle Beschriftungspositionen und Bedeutungsangaben. Ausgewählte Objekte bleiben im GM-Editor auffindbar.

**Abschluss:** Langsamer Zoom, schneller Zoom und wiederholte Richtungswechsel liefern lesbare, stabile Übergänge. Die Landschaft verändert dabei weder ihre Form noch ihre Objektidentitäten. Gezeichneter Kartenstil, Analyseansichten und 200-%-Darstellung werden visuell geprüft.

### P5 — Unmittelbare Terrainbearbeitung auf allen Maßstäben

Land formen, Glätten und Bemalen verändern während der Eingabe unmittelbar eine lokale Arbeitsfassung derselben Karte. Dafür gibt es keinen separaten Vorschaumodus und keinen Übernehmen-Knopf. Bestätigte Teilstücke werden weiterhin automatisch gespeichert.

Berechnung und Übertragung beschränken sich auf betroffene Höhenbänder und Kachelbereiche. Grobe Änderungen erhalten feine Geländeanteile; Glätten und Zielhöhen berücksichtigen die gewählte Bearbeitungsskala. Bestehende Schutzregeln für Straßen, Flussbetten und manuell korrigierte Objekte bleiben wirksam.

Sichtbare Oberfläche, Pinselradius und Verdeckung werden für die räumliche Geste konsistent bestimmt. Arbeitsfassung und kanonisches Ergebnis werden abgeglichen. Fehler oder unbekannte Bestätigungen dürfen keine ungespeicherten Änderungen als gespeichert ausweisen.

**Abschluss:** Kleine, große, lange, schnelle und stationäre Züge reagieren sichtbar innerhalb des Ziels. Küsten und Relief folgen während des Ziehens. Undo/Redo, Fokusverlust, Escape, Schreibfehler und Neustart erhalten die festgelegte Gestensemantik.

### P6 — Sämtliche Atlaswerkzeuge räumlich anschließen

Alle in P0 erfassten Werkzeuge in die gemeinsame Fläche übernehmen: Linien, Flächen, Regionen, Referenzbilder, Symbole, Bewuchs, Stadtgestaltung, Gebäude, Räume, Wände, Türen, Treppen, Einrichtung, Volumen und zugehörige Keys.

Innenräume werden über vorhandene Geschoss-/Schnittfunktionen zugänglich. Für das aktive Geschoss werden verdeckende Dächer und darüberliegende Geschosse ausgeblendet; die Kamera bleibt frei. Eine sichtbare Arbeitsebene und Höhen-/Flächentreffer ermöglichen zuverlässiges Zeichnen und Verschieben. Oberflächennahe Verdeckung und Auswahl mehrerer überlagerter Objekte bleiben kontrollierbar.

Rein zweidimensionale Assets bleiben zulässig und werden ihrer passenden Welt- oder Arbeitsebene zugeordnet. Räumliche Darstellung erzeugt keine zweite fachliche Geometrie.

**Abschluss:** Welt → Stadt → Haus → Raum und zurück funktioniert ausschließlich durch Navigation und Werkzeugwahl. Gelände, Straße, Haus und Raum lassen sich in einer gemeinsamen Undo-Folge bearbeiten; Texte, IDs und Verknüpfungen bleiben korrekt.

### P7 — Ausgabe, Spieleranzeige und Wiederherstellung integrieren

PNG/JPEG bis mindestens 8.192 × 8.192 Pixel aus demselben Szenen- und Stilmodell erzeugen. Export besitzt einen festgehaltenen Quellenstand und eine eigene Ausgabe-Kamera, beeinflusst aber die Editoransicht nicht. Große Ausgaben werden gekachelt; Beschriftung und Linienbreite richten sich nach dem Ausgabeformat.

Die Spieleranzeige verwendet dieselben Darstellungsregeln mit ausschließlich freigegebenen Daten. Unbestätigte Bearbeitungen und GM-Inhalte gelangen nicht in ihre Kacheln, Labels oder Auswahlinformationen.

GPU-Verlust, Workerfehler, Quellenwechsel und Neustart werden behandelt. Der Renderer baut bestätigte Inhalte wieder auf, ohne auf die bisherige separate 2D-Ansicht auszuweichen.

**Abschluss:** Darstellung, Export und Spieleranzeige stimmen für denselben freigegebenen Inhalt überein. Fehlerproben erhalten gespeicherte Daten, korrekte Freigaben und einen nachvollziehbaren Bearbeitungsstand.

### P8 — Gesamtprodukt qualifizieren und alten Weg ablösen

Den vollständigen Arbeitsablauf auf kleinen und großen Kampagnen durchführen. Längere Sitzungen mit Navigation, Terrainzügen, Stadt-/Raumbearbeitung und Export prüfen. Erst nach belegter Funktionsdeckung die alten getrennten Renderer und überflüssigen Raster-/Ladewege entfernen.

Betroffene Capability-Einträge mit tatsächlichen Testdateien verbinden und Prüfungen mit `--geprueft` vermerken. Dokumentation, Bedienhinweise und Architekturentscheidungen auf den neuen Atlas ausrichten.

**Abschluss:** Lokale Prüfungen, native Bedienung, erforderliche Candidate-CI am exakten SHA, lineare Integration nach `main`, Linux-Paketierung und Prüfung des installierten Builds sind jeweils separat belegt. Eine Nutzerabnahme wird nur nach tatsächlicher Rückmeldung als solche geführt.

## 4. Verbindliche Abnahme und Testfälle

| Bereich | Ziel |
| --- | --- |
| Gewöhnliche Navigation | 60-FPS-Ziel auf dem Laptop des Nutzers bei 1080p; Bildintervalle p95 ≤16,7 ms, p99 ≤33,3 ms |
| Kamerareaktion und vorbereitete Stilwechsel | Reaktion im nächsten darstellbaren Bild; kein Warten auf Datenbank oder neue Kacheln |
| Terrainpinsel | Erste tatsächliche Gelände-/Farbänderung p95 ≤100 ms; laufende Änderungen während des Ziehens |
| Lokale Raum-/Objektvorschau | p95 ≤50 ms |
| Kaltes Öffnen | Nutzbare grobe Übersicht p95 ≤2 s; weitere Details laden ohne Navigationsblockade |
| Gewöhnliche lokale Speicherung | p95 ≤500 ms; Anzeige wartet darauf nicht |
| Längere Aufgaben | Fortschritt binnen 100 ms; über 2 s abbrechbar, ohne Kamera und unabhängige Auswahl zu blockieren |
| Ressourcen | Begrenzte Caches und Speicherplateau bei wiederholten Navigations-/Bearbeitungszyklen über mindestens 30 Minuten |

Die große Prüfwelt enthält die vorhandene Zielausdehnung von **40.000 × 20.000 km**, 100.000 bearbeitete Hexes, 5.000 Orte und 50 Detailbereiche; zusätzlich eine Stadt mit 5.000 Gebäuden, einen Dungeon mit über 4.000 Entitäten und einen separaten Volumenlastfall mit 100.000 Zellen. Wachstum außerhalb dieser Ausdehnung wird ebenfalls geprüft.

Gemessen werden getrennt: kaltes/warmes Laden, Eingabe bis Bildänderung, tatsächliche Bildintervalle, Speicher und Speicherung. Reine JavaScript-Laufzeiten oder ein fortgeschrittener Revisionszähler gelten nicht als sichtbare Reaktion.

Besondere Regressionen sind Kachelnähte, negative und weit entfernte Koordinaten, Wechsel zwischen Marker und Gebäude bei bestehender Auswahl, flackernde Namen, wandernde Höhenlinien, feine Details unter großen Pinseln, verdeckte Raumflächen, verzögerte Antworten, verlorene Speicherbestätigungen und Spielerfreigaben.

Jede Phase erhält Funktions-, Leistungs- und visuelle Belege. Verfehlte Ziele bleiben offen; das vollständige Produkt ist erst nach P8 erreicht.
