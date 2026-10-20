# Terrainbasis und gemeinsame Atlaskamera zusammenführen

Stand 21.10.2026. Der Nutzer startet aus dem geteilten Projektordner. Die
hier geprüfte Fassung liegt noch im isolierten Integrationsbranch; sie ist
**kein Nachweis einer Übernahme in diesen Repository-Start**. Ausgangsstände
und offene Anschlüsse stehen in der [Basisdokumentation](../../plans/maps/unified-atlas-baseline.md#repository-start-und-zusammenführung-21102026).

Übernommen wurden die vorhandenen Terrain-Streams, Caches, lokale Invalidierung,
additiven Höhenbänder und die workerbasierte Vorbereitung großer Pinsel aus dem
geteilten Checkout. Die gemeinsame Kamera liest beim Navigieren jetzt begrenzte
Projektionen. Kleine Kameraänderungen behalten angeforderte und dargestellte
Flächen; Höhenlinien bleiben GPU-Stilparameter. Autorenrecords werden erst für
Entwürfe gelesen. Dieser Entwurfspfad und die GPU-Neuveröffentlichung benötigen
noch die Live-/Delta-Integration.

## Prüfungen

- 57 Fälle: Pinsel und Submeterauflösung, große additive Pinsel, Trassenschutz,
  Terrainprojektion und -service, Oberflächencache, Kamera-Quellwiederverwendung,
  räumliche Geometrie und Vegetationsauswahl.
- 62 weitere Fälle: Height-Codec in Node/Browser, kanonische Streaming-Arithmetik,
  Frame-Deltas, Displayreihenfolge, Cachebesitz und Invalidierung,
  Live-Schreibhistory/Undo/Reopen, Worker-Schreibvorbereitung, Quellzellindex.
- 8 Fälle: öffentliche Kartenfreigabe, Sichtbarkeit und Instrumentierung.
- 29 Fälle: Bereichslesen, Landmasken sowie Trennung von Land- und Farbwerkzeugen.

Die vollständigen Ausgaben liegen in [Kamera/Pinsel](camera-and-brush-tests.log),
[Backend](backend-tests.log), [Grenzen](boundary-tests.log) und [Bereichsregressionen](region-tests.log).
- Typecheck, Desktopbuild und Repositoryprüfung bestanden.

Die erste Übernahme hatte drei alte Testannahmen: Schema 52 statt des aktuellen
Schemas 53 und die frühere Sperre grober Pinsel über feinem Gelände. Die Tests
prüfen jetzt das vorhandene additive Verhalten samt unveränderten Detailbytes,
Undo und Neustart. Submeterfälle des Kamerabranches bleiben bestehen.
Der früh mitkopierte perspektivische Exporttest gehört zum noch ausstehenden
Ausgabeanschluss und wurde nicht als bestandener Fall dieses Schritts gezählt.

## Nativer Ablauf

`tools/test-desktop-terrain-routes.mjs --reopen-from
.build/atlas-consolidated-planning/failure.json` verwendet eine SQLite-Sicherung
unseres früheren Testprofils in einem neuen isolierten Profil. Kampagne öffnen,
Atlas-Reiter, gespeicherte Trasse auswählen, Planungsleiste öffnen, Verlauf
einpassen und Hauptkamera neigen. Die Probe verlangt ausdrücklich
`data-renderer=webgl`, genau eine Hauptoberfläche und keinen separaten
Planungsdialog oder `route-canvas`. Alle Landschaftspayloads bleiben unverändert.

[result.json](result.json) enthält Quellcommit, Dirty-Kennzeichen, Buildhashes,
Prozesskennung und reguläres Ende mit Exit 0. PID-Abwesenheit wurde zusätzlich
geprüft. [Fensterbild](reopened-main-route.png) stammt aus diesem Ablauf.
Die Probe startete vom uncommittierten Integrationsstand über `7740fe75d`;
sie ist keine Exact-SHA-CI oder Leistungsqualifikation. Der später ergänzte
konservative Label-Cache-Reset bei Stadtobjektänderungen ist von diesem
Trassenablauf nicht abgedeckt.

Keine Main-Integration, Installation oder Owner-Abnahme. Keine Behauptung über
60 FPS oder vollständige Maßstabsabdeckung; die Abschlussaudits sind offen.
