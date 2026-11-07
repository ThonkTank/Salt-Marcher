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
Der Produktbaum der zeilenlokalen Seenrasterung besteht ebenfalls die vollständige
CI einschließlich RPM. Beim unveränderten Produktbaum auf der aktuellen Main-Basis
scheiterte ein zweiter Lauf an einem einzelnen fünfsekündigen Canyon-Write-Timeout
(237 Browserfälle bestanden); ein unveränderter Nachlauf ist gestartet. Integration
läuft separat über PR #1451. Architektur und Produktvertrag beschreiben den fachlichen Stand.

Genau eine frühere Vorher-/Nachher-Reihe mit je drei Weltstrichen ist abgeschlossen:
erste sichtbare Änderung vorher 275–304 ms, danach 119–134 ms; sichtbare Bestätigung
p95 vorher 427–516 ms, danach 339–376 ms; Nachlauf vorher 259–427 ms, danach
231–345 ms. Spätere Änderungen sind darin nicht enthalten. Das Ziel p95 ≤50 ms
ist nicht belegt; keine weitere Zeitmessreihe wurde begonnen.

RPM-Installation, große Stadt-/Weltlastfälle und der umfangreiche Release-Treiber
bleiben offen. Die vollständige CI des neuen Landschaftsstandes steht aus. Ihr erster Lauf
meldete eine verbliebene Format-21-Erwartung im Parzellen-Integrationstest.
Die Erwartung entspricht nun Format 22; alle elf Parzellenfälle bestehen lokal.
