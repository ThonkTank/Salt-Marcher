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

## Nächste ausführbare Lieferungen

1. **Kartengrenze und Passierbarkeit klären.** `AtlasMap` enthält derzeit
   sparse Zellen und `cellAt` liefert für nicht beschriebene Flächen Ebene;
   `Terrain` besitzt keinen gesperrten Zustand. „Nicht gezeichnet“ darf beim
   durchgehenden Atlas nicht vorschnell „unpassierbar“ bedeuten. Vor einer
   Codecänderung eine ausdrückliche Kartenfläche und fachliche Sperre samt
   möglicher Transportart entscheiden; aktuelle Karten und Prosa erhalten.
   Danach `findRoute`, Vorschau, Start und Checkpoint mit demselben Prädikat
   prüfen. Abnahme: außerhalb, gesperrtes Zwischenhex, Wasser ohne bestätigten
   Transport, Wegpunktreihenfolge und geänderte Karte nach Vorschau. Fehler
   verändern weder Position noch Zeit und lassen keinen alten Erfolg stehen.
2. **Präsentation auf bestehende Checkpoints setzen.** 1/2/5/10x und die
   Grundrate eine Echtsekunde pro Spielstunde sind noch zu liefern. Ein Timer
   darf nur bestehende bestätigbare Schritte anfragen; Geschwindigkeit ändert
   keine gespeicherten Dauern. Nur ein offener Command, Stop/Scenewechsel
   invalidieren dessen UIfortsetzung; verlorene Antwort am selben Command
   lesend klären. Neustart pausiert sichtbar am letzten bestätigten Hex statt
   Zeit nachzubuchen. Zielbereiche: `world-ui`, bestehender Worldcommand-/
   Reconciliationweg und Kartenprojektion; kein zweiter Journeyzustand.
3. **Gemeinsame Bedienung abschließen.** Karte/Token, Drag-Platzierung mit
   Tastaturalternative, Wegpunkte und Auswahl im selben Scene-/Mapkontext
   bedienen. Vorhandene Gesten prüfen, statt einen zweiten Renderer zu bauen.
   Auswertung um erklärbare Summe der tatsächlich betretenen Biomekosten
   ergänzen; Kosten von Zeit samt Wetter/GMfaktor unterscheiden. Mapwechsel
   leert nur transienten Entwurf/Auswertung; Scenewechsel übernimmt keine alte
   Antwort. Reiseansicht allein erzwingt keinen anderen Arbeitskontext.
   Native Abnahme mit Kartenwechsel, langen Routen,200%, Fehlerantwort,
   Prozessunterbrechung, Fokuswechsel und finalem Interrupt ohne Doppelbuchung.
