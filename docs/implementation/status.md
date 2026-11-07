# Aktueller Stand

Atlas V7, Dateiformat 22, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Landschaft und Darstellung

Wald, Buschland, Wiese und Felsgebiet verwenden getrennte normierte Bestandsgewichte
mit Zieldichte, lokalen Lichtungen, grober Vererbung und vollständiger History.
Boden-/Felsfarbe bleibt unabhängig. Bestehender Worker, Rasterstore, Queue und
Präsentationscache besitzen weiterhin die Arbeit; Autoren enthalten keine Bäume.

Fern erscheinen Flächenfarben, mittlerer Wald als durchgehendes Blätterdach mit
dichteabhängigen Lücken. Buschland, Wiese und Felsgebiet behalten gruppierte
Signaturen. Das optionale Kronenraster entsteht nur im mittleren Band bei Waldanteil
und teilt das bestehende Cachebudget; Autorendaten und UI bleiben unverändert.
Nahe Waldbäume sind eigene Federzeichnungen:
vier unregelmäßige Kronen, gebrochene Blattkonturen, gedeckte Grünlasuren und
größenabhängige Schraffur, orientiert an den offiziellen Canvas-of-Kings-Bildern.
Vier feste Zeichenpfade werden geteilt; Autoren und Verteilung bleiben erhalten. Der gemeinsame
Kandidatenrahmen umfasst auch die Überblendung ab 0,35 CSS-Pixeln pro Fuß.
Große Viewports behalten das Blätterdach, bis der gemeinsame Kandidatenrahmen
Einzelbäume erlaubt; Raster, Symbole und Kachelanfragen teilen diese Auswahl. Rasterziele und Clips in Gerätekoordinaten vermeiden die gefundenen
nativen Kachelnähte. Wasser maskiert Bestand, Schnee bleibt sichtbar.

Für die Landschaftsdarstellung bestehen 31 Präsentationstests einschließlich monotoner
Deckung, negativer Koordinaten, identischer Kachelhalos und Rasterwiederverwendung.
Neun Boden-/Landschafts-Browserfälle bestehen einschließlich History, Datei,
Wassermaske, freiem Weltzoom und Welt→Mittel→Nah→Welt. Die Bildprobe mit 25/65/100 Prozent Walddeckung sowie
das abschließende mittlere Kartenbild wurden visuell geprüft. Typen, Format und
frischer Release-/RPM-Build bestehen.
Boden- und Landschaftskacheln außerhalb des Viewports überspringen jetzt
Decodierung, Relief-Nachbarschaftsabgleich und Rasteraufbau. Zwei zusätzliche
Regressionen prüfen alle vier Außenrichtungen sowie Hinein-/Zurückschieben
mit Wiederverwendung der sichtbaren Raster. Ein Geräte-Pixel bleibt als Rundungsrand.
Belege: `src-tauri/target/diagnostics/landscape-canopy/` und
`src-tauri/target/diagnostics/raster-visibility/`.
Eine erneute native Bedienprüfung bleibt offen: Der verfügbare UI-Zugriff
umfasst nur Browser. Frühere native Prüfungen belegen noch die alte Zeichnung.
Das ursprüngliche Benutzertestfenster bleibt unberührt.

Leere Boden-/Landschaftskacheln übertragen keine Pixelnutzlast und erzeugen keine
Zeichenraster. Vollständig unbenutzte Ebenen überspringen Vererbung und Haloaufbau.
Zwölf Rustfälle prüfen Raster, History, Datei, Rollback und ausschließlich im Halo
vorhandene Boden-/Felspigmente. 67 Frontend-/Cache-/Loaderfälle, zehn zugehörige
Browserfälle, 134 Transportverträge, Typen, Clippy und Format bestehen.
Nativ geprüft: leere Weltkarte, Landanlage, erster Bodenauftrag mit Vorschau,
Undo/Redo, Mausradzoom und Speichern mit vollständigen Autorenkacheln.
Belege: `src-tauri/target/diagnostics/compact-empty-ground/`.

Die vorherige native Landschaftsabnahme umfasst Weltmalen, freie Navigation bis
Einzelbäumen, Lichtungen, Undo/Redo, unabhängige Bodenfarbe und Speichern/Öffnen.
14.784 Halo-Pixelpaare stimmen überein; der korrigierte native 44%-Ausschnitt ist
nahtfrei. Belege liegen auch im erhaltenen Landschafts-Worktree unter
`src-tauri/target/diagnostics/landscape-tool/` sowie im Hauptworktree unter
`src-tauri/target/diagnostics/landscape-native-blend/`. Das ursprüngliche
Benutzertestfenster bleibt unberührt.

Die Folgeänderung auf `codex/visible-terrain-raster` erweitert dieselbe
Sichtbarkeitsprüfung auf Relief-/Wasserraster und Höhenlinien. Ein gemeinsamer
Helper enthält den Rundungsrand; Höhenlinien ergänzen ihre tatsächliche halbe
Strichbreite. Unsichtbare Texturen werden nicht decodiert, vorhandene Raster
bleiben beim Zurückschieben wiederverwendbar. Alle 417 Frontendtests und Typen
bestehen, einschließlich DPR-Rand und direkter Vorschau. Alle 40 Boden-,
Landschafts-, Höhen-, Reliefpinsel- und Gewässer-Browserfälle bestehen; darunter Weltmalen
nach freiem Zoom, runde/kräuselige Küsten und Fehlererholung. Der frische
Release-/RPM-Build besteht; native Bedienung bleibt mangels UI-Zugriff offen. Diese Folgeänderung
ist vom unverändert laufenden Main-Kandidaten getrennt.
Belege: `src-tauri/target/diagnostics/terrain-visibility/`.
Die zusätzliche Landschaftsprüfung bei 3840×2160 besteht im isolierten Nachlauf;
der erste Lauf scheiterte vor dem Malen beim Laden der Karte am Fünf-Sekunden-Limit.
Das ist keine belegte Reparatur dieses Ladefehlers. Die vier bisherigen
Landschaftsfälle bestehen; mittlere Darstellung und großer Zoomübergang wurden
an den Browserbildern visuell geprüft. Die neuen Unitprüfungen sichern den
Kandidatenrahmen, positionsunabhängige Überblendung, Kronenrand und Rasterreuse.
134 Transportverträge, Typen, Format und der frische Release-/RPM-Build bestehen.
Belege: `src-tauri/target/diagnostics/landscape-capacity/`.

## Integration und offene Abnahmen

PR #1450 ist auf Main. Der vollständige Landschaftsstand einschließlich
Blätterdächern, Nahbäumen, leeren Rasterantworten und sichtbarkeitsbegrenztem
Rasteraufbau ist jetzt in PR #1456 direkt gegen Main gerichtet. Der vorherige
Zwischenbranch verursachte einen PR-Konflikt und verhinderte neue CI-Läufe.
Der konfliktfreie Mergevergleich gegen Main ergibt exakt den aktuellen Dateibaum;
keine Produktänderung wurde bei der Zusammenführung verworfen. Automatisches
Mergen der älteren Kandidaten #1451 und #1454 ist deaktiviert.

Alle 412 Frontendtests bestehen auf dem vollständigen Stand. Die gezielten
Boden-/Landschafts-Browserfälle und der frische Release-/RPM-Build sind oben belegt.
Ein älterer vollständiger Lauf (#1454, `ad75084fe`) bestand alle Rustprüfungen
und 241 von 242 Browserfällen; beim Schluchtfall überschritt der Schreibabschluss
das bestehende Fünf-Sekunden-Testlimit. Auf dem aktuellen Folgebranch bestehen
alle drei Reliefpinsel-Fälle unverändert, einschließlich Schlucht und History.
Das belegt keine Reparatur des CI-Zeitüberschreitens; die aktuelle vollständige
CI muss den exakten finalen Commit noch freigeben. Main ist noch nicht auf diesem Stand.
Belege zur Fehleranalyse: `src-tauri/target/diagnostics/canyon-ci-review/` und
`src-tauri/target/diagnostics/landscape-main-integration/`. Ältere PRs bleiben bis zur erfolgreichen Integration
erhalten. Belege: `src-tauri/target/diagnostics/landscape-main-integration/`.

Genau eine frühere Vorher-/Nachher-Reihe mit je drei Weltstrichen ist abgeschlossen:
erste sichtbare Änderung vorher 275–304 ms, danach 119–134 ms; sichtbare Bestätigung
p95 vorher 427–516 ms, danach 339–376 ms; Nachlauf vorher 259–427 ms, danach
231–345 ms. Spätere Änderungen sind darin nicht enthalten. Das Ziel p95 ≤50 ms
ist nicht belegt; keine weitere Zeitmessreihe wurde begonnen.

RPM-Installation, große Stadt-/Weltlastfälle und der umfangreiche Release-Treiber
bleiben offen. Einzelobjektplatzierung, lokale Verschiebeausnahmen, Feldumrisse
und Assetimporte bleiben Folgeumfang der Landschaftsdeckung.
