# CITY-UI: Ziele eines Orts im bestehenden Atlas-Dock öffnen

## Auftrag, Eingang und Grenzen

CITY-UI-P01 konkretisiert den bereits bestätigten Stadtbeitrag zu I01c, keine neue
allgemeine Owner- oder Ratifikationsrunde. Eingang: PR13
`adc4b98a3925b39abefb0a4db9a2bcd7c1a5a6ec`, unabhängiger
[RUNTIME-I01b-R02](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/13#issuecomment-6094937083)
und abgeschlossene Reviewer-Aufräumfolge
[P/I/R](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6094957819).
Hex hat die Dateigrenze in seinem N01b-Beleg `visibleNextSlice` bestätigt.

Die [Stadt-Roadmap](ROADMAP-CITIES.md) verlangt denselben Atlas und dieselbe
Kamera/History über Ort, Stadt, Haus und Raum. Der Einstieg ergänzt direktes
Auffinden; er ersetzt die durchgehende Zoomroute nicht. Vollständige CITY-01–09-
und Originalparitätsabnahme bleiben offen. Maßgeblich sind außerdem
[Runtimeplan](ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md) und
[E2E-Plan](ROADMAP-CITIES-E2E-INTEGRATION-PLAN.md).

## Konkreter Nutzerablauf

Ort auswählen → im vorhandenen Dock benannte Ziele sehen → „Stadtplan öffnen“,
ein Haus oder einen Raum auswählen → Hex navigiert im selben Canvas zu dessen
Geometrie/Key. Bei mehreren Zielen hilft eine unmittelbar filternde Suche.
Nicht verfügbare Ziele bleiben mit konkretem Grund erkennbar. Ein fehlerhafter
Wechsel zeigt seinen Grund und lässt einen erneuten Versuch zu. Offene ungültige
Keys behandelt der Host, bevor er eine Navigation bestätigt.

## Technische Umsetzung

Stadt erstellt ausschließlich `src/ui/atlas-detail-entry.ts` und
`tests/atlas-detail-entry.entry.ts`, neben diesem Plan und eigenen City-Metadaten.
Hex bearbeitet AtlasView/Editor/Renderer/Repository und die gemeinsame
Test-Runner-Einbindung. Bestehende Dateien dieser Hostgrenze werden von Stadt
nicht parallel geändert.

`AtlasDetailEntry` erhält ein vorhandenes `HTMLElement` und
`onNavigate(target: Readonly<AtlasNavigationTarget>): void | Promise<void>`.
`update(model)` liefert den aktuellen Ortsnamen, readonly Einträge mit `label`,
optionalem `description`, dem tatsächlichen `target` sowie optionalem
`unavailableReason`. Ein optionaler `blockedReason` sperrt alle Aktionen und
erklärt beispielsweise den laufenden Ortswechsel. Der Host liefert und validiert
IDs, Typen, Verfügbarkeit, Context-/Registry-/Sourcebindung; das UI löst weder
Dateien noch Campaignzugehörigkeit auf.

Die Komponente kopiert und friert Zielwerte eines Updates ein. Sie leitet genau
diese Werte an den Callback weiter; gleiche Anzeigenamen sind keine Identität.
Kein Repository, Renderer, Source, History, Save oder Provider wird angelegt.
Jedes Update widerruft alte UI-Callbacks durch eine lokale Darstellungsnummer.
Ein Klick auf eine abgelöste Zeile und eine verspätete Callbackantwort dürfen
die neue Darstellung nicht verändern. Das beendet keine Hostoperation; deren
Lebensdauerprüfung bleibt beim geprüften Navigationsconsumer.

Während eines Auftrags sind weitere Zielaktionen gesperrt. Erfüllung entsperrt
die aktuelle Darstellung; Ablehnung zeigt Text über `textContent` und ermöglicht
Retry. Nur die Antwort des noch gültigen UI-Auftrags verändert den Status.
`destroy()` entfernt eigene Listener/Inhalte und widerruft alle noch laufenden
UI-Antworten. Keine automatischen Wiederholungen.

## Gestaltung und Bedienung

Bestehende Obsidian-Schrift, Themefarben und native Controls verwenden; keine
zusätzliche Schrift, Palette, Animation oder zweite Seitenleiste. Der Host
montiert die kompakte Section im vorhandenen Dock. Links ausgerichtete Labels,
Suchfeld mit sichtbarer Beschriftung, normale Buttons und kurze Beschreibung.
Namen/Fehler als Text behandeln. Leere Liste erklärt „Für diesen Ort sind keine
Ziele verfügbar“, leeres Suchergebnis erlaubt Suche zurücksetzen. Eingabe,
Enter/Space und Tab bedienen native Controls; UI-Ereignisse dürfen keine
Atlas-Zeichengeste oder Undo-Abkürzung auslösen. Ein laufender Filter behält seinen
Fokus und seinen Text beim Neuzeichnen. Größenbeschränkung und Scrollen kommen
vom bestehenden Dock. UUIDs, Tokens und technische Ownerbegriffe werden nicht
als Nutzerbeschriftung erzeugt.

Gestaltungsabgleich: ein eigener Kartenmodus oder dekorative Zielkarten würden
den durchgehenden Atlasweg erschweren. Deshalb bleibt die vorhandene visuelle
Hierarchie erhalten; die direkte Aktion am benannten Ziel trägt die neue Funktion.

## Prüfbarkeit und noch offene Hostarbeit

Der isolierte DOM-Test verwendet das vorhandene `linkedom` und echte DOM-Events:

1. Benannte Stadt-/Haus-/Raumziele mit identischen Labels leiten verschiedene
   vollständige native Targets unverändert weiter; Text wird nicht als HTML aktiv.
2. Suche, Zurücksetzen, Leerzustände und unverfügbares/gesperrtes Ziel funktionieren
   ohne Callback; Fokus und Filter bleiben beim Filtern erhalten.
3. Doppelaktivierung während Promise wird verhindert; Ablehnung zeigt den Grund,
   entsperrt und ermöglicht genau einen erneuten ausdrücklichen Versuch.
4. Ortsupdate/destroy vor Promiseantwort sowie Klick auf alte abgelöste Zeile
   erzeugen weder neue Navigation noch Statusänderung im neuen Ort.
5. Caller-Mutation nach Update kann das gebundene Ziel nicht umadressieren;
   Tastatur-/Pointerereignisse aus dem Dock erreichen den Atlasrouter nicht.

Stadt bündelt diesen Test separat per vorhandenem esbuild in einem eigenen
externen QA-Verzeichnis und führt ihn mit `node --test` aus; dazu check/test/build.
Hex hängt ihn an build.mjs/package.json an, sobald die Exact-SHA-Lieferung übernommen
ist. Enger unabhängiger Komponentenreview vor Übernahme in PR13, keine Selbstintegration.

Ein Komponenten-PASS ist noch keine bedienbare Hostlieferung. Hex muss den aktuellen
nativen Bestand liefern, das UI im bestehenden Dock montieren und den Callback an
die Source-/Key-/Contextguards sowie Kamera/History anschließen. Danach gemeinsam
im echten Host Ort → Stadt/Haus/Raum → Key → Undo/Redo → Save → frischer Prozess
prüfen; neuen lokalen GUI-Slot vorher ausdrücklich abstimmen. Produktive
Campaign-/Registry-/P02/P04-/Importeingänge bleiben bei ihren tatsächlichen
Implementierern. Keine Testregistry als produktiven Provider darstellen.
