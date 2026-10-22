# Roadmap: gezeichnetes Geländerelief und kippbarer Atlas

Zieländerung vom 20.10.2026: Die [Roadmap für den gemeinsamen räumlichen Atlas](unified-spatial-atlas.md) ersetzt getrennte Drauf-/Kippdarstellung durch eine gemeinsame perspektivische Kamera. Die folgenden Implementierungs- und Prüfbefunde beschreiben den bisherigen Stand; sie belegen den neuen Atlas noch nicht.

Verbindlicher Arbeitsplan aus dem Nutzerentscheid vom 19.10.2026. Umsetzung phasenweise, eine Phase pro Durchlauf; nach jeder Phase Vollständigkeit und Zielabstimmung prüfen. R0 wurde visuell abgenommen. Seit der Nutzeranweisung „Warte bitte nicht auf abnahmen von mir. Arbeite einfach weiter.“ werden weitere Phasen ohne Abnahmepausen umgesetzt und selbst geprüft; eine Nutzerabnahme wird dadurch nicht behauptet. Der Status steht am Ende dieser Datei; ein Prototyp ist kein Produktnachweis.

## Ziel und festgelegter Umfang

Der Atlas erhält eine kontinuierliche Höhenlandschaft mit zusammenhängenden Gebirgen, Tälern, Pässen und Plateaus. Daraus entstehen eine gezeichnete Draufsicht und eine kippbare räumliche Ansicht. Gelände lässt sich in beiden Ansichten bearbeiten; Gebäude erscheinen als Baukörper mit Dächern. Grundrisse und Innenräume werden weiterhin in Draufsicht bearbeitet.

- Höhen bestimmen Land und Meer automatisch. Küsten entstehen am Schnitt mit dem Meeresspiegel.
- Höhen, Steigungen und Streckenprofile sind abfragbar. Bestehende Höhennutzer werden angeschlossen; neue Reise- und Sichtregeln gehören nicht zu dieser Roadmap.
- Bestehende Testdaten benötigen keine Migration. Entwicklung und Abnahme verwenden neue Testkampagnen; vorhandene Daten werden nicht automatisch gelöscht.
- Gezeichnetes Relief ist der Standardstil. Höhenlinien und Höhenfarben sind zuschaltbare Analyseansichten.
- Vollständige Dungeonvisualisierung in 3D, freie Begehung, Überhänge, Höhlenmodellierung, Erosionssimulation und automatische Flusssysteme bleiben spätere Erweiterungen.

## Technische Grundlage

**Ein gemeinsames Höhenmodell.** Gelände besitzt eine Höhe in Weltmetern unabhängig vom Hexraster. Hexes bleiben räumliche Spielstruktur und Abfrageebene. Die heutige Landmaske wird für neue Geländedaten durch eine aus Höhe und Meeresspiegel abgeleitete Maske ersetzt. Farbe, Geländeart und Klima bleiben eigene Eigenschaften.

**Lokale Verfeinerung statt weltweiter Vollauflösung.** Höhen werden räumlich gekachelt und in mehreren Auflösungen verarbeitet. Feine, ausdrücklich bearbeitete Bereiche bleiben bei groben Änderungen geschützt. Zoom lädt oder vereinfacht Darstellung; er erzeugt keine Landschaft. Höhenabfragen verwenden den maßgeblichen Datenstand und melden ihre tatsächliche Auflösung.

**Gemeinsame Daten, zwei Darstellungen.** Canvas2D trägt die bestehende Draufsicht. Die räumliche Ansicht erhält einen Three.js-Renderer mit orthografischer Kamera, Drehung und begrenzter Neigung. Mittelpunkt, Auswahl und Werkzeuge bleiben gemeinsam.

**Vorhandene Speichergrenze weiterverwenden.** Main/SQLite bleiben kanonisch; der Renderer bekommt begrenzte Bereichsdaten über Preload. Höhenänderungen nutzen bestehende Revisionen, Transaktionen, Undo/Redo und Archive. Geometrien, Schattierungen und Übersichtskacheln sind abgeleitete Daten.

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

### R3 — Entfallen nach Nutzerentscheidung vom 20.10.2026

Höhenkartenimport und spezielle Werkzeuge oder parametrisierte Objekte für Gebirgskämme, Täler, Pässe und Plateaus werden nicht umgesetzt. Berge, Täler und Hochflächen entstehen ausschließlich mit den drei Landwerkzeugen aus R2. Lokale Verfeinerung und geschützte feine Pinselkorrekturen bleiben Teil des Höhenkerns; dafür wird kein zusätzlicher Formeneditor eingeführt. R4 schließt unmittelbar an R2 an; der aktuelle Phasenstand steht unten.

### R4 — Den gezeichneten Kartenstil ausarbeiten

Weiche Schattierung, betonte Grate und hangorientierte Felsstriche kombinieren. Flache Bereiche bleiben ruhig; Steilheit steuert Felsdarstellung. Maßstabsgerechte Details ohne Flimmern oder Kachelnähte; große Formen bleiben in Übersicht erkennbar. Palette, Licht und Strichstärke bilden gemeinsames Stilprofil.

**Ergänzung vom 23.10.2026:** Gebirge modulieren Geländefarbe und Textur anhand tatsächlicher Höhe und Hangneigung. Steile Hänge wirken steiniger; Gipfel oberhalb einer einstellbaren Schneegrenze erhalten Schnee mit weichem Übergang. Dies ersetzt den früheren Ausschluss höhenabhängigen Schnees. Die Modulation wird aus dem Höhenmodell abgeleitet und überschreibt weder gemalte Grundfarben noch gespeicherte Geländearten. Sie gilt in der gemeinsamen Atlasansicht bei Draufsicht, Neigung und Drehung sowie in der Bildausgabe. Zoom verändert die Detaildichte, nicht die physische Schneegrenze. Höhenüberhöhung ist rein visuell; sie verschiebt weder Schneegrenze noch Materialzuordnung. Die festen physischen Höhenstufen der Höhenlinien bleiben davon unabhängig.

Abnahme: R0-Landschaft mit den drei Landpinseln nachbauen und in drei Maßstäben vergleichen; Beschriftung, Straßen, Küsten und PNG visuell prüfen. Für die Ergänzung vom 23.10.2026 zusätzlich flache Hochflächen, steile Hänge und Gipfel unterhalb, innerhalb und oberhalb des Schneeübergangs vergleichen. Anheben, Absenken, Glätten und Ändern der Schneegrenze aktualisieren die Darstellung nachvollziehbar; Undo/Redo und frisches Öffnen stellen denselben Zustand wieder her. Pan, Zoom und Kameraneigung erzeugen keine wandernden Texturen, Kachelnähte oder sprunghaften Materialwechsel. Große Pinsel und volle Weltkarten behalten die gemeinsamen Reaktionsziele. Frühere R4-Nachweise belegen diese Ergänzung noch nicht. Der [Materialschritt im gemeinsamen Rasterkern](../../reference/atlas-mountain-material-20261023/README.md) setzt Farbe, Textur und einstellbare Schneegrenze um; die unmittelbare Materialreaktion während großer Sculpt-Gesten und die vollständige Leistungs-/Gestaltungsabnahme bleiben offen.

### R5 — Kippbare Ansicht und direkte Geländebearbeitung integrieren

Prototyp-Renderer an produktive Terrainabfragen anschließen. Maßstabsabhängige Geometriedichte und kameranahe Koordinaten. Ansichten teilen Auswahl, Mittelpunkt, Werkzeuge und History; direkte Rückkehr zur Draufsicht. Höhenüberhöhung bleibt visuell. Alle drei R2-Landwerkzeuge funktionieren auf sichtbarer Oberfläche. Treffpunkt und Radius korrekt in Weltkoordinaten zurückführen, auch bei Überhöhung; verdeckte Teile nicht versehentlich mitbearbeiten.

Abnahme: Pass in gekippter Ansicht absenken, Draufsicht, Undo/Redo. Position, tatsächliche Höhe und Küste identisch.

### R6 — Straßen, Wasser, Gebäude und Höheninformationen verbinden

Der Straßen-/Flussteil ist nach dem [ergänzten Plan](terrain-routes.md) lokal implementiert; [Prüfungen und Bilder](../../reference/terrain-routes-20261020/README.md) dokumentieren den Stand. Die folgenden Gebäude-/Dungeoneingangsarbeiten bleiben offen.

Straßen/Flüsse auf Gelände darstellen. Die Nutzerentscheidung vom 20.10.2026 erweitert diesen Teil um [geländegebundene Trassenplanung](terrain-routes.md): Autoren setzen Pflichtpunkte und Eingriffsgrenzen; Trasse und Geländeform dürfen sich innerhalb dieser Grenzen gemeinsam anpassen. Ein Schutzschalter begrenzt andernfalls den Geländepinsel örtlich, ungeschützte Konflikte bleiben sichtbar. Einfache Baukörper/Dächer aus Grundrissen; vorhandene Geschosshöhen verwenden, fehlende Bauhöhen als editierbare Vorgaben. Gebäude waagerecht, bei Bedarf Fundamente. Geländegebundene Gebäude folgen Anker als Ganzes; Grundrisse/Geschossabstände/Innenräume nicht verformen. Dungeoneingänge mit Höhenanker. Auswahl öffnet dieselben Orte/Keys; Grundrissbearbeitung führt mit Fokus in Draufsicht.

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

## Phasenstatus

R0 technisch implementiert und lokal geprüft: [Vollständigkeitsprüfung und Zielabgleich](../../reference/terrain-relief-r0-20261019/README.md), [Bildvergleich](../../reference/terrain-relief-r0-20261019/comparison.html). Sechs Modelltests und der erweiterte native Bedienablauf bestanden; Intel UHD 620 über WebGL2 bestätigt, normaler Prozessabschluss. Eine Nachprüfung korrigierte Lücken in schnellen Pinselzügen und verglich wenige/viele Eingabeereignisse. Pinsel-Verarbeitungsmessungen von 189,5 ms im ursprünglichen Lauf und 34,8 ms im Nachlauf betreffen unterschiedliche Proben; die R7-Latenz-/FPS-/16-GiB-Ziele sind nicht qualifiziert.

**R0 visuell abgenommen:** Nutzerantwort „Passt“ am 19.10.2026. Die bisherige Blockade ist damit aufgehoben. **R1 und der ursprüngliche R2-Stand lokal implementiert und geprüft. Die anschließende R2-Bedienvereinheitlichung ist auf einem isolierten Quellstand lokal automatisiert und nativ qualifiziert (104 Fälle, zehn native Prüfschritte, unveränderte Quell-/Bundlehashes). R3 nach Nutzerentscheidung entfallen; R4 und R5 lokal implementiert und geprüft; R6–R7 noch offen.** Keine Produktintegration, Paketinstallation oder exact-SHA-CI-Abnahme dieser Roadmap behauptet.

R1: [Vollständigkeitsprüfung, Datenvertrag und Zielabgleich](../../reference/terrain-relief-r1-20261019/README.md). Gekachelte metrische Höhen mit lokaler Verfeinerung, Meeresspiegel, automatisch abgeleiteten Küsten, begrenztem Süßwasser und Format 49 umgesetzt. Breiter Regressionslauf 93/93, abschließende Höhen-/Farbprüfung 18/18; Typprüfungen, Repositoryprüfung und Desktop-Build bestanden. Native Insel-/Meerenge-/History-/Meeresspiegel-/Neustartprobe mit Fensterpixelprüfungen und regulärem Prozessabschluss bestanden. Keine R1-Nutzerabnahme, Paketinstallation oder Main-/Candidate-CI-Integration. R2 schließt im folgenden Phasenbefund an.

R2: [Vollständigkeitsprüfung und Zielabgleich](../../reference/terrain-relief-r2-20261019/README.md). Vier metrische Höhenwerkzeuge, einstellbare Stärke/weicher Rand, gemeinsame Küsten-/Reliefvorschau, Höhenwert am Cursor, Grundschattierung und optionale Höhenlinien umgesetzt. 77 unterschiedliche automatisierte Fälle und acht native Prüfschritte bestanden, einschließlich Schreibfehler/Entwurf/Wiederholung, Undo/Redo, PNG und Neustart. Quell-/Bundlebindung und regulärer Prozessabschluss belegt. Keine zusätzliche Nutzerabnahme erforderlich. Die anschließende [Vereinheitlichung der Landwerkzeuge](../../reference/terrain-land-tools-20261020/README.md) ersetzt die vier getrennten Höhenwerkzeuge durch die drei unten beschriebenen Landpinsel. R3 ist nach Nutzerentscheidung entfallen; R4 ist unten dokumentiert.


### R2 Bedienvereinheitlichung · 20.10.2026

Die Gruppe Land enthält genau **Land formen**, **Land bemalen** und **Glätten**. Geländedaten, Hexfüllung und Eigenschaftsrücksetzung liegen in der Gruppe Geländedaten. Die frühere Gruppe Höhen und die Landmal-/Radierwerkzeuge entfallen. Land formen verwendet einen Richtungsumschalter; die Zielhöhe ist optional und anfangs ausgeschaltet. Stärke bleibt Meter pro Sekunde. Roughness nutzt einen für die Geste festen Seed und verändert nur den räumlichen Auftrag. Glätten merkt Größe, Stärke und weichen Rand getrennt. Farbe bleibt unabhängig von der Höhe; Malen/Radieren sind Modi desselben Farbpinsels. Keine zusätzliche Schnellmaloperation oder Datenmigration. Prüfstand und Grenzen stehen im verlinkten Beleg.

### R4 Gezeichnetes Relief · 20.10.2026

[Vollständigkeitsprüfung und Zielabgleich](../../reference/terrain-relief-r4-20261020/README.md): gemeinsame Schattierung, zurückhaltende Gratbetonung, weltverankerte hanggerichtete Felsstriche, ruhige Flächen und ein gespeichertes Stilprofil für Palette/Licht/Stärke. Gezeichnet ist Standard; reine Schattierung und Höhenfarben sind optional. Drei Maßstäbe, Kachel-/Ausschnittgrenzen, Vorschau, Stil-Undo/Redo, Straßen/Ortsnamen, PNG und Neustart geprüft. 79 betroffene Fälle sowie vier native Ablaufprüfungen bestanden; nach Übernahme in die gemeinsame Arbeitskopie beide Typprüfungen und 23 überlappende Fälle bestanden. Keine Spezialwerkzeuge oder Höhenkartenimporte eingeführt. Keine Main-/Candidate-CI-, Paket- oder Installationsqualifikation. R5 folgt separat.

Kameraabfragen und lokale Lesewiederholungen erhalten offene Eingaben im Reliefstil. Erst ein geändertes bestätigtes Stilprofil oder eine andere Kampagne befüllt sämtliche Regler neu; das gilt auch bei Undo/Redo für das gerade fokussierte Feld. Der vorherige bestätigte Landschaftsframe genügt als Vergleich, ohne weiteren Entwurfsspeicher. Die native Quellbuild-Probe `tools/test-desktop-terrain-relief.mjs` verwendet den gemeinsamen Sitzungshelfer und prüft bei echtem Browserzoom 100/200 % Stilwahl vor dem Übernehmen, drei Maßstäbe, Geländekorrektur mit Undo/Redo, PNG und frische Neuöffnung. Paket- und R7-Leistungsqualifikation bleiben eigene Prüfungen.

### R5 Kippbare Ansicht · 20.10.2026

[Vollständigkeitsprüfung und Zielabgleich](../../reference/terrain-tilted-atlas-r5-20261020/README.md): integrierte orthografische Geländeansicht unter **Ansicht → Atlas kippen**, gemeinsame Kamerabox, Auswahl, Landpinsel und History. Neigung, Drehung und rein visuelle Überhöhung; echte Welttreffer und kanonisch rekonstruierter Sichtschutz. Farbe wird in Weltkoordinaten festgeschrieben. Bereichsabfragen und Vorschauen werden gebündelt, alte Antworten verworfen, GPU-Ressourcen beim Verlassen freigegeben. 51 betroffene automatisierte Fälle und acht native Ablaufprüfungen bestanden, einschließlich Pass/Küste, Undo/Redo, Glätten, Farbe/Radierung, Navigation, Auswahl, Wissensmasken-Rückkehr und Neustart. Quell-/Bundlebindung und regulärer Prozessabschluss belegt. Die erste vollständige Pinselvorschau benötigte im qualifizierenden Lauf unter Hostlast 1961 ms; die R7-Leistungsziele sind nicht erfüllt beziehungsweise noch nicht qualifiziert. Nach Übernahme in die gemeinsame Arbeitskopie bestanden 58 betroffene Fälle, beide abschließenden Typprüfungen, Desktop-Build und Repository-Prüfung. Die nativen Belege gelten für den isolierten R5-Stand; zusätzliche parallele Weg-/Bewuchsänderungen sind damit nicht nativ qualifiziert. Keine Main-/Candidate-CI-, Paket- oder Installationsqualifikation. R6 folgt separat.

### Gemeinsame Pinselbedienung und kompakter Atlas · 20.10.2026

Der anschließende Nutzerauftrag ersetzt die reine Weltmaßbedienung: Atlas-Pinsel starten mit 48 CSS-Pixeln Radius (einstellbar 4–200). „Feste Kartengröße“ hält alternativ das Weltmaß; der Wechsel rechnet ohne Größensprung um. Größen werden pro Werkzeug, der Modus gemeinsam lokal gespeichert. Landschaft, Regionen, Bewuchs, Höhlen-, Radier- und Streupinsel sowie räumliche Landschaft verwenden denselben Größenadapter. Vorschau, Abstände und Auftrag lesen dessen Weltradius. Begonnene Entwürfe sperren Größe und Kamera. Objektgrößen, Linienbreiten und Lichtreichweiten bleiben eigenständige Maße.

„Land formen“ zeigt Richtung als zwei Schaltflächen, logarithmische Stärke mit Zahleneingabe, Radius, festen Größenmodus, weichen Rand, Roughness, optionale Zielhöhe und fünf Vorlagen. Die Vorlagen ändern ausschließlich Pinselparameter und deaktivieren die Zielhöhenbegrenzung:

| Vorlage | Richtung | Stärke m/s | Radius px | Weicher Rand | Roughness |
| --- | --- | ---: | ---: | ---: | ---: |
| Hügel | Erhöhen | 100 | 40 | 85 % | 0,2 |
| Berg | Erhöhen | 350 | 65 | 60 % | 0,8 |
| Großer Berg | Erhöhen | 1000 | 100 | 50 % | 1,0 |
| Tal | Absenken | 200 | 70 | 85 % | 0,1 |
| Schlucht | Absenken | 700 | 20 | 15 % | 0,6 |

Meeresspiegel steht nur in der Wassergruppe. Das dauerhafte Kopfleistenmenü „Darstellung“ enthält den vorhandenen globalen Reliefstil und Höhenlinien. Das Stilprofil bleibt am bisherigen Kampagnendatensatz; vorhandene Höhen, räumliche Textur und Export verwenden es weiterhin. Die Symbolleiste links ist 48 Pixel breit, die Werkzeugoptionen standardmäßig 240 Pixel; beide zusammen geben gegenüber 424 Pixeln zuvor 136 Pixel Kartenbreite frei. Manuell gespeicherte Panelbreiten bleiben erhalten. Spieleranzeige und Größenvergleich liegen unter „Ansicht“.

Lokale Implementierung und Prüfgrenzen: [Pinselbedienung und kompakte Kartenfläche](../../reference/atlas-brush-ux-20261020/README.md). Keine zusätzliche Nutzerabnahme behauptet.

Shift + Mausrad beziehungsweise Touchpad-Zoomgeste ändert den aktiven Pinselradius statt des Kartenausschnitts. Das gilt auch in räumlichen Ansichten und im festen Größenmodus; laufende Entwürfe bleiben gesperrt. Der Tooltip am Radius nennt die Geste. [Prüfbeleg](../../reference/atlas-brush-wheel-20261020/README.md).
