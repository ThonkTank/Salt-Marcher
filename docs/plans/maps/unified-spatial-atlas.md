# Roadmap: ein durchgehend räumlicher SaltMarcher-Atlas

Stand: 20.10.2026. Im Gespräch vorgeschlagene und zur Umsetzung beauftragte Roadmap, anschließend auf Nutzerwunsch im Repository abgelegt. Die Ablage ist kein Implementierungs- oder Abnahmenachweis; P0–P8 sind durch diese Ablage nicht abgeschlossen.

## 1. Verbindliches Produktziel

SaltMarcher erhält **eine gemeinsame Kartenfläche mit einer perspektivischen Kamera**. Sie schaut standardmäßig senkrecht nach unten und lässt sich jederzeit drehen und neigen. Welt, Landschaft, Stadt, Gebäude und Innenraum gehören zu derselben bearbeitbaren Welt.

Der Atlas soll auf allen sinnvollen Maßstäben als flüssiger Editor und Map Explorer funktionieren. Lesbare, ansprechende Darstellung schließt ausdrücklich Wälder/Bäume und andere Geländeassets, Straßen- und Flussdarstellung samt Texturen sowie Gebäude und Regionen ein. Ihre Größe, Detailtiefe und Sichtbarkeit müssen sich sinnvoll mit der Zoomstufe ändern.

Der Zoom verändert kontinuierlich die Darstellung und Informationsdichte: Küsten bleiben scharf, Höhenlinien werden sinnvoll ergänzt, Straßen und Flüsse bleiben lesbar, Namen wechseln nach Bedeutung und verfügbarem Platz. Gezeichnete Gebiete und einzelne Objekte erhalten passende Detailstufen; eigenständige Stadtmarker oder automatisch aus einer Dokumenthülle abgeleitete Stadtnamen entfallen. Auswahl, Werkzeuge und History bleiben durchgehend erhalten.

Festgelegt:

- **Ebener, wachsender Meterraum**, ohne feste Kartenränder oder Weltkugel.
- Perspektivische Kamera mit 360° Drehung und zunächst 0–75° Neigung aus der Senkrechten. Draufsicht und Nordausrichtung sind unmittelbar erreichbar.
- **Räumliche Bearbeitung auch innerhalb von Gebäuden und Dungeons.** Keine erzwungene Rückkehr zur Draufsicht.
- Auf der Karte gibt es ausschließlich unabhängige Objekte wie Straßen, Gebäude und Plätze. Benutzer können darüber beliebige benannte Gebiete malen. Diese Gebiete definieren oder besitzen keine Stadt und keine enthaltene Geometrie: Anlegen, Umformen, Verschieben und Löschen eines Gebietes verändert kein Objekt. Alte Stadtdokumente dürfen weder Papier, Marker, Namen noch unsichtbare Grenzen erzeugen. Ihre bisherigen Speicherzuordnungen sind Übergangsdetails, keine fachliche Zugehörigkeit.
- Gesamter vorhandener Atlasumfang einschließlich Terrain, Bewuchs, Straßen, Gewässern, Regionen, Beschriftungen, Stadt-/Dungeonwerkzeugen, Ausgabe und Spieleranzeige.
- Noch offene, davon unabhängige Stadt-/Dungeon-Paritätsfeatures bleiben in ihren Fachroadmaps.
- Bestehende Kampagnen sind unwichtige Testdaten: neue Testkampagnen und erforderliche Schemaänderungen sind zulässig. Bestehende Dateien werden nicht gelöscht oder stillschweigend umgedeutet.
- Electron, TypeScript, SQLite, lokale Offline-Nutzung und Main als einzige Schreibinstanz bleiben die Grundlage.

Die neue Roadmap ersetzt die bisherigen Vorgaben für getrennte Drauf-/Kippdarstellung. Bereits belegte Fachfunktionen werden übernommen; ihre Eignung im neuen Atlas wird erneut geprüft.

Einordnung: [Atlas-Roadmap](../../../ROADMAP-HEX-ATLAS.md), [bisherige Relief-Roadmap](terrain-relief.md), [Architektur](../../../ARCHITECTURE.md), [räumliche Dungeonanforderungen](../dungeon/smr04-spatial-coverage.md) und [Spieleranzeige](../runtime/player-projection.md). Die bisherigen Dokumente und Belege bleiben als Ausgangsstand erhalten; P0 gleicht ihre widersprechenden Zielvorgaben mit dieser Roadmap ab.

## 2. Technische Leitentscheidungen

**Ein Darstellungsweg für den gesamten Atlas.** Terrain, Kartenlinien, Gebäude, Innenräume und Bearbeitungsgriffe teilen Kamera, Koordinatentransformation und Tiefeninformationen. DOM bleibt für Bedienelemente und Texteingabe zuständig.

**Bestehende Atlas-Technik schrittweise verbessern.** Auf ausdrücklichen Nutzerwunsch vom 20.10.2026 entfällt der MapLibre-Vergleich. Der vorhandene Atlas mit Canvas2D, Three.js-Gelände, kanonischen Daten und Werkzeugen ist die Grundlage. Kamera, Datenversorgung und Darstellung werden dort verbessert und anschließend für die gemeinsame räumliche Fläche zusammengeführt. Die bisher begonnenen MapLibre-Adapter und Abhängigkeiten werden nicht übernommen.

Die Entscheidung für diesen Arbeitsweg ersetzt keine Funktions- oder Leistungsprüfung. Der vorhandene Renderer muss dieselben Produktziele erreichen; seine verbleibenden Grenzen werden pro Schritt geprüft und behoben.

**Kamera, Nachladen und Schreiben arbeiten unabhängig.** Kamerabewegung und Stiländerungen verwenden vorhandene GPU-Daten. Hintergrundarbeit liefert feste, räumlich adressierte Detailkacheln. Speichern erzeugt lokale Änderungen und Invalidierungen, keinen vollständigen Kartenneuaufbau.

**Darstellungsauflösung und Bearbeitungsauflösung bleiben getrennt.** Weniger sichtbare Details verändern weder gespeicherte Höhen noch Geometrien. Große Pinsel bearbeiten grobe Höhenanteile, ohne sämtliche feinen Weltkacheln durchlaufen zu müssen; lokale Details bleiben erhalten.

Die gemeinsamen internen Schnittstellen werden entsprechend aufgeteilt:

- **Kamerazustand:** Weltfokus, Abstand/Maßstab, Drehung, Neigung und Projektionsparameter; gemeinsame Projektion und Treffpunktberechnung.
- **Szenenkacheln:** räumliche Adresse, Detailstufe, Quellenrevision, Objekt-IDs sowie begrenzte Geometrie-/Höhen-/Materialpuffer. Vollständige Antworten und örtliche Änderungen.
- **Kartografische Darstellung:** Objektklasse, Bedeutung, übergeordnete Region, Beschriftungsanker und Darstellungsregeln. Marker, Fläche und Detailgeometrie verweisen auf dieselbe Objekt-ID.
- **Bearbeitungssitzung:** Gesten-ID, gültige Ausgangsrevision, Eingaben, unmittelbare Arbeitsfassung und bestätigte Änderungen. Main validiert und speichert; eine Geste bleibt ein Undo-Schritt.

## 3. Lieferphasen und Abschlusskriterien

### Beauftragte Umsetzung: vorhandenen Atlas weiterentwickeln

Der Nutzer hat die inkrementelle Umsetzung auf dem bestehenden Atlas bestätigt; mit seiner jüngsten Anweisung entfällt der Enginevergleich. Vorhandene Oberfläche, Weltkoordinaten, Gelände-, Stadt- und Raummodelle, Werkzeughandler, stabile IDs, Main/SQLite-Befehle, Undo und Freigaben bleiben Grundlage. P0 ist eine begleitende Bestandsaufnahme, keine vorgeschaltete Neuentwicklung.

Die jüngste Nutzerkorrektur priorisiert jetzt den Anschluss an die **normale Atlasfläche**: Kippen darf keine separate Geländeansicht aktivieren und ein Werkzeugwechsel darf die Kamera nicht zurücksetzen. Der bisherige Kamera-/Konturen-PR bleibt bis zum belegten Anschluss ein Entwurf.

KISS, Single Responsibility, DRY und modulare Zuständigkeiten gelten ausdrücklich: vorhandene Werkzeughandler und numerische Zeichenkommandos werden weiterverwendet; eine kleine Präsentationsschnittstelle verbindet Kamera, Projektion und Treffer. GPU-Geometrie, Textdarstellung und Terrain-Datenversorgung bleiben getrennte Besitzer. Eine parallele Implementierung jedes Autorenwerkzeugs ist nicht vorgesehen.

Kamera, Projektion, räumliche Treffer, Szenenaktualisierung und Ressourcenfreigabe werden direkt im bestehenden Atlas verbessert. Zuerst bleiben Kamerabewegungen von Nachladen und Geländeaufbau unabhängig. Danach folgen wiederverwendbare Bereichsdaten, scharfe Kartografie und unmittelbare Terrainbearbeitung. Vorhandene Gelände-/Objektmodule werden erweitert; bereits funktionierende Werkzeuge bleiben angeschlossen.

Der aktualisierte Auftrag erlaubt freie technische Änderungen einschließlich des Backends, solange das geforderte Verhalten erreicht wird. Ein Abschluss erfordert anschließend drei vollständige kritische Untersuchungen ohne weiteren Arbeitsfund; einzelne grüne Tests zählen nicht als diese Abschlussprüfungen. Solange bekannte Lücken bestehen, bleibt die Optimierung in Arbeit.

Für den ersten sichtbaren Ausschnitt werden bestehende Kampagnen und Prüfwelten verwendet; die bereits angelegte kleine Prüfwelt ergänzt Lücken. Große Lastfälle entstehen bei den jeweiligen Umsetzungsschritten. Der gesondert zu prüfende Landschaftsindex blockiert den Kameraanschluss nicht. Laufende Änderungen im gemeinsamen Checkout bleiben erhalten; benötigte Terrainverbesserungen werden gezielt in den isolierten Arbeitsstand übernommen.

Nach jedem Schritt: betroffene Typ-/Buildprüfungen und Regressionen, tatsächlicher nativer Ablauf, visuelle Kontrolle sowie je nach Änderung Speichern, Undo und frisches Öffnen. Gefundene Fehler werden vor abhängigen Schritten korrigiert. Die Endkriterien von P2–P8 bleiben verbindlich; ihre technische Reihenfolge darf nach Wirkung und Abhängigkeiten angepasst werden. P1 und der frühe Kameraanschluss aus P2 werden zusammen entwickelt. Der integrierte Ausschnitt prüft die Verbesserungen am bestehenden Atlas; ein externer Enginevergleich ist keine Voraussetzung.


### P0 — Umfang und vergleichbare Ausgangsbasis sichern

Arbeitsstand: [gesicherte Quellen, Inventar und reproduzierbare Prüfwelt](unified-atlas-baseline.md). P0 ist in Arbeit; seine Abschlusskriterien sind noch offen.

Alle vorhandenen Atlaswerkzeuge und Verbraucher inventarisieren und den zugehörigen Anforderungen zuordnen. Gemeinsamen Arbeitsstand einschließlich laufender Änderungen unverändert sichern; Implementierung später isoliert auf aktuellem `origin/main` beginnen und benötigte Änderungen gezielt übernehmen.

Eine reproduzierbare Prüfwelt erstellen: Küste, Inseln, Gebirge, Tal, Fluss, Straßen, Wald, hierarchische Regionen, Stadt mit Stadtteilen, Dorf und mehrgeschossige Innenräume. Kleine und große Varianten verwenden dieselben Gestaltungselemente. Große Varianten begleiten P3–P8 und sind keine Voraussetzung für den ersten integrierten Kameraausschnitt.

**Abschluss:** Werkzeugliste, feste Eingabefolgen, Screenshots und Messungen für den Ausgangsstand liegen vor. Die neue Roadmap ist mit `docs/INDEX.md`, den bestehenden Atlas-/Reliefplänen und den betroffenen Abnahme-IDs verbunden; ursprüngliche Quellenbindungen bleiben erhalten.

### P1 — Vorhandenen Atlas an einem vollständigen Ausschnitt verbessern

Erster lokaler Teilanschluss: [perspektivische Kamera und Navigation mit ausstehenden Detailaufträgen im vorhandenen Three.js-Atlas](../../reference/atlas-perspective-camera-20261020/README.md). P1 bleibt offen; der Vergleich mit MapLibre wurde auf Nutzerwunsch eingestellt.

Der bestehende Atlas wird schrittweise für diese kurze Aufgabe vervollständigt: Weltübersicht → Dorf → Gebäudeinnenraum, dabei drehen und neigen, Höhenlinien und Namen wechseln lassen, Gelände mit großem Pinsel bearbeiten, eine Wand ändern und beides rückgängig machen.

Bereits hier prüfen: negative und weit entfernte Weltkoordinaten, kleine Raumdetails, Gelände-Verdeckung, Geschossschnitt, scharfe Linien, Quellenwechsel und laufende Datenanforderungen. Die Verbesserungen werden im nativen Electron-Fenster auf dem Zielhost geprüft.

**Abschluss:** Der verbesserte Atlas erfüllt den funktionalen Mindestumfang und die Leistungsziele des Ausschnitts. Verbleibende Implementierungsarbeit ist dokumentiert; reine Navigation ohne Bearbeitung genügt nicht.

### P2 — Gemeinsame Kamera und räumliche Atlasfläche integrieren

Aktualisiertes Objektmodell: [unabhängige Geometrie und gemalte Gebiete](../../reference/atlas-independent-objects-20261020/README.md). Sichtbarkeit, Zoom und Ausgabe lösen keine Stadtmarker mehr aus; die Ablösung alter Stadt-Einstiege in den Autorenwerkzeugen bleibt offen.

Lokaler Teilanschluss: [Hauptkamera, normale Raumbearbeitung und Stadtobjekte auf der Landschaft](../../reference/atlas-main-surface-20261020/README.md). Neigen und Werkzeugwechsel behalten dieselbe Fläche; das historische Stadtpapier entfällt. Gebäudevolumen, Geschosse, vollständige Detailstufen und Ausgabe bleiben offen.

Die vorhandenen Zeichenebenen unter der gemeinsamen Kamera in der bestehenden Atlasoberfläche zusammenführen. Eine Kamera steuert sämtliche Inhalte, Auswahlrahmen, Griffe und Messungen. Kameranahe GPU-Koordinaten und geeignete Tiefenbereiche verhindern Zittern und Flächenflimmern zwischen Welt- und Raummaßstab.

Zoom bleibt am anvisierten Weltpunkt verankert. Fenstergrößenwechsel, Suchsprünge und Rückkehr zur Draufsicht erhalten den räumlichen Zusammenhang. Neigen oder Drehen erzeugt keinen Ansichtswechsel.

**Abschluss:** Die gesamte Prüfwelt ist in einer Fläche navigierbar und auswählbar. Mittelpunkt, Auswahl und Werkzeug bleiben über alle Kamerabewegungen stabil.

### P3 — Weltweites Streaming und Detailstufen aufbauen

[Weniger unnötige Rasterarbeit](../../reference/atlas-raster-slices-20261021/README.md): Der vorhandene Fallback zeichnet nur angeforderte Teile seiner Weltkacheln, bei gleicher Auflösung und gleichem Halo. Ebene Flächen überspringen überflüssige Schattierung auch in normalen Farbtiles. Der gepaarte Binnenlandfall ist pixelgleich und deutlich schneller; das ersetzt weder sofortige Wiederherstellung noch die allgemeine Kaltlade-/Großweltqualifikation.

[Unterbrechbare Farbschichten](../../reference/atlas-pigment-scheduling-20261021/README.md): Große Pigmentflächen geben den bestehenden Readonly-Worker auch innerhalb ihrer Berechnung frei. Begrenzte, indexierte Leseseiten schließen SQLite-Abfragen vor jedem Haltepunkt. Gepaarte pixelgleiche Ausgaben zeigen deutlich kürzere Auswahlwartezeiten, aber keinen belegten Gewinn für die gesamte kalte Detailverfeinerung. Kontextpakete bleiben nach einer ungünstigen Latenzprobe klein; weitere synchrone Arbeit und die vollständige Leistungsabnahme bleiben offen. [Direktes Setzen deckender Polygonabschnitte](../../reference/atlas-opaque-spans-20261021/README.md) senkt anschließend die vollständige Verfeinerungszeit im bemalten Lastfall im Mittel um etwa 40 %, bei identischen Pixeln. Die verbliebenen rund 17 Sekunden erfüllen das Ladeziel weiterhin nicht.

[Neigungsabhängige Abdeckung und Horizont](../../reference/atlas-terrain-coverage-20261021/README.md): Die normale Hauptkamera fordert beim Neigen weiteren Kontext an. Ein begrenztes Netz behält seine feine Mitte und verwendet gröbere Außenbänder; Straßen und Flüsse folgen derselben Abtastung. Eine gemeinsame atmosphärische Grenze gilt für Bild, Treffer und Pinsel. Das schließt die rechteckigen Lücken des bisherigen festen Ausschnitts, ersetzt aber noch kein weltweites Kachel-LOD. Grafik-Fallback, kaltes Laden, dichte Objekte und lange Sitzungen bleiben offen.

Erster lokaler Teilschritt: [bestehende Geländeausschnitte bei kleinen Kameraänderungen wiederverwenden](../../reference/atlas-surface-reuse-20261020/README.md). Dies beseitigt unnötige Neuaufträge, ersetzt aber noch kein Kachel-LOD und keine Leistungsabnahme.

[Weiterer Teilschritt im Hauptatlas](../../reference/atlas-focus-grid-20261021/README.md): Das vorhandene Geländenetz konzentriert Knoten auf die sichtbare Mitte, mit gemeinsamen Randknoten und identischer Autoren-Sichtprüfung. Eine feinere Textur ergänzt den gröberen Kontext. Readonly-Projektion und Main-Autorcache verwenden dieselbe Bandaufteilung. Kalte Rasterarbeit wird gebündelt; lokale Änderungen bleiben klein. Die [Hauptfläche lädt inzwischen in zwei Stufen](../../reference/atlas-progressive-20261021/README.md): gleiche vollständige Geometrie mit kleiner Farbtextur, anschließend feinere Farbe. Pinselgesten widerrufen verspätete Details. [Normale Detailprojektionen geben den Worker inzwischen zwischen Rasterpaketen frei](../../reference/atlas-scheduling-20261021/README.md); Auswahl, Kamera und Autorenarbeit haben Vorrang, Fortsetzungen prüfen die Revision erneut. [Doppelte Boden-PNGs entfallen im Hauptatlas](../../reference/atlas-ground-raster-20261021/README.md); dichte Landschaftsobjekte bleiben als transparente Ebene erhalten und Grafikfallback lädt vollständigen Boden nach. [Weltfeste Farbkacheln erscheinen inzwischen schrittweise](../../reference/atlas-color-tiles-20261021/README.md): 256er-Kacheln von der Mitte aus, begrenzter Renderer-Cache, Wiederverwendung bei Pan und weiche Übergänge zu fehlenden Nachbarn. Die erste feine Farbe kommt früher, die vollständige Verfeinerung kostet durch die höhere Pixeldichte noch mehr Zeit. [Der gemeinsame Rasterkern vermeidet inzwischen wiederholte Achsenberechnung und unsichtbare Schattierung](../../reference/atlas-color-cost-20261021/README.md). Größere Farbbatches erhalten Unterbrechungspunkte innerhalb der Höhen- und Reliefberechnung; ein Pixelvergleich bewahrt die bisherige Ausgabe. Weltweites Geometrie-LOD, weitere teure Readonly-Aufträge, die Qualität noch fehlender Details und die gesamte Leistungsabnahme bleiben offen.

Feste Weltkacheln mit vereinfachten Darstellungen und lokal feineren Daten einführen. Die sichtbare Größe beziehungsweise der projizierte Fehler entscheidet über die benötigte Detailstufe; bei geneigter Kamera erhält der Vordergrund mehr Details.

Vorhandene gröbere Kacheln bleiben bis zur Ablösung sichtbar. Nachbarschaft und erwartetes Zoomziel werden begrenzt vorgeladen. Überholte Aufgaben werden abgebrochen, fertige Puffer schrittweise hochgeladen. Änderungen invalidieren nur betroffene Kacheln und deren notwendige Ableitungen.

Caches bleiben begrenzt. Im Vergleich werden 64/128/256 MiB je relevanter Cacheklasse geprüft; die kleinste Konfiguration, die die Ziele erreicht, wird festgelegt. GPU-, Arbeits- und Prozessspeicher werden zusätzlich erfasst.

**Abschluss:** Kalte und warme Navigation bleiben bedienbar; Weltgröße führt nicht zu vollständigen Weltlesungen. Nach wiederholten Reisen zwischen entfernten Orten werden ungenutzte Ressourcen freigegeben. Lokale Bearbeitung wird nicht wegen eines anderswo fehlenden Details gesperrt.

[Weitere lokale P3-Verbesserung](../../reference/atlas-height-lattice-20261021/README.md): Quellhöhen werden vor der Interpolation auf einem kompakten, begrenzten Raster geteilt. Die vorhandene Oberfläche bleibt pixelgleich, die gepaarten Feldkernproben benötigen deutlich weniger Zeit. Hauptatlas, Live-Bearbeitung und Küstenverfeinerung sind erneut nativ geprüft. Das ersetzt keine weltweite LOD- oder Lastabnahme.

[Lokale Farberhaltung nach Terrainänderungen](../../reference/atlas-color-retention-20261021/README.md): Der Readonly-Worker bestätigt eine begrenzte, lückenlose Änderungskette seit der gehaltenen Farbe. Der Renderer verwirft nur betroffene Kacheln einschließlich Rasterhalo und übernimmt die unveränderten Details bereits in die nächste Übersicht. Die bestätigte Live-Pinseltextur füllt die bearbeitete Fläche bis zur feinen Nachladung. Unbekannte Quellen, globale Änderungen, fehlende Historie und veraltete Antworten bleiben gesperrt. Dieser Teilschritt ersetzt keine vollständige Latenz- oder Großweltqualifikation.

### P4 — Semantischen Zoom und kartografische Gestaltung vervollständigen

Erster lokaler Teilschritt: [GPU-Höhenlinien mit konstanter Strichbreite und unmittelbarem Intervallwechsel](../../reference/atlas-gpu-contours-20261020/README.md). [Im Repository und nativen Entwicklungsstart geprüft](../../reference/atlas-contour-zoom-20261021/README.md): automatische, kontinuierlich überblendete Höhenintervalle sind Standard; feste Intervalle bleiben wählbar. Die perspektivische Ausgabe nutzt dasselbe GPU-Material, der Canvasfallback dieselben Abstandsregeln. Weitere Objektklassen, Küstenkonturen und vollständige visuelle Zoomabnahme bleiben offen.

Weiterer lokaler Teilschritt: [Höhenlinienlesbarkeit bei 100/200 %](../../reference/atlas-contour-readability-20261021/README.md). Ein isolierter Vergleich am Produktrenderer begründet 24 logische Pixel als Zielabstand; Hauptatlas und Rasterausgabe berücksichtigen die jeweilige Abtastdichte. Automatische und feste Linien behalten ihre Höhen und logischen Strichbreiten. Die eigentliche Höhengeometrie, kantige grobe Pinsel-/Quelldaten, Küstenschärfe und allgemeine Zoomleistung bleiben davon unverbessert; P4 ist weiterhin offen.

Der [isolierte Interpolationsversuch](../../reference/atlas-height-lattice-20261021/README.md#glattere-rekonstruktion-noch-nicht-integriert) ist inzwischen als [gemeinsame begrenzte Höhenrekonstruktion](../../reference/atlas-height-reconstruction-20261021/README.md) angeschlossen: kanonische Punktabfrage und Stream verwenden denselben Kernel; Lesebereiche, Invalidierung, Bestand und History berücksichtigen den zweiten Nachbarknoten. Knotenwerte und additive Bänder bleiben erhalten. Das beseitigt die linearen Knicke zwischen groben Höhenknoten; vollständige Kartengestaltung, Küstenschärfe und Leistungsqualifikation bleiben offen.

Für alle Objektklassen gemeinsame Maßstabsregeln einführen:

- Küsten bleiben eigene scharfe Konturen; Relief und Bodenfarben werden getrennt gestaltet.
- Höhenlinien behalten ihre tatsächlichen Höhen. Hauptlinien bleiben bestehen, Zwischenlinien werden schrittweise ergänzt; automatische Intervalle sind Standard, feste Intervalle bleiben wählbar.
- Straßen und Flüsse erhalten vereinfachte Verläufe, kontrollierte Bildschirmbreiten und maßstabsabhängige Namen.
- Benutzer malen unabhängige Gebietsflächen mit Grenzen und Beschriftungen über die Geometrie. Bezeichnungen wie Stadt oder Stadtteil sind ausschließlich Typen dieser Overlays; darunterliegende Objekte bleiben unabhängig. Dokumenthüllen erzeugen keine zusätzlichen Marker oder Beschriftungen.
- Namen verwenden Prioritäten, alternative Positionen, Linienbeschriftung und gemeinsame Überlappungsprüfung über Kachelgrenzen hinweg.
- Ein-/Ausblendschwellen besitzen Übergangsbereiche gegen Flackern. Übergänge beginnen unmittelbar; kurze Überblendungen ersetzen verspätetes Aufpoppen.
- Automatische Platzierung erhält manuelle Beschriftungspositionen und Bedeutungsangaben. Ausgewählte Objekte bleiben im GM-Editor auffindbar.

**Abschluss:** Langsamer Zoom, schneller Zoom und wiederholte Richtungswechsel liefern lesbare, stabile Übergänge. Die Landschaft verändert dabei weder ihre Form noch ihre Objektidentitäten. Gezeichneter Kartenstil, Analyseansichten und 200-%-Darstellung werden visuell geprüft.

[Schmalere Küstenzeichnung](../../reference/atlas-coast-ink-20261021/README.md): Der breite braune Küstensaum entfällt zugunsten unmittelbarer Wasser-/Land-Kanten im zweifachen Raster. Stilvergleich, Pixelgoldens und normale Hauptatlas-/Export-/Undo-Proben liegen vor. Die Linie bleibt rastergebunden; grobe Kontexttexturen und Bildschirmbreite unter allen Perspektiven bleiben offen.

[Lesbare Vektorverläufe](../../reference/atlas-route-scale-20261021/README.md): Straßen und Flüsse erhalten eine schmale Bildschirmdarstellung, die unmittelbar mit der Kamera skaliert und weich in die maßhaltigen Bänder übergeht. Sichtbare Linienränder bleiben auswählbar; Tunnelunterbrechungen und Autorenmeter bleiben erhalten. Die Unterteilung langer Verläufe beschränkt sich auf den geladenen Bereich. Native Zoom-/Neigungsprobe und GPU-Pixelprüfungen bei DPR 1/2 liegen vor. Dichte Rasterverläufe, Namen und übrige Objektklassen bleiben offen.

[Namen an der tatsächlichen Hauptkamera anordnen](../../reference/atlas-camera-labels-20261021/README.md): Wiederverwendete Namenskandidaten, Texturen und Textmaße reagieren ohne Terrain-Neulesung auf Zoom, Neigung und Drehung. Logische Schriftgröße, projizierte Linienwinkel, Bildschirmkollisionen und Verdeckung am Geländeanker gelten auch für die gekachelte perspektivische Ausgabe. Manuelle Anker und öffentliche Freigabe bleiben erhalten. Native Zoom-/Regions-/Exportproben sind belegt; dichte Namensszenen überschreiten weiterhin das Navigationsziel, insbesondere durch Ausreißer und kalte Glyphenarbeit. P4 und die Leistungsabnahme bleiben offen.

[Vegetation an der Hauptkamera](../../reference/atlas-vegetation-camera-20261021/README.md): Regionale Bestände sind verschachtelte Teilmengen stabiler lokaler Kandidaten. Kronenbreite und Ausblenden reagieren unmittelbar auf die Kameratiefe; Treffer verwenden dieselben Regeln, geschützte Objekte bleiben maßhaltig. 26 Regressionen, der native Bearbeitungs-/Undo-/Neustartablauf und GPU-/Exportpixel sind geprüft. Noch fehlende feinere Kandidaten, große dichte Bestände und die Geländeabdeckung bei starker Neigung bleiben offen.

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

### Abbau der verbleibenden zweiten Karte (20.10.2026)

Der Straßen-/Flussdialog nutzte weiterhin den alten Landschaftsrenderer und umging damit die Hauptkamera. Dieser Weg ist jetzt im Implementierungsstand entfernt: Planung als Atlas-Seitenleiste, dieselben Punkt-/Navigationsfunktionen, Entwurf und Geländevorschau im Haupt-GPU-Worker, gemeinsame History. Der alte Landschafts-3D-Dialog samt `VegetationSpatialView` wurde gelöscht; instanzierter Bewuchs ist eine Ebene der gemeinsamen Szene. Auch isolierte Bildfixtures nutzen den Produktrenderer. Der normale Canvas bleibt Eingabe-/HUD-Fläche und Fehlerfallback, keine separat bedienbare Karte.

Die bereits gespeicherten Qualifikationen des entfernten Dialogs sind historische Belege. Insbesondere `test-desktop-vegetation-qualification.mjs` und alte räumliche Pinselproben sind noch nicht vollständig auf den gemeinsamen Atlas übertragen; deren Detail-, Leistungs- und Exportaussagen gelten nicht als aktuelle Abnahme. Perspektivische Ausgabe und Spieleranzeige bleiben offene Roadmap-Arbeit.
