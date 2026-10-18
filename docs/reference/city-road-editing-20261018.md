# Bestehende Gassen verbreitern und korrigieren · 18.10.2026

## GM-Aufgabe und beobachteter Ausgang

Eine vorhandene Zugangsgasse neben bestehenden Häusern verbreitern, ihren Verlauf korrigieren, die Änderung wieder aufnehmen und die Karte am Spieltisch verwenden. Häuser, Innenräume, Gruppenstand und Autoreninhalte bleiben erhalten.

Die tatsächliche Vorher-Probe benutzte die Stadtmodule von `e0e6b4e36` (unveränderte bisherige Stadtbearbeitung, Main bereits integriert) über den vorhandenen isolierten Browser-QA-Host. Die benannte Lagerhausgasse ließ sich von acht auf 24 Meter verbreitern und über Häuser speichern, ohne Abstandsfeedback. Die Probe wurde über die Atlas-History zurückgenommen. Ein getrennt erzeugtes Vorher-Bundle erhielt die neuen Produktdateien; es ersetzte nur vorübergehend die kompilierten QA-Ansichtsdateien.

## Änderung

Dieselbe Prüfung des tatsächlichen Straßenquerschnitts gegen gedrehte Hauskonturen gilt jetzt auch für bestehende Breiten und Formgriffe. Eine bewegte gemeinsame Endnode prüft alle dadurch veränderten Straßen, nicht nur die gewählte. Betroffene Häuser sind rot markiert und im Hinweis genannt. Konflikte bleiben Entwürfe; Autosave und Übernahme warten auf eine freie Form oder die ausdrückliche Durchquerungsentscheidung. Geometrie- oder Revisionsänderungen entziehen diese Entscheidung. Hausdatensätze werden nicht geändert.

Formannahmen verwenden weiterhin den bestehenden atomaren Writer und ihre gebundene Revision. Ein unbestätigtes Ergebnis bleibt eingefroren und wird mit derselben Command-ID aufgeklärt. Fehlerhafte oder verspätete Abstandsreads dürfen keine Speicherung oder einen Kampagnenwechsel autorisieren. Eine bestätigte Breitenänderung räumt den vorübergehenden Prüfhinweis wieder auf und erzeugt genau einen Historyschritt.

Normale Auswahl und reine Namensänderungen behalten den begrenzten Reader. Die ausdrückliche Straßen-Geometriebearbeitung liest für ihre Abstandsprüfung einmal je Stadtrevision den vorhandenen vollständigen Stadtbestand. Das ist keine neue skalierungsqualifizierte Abfrage; ein enger Geometriereader bleibt bei belegter Last eine offene Verbesserung. Insbesondere wird damit keine große-Stadt- oder 16-GiB-Qualifikation behauptet.

## Tatsächliche Nachprüfung

Auf dem abschließenden Produktbuild: globale Straßensuche → dieselben 24 Meter markieren vier Häuser und sperren Abschluss → zwölf Meter markieren noch ein Haus → zehn Meter bleiben frei und werden gespeichert. Der gespeicherte Zustand hat keinen hängenbleibenden Prüfhinweis. Danach vorhandenen mittleren Griff ins Haus ziehen → Warnung und gesperrte Übernahme → Griff auf freien Verlauf zurückziehen → übernehmen → Undo zeigt den ursprünglichen Zwischenpunkt, Redo die Korrektur.

Ein vollständiger Neustart des eigenen QA-Hostprozesses erhält zehn Meter und die korrigierte Punktfolge `273.3,335 → 287.1,354.2 → 288.1364782600718,390.8469352922217`. Die erneute Straßensuche öffnet diese Form. Atlas leiten öffnet die Live-Karte; Gruppenfokus und zweimal Vergrößern zeigen Mira im Lagerraum und die bestehende Zweiraumgeometrie. Die Uhr bleibt `00:00:21`. Rückkehr erhält Straßenidentität, Breite, Punkte und exakt dieselbe Bearbeitungskamera. Die GM-PNG-Ausgabe wird separat angesehen.

## Vergleich mit Dungeon Scrawl

Tatsächlich in der offiziellen Oberfläche neu gezeichnet: benanntes Lagerhaus auf eigener Ebene, benannte Zugangsgasse auf anderer Ebene; Verbreiterung zum Haus überlappt dessen Geometrie ohne Hauswarnung. Undo und Verbreiterung zur freien Seite korrigieren den Zugang. Nur aneinanderstoßende Rechtecke hinterließen zunächst eine Innenwand; überlappende Rechtecke ergeben den durchgängigen verbreiterten Zugang. Undo/Redo und PNG-Ausgabe wurden bedient und das Bild geprüft. Die Schutzwirkung der Ebenentrennung und die sichtbare geometrische Korrektur wurden übernommen, ohne daraus semantische Straßen-/Hausregeln in Scrawl abzuleiten.

Die aktuelle Scrawl-Speicherdatei konnte über den dokumentierten Dateidialog-/Downloadpfad nicht erneut gespeichert oder frisch importiert werden. Die bearbeitete Sitzung bleibt erhalten. Diese Prüfung belegt daher die geometrische Korrektur und PNG-Ausgabe; sie ist kein neuer vollständiger Persistenz-, Straßennetz-, Reise- oder Spieleranzeigevergleich. Die frühere gespeicherte Vergleichsdatei und ihre früheren Belege bleiben davon getrennt.

Nach Integration von Main `e67fe1b72` wurden Breitenkonflikt und Formkorrektur erneut tatsächlich bedient. Ein gemeinsames Endstück wurde im Entwurf ins Haus gezogen: vier Konflikte, gesperrte Übernahme; Verwerfen erhielt seine genaue ursprüngliche Nodekoordinate. Die Konfliktlösung übernimmt Mains gemeinsamen Bereichs-/Bildvorschaupfad, erhält den eigenen Auswahl-Worker und die getrennte öffentliche Gruppensicht. Zusätzliche Integrationsläufe: 59/59 sowie 7/7 betroffene Stadt-/Export-/Recovery-Fälle normal beendet.

## Technische Belege und Grenzen

- Vollständiger betroffener Stadt-/Shape-/Junction-Lauf: 108/108, normal beendet.
- Main-/Auswahl-/Draft-/Party-/Session-Integration: 49/49, normal beendet.
- Zeichnungs-/Türintegration: 26/26, normal beendet.
- Abschließende Edit-/Late-/Fehlerread-Fälle: 5/5, normal beendet; enthalten den nach der tatsächlichen Bedienung ergänzten Prüfhinweis-Fall.
- Der einzelne frühere CI-Fehler erwartete einen alten String statt des aktuellen typisierten bevorzugten Auswahlziels. Die Fixture prüft nun beide Parameter getrennt; keine Produkt-/Überlappungsassertion entfällt.

Die UI nutzt kanonischen Electron-/SQLite-Code mit isolierter Loopback-Brücke. Sie ist keine Qualifikation eines installierten nativen Pakets. Exact-SHA-CI, native Paketprüfung, ganzer regionaler Reise-/Spielerablauf und ausdrückliche Nutzerabnahme bleiben getrennte Aussagen. Keine Main-Promotion aus diesem Bericht.

Screenshots, PNGs, Vorher-Bundle, vollständige Logs, Datenbanksicherung und Inhaltsvergleich liegen im übernommenen Chat-Arbeitsbereich unter `evidence/saltmarcher-existing-roads-20261018/`. Verwandte Abläufe: [neue Gassen](city-road-clearance-20261018.md), [Straßensuche](city-street-search-20261018.md) und [Straßenanschlüsse](city-street-junction-20261017.md).


## Nachprüfung am einfachsten brauchbaren Ablauf

Die Aufgabe bleibt: eine benannte Lagerhausgasse wiederfinden, ihre Breite und
bei Bedarf ihren Verlauf zwischen vorhandenen Häusern korrigieren und ein
benutzbares Kartenbild ausgeben. Der Idealpfad besteht aus Suche, Breite oder
Kartengriffen und Ausgabe. Eine unzulässige Überschneidung muss vor dem
Speichern erkennbar sein; eine bewusst gewünschte Querung braucht eine
ausdrückliche Entscheidung.

Die tatsächliche Ausgangsansicht zeigte zusätzlich das allgemeine Feld
„Name – Neue Stadt“ beim Bearbeiten einer vorhandenen Straße und sieben
Zeilen numerische Eckpunkte. Das zweite Namensfeld gehörte zu keiner Handlung
dieser Aufgabe. Die inaktive Landschaftsleiste hatte die zuvor korrekt
ausgeblendete gemeinsame Namenseingabe erneut eingeblendet. Die
Sichtbarkeitssteuerung bleibt jetzt bei der aktiven Werkzeugfamilie. Exakte
Koordinaten bleiben unter „Eckpunkte genau eingeben“ erreichbar; für sichtbare
Verlaufskorrekturen sind die Kartengriffe die unmittelbare Handlung.
Beim Öffnen eines Suchtreffers wird zuerst der Auswahlbereich sichtbar gemacht,
dann der Inspektor in den sichtbaren Ausschnitt gerückt. Zuvor wurde die
Scrollposition noch am ausgeblendeten Bereich berechnet; der gesuchte
Bearbeitungsschritt lag deshalb weiter unten als die sachfremden Optionen.

Dungeon Scrawl wurde mit derselben Haus-/Zugangskarte erneut tatsächlich
bedient: freie Seite verbreitert, rückgängig gemacht und PNG ausgegeben. Dort
bleiben bei der geometrischen Korrektur zusätzlich Voreinstellungen links,
Ebenen und Stilparameter rechts sichtbar. Diese größere Auswahl begründet
keine entsprechende Belastung in SaltMarcher. Scrawl besitzt in dieser Probe
keine semantische Straßenbreite oder Hausabstandsprüfung; der Vergleich
bezieht sich auf Geometriekorrektur und ein verwendbares Kartenbild.

Verbleibende Abweichungen vom Idealpfad sind unterschiedlich begründet:
Suche identifiziert eine Straße unter vielen; der Wechsel zur Formbearbeitung
verhindert versehentliches Verziehen bei gewöhnlicher Auswahl; Undo schützt
bestehende Arbeit; Ausgabeparameter sind erst bei der Ausgabe nötig.
Werkzeugfamilien, Stadtaufgaben und der gesonderte Formabschluss bleiben
zusätzliche Bedienarbeit. Diese Probe begründet keine allgemeine optimale
Navigation und keine menschliche Nutzerakzeptanz. Bearbeitbares Scrawl-Speichern
und frisches Wiederöffnen bleiben für die aktuelle Vergleichskarte ungeprüft:
„Speichern unter“ führte in einen durch die verfügbare Browsersteuerung nicht
bedienbaren nativen Dateidialog. Der PNG-Export funktioniert.
