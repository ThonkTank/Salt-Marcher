# Gemeinsame Raumgruppen

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: atlas
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Gebäude und Dungeons verwenden denselben `scope` und dieselben Room-, Geschoss-,
Zeichnungs- und Key-Records. **Einzelhaus** legt eine unabhängige Raumgruppe an
der angeklickten Weltposition an. Dafür wird keine Stadt benötigt; auch eine
ausgewählte historische Stadt wird nicht zum Besitzer des neuen Hauses.
Gemalte Gebiete bleiben unabhängig von dieser Geometrie. Die Kamera bleibt
beim Platzieren stehen, sodass mehrere Häuser nacheinander angelegt werden können.

Bestehende Stadteinträge behalten ihre Daten und dieselbe Kennung wie ihre
Raumgruppe. Ihre Kontur ist eine abgeleitete Darstellung der Räume,
kein zweiter frei bearbeitbarer Grundriss. Die bestehende Atlasbindung übernimmt
Position und Drehung des Stadteintrags; sie erzeugt keinen zweiten Innenraum.

## Anlegen und bearbeiten

**Einzelhaus** und **Raumgruppe anlegen** öffnen dieselbe Vorschau. Art, Breite,
Tiefe und Zufallsstartwert bestimmen den Entwurf. Geschosse und Keller werden
standardmäßig passend zur Art gewählt, können aber ausdrücklich überschrieben
werden. Vorschaugeschoss und Neu würfeln ändern noch keine Kampagnendaten.
Übernehmen speichert alle Räume, Türen, Treppen, Eingänge und Möbel gemeinsam.
Eine freie Gruppe kann auch leer beginnen und anschließend manuell gezeichnet
werden. Zoom erzeugt keine Daten.

Die Profile Wohnhaus, Werkstatt, Handel, Taverne, Tempel und Lager ergänzen die
Stadtbebauung. Gewölbe, Krypta und Höhle verwenden dieselben Objekte. Ausgestattete
Gästezimmer enthalten Betten, Küchen Herd und Arbeitsfläche, Grabkammern
Sarkophage. Einrichtung bleibt einzeln auswählbar und veränderbar. Der Generator
ist lokal und reproduzierbar; er erzeugt keine Encounter oder Bewohnergeschichten.

Freie Raumneuanlagen erhalten die gezeichneten Punkte und Löcher exakt.
Die Neuanlage erzeugt kein Volumenraster; dessen ausdrückliche Initialisierung
oder Bearbeitung bleibt eine eigene, rücknehmbare Aktion. [Prüfung](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/atlas-free-room-contours-20261021/README.md).

Räume bearbeiten, Türen und Gegenstände versetzen, Raumtexte schreiben und
Geschosse wechseln funktionieren für beide Arten gleich. Raumteilung erhält
Identität und Texte auf der größeren Seite; der neue Teil erhält einen leeren
Key. Die Teilungswand kann anschließend mit dem gemeinsamen Türwerkzeug geöffnet
werden. Die gemeinsame History umfasst auch abgeleitete Gebäudeformen.
Die proportionale Gruppenskalierung erhält Geschosshöhen, Kennungen und Texte.
Bereits in das feste 5-Fuß-Volumenraster überführte Räume werden weiterhin mit
dem Volumenwerkzeug bearbeitet; freie Gruppenskalierung und Raumteilung lehnen
solche Bestände atomar ab. Bespielte Gruppen und offene Raumentwürfe verhindern
das Löschen, solange deren Spielreferenzen noch bestehen.

## Besitzer und Schutz

`room-group-generator.ts` liefert den versionierten Entwurf für die Vorschau;
Main erzeugt ihn aus demselben bestätigten Rezept erneut. SQLite bleibt die
Schreibgrenze. `room_group` ergänzt Generatorherkunft und Schutzstatus, während
Room und DrawingElement die eigentlichen Inhalte besitzen. Das Feld `footprint`
des Stadteintrags ist ein neu berechenbarer Cache mit Polygonen und Innenlöchern.

Unveränderte generierte Gebäude samt Ausstattung dürfen durch die nächste
Bebauungsvorschau ersetzt werden. Manuelle Geometrie-/Key-/Einrichtungsänderungen
und Personenbindungen schützen die Gruppe. Eine neue Vorschau darf diesen Schutz
nicht umgehen. Abbruch schreibt keine Teilgruppe, Konflikte rollen den gesamten
Befehl zurück. Atlas-History und Kampagnenkopien umfassen die neuen Records.

## Nachweise

`tests/atlas/desktop-room-groups.test.mjs` prüft Generatorprofile, Einrichtung,
Verbindungen, gemeinsame Identität, abgeleitete Außenkontur, History,
Wiederöffnung, Skalierung und unabhängigen Kampagnentransfer.
`tools/test-desktop-room-groups.mjs` spielt Einzelhaus, Krypta, Raumtext und
Prozessneustart in Electron durch. [atlas-independent-building.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/atlas/atlas-independent-building.test.mjs)
prüft unabhängige Platzierung mit und ohne historischen Stadtkontext sowie
Abbruch und Kampagnenwechsel während der Vorschau.
`tools/test-desktop-world-authoring.mjs` beginnt mit einer leeren Kampagne und
zeichnet Kontinente, Relief, Wald, Königreich, Straße und Häuser bis zum
Raumtext mit anschließendem Prozessneustart. Dieser Funktionsablauf ersetzt
keine Lastmessung einer vollen Welt und keine ästhetische Abnahme.
Die bestehenden Atlasregressionen prüfen
zusätzlich metrische Transformationen, Raumkopien und begrenzte Ausschnittsleser.
`tools/measure-room-groups.mjs` erzeugt 5.000 eingerichtete Häuser über den
kanonischen Atlasbefehl und misst Wiederöffnung sowie begrenzte Ausschnittsleser.
Native Qualifikation, große eingerichtete Städte und Owner-Abnahme bleiben
getrennte Nachweise; ein grüner Unitlauf ersetzt sie nicht.


Die gemeinsame [Formatpolitik](../../project/contract/data-format.md) ersetzt frühere Schema- und Migrationsangaben.
