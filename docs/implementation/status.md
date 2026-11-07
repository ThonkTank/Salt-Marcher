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
Kandidatenrahmen umfasst auch die Überblendung zwischen 0,35 und 0,5 CSS-Pixeln
pro Fuß. Rasterziele und Clips in Gerätekoordinaten vermeiden die gefundenen
nativen Kachelnähte. Wasser maskiert Bestand, Schnee bleibt sichtbar.

Für die Blätterdächer bestehen 29 Präsentationstests einschließlich monotoner
Deckung, negativer Koordinaten, identischer Kachelhalos und Rasterwiederverwendung.
Vier Landschafts-Browserfälle bestehen einschließlich History, Datei, Wassermaske
und Welt→Mittel→Nah→Welt. Die Bildprobe mit 25/65/100 Prozent Walddeckung sowie
das abschließende mittlere Kartenbild wurden visuell geprüft. Typen, Format und
frischer Release-/RPM-Build bestehen. Der erste Buildversuch wurde per SIGTERM
beendet; nach bestätigtem Prozessende bestand der erneute Build.
Belege: `src-tauri/target/diagnostics/landscape-canopy/`.
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

## Integration und offene Abnahmen

PR #1450 ist auf Main. Die Seenrasterung besteht die vollständige CI einschließlich
RPM. Der kombinierte Landschaftsstand in PR #1454 wartet auf vollständige CI;
Leerkachel- und Signaturänderungen sind Folgeänderungen. Der erste vollständige
Landschaftslauf auf Format-22-Testbasis meldete 239 erfolgreiche Browserfälle
und drei Fehler. Die veralteten Landschafts-Zoomsperren sind nun durch Prüfungen
der erlaubten Bearbeitung ersetzt. Der Haus-Erstgestenfall wartet nach dem
Werkzeugwechsel auf die geänderte Präsentation. Alle fünf betroffenen
Grundstücks-/Straßenzugfälle bestehen lokal; die Korrektur ist in Main-Kandidat
und Folgeänderungen enthalten. Die vollständigen CI-Nachläufe stehen aus.
Belege: `src-tauri/target/diagnostics/landscape-integration-fixed/`.

Genau eine frühere Vorher-/Nachher-Reihe mit je drei Weltstrichen ist abgeschlossen:
erste sichtbare Änderung vorher 275–304 ms, danach 119–134 ms; sichtbare Bestätigung
p95 vorher 427–516 ms, danach 339–376 ms; Nachlauf vorher 259–427 ms, danach
231–345 ms. Spätere Änderungen sind darin nicht enthalten. Das Ziel p95 ≤50 ms
ist nicht belegt; keine weitere Zeitmessreihe wurde begonnen.

RPM-Installation, große Stadt-/Weltlastfälle und der umfangreiche Release-Treiber
bleiben offen. Einzelobjektplatzierung, lokale Verschiebeausnahmen, Feldumrisse
und Assetimporte bleiben Folgeumfang der Landschaftsdeckung.
