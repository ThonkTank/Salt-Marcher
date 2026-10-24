# Gemeinsame passive Kartenfläche

Status: Current; offene Ziele sind als solche beschrieben.
Owner: atlas
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Originalquelle: Salt-Marcher `9de85c1a26f526acbc1af332ac5962e185c0aab2`,
`docs/maps/requirements/requirements-maps-canvas.md`.

Der gemeinsame Kampagnenatlas verwendet `AtlasCanvas` (Canvas2D) mit einer
passiven relativen Kamera und kompilierten Path2D-/Bildkommandos. Darstellung
und passive Griff-/Markertreffer stammen aus derselben veröffentlichten Szene;
Objektauswahl fragt weiterhin genaue quellengebundene Kandidaten im Main ab.
Kleine Pans zeichnen vorhandene Kommandos mit geänderter Kamera, ohne neue
Kartenobjekte oder Reads. Bildframes werden vollständig vorbereitet und nur
als jüngste gültige Szene veröffentlicht. Treffer und Hover benötigen zusätzlich
die erfolgreich gezeichnete Kombination aus Szene, Kamera und CSS-Innenmaßen.
Zwischen Kamera-/Größenwechsel und Paint sowie beim Wiederanzeigen einer zuvor
verborgen vorbereiteten Szene bleiben sie gesperrt. Fehlende aktuelle Treffer
beweisen währenddessen keine leere Fläche für linkes Navigationsziehen. Zeichen-/Initialisierungsfehler
entfernen Treffer und bieten ein neues Initialisieren mit derselben Kamera.
Stadt- und Zeichensymbole entstehen direkt aus gemeinsamen Geometriegeneratoren;
SVG-Serialisierung bleibt auf Ausgabe und ältere Hosts begrenzt. Abgewiesene
Pointergesten bleiben bis zu ihrem Klick unterdrückt, auch wenn Speichern oder
Framevorbereitung zwischen Druck und Loslassen abschließen.
Bilddecodierungen und Zeichenpuffer sind begrenzt; Details und verbleibende
Alternativen stehen im [Atlas-Runtimeplan](../contract/spatial-runtime.md).

Im gemeinsamen Workbench markiert der Atlas die vier alten Kartenhosts
(Raumbearbeitung, Stadt, Hexreise und Dungeonreise) ausdrücklich als abgelöst.
Ihre Geometrie bleibt leer: Auch beim Nachladen von Werkzeugen, Bearbeiten
oder Wechsel zum Live-Tisch entsteht kein versteckter SVG-Baum. Die Fachfelder,
Entwürfe und Statusanzeigen laufen weiter; Ausgaben benutzen ihre eigenen
Geometriegeneratoren. CSS-Ausblenden allein genügt dafür nicht.

Die älteren isolierten Dungeon-/Hexansichten außerhalb dieses Workbenchs behalten `PassiveMapCanvas` mit
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
