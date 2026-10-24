# Roadmap: neuer Atlas-Kern mit allen acht Ansätzen

Verbindlicher Plan vom 23.10.2026. Er ersetzt die bisherige technische Atlas-Roadmap
und deren nächsten Arbeitsauftrag. Alle acht Ansätze werden fest integriert;
Ansatz 6 wurde auf Nutzerauftrag durch eine metrische Atlas-Kamera mit stabilen
Weltkacheln ersetzt. deck.gl und WASM bleiben Produktbestandteile. Die bisherige
MapLibre-Pflicht ist ausdrücklich aufgehoben.
Der [vorherige Stand](https://github.com/ThonkTank/Salt-Marcher/blob/d3d31363fc40cff1f0f2f5d0b6699dacd54e8b30/docs/plans/maps/unified-spatial-atlas.md)
bleibt als historischer Nachweis erhalten. Dieser Plan ist kein Implementierungs-
oder Leistungsnachweis.

## Ziel und verbindliche Entscheidungen

Der Atlas erhält eine zusammenhängende neue technische Grundlage für flüssige
Navigation und unmittelbare Bearbeitung von Welt bis Innenraum. Alle acht
besprochenen Ansätze werden produktiv integriert: persistente Detailstufen,
GPU-Terrain, gebündelte Objektgeometrie, entkoppelte Bearbeitung, neue
Auftragsverarbeitung, metrische Kamera und stabile Weltkacheln, deck.gl und WASM.

**Die Atlas-Kamera besitzt Navigation und Projektion; deck.gl zeichnet direkt
in einer gemeinsamen Kartenfläche.** Der bisherige Atlas bleibt während der Entwicklung als lauffähige
Referenz erhalten. Nach vollständiger Ablösung werden ersetzte Produktpfade entfernt.
Diese Datei bleibt die einzige aktuelle technische Atlas-Roadmap; es entsteht keine
zusätzliche parallele Roadmap unter einem neuen Dateinamen.

## Aktueller Arbeitsstand

- **Aktive Etappe:** M2/M3/M4 als zusammenhängender Raster-/GPU-Pfad; danach
  einen vollständigen Bearbeitungsablauf aus M6 im normalen Workbench anschließen.
- **Status:** M0 und der isolierte M1-Kern abgeschlossen; M2–M8 offen. [Aktuelle Ausgangsmessungen und Etappenprüfung](../../reference/atlas-rebuild-m0-20261023/README.md)
  sowie [vollständige Übernahmeliste](../../reference/atlas-rebuild-m0-20261023/inventory.md)
  liegen vor. Produktcode und Leistungsstand sind durch M0 noch nicht verbessert.
- **Ausgangsreferenz:** Repositorystand `d3d31363fc40cff1f0f2f5d0b6699dacd54e8b30`;
  in M0 nach Fetch als aktueller Main-Stand bestätigt, native Proben regulär beendet.
- **Vorhandene Belege:** [Asterfall und feste Ansichten](../../reference/atlas-workflow-20261023/README.md),
  [persistenter Index](../../reference/atlas-persistent-index-20261022/README.md),
  [GPU-Detaildarstellung](../../reference/atlas-gpu-detail-20261022/README.md).
  Diese historischen Messungen sind keine neue Baseline.
- **M0-Ergebnis:** Auf dem Entwicklungsrechner Navigation p95 22,1 ms;
  zwei Pixelreaktionen 140,5/64,9 ms, neue Autorenrevision nach Pointerup spätestens
  nach rund 1,2 s beobachtet. Vollständige Details folgen deutlich später.
  Ein Folgezug vor kompletter Nachladung ist belegt, sofortige Folgeeingabe und
  die Zielgeräte-/Gesamtabnahme bleiben offen. Messgrenzen stehen im Bericht.
- **M1-Ergebnis:** Metrische Kamera, direkte deck.gl-Fläche, lokale Geometriepuffer
  und stabile vorzeichenbehaftete Weltkacheln ersetzen den MapLibre-Anschluss.
  [Ersatzprüfung und Grenzen](../../reference/atlas-metric-core-20261023/README.md):
  40 gezielte Tests, 15 native Objekttreffer auf fünf Maßstäben, kanonische
  Höhen/Geschosse/Verdeckung, Ursprungswechsel während einer Geste mit behaltenen
  GPU-Modellen, Resize, Kontextverlust und frisches Wiederöffnen bestanden.
  MapLibre ist aus Quellcode, Build und Abhängigkeiten entfernt; datierte
  [Szenenbelege](../../reference/atlas-maplibre-scene-20261023/README.md) und
  [Kamerabelege](../../reference/atlas-maplibre-camera-assets-20261023/README.md)
  bleiben historische Evidenz.
- **M2-Zwischenstand:** Persistente Terrainkacheln mit Höhen, fertig gerasterten Farben und
  Bewuchsmaske, Übersicht vor Detail, atomarem Stufenwechsel sowie begrenztem
  RAM-/Kampagnen-Plattencache sind implementiert.
  [32 gezielte Tests und native Wiederöffnung](../../reference/atlas-terrain-tiles-20261023/README.md)
  belegen Wiederverwendung ohne neue Rasterisierung, lokale Änderungen samt
  Eltern und Randbereich, Undo/Redo und aktuelle verknüpfte Ortsnamen.
  Die native Detailabfrage dieser kleinen Probe sank von 291 auf 23 ms;
  die erste Abfrage nach Prozessstart benötigte weiterhin 202 ms.
- **M2-Geometrie und Übergänge:** Gebäude- und Raummeshes werden unabhängig
  von Kamera und Anzeigeauswahl gespeichert, an Kachelgrenzen zugeschnitten und
  nach Neustart wiederverwendet. Pan/Zoom behält gültige überlappende Kacheln,
  während eine neue Übersicht aufgebaut wird. [Geometrieprüfung und Grenzen](../../reference/atlas-geometry-tiles-20261023/README.md)
  belegen lokale Änderungen, Terrainabhängigkeit, Undo/Redo, Geschosse und genaue
  native Treffer. Die unabhängige Prüfung trennte physische Bauhöhe von versteckten
  Geschossen und Warnungen beschädigter Quellen von der Meshidentität.
  Die feste M0-Welt zeigte 27.262 SQL-Anweisungen selbst für einen leeren
  Ausschnitt. Frühe Filterung über vorhandene Geschossgrenzen reduziert diese
  auf drei (418 → 33 ms); der lokale Ausschnitt sank von 578 auf 150 ms bei
  identischen Geometriedaten. Kalter Indexaufbau und dichte Übersicht bleiben offen.
- **M2-Cachebudget:** Terrain und Geometrie teilen einen atomaren, kampagnenübergreifend
  begrenzten Kachelcache (96 MiB Nutzdaten, höchstens 64 MiB je Namensraum).
  [51 gezielte Tests und zwei native Wiederanläufe](../../reference/atlas-shared-tile-cache-20261023/README.md)
  belegen Verdrängung, Absturzrecovery, selektive Löschung und gemeinsame
  Wiederverwendung. Projektionsindizes sind seit dem folgenden Schritt ebenfalls einbezogen.
- **M2-Materialdaten:** Grundfarbe, Wasser, Wald, Fels und Schnee haben eigene
  persistente Quellenabhängigkeiten. Lichtwechsel behalten alle Kanäle, Schneegrenze,
  Pigment und Dichte erneuern jeweils nur den betroffenen Kanal.
  [47 gezielte Tests und native Wiederöffnung](../../reference/atlas-material-tiles-20261023/README.md)
  belegen Rohdaten und Transport; GPU-Komposition und flächengetreue gemischte
  Material-LOD-Übergänge sind damit noch nicht qualifiziert.
- **M2-Grobe Geometrie:** Der feste 4096-m-Weltausschnitt überschreitet im
  vollständigen DTO weiter das Quellenbudget, besitzt aber jetzt eine getrennte
  begrenzte Übersicht: 11.500 Räume werden zu einem Mesh mit rund 956 KiB.
  Adaptive Zellen erhalten Zwischenräume; die erste Variante mit voll belegten
  Zellen wurde nach nativer Sichtprüfung ersetzt. [33 gezielte Tests und native
  Weltprüfung](../../reference/atlas-geometry-overview-20261024/README.md) belegen
  lokale Invalidierung, Restart, Revisionwechsel während der Aufbereitung und
  separate exakte Feinauswahl. Übersichtspuffer sind nach Neustart identisch;
  native Datenabfrage 7,56 s kalt / 401 ms nach Neustart. Die Übersicht bleibt
  ohne direkte semantische Auswahl und ohne einzelne Geschoss-/Dachkomposition;
  diese Ansichten verlangen Detailkacheln. Andere Zeichnungselemente werden
  ausdrücklich als fehlende Darstellung gezählt.
- **M2-Kaltstart:** Raum-/Gebäudemeshes besitzen jetzt einen getrennten
  Projektionsstempel; vollständige Regions-/Trefferabfragen ergänzen aufgeschobene
  Zeichnungen. Kanonische Geländeeinstellungen werden je synchronisierter Quelle
  wiederverwendet. [94 gezielte Tests und native Gegenprobe](../../reference/atlas-geometry-cold-start-20261024/README.md)
  belegen Restart, vollständige Ergänzung, Deferred-Änderungen, Rollback und
  unveränderte Meshpuffer. Native Übersichtsdaten 7,56 → 4,50 s, nach Neustart
  320 ms; Feindaten 635 → 487 ms. Eine Zwischenvariante mit 2,60 s beim
  Feinaufruf wurde verworfen. Unmodellierte Zeichnungen werden ausdrücklich
  kampagnenweit einschließlich ungeprüfter Quellen gezählt, nicht als exakte
  Ausschnittzahl. Separate Warnungscodes erhalten andere fehlende Objektklassen.
- **M2-Quellen und Höhenanker:** Kanonische Quellen werden seitenweise verbunden;
  je Raum entfallen drei Einzelabfragen. Die volle 3×3-Höhenprüfung bleibt,
  aber nur ein skalarer Anker wird im vorhandenen begrenzten LRU behalten.
  [Tests, Gegenproben und native Prüfung](../../reference/atlas-geometry-source-pages-20261024/README.md)
  belegen gleiche Meshpuffer, Fehlererkennung, lokale Invalidierung und History.
  Gezählt 50.512 → 10.512 SQL-Aufrufe; native kalte Übersicht 4,50 → 4,35 s,
  Restart 323 ms, Feindaten 518 ms. Einzelproben belegen keinen Geschwindigkeitsgewinn
  für Restart oder Details. Wiederholte 5.000 Höhenanker benötigen isoliert
  7–12 statt 56–78 ms. Einpunktabtastung wurde wegen verlorener Fehlererkennung
  verworfen; `json_type` brachte keinen Gewinn. Der kalte Landschaftsindex bleibt
  mit etwa 1,16 s unverändert.
- **M2-Gemeinsame Projektionen:** Gespeicherte Indizes teilen jetzt dasselbe
  96-MiB-Gesamtbudget und 64-MiB-Namensraumbudget wie Terrain-/Geometriekacheln.
  [67 Tests und native Wiederöffnungen](../../reference/atlas-shared-projection-cache-20261024/README.md)
  belegen atomare Blockveröffentlichung, Absturzrecovery, laufende private Leser
  nach Verdrängung und kalten Wiederaufbau. Aktive Workerdateien/TEMP/WAL bleiben
  außerhalb dieses Retentionsbudgets. Unveränderte Meshes und Autoreninhalte;
  native Geometriedaten 4.419 ms kalt / 456 ms warm / 555 ms fein. Die warme
  Einzelprobe ist gegenüber 323 ms langsamer: kein Leistungsgewinn behauptet.
  Normaler Atlas: Terrainübersicht 4.123 / 2.380 ms, Regionsbereitschaft
  7.045 / 2.772 ms kalt/nach Neustart; gespeicherter Index identisch.
- **Planprüfung 24.10., 01:19 Uhr:** Der unnötige Pflichtpfad „Projektionsindex
  vorbereiten, dann fertige Kachel suchen“ ist als schwacher Teil belegt. Die
  Gegenprobe mit vier wechselnden A/B-Runden liefert identische M0-Geometrie bei
  41–93 statt 236–262 ms; Indexöffnung allein 164–175 ms. Entscheidung:
  **quellengeprüftes Darstellungsprodukt zuerst, Projektion erst beim Bedarf**.
  Neue Worker prüfen Terrainrevision und beide dauerhaften Quellenstempel im
  gepinnten kanonischen Snapshot. Nur vollständige exakte Treffer umgehen den
  Index; Miss/Korruption/Änderung benutzt den bisherigen Aufbau. Nach erstmaliger
  Reader-Nutzung bleibt die laufende Invalidierung unverändert. Die erste spätere
  Detailanfrage übernimmt den verschobenen Aufwand; 46 Tests prüfen Treffer,
  Miss, Quellenwechsel und den Übergang zu Region/Auswahl/Fokus.
  [Gegenprobe und native Prüfung](../../reference/atlas-first-product-20261024/README.md):
  warmer Geometrieabruf 456 → 186 ms, danach 123 ms bis zur nutzbaren Übersicht;
  nächste Feindaten 555 → 553 ms. Gleiche Meshes, Autoreninhalte und Auswahl,
  kein privater Index beim warmen Treffer. Kalte Daten 4.563 ms bleiben zu langsam.
  Einzelproben am isolierten Kern, kein p95-/Produktabschluss.
- **Kalte Gegenprobe 24.10.:** Drei wechselnde Läufe vergleichen vollständige,
  kameraabhängige und ausschließlich physische Landschaftsquellen. Auf der M0-Welt
  gleiche Modelle/Warnungen für 11.500 Räume und 272 Feinobjekte; ein sichtbarer
  Raum mit entferntem Workplane-Anker widerlegt jedoch den Kamerafilter.
  Physische Quellen erhalten auch diesen Anker. Synchronisation im Median
  1.571 → 768 ms, gesamte grobe Bibliotheksantwort 3.541 → 2.754 ms; keine native
  Leistungszusage. [Gegenprobe und 20 gezielte Tests](../../reference/atlas-spatial-preparation-20261024/README.md)
  sichern den entfernten Anker über Neustart, Höhenänderung und Undo/Redo.
  Entscheidung: **Vorbereitung nach Produktbedarf**, kein pauschaler Kamerazuschnitt.
  Die nachfolgende Umsetzung prüft jetzt die Übergänge im Produktionspfad.
- **M2-Vorbereitung nach Produktbedarf:** Geometrie bereitet nur physische
  Landschaftsfelder vor; Teil-/Vollstempel und Snapshot-basierte Ergänzung erhalten
  aufgeschobene Inhalte. [85 gezielte Tests, Gegenprobe und native Nachprüfung](../../reference/atlas-field-preparation-20261024/README.md)
  belegen gleiche Meshes, aktuelle Ortsnamen/Farben, entfernte Höhenanker,
  Kategorieänderungen, Undo/Redo und Rollback. Native kalte Geometriedaten
  4.563 → 3.642 ms, Restart 193 ms, Feindaten 435 ms; Einzelproben am isolierten
  Kern. Terrain-/Materialpuffer nach Ergänzung entsprechen dem frischen Vollaufbau.
  Die erste Variante verlagerte zu viel Aufwand in die Ergänzung (4.491 ms).
  Drei wechselnde Gegenproben lokalisieren den Engpass im Einzelzeilenkopieren;
  ID-Reihenfolge und begrenzte 256er-Blöcke senken den Syncmedian 4.138 → 1.688 ms.
  Native Terrainantwort nach Ergänzung jetzt 2.190 ms, frischer Vollaufbau
  1.822 ms. Gleiche Puffer, Screenshots und Autoreninhalte; alle drei Prozesse
  regulär beendet. Snapshot, 64-Bit-Rowids und Rollback über Blockgrenzen geprüft.
- **M2-Materialnachladung:** Terrain und Material teilen jetzt einen begrenzten
  Rasterkachelstrom. [36 Regressionen und native M0-Prüfung](../../reference/atlas-material-stream-20261024/README.md)
  belegen die sichtbare Elternkachel während verzögerter Nachladung, den atomaren
  Wechsel auf vier Kinder, gröberen Wiederbesuch und fünf unveränderte Materialkanäle
  aus dem Cache nach Neustart. Zwei reguläre Prozessenden, gleiche Autoreninhalte.
  Lokale Invalidierung samt Eltern und Undo/Redo ist separat automatisiert geprüft;
  die native Probe schreibt keine Autorenänderung. Technische Rohfarbenansicht,
  keine GPU-Komposition oder Zeitmessung des normalen Atlas.
  Unabhängig bestätigt: 20 überholende Aufträge lassen 20 Fetches offen; ihre
  Antworten werden verworfen, laufende Arbeit ist damit noch nicht begrenzt.
  Schon im Terrain-Vorgänger vorhanden; Abbruch/Parallelität in M3 qualifizieren.
- **Qualitätsgegenprobe 24.10.:** Ein exakt 150 m² großer Waldstreifen verschwindet
  im Produktionsraster bei LOD2 vollständig, während LOD0-Kinder rund 301 m²
  Waldabdeckung liefern. Die Alpha-Fläche bleibt gleich und hätte den Fehler
  verdeckt. Der [Vergleich dreier Ansätze](../../reference/atlas-material-stream-20261024/README.md#entscheidende-qualitätsgegenprobe)
  priorisiert Flächenintegration aus Quellen als nächsten Prototyp: Kindmittelung
  bewahrt den Feinfehler und verzögert die Übersicht; feste Mehrfachabtastung
  erhöht Kosten ohne Flächengarantie. Noch kein ungeprüfter Ersatz im Produktpfad.
- **M2-Flächenprototyp:** [16 analytische Prüfungen und Kostenvergleich](../../reference/atlas-material-area-prototype-20261024/README.md)
  belegen die Komposition räumlicher Teilflächen vor der Mittelung: 150 m² in
  grober und feiner Stufe, nach 8-Bit-Quantisierung jeweils 150,588 m². Löcher,
  Überlappung, Wasser-/Pigmentkorrelation und Dichtefolge sind als Modelle geprüft.
  Naives Clipping jeder Zelle gegen die ganze Quelle wurde verworfen. Sichere
  Innenzellen und hierarchische Quellstücke erhalten identische Ergebnisse;
  detaillierte Grenze in drei wechselnden Runden im Median 5.698 → 300 ms.
  Isolierter Prototyp, keine Produkt- oder native Leistungsbehauptung.
  Adaptive weiche Integration ist noch zu teuer; der bisherige Bildschirmradius
  im Waldkanal verändert zudem die semantische Abdeckung je Zoomstufe.
- **M2-Quellen-/Randprototyp:** [35 Prüfungen und direkte Randintegration](../../reference/atlas-material-source-prototype-20261024/README.md)
  verbinden echte Basis-/Bewuchs-/Füllpigmentdatensätze mit der Flächenkomposition.
  Dichtekorrekturen besitzen eigene Teilflächengrenzen; Grundmaterial und löschbares
  Pigment bleiben getrennt. Harte Fixtures sind gegen den Produktionsraster geprüft.
  „Waldrand in m“ und die lineare Dichtekante des Generators bestätigen den
  Autorenradius; drei Bildpixel sind eine Darstellungsheuristik. Der explizite
  Weltvertrag trennt diese Regeln. Konvexe Randstücke bis Polynomgrad drei werden
  direkt integriert: Ein-Zellen-Gegenprobe im Median 196,7 → 3,93 ms, 131.072 → 16
  Auswertungen bei analytisch richtigem Ergebnis. Höhere Grade bleiben adaptiv.
  Noch kein produktiver Anschluss oder nativer Leistungsgewinn.
- **M2-Komplexe Quellen:** [48 gezielte Prüfungen und Restkostenprobe](../../reference/atlas-material-complex-source-20261024/README.md)
  erweitern den Prototyp um Legacy-Füllung und ursprüngliche Pinselabdrücke sowie
  konkave, mehrteilige und gelochte Bewuchsflächen. Quellen werden vor der
  Randmessung vereinigt; Überlappungen und gefüllte Löcher hinterlassen keine
  künstlichen Innenränder. Konvexe Teile behalten direkte Integration, sonst gilt
  eine konservative Fehlerschranke. Nacharbeit korrigiert vorzeitige
  Pigmentrundung und stabilisiert Randabstände über Maßstäbe und Translationen.
  **Gegenprobe:** Ein 6×6-m-Ring mit Loch erreicht bei Toleranz 0,08 das analytische
  Waldmittel bis auf 0,000002; bereits bei 0,02 und beim Ziel 1/255 überschreitet
  die gleichmäßige adaptive Unterteilung das Arbeitsbudget von zwei Millionen.
  Fachliche Erweiterung belegt, produktiver Leistungsgewinn weiterhin offen.
- **M2-Lokale Integration:** [Geometrische Zertifikate, Zellfehlerbudget und Gegenprobe](../../reference/atlas-material-local-integration-20261024/README.md)
  beseitigen diesen Ein-Zellen-Abbruch ohne höhere Toleranz oder mehr erlaubte
  Arbeit. Konstante Innenbereiche und nachgewiesen affine Randabstände werden
  direkt integriert; unbekannte Dreiecke nach ihrem größten gewichteten
  Fehlerbeitrag verfeinert. Vor Freigabe wird die Fehlersumme aller Teilflächen
  neu berechnet. 56 gezielte Tests bestehen, einschließlich Gradaddition,
  Rand-/Klemmübergängen und Ressourcenabbrüchen. Drei wechselnde Vergleichsrunden:
  nur die Kombination erreicht 1/255 im Budget, jeweils 190067 Arbeitsschritte,
  Median 367 ms. Eine synthetische 16×16-Ausgabe benötigt 862122 Schritte;
  256×256 überschreitet weiterhin das Budget. Kein nativer Produktgewinn belegt.
- **M2-Gekrümmte Ränder:** [Krümmungsschranken und volle synthetische Kachel](../../reference/atlas-material-curvature-20261024/README.md)
  erweitern die lokale Integration um nachgewiesen gemeinsame Endpunkte
  benachbarter Kanten. Eine konservative Schranke des fertig komponierten
  Materials ersetzt dort die zu grobe Lipschitz-Näherung. 61 gezielte Tests
  einschließlich unabhängiger Überlagerungsgegenprobe bestehen. Drei wechselnde
  Messrunden bei gleichem 1/255-Ziel und unveränderten Budgets: 16×16 benötigt
  im Median 1900 → 475 ms; 256×256 endet jetzt mit 1717443 Arbeitsschritten
  und 2768 ms statt Budgetabbruch. Die synthetische Kachel ist damit berechenbar,
  aber weder schnell genug als Produktnachweis noch unter vollständiger Weltlast
  oder nativ qualifiziert.
- **M2-Version-2-Pigment:** [Quellenanschluss, 77 Prüfungen und Ressourcenprobe](../../reference/atlas-material-v2-20261024/README.md)
  integrieren runde, weiche und strukturierte Pinselzüge mit gespeicherter
  Float32-/Byte-Deckkraftfolge, Land-/Wasserziel und Auftragen/Radieren.
  Unstetige Kreis-, Textur- und Byte-Grenzen erhalten komponierte Werteintervalle
  statt einer unzulässigen glatten Fehlerschranke. Die Produktionsquelle stimmt
  an 43008 Punkten überein; finale Farben bleiben Floatkomposition.
  Drei Messrunden widerlegen die Tragfähigkeit bloß weiterer adaptiver Verfeinerung:
  1×1 rund/weich im Median 59/172 ms, strukturiert bereits Budgetabbruch;
  256×256 scheitert für alle drei Spitzen. Quellenverhalten implementiert,
  Ressourcen- und Produktgewinn nicht abgenommen.
- **M2-Quellenbewusste Integration:** [102 Prüfungen und drei Vergleichsrunden](../../reference/atlas-material-source-integration-20261024/README.md)
  verbinden stabile Texturzellschnitte mit einer glatten Kernnäherung und explizit
  fortgeführtem Float32-/Byte-Quellenfehler. Vormultiplizierte private Pigmentkanäle
  vermeiden die Division bei Deckkraft null; sichtbare Floatkomposition bleibt gleich.
  256×256 weich/strukturiert ist jetzt in allen drei Runden berechenbar, im Median
  846/2512 ms bei 644086/1622625 Arbeitsschritten statt Budgetabbruch. 16×16 weich
  sinkt von 4023 auf 58 ms. Runde Vollkacheln scheitern weiterhin; die neuen
  Schätzwerte bringen ihnen keinen Gewinn. Synthetischer Prototypfortschritt,
  keine native Weltlast- oder Produktabnahme.
- **M2-Runde Flächenmittel:** [120 Prüfungen und Kostenvergleich](../../reference/atlas-material-round-mean-20261024/README.md)
  verbinden analytische Kreisflächen mit Trefferzahlhüllen und einer Komposition
  von Wertebereichen und Mittelwertintervallen. Überlappungen, wiederholte Stempel,
  gespeicherte Float32-/Byte-Deckkraft und Mal-/Radierreihenfolge bleiben erhalten.
  Volle einzelne und überlappende Rundstempelkacheln sind damit in drei von drei
  Runden innerhalb der unveränderten Budgets berechenbar: Median 640/700 ms statt
  Budgetabbruch. Die volle Mischkachel bleibt zu teuer;
  der neue Mittelweg spart dort Verfeinerungen, verursacht aber eigene Laufzeitkosten.
  Prototypgewinn belegt, keine native Weltlast- oder Produktabnahme.
- **M2-Begrenzte Quellen und ausreichende Schranken:** [132 Prüfungen und getrennte Gegenproben](../../reference/atlas-material-support-20261024/README.md)
  begrenzen aktive Stempelquellen konservativ und verwenden bereits ausreichende
  Kanalintervalle, bevor weitere Mittelwertverfahren gerechnet werden. Volle
  breite Mischkacheln sind damit in drei von drei Runden innerhalb der unveränderten
  Budgets berechenbar (Median 7,14 s statt Budgetabbruch).
  Die Produktionsgegenprobe korrigiert die ursprüngliche Annahme: Reguläre
  `brushFootprint`-Konturen sind schon eng begrenzt; dort spart erst die zweite
  Maßnahme Laufzeit in der Auswertung: Median 9,96 → 6,87 s für 256×256.
  Alle Materialkanäle, Land-/Wasserclips,
  Aussparungen und Malen/Radieren sind nachgeprüft. Native Weltlast bleibt offen.
- **M2-Quelleninventur und physischer Feldanschluss:** [Vollständige Inventur, 30 Tests und Weltgegenprobe](../../reference/atlas-material-physical-field-20261024/README.md)
  erfassen alle 108.076 Datensätze. 100.000 davon sind reine Metadatenflächen;
  die Welt enthält keine Pigmentzüge, Masken, physischen Trassen oder Seen und
  ersetzt deshalb deren Zusatzproben nicht. Ein begrenzter Quellen-Snapshot nutzt
  den kanonischen Hermite-/Wasserpfad mit ausdrücklich gelesenen Kampagneneinstellungen.
  4.356 Weltpunkte einschließlich 891 Wasserpunkten stimmen mit dem bestehenden
  Stream überein. Nachbarknoten und Wasserentscheidung vor Float32-Rundung sind
  durch Gegenproben abgesichert. Noch keine Flächenintegration oder Produktbeschleunigung.
- **M2-Physische Flächen und Planprüfung:** [46 Tests, Alternativenvergleich und drei Messrunden](../../reference/atlas-material-field-area-20261024/README.md)
  verbinden kanonische Höhen-/Wasserintervalle mit Grundfarbe, Bewuchs, Pigment
  und Radieren. Allgemeine Operationsintervalle plus weitere Dreiecke erwiesen
  sich als zu teuer: Der erste Insel-Fix scheiterte noch am zweidimensionalen
  Sattel und an der vollen Küstenkachel. Geteilte Quellausdrücke, gewichtete
  Hermite-Hüllen mit Rundungsaufschlag und gezielte Schnitte ersetzen diesen
  schwachen Ansatz. Sattel und volle Küste bestehen nun in drei von drei Runden
  innerhalb unveränderter Fehler-/Arbeitsbudgets. Die volle synthetische Küste
  benötigt aber weiterhin 4,52 s; auf konstantem Land entsteht kein belegter
  Gewinn. Trassenintervalle bleiben ausdrücklich unbekannt. Prototypfortschritt,
  keine native Produktbeschleunigung; Produktionspfad und Liefergates unverändert.
- **M2-Physische Trassenintervalle:** [71 unterschiedliche Prüffälle und zwei Kostenvergleiche](../../reference/atlas-material-route-area-20261024/README.md)
  ersetzen die pauschal unbekannte Planungskorridor-Hülle durch lokale
  Segment-/Profilintervalle mit Abtrag, Auftrag, Böschungen, Quellenfade und
  Bauwerken. Flussband, Kreuzung, wasserführender Straßeneinschnitt und volle
  Flusskachel bestehen jeweils drei von drei Läufen statt Budgetabbrüchen.
  Die Gegenprobe fand einen weiteren Abhängigkeitsverlust im gewichteten
  Quotienten; eine zusätzliche Ein-Trassen-Hülle senkt den Einschnitt von
  9.678 auf 713 ms. Die volle Flusskachel bleibt mit 7,30 s zu langsam, ihre
  Arbeitszahl sinkt nicht. Kanonische Punktberechnung und Produktpfad bleiben
  unverändert; keine native Produktbeschleunigung oder vollständige Weltabnahme.
- **Vereinfachung auf Nutzerauftrag (24.10.):** Feste 256×256-Kacheln mit
  mehreren Detailstufen ersetzen die geplante allgemeine adaptive Materialintegration
  im Laufzeitpfad. Polygonränder erhalten geometrische Pixeldeckung; variable
  Materialien verwenden ein festes 4×4-Abtastraster. Die bisherigen Prototypen
  bleiben Referenzversuche, sind aber keine vorgeschaltete Lieferbedingung mehr.
  Kanonische Höhen, Werkzeuge und gespeicherte Autorenabsicht bleiben exakt nach
  den bestehenden Regeln; ihre Bildschirmdarstellung ist eine begrenzte Näherung.
  Eine universelle garantierte Materialabweichung von 1/255 ist kein Laufzeitziel.
- **Raster-/GPU-Zwischenstand:** [57 Regressionen und native Probe](../../reference/atlas-raster-gpu-20261024/README.md). Flächendeckung, versionierte Materialkacheln,
  separate Höhenkacheln ohne Farbraster, gemeinsamer Höhen-/Materialstrom sowie
  besitzergebundener Leseabbruch sind implementiert. Eine native isolierte
  deck.gl-Probe zeigt Materialänderung ohne Meshneubau und kanonisches Picking.
  Der normale Atlas verwendet weiterhin seinen Referenzrenderer. Werkzeugübernahme,
  vollständiger Export, WASM und Zielgeräte-Leistung sind damit nicht abgenommen.
- **Nächste Arbeit:** Den gemeinsamen Kachelstrom über `AtlasPresentation` mit
  dem normalen Atlas und den vorhandenen Werkzeugen verbinden. Zuerst Gelände
  öffnen, bearbeiten, unmittelbar einen Folgezug beginnen, Undo/Redo und
  Save/Reopen zusammenhängend prüfen. Dann sämtliche M0-Objekte und Ausgaben
  übernehmen. Fels, Schnee, Licht und Höhenlinien werden auf der GPU erzeugt;
  die verbleibenden CPU-Fels-/Schneekanäle gehören nur zur Übergangsreferenz.
  Rust/WASM übernimmt anschließend den gemessenen begrenzten Rasterkern.
  Kalte Übersicht, LOD-Nähte, Küsten, kleine Inseln, dünne Flüsse, weiche Ränder,
  gekrümmtes Relief und aktive Ressourcen bleiben verpflichtende Gegenproben.
  Erst vollständige Funktionsübernahme und Qualifikation erlauben den
  Standardwechsel und das Entfernen ersetzter Pfade.
- **Fortschrittsführung:** Nur diesen Abschnitt für aktive Etappe, Beleg, Ergebnis
  und nächste Arbeit fortschreiben. Produktgewinn und offene Grenzen ausdrücklich benennen.

## Zielarchitektur und Schnittstellen

| Bestandteil | Verbindliche Verantwortung |
| --- | --- |
| **Main und SQLite** | Kanonische Autorendaten, validierte Änderungen, History, Receipts und Recovery. |
| **Persistenter Darstellungsbestand** | Räumlich adressierte Höhen-, Material- und Geometriedetails in mehreren Auflösungen; aus Autorendaten wiederherstellbar. |
| **Metrischer Atlas** | Kamera, Navigation, gemeinsame Projektion und Auswahlstrahlen; stabile Weltkacheladressen und sichtabhängige Nachladung. |
| **Beschriftung** | Bestehende Quellen, Hierarchie und Rechteck-Kollisionsprüfung; Texte und Symbole über deck.gl, gemeinsame Regeln für Bildschirm und Export. |
| **deck.gl** | Gebündelte Gebäude-, Raum-, Straßen-, Vegetations- und Objektschichten samt Auswahl. |
| **GPU-Terrain** | Eigene deck.gl-Schicht mit Höhenfeld-Clipmaps, Materialdarstellung und unmittelbarer Pinselvorschau. |
| **Rust/WASM** | Höhenabtastung, Materialrasterisierung und Aufbau gröberer Rasterstufen innerhalb begrenzter Workeraufträge. |
| **Bearbeitungssitzung** | Sofortige lokale Arbeitsfassung, asynchrone Bestätigung und kontrollierte Zusammenführung. |

Terrain, Objekte und Beschriftung teilen **einen WebGL2-Kontext, eine Kamera und
Tiefenverdeckung**. deck.gl 9.4.0 erhält eine öffentliche View-/Viewport-Anbindung
mit kartesischen Meterkoordinaten. Weltkoordinaten bleiben doppelt genau;
GPU-Puffer enthalten lokale Koordinaten pro Geometriebündel. Ein beweglicher
Darstellungsursprung ändert Transformationen, nicht die gespeicherten Geometrien.
MapLibre ist aus Quellcode, Laufzeitbuild und Abhängigkeiten entfernt. Der vorherige
Anschluss bleibt in der Git-Historie als überprüfbare Entwicklungsreferenz erhalten.
[deck.gl-Koordinatensysteme](https://deck.gl/docs/developer-guide/coordinate-systems).

Vier gemeinsame interne Verträge ersetzen verstreute Übergaben:

- **Kamera:** Weltfokus in Metern, Maßstab, Drehung, Neigung, Viewport und gemeinsamer
  lokaler Darstellungsursprung.
- **Darstellungskachel:** stabile räumliche Adresse, Detailstufe, Quellenstand,
  Format-/Stilversion, Objekt-IDs und binäre Datenpuffer.
- **Änderung:** betroffene Objekte, Kanäle und Weltbereiche einschließlich nötiger
  Randbereiche; daraus entstehen lokale Aktualisierungen.
- **Bearbeitung:** Gesten-ID, Ausgangsrevision, Eingabesegmente, vorläufiges Ergebnis
  und bestätigter beziehungsweise ungeklärter Schreibstatus.

Der Renderer erhält weiterhin ausschließlich begrenzte Fähigkeiten über die
Preload-Brücke. WASM besitzt keine eigene Datenbank- oder Dateiautorität.

## Umsetzung in neun Etappen

### M0 – Vergleichsbasis und vollständige Funktionsübernahme sichern

- Aktuellen Main-Stand, Runtime, Gerätebedingungen und vorhandene Atlasfunktionen festhalten.
- Die eingefrorene Asterfall-Welt für Bildvergleiche und die große Mischwelt für
  Lastprüfungen weiterverwenden.
- Öffnen, Navigation, Pinselbeginn, Pinselabschluss, Folgezug und Detailnachladung
  getrennt messen.
- Bestehende Werkzeuge und Verbraucher ihren Anforderungen und tatsächlichen Tests
  zuordnen; offene Produktfunktionen bleiben sichtbar.

**Abschluss:** Reproduzierbare Ausgangsmessungen und eine vollständige Übernahmeliste
liegen vor. Historische Messungen werden nicht als neue Baseline übernommen.

### M1 – Metrische Kamera und deck.gl direkt verbinden

**Setzt Ansätze 6 (ersetzt) und 7 um.**

- Vorhandene Atlas-Kameramathematik als gemeinsamen Besitzer für Darstellung,
  Auswahlstrahlen und Autorenwerkzeuge verwenden. Weltfokus einschließlich Höhe,
  Meter pro Pixel, 360° Drehung, 0–75° Neigung, Überhöhung und Zoom am Mauspunkt erhalten.
- deck.gl direkt über öffentliche View/Viewport-Schnittstellen anschließen;
  Terrain und Objekte teilen WebGL2 und den Tiefenpuffer.
- Stabile dyadische Weltkacheln mit vorzeichenbehafteten Rasteradressen verwenden:
  256 m auf Stufe 0, Seitenlänge 256 × 2^LOD. Wachstum ergänzt Kacheln, ohne
  vorhandene Adressen, Kamera oder GPU-Geometrie neu zu codieren.
- Weltpositionen doppelt genau halten, lokale GPU-Puffer und kameranahen,
  auf 256 m eingerasteten Darstellungsursprung verwenden. Ursprungswechsel dürfen
  während einer Geste weder Kamera noch Auswahl versetzen.
- Sichtbares Objekt per GPU bestimmen, seinen genauen Weltpunkt mit dem gemeinsamen
  Strahl verfeinern. Veraltete Frames sperren Auswahl; Tiefenpräzision bleibt Pflicht.
- Szenenmodelle, stabile IDs und Prüfungen übernehmen. Bibliotheken, Schriften und
  Symbole lokal bündeln; Main/SQLite und eingeschränkte Rendererrechte erhalten.

**Abschluss:** Terrain, Gebäude und Räume stimmen auf fünf Maßstäben überein;
auf jeder Stufe sind passend große Objekte tatsächlich auswählbar. Neigung,
Höhenfokus, Geschosse, Verdeckung, Resize, Kontextverlust, negative und weit entfernte
Koordinaten sowie Ursprungswechsel sind nativ geprüft. Unveränderte GPU-Puffer
bleiben erhalten. Anschließend entfallen MapLibre-Anschluss, Wurzelwechsel,
Projektionskorrekturen und ungenutzte Abhängigkeiten. Historische Belege bleiben.

### M2 – Persistente Darstellungspyramide aufbauen

**Setzt Ansatz 1 um.**

- Kachelanbindung vollständig im Atlas besitzen; persistente Daten, Nachladung,
  Invalidierung und begrenzter Cache verwenden dieselben stabilen Weltadressen.

- 256×256-Pixel-Materialkacheln mit festen Weltadressen ableiten; harte Polygonränder
  geometrisch integrieren, variable Felder mit festem 4×4-Raster abtasten.
  Grobe Kacheln direkt aus Quellen oder vorhandenen feineren Produkten gewinnen;
  niemals alle Kinder allein für eine Übersicht zwangsweise aufbauen.
- Vorhandene persistente räumliche Indizes um Höhen-, Grundfarben-, Material-,
  Vegetations- und Geometriedetailstufen ergänzen.
- Zuerst eine kleine nutzbare Übersicht bereitstellen; benötigte Details nach
  Sichtbarkeit und Maßstab nachladen.
- Verfügbare gröbere Stufen während des Nachladens verwenden.
- Änderungen räumlich bis zu ihren übergeordneten Detailstufen fortschreiben;
  unveränderte Bereiche bleiben gültig.
- Cacheversionen, atomare Veröffentlichung, Speicher-/Plattenlimits und Wiederaufbau
  beschädigter Bestände implementieren.

**Geprüfter Ersatz der Vorbereitungspolitik (24.10.):** Gespeicherte,
quellenidentische Darstellungsprodukte vor den globalen Projektionsindizes lesen.
Kanonische Snapshot-/Revisionsprüfung bleibt Pflicht. Erst ein Miss benötigt
Indexkopie, Synchronisation und Ableitung. Keine Hintergrundvorbereitung ohne
konkreten Bedarf und keine übersprungenen Änderungen in bereits aktiven Readern.

| Alternative | Kartenqualität | Reaktion | Bearbeitbarkeit | Wartbarkeit | Umstellungsrisiko |
| --- | --- | --- | --- | --- | --- |
| **Exakte Produkte zuerst (gewählt)** | Identische geprüfte Puffer | Warme Erstantwort deutlich kürzer; kalter Aufbau gleich | Bestehende Invalidierung; erste neue Detailanfrage trägt Vorbereitungsarbeit | Gemeinsame Quellenprüfung, kleine explizite Cachezugänge | Niedrig; Fallthrough und Übergang separat geprüft |
| Indizes nach Produkt aufteilen/verzögert laden | Gleich bei vollständiger Abhängigkeitsabbildung | Kann Teilkopien und irrelevante Indexarbeit sparen | Neue Abhängigkeiten zwischen Terrainhöhe, Geometrie und Auswahl | Mehr Teilzustände und Publikationsgrenzen | Mittel; ohne Messung der neuen Grenzen kein Ersatz gerechtfertigt |
| Räumlich begrenzte, inkrementelle Übersichtsquellen | Potenziell gleiche Qualität; vollständige Abdeckung/Fehlerhinweise zu beweisen | Größtes Potenzial für kalte Ansicht; noch ungemessen | Änderungen, Bindungen, Undo und Import brauchen räumliche Fortschreibung | Zusammenhängender neuer Quellenpfad statt globaler Erstkopie | Hoch; erst Gegenprobe für kalte Welt und exakte Details |

Die kalte Gegenprobe grenzt diese Alternativen inzwischen genauer ein:

| Kalte Vorbereitung | Kartenqualität | Reaktion | Bearbeitbarkeit | Wartbarkeit | Umstellungsrisiko |
| --- | --- | --- | --- | --- | --- |
| Vollständiger Landschaftsindex | Referenzverhalten | 1.571 ms Synchronisation im Versuch | Bestehende Invalidierung | Ein Bereitschaftszustand | Niedrig, bleibt Referenz |
| Kamerakachel mit Rand | M0 gleich, entfernter Workplane-Anker nachweislich falsch | 441 ms, fachlich nicht verwendbar | Änderungen außerhalb der Kamera fehlen | Zusätzliche räumliche Abhängigkeitsberechnung nötig | Hoch; pauschalen Zuschnitt verworfen |
| **Physische Felder zuerst (implementiert und nachgeprüft)** | M0, entfernter Anker und native Terrain-/Materialpuffer gleich | Native Geometrie 3.642 ms; sortierte Kopierblöcke begrenzen die verzögerte Ergänzung auf 2.190 ms Terrainantwort | Vollständige Ergänzung aus aktuellem Snapshot; Kategorieänderungen, Undo/Redo, 64-Bit-Rowids und Rollback geprüft | Explizite Teil-/Vollmarkierung und feste Kopierblöcke statt Kameraheuristik | Übergänge lokal/native geprüft; volle M2-Welt-/Ressourcenabnahme offen |

Eine spätere räumliche Vorbereitung mit vollständigen Abhängigkeiten bleibt
möglich; der Versuch widerlegt nur den pauschalen Kamerafilter. Der belegte warme
Ersatz und die kalte Bibliotheksgegenprobe schließen M2 nicht ab. Der neue
Raster-/GPU-Pfad wird aufgrund des Nutzerauftrags vorgezogen und separat geprüft.

**Abschluss:** Eine unveränderte Welt benötigt beim erneuten Öffnen keine
vollständige Terrain- oder Geometrieaufbereitung. Lokale Änderungen erneuern
ausschließlich ihre fachlich betroffenen Bereiche.

### M3 – Auftragsverarbeitung und WASM-Kern integrieren

**Setzt Ansätze 5 und 8 um.**

- Interaktive Auswahl und sichtbare Aktualisierung von Hintergrundverfeinerung und
  Export trennen.
- Zunächst einen interaktiven und einen Hintergrund-Rechenworker verwenden;
  weitere Worker nur bei nachgewiesenem Gesamtnutzen.
- Lange Aufgaben in begrenzte, abbrechbare Abschnitte zerlegen. Überholte
  Kameraaufträge verwerfen; unklare Schreibvorgänge niemals automatisch wiederholen.
- Binäre Puffer und explizite Besitzübergaben verwenden; Kopien über jede
  Prozessgrenze messen.
- Höhenabtastung, Materialrasterisierung und Rasterverkleinerung nach Rust/WASM
  übertragen. Die bisherigen Implementierungen dienen während der Umstellung
  als Testreferenz.
- Rust-Toolchain, reproduzierbaren WASM-Build, Lizenzdateien und Paketierung in die
  vorhandenen npm-/CI-Einstiege aufnehmen.

**Abschluss:** Auswahl und Navigation bleiben während Hintergrundarbeit bedienbar.
WASM liefert fachlich gleichwertige Ergebnisse und übernimmt reale Produktberechnungen.

### M4 – GPU-Terrain und Materialdarstellung ersetzen

**Setzt Ansatz 2 um.**

- Stabile Weltkacheln und Detailstufen mit wiederverwendeten GPU-Puffern implementieren.
- Höhe, Wasser, Grundfarbe und Materialmasken getrennt laden und lokal aktualisieren.
- Fels, Schnee, Beleuchtung und Höhenlinien aus den aktuellen Daten auf der GPU darstellen.
- Übergänge zwischen Auflösungen, Küsten, Wassergrenzen und große Koordinaten ohne
  sichtbare Nähte behandeln.
- GPU-Kontextverlust, Ressourcenfreigabe und Wiederaufbau integrieren.

**Abschluss:** Gelände bleibt bei Navigation stabil; Höhenänderungen aktualisieren
auch die Materialwirkung unmittelbar. Darstellung und Höhenauswahl stimmen überein.

### M5 – Städte, Räume und Landschaftsobjekte effizient darstellen

**Setzt Ansatz 3 um.**

- Geometrien räumlich bündeln, binär an deck.gl übergeben und unveränderte GPU-Puffer behalten.
- Wiederholte Bäume, Felsen und Symbole instanziert zeichnen.
- Maßstabsabhängige Darstellungen für Siedlung, Gebäude und Innenraum vorberechnen.
- Gebäudehüllen, Geschosse, Räume, Ausstattung und Beschriftung mit stabilen Objekt-IDs verbinden.
- Auswahl und Änderungen auf einzelne Objekte beziehungsweise betroffene Bündel begrenzen.
- Vorhandene Beschriftungsquellen, Prioritäten und Rechteck-Kollisionsprüfung
  wiederverwenden; deck.gl zeichnet sämtliche Namen und Symbole. Bildschirm und
  Export teilen Platzierungsregeln, ohne doppelte kartografische und Autorennamen.

**Abschluss:** Die große Stadt lässt sich bis zum eingerichteten Innenraum
durchgehend erkunden und bearbeiten. Detailreduktion verändert keine Autorendaten
und verhindert keine gezielte Auswahl.

### M6 – Bearbeitung ohne Nachladepausen ermöglichen

**Setzt Ansatz 4 um.**

- Terrain-, Farb- und Objektwerkzeuge sofort gegen eine lokale Arbeitsfassung darstellen.
- Eingaben gesammelt asynchron an den bestehenden Writer übergeben; dessen
  bestätigte Änderungen in die Darstellung übernehmen.
- Pinselabschluss von feiner Farb- und Geometrienachladung entkoppeln.
- Folgezüge gegen die aktuelle lokale Arbeitsfassung ermöglichen;
  Schreibreihenfolge und Ausgangsrevision bleiben eindeutig.
- Geschützte Geometrie, Wasserregeln und zulässige Bearbeitungsbereiche bereits
  in der Vorschau berücksichtigen.
- Bei Ablehnung oder ungeklärter Bestätigung betroffene Bearbeitung kontrolliert
  anhalten und Wiederherstellung anbieten.

**Abschluss:** Große Pinselzüge zeigen laufende Änderungen; unmittelbar danach ist
ein weiterer Zug möglich. Undo/Redo behandelt jeden Zug als einen Schritt.

### M7 – Vollständigen Atlas und seine Ausgaben übernehmen

- Sämtliche vorhandenen Werkzeuge aus M0 anschließen: Terrain, Gewässer, Trassen,
  Bewuchs, Regionen, Assets, Gebäude, Räume und räumliche Bearbeitung.
- Reise, Maße, Suche, Inspector, Wissensfilter und Spieleranzeige übernehmen.
- PNG/JPEG einschließlich gekachelter Ausgabe bis mindestens 8192 × 8192 Pixel aus
  demselben Szenen- und Materialmodell erzeugen.
- Ausgabe an einen festen Quellenstand binden; sie beeinflusst weder Kamera noch
  laufende Bearbeitung.
- Save/Reopen, Archive, Backupwiederherstellung, Offlinebetrieb und tatsächlichen
  App-Einstieg prüfen.

**Abschluss:** Die Übernahmeliste ist vollständig abgearbeitet; keine bestehende
Funktion benötigt den alten Atlas.

### M8 – Zielgerät qualifizieren und den alten Kern ablösen

- Vollständige Autorenreise und große Lastwelt auf dem Pentium Gold 7505 bei 1080p prüfen.
- Messungen unter normalem Startpfad durchführen; Bildauslesen und Profilierung
  getrennt erfassen, damit sie die Navigationsmessung nicht verfälschen.
- Nach erfüllten Funktions-, Bild- und Leistungszielen den neuen Atlas zum einzigen
  regulären Produktpfad machen.
- Ersetzte Renderer, Berechnungen und Übergangsadapter entfernen;
  historische Prüfarbelege behalten.
- Installiertes Paket, regulären Neustart und erneutes Öffnen qualifizieren.

**Abschluss:** Alle acht Ansätze haben eine nachgewiesene Produktfunktion; die
vollständige Atlasfläche erfüllt die gemeinsamen Abnahmekriterien.

**Umsetzungsfolge nach Vereinfachung:** Auf M0/M1 folgen die benötigten Teile von
M2/M3/M4 gemeinsam und unmittelbar ein vollständiger Bearbeitungsablauf aus M6.
Anschließend folgen die übrige Objekt-/Werkzeugübernahme aus M5/M7, der
Rust/WASM-Rasterkern aus M3 und die vollständige M8-Qualifikation. Alle acht
Produktansätze und Liefergates bleiben verbindlich; Materialprototypen blockieren
keinen praktisch prüfbaren Arbeitsablauf mehr. Isolierte technische Belege zählen
weiterhin nicht als Funktionsübernahme oder gemessene Produktbeschleunigung.

<a id="4-verbindliche-abnahme-und-testfälle"></a>

## Gemeinsame Abnahme

| Bereich | Verbindliches Ziel |
| --- | --- |
| Navigation | Bildintervalle p95 ≤16,7 ms, p99 ≤33,3 ms |
| Kamera | Reaktion im nächsten darstellbaren Bild, unabhängig von Datenbank und Nachladung |
| Terrainbearbeitung | Erste tatsächliche Gelände-/Farbänderung p95 ≤100 ms |
| Raum-/Objektvorschau | p95 ≤50 ms |
| Kaltes Öffnen | Nutzbare grobe Übersicht p95 ≤2 s |
| Gewöhnliches Speichern | p95 ≤500 ms; Darstellung wartet nicht darauf |
| Lange Aufgaben | Fortschritt binnen 100 ms; über 2 s abbrechbar |
| Ressourcen | Begrenzte Bestände und Speicherplateau über mindestens 30 Minuten Navigation mit Bearbeitung |

Zusätzlich verpflichtend:

- Getrennte Messreihen für Erstaufbau, Prozessneustart mit persistenten Daten und
  warme Navigation; keine vermischten Ergebnisse.
- Wiederholte große und kleine Pinselzüge einschließlich Folgezug, Undo/Redo und
  frischem Öffnen; der große Lastfall umfasst weiterhin 2.500 Meilen Pinselradius.
- Visueller Vergleich derselben vollständig geladenen Welt: Küsten, Relief, Wald,
  Straßen, Namen, Gebäude und Innenräume.
- Fehlerprüfungen für beschädigte Caches, überholte Antworten, Workerabbruch,
  GPU-Verlust, Schreibfehler und ungeklärte Bestätigung.
- Konstante Datenmenge und vergleichbare sichtbare Details; ausgelassene Inhalte
  zählen nicht als Beschleunigung.
- Lokale Messergebnisse, physische Zielgeräteprüfung und persönliche Nutzerabnahme
  bleiben getrennte Nachweise.

<a id="arbeitsweise-ab-23102026"></a>

## Lieferung und Fortschrittsführung

- Bestehende Anforderungen und Quellenbindungen erhalten; die Roadmap ersetzt die
  technische Lieferfolge, nicht den Produktumfang.
- Tatsächlich geprüfte Abläufe und Testdateien im Capability-Katalog pflegen und
  mit `--geprueft` erfassen.
- Während der Entwicklung betroffene Tests, Typ-/Buildprüfungen und native Abläufe ausführen.
- Vor Integration alle vorgeschriebenen Prüfungen über die echte
  **Candidate · exact-SHA aggregate**-CI bestehen: `npm run check:repo`,
  `npm run check`, `npm run check:desktop`, `npm test`, `npm run build` und
  `npm run build:desktop`. Linear auf aktuellem `origin/main` integrieren.
- Nach jeder Integration die Zehn-PR-Releasepflicht prüfen und gegebenenfalls den
  signierten Release einschließlich Paket-/Neustartprüfung abschließen.
- Keine pausierten Automationen reaktivieren. Fortschritt anhand erfüllter
  Etappenkriterien berichten; Zeitaufwand und Beschleunigungsfaktoren erst aus
  tatsächlichen Ergebnissen ableiten.
- Nach Unterbrechungen tatsächlichen Prozess-, Git- und Prüfstand feststellen.
  Nutzerinhalte, fremde Arbeit und die lauffähige Referenz erhalten. Keine
  erzwungene frühe Teilintegration, keine uhrzeitgebundenen Releases und keine
  drei fehlerfreien Audits als Ersatz für erfüllte Abschlusskriterien.

## Fortgeltender Produktumfang

Eine gemeinsame Kartenfläche im wachsenden ebenen Meterraum verbindet Welt,
Landschaft, Stadt, Gebäude und Innenraum. Draufsicht und Nordausrichtung bleiben
unmittelbar erreichbar. Räumliche Bearbeitung ist auch innerhalb von Gebäuden
und Dungeons ohne erzwungene Draufsicht möglich. Darstellungsauflösung und
Bearbeitungsauflösung bleiben getrennt; große Pinsel dürfen feine Details nicht
stillschweigend zerstören.

Straßen, Gebäude, Plätze und andere Objekte bleiben unabhängig. Benannte Gebiete
auf politischen, geographischen oder eigenen Ebenen besitzen weder eine Stadt
noch deren Geometrie. Gebiet ändern oder löschen verändert keine darunterliegenden
Objekte; alte Stadtdokumente erzeugen keine impliziten Marker oder Grenzen.

Bestehende Dateien, Identitäten, `CampaignWorkbench`-Daten und Archivformate
bleiben geschützt. Noch offene eigenständige Stadt-/Dungeon-Paritätsfeatures
bleiben in ihren Fachroadmaps. Ein bestandener technischer Umbau erklärt sie
nicht für umgesetzt. Die [Werkzeug- und Verbraucherzuordnung](unified-atlas-baseline.md#umfang-und-quellenzuordnung)
sowie [scope-sources.json](../../scope-sources.json) bleiben der Umfangsanschluss.
Die vorhandenen Abnahmefälle, darunter `E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001`,
`E2E01-HEX-SPACE-STORE-001`, `E2E01-HEX-SPACE-HOST-001` und `CTY-007.01`, werden
nicht durch diesen Roadmapwechsel auf bestanden gesetzt.

Technisches Nutzerziel bleibt unmittelbare Navigation wie bei Google Maps;
gestalterisches Ziel sind lesbare Fantasykarten. Zusammenhängende Wälder,
scharfe Küsten, verständliche Straßen-/Flussklassen und maßstabsabhängige Namen
werden über Welt-, Kontinent-, Königreich-, Stadt- und Innenraumansicht gemeinsam bewertet.

### Verbindlicher Landschaftswerkzeugumfang (21.10.2026)

Die folgende Konkretisierung des Nutzerauftrags bleibt neben M0–M8 verbindlich. Sie beschreibt
Sollverhalten; vorhandene Werkzeuge und einzelne Nachweise gelten nicht als
Abnahme des gesamten Umfangs. „Aufrauen“ ist ausdrücklich bestätigt.

| Werkzeug | Gefordertes Verhalten | Fachlicher Anschluss |
| --- | --- | --- |
| Terrain: Sculpt | Einfaches Erhöhen, Senken und Aufrauen mit natürlichen Unebenheiten; Aufrauen ist eine eigene Wirkung, nicht nur eine Zufallsvariation beim Erhöhen. | [Relief](terrain-relief.md), M6 |
| Terrain: Smooth | Gelände gezielt glätten, mit nachvollziehbarer Stärke und Bearbeitungsskala. | [Relief](terrain-relief.md), M6 |
| Terrain: Feature | Hügel, Bergketten, Schluchten und vergleichbare komplexe Formen mit wenigen Eingaben schnell erzeugen und weiterbearbeiten. | [Relief](terrain-relief.md), M6–M7 |
| Gebirgsmaterial (ergänzt 23.10.2026) | Höhe und Hangneigung modulieren Geländefarbe und Textur: steinigere Hänge und schneebedeckte Gipfel oberhalb einer einstellbaren Schneegrenze, mit weichen Übergängen. Gemalte Grundfarben bleiben erhalten. | [Relief R4](terrain-relief.md#r4--den-gezeichneten-kartenstil-ausarbeiten), M4–M7 |
| Geländearten | Wald, Wüste, Sumpf und weitere Typen auf weiter, mittlerer und naher Distanz lesbar darstellen; weiche Übergänge an ihren Rändern. | [Landschaft](landscape-tools.md), [Bewuchs](vegetation.md), M4–M7 |
| Wasser | Flüsse finden sinnvolle geländeabhängige Wege zwischen gesetzten Punkten; Seen füllen passende Geländebecken. | [Trassen und Gewässer](terrain-routes.md), M6–M7 |
| Infrastruktur | Feldweg, Hauptstraße, Gasse und weitere Straßenarten erhalten passende Linien-/Texturdarstellung, Bildschirmbreiten und Sichtbarkeitsübergänge beim Zoom. | [Trassen](terrain-routes.md), [Kartografie](atlas-cartography.md), M4–M7 |
| Gebäude | Gebäude mit D&D-Raster in den Innenräumen und mehreren Etagen bleiben Teil derselben Atlasfläche. | [Raumgruppen](room-groups.md), [räumliche Dungeons](../dungeon/smr04-spatial-coverage.md), M7 |
| Gebiete | Benannte gemalte Gebiete auf voreingestellten politischen und geographischen Ebenen sowie eigenen Ebenen; jede Ebene hat ihre eigene Hierarchie. Die Geometrie darunter bleibt unabhängig. | [Kartografie](atlas-cartography.md), M4–M7 |

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

Die Leistungs- und visuellen Kriterien aus der gemeinsamen Abnahme gelten für alle diese
Abläufe. Bekannte Lücken verhindern den Gesamtabschluss; Etappen enden nach den
in M0–M8 festgelegten Ergebnis- und Regressionskriterien, nicht nach einer Auditanzahl.

## Historische Nachweise

<a id="p0--umfang-und-vergleichbare-ausgangsbasis-sichern"></a>
<a id="beauftragte-umsetzung-vorhandenen-atlas-weiterentwickeln"></a>

Die früheren Phasen P0–P8 und inkrementellen Arbeitsentscheidungen sind durch
M0–M8 ersetzt. Historische Links auf P0 oder die frühere beauftragte Umsetzung
führen deshalb hierher. Ihre damaligen Kriterien und datierten Messungen stehen
im [unveränderlichen Vorgängerstand](https://github.com/ThonkTank/Salt-Marcher/blob/d3d31363fc40cff1f0f2f5d0b6699dacd54e8b30/docs/plans/maps/unified-spatial-atlas.md).
Alle vorhandenen Berichte unter `docs/reference/` bleiben erhalten. Aussagen wie
„keine Engine ausgewählt“ oder frühere nächste Schritte gelten ausschließlich
für ihren datierten Stand, nicht für diesen Beschluss.
