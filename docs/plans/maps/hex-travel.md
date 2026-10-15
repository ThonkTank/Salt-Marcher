# Hexreise: Laufzustand, Kopien und verbleibende Nutzerfähigkeiten

Stand: 15.10.2026. Quellen: [Hex Travel](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/hex/requirements/requirements-hex-travel.md)
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

## Nächste ausführbare Lieferungen

1. **Kontinuierliche Karte und ausdrückliche Passierbarkeit.** Die übergeordnete
   [Program-Capability-Quelle](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/project/requirements/requirements-program-capabilities.md)
   verlangt mehrere kontinuierliche Hexkarten ohne feste gezeichnete Ausdehnung.
   Die frühere Forderung dieses Plans nach einer erst zu entscheidenden
   Kartenfläche entfällt; keine Footprintmigration oder künstliche Kartengrenze.
   `AtlasMap` besitzt sparse Zellen, `cellAt` liefert für nicht beschriebene
   Flächen Ebene. Ungezeichnet ist kein Sperrterrain. Fachlich gesperrte Wege
   oder erforderlichen Transport ausdrücklich modellieren, statt aus der
   Zeichnungslücke abzuleiten; `Terrain` allein besitzt derzeit keinen
   gesperrten Zustand. Danach `findRoute`, Vorschau, Start und Checkpoint mit
   derselben Regel prüfen. Abnahme: Weg außerhalb gezeichneter Zellen bleibt
   möglich, ausdrückliche Sperre und bestätigte Transportvorgabe, geänderte
   Route und fehlende Voraussetzungen verändern weder Position noch Zeit.
   Aktuelle Such-/Abschnittsgrenzen sind Rechenbudgets, keine Kartenränder;
   lange Reisen müssen sich nachvollziehbar in Abschnitte teilen lassen.
2. **Präsentation weiter qualifizieren.** Die vorhandene Wiedergabe auf großen
   Routen und bei 200% prüfen. Pointerinterpolation ist nicht Bestandteil der
   autoritativen Checkpoints; jede zusätzliche Animation bleibt reine Darstellung.
3. **Gemeinsame Bedienung abschließen.** Karte/Token, Drag-Platzierung mit
   Tastaturalternative, Wegpunkte und Auswahl im selben Scene-/Mapkontext
   bedienen. Vorhandene Gesten prüfen, statt einen zweiten Renderer zu bauen.
   Die vorhandene dreiteilige Utilityauswertung mit kanonischen Biomen und
   späterer Transport-/Passierbarkeitsregel konsistent weiterführen. Mapwechsel
   leert nur transienten Entwurf/Auswertung; Scenewechsel übernimmt keine alte
   Antwort. Reiseansicht allein erzwingt keinen anderen Arbeitskontext.
   Native Abnahme mit Kartenwechsel, langen Routen,200%, Fehlerantwort,
   Prozessunterbrechung, Fokuswechsel und finalem Interrupt ohne Doppelbuchung.
