# Unabhängige Objekte und gemalte Gebiete

Korrektur des Produktmodells vom 20.10.2026: Straßen, Häuser und weitere Objekte existieren unabhängig von gemalten Gebieten. Ein Gebiet ist ein benennbares Overlay, keine Stadtdefinition und kein Geometriebesitzer.

## Lokale Belege

- `tests/desktop-atlas-regions.test.mjs`, Fall **objects ignore legacy city sheets; painted areas neither own nor mutate their geometry**: Straße und Haus außerhalb eines historischen 20×20-m-Dokuments bleiben sichtbar und exakt auswählbar. Ein Gebiet wird darüber angelegt, umbenannt, um 10 km verschoben und gelöscht; Undo/Redo verändern weder die Objektprojektion noch Payloads/Checksums der gespeicherten Objekte. Auch weiter Zoom erzeugt keine Stadtmarker und keine automatisch aus dem Dokumentnamen abgeleiteten Beschriftungen.
- [Nativer Durchlauf](result.json): Die Gebietssuche rahmt zwölf Häuser und eine Straße auf der normalen Landschaft ein. Diese Objekte liegen außerhalb des historischen Dokuments; dessen Name und Papier erscheinen nicht. Senkrechte und geneigte Ansicht sowie ein Werkzeugwechsel behalten dieselbe Fläche. Die Löschung des Gebietes über „Region entfernen“ entfernt dessen Grenze/Beschriftung und erhält die sichtbaren Objekte samt bytegleichen Payloads/Checksums. Die Suche öffnet die Gebietswerkzeuge. Grafikverlust und ausdrücklicher Wiederanlauf funktionieren; Prozessabschluss Code 0, keine Rendererfehler. Ergebnisdatei mit Quellen- und Bundlehashes.

Die Beispielhäuser sind eine funktionale Prüfanordnung. Die dünne diagonale Linie ist das gemeinsame Hexraster; die gestrichelte Grenze gehört zum ausdrücklich angelegten unabhängigen Gebiet. Die Gebietsbeschriftung darf über derselben Straße liegen, ohne diese zu besitzen.

```sh
npm run build:desktop
QA_EVIDENCE_DIR=.build/atlas-independent-check python3 tools/ui-session.py timeout --signal=TERM --kill-after=10s 180s node tools/test-desktop-atlas-main-camera.mjs --city-only
```

## Grenzen

Die Darstellung, Bereichsabfrage und Atlasausgabe kennen kein Stadtpapier, keine Dokumentgrenze und keinen aggregierten Stadtmarker mehr. Für vorhandene Daten bleiben `city_document`/`city_unit` vorläufig Speichercontainer mit einer Koordinatenumrechnung. Die Autorenwerkzeuge und ihre bisherigen Stadt-Einstiege müssen noch vollständig auf unabhängiges Anlegen ohne diese Benutzerkonzepte umgestellt werden. Dies ist eine offene Implementierungslücke, keine neue fachliche Zugehörigkeit. Keine Main-/Paket- oder Ownerabnahme.

Lokaler Gesamtlauf: 3.799 Fälle bestanden, fünf Fehler in zwei veralteten Test-Doubles, ein übersprungener Fall. Nach Aktualisierung dieser Doubles bestanden sämtliche 42 Fälle der beiden betroffenen Dateien. Die drei Indexfälle einschließlich Upgrade bestanden ebenfalls. Das ist kein behaupteter zweiter grüner Gesamtlauf; die abschließende vollständige Exact-SHA-Prüfung läuft über Candidate CI.
