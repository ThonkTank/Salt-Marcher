# Roadmap: gezeichnetes Geländerelief und kippbarer Atlas

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: atlas
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Zieländerung vom 20.10.2026: Die [Roadmap für den gemeinsamen räumlichen Atlas](../architecture/unified-spatial-atlas.md) ersetzt getrennte Drauf-/Kippdarstellung durch eine gemeinsame perspektivische Kamera. Die folgenden Implementierungs- und Prüfbefunde beschreiben den bisherigen Stand; sie belegen den neuen Atlas noch nicht.

Ursprünglicher Arbeitsplan aus dem Nutzerentscheid vom 19.10.2026. Die damalige starre Phasenfolge wird durch die ergebnisbezogenen Etappen der aktuellen Atlas-Roadmap ersetzt. R0 wurde visuell abgenommen. Seit der Nutzeranweisung „Warte bitte nicht auf abnahmen von mir. Arbeite einfach weiter.“ werden weitere Phasen ohne Abnahmepausen umgesetzt und selbst geprüft; eine Nutzerabnahme wird dadurch nicht behauptet. Der Status steht am Ende dieser Datei; ein Prototyp ist kein Produktnachweis.

Aktuelle Arbeit folgt der [Arbeitsweise und Etappe vom 23.10.2026](../architecture/unified-spatial-atlas.md#ziel). Ältere Implementierungsbelege unten bleiben historisch; die Phase R3 ist wegen des jüngeren Feature-Auftrags wieder offen. Größere isolierte Ersatzentwicklungen sind zulässig.

## Ziel und festgelegter Umfang

Der Atlas erhält eine kontinuierliche Höhenlandschaft mit zusammenhängenden Gebirgen, Tälern, Pässen und Plateaus. Dieselbe perspektivische Kartenfläche zeigt das gezeichnete Gelände in Draufsicht oder geneigt; Gebäude erscheinen als Baukörper mit Dächern. Gelände, Grundrisse und Innenräume bleiben auch bei geneigter Kamera bearbeitbar.

- Höhen bestimmen Land und Meer automatisch. Küsten entstehen am Schnitt mit dem Meeresspiegel.
- Höhen, Steigungen und Streckenprofile sind abfragbar. Bestehende Höhennutzer werden angeschlossen; neue Reise- und Sichtregeln gehören nicht zu dieser Roadmap.
- Bestehende Testdaten benötigen keine Migration. Entwicklung und Abnahme verwenden neue Testkampagnen; vorhandene Daten werden nicht automatisch gelöscht.
- Gezeichnetes Relief ist der Standardstil. Höhenlinien und Höhenfarben sind zuschaltbare Analyseansichten.
- Vollständige Dungeonvisualisierung in 3D, freie Begehung, Überhänge, Höhlenmodellierung, Erosionssimulation und automatische Flusssysteme bleiben spätere Erweiterungen.

## Technische Grundlage

**Ein gemeinsames Höhenmodell.** Gelände besitzt eine Höhe in Weltmetern unabhängig vom Hexraster. Hexes bleiben räumliche Spielstruktur und Abfrageebene. Die heutige Landmaske wird für neue Geländedaten durch eine aus Höhe und Meeresspiegel abgeleitete Maske ersetzt. Farbe, Geländeart und Klima bleiben eigene Eigenschaften.

**Lokale Verfeinerung statt weltweiter Vollauflösung.** Höhen werden räumlich gekachelt und in mehreren Auflösungen verarbeitet. Feine, ausdrücklich bearbeitete Bereiche bleiben bei groben Änderungen geschützt. Zoom lädt oder vereinfacht Darstellung; er erzeugt keine Landschaft. Höhenabfragen verwenden den maßgeblichen Datenstand und melden ihre tatsächliche Auflösung.

**Eine gemeinsame Kartenfläche.** Die frühere Aufteilung in Canvas-Draufsicht und orthografische Geländeansicht ist durch die gemeinsame perspektivische Hauptkamera ersetzt. Draufsicht, Neigung und Drehung teilen Daten, Auswahl und Werkzeuge. Die Wahl der Engine ist gemäß aktueller Atlas-Roadmap offen.

**Aktuelle Speichergrenze.** Bis zu einem geprüften Ersatz sind Main/SQLite kanonisch; der Renderer bekommt begrenzte Bereichsdaten über Preload. Höhenänderungen nutzen bestehende Revisionen, Transaktionen, Undo/Redo und Archive. Geometrien, Schattierungen und Übersichtskacheln sind abgeleitete Daten.

Neue fachliche Schnittstellen:
- Terrainänderungen durch Land formen und Glätten; Farbe bleibt getrennt.
- Bereichs- und Punktabfragen für Höhe, Neigung, Normalen, Auflösung und Datenrevision.
- Streckenprofile mit Entfernung, Höhenverlauf sowie Auf- und Abstieg.
- Vertikale Objektbindung: Geländeanker plus Höhenversatz oder ausdrücklich feste Höhe.
- Gemeinsamer Ansichtsstatus mit Mittelpunkt, Maßstab, Drehung, Neigung und rein visueller Höhenüberhöhung.

## Lieferetappen

### R0 — Darstellung und Bedienbarkeit als isolierten Prototyp prüfen

Eine feste Testlandschaft erstellen: Küste, verzweigtes Gebirge, breites Tal, Pass, Plateau, Fluss und Bergdorf. Dieselben Daten in Draufsicht und gekippter Ansicht zeigen. Weiche Schattierung allein und Schattierung mit zurückhaltenden Felsstrichen vergleichen. Drei Maßstäbe prüfen: Kontinent, Region und Ort. Bereits hier Kamerabewegung, Geländetreffer und einfachen Höhenpinsel im nativen Electron-Fenster erproben.

Abnahme: Gebirge und Pass sind in beiden Ansichten verständlich; Ortsnamen bleiben lesbar; die gezeichnete Variante erhält eine visuelle Nutzerabnahme. GPU-Darstellung funktioniert auf dem vorgesehenen Laptop. Erst danach beginnt Produktintegration.

### R1 — Höhenkern, Speicher und automatische Küsten

Gekacheltes Höhenmodell einschließlich lokaler Verfeinerung, gemeinsamer Abfragen und versioniertem Speicherformat einführen. Meeresspiegel ist eine Kampagneneinstellung, anfangs 0 Meter. Unbearbeitete Bereiche liegen darunter. Land und Meereswasser ausschließlich aus dem wirksamen Höhenfeld ableiten. Landwerkzeuge bearbeiten künftig dieses Feld; keine zweite unabhängig schreibbare Landmaske. Farbe bleibt getrennt.

Die Punktabfrage zeigt neben der Höhe die tatsächliche Datenauflösung. Bei Land formen und Glätten steht die Pinselauflösung direkt beim Radius. Trifft ein gröberer Pinsel auf ausdrücklich feinere Daten, erklärt ein Hinweis den Schutz und verweist auf einen kleineren Radius; nur im Bildschirmgrößenmodus hilft auch näheres Heranzoomen. Während des Malens erscheint dieselbe Rückmeldung am Kartenpunkt, damit sie auch bei vergrößerter Oberfläche und gescrollten Einstellungen sichtbar bleibt. Der Schutz selbst bleibt unverändert.

Süßwasser bleibt ein Autorenobjekt mit Wasserstand und begrenzter Fläche. Sichtbare Wasserfläche berücksichtigt Gelände; automatische Überläufe und Abflussberechnung sind ausgeschlossen.

Abnahme: Insel anheben, Meerenge absenken, rücknehmen und nach Neustart wiederfinden. Vorschau, Küste, Punktabfrage und gespeicherter Zustand stimmen auch an Kachelgrenzen überein.

### R2 — Erste benutzbare Höhenbearbeitung in Draufsicht

Drei Landpinsel: Land formen mit Erhöhen/Absenken, Stärke, Roughness und optionaler Zielhöhe; Land bemalen mit Farbradierung; Glätten mit eigener Stärke. Größe in Weltmaßen und weicher Rand sichtbar einstellbar. Eine aktive Zielhöhe begrenzt die gewählte Richtung ohne Überschwingen oder Gegenbewegung; Roughness verändert niemals die Operationsart. Küstenänderung bereits in der Vorschau. Einfache Reliefschattierung, Höhenwert am Cursor und optionale Höhenlinien. Geste = ein Undo-Schritt; Abbruch und Schreibfehler erhalten Ausgangsstand beziehungsweise Entwurf.

Abnahme: Küstenregion mit Hügeln, Hochfläche und Tal vollständig erstellen, korrigieren, speichern und als Bild ausgeben. Erster produktiv nutzbarer Zwischenstand mit echten Geländeformen und Küstenkopplung.

### R3 — Geländeformen schnell erstellen (wieder offen)

Der Ausschluss spezieller Formenwerkzeuge vom 20.10.2026 ist durch den jüngeren
[verbindlichen Feature-Auftrag](../architecture/unified-spatial-atlas.md#funktionsumfang)
überholt. Hügel, Bergketten, Schluchten und vergleichbare Formen sollen mit wenigen
Eingaben entstehen und anschließend mit Sculpt und Smooth bearbeitbar bleiben.
Lokale Verfeinerung, geschützte Details, eine nachvollziehbare Vorschau und Undo/Redo
bleiben erforderlich. Dieser Umfang ist nicht durch vorhandene Landpinsel erfüllt.
Ein Höhenkartenimport wird durch den Feature-Auftrag nicht zusätzlich beauftragt.

Abschluss: Gebirgskette und Schlucht erzeugen, lokal korrigieren, in Kontinent-,
Regions- und Ortsmaßstab sowie geneigt prüfen; Undo/Redo und frisches Öffnen
bewahren Form und feine Korrekturen. Die technische Umsetzung ist noch offen.

### R4 — Den gezeichneten Kartenstil ausarbeiten

Weiche Schattierung, betonte Grate und hangorientierte Felsstriche kombinieren. Flache Bereiche bleiben ruhig; Steilheit steuert Felsdarstellung. Maßstabsgerechte Details ohne Flimmern oder Kachelnähte; große Formen bleiben in Übersicht erkennbar. Palette, Licht und Strichstärke bilden gemeinsames Stilprofil.

**Ergänzung vom 23.10.2026:** Gebirge modulieren Geländefarbe und Textur anhand tatsächlicher Höhe und Hangneigung. Steile Hänge wirken steiniger; Gipfel oberhalb einer einstellbaren Schneegrenze erhalten Schnee mit weichem Übergang. Dies ersetzt den früheren Ausschluss höhenabhängigen Schnees. Die Modulation wird aus dem Höhenmodell abgeleitet und überschreibt weder gemalte Grundfarben noch gespeicherte Geländearten. Sie gilt in der gemeinsamen Atlasansicht bei Draufsicht, Neigung und Drehung sowie in der Bildausgabe. Zoom verändert die Detaildichte, nicht die physische Schneegrenze. Höhenüberhöhung ist rein visuell; sie verschiebt weder Schneegrenze noch Materialzuordnung. Die festen physischen Höhenstufen der Höhenlinien bleiben davon unabhängig.

Abnahme: R0-Landschaft mit den drei Landpinseln nachbauen und in drei Maßstäben vergleichen; Beschriftung, Straßen, Küsten und PNG visuell prüfen. Für die Ergänzung vom 23.10.2026 zusätzlich flache Hochflächen, steile Hänge und Gipfel unterhalb, innerhalb und oberhalb des Schneeübergangs vergleichen. Anheben, Absenken, Glätten und Ändern der Schneegrenze aktualisieren die Darstellung nachvollziehbar; Undo/Redo und frisches Öffnen stellen denselben Zustand wieder her. Pan, Zoom und Kameraneigung erzeugen keine wandernden Texturen, Kachelnähte oder sprunghaften Materialwechsel. Große Pinsel und volle Weltkarten behalten die gemeinsamen Reaktionsziele. Frühere R4-Nachweise belegen diese Ergänzung noch nicht. Der [Materialschritt im gemeinsamen Rasterkern](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/atlas-mountain-material-20261023/README.md) setzt Farbe, Textur und einstellbare Schneegrenze um; die unmittelbare Materialreaktion während großer Sculpt-Gesten und die vollständige Leistungs-/Gestaltungsabnahme bleiben offen.

### R5 — Kippbare Ansicht und direkte Geländebearbeitung integrieren

Prototyp-Renderer an produktive Terrainabfragen anschließen. Maßstabsabhängige Geometriedichte und kameranahe Koordinaten. Ansichten teilen Auswahl, Mittelpunkt, Werkzeuge und History; direkte Rückkehr zur Draufsicht. Höhenüberhöhung bleibt visuell. Alle drei R2-Landwerkzeuge funktionieren auf sichtbarer Oberfläche. Treffpunkt und Radius korrekt in Weltkoordinaten zurückführen, auch bei Überhöhung; verdeckte Teile nicht versehentlich mitbearbeiten.

Abnahme: Pass in gekippter Ansicht absenken, Draufsicht, Undo/Redo. Position, tatsächliche Höhe und Küste identisch.

### R6 — Straßen, Wasser, Gebäude und Höheninformationen verbinden

Der Straßen-/Flussteil ist nach dem [ergänzten Plan](../contract/terrain-routes.md) lokal implementiert; [Prüfungen und Bilder](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/terrain-routes-20261020/README.md) dokumentieren den Stand. Die folgenden Gebäude-/Dungeoneingangsarbeiten bleiben offen.

Straßen/Flüsse auf Gelände darstellen. Die Nutzerentscheidung vom 20.10.2026 erweitert diesen Teil um [geländegebundene Trassenplanung](../contract/terrain-routes.md): Autoren setzen Pflichtpunkte und Eingriffsgrenzen; Trasse und Geländeform dürfen sich innerhalb dieser Grenzen gemeinsam anpassen. Ein Schutzschalter begrenzt andernfalls den Geländepinsel örtlich, ungeschützte Konflikte bleiben sichtbar. Einfache Baukörper/Dächer aus Grundrissen; vorhandene Geschosshöhen verwenden, fehlende Bauhöhen als editierbare Vorgaben. Gebäude waagerecht, bei Bedarf Fundamente. Geländegebundene Gebäude folgen Anker als Ganzes; Grundrisse/Geschossabstände/Innenräume nicht verformen. Dungeoneingänge mit Höhenanker. Auswahl öffnet dieselben Orte/Keys; Grundrissbearbeitung führt mit Fokus in Draufsicht.

Höhe, Hangneigung und Streckenprofil anschließen. Wetter und bestehende hexbasierte Sichtprüfung lesen dasselbe Modell, übrige Regeln unverändert.

Abnahme: Bergdorf, Passstraße und Eingang platzieren, Gelände ändern und Bindungen prüfen; Streckenprofil über Pass stimmt.

### R7 — Ausgabe, große Karten und Produktabnahme

Beide Ansichten als PNG/JPEG mit gewählter Perspektive, Ausschnitt, Stil und Überhöhung. Spieleransicht/-export enthalten ausschließlich freigegebene Inhalte. Große verteilte Landschaft: grobe Übersicht zuerst, Details nachladen, überholte Anfragen verwerfen, Ressourcen freigeben. Bei GPU-Ausfall gespeicherten Stand in Draufsicht zugänglich halten.

Endabnahme: Neue Region vom leeren Meer bis Gebirge/Pass/Dorf/Eingang erstellen; in beiden Ansichten korrigieren, neu öffnen, Profil prüfen und Bilder ausgeben.

## Prüfung und Lieferung

- Daten: bekannte Höhenflächen, Küstenschnitt, negative Koordinaten, Kachelränder, Auflösungswechsel, geschützte Details, Abbruch, Undo/Redo, Schreibfehler und Archivwiederherstellung.
- Darstellung: feste Szenen für Draufsicht/Neigung; Küsten/Grate/Beschriftung/Gebäude in mehreren Maßstäben; visuelle Beurteilung zusätzlich zu Bildtests.
- Bedienung: vollständige native Abläufe mit tatsächlichen Eingaben, Werkzeugwechsel, verdeckter Auswahl und Rückkehr zur Draufsicht.
- Leistung: reales 16-GiB-Zielgerät, 1920 × 1080, mindestens 30 FPS bei gewöhnlicher Navigation; Pinselrückmeldung innerhalb 100 ms; begrenzter Speicherverbrauch in Großbestandsprobe. Ziele, keine vorhandenen Belege.
- Pro Etappe betroffene Tests/Builds, native Prüfung und erforderliche Candidate-CI. Quellprüfung, Paketprüfung, Integration und Nutzerabnahme getrennt.
- HEX-16 konkretisiert diese Etappen; HEX-06/08 tragen Maßstäbe/große Welten. Bergsymbole in HEX-18 durch native Geländeformen ergänzen/ersetzen; allgemeine Symbol-/Waldwerkzeuge erhalten. Ursprüngliche Quellenbindungen erhalten. Testdateien nach tatsächlichem Inhalt im Fähigkeitskatalog zuordnen.
- Verlinkung aus docs/INDEX.md und ROADMAP-HEX-ATLAS.md. Terminprognose erst nach R0-Messungen.
