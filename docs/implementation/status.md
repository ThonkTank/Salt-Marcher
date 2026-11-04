# Aktueller Stand

Atlas V7, Dateiformat 11 und Generierungsrezept 3. Stadtansicht als **erster
Prototyp**; auf Wunsch des Nutzers am 4. November 2026 ohne weitere
Leistungsoptimierung abgeschlossen.

[README](../../README.md): Einrichtung und Abnahme;
[Architektur](../architecture.md): Zuständigkeiten;
[Produktvertrag](../product-contract.md): Verhalten und Grenzen.

## Implementiert

- Weltverankerte Übersichtskacheln und transaktionale Bebauungsdichtepyramide.
  Übersicht lädt keine Innenraumzellen; begrenzte Geometrie-/Namenskandidaten
  ergänzen die Dichte. Revisionsgebundener Kachelcache mit 64-MiB-Budget.
- Erweiterter Außenzoom, vereinfachte Darstellung, Navigation in der Übersicht
  und ausdrückliches Hineinzoomen zur exakten Bearbeitung. Überladene exakte
  Ausschnitte werden abgelehnt, nicht still gekürzt.
- Straßen- und Gebäudenamen mit Bildschirmgrößen, Prioritäten,
  Kollisionsprüfung, Kurvenausrichtung und stabilen Ankern.
- „Wichtiger Ort“ als Gebäudeeigenschaft mit Queue, Undo/Redo und Speicherung.
  Format 11 ohne Migration; vorhandene Arbeitsänderungen erhalten.

## Prüfstand und Grenzen

Abschließender Nachlauf: beide Stadt-Browsertests, drei Rust-Stadttests,
Clippy und Formatprüfung bestanden. Insgesamt sind damit 155 unterschiedliche
Browsertests erfolgreich geprüft.

Der Gesamtlauf bestand Transportabgleich, Typprüfung, 175 TypeScript-Tests,
204 Rust-Tests, Clippy, Formatprüfung und Webbuild. 154 Browsertests bestanden;
ein neuer Checkbox-Test prüfte zu früh vor der asynchronen Bestätigung und wurde
auf den bestätigten Zustand umgestellt. Gezielt nachgeprüfte Stadt-/Loader-Tests
bestehen einschließlich eines zusätzlichen A→B→A-Tests (11 Tests im Nachlauf).
Die abschließenden Funktionsnachläufe stehen im unten genannten Diagnoseverzeichnis.

Reproduzierbare Teststädte mit 100.000 und 250.000 Gebäuden erzeugt. Die ersten
Backendmessungen der Bebauungsübersicht lagen bei etwa 2–3 ms / 4 KB und
4–7 ms / 10 KB; Debug-Aufbau der Arbeitsdaten etwa 72 beziehungsweise 201 s.
Für die Browserprüfung wurden Straßen und Wasser ergänzt.

Browsermessung bei 1440 × 960 mit 100.000 Gebäuden: Öffnen etwa 162 s,
erste Gesamtansicht 2,6 s, Verschieben im 95. Perzentil 16,8 ms. Das Ziel unter
33 ms beim Verschieben wurde erreicht; die erste Übersicht verfehlt noch das
Ein-Sekunden-Ziel. Der Browserlauf mit 250.000 Gebäuden wurde beim Abschluss als
Prototyp abgebrochen. Keine neue native Desktopabnahme oder Paketierung.

Nächster sinnvoller Ausbau: Fit-/Übersichtsabfragen optimieren (Abfrageplan kann
noch den gesamten Gebäudeindex durchlaufen), Öffnungszeit senken, Beschriftungen
auch gegenüber Karten-Bedienhinweisen freihalten und dichte Ansichten visuell
verfeinern. Danach 250.000er-Browserabnahme und native Linux-/DPR-Prüfung.
Die Bebauungsdichte nutzt Dach-Bounds-Flächen und Mittelpunkte, keine exakten
zusammengeführten Gebäudeumrisse. Bei hoher Dichte bleiben Einzelgeometrien und
Namen begrenzt; der Prototyp ist keine vollständige kartografische Generalisierung.

Belege: `src-tauri/target/diagnostics/city-2026-11-04/`;
Browserberichte unter `src-tauri/target/diagnostics/playwright-2026-11-04T14-26-09-204Z-678781/`
und `src-tauri/target/diagnostics/playwright-2026-11-04T14-29-09-893Z-682923/`.
