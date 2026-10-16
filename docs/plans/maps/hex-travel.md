# Hexreise: Laufzustand, Kopien und verbleibende Nutzerfähigkeiten

Stand: 16.10.2026. Quellen: [Hex Travel](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/hex/requirements/requirements-hex-travel.md)
und [Hex Travel Console](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/hex/requirements/requirements-hex-travel-state.md).
[Produktziele](../../PRODUCT.md), [Kartenbearbeitung](hex-editing.md),
[Wetter](../runtime/weather.md), [Zeit und Restock](../runtime/shops-and-restock.md)
und [Dungeonreise](../dungeon/travel-state.md) behalten ihre eigenen Regeln.

## Vorhandener Ablauf und Datenregeln

`world-ui.ts` besitzt die bestehende Karten-/Reisekonsole. Geordnete Wegpunkte
führen über `world-model.findRoute` zu benachbarten Hexschritten; die Vorschau
zeigt Strecke, Dauer und Wetterabschnitte. Der GM nimmt sie ausdrücklich an.
`storage/world.ts` bindet Map-/Clock-/Position-/Membershiprevision, zugewiesene
Figuren, Wetter-/Kalenderstand und bei Gruppentempo die Bewegungswerte.
`travel-pace.ts` verwendet die langsamste aktive zugewiesene Figur; fehlende
Bewegung nimmt sichtbar 30 ft an. Bewegung0 verlangt Klärung oder ausdrückliches
manuelles Tempo. 3 Meilen auf Ebene bei30 ft und Wetter-/GMfaktor1 entsprechen einer Stunde;
eine bestätigte manuelle Enddauer verteilt sich exakt auf positive Abschnitte.

Ein Checkpoint schreibt Gruppenuhr, Position, Entdeckung, zeitabhängige Folgen,
History und Receipt in der bestehenden Transaktion. 1/12 Abschnitte sind
explizite Buchungsbefehle, keine Animationsgeschwindigkeiten. Pause/Fortsetzung,
Unterbrechung und Abbruch besitzen revisionierten Zustand. Die Karte projiziert
nur aktive/pausierte/unterbrochene Routen; Ankunft und Abbruch bleiben Historie.
Warten/Rast mit Zeitänderung erfordern danach eine ausdrückliche
Neubewertung des Restwegs. Der abgefahrene Weg wird nicht erneut gebucht.

## Routenauswertung: Dauer, Hexanzahl und Grundkosten

Die Konsole und die Reisevorschau projizieren dieselben drei Utilityfakten:
Dauer, expandierte Hexabschnitte und `terrainCost`. `previewTravel` summiert
`terrainFactor(cellAt(map, destinationHex))` für **jeden** tatsächlich betretenen
Routenabschnitt. Das anfängliche Hex kostet nichts; eine spätere Rückkehr dorthin
zählt als neuer Eintritt. Doppelte Wegpunkte am bereits erreichten Hex erzeugen
keinen zusätzlichen Abschnitt. Die vorhandene Wegregel setzt Grundkosten auf1,
sonst gilt der vorhandene Terrainfaktor. Diese gleiche Regel steuert Wegsuche und
Grunddauer; keine unabhängige Kostenformel im Renderer.

Die Summe berücksichtigt den vollständigen expandierten Weg, einschließlich
Abschnitten nach dem 40-Zeilen-Fenster des Briefings. Wetter, Reisetempo,
GM-Dauerfaktor, manuelle Enddauer und Wiedergabegeschwindigkeit verändern diese
Grundkostensumme nicht. Kilometer bleiben zusätzliche Entfernung. Die Anzeige
nennt Kosten und Regeln ausdrücklich, ohne sie als Geldbetrag auszugeben.
Restwegneubewertung zählt nur die noch offenen Eintritte ab dem bestätigten Hex.

Der bestehende Startguard vergleicht auch die dargestellte Kostensumme mit der
neu ermittelten vollständigen Vorschau. Manipulierte oder veraltete Fakten
starten keine Reise. Kein neues Journeyfeld, kein Schema und keine zweite
Position. Unangenommene Vorschauen einer älteren Appversion brauchen eine neue
Auswertung; bestehende Journeyfakten und Originalreceipts werden nicht verändert.
Für die späteren kanonischen Biome wird dieselbe Utilityregel auf stabile Biom-IDs
umgestellt, statt UI und Writer mit getrennten Kostentabellen zu erweitern.

`desktop-travel-cost.test.mjs` prüft echte Storevorschauen und die Konsole:
Start-/Zielzählung, Wege, mehrfaches Betreten, Wetter-/Tempo-/Enddauertrennung,
mehr als40Abschnitte, Checkpointfortsetzung, gefälschte Kosten ohne Schreibwirkung
und vollständiges Leeren des transienten Auswertungsstands. Das ersetzt keine
vollständige Scene-/Mapwechsel-, Latenz- oder native Reiseabnahme.

## Kartenwahl und fehlgeschlagene Speicherung

Die Kartenwahl übernimmt ihr Ziel erst nach erfolgreichem Speichern des bisher
geöffneten Kartenentwurfs. Währenddessen bleibt der Picker an die tatsächlich
geöffnete Karte gebunden (`aria-busy` am bestehenden Picker); eine neue Auswahl
ersetzt die frühere lokale Wechselabsicht. Ein Savefehler lässt Karte,
Hexeingaben und geordnete Routenstationen beim alten Owner. Nur dessen frühere
Startvorschau wird sofort ungültig, damit während des Wechsels keine alte
Auswertung angenommen werden kann. Es wird keine Ersatzkarte angelegt.

`world-ui.selectWorldMap` prüft Workspace-Token und lokale Auswahlgeneration
nach dem bestehenden `flushWorld`. Nur die aktuelle Absicht übernimmt die
bestätigte Zielkarte, setzt Auswahl/Cursor/Wegpunkte/Auswertung zurück und
aktualisiert Kartenfelder, Standort und Transportzustand gemeinsam. Eine späte
Saveantwort oder ein Kampagnenwechsel darf keine ältere Karte zurückholen.
Der bestehende Writer und seine Reconciliation behalten allein die
Speicherautorität; keine Schemaänderung und keine zweite Position.

Store-/DOM-Gegenfälle in `desktop-travel-target-dom.test.mjs` prüfen den
abgewiesenen Save ohne DBänderung, erhaltene Prosa/Route, erfolgreichen Retry
mit Speicherung allein auf der alten Karte sowie verzögerte neuere Auswahl und
Kampagnenwechsel. Für die noch offene vollständige Console-/Centerkomposition
müssen dieselben Regeln auch für „Karte öffnen“, Ortsmarker, Rücksprung zur
Gruppe und Providerwechsel gelten: vor Wechsel offenen Owner abschließen,
Intent nach jedem Await prüfen und transienten Stand erst bei bestätigter
Übernahme zurücksetzen. Eine spätere echte asynchrone Kartenquelle braucht
entsprechende Readabnahmen; lokale SQLite-Ergebnisse allein ersetzen sie nicht.

## Platzierung und spätere Routenabsichten

Administrative Platzierung bestätigt nur den angefragten Standort, ohne Zeit
zu buchen. `placePartyAt` hält zusätzlich die bestehende `travelRequest`-Version
fest. Bei unverändertem Entwurf setzt die bestätigte Platzierung ihn wie bisher
zurück. Wurden während einer langsamen Antwort neue Wegpunkte/Zielwerte eingegeben,
bleiben diese Rohfelder, Stationen und der neue Cursor erhalten. Nur die am alten
Standort ermittelte Auswertung verliert ihre Startautorität; eine neue ausdrückliche
Auswertung beginnt am tatsächlich bestätigten Hex. Kein automatischer Reisestart,
kein zweiter Entwurfsspeicher oder neuer Platzierungscommand.

Nach Platzierungsantwort, Scene-Nachread und anschließendem UIrefresh wird der
ursprüngliche Scene-/Map-/Campaignowner erneut geprüft. Ein alter Nachread darf
in einer inzwischen anderen Gruppe weder Erfolg melden noch deren Planung ändern.
Direkter Drag und Tastaturalternative verwenden denselben Platzierungsweg.
Store-/DOMgegenfälle prüfen gehaltene Antworten, erhaltene rohe Wegpunkte,
anschließende read-only Neuauswertung und einen Gruppenwechsel während Nachread;
kanonische Position und Uhr bleiben dabei von der Anzeige getrennte Nachweise.
Eine native IPCverzögerung prüft denselben Bedienpfad. Das ersetzt keine vollständige
Großrouten-, Drag-/Plattform- oder200%-Abnahme.

## Unabhängige Kampagnenkopie

`campaign-data.remapSnapshot` ändert lokale IDs. Die Reise-Umweltbasis enthält
bei Gruppentempo Figuren-IDs und bei Wetterfeldern deren IDs. Ein unverändert
kopierter Hash sperrte daher zuvor gültige Reisen. Vor dem Remap werden nur
aktuelle Umweltbasen offener Reisen erkannt; danach wird ausschließlich deren
Hash mit `world.travelEnvironmentBasis` neu berechnet. Worlddaten werden pro
Seite einmal gelesen. Dieselbe Funktion bleibt bei Vorschau/Fortsetzung der
Laufzeitowner; keine zweite Hashformel und kein neuer Reisewriter.

Tatsächlich geänderte Tempo-/Wetterbasen behalten ihre Sperre. Andere Guards
für Karte, Uhr, Position und Gruppe werden nicht angehoben. Route, Dauer,
Checkpoint, Mitgliedschaft und History bleiben erhalten. Keine Schemaänderung
oder Migration. Bereits früher fehlerhaft importierte Kopien brauchen weiterhin
eine ausdrücklich neu angenommene Restwegvorschau.

`desktop-travel.test.mjs` prüft eine Zweiergruppe, realen Abschnitt, Pause,
Snapshot, unabhängige IDkopie und Fresh. Gültige Gruppentempo-/Wetterreisen
setzen exakt am nächsten Checkpoint fort, buchen exakte Restzeit bis Ankunft
und verändern bei Receiptreplay nichts. Echte Tempo-, Wetter-, Karten- und
Uhränderungen bleiben auch nach Kopie gesperrt. Source-/Snapshotbytes und
Wetterprosa bleiben erhalten. Die angrenzenden Restock-/Dungeonkopieproben
prüfen weitere Ownerfolgen. Das belegt Store-/Transaktionspfade, keine native
Reisekonsole, Animationsgeschwindigkeit oder vollständige Produktabnahme.

## Interaktive Wiedergabe (0.128)

Die angenommene Reise startet jetzt eine lokale Präsentationsuhr. 1× entspricht
nominal einer Echtsekunde je gespeicherter Spielstunde; −/+ verwenden ausschließlich
1/2/5/10×. Die vor Start gewählte Geschwindigkeit wird optional am bestehenden
Journeycommand und Journeyrecord festgehalten. Ältere Records ohne dieses Feld
bleiben gültig. Geschwindigkeit multipliziert weder `segmentSeconds` noch Uhr,
Weg, Wetter oder Folgen. Keine Schemaänderung oder zweite Position.

`journey-playback.ts` liest den aktuellen Scene-/Map-/Journeycheckpoint und löst
höchstens einen bestehenden `journey-step(maxSteps:1)` aus. Erst nach bestätigter
Antwort und aktualisierter Projektion beginnt die Dauer des nächsten Hexes.
Geschwindigkeitswechsel bewahren den schon angezeigten Abschnittsanteil; ein
verzögerter Browser holt keine vergangenen Timer mit Stapelbuchungen nach.
Spielzeit wird vollständig am erreichten Hex gebucht, nie als zweite laufende Uhr.

Pause/Stopp löschen zuerst den Timer, warten einen bereits begonnenen Command ab
und verwenden dann dessen aktuellen Checkpoint für den bestehenden Statuscommand.
Unterbrechung/Ankunft beenden die Wiedergabe. Manuelle 1/12-Abschnittsbefehle bleiben
explizite sofortige Bestätigungen. Warten/Rast stoppen die Wiedergabe ebenfalls.
Unklare Antworten bleiben beim vorhandenen Worldcommand/Reconciliationweg; der
Timer erzeugt dafür keinen neuen Command und setzt nicht selbsttätig fort.

Warten und Rast behalten bereits beim Klick ihre Gruppe und Reise. Ein noch
offener Checkpoint darf abschließen; erst danach wird derselbe aktuelle
Checkpoint pausiert. Ein inzwischen gewechselter Fokus oder Reiseinhaber
verwirft die alte Bedienabsicht, statt die neue Gruppe zu pausieren oder deren
Zeitdialog zu öffnen. Die vorhandenen Owner- und Journey-IDs genügen dafür.

Kampagnen-, Gruppen-, Karten- und Bereichswechsel, verborgene Fenster sowie
Schließen stoppen die lokale Wiedergabe. Ein bereits begonnener Command darf
seinen einen atomaren Checkpoint abschließen. Nach Neustart wird keine verstrichene
Zeit nachgebucht; „Wiedergabe pausiert“ und ▶ setzen am letzten bestätigten Hex an.
Das gespeicherte fachliche Journey kann dabei weiterhin `active` sein; der Renderer
ändert es beim bloßen Lesen nicht heimlich auf `paused`. Die explizite Pause
bestätigt weiterhin den kanonischen Pausenstatus. Karten-/Uhr-/Positions-/
Mitgliedschaftsänderungen sperren die erkennbare veraltete Basis; die bestehenden
Ownerguards prüfen darüber hinaus Wetter, Bewegung und sonstige Reiseautorität.

Gezielt geprüft: Serialisierung, laufender Geschwindigkeitswechsel, Pause bei
offenem Command und keine Aufholbuchung; echter Store bestätigt 10× als Startwahl
bei unverändert exakt neun Spielsekunden. Vorhandene Reise-/DOMfälle bestanden.
Nativ: erster Stundencheckpoint bei 1×, Pause, alle Geschwindigkeiten, GM-Halt,
Fortsetzen bis Ankunft, Route ausblenden, Abbruch, Bereichswechsel und Neustart
am gespeicherten Hex. Zwei normale Exits, keine Rendererfehler. Keine umfassende
Host-/200%-/Großroutenabnahme und keine behauptete neue Kartengrenzregel.

## Scenegebundene Reisekonsole: fehlender Providerstand

Die [Reise-Szenario-Quelle](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/project/requirements/requirements-travel-state-tab.md)
verlangt genau eine Konsole für die fokussierte Scene. Ein Fokuswechsel entzieht
in `world-ui.renderLiveWorld` sofort der bisherigen Reiseprojektion ihre
Autorität: Timer aus, Frame/Route/Vorschau weg, Transport-/Platzierungsaktionen
inaktiv und ein lokaler Ladehinweis. Ein aktueller Readfehler zeigt die konkrete
Ursache in dieser Konsole sowie „Reisekontext erneut laden“. Retry liest nur den
bestehenden SceneWorld-Provider. Es bucht weder Position noch Zeit und baut
keinen Ersatzkontext aus der zuletzt sichtbaren Gruppe.

Auch ein fehlgeschlagener Refresh derselben Scene entzieht ihrer alten
Startvorschau und Wiedergabe die Autorität. Ein erfolgreicher Retry bindet die
bestätigte Projektion neu; eine ältere Fehlerantwort darf den neueren Erfolg
nicht löschen. Ein gewöhnlicher Same-Scene-Read wird vor seinem Ergebnis nicht
vorsorglich angehalten, damit erfolgreiche Checkpoint-/After-Refreshes keine
laufende Wiedergabe nach jedem Hex abbrechen. Der Fehler selbst stoppt sie.
Kanonische Journey, Uhr und Position bleiben bei allen diesen Reads erhalten;
Retry startet keine Wiedergabe und nimmt keinen alten Entwurf an.

Dieselbe Grenze gilt bei der Gruppenwahl im Atlas: Während des Wechsels und
nach einem aktuellen Ladefehler steht der vorherige Frame nicht für Reise- oder
Platzierungsbefehle bereit. Jede Antwort muss zur gewählten Gruppe gehören.
Ein wartender Befehl prüft diese Bindung erneut, bevor er schreibt. Die erneute
ausdrückliche Gruppenwahl liest den Provider erneut; alte Fehler dürfen einen
inzwischen erfolgreich geladenen Kontext nicht verändern.

Die Store-/DOMfälle in `desktop-travel-target-dom.test.mjs` verzögern Fokusreads,
prüfen Fehler/Retry, unveränderte SQLitefakten und alte Fehler nach neuerem
Erfolg. Bestehende Wiedergabe-, Camp- und Wetterprüfungen bleiben angrenzende
Teilbelege; daraus folgt keine vollständige Session-Shell-Abnahme.

## Auswertung bleibt bei der Anfrage

Gruppe, Karte, Ziel/Ortsbindung, geordnete Wegpunkte, GM-Faktor, manuelles Tempo,
Enddauer und Restreisebasis der Antwort müssen zur ausdrücklichen Anfrage passen.
Nur beim gewählten Partytempo darf der Provider das effektive Tempo einsetzen.
Die Konsole berechnet keine Bewegungsregeln nach. Fremde Antworten zeigen einen
lokalen Fehler, keine Auswertung und keine Startautorität; erneutes Auswerten
bleibt möglich. Die Storeprüfung der Auswertung ersetzt diese Anfragebindung nicht.

`desktop-travel-target-dom.test.mjs` prüft echte abweichende Auswertungen ohne
Journeycommand sowie gültiges automatisches Tempo und anders geordnete
Antwortschlüssel. Bestehende Request-/Ownergrenzen bleiben erhalten.

## Getrennte Live-Mitte und Reisekonsole (0.141)

Die Live-Mitte besitzt jetzt eine ausdrückliche Auswahl Szene/Karte. Reise öffnet
die Hexkonsole im Referenzbereich neben der bestehenden Mitte und erhält deren
Inhalt. Nur Karte öffnen, Ziel-/Wegpunktwahl, Platzierung oder der Kartentab
wählen die Karte ausdrücklich. Bei schmalem Viewport bleiben beide Bereiche
in der bestehenden einspaltigen Anordnung erreichbar. Die rechte Konsole kann
unabhängig scrollen. Die Kartenfläche selbst enthält dort keine Werkzeugleiste
oder Statuszeile und füllt ihre Zeile; Kameraaktionen bleiben in der Konsole.

`live-hex-surface.ts` verschiebt ausschließlich vorhandene DOM-Knoten zwischen
Atlas und Live. Karte, Kartenwahl, Ziel-/Routenbedienung und Transport existieren
jeweils einmal. `world-ui.ts` bleibt Besitzer von SceneWorld-Frame, Mapentwurf,
Cursor/Wegpunkten, Utilityauswertung und Journeyplayback. Beim Rückwechsel
werden dieselben Knoten an ihre vorhandenen Plätze zurückgegeben. Die
Szenen-/Kartentabs haben keine Worldcommands und erzeugen keine zweite Position.

Die Konsole zeigt Standort, gewählte Hexkoordinate, Terrain und Utilitykosten.
Jede Aktivierung im Wegpunktmodus fügt einen geordneten Eintrag hinzu; gleiche
aufeinanderfolgende Ziele bleiben im Entwurf sichtbar, ohne zusätzliche
Bewegungskosten zu erfinden. Löschen entfernt Entwurf und Auswertung.
Die gemeinsame dreiteilige Auswertung erscheint in Live inline. Erst deren
angenommener startbarer Stand aktiviert Reise starten; im Atlas bleibt die
vorhandene Vorschau mit ausdrücklicher Bestätigung erhalten. Vor Start gewählte
1/2/5/10× fließen unverändert in den vorhandenen Journeycommand. Der Hauptknopf
startet oder setzt fort; Pause und Stoppen verwenden weiterhin die kanonischen
Zustandsbefehle. Timer, Fortsetzen-Knopf und dessen Auftrag verlangen dieselbe
ausgewählte Reisekarte. Eine andere Ansicht aktiviert keine pausierte Reise.
Angekommene und abgebrochene Reisen zeigen finalen Status/Position ohne
Routengeometrie.

Ladeabsichten binden sich an Workspace, Fokus und aktuelle Readgeneration.
Eine verspätete Weltantwort übernimmt keine alte Fokusgruppe. Eine nicht im
aktuellen Providerstand enthaltene Gruppenkarte bleibt ausdrücklich fehlend;
Retry liest den echten Welt- und Sceneprovider neu, statt die alte Karte oder
einen Ersatz für gültig auszugeben. Bestehende Guards verhindern die Annahme
alter Routenauswertungen nach Fokus-, Karten-, Membership- oder Zeitänderung.

Gezielte Store-/DOMfälle prüfen die geteilte Oberfläche, unabhängige Mitte,
Tastaturwegpunkte, inline Start und Geschwindigkeitsübergabe, fehlende Karte und
mutationsfreien Providerretry. Native Belege umfassen zwei Gruppen auf zwei
Karten, Fokuswechsel mit offener Auswertung, Löschen, Start/Pause/Fortsetzen/
Abbruch/Ankunft und Neustart. Kein Ersatz für vollständige200%-/Latenz-/
Großroutenqualifikation. Direktes Party-Tokenziehen folgt in 0.143 (unten). Weitere Session-Center-
Anbieter und die genannten weitergehenden Abnahmen bleiben offen.

## Direktes Party-Tokenziehen (0.143)

Der eine vorhandene Party-Token ist direkt greifbar, sowohl im Atlas als auch
auf der gemeinsamen Livekarte. Die Geste gewinnt am Token vor Kartenpan und
Geländepinsel. Hintergrundgesten bleiben beim bestehenden passiven Canvas.
Der Token rastet visuell auf das Zielhex ein und wird bis zur Bestätigung
transparent und gestrichelt dargestellt; Position und Karte werden während der
Bewegung nicht geschrieben. Loslassen auf einem beschriebenen Hex bestätigt
administrative Platzierung ohne Reisezeit. Auch geerbte Beschreibung aus einer
gröberen Ebene zählt als beschrieben. Die Tastaturalternative benutzt denselben
Platzierungsweg und behält die bestehende freie Platzierung auf kontinuierlicher,
ungezeichneter Landschaft.

`hex-party-drag.ts` besitzt ausschließlich die vorläufige Zeigergeste. Der
bestehende Hexadopter interpretiert native Canvas-Hits und CTM, Terrainbeschreibung
und lokale Koordinaten. Scene, Mitglieder, Position, Karte, Ebene und Livefokus
binden die Geste. Escape, Pointerabbruch, Fensterfokusverlust, Kameraaktionen oder
ein neu gezeichneter Kartenstand entfernen die Vorschau. Außerhalb der Karte
oder auf einem unbeschriebenen Ziel wird nichts gebucht. Ein Klick ohne Ziehen
und eine Rückkehr zum bisherigen Standort erzeugen keine neue Platzierung.

`placePartyAt` führt Drag und Tastatur zum bestehenden `place-scene`-Writer.
Der Auftrag bindet zusätzlich die aktuelle Karten- und Membershiprevision und
bei Drag die beschriebene Zielzelle. Der Writer prüft diese Fakten innerhalb
seiner bisherigen Transaktion. Bestehende Ortsmarker werden über dieselbe
Ortsbindung übernommen. Laufende Präsentation stoppt vor der Geste; ein bereits
buchender Reiseabschnitt muss zunächst abschließen. Die administrative Position
kann eine vorhandene Reisebasis veralten lassen; die vorhandene ausdrückliche
Restwegbewertung bleibt dafür zuständig. Kein zweiter Token, keine zweite
Position, keine neue Uhr und kein Schema.

Gezielte Fälle prüfen vorläufiges Ziehen, genau einen Releaseauftrag, Abbruch,
Ownerwechsel und atomare Ablehnung veralteter Karten-/Gruppenbasis. Ein bestehender
Provider-Ausfallfall wählt jetzt ein tatsächlich anderes Cursorhex, damit er
weiterhin einen wartenden Platzierungsauftrag statt eines wirkungslosen Klicks
prüft. Native Prüfung umfasst Atlas mit und ohne aktiven Pinsel, Livekarte,
Tastaturalternative, ungültiges Ziel, Escape, Gruppenwechsel und Neustart.
Vollständige Plattform-, 200%- und Langroutenqualifikation bleiben offen.

## Ausdrückliche Passierbarkeit und Reisevoraussetzungen (0.147)

Hexe besitzen optional `access`: eine ausdrückliche Sperre mit Begründung oder
benannte Voraussetzung wie „Boot“. Fehlende Vorgabe bedeutet passierbar; auch
ungezeichnetes Gelände bleibt Ebene. Der bestehende Hexeditor schreibt dieselbe
Karte. Terrainmalen erhält die Vorgabe, gröbere authored Vorgaben werden wie
andere Hexfakten geerbt. Frei passierbar entfernt die lokale Vorgabe.

Der GM markiert für eine konkrete Reise vorhandene Voraussetzungen. Diese
Angabe ist keine Inventarprüfung und verändert kein Ledger. Die Auswahl gehört
zur angezeigten Campaign/Scene/Karte/Reise. Akzeptierte Angaben werden in
`Journey.supplies` und dem bestehenden Verlaufsbeleg gespeichert. Leere Auswahl
benötigt kein neues Feld; es gibt keine neue Tabelle oder Schemafassung.

`findRoute` umgeht gesperrte und ohne Voraussetzung nicht betretbare Hexe;
ein solches Ziel beziehungsweise ein solcher ausdrücklicher Wegpunkt wird
verständlich abgewiesen. Restwegprüfung prüft jeden verbliebenen Abschnitt.
Straßen und feste Enddauer heben keine Sperre auf. Start vergleicht weiterhin
die vollständige aktuelle Vorschau; Schritte prüfen die bestätigte Kartenbasis
und den Zugang vor Position/Zeit/Weltfolgen. Eine geänderte Karte verlangt
Neubewertung und kann keinen alten Reiseauftrag nachträglich autorisieren.
Administrative Platzierung bleibt eine ausdrücklich andere, zeitlose GM-Aktion.

Die GM-Karte markiert Sperren mit × und Voraussetzungen mit !, ergänzt Titel
und Inspektor. In der passiven Wissensansicht werden diese GM-Marker unterdrückt.
Die angenommene Reise zeigt ihre Angaben auch nach Neustart; die bestehende
Wiedergabe startet weiterhin nur ausdrücklich.

Gezielt geprüft: sparse Umwege, Straße versus Sperre, fehlender Transport trotz
Enddauer, Start-/Step-/Restweg-Ablehnung bei Kartenänderung, unveränderte Bytes
bei Ablehnung, Fresh und unabhängiger Campaigntransfer. Vollständige Transport-,
Inventar-, Fraktions- oder biologische Bewegungsregeln entstehen dadurch nicht.

## Feldbeschriftungen in dichten Ausschnitten

`world-ui.renderMapScene` misst die dargestellten Feldnamen mit der aktuellen
Schrift und prüft ihre Rechtecke vor dem Veröffentlichen des gemeinsamen
Scene-Roots. Bei Kollision bleibt das ausgewählte Hex beziehungsweise der
Reisecursor bevorzugt sichtbar; weitere Texte folgen stabil der Hexreihenfolge.
Der Abstand unter dem Hexzentrum folgt der Textgröße, damit ein lesbarer Name
bei kleiner Darstellung nicht die benachbarte Hexmitte überdeckt. Mehr Platz
durch Zoom oder geänderte Auswahl berechnet dieselbe Projektion neu.

Ausgeblendete Feldnamen bleiben vollständig im Hex-Tooltip und Inspektor.
Karte, Auswahlbefehle und Reiseautorität bleiben beim bisherigen Owner; keine
Migration, Schreiboperation oder gespeicherte Labelposition. Die ausdrücklich
bearbeitbare Ortsmarkerpräsentation bleibt eigenständig. Die DOM-Probe prüft
Auswahlpriorität, Rückkehr nach Zoom/Reset und unveränderte gespeicherte Werte;
`test-desktop-travel-target.mjs` prüft echte native Textrechtecke, Label- und
Nachbarhexklicks neben dem bestehenden Reise-/Neustartpfad. Das ist keine
Abnahme beliebiger Markerkrümmungen, aller Schriften, großer Karten oder200%.

## Nächste ausführbare Lieferungen

1. **Gemeinsamer Biomkatalog und größere Routen.** Die ursprüngliche Hexquelle
   verlangt installationseigene, im Editor verwaltete Biome und denselben
   Definitionsbestand für Kreaturfilterung. Die aktuelle Terrainmenge ist weiter
   fest; Custom-Biome, definierte Zuordnung der bisherigen Habitatstrings,
   geschützte Built-ins und Transferkonflikte fehlen. Die neue Passierbarkeit
   ist unabhängig davon und ersetzt diesen Umfang nicht. Die aktuelle
   Routensuche bleibt ein Rechenbudget mit erklärter Abschnittsteilung, keine
   Begrenzung der kontinuierlichen Kartenfläche.
2. **Präsentation weiter qualifizieren.** Die vorhandene Wiedergabe auf großen
   Routen und bei 200% prüfen. Pointerinterpolation ist nicht Bestandteil der
   autoritativen Checkpoints; jede zusätzliche Animation bleibt reine Darstellung.
3. **Gemeinsame Bedienung weiter qualifizieren.** Vorhandene Drag-Platzierung,
   Tastaturalternative, Wegpunkte und Auswahl im selben Scene-/Mapkontext mit
   laufender Reise und verschachtelten Ortsmarkern bedienen.
   Die vorhandene dreiteilige Utilityauswertung mit kanonischen Biomen und
   vorhandener ausdrücklicher Transport-/Passierbarkeitsregel konsistent weiterführen. Mapwechsel
   leert nur transienten Entwurf/Auswertung; Scenewechsel übernimmt keine alte
   Antwort. Reiseansicht allein erzwingt keinen anderen Arbeitskontext.
   Native Abnahme mit Kartenwechsel, langen Routen,200%, Fehlerantwort,
   Prozessunterbrechung, Fokuswechsel und finalem Interrupt ohne Doppelbuchung.
