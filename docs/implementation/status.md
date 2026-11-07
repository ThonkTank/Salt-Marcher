# Aktueller Stand

Atlas V7, Dateiformat 22, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktuelle Arbeit: Landschaftsdeckung auf allen Außenmaßstäben

Landschaft speichert getrennte normierte Bestandsgewichte für Wald, Buschland,
Wiese und Felsgebiet. Malen nähert sich einer Zieldichte, Entfernen schafft lokale
Lichtungen. Grobe Autoren werden vererbt; grobes Übermalen aktualisiert bereits
vorhandene Feinautoren. Boden-/Felsfarben bleiben unabhängig. Der bestehende
Rasterstore teilt seine begrenzten Mechanismen über einen festen RasterKind;
Worker, Queue, History und Präsentationsbesitzer bleiben erhalten.

Nah entstehen stabile Weltkoordinaten-Symbole, mittel kartographische Signaturen,
fern unmittelbar aus Deckungen berechnete Farben. Symbolkandidaten und Kacheln
bleiben begrenzt; ein Kronenrand erhält über den Bildschirmrand ragende Symbole.
Leere Landschaftsantwortkacheln übertragen keine Pixelbytes und erzeugen keine
Rasterarbeit. Vollständig unbenutzte Boden-/Landschaftsebenen überspringen nun
bereits im Store Vererbungsreads und Haloaufbau. Eine Autoren-Existenzprüfung
genügt; Vorschauwerte und explizit leere Autoren behalten ihren normalen Pfad.
Elf betroffene Rustfälle bestehen, einschließlich eines neuen Leerfalltests mit
64 Kacheln auf drei Auflösungen: gesperrte Pixel-/Übersichtsreads, unveränderte
Antwortformate und weiterhin wirksame Argumentgrenzen.
Wasser maskiert die Darstellung ohne Autorenverlust. Schnee bleibt sichtbar.
Konturen und Regionsfüllung liegen über Landschaftsfarbe, aber unter Symbolen.
Der Übergang von Signaturen zu Einzelbäumen überblendet beide Darstellungen
zwischen 0,35 und 0,5 CSS-Pixeln pro Fuß. Das zuvor sichtbare reine Farbband
entfällt. 24 betroffene Frontendtests prüfen unter anderem stabile Positionen,
überlappende Darstellung, das gemeinsame Kandidatenbudget bei 1440×960 und
den Kronenrand. Vorher-/Nachher-Rendererbilder wurden bei sechs Maßstäben
angesehen; Belege liegen unter `src-tauri/target/diagnostics/landscape-transition/`.
Vier Landschafts-Browserfälle bestehen einschließlich Welt→Nah→Welt,
History, Datei und Ozeanmaskierung. Typen und Format bestehen.
Release-/RPM-Build und native Kontrolle dieses Übergangs bestehen: Die Kopie
der gespeicherten Waldkarte wurde in einer zweiten Instanz geöffnet, per Mausrad
zwischen angezeigten 4–9 % gezoomt und im Übergang verschoben. Signaturen und
Einzelbäume bleiben sichtbar; im geprüften Ausschnitt entstehen keine Kachelnähte.
Die Dateikopie blieb bytegleich, die bisherige Testinstanz unberührt. Belege:
`src-tauri/target/diagnostics/landscape-native-blend/`.

Geprüft: 334 Rust-Bibliotheksfälle bestanden, fünf bestehende Lastfälle ignoriert;
anschließend drei Landschaftsfälle auf dem finalen Backend und Clippy bestanden.
16 Ground-/Landschaftsfälle prüfen den gemeinsam verwendeten Rasterpfad.
134 Transportverträge erzeugt und gegen Rust geprüft. 167 betroffene Frontendfälle einschließlich
Transport/Interaktion sowie 21 abschließende Rendererfälle bestanden;
55 Präsentations-/Cache-/Szenefälle und ein Kachelrandfall ebenfalls. Typprüfung
besteht. Die erste vollständige Frontendsuite hatte 383 erfolgreiche Fälle;
der Vertragsbuild wartete auf den kalten Cargo-Build und wurde anschließend
gezielt erfolgreich nachgeprüft. Der Timeout wurde nicht erhöht.

Elf Browserfälle für Boden, Landschaft und bestehende dekorative Assets bestehen:
sichtbare Vorschau auf Land, Welt und Straßenzug, Welt→Nah→Welt, lokale Entfernung,
History, Abbruch, Datei und Ozeanmaskierung. Ein ergänzender Zweifall-Nachlauf prüft
bestehende dekorative Assets auf Land, mit Pixelprüfung pro Vorlage und angesehenem
Screenshot. Sechs abschließende Landschafts-/Navigationsfälle bestehen auch nach
der Rasterclip-Korrektur und Umbenennung des unverändert arbeitenden Shortcuts
in „Zur Detailansicht“. Ein weiterer Welt→Nah→Welt-Fall besteht nach der Zeichnung in
Gerätekoordinaten; neun Rendererfälle prüfen diesen bei drei Pixeldichten und großen
positiven/negativen Weltkoordinaten.
Initiale neue Testannahmen über monotone Historyrevisionen und die
Zeichenbestätigung wurden korrigiert; die Nachläufe bestätigen das Verhalten.
Belege unter `src-tauri/target/diagnostics/landscape-tool/`, `landscape/`,
`landscape-frontend/` und den zugehörigen `playwright-*/`-Verzeichnissen.

Release-/RPM-Build, Typen und Format bestehen. Nativ sind Weltmalen mit
sichtbarer Vorschau, freie Mausradnavigation bis zu Einzelbäumen, lokale Lichtung,
Undo/Redo sowie Speichern geprüft. Bodenfarbe in der Lichtung verändert keine
Landschaftsautoren. Bei nativen Kachelnähten sind die gespeicherten Halos als
Ursache ausgeschlossen: 14.784 überlappende Pixelpaare stimmen überein.
Landschaftsraster werden deshalb einschließlich Clip und Bildziel in kleinen
Gerätekoordinaten gezeichnet. Im frisch gebauten Desktopprogramm sind dieselbe
Datei und derselbe 44%-Ausschnitt jetzt nahtfrei; Pixelvergleiche bestätigen den
gleichen Grundton an früheren Nahtstellen und ihren Nachbarn. Welt→Nah per
Mausrad und erneutes Öffnen erhalten Darstellung und Autorenwerte. Dateiformat 22
ersetzt Entwicklungsformat 21 ohne Migration. Einzelobjektplatzierung, lokale
Verschiebeausnahmen, Feldumrisse und Assetimporte bleiben Folgeumfang; die
Landschaftsdeckung behauptet diese Funktionen nicht.

## Bestehender Stand und offene Abnahmen

Die bisherigen Gelände-, Material-, Wasser- und Cacheoptimierungen sind erhalten.
PR #1450 ist nach vollständiger CI einschließlich RPM auf Main integriert.
Die zeilenlokale Seenrasterung besteht die vollständige CI einschließlich RPM.
Der kombinierte Landschaftsstand einschließlich dieser Änderungen ist in PR #1454
gegen Main zusammengeführt; automatische Integration erfordert dessen vollständige CI.
Architektur und Produktvertrag beschreiben den fachlichen Stand.

Genau eine frühere Vorher-/Nachher-Reihe mit je drei Weltstrichen ist abgeschlossen:
erste sichtbare Änderung vorher 275–304 ms, danach 119–134 ms; sichtbare Bestätigung
p95 vorher 427–516 ms, danach 339–376 ms; Nachlauf vorher 259–427 ms, danach
231–345 ms. Spätere Änderungen sind darin nicht enthalten. Das Ziel p95 ≤50 ms
ist nicht belegt; keine weitere Zeitmessreihe wurde begonnen.

RPM-Installation, große Stadt-/Weltlastfälle und der umfangreiche Release-Treiber
bleiben offen. Die vollständige Landschafts-CI auf Format-22-Testbasis meldete
239 erfolgreiche Browserfälle und drei Fehler. Zwei Tests erwarteten noch die
alte Zoomsperre für Landschaft; sie prüfen jetzt die erlaubte Bearbeitung und
weiterhin gesperrte Hausbearbeitung. Der Haus-Erstgestenfall wartet nach dem
Werkzeugwechsel auf die durch das Panel geänderte Präsentation und liest erst
dann die Kartenfläche. Alle fünf betroffenen Grundstücks-/Straßenzugfälle bestehen
lokal, einschließlich erster Hausgeste und History. Der vollständige Nachlauf steht
aus. Belege: `src-tauri/target/diagnostics/landscape-integration-fixed/`.
