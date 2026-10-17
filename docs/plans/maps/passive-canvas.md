# Gemeinsame passive Kartenfläche

Originalquelle: Salt-Marcher `9de85c1a26f526acbc1af332ac5962e185c0aab2`,
`docs/maps/requirements/requirements-maps-canvas.md`.

Der gemeinsame Kampagnenatlas verwendet `AtlasCanvas` (Canvas2D) mit einer
passiven relativen Kamera und kompilierten Path2D-/Bildkommandos. Darstellung
und passive Griff-/Markertreffer stammen aus derselben veröffentlichten Szene;
Objektauswahl fragt weiterhin genaue quellengebundene Kandidaten im Main ab.
Kleine Pans zeichnen vorhandene Kommandos mit geänderter Kamera, ohne neue
Kartenobjekte oder Reads. Bildframes werden vollständig vorbereitet und nur
als jüngste gültige Szene veröffentlicht. Zeichen-/Initialisierungsfehler
entfernen Treffer und bieten ein neues Initialisieren mit derselben Kamera.
Bilddecodierungen und Zeichenpuffer sind begrenzt; Details und verbleibende
Alternativen stehen im [Atlas-Runtimeplan](../../../ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md).

Die älteren isolierten Dungeon-/Hexansichten behalten `PassiveMapCanvas` mit
SVG-Gruppen und DOM-Treffern. Sie teilen keine zweite Autorenwahrheit mit dem
Atlas. Die Kamerasemantik bleibt gleich; die Implementierungen sind derzeit
getrennt und bei der nächsten tatsächlichen Adoptermigration zu konsolidieren.

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
Canvas2D und der verbleibende SVG-Host benötigen unter der bestehenden CSP kein dynamisches Code-Evaluieren.

Der Ansichtscache ist flüchtig und wird nicht mit Kampagnen gespeichert.
Der Ansichtscache ist kein GPU-/Tilecache; der Canvas2D-Rendererwechsel ist oben getrennt beschrieben. Geräteübergreifende
Kamerasynchronisation, weitere Kartenanwender und vollständige Plattform- und
Ausfallqualifikation bleiben eigene Folgearbeit.
