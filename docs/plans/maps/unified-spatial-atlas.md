# Roadmap: ein durchgehend räumlicher SaltMarcher-Atlas

Ursprüngliche Roadmap vom 20.10.2026; Arbeitsweise am 23.10.2026 durch den Nutzer ersetzt. P0–P8 beschreiben weiterhin den Produktumfang. Datierte Implementierungsbefunde sind historische Belege, keine aktuellen Arbeitsaufträge oder vollständigen Abnahmen.

## Arbeitsweise ab 23.10.2026

**Verbindlicher Auftrag:** Eine überzeugende, bearbeitbare Fantasywelt mit einer
zusammenhängenden Reise Welt → Kontinent → Königreich → Stadt → Gebäude.
Darstellung, Navigation und Bearbeitung werden gemeinsam bewertet. Der Agent
wählt die Etappen selbst nach den größten Hindernissen für diesen Ablauf;
technische Teilaufgaben muss der Nutzer nicht vorgeben.

### Etappen und Entscheidungen

- Pro Etappe ein zusammenhängendes Nutzerergebnis mit Ausgangsbeleg und konkreten
  Abschlusskriterien. Ein schnellerer Cache oder mehr grüne Tests ist ein Beitrag,
  kein eigenständiger Produktabschluss. Fehlende Werkzeuge und Gestaltung bleiben
  im vollständigen Umfang sichtbar; Performancearbeit verdrängt sie nicht dauerhaft.
- Vor einem Arbeitsblock: Nutzerproblem, begründeter Ansatz und erwarteter Nachweis.
  Danach ausdrücklich übernehmen, weiter untersuchen, verändern oder verwerfen.
  Zwei aufeinanderfolgende Änderungen ohne relevanten Gewinn am Etappenziel lösen
  eine Überprüfung der gemeinsamen Hypothese aus, bevor ähnliche Änderungen folgen.
- Mindestens drei tragfähige Optionen bei wesentlichen Richtungsentscheidungen,
  nicht vor jedem Fix. Ein Experiment beantwortet eine benannte Unsicherheit mit
  dem kleinsten aussagekräftigen Vergleich; es wird kein vollständiges Nebenprodukt.
- Eine längere isolierte Ersetzung der technischen Grundlage ist erlaubt. Vorher
  strukturelle Grenze, erwarteten Gesamtnutzen und Risiken benennen. Alternativen
  anhand gleicher Aufgaben, Daten und relevanter Bedingungen beurteilen: Kartenbild,
  Reaktion, Bearbeitbarkeit und Wartbarkeit. Ein isolierter GPU-Gewinn genügt nicht.
- Nach der Entscheidung den Ansatz zusammenhängend verfolgen. Zwischenstände
  beseitigen wesentliche Unsicherheiten oder stellen benötigte Fähigkeiten her.
  Keine erzwungene frühe Teilintegration; den bisherigen Atlas lauffähig erhalten,
  Nutzerdaten und fremde Arbeiten schützen. Dauerhafte Doppelimplementierungen und
  unbegründete Kompatibilitätsschichten vermeiden. Ein Technikwechsel ist erlaubt,
  aber nicht schon durch diese Arbeitsweise beschlossen.
- Nebenprobleme festhalten. Sofort beheben: Blockaden des Etappenziels, Datenrisiken
  und selbst verursachte Regressionen. Andere Funde dürfen die Etappe nicht zerlegen.

### Prüfen und liefern

Eine feste Autorenwelt und eine große Lastfixture bilden die Vergleichsbasis.
Gleiche Ausschnitte, Kameras, Bestände, Runtime und relevante Hostbedingungen
festhalten; Darstellungsänderungen und bessere Quelldaten getrennt beurteilen.
Die vorhandenen Autoren- und Weltproben weiterverwenden, statt eine neue allgemeine
Prüfinfrastruktur aufzubauen. Korrigierte Prüffehler von Produktfehlern unterscheiden.

Während der Entwicklung gezielte Prüfungen; am zusammenhängenden Lieferkandidaten
betroffene vollständige Bedienabläufe, Typ-/Build-/Repositoryprüfungen und die
verpflichtende exakte Candidate-CI. Kein routinemäßiger doppelter lokaler Volltest.
Visuell nach erkennbaren Landformen, lesbaren Symbolen/Namen, stimmiger Detaildichte
und nachvollziehbaren Übergängen urteilen. Eingabereaktion, Bildabstände und
Detailnachladung getrennt messen; verlorene Details sind kein Leistungsgewinn.

Integration nach fertigen Etappen. **Die Releasezeiten 0/6/12/18 Uhr und der ältere
Fünf-Stunden-Takt entfallen.** Die Zehn-PR-Releasepflicht aus AGENTS.md bleibt.
Keine neue Automatisierung und keine Wiederaufnahme pausierter Läufe ohne Auftrag.
Ein Goal wird nur ausdrücklich aktiviert und benennt Ergebnis, Nachweis und Grenzen.
Nach Unterbrechungen zuerst tatsächlichen Prozess-, Git- und Prüfstand prüfen.

Eine Etappe endet bei erfüllten Abschlusskriterien ohne ungelöste wesentliche
Regression. Danach folgt die nächste Etappe; die alte Forderung nach drei
Untersuchungen ohne irgendeinen Arbeitsfund entfällt. Der Gesamtabschluss setzt
weiterhin den vollständigen beauftragten Produktumfang voraus. Technische Prüfung,
visuelle Bewertung, Pentium-Prüfung und persönliche Nutzerabnahme bleiben getrennt.

### Aktueller Arbeitsstand

Nur diesen Abschnitt fortschreiben; Detailbelege verlinken. Berichte nennen den
Nutzergewinn, unveränderte/verschlechterte Punkte und die daraus folgende Entscheidung.

- **Etappenziel:** Eine lesbare Referenzreise durch Asterfall: Kontinente, Relief und
  Wald, Königreich, zusammenhängende Siedlung und nutzbarer Gebäudeinnenraum. Diese
  erste Etappe verwendet vorhandene Autorenwerkzeuge; noch fehlende Werkzeuge und
  übrige Produktanforderungen bleiben in der Umfangstabelle offen.
- **Ausgangsbasis:** Main `86380f28292daf59901f8d85509d683eb234f724` nach dem
  Gebirgsmaterialschritt. Die native Ausgangsprüfung und ihre Grenzen werden unter
  [Arbeitsweise und Referenzreise](../../reference/atlas-workflow-20261023/README.md)
  festgehalten. Historische Leistungszahlen sind keine neue Baseline.
- **Abschlusskriterien:** Dieselbe gespeicherte Welt über alle fünf Stationen
  zusammenhängend navigieren und neigen; Küsten, Gebirge, Wald und Gebietsnamen sind
  auf ihrer jeweiligen Distanz erkennbar, Straßen verbinden die Siedlung, Raumgrenzen,
  Namen und D&D-Raster sind im gewählten Geschoss nutzbar. Gelände und einen Raum
  bearbeiten, Undo/Redo, Etagenwechsel, PNG, reguläres Beenden und frisches Öffnen
  erhalten den Zustand. Vorher/Nachher mit festen Ausschnitten begründet vergleichen;
  keine wesentliche Funktions- oder reproduzierbare Leistungsregression in der
  großen Lastfixture. Die strengeren Gesamtleistungsziele unten bleiben separat offen.
- **Entscheidung:** Die native Autorenreise und fünf vollständig geladene feste
  Ansichten sind gesichert. Als nächster Arbeitsblock eine zusammenhängende
  Kartenstilprobe auf denselben Daten erstellen: Gelände, Waldsignatur und
  maßstabsabhängige Objekte/Namen. Bessere Quelldaten separat beurteilen. Die
  [drei Richtungen und Auswahl](../../reference/atlas-workflow-20261023/README.md#fünf-feste-ansichten-aktueller-befund)
  sind begründet; noch kein Renderer-/Backendersatz beschlossen.
- **Ergebnis und nächster Schritt:** Arbeitsweise eingeführt, Ausgangsbasis geprüft;
  Produktetappe noch offen. Die Kartenstilprobe gegen die eingefrorene Welt bewerten
  und daraus die technische Grundlage wählen. Die Wirkung der Arbeitsweise erst
  nach der abgeschlossenen Produktetappe anhand Nutzergewinn, Aufwand und
  verbleibenden Mängeln bewerten.

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
- Electron, TypeScript und SQLite sind der aktuelle Lieferstand, keine Bindung für einen begründeten Atlasersatz. Lokale Offline-Nutzung, eingeschränkte Rendererrechte und eine kanonische Schreibautorität bleiben erforderlich; der bestehende Main besitzt diese Autorität bis zu einem geprüften Ersatz.

Die neue Roadmap ersetzt die bisherigen Vorgaben für getrennte Drauf-/Kippdarstellung. Bereits belegte Fachfunktionen werden übernommen; ihre Eignung im neuen Atlas wird erneut geprüft.

Einordnung: [Atlas-Roadmap](../../../ROADMAP-HEX-ATLAS.md), [bisherige Relief-Roadmap](terrain-relief.md), [Architektur](../../../ARCHITECTURE.md), [räumliche Dungeonanforderungen](../dungeon/smr04-spatial-coverage.md) und [Spieleranzeige](../runtime/player-projection.md). Die bisherigen Dokumente und Belege bleiben als Ausgangsstand erhalten; P0 gleicht ihre widersprechenden Zielvorgaben mit dieser Roadmap ab.

### Bewährte Lösungen bevorzugen (Ergänzung 21.10.2026)

**Erweiterter Auftrag vom 22.10.2026:** Bestehende Architektur und technische
Entscheidungen sind keine Bindung. Grundsätzlich andere Ansätze sollen anhand
derselben Bedienfälle verglichen werden, bevor weitere Arbeit in einen
möglicherweise ungeeigneten Weg fließt. Der normale Atlas bleibt der
Produkteinstieg; technische Prototypen sind keine zweite Produktansicht.
Die Arbeitsweise vom 23.10.2026 präzisiert diesen Auftrag: Optionen an wesentlichen
Richtungsentscheidungen vergleichen; Berichte auf Nutzerergebnis und nächste
Entscheidung konzentrieren statt vier Pflichtberichte bei jeder Kleinigkeit.
Tests und Ergebnisse müssen nachvollziehbar und reproduzierbar abgelegt werden;
frühere Tests und Entscheidungen dürfen mit neuer Evidenz neu bewertet werden.

Bestehende, bewährte Implementierungen und Verfahren sind vor neuen eigenen Lösungen zu prüfen und soweit passend zu übernehmen. Die Verbesserung bleibt in der vorhandenen Atlasfläche und ihren Werkzeugen verankert. Für den nächsten Terrain-Schritt dienen insbesondere [GDALs begrenzter Rasterblockcache](https://gdal.org/en/stable/user/configoptions.html#performance-and-caching), [mehrstufige Rasterübersichten mit gezielter Aktualisierung](https://gdal.org/en/stable/programs/gdaladdo.html) und [MapLibres dokumentierter Kachellebenszyklus](https://github.com/maplibre/maplibre-gl-js/blob/main/developer-guides/life-of-a-tile.md) als technische Referenzen: wiederholte Blocklesungen vermeiden, passende Auflösung wählen und bereits geladene über-/untergeordnete Kacheln während des Nachladens verwenden. Die Quellen wurden am 21.10.2026 gelesen; daraus folgt noch keine Entscheidung für zusätzliche Laufzeitabhängigkeiten.

Eine lokale Diagnose nach der frühen Geländeöffnung zählt für die erste Übersicht 4.950 Lesungen von 1.028 unterschiedlichen Höhenkacheln, rund 109,9 MB Nutzdaten bei einmalig 22,8 MB. Die damaligen Implementierungsversuche sollten diese Wiederholung innerhalb des vorhandenen Speicherbudgets reduzieren und gleiche Höhen, Küsten, Quelleninvalidierung und Undo/Redo nachweisen. Vorberechnete Auflösungsstufen benötigen zusätzlich eine explizite Strategie für Änderungen und Wiederöffnung. Die Diagnose misst Zugriffe, keine Bildrate oder Produktabnahme.

### Technische und gestalterische Referenz

Google Maps ist das technische Ziel: unmittelbare Navigation vom Weltmaßstab bis zum Gebäude, während Details, Linienbreiten und Namen maßstabsabhängig wechseln. Die gestalterische Referenz sind konventionelle Fantasykarten, insbesondere publizierte D&D-Karten. Wälder müssen als zusammenhängende Landschaft auf Weltmaßstab und als zunehmend detaillierte Baumgruppen auf Dorfmaßstab lesbar sein. Straßen, Flüsse, Gebäude und Regionen folgen derselben Informationshierarchie. Die [offizielle Schwertküstenkarte (Wizards, 2015)](https://media.wizards.com/2015/images/dnd/resources/Sword-Coast-Map_HighRes.jpg) wurde am 21.10.2026 als erste Referenz gesichtet: zusammenhängende Waldflächen mit klaren Rändern, feine Kronenstruktur, zurückhaltende Bodenfarben und kontrastierende Küsten-/Gewässerlinien. Das sind gestalterische Beobachtungen, keine Übernahme ihrer Bilddateien in das Produkt. Dorf-/Gebäudereferenzen und der direkte Vergleich mit SaltMarcher über mehrere Maßstäbe stehen noch aus; technische Prüfungen ersetzen diese Bewertung nicht.

Geprüfte Zwischenstände werden regelmäßig über die vorgeschriebene Candidate-CI nach `main` integriert. Sobald genügend Fortschritt für einen sinnvollen Nutzertest vorliegt, wird eine neue testbare Version veröffentlicht; zusätzlich gilt der verbindliche Release-Rhythmus des Repositories. Die vollständige Produktabnahme bleibt davon getrennt.

### Verbindlicher Landschaftswerkzeugumfang (21.10.2026)

Die folgende Konkretisierung des Nutzerauftrags ergänzt P4–P6. Sie beschreibt
Sollverhalten; vorhandene Werkzeuge und einzelne Nachweise gelten nicht als
Abnahme des gesamten Umfangs. „Aufrauen“ ist ausdrücklich bestätigt.

| Werkzeug | Gefordertes Verhalten | Fachlicher Anschluss |
| --- | --- | --- |
| Terrain: Sculpt | Einfaches Erhöhen, Senken und Aufrauen mit natürlichen Unebenheiten; Aufrauen ist eine eigene Wirkung, nicht nur eine Zufallsvariation beim Erhöhen. | [Relief](terrain-relief.md), P5 |
| Terrain: Smooth | Gelände gezielt glätten, mit nachvollziehbarer Stärke und Bearbeitungsskala. | [Relief](terrain-relief.md), P5 |
| Terrain: Feature | Hügel, Bergketten, Schluchten und vergleichbare komplexe Formen mit wenigen Eingaben schnell erzeugen und weiterbearbeiten. | [Relief](terrain-relief.md), P5–P6 |
| Gebirgsmaterial (ergänzt 23.10.2026) | Höhe und Hangneigung modulieren Geländefarbe und Textur: steinigere Hänge und schneebedeckte Gipfel oberhalb einer einstellbaren Schneegrenze, mit weichen Übergängen. Gemalte Grundfarben bleiben erhalten. | [Relief R4](terrain-relief.md#r4--den-gezeichneten-kartenstil-ausarbeiten), P4–P6 |
| Geländearten | Wald, Wüste, Sumpf und weitere Typen auf weiter, mittlerer und naher Distanz lesbar darstellen; weiche Übergänge an ihren Rändern. | [Landschaft](landscape-tools.md), [Bewuchs](vegetation.md), P4–P6 |
| Wasser | Flüsse finden sinnvolle geländeabhängige Wege zwischen gesetzten Punkten; Seen füllen passende Geländebecken. | [Trassen und Gewässer](terrain-routes.md), P5–P6 |
| Infrastruktur | Feldweg, Hauptstraße, Gasse und weitere Straßenarten erhalten passende Linien-/Texturdarstellung, Bildschirmbreiten und Sichtbarkeitsübergänge beim Zoom. | [Trassen](terrain-routes.md), [Kartografie](atlas-cartography.md), P4–P6 |
| Gebäude | Gebäude mit D&D-Raster in den Innenräumen und mehreren Etagen bleiben Teil derselben Atlasfläche. | [Raumgruppen](room-groups.md), [räumliche Dungeons](../dungeon/smr04-spatial-coverage.md), P6 |
| Gebiete | Benannte gemalte Gebiete auf voreingestellten politischen und geographischen Ebenen sowie eigenen Ebenen; jede Ebene hat ihre eigene Hierarchie. Die Geometrie darunter bleibt unabhängig. | [Kartografie](atlas-cartography.md), P4–P6 |

Für die abschließenden Untersuchungen ist jeder Tabellenpunkt als vollständiger
Ablauf im normalen Atlas zu prüfen: Anlegen, sichtbare Bearbeitung, Zoom über
weite/mittlere/nahe Distanz, Neigen/Drehen, Auswahl, Undo/Redo, Speichern und
frisches Öffnen sowie passende Ausgabe. Zusätzlich zu diesen gemeinsamen
Schritten gelten folgende fachliche Prüfungen:

- Aufrauen erzeugt Erhebungen und Vertiefungen; große Pinsel, Übergänge und
  wiederholte Züge bleiben kontrollierbar. Smooth und Feature behalten ihre
  eigenen verständlichen Bedienaufgaben.
- Geländearten bilden erkennbare zusammenhängende Flächen, mit weichen Rändern
  und zunehmenden Details, ohne sichtbare Nähte oder wechselnde Objektidentitäten.
- Gebirgsmaterial folgt Terrainänderungen und der eingestellten Schneegrenze;
  Zoom und visuelle Höhenüberhöhung verändern die physische Grenze nicht.
  Fels- und Schneetexturen bleiben beim Navigieren stabil und stimmen zwischen
  normalem Atlas, geneigter Kamera und Bildausgabe überein. Der
  [Materialschritt](../../reference/atlas-mountain-material-20261023/README.md)
  ergänzt den gemeinsamen Rasterkern; sofortige Materialreaktion beim Sculpt
  und die vollständige Leistungs-/Gestaltungsabnahme bleiben offen.
- Flüsse berücksichtigen Höhenverlauf und Senken; Seen passen zu ihrem Becken.
  Nach Terrainänderungen bleibt der Zustand nachvollziehbar und korrigierbar.
- Straßenklassen bleiben unterscheidbar, mit lesbaren Namen und stabilen
  Übergängen bei schnellen Zoomrichtungswechseln.
- Politische, geographische und eigene Gebietsebenen lassen sich unabhängig
  bearbeiten und hierarchisch ordnen. Gebiet ändern oder löschen verändert
  weder Straßen, Gebäude, Gewässer noch andere Objekte.

Die Leistungs- und visuellen Kriterien aus Abschnitt 4 gelten für alle diese
Abläufe. Bekannte Lücken verhindern den Gesamtabschluss; Etappen enden nach den
oben festgelegten Ergebnis- und Regressionskriterien, nicht nach einer Auditanzahl.

## 2. Technische Leitentscheidungen

Die einfachste Lösung, die das gewünschte Ergebnis erzielt, hat Vorrang. Dauerhafte Module bleiben lesbar und nach fachlicher Verantwortung getrennt; zusätzliche Infrastruktur braucht einen belegten Nutzen.

**Ein Darstellungsweg für den gesamten Atlas.** Terrain, Kartenlinien, Gebäude, Innenräume und Bearbeitungsgriffe teilen Kamera, Koordinatentransformation und Tiefeninformationen. DOM bleibt für Bedienelemente und Texteingabe zuständig.

**Technik nach Eignung wählen.** Die Zielaktualisierung vom 22.10.2026 erlaubt ausdrücklich neue Architektur, Backend und isolierte Greenfield-Versuche. Die frühere Beschränkung auf die vorhandene Technik ist aufgehoben. Mehrere Ansätze anhand derselben konkreten Nutzeraufgaben vergleichen; bewährte Lösungen übernehmen, wenn sie besser tragen. Das Ergebnis bleibt die eine über die App erreichbare Atlasfläche. Bestehende Nutzerdaten und unabhängige Geometrie bleiben erhalten.

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

Historischer Abschnitt vom 20.–22.10.2026; die Überschrift bleibt als Linkziel
erhalten. Aktuelle Entscheidungen stehen im Arbeitsstand oben.

[Gezielte Linienversorgung der Terrainprojektion](../../reference/terrain-line-stream-20261021/README.md): Orte und Vegetationsobjekte werden für Straßen-/Flussdurchläufe nicht mehr dekodiert. Die vollständige Projektion bleibt byteidentisch; die gesamte Öffnungszeit ist weiterhin offen.

[Wiederverwendbarer räumlicher Objektindex](../../reference/atlas-persistent-region-index-20261021/README.md): unveränderte Objektgrenzen nach einem Neustart aus einem quellengebundenen Cache laden. Externe Änderungen, Undo, Sicherungsrückspielung und defekte Caches sind abgesichert. Die kalte Erfassung und die erste Terrainaufbereitung bleiben offene Öffnungskosten.

[Aktueller Integrationsstand auf main-Basis und native Prüfungen](../../reference/atlas-main-integration-20261021/README.md): Entwicklungsstart, gemeinsame Kamera, freie Geschosskonturen, Bewuchs und Relief. Die visuelle Waldgestaltung bleibt ausdrücklich offen. [Folgekorrektur für große Wälder beim Detailzoom](../../reference/forest-detail-20261021/README.md): begrenzte Kandidatenauswahl statt Ausfall der Landschaftsschicht, nativ über vier Maßstäbe geprüft. Die Raster- und Kronengestaltung bleibt offen. [Bildkachel-Zuordnung](../../reference/atlas-image-orientation-20261021/README.md): gespiegelte Bitmapkacheln und verlorene Objektkacheln in der perspektivischen PNG-Ausgabe lokal korrigiert und nativ geprüft. Der damalige Export zeigte dichten Bewuchs noch als Rasterpunkte. [Kompakte Bewuchsprojektionen](../../reference/forest-geometry-20261021/README.md) erhalten inzwischen im geprüften größeren Ausschnitt dieselben räumlichen Kronen innerhalb des bestehenden Übertragungsbudgets. Allgemeine Detailgleichheit, Waldgestaltung und Leistungsqualifikation bleiben offen.

**Historischer Entscheidungsverlauf:** Am 20.10.2026 wurde zunächst der
inkrementelle Anschluss an den normalen Atlas priorisiert und der damalige
Enginevergleich eingestellt. Die oben verlinkten Belege dokumentieren diesen
Arbeitsweg. Der Auftrag vom 22.10.2026 öffnete die Technikwahl wieder; seit
23.10.2026 ist auch eine längere isolierte Ersetzung ausdrücklich zulässig.
Die frühere Pflicht zur frühen Teilintegration gilt nicht mehr. Der vollständige
[damalige Text](https://github.com/ThonkTank/Salt-Marcher/blob/86380f28292daf59901f8d85509d683eb234f724/docs/plans/maps/unified-spatial-atlas.md)
bleibt nachvollziehbar. Die historischen Befunde weiter unten enthalten ebenfalls
zeitgebundene nächste Schritte; für aktuelle Arbeit gilt ausschließlich der
Arbeitsstand am Anfang dieser Roadmap.

P0–P8 bleiben fachliche Prüffelder, keine unveränderliche technische Reihenfolge.
Funktionierende Werkzeuge, Daten und Quellenbindungen dürfen bei einem Ersatz
nicht stillschweigend verloren gehen. Die Sicherheit der kanonischen Schreibgrenze,
History, Freigaben und tatsächlicher App-Einstieg sind am neuen Gesamtstand zu
prüfen. Zwischenstände dürfen isoliert bleiben, bis eine zusammenhängende Etappe
lieferfähig ist; vollständige Lieferprüfungen erfolgen dann am Kandidaten.

### P0 — Umfang und vergleichbare Ausgangsbasis sichern

Arbeitsstand: [gesicherte Quellen, Inventar und reproduzierbare Prüfwelt](unified-atlas-baseline.md). P0 ist in Arbeit; seine Abschlusskriterien sind noch offen.

Alle vorhandenen Atlaswerkzeuge und Verbraucher inventarisieren und den zugehörigen Anforderungen zuordnen. Gemeinsamen Arbeitsstand einschließlich laufender Änderungen unverändert sichern; Implementierung später isoliert auf aktuellem `origin/main` beginnen und benötigte Änderungen gezielt übernehmen.

Eine reproduzierbare Prüfwelt erstellen: Küste, Inseln, Gebirge, Tal, Fluss, Straßen, Wald, hierarchische Regionen, Stadt mit Stadtteilen, Dorf und mehrgeschossige Innenräume. Kleine und große Varianten verwenden dieselben Gestaltungselemente. Große Varianten begleiten P3–P8 und sind keine Voraussetzung für den ersten integrierten Kameraausschnitt.

**Abschluss:** Werkzeugliste, feste Eingabefolgen, Screenshots und Messungen für den Ausgangsstand liegen vor. Die neue Roadmap ist mit `docs/INDEX.md`, den bestehenden Atlas-/Reliefplänen und den betroffenen Abnahme-IDs verbunden; ursprüngliche Quellenbindungen bleiben erhalten.

### P1 — Vorhandenen Atlas an einem vollständigen Ausschnitt verbessern

Erster lokaler Teilanschluss: [perspektivische Kamera und Navigation mit ausstehenden Detailaufträgen im vorhandenen Three.js-Atlas](../../reference/atlas-perspective-camera-20261020/README.md). P1 bleibt offen; der damals eingestellte Vergleich ist durch die spätere freie Technikwahl wieder zulässig.

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

[Geteilte Koordinaten für überlappende Pinselabdrücke](../../reference/atlas-brush-coverage-20261021/README.md): Ein eigener Abdeckungsrechner erhält Strichreihenfolge, Float32-Auftrag und weit entfernte Texturen. Sechs überlagerte Pinselzüge laden im gepaarten Worker-Vergleich pixelgleich in 7,4–7,6 statt 8,4–9,0 Sekunden. Die vollständige Nachladung und die übrigen Werkzeug-/Darstellungsziele bleiben offen.

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

Für die verschiedenen Zoom- und Detailstufen passende Darstellungen wählen: zusammenhängende, strukturierte Waldflächen in der Weltübersicht, lesbare Kronengruppen im Regionalmaßstab und maßhaltige Einzelobjekte im Nahbereich. Daten und Identitäten bleiben gemeinsam; die Darstellung darf je Stufe wechseln und soll kontinuierlich überblenden. Ein detaillierteres Nahmodell allein erfüllt die Übersicht nicht.

Für alle Objektklassen gemeinsame Maßstabsregeln einführen:

- Küsten bleiben eigene scharfe Konturen; Relief und Bodenfarben werden getrennt gestaltet.
- Höhenlinien behalten ihre tatsächlichen Höhen und gleichmäßigen Höhenabstände. Die automatische Auswahl ineinander verschachtelter Höhenstufen hängt nur vom Kartenmaßstab ab, niemals von örtlicher oder geladener Steigung, Höhenspanne oder Geländeänderungen. Hauptlinien bleiben bestehen, Zwischenlinien werden weich ergänzt; feste Meterintervalle bleiben wählbar.
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

[Weiche Bodenfarbe an Bewuchsrändern](../../reference/atlas-cover-feather-20261021/README.md): vorhandene Randbreiten wirken auch auf Bodenfarbe und Lichtungen, mit gemeinsamem Kachelraster und unterbrechbarer Workerberechnung. Native Hauptansicht und PNG sind geprüft. Die zusätzliche CPU-Arbeit ist gemessen; Waldtextur, Kronenformen und allgemeine Ladeleistung bleiben offen.

[Lesbarere Baumkronen](../../reference/atlas-crown-style-20261021/README.md): gelappte Laubkronen, Aststufen bei Nadelbäumen und stabile Farbvariation im bestehenden instanzierten Hauptatlas. Native Maßstabs-/Kipp-/PNG-Probe und GPU-Treffer-/Kachelprüfungen liegen vor. Die teurere erste Geometrie wurde verworfen; der begrenzte Folgeentwurf bleibt ein Nah-/Regionaldetail, keine Waldgestaltung für die Weltübersicht.

[Begrenzte Kosten der weichen Ränder](../../reference/atlas-cover-distance-20261021/README.md): entfernte Teile werden verworfen, disjunkte Teile benötigen keine Vereinigung, und der Abstandskern passt sich der geschätzten Arbeit an. Im dichten 2000-Teilflächen-Fall sank die gemessene Kachelzeit von 1056 auf 193 ms; fünf Rasterfälle und die native PNG-Ausgabe bleiben pixelgleich. Allgemeine Ladeleistung bleibt offen.

### P5 — Unmittelbare Terrainbearbeitung auf allen Maßstäben

[Aufrauen als eigene Sculpt-Wirkung](../../reference/atlas-sculpt-roughen-20261021/README.md): positive und negative Unebenheiten im bestehenden direkten Höhenpinsel, mit gemeinsamen Höhenbändern, History und Hauptkamera. Lokale und native Prüfungen umfassen Undo/Redo und frisches Öffnen. Das vervollständigt noch nicht die Feature-Werkzeuge oder die allgemeine Leistungs-/Gestaltungsabnahme.

Land formen, Glätten und Bemalen verändern während der Eingabe unmittelbar eine lokale Arbeitsfassung derselben Karte. Dafür gibt es keinen separaten Vorschaumodus und keinen Übernehmen-Knopf. Bestätigte Teilstücke werden weiterhin automatisch gespeichert.

Berechnung und Übertragung beschränken sich auf betroffene Höhenbänder und Kachelbereiche. Grobe Änderungen erhalten feine Geländeanteile; Glätten und Zielhöhen berücksichtigen die gewählte Bearbeitungsskala. Bestehende Schutzregeln für Straßen, Flussbetten und manuell korrigierte Objekte bleiben wirksam.

Sichtbare Oberfläche, Pinselradius und Verdeckung werden für die räumliche Geste konsistent bestimmt. Arbeitsfassung und kanonisches Ergebnis werden abgeglichen. Fehler oder unbekannte Bestätigungen dürfen keine ungespeicherten Änderungen als gespeichert ausweisen.

**Abschluss:** Kleine, große, lange, schnelle und stationäre Züge reagieren sichtbar innerhalb des Ziels. Küsten und Relief folgen während des Ziehens. Undo/Redo, Fokusverlust, Escape, Schreibfehler und Neustart erhalten die festgelegte Gestensemantik.

### P6 — Sämtliche Atlaswerkzeuge räumlich anschließen

Alle in P0 erfassten Werkzeuge in die gemeinsame Fläche übernehmen: Linien, Flächen, Regionen, Referenzbilder, Symbole, Bewuchs, Stadtgestaltung, Gebäude, Räume, Wände, Türen, Treppen, Einrichtung, Volumen und zugehörige Keys.

Innenräume werden über vorhandene Geschoss-/Schnittfunktionen zugänglich. Für das aktive Geschoss werden verdeckende Dächer und darüberliegende Geschosse ausgeblendet; die Kamera bleibt frei. Eine sichtbare Arbeitsebene und Höhen-/Flächentreffer ermöglichen zuverlässiges Zeichnen und Verschieben. Oberflächennahe Verdeckung und Auswahl mehrerer überlagerter Objekte bleiben kontrollierbar.

Rein zweidimensionale Assets bleiben zulässig und werden ihrer passenden Welt- oder Arbeitsebene zugeordnet. Räumliche Darstellung erzeugt keine zweite fachliche Geometrie.

**Abschluss:** Welt → Stadt → Haus → Raum und zurück funktioniert ausschließlich durch Navigation und Werkzeugwahl. Gelände, Straße, Haus und Raum lassen sich in einer gemeinsamen Undo-Folge bearbeiten; Texte, IDs und Verknüpfungen bleiben korrekt.

Lokaler Teilanschluss: [Gemeinsame Geschossebene für Darstellung und Bearbeitung](../../reference/atlas-workplanes-20261021/README.md). Griffe, Entwürfe, Treffer und Raumnamen verwenden dieselbe Höhe. Sichtbare leere Arbeitsebenen und unterirdische Freilegung bleiben offen. Die dabei entdeckte automatische Volumenrasterung freier Raumneuanlagen ist [korrigiert](../../reference/atlas-free-room-contours-20261021/README.md): neue Konturen bleiben exakt, die Volumenbearbeitung ist eine eigene Aktion.

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

Nutzerbefund vom 21.10.2026: Version **0.178.0** zeigt auf einem Intel Pentium
Gold 7505 (2 Kerne/4 Threads) mit integrierter Intel UHD (Tiger Lake-LP GT2)
sekundenlange Navigation im Weltmaßstab, abreißende Höhenlinien und noch langsamere
Bearbeitung mit 2.500 Meilen Pinselradius (4.023.360 m). **Unmittelbare Bedienung
gilt ausdrücklich auch für eine vollständig gefüllte Welt**, nicht nur für
kleine oder leere Fixtures. Kamera und Eingaben müssen unabhängig von
Nachladeaufträgen bleiben; Darstellung und Detailarbeit richten sich nach dem
sichtbaren Ausschnitt und Maßstab. Die folgenden Zielwerte sind durch frühere
kleinräumige Proben nicht qualifiziert.

Regelmäßige Autorenprüfung aus Nutzersicht, zusätzlich zu technischen Lastproben:
im normalen Atlas eine Fantasywelt mit Kontinenten beginnen, einen Kontinent
ausarbeiten, darin ein Königreich gestalten, anschließend Straßen und Gebäude
einer Stadt und zuletzt ein einzelnes Gebäude bearbeiten. Gebiete bleiben
unabhängige gemalte Overlays. Jeden Übergang mit Zoom, Navigation, tatsächlicher
Bearbeitung und Wiederaufnahme prüfen. Isolierte Ansichten und automatisch
eingespielte Lastdaten ersetzen diesen Ablauf nicht. Zusätzlich zu Leistung werden
Bedienhürden, widersprüchliche Maßstabswechsel und unstimmige Darstellung
festgehalten. Ein funktional bestandener Autorenweg ist noch keine gestalterische
Abnahme einer tatsächlich spielbaren, ansprechenden Fantasykarte.

[Autorenreise vom 22.10.2026](../../reference/atlas-world-authoring-20261022/README.md):
Kontinente, Relief, Wald und unabhängiges Königreich bis zu Straßen, sechs
Gebäuden und frischer Raumwiederöffnung. Die Sichtprüfung hält glatte Küsten,
schematisches Relief, verdeckende Bäume und fehlende gestalterische Detailhierarchie
als offene Arbeit fest. Ein zwischenzeitlich verlorener Erzeugungsklick bleibt
unaufgeklärt; ein später erfolgreicher Durchlauf gilt nicht als Fehlerbehebung.

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

### Voller Weltbestand: Terrain-History entkoppelt (21.10.2026)

Nach der ausgelagerten Sicherungsprüfung wurde die unveränderte Quellenkarte aus dem Terrain-Schreib-/Historypfad entfernt. Eine kleine persistente Geländerevision hält Reisevorschauen und angenommene Reisen auch über Undo/Redo und Neustarts korrekt ungültig. In derselben nativen gemischten Prüfwelt sank die gesamte synchrone Commitarbeit von 8,98 auf 0,51 Sekunden; die History eines großen Pinselzugs von 35,36 MB auf 271 KB. [Änderung, Messweg und Grenzen](../../reference/atlas-bounded-terrain-history-20261021/README.md). Die erste Terrainansicht benötigt weiterhin rund 23 Sekunden, der vollständige Pinselabschluss rund 13 Sekunden. Die oben festgelegten Ziele bleiben offen; nächste Arbeit ist die initiale Objektprojektion und verbleibende Workerarbeit. Lokale Implementierungsbelege sind keine Main-/Release- oder Zielgerätequalifikation.

### Voller Weltbestand: kompakter Objektindex (21.10.2026)

Die Übersicht hält zunächst Objektgrenzen und Zeichenreihenfolge; genaue Zeichenkopien werden im benötigten Ausschnitt in einem auf 4 MiB begrenzten Cache aufgebaut. Initiale SQL-Blöcke folgen dem Rowid-Cursor, der Rtree wird einmal gesammelt aufgebaut. [Gleichheit, Gegenproben und native Läufe](../../reference/atlas-lazy-region-shapes-20261021/README.md). Welt-, Regions-, Gebäude- und Dungeonausgabe blieben byteidentisch. In der vollen gemischten Welt sank der sichtbare Start von rund 23 auf 12 Sekunden. Weiterhin werden beim Start alle Objektgrenzen ermittelt; das Zwei-Sekunden-Ziel und der vollständige Pinselabschluss bleiben offen. Nächster Schritt ist die Eröffnung ohne wiederholte Gesamterfassung, mit eindeutig geprüftem Quellenstand.

### Voller Weltbestand: Gelände vor Objektaufbau (21.10.2026)

Die normale Atlasfläche beginnt mit der Geländeübersicht und lädt anschließend den vollständigen Objektausschnitt. Ein begrenzter Akkumulator bewahrt Objektänderungen, die zwischenzeitliche Terrainaufträge bereits aus dem gemeinsamen Quellenjournal konsumiert haben. In der nativen gemischten Prüfwelt wurde Gelände nach 5,94 Sekunden sichtbar, die Objektgeometrie nach 11,63 Sekunden; im frischen Prozess mit Objektcache nach 5,79 beziehungsweise 8,82 Sekunden. Zoom und Verschieben wurden mit gezielt zurückgehaltener echter Objektantwort geprüft. [Umsetzung, Regressionen, Messung und Grenzen](../../reference/atlas-early-terrain-20261021/README.md). Das Zwei-Sekunden-Ziel, die Zielgeräteprüfung und die gestalterische Abnahme bleiben offen; nächste Arbeit ist die erste Terrainprojektion selbst.

### Voller Weltbestand: dekodierte Höhenblöcke (22.10.2026)

Der vorhandene, auf 16 MiB begrenzte Projektionscache hält jetzt auch dekodierte numerische Höhenblöcke. Für dieselbe erste Übersicht sanken Höhen-Nutzdatenlesungen von 4.950 auf 1.904; Farbpixel, Höhen und vollständige Antwort blieben byteidentisch. Zwei lokale Vergleichspaare benötigten vorher 1,96–2,22 s, danach 1,13–1,48 s für die Projektion. Die normale App zeigt die erste große Geländeübersicht nach rund fünf Sekunden. Die zusätzliche Prüfung aller 48 Detailkacheln zeigt weiterhin 26,6–28,1 Sekunden bis zur vollständigen Verfeinerung; der große Sculpt-Pinsel benötigte nach Loslassen 5,76 Sekunden bis zur Werkzeugfreigabe. [Verfahren, Speicherbelegung, Regressionen und native Grenzen](../../reference/atlas-height-blocks-20261022/README.md). Die Gesamtziele bleiben offen; als Nächstes sind initiale Landschaftsmetadaten und Detailfarben zu untersuchen.

### Räumliche Grundflächenabfragen (22.10.2026)

[Vollständig abdeckender Terrain-Index](../../reference/atlas-base-index-20261022/README.md): Ein zusätzlicher SQLite-Index beschleunigt die Grundflächenabfragen bei der Detailverfeinerung. Die erste Übersicht bleibt vom Aufbau unabhängig; SQLite pflegt Änderungen und Rollbacks. Ein aufwendigerer Rtree-Prototyp wurde nach Gegenproben verworfen. Genaue Grenzen, Abtastung und Zeichenreihenfolge bleiben erhalten. Die vollständige Weltkarten- und Pentium-Abnahme bleibt offen.

Die vorhandenen kleinen Indizes für Höhen, Trassen und Seen enthalten inzwischen
auch alle räumlichen Filterdaten. Damit entfällt das wiederholte Nachladen ihrer
Grenzen aus der großen Metadatentabelle. [Pixelgleicher Vergleich und native
Prüfung](../../reference/atlas-field-index-20261022/README.md): 48 Detailkacheln
und Kontext benötigten lokal 10,7–10,9 statt 11,4–12,7 Sekunden reine Aufbereitung.
Die erste Übersicht und das unmittelbare Reaktionsziel bleiben offen; dieser
Schritt verändert weder Auflösung noch Speicherformat der Autorenkarte.

### Unterbrechbarer Höhengitteraufbau (22.10.2026)

Der normale Terrainworker gibt auch während des Höhengitteraufbaus zwischen
abgeschlossenen Leseblöcken frei. Im lokalen Vergleich lag der erste
Unterbrechungspunkt nach 8,6–9,4 statt 294–429 ms; Höhen und vollständige
Projektionsantworten blieben bytegleich. Eine echte Workerprobe bearbeitete eine
Auswahl vor Abschluss des Gitters und setzte anschließend korrekt fort.
[Cache-Sicherheit, Regressionen und native Gegenprobe](../../reference/atlas-grid-scheduling-20261022/README.md).
Die gesamte Öffnungszeit und der große Pinselabschluss sind dadurch nicht
nachweislich verkürzt. Quellenaufbau, verbliebene lange Rasterabschnitte und
Ende-zu-Ende-Reaktion auf dem Zielgerät bleiben offen.

### Pinselabschluss ohne Warten auf feine Farben (22.10.2026)

Die native Diagnose zeigte rund 1,7 Sekunden abschließende Farbverfeinerung vor
der Objektaktualisierung. Der Abschluss wartet jetzt weiter auf die letzte
vollständige Höhenantwort, während feine Farben unabhängig fortgesetzt werden.
[Schutzregeln, Gegenproben und tatsächlicher Folgezug](../../reference/atlas-brush-finish-20261022/README.md).
Die Bedienelemente wurden lokal nach 3,6–3,8 statt 5,9 Sekunden freigegeben.
Für einen tatsächlich angenommenen Folgezug war die normale Terrainquelle
jedoch erst nach rund 5,1 Sekunden wieder bereit. Diese erneute Ladephase und
die Gesamtlatenzziele bleiben ausdrücklich offen.

### Bestätigtes Höhengitter nach dem Pinselzug behalten (22.10.2026)

Der Quellenwechsel nach einem Pinselzug übernimmt jetzt das bestätigte Live-Gitter,
wenn frische Region, Revision, Quellenkennung und sämtliche Geometrieeingaben
übereinstimmen. Alte Autorenrecord-Caches werden verworfen, Farben verfeinern
weiter. Bei geänderter Abdeckung bleibt ein neuer Übersichtsaufbau notwendig.
[Schutzfälle und native Vorher-/Nachherprobe](../../reference/atlas-live-source-handoff-20261022/README.md).
Im festen Ausschnitt sank die Bereitschaft für den nächsten Zug lokal von
5,6 auf 4,0 Sekunden; beim kurzen Folgezug von 5,0 auf 2,8 Sekunden. Ein Zoom
über die bisherige Abdeckung benötigt weiterhin rund 5,3 Sekunden. Die letzten
Sekunden, Großwelt-Latenzgrenzen und Zielgerätequalifikation bleiben offen.

### Numerische Live-Felder wiederverwenden (22.10.2026)

Kleine Live-Farbbilder behalten ihre exakten Höhen-/Wasserfelder mit lokaler
Invalidierung. Die Felder dürfen höchstens 4 MiB innerhalb des vorhandenen
16-MiB-Caches beanspruchen; normale Navigation gibt ihre bevorzugte Belegung
wieder frei. [Vergleich, verworfene Varianten und native Bedienung](../../reference/atlas-coarse-field-cache-20261022/README.md).
Nach wiederholten lokalen Invalidierungen sank die 64-Pixel-Berechnung von
rund 467 auf 195–216 ms bei identischen Projektionsbytes. Nativ war der Folgezug
nach Zoom nach 4,3 statt 5,3 Sekunden möglich. Erster Überblick, Zielgerät und
unmittelbare Bearbeitung bleiben offen; die normale 128-Pixel-Übersicht erhält
keinen behaupteten Geschwindigkeitsgewinn.

### Örtlichen Bewuchs ohne Scan der Weltlandschaft lesen

[Begrenzte lokale Abfragen](../../reference/atlas-local-region-reads-20261022/README.md)
verwenden die vorhandenen Einstellungs- und Landschaftsindizes, statt für einen
Baum die Weltpayloads zu prüfen. Die vollständigen Antworten bleiben gleich.
Eine zusätzlich erprobte Joinänderung wurde wegen langsamerer Treffer in einem
großen Einzelbestand verworfen. Diese lokale Verbesserung folgt der Releasequelle
0.184.0; unmittelbare Weltreaktion und Zielgerätequalifikation bleiben offen.

[Waldsignatur im normalen Atlas](../../reference/atlas-forest-integration-20261022/README.md): Der semantische Waldkanal folgt jetzt Farbe, Revision, Detailkacheln und lokalen Pinselpatches durch dieselben begrenzten Caches. Der Produktshader blendet weltverankerte Muster weich bis zu nahen Einzelbäumen aus; Hauptkamera und PNG-Ausgabe teilen die Darstellung. Gestaltung, volle Welt und Pentium-Leistung bleiben offen.

[Billigere Detailübernahme](../../reference/atlas-detail-retention-20261022/README.md): Weltverankerte Zeilenkopien ersetzen die vollständige RGBA-Pixelschleife bei gleichem Raster; echte Maßstabwechsel übernehmen wiederholte Zeilen und gepackte Farbwerte. Extrem große Sampleindizes können nicht mehr in alte Bildbereiche überlaufen. Pixelgegenprobe und native Messungen sind getrennt dokumentiert; unmittelbare Weltbearbeitung bleibt offen.

[Gebündelte Bindungsmetadaten](../../reference/atlas-binding-metadata-20261022/README.md): Grenzen und Scope-Namen kommen mit dem Bindungsread aus demselben Snapshot. Tausende separate Abfragen entfallen; Geometrie-Rtree, Geschosswahl, leere Autorrahmen und Ergebnisdarstellung bleiben erhalten. Die gesamte Wartezeit nach großen Strichen ist dadurch noch nicht nachweisbar kürzer; nicht unterbrechbare Regionsreads bleiben offen.

[Überholte Kameraausschnitte abbrechen](../../reference/atlas-region-cancellation-20261022/README.md): Der normale Atlas ersetzt laufende Abfragen bei geänderter Zielauflösung oder verlassenem Puffer. Gemeinsame Abbruchsignale beenden alte Workerlesungen zwischen Objekten und erhalten den Weltindex. Ergebnisse, Auswahl und Export sind gegengeprüft; aktuelle Regionsreads und lange Zeichenpausen bleiben zu teuer.

[Tatsächliche Geometrie beim Zoom und einmalige Rasterlesung](../../reference/atlas-geometry-stream-20261022/README.md): Automatische Raumgruppenmarker entfallen; subpixelkleine Geometrie bleibt per Suche erreichbar. Dichte Bereiche werden in einem Durchlauf gerastert, Raumstil-SQL wird pro Verbindung vorbereitet. Bildgleichheit des Rasterumbaus, normaler Atlas und große Welt sind getrennt geprüft. Mittlere dichte Geometrie, wiederholte Bereichsanfragen und unmittelbare Bearbeitung bleiben offene Engpässe.

[Laufende Bereichsanfragen erhalten](../../reference/atlas-region-request-reuse-20261022/README.md): Gelände-Neuzeichnung und veraltete Terrainantworten ersetzen keine bereits passende Regionslesung mehr. Echte Kamera- und Grafikwechsel behalten ihren eigenen Aktualisierungsweg. Die große Weltprobe reduziert unbeabsichtigte Abbrüche; 3,84 Sekunden bis zur erneuten Bearbeitbarkeit und lange Rendererpausen bleiben deutlich über dem Ziel.

[Leere Objektraster auslassen](../../reference/atlas-empty-object-tiles-20261022/README.md): Der dichte Weltmaßstab überspringt Rasterdurchlauf und PNG-Kodierung, wenn die vorhandenen Sichtbarkeitsregeln keine Objektpixel zulassen. Namen, Treffer, Referenzbilder und geschützte Bäume bleiben erhalten. Die isolierte Weltlesung sinkt von 622 auf 276 ms; 3,41 s bis zur erneuten Bearbeitbarkeit und Rendererpausen bleiben über dem Ziel.

[Unsichtbare Straßen später aufbauen](../../reference/atlas-deferred-routes-20261022/README.md): Der normale Atlas erzeugt Geometrie sicher unsichtbarer Bodentrassen erst beim Heranzoomen aus aktuellen geladenen Daten. Geplante Trassen, Auswahl und hochaufgelöste Ausgabe bleiben erhalten. Die gemessenen Straßenaufbauten in langen Pinselabschluss-Aufgaben entfallen; Netz-/GPU-Arbeit und mehrsekündige Gesamtwartezeiten bleiben offen.

[Geländenetz und Shader wiederverwenden](../../reference/atlas-terrain-mesh-reuse-20261022/README.md): Weltgrenzen und Bildgrößen ersetzen nicht mehr die ganze GPU-Szene. Topologie, Texturen und Draftpuffer besitzen getrennte Lebenszyklen; numerisches Picking kopiert keine Rendergeometrie. Sieben native GPU-Vergleiche bleiben pixelgleich, die längste gemessene Weltaufgabe sinkt von 311 auf 169 ms. Mehrsekündige Bearbeitungsfreigabe und Zielgeräteprüfung bleiben offen.

[Zwischenmaßstab mit vielen kleinen Gebäuden](../../reference/atlas-owner-candidate-cost-20261022/README.md):
Eine native Zoomreise legte einen 50-Sekunden-Bereichsread offen. Die Abfragewahl
berücksichtigt nun kleine Objektgruppen, während große Dungeons den räumlichen
Index behalten. Der identische Nachbarschaftsausschnitt benötigt lokal 2,8 statt
56 Sekunden bei bytegleicher Ausgabe. Die sofortige Detailfreigabe und das
Speicherplateau bleiben eigene, noch nicht abgeschlossene Ziele. Eine anschließende
31-Minuten-Probe mit 22 vollständigen Zoomrunden endete regulär ohne erneuten
Ladehänger und ohne fortlaufenden Speicheranstieg. Sie enthält keine
Bearbeitungszyklen und ersetzt die Zielgerätequalifikation nicht.

### Nächster Architekturabschnitt: persistente räumliche Projektionen

[Bedienfelder mit dem Kartenbild aktualisieren](../../reference/atlas-control-frame-20261022/README.md):
Pinselregler verwenden den bereits berechneten Frame-Maßstab, Werkzeuggruppen
eine gemeinsame aktuelle Katalogaufnahme. Ein ausdrücklich getrennter Welttest
ohne laufendes Pixelauslesen misst Frameabstände. Die Sculpt-Werte bleiben bei
rund 40 ms p95; dieser UI-Kostenschritt erfüllt das Leistungsziel nicht.

[Detailbilder auf der GPU halten](../../reference/atlas-gpu-detail-20261022/README.md):
Der normale Atlas übernimmt Farbe und Waldkanal bei Kamerawechseln auf der GPU.
Angenommene Kacheln bleiben unverändert; lokale Änderungen löschen betroffene
Bereiche ohne vollständige CPU-Bildkopie. Die ersetzte CPU-Übernahme ist entfernt.
25 native Pixelvergleiche und vier Hauptkamera-/Ausgabevergleiche bestehen.
Die abschließende Mischwelt erreicht Navigation p95 24,8 ms, aber Pinselantworten
von 253/175 ms. Vollständige Verfeinerung und Recovery bestehen funktional;
Öffnungs-, Frame- und Pinselziele sowie Pentium- und Gestaltungsabnahme bleiben offen.

[Drei Optionen, Entscheidung und Prüfgrenzen](atlas-persistent-projection.md):
Statt weitere Einzelkosten zum Hauptziel zu machen, werden fertig aufgebaute
räumliche Indizes dauerhaft wiederverwendet und bei Änderungen gezielt gepflegt.
Der bestehende Atlas und die schreibgeschützte kanonische Leseverbindung bleiben
der Anschluss. Der Indexanschluss ist implementiert; persistente Detailstufen
und die vollständige Leistungsabnahme bleiben offen.
