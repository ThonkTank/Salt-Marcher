# Aktueller Stand

Stand: 9. November 2026. Atlas V7 bleibt der reguläre Produkteinstieg mit
Dateiformat 22; der optionale Electron-/Pixi-Höheneditor verwendet Format 24.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten und [Produktvertrag](../product-contract.md) Verhalten und Grenzen.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.

## Ergebnis und Auftragsgrenze

Der beauftragte Strukturschnitt ist implementiert. Vier Besitzer bündeln das
Dokument, die Eingabe, die Darstellung und die Projektsitzung. Ein gemeinsames
Journal ersetzt doppelte Schreibwarteschlangen. Die laufende GPU-Komposition
verwendet einen festen numerischen Ausgangsstand plus die aktuelle lokale
Autoränderung. Quellen, Uploads und Dirty-Rechtecke bleiben lokal; eine nicht
blockierende GPU-Fence begrenzt ausstehende Arbeit.

Die zusammengeführte Implementierung befindet sich in der abschließenden
Verifikation. Frühere Performancezahlen belegen noch nicht diesen Stand. Die
unveränderten langen 512-Pixel-Fälle und die begrenzte Grafikmatrix werden auf
dem sauberen Build erneut ausgeführt; Ergebnisse ersetzen diesen Zwischenstand.

**P0 bleibt nicht freigegeben.** Hier fehlen ein natives Display und
Hardwaregrafik. Zusätzlich ist die Zuordnung einer Terrainrevision zur ersten
tatsächlichen Präsentation noch nicht bewiesen. Eine GPU-Fence löst die
Rückkopplung im Editor, aber nicht diese Messaufgabe. Der vollständige
Atlas-Neubau und das spätere gemischte Landschafts-/Hausbeispiel behalten ihr
bestehendes natives P0-Gate.

## Implementierter Stand

- `EditorDocument` besitzt Autoren, History und das geordnete Journal. Unveränderte
  Before-/After-Snapshots werden zwischen History und Pending-Eintrag geteilt;
  Bestätigungen gelten nur für den ältesten exakt passenden Eintrag.
- `EditorController` hält Eingabe und jeweils einen aktuellen Quellenbedarf mit
  einem Lesezustand. `ProjectSession` besitzt die Schreibpumpe, Projektmetadaten,
  Dateivorgänge und Wiederherstellung. Status wird aus diesen Besitzern abgeleitet.
- `HeightField` bewahrt die unbegrenzte numerische Summe, ergänzt die Differenz
  zwischen aktuellem Autor und Gestenbeginn und färbt geänderte Rechtecke neu.
  Kalte oder numerisch ungeeignete Kacheln verwenden die kanonische Rekonstruktion;
  begrenzte Ankerwechsel verhindern unbegrenzte Fortschreibung.
- `WorldRenderer` trennt CPU-Submit und abgeschlossene GPU-Arbeit. Eine ausstehende
  Fence erlaubt keinen zweiten Draw. Eingaben prüfen ihre lokale fertige Grundlage;
  identische oder entfernte Leseergebnisse invalidieren sie nicht pauschal.
- Der Auswerter interpretiert Falldaten einmal pro Bericht und verwendet dieselben
  Fakten für Teil- und Gesamtergebnisse. Fehlende, doppelte oder unzugeordnete
  Evidenz bleibt ein Fehler; Scope-Auswahl verkleinert die native Abnahme nicht.
- Halten, langsam/stärker, tatsächliche Kurven, maximal 50 ms Dosis, Überlastabwurf,
  kurze freigegebene Klicks und der gemeinsame Undo-/Speicherabschluss bleiben
  Pflichtverhalten. Kein Zeitlimit und keine Pinselgröße wurde gelockert.

## Prüfung und Belege

Die endgültigen Ergebnisse werden nach der gemeinsamen Verifikation hier
zusammengefasst. Explorative Belege sowie der Vergleich mit dem vorigen Stand
liegen unter `src-tauri/target/diagnostics/structure-20261109/` und
`src-tauri/target/diagnostics/structure-evaluator/`. Sie sind keine native Freigabe.

Der erforderliche Repositoryjob bleibt **Candidate · exact-SHA aggregate** für
den veröffentlichten Head. Installierte RPM-Bedienabnahme, qualifizierte
Hardwaremessung und native Leistungsfreigabe bleiben offen.
