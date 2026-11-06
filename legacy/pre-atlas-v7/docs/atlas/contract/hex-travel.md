# Hexreise: Laufzustand, Kopien und verbleibende Nutzerfähigkeiten

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: atlas
Last Reviewed: 2026-10-28 (aktuelle Einstiege und historische Adapterstände; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 17.10.2026. Quellen: [Hex Travel](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/hex/requirements/requirements-hex-travel.md)
und [Hex Travel Console](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/hex/requirements/requirements-hex-travel-state.md).
[Produktziele](../../project/requirements/product.md), [Kartenbearbeitung](hex-editing.md),
[Wetter](../../runtime/contract/weather.md), [Zeit und Restock](../../runtime/contract/shops-and-restock.md)
und [Dungeonreise](../../dungeon/contract/travel-state.md) behalten ihre eigenen Regeln.

Maßgeblich ist jetzt die [gemeinsame Atlasfläche](../guide.md) mit genau einer
Karte pro Kampagne. Die unten genannten versionierten Hex-/Live-Belege stammen
teilweise aus dem früheren Mehrkartenaufbau. Sie beschreiben lokale Teilbelege,
keine erneute Abnahme der aktuellen Workbench; die aktuellen Integrationsgrenzen
und nächsten Schritte stehen unter „Reisekontext im gemeinsamen Atlas“.

Das axiale Raster ist weiterhin Reise- und Referenzmodell. Terrainkosten,
Passierbarkeit und gespeicherte Journeygrundlagen bleiben gültig; Landschafts-
bearbeitung erfolgt unabhängig davon kontinuierlich in Metern. Hexschritte,
Reisecheckpoints und kausale Rücknahme fordern keinen Gelände-Zellwriter.
Aktuelle Codebesitzer und Prüfwege: [Reise ändern](../architecture/rendering.md#reise-ändern).
Die [Speicherbesitzer](../../project/architecture/storage-ownership.md#fachübergreifende-abläufe)
konkretisieren `storage/world.ts`: `world-commands.ts` besitzt lokale Commands,
`world-command-flow.ts` verbindet Zeitfolgen unter derselben äußeren Transaktion.

## Standardpfad vom Reisestand zur sichtbaren Konsole

**Wie entsteht das Ergebnis?** Die Spielleitung wählt „Reise“ für die bereits
fokussierte Scene. `world-ui.openWorld` lädt Karten-/Orts-/Gruppenprojektionen;
`reloadScene` liest den geprüften `SceneWorld` mit Position, Uhr, Journey,
Wetter und Hinweisen. Konsole und gemeinsame Karte projizieren diesen Stand.
`renderLiveWorld` bedient daneben die Live-Wetteranzeige; die Agenda ist eine
separate, auf einen Tag begrenzte Kalenderprojektion. Bewegung, Zeit und
Persistenz bleiben ausschließlich bei den revisionierten Providercommands und
Receipts. Das bloße Öffnen schreibt nichts und wechselt die Szenenmitte nicht.

**Welcher Weg ist dafür angemessen?** Ein bestätigter Providerread wird an alle
betroffenen Anzeigen weitergereicht. Zeichenfunktionen erzeugen keine Reads.
Die begrenzte Agenda wird ausdrücklich einmal geladen und als ganzes Ergebnis
ersetzt. Owner, Fokus, Revisionen und Antwortgeneration entziehen alten Antworten
die Wirkung; fehlende oder verschieden datierte Daten bleiben sichtbar offen.
Kein zusätzlicher Store, Cache, Providerregistry oder persistenter UI-Laufstand.

**Nutzen wir ihn?** Beim Öffnen und Retry las `openWorld` bereits den SceneWorld;
der nachfolgende Live-Aufbau las denselben Provider erneut. Außerdem starteten
sowohl Wetterzeichnung als auch deren Aufrufer eine Agendaabfrage. Die Antworten
konnten anschließend dieselben Termine zweimal an dieselbe Liste anhängen.
Diese Umwege sind entfernt: `openWorld` reicht seine bestätigte Antwort weiter,
und der Live-Controller kann sie ohne zweiten Read übernehmen. Der zu Beginn
gebundene Fokus wird nicht aus einem weiteren Live-Read neu ausgewählt.
`paintLiveWeather` zeichnet ausschließlich; bestätigte Datenübergänge lösen die
Agenda ausdrücklich aus. Die Agenda ersetzt ihren Inhalt nach der aktuellen
Antwort und besitzt eine eigene Antwortgeneration, auch für konkurrierende
Aktualisierungen derselben Scene. Scene-ID, Uhrrevision/-instant und Ortsbindung
müssen zur dargestellten Livebasis passen. Ältere Membershipstände dürfen einen
neueren Gruppenstand nicht zurücksetzen.
Wenn der gemeinsame Atlas die sichtbare Karte besitzt, wird seine verborgene
Legacy-Hexfläche nicht zusätzlich aufgebaut. Die eigenständig geöffnete alte
Weltfläche behält ihren bisherigen Zeichenpfad; Reiseeingaben bleiben geteilt.

**Notwendige Grenzen und offene Alternativen.** Karten-/Ortsbearbeitung und
Live-Wetter behalten getrennte Owner, weil die frühere Editorfläche auch einen
anderen ausgewählten Gruppenkontext zeigen kann. Sie teilen jedoch den bereits
gelesenen Stand beim bewussten Öffnen der fokussierten Reisekonsole. SceneWorld
und Agenda sind weiterhin zwei unterschiedliche Providerreads, kein atomarer
Gesamtframe. Eine inzwischen abweichende Uhr oder Ortsbindung wird deshalb
abgewiesen und verlangt erneutes Laden. Eine gemeinsame begrenzte Providerprojektion
ist erst sinnvoll, wenn reale Nutzungs-/Messbelege den zusätzlichen Schnittstellen-
und Pflegeaufwand rechtfertigen. Die noch breiten `world`-/`preparation`-/`live`-
Eröffnungsprojektionen sind damit nicht als Großbestandslösung abgenommen.

Gezielte Gegenproben zählen beim Öffnen/Retry einen SceneWorld- und einen
Agendaread, prüfen einzelne statt doppelte Termine, verspätete Antworten,
Providerfehler, andere Uhr/Orte und erhaltene Datenbytes. Die bestehenden Reise-,
Wetter- und Atlasfälle prüfen außerdem Entwürfe, Fokuswechsel, Start/Checkpoint
und Wiederaufnahme. Der native Ablauf `tools/test-desktop-live-travel-reads.mjs`
zählt reale IPC-Aufrufe, öffnet die gemeinsame Karte ausdrücklich, reist bis
Ankunft und öffnet den Stand nach Neustart bei 100 % erneut. Das ist ein begrenzter
Ablaufbeleg und keine vollständige Provider-/Großrouten-/Plattformabnahme.

## Vorhandener Ablauf und Datenregeln

`world-ui.ts` komponiert die instanziierbare Karten-/Reisekonsole.
`world-map-editor.ts` besitzt Karte, Orte und Kamera,
`world-travel-editor.ts` Route, Vorschau, Platzierung und Playback.
`AtlasJourney`, `AtlasAuthor` und `AtlasDrawing` erhalten die schmalen
Reisemethoden der konkreten Instanz. Eingaben und Aktivierung folgen dem
[gemeinsamen Editor-Lebenszyklus](../../project/architecture/editor-lifecycle.md#weltinstanz-und-gemeinsame-schreibgrenze). Geordnete Wegpunkte
führen über `world-model.findRoute` zu benachbarten Hexschritten; die Vorschau
zeigt Strecke, Dauer und Wetterabschnitte. Der GM nimmt sie ausdrücklich an.
Die Konsole erlaubt bis zu 20 Wegpunkte plus Reiseziel; offene Routeneingaben
bleiben lokale Entwürfe.
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

## Früherer Kartenwechsel und erhaltene Owner-Regeln

Der folgende Wechselvertrag beschreibt die frühere Hexkonsole. Die aktuelle
Atlaswurzel lässt keine zweite Karte anlegen; die früheren Mehrkartenfixtures
werden deshalb ausdrücklich auf ihre heutige fachliche Wirkung bezogen. Erhalten bleibt die fachliche Schutzregel für Wechsel zwischen
Kampagnen und realen Reisekontexten: Erst den alten Owner abschließen, dann den
neuen bestätigten Stand übernehmen, ohne offene Texte zu verlieren.

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
Großrouten-, Drag- oder Plattformabnahme.

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
Host-/Großroutenabnahme und keine behauptete neue Kartengrenzregel.

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


Weitere Fachabschnitte: [Teil 2](hex-travel-2.md) · [Teil 3](hex-travel-3.md)
