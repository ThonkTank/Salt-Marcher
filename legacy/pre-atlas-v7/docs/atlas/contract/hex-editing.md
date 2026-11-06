# Kontinuierliches Gelände bearbeiten

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: atlas
Last Reviewed: 2026-10-28 (metrischer Fachumfang und Nachweisgrenzen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Laufzeitreise, unabhängige Kampagnenkopien und verbleibende Reiseziele:
[Hexreise](hex-travel.md).

Original: [Hex Feature Requirements](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/hex/requirements/requirements-hex.md).

Die aktuelle Geländeprüfung folgt dem [gemeinsamen metrischen Atlas](../architecture/unified-spatial-atlas.md).
Landform, Höhe, Farbe und Geländeeigenschaften werden als kontinuierliche
Landschaft bearbeitet. Reise- und Referenzraster sind unabhängige Verbraucher;
sie legen weder Gelände-Zellen noch eine Autorenstufe fest.

Ein Eigenschaftspinsel verbindet ausgelassene Pointerpositionen durch seine freie
Kontur und seinen metrischen Radius. Loslassen bestätigt genau einen Zug;
getrennte Gesten erzeugen keine verbindende Fläche. Zurücksetzen entfernt nur
die gewählte Eigenschaft im berührten Bereich. Andere Eigenschaften sowie
feinere, nicht berührte Arbeit bleiben erhalten. Gemeinsames Undo/Redo und frische
Wiederöffnung verwenden die kanonische Atlas-Schreibgrenze.

Die früheren Zellfüller, Source-Cell-Indizes, lokalen Zell-Strichhistorien und
Hexstufen-Erwartungen gehören nicht mehr zur aktuellen Geländequalifikation.
Die ursprünglichen fachlichen Quellen bleiben oben und im Quellenregister
gebunden; der Wechsel des technischen Modells entfernt keinen Landschaftsumfang.

## Prüfwege

[desktop-atlas-frame-loading.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/atlas/desktop-atlas-frame-loading.test.mjs) prüft freie Eigenschafts- und
Resetkonturen, lückenlose Pinselabdeckung, genau einen Releaseauftrag und die
Trennung mehrerer Gesten. `tests/atlas/desktop-atlas-region.test.mjs` prüft
Eigenschaftsvererbung, gezieltes Zurücksetzen, gemeinsame Rücknahme und Fresh.
`tests/atlas/desktop-land-mask.test.mjs` prüft daneben eine unabhängige
Archivkopie kontinuierlicher Flächen einschließlich Änderung und Löschung.
`tests/atlas/terrain-live-history.test.mjs` schützt kleine History-Deltas und
unveränderte andere Flächen bei 100.000 kontinuierlichen Geländeobjekten.

[desktop-map-camera-passivity.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/runtime/desktop-map-camera-passivity.test.mjs) bleibt eine begrenzte
Prüfung der Kamera sowie unabhängiger Beschriftungs- und Kalendereingaben im
Reiseadapter. Sie behauptet keine Prüfung eines alten Gelände-Zellpinsels.
Native Atlasproben besitzen zusätzliche Kamera-, Neustart- und Bildnachweise;
ihr tatsächlicher Laufstand bleibt von diesem Fachvertrag getrennt.

## World-Ortsmarken im bestehenden Adapter

Die folgenden Markerregeln beschreiben den Worldadapter. Aktuelle metrische
Ortsanlage und Orts-Keys im Atlas stehen in der [Bedienung](../guide.md#eine-region-vorbereiten)
und werden unter anderem durch `tests/atlas/desktop-atlas-region.test.mjs` geprüft.
Die Adapterregeln begründen keine neue Kartenwahl oder Gelände-Zellarchitektur.
Die folgenden datierten Test- und Nativeaussagen gehören zu diesem Adapterstand;
sie qualifizieren nicht erneut die aktuelle Atlasoberfläche.

Bestehende World-Orte sind nach Name, Ortstyp und Kartenname suchbar; die Auswahl
zeigt Karte und Koordinaten. „Marker zeigen“ navigiert ausdrücklich, Auswahl und
Gestaltung erhalten die Kamera. Versetzen erhält Orts-ID und Darstellung; ein
belegtes Hex wird nicht still überschrieben.

Die Kartendarstellung besitzt eine eigene `place-presentation`-Revision im
bestehenden World-Record-Speicher: optionaler Titel, acht gemeinsame SVG-Symbole,
Größe, Position und Krümmung der Beschriftung. Standardwerte gelten für bisherige
Marker. Vorschau ist unmittelbar; Regler werden beim Abschluss zusammengefasst
gespeichert. Bei Konflikt wird die bestätigte Darstellung erneut gelesen.
Ortsdokument und Gelände-Revision bleiben davon unabhängig. Kampagnenkopien
übertragen die Darstellung mit neu zugeordneten Orts-IDs.

### Markerwechsel mit offener Speicherung

`world-ui.ts` hält bei einer neuen Ortsauswahl die bisherige Marker-ID und ihre
Felder bis zur bestätigten Speicherung zusammen. Die Felder sind während dieser
Übergabe gesperrt; nur die jüngste Auswahl darf anschließend einen neuen Draft
binden. Programmatisch verspätete Inputs werden nur bei passender sichtbarer ID
und editierbarer Fieldsetbasis gesammelt. Auswahl-ABA und Reaktivierung machen
ältere Auswahlantworten ungültig.

Der bestehende `raw`-Guard bindet den Markerauftrag vor IPC und seine Antwort
an das tatsächlich übergebene Draftobjekt. Kontextwechsel während vorbereitender
Flushes senden keinen alten Markercommand mehr. Ein bereits angewandter alter
Auftrag behält seinen Beleg, darf aber keine neu gelesene World-/Markersicht
überschreiben. Keine neue Commandart oder Persistenz. Bei fehlgeschlagener oder
unklarer Buchung bleibt der bisherige Ort ausgewählt; die bestehende
Originalcommand-Reconciliation klärt einen verlorenen Ausgang ohne zweiten Write.

[desktop-marker-selection.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/runtime/desktop-marker-selection.test.mjs) kontrolliert echte Store-/DOMübergaben mit
verzögerter Vorbereitung und Bestätigung, schneller A/B/A-Auswahl, gleicher
Workspace-Reaktivierung, neuerem Fremdstand, Validierungsfehler und verlorenem
IPC-Reply samt read-only Recovery. Diese lokalen Gegenproben ersetzen keine
vollständige native Marker-, Chunk-, Symbol- oder Hexabnahme.
Eine zusätzliche Electron-Bedienprobe bestätigt zwei getrennte Markersaves,
unveränderte Orts-/Geländeinhalte, Fresh-Wiederöffnung und normalen Prozessausstieg.
Die gezielt verzögerten Bestätigungen bleiben kontrollierte Store-/DOMbelege.

Noch offen im vollständigen Originalumfang: vollständiger World-Locationeditor
bei der Ortsanlage, Suche nach kanonischen Tags, eigene importierte
Symbole, gemeinsame Rücknahme sämtlicher Markerwirkungen und referenzbewusstes
Entfernen von Markern/Gelände. Der einfache Gelände-JSON-Export des Adapters ist
keine vollständige Kampagnenkopie; deren eigener Vertrag erhält Orte und Marker.
Die frühere Zielhex-Voraussetzung bleibt unten als offener fachlicher Anschluss
an die metrische Landschaft benannt.

## Verbleibender fachlicher Geländeumfang

Die Feature-, Editor- und Travel-Originale sowie ihre Quellenbindungen bleiben
maßgeblich. Die folgenden Wirkungen bleiben offen, soweit sie nicht durch einen
benannten aktuellen Teilnachweis belegt sind. Die bestätigte Lieferpriorität
besitzt ausschließlich der [Atlasplan](../architecture/unified-spatial-atlas.md#aktueller-arbeitsstand);
Codeeinstiege und Prüfwege stehen in [rendering.md](../architecture/rendering.md#wo-ändern-und-prüfen).

1. **Gemeinsame Biome.** Die 35 Originalbiome einschließlich Aliasauflösung und
   globaler `Any`-Tabelle auf stabile installationseigene Biom-IDs beziehen.
   Geländeauswahl, Kreaturumgebungen, Generatorfilter und Reiseauswertung müssen
   dieselben Definitionen konsumieren. Built-ins sind gegen Löschen geschützt,
   erlaubte Bearbeitung bleibt möglich. Beliebig viele eigene Definitionen, Suche,
   Seiten und begrenzt geladene große Paletten bleiben Teil des Umfangs. Fehlende Definitionen sind sichtbar, keine unmarkierten
   Fallbacks. Prüffall: eigenes Biom in Palette, Kreaturfilter und Routenvorschau,
   nach Neustart und unabhängiger Kopie. Historische Journeyfakten und Receipts
   bleiben unverändert; neue Regeln dürfen ihre Wirkung nicht rückwirkend ändern.
2. **Gezieltes Radieren, Referenzfolgen und Schutz anderer Arbeit.** Kontinuierliche
   metrische Pinsel und Zurücksetzen wirken nur auf gewählte Eigenschaften und
   berührte Flächen. Radieren entfernt die eigene Vorgabe statt das Standardbiom
   aufzutragen. Andere Eigenschaften, unberührte Feinarbeit und spätere
   Fremdänderungen bleiben geschützt. Vor einer referenzwirksamen Entfernung
   müssen betroffene Ortsbindungen, Positionen und offene Journeys sichtbar sein.
   Ausdrücklich bestätigte Bereinigung ist atomar, ohne Ort oder Figur zu löschen;
   Autoren-Undo darf bereinigte Runtimepositionen oder Reisen nicht heimlich
   wiederbeleben. Diese umfassende Impactwirkung ist noch offen. Prüfung umfasst
   Rollback, verlorene Antwort, spätere Änderungen, negative/große Koordinaten,
   Fresh und unveränderte Kamera. Gemeinsame Autorhistorie und kanonische
   Main-/Store-Schreibgrenze ersetzen lokale Karten-Strichhistorien; es gibt
   keinen neuen Zellpatchwriter, Axial-Pinselradius oder alten Gelände-Fixtureauftrag.
3. **Ortsanlage über die bestehenden Fachbesitzer.** Der aktuelle Atlaszugang
   „Ort platzieren“ verbindet Ortsdokument und metrische Platzierung bereits über
   `landscape-place` in der gemeinsamen Transaktion. Die vollständige World-Ortsanlage
   mit allen Locationeditorfeldern bleibt ein eigener offener Ausbau; keine zweite
   unabhängige Hex-Ortsdatenhaltung. Orts-ID, Prosa und Links bei Move/Remove,
   Änderung und unabhängiger Kopie erhalten. Fehlende oder belegte Ziele und
   zwischenzeitliche Quellenänderungen sichtbar behandeln; wiederholte Command-IDs
   dürfen keine zweite Anlage erzeugen. Eine bestätigte Ortslöschung entfernt die
   Platzierung atomar; Entfernen der Platzierung allein löscht keine Ortsprosa.
   Die frühere Voraussetzung „gestaltetes
   Zielhex“ muss für kontinuierliche Landschaft fachlich konkretisiert werden;
   sie autorisiert keinen Gelände-Zelleditor und keine Legacy-Migration.
4. **Symbole und Markerprojektion.** Gemeinsame eingebaute Symbole erhalten;
   eigene begrenzte one-path-SVGs über Mainauswahl und geprüften Parser ergänzen.
   Installationseigene Suche, Detail-/Impactanzeige und vollständige Referenzprüfung
   gehören dazu. Import und Zuordnung brauchen idempotente Bestätigung; Löschung
   ersetzt aktive und wiederherstellbare Verweise vor Entfernung, auch in
   Papierkorbkampagnen. Parserabbruch, Neustart in Journalphasen und ausschließlich
   betroffene Invalidierungen prüfen. Renderer erhalten fertige begrenzte Daten.
5. **Reiseprojektion und Gesamtfluss.** Editorwahl bestimmt keine aktive Reise.
   Fokussierte Gruppe/Scene, gültige Wegpunkte, ausdrücklicher Start, Passierbarkeit,
   Tempo, Pause/Abbruch und pausierte Wiederaufnahme folgen dem [Reisevertrag](hex-travel.md).
   Reise- und Referenzraster bleiben gültig, ohne Autoren-Zellarchitektur zu fordern.
   Gesamtprüfung umfasst fehlende Kontexte, konkurrierende Saves, Kampagnen-/
   Scenewechsel, Tastatur, 100 % und große Daten. Einzelne Marker- oder Queuefälle
   sind keine vollständige HEX-/E2E-Abnahme.

Die [frühere Zell-/Chunk-Lieferfolge](https://github.com/ThonkTank/Salt-Marcher/blob/1cb69e33dca7eda6e56916c3cf6bc2cfba803c7d/docs/atlas/contract/hex-editing.md#verbleibende-ausführbare-hex-lieferfolge)
ist historisch gebunden. Ihre technische Migration, lokale 20er-Kartenhistory und
Axialradius 0–9 sind keine aktuellen Lieferaufträge. Die ursprünglichen fachlichen
Anforderungen und `sources.json` bleiben erhalten; neue Tests verwenden das aktuelle
metrische Modell, keine Migration alter interner Geländeformate.
