# Gemeinsame passive Kartenfläche

Originalquelle: Salt-Marcher `9de85c1a26f526acbc1af332ac5962e185c0aab2`,
`docs/maps/requirements/requirements-maps-canvas.md`.

Dungeonzeichnung und Hexatlas benutzen denselben SVG-Hostmechanismus mit
passiver Kamera, mittlerem Ziehen und mausverankertem Zoom. Beide zeichnen in
eine neue, zunächst unverbundene SVG-Gruppe. Erst ein vollständiger Durchlauf
ersetzt die gemeinsame sichtbare Szenenwurzel; native DOM-Treffer stammen aus
exakt dieser Szene. Der passive Hit-Helfer liefert nur deren DOM-Elemente.
Raum-, Hex-, Orts-, Token- und Reisebedeutung bleibt beim jeweiligen Anwender.
Dungeon-Drawing-Overlays und Hexbeschriftungen/Marker/Reiserouten bleiben Teil
derselben Wurzel. Der SVG-Host und seine Capture-Listener bleiben stabil.

Die gemeinsame Kameraleiste bietet vorige/nächste Ansicht und Zurücksetzen.
Ein Ziehen ist ein Verlaufsschritt; unmittelbar aufeinanderfolgende
Mausradereignisse bilden eine Zoomgeste. Eine dazwischen ausgeführte
Kameraaktion beginnt für das nächste Mausradereignis einen neuen Verlaufsschritt.
Je Kontext bleiben höchstens32
Verlaufsschritte und höchstens32 zuletzt besuchte Ansichtskontexte im Speicher.
Die Schlüssel sind undurchsichtige Zeichenfolgen. Der Cache enthält nur
Ausschnitte, Defaultausschnitte und deren Verlauf, keine Kartenobjekte.
Dungeon-Geschosse und ausdrücklich angewählte Hexkarten/Zoomebenen bekommen
beim Wiederbesuch ihren Ausschnitt und Verlauf zurück. Ausdrückliches
Fokussieren auf Gruppe/Ort verwendet weiterhin dessen Ziel. Größenänderungen
und Bereichswechsel zentrieren dieselbe Ansicht nicht implizit neu.

Kameraänderungen lösen keine Karten-, Zell-, Reise- oder Kalenderbefehle aus.
Der Hexanwender darf vor einer Kamerageste einen laufenden lokalen Pinselzug
in den ungespeicherten Entwurf übernehmen, damit keine veraltete
Pointertransformation weiterzeichnet. Keine automatische Speicherung.

Leere Szenen zeigen einen fachneutralen Status; sie benötigen keine erfundene
Domänengeometrie. Zeichenfehler entfernen alte/teilweise Treffer und bieten
explizites Neuzeichnen. Ein Retry erzeugt eine frische Szenenwurzel ohne neue
Capture-Listener und ohne Änderung der Kamera oder persistierter Kartenfakten.
SVG benötigt unter der bestehenden CSP kein dynamisches Code-Evaluieren.

Der Ansichtscache ist flüchtig und wird nicht mit Kampagnen gespeichert.
Dies ist kein GPU-/Tilecache oder Rendererwechsel. Geräteübergreifende
Kamerasynchronisation, weitere Kartenanwender und vollständige Plattform- und
Ausfallqualifikation bleiben eigene Folgearbeit.
