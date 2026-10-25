# Atlas: Architekturprüfung vor der Performancearbeit

Status: Reviewed; lesende Prüfung und gezielte In-Memory-Reproduktionen, Fixes offen.
Owner: atlas
Last Reviewed: 2026-10-25
Source of Truth: Begründung des vorgeschalteten Meilensteins A0; keine Implementierungs- oder vollständige Sicherheitsabnahme.

## Urteil

**Mit benannten Korrektheitsfixes als Arbeitsgrundlage akzeptabel.** Die vorhandene
Trennung von Eingabebesitzer, Präsentation, GPU-Ressourcen, kanonischem Store-Worker
und eingeschränkter Preload-Brücke trägt die Weiterarbeit. Ein zusätzlicher
Komplettumbau ist durch diese Prüfung nicht begründet. Ungeklärte Speicherantworten,
Frameberechtigung und Lebenszyklus müssen vor der langen Leistungsqualifikation
verlässlich behandelt werden.

Geprüft wurden Renderer-/UI-Besitzer und Speicher-/Host-/Ausgabegrenzen durch zwei
unabhängige Agenten ohne gemeinsamen Chatkontext. Das ist eine Codeprüfung mit
konkreten Triggern, keine Behauptung fehlerfreier Gesamtlaufzeit. Die bestehenden
A3/A4-Pakete behandeln Ressourcenwiederverwendung und Skalierung; diese Befunde
werden nicht als zweite allgemeine Refaktorierung dupliziert.

## Belegte Befunde und eingeplante Fixes

| Befund | Trigger und Auswirkung | Codeeinstieg | Fix / spätere Regression |
| --- | --- | --- | --- |
| CPU-Auswahl umgeht bestätigten GPU-Frame | Kamera/Szene geändert oder Kontext verloren; Treffer/Autorenstart können eine andere Szene als das sichtbare Bild verwenden | `src/app/atlas-raster-presentation.ts` (`hitAt`, `authorPoint`), `src/app/atlas-canvas.ts`, `src/app/atlas-deck-surface.ts` (`frameUsable`) | A0.01; A3.08/A3.09 |
| Erstinitialisierung bleibt nach Fehler ohne funktionsfähigen Retry | Surface-Erzeugung scheitert; `openSurface` registriert danach einen unbeendeten Waiter, `recover` beendet sich bei fehlender Surface | `src/app/atlas-raster-presentation.ts` (`setActive`, `openSurface`, `recover`) | A0.02; A3.11 |
| Transparente Bildlöcher blockieren Auswahl | Normales Bildkommando liefert keine Alpha-Trefferdaten, obwohl der Trefferpfad sie unterstützt; unsichtbares Rechteck trifft | `src/app/atlas-drawing-geometry.ts`, `src/app/atlas-deck-drawing.ts` | A0.03; A3.09/A7.04 |
| Exportabbruch beendet Editor-Nachladung | Editor-Terrain und Export teilen einen Lesedienst; Export-Cancel terminiert den gesamten Dienst und Editor behandelt das als Fehler | `desktop/main.ts` (`atlas:terrain-tile`, `atlas:material-tile`, `atlas:region-cancel`), `src/app/atlas-output.ts` | A0.04; A6.05/A7.11 |
| Graphbarriere wird nach asynchronem Quellenlesen nicht erneut geprüft | Graphwechsel beginnt während `await atlasRegionSource`; Terrain-Projektion startet trotzdem | `desktop/main.ts` (`atlas:terrain-projection`) | A0.05; A6.05 |
| Unbekannter Schreibausgang wird zu gewöhnlicher Ablehnung | Store-Worker-Antwortverlust wird im generischen Main-Catch in `{ok:false,error}` umgewandelt; Autorenbesitzer behält Command nur bei Promise-Rejection | `desktop/store-client.ts`, `desktop/main.ts` (`handle`), `src/app/campaign-atlas-author.ts` | A0.06/A0.07; A5.06 |
| Reise behandelt empfangenen Fehler als geklärten Ausgang | `acknowledged` wird vor Prüfung eines typisierten unbekannten Resultats gesetzt; Recoverykennung kann fehlen | `src/app/atlas-journey.ts` | A0.08; A7.07 |
| Postcommit-Leseprojektion kann gespeicherten Auftrag als gewöhnlichen Fehler melden | Atlas-/Drawing-/Room-Commit gelingt, anschließendes Lesen der Kampagnen-/Inventar-/RoomCommit-Projektion scheitert | `src/app/storage/store.ts` (`executeAtlasCommit`, Drawing-Commit, `atlasRoomCommit` mit nachgelagertem `edit`) | A0.09; A5.06/A7.08 |
| Erwarteter Hoststopp wird als Ladefehler protokolliert | Normales Schließen bei laufender Terrainanfrage; 200%-Pinselprobe endet fehlerhaft | Ausgangsmessung und `src/app/atlas-raster-presentation.ts` | A0.10; A7.14 |

## Grenzen und nächste Entscheidung

Bei Schreibfehlern muss die Umsetzung definitiv abgelehnt, unbekannt und bestätigt
unterscheiden; fehlende Workerbereitschaft ist nicht automatisch Beweis eines
erfolgten Commits. Receipt-Klärung behält dieselbe Command-ID und wiederholt keinen
Writer. Nicht betroffene Produktbereiche erhalten keinen vorsorglichen Umbau.

Die [A0-Pakete](a0-foundation.md) schließen jeweils ihren Befund mit einem Test auf
dem echten Produktionsanschluss. Nach A0 prüft ein unabhängiges Review die Fixes
und die Annahme „tragfähige Grundlage“ erneut. Neue konkrete Befunde führen zu
benannten Zusatzpaketen und einer aktualisierten Timeline, nicht zu stillen
Ausnahmen von den Abnahmekriterien.

Der zunächst vermutete zusätzliche Fehlerpfad über gewöhnliche Fehler in
`playerDisplay.sync()` wurde verworfen: Der Besitzer fängt diese bereits selbst.
A0.09 behandelt ausschließlich den belegten Postcommit-Lesepfad im Store.
