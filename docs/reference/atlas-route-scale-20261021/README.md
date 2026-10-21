# Zoomabhängige Straßen und Flüsse im Hauptatlas

Stand: 21.10.2026. Produktquelle `66f3f21ca1e6f42a15010721babc85c480f41cdc`.

Schmale Verläufe verloren in der Übersicht ihre Lesbarkeit, weil die räumlichen Bänder ausschließlich ihre gespeicherte Meterbreite verwendeten. [Vorher](before-regional.png) und [nachher](after-regional.png) zeigen dieselben vier Verläufe im normalen Kampagnenatlas. Die native Probe zoomt von 12 km auf 328 m Ausschnittbreite und [neigt anschließend dieselbe Kamera](after-tilted.png). Die flache Testlandschaft isoliert die Linien; sie ist keine vollständige Kartengestaltungsabnahme.

`terrain-route-display.ts` ergänzt eine 1,4 logische Pixel breite Mittellinie. Sie blendet zwischen 0,75 und 1,75 projizierten Pixeln in die vorhandenen maßhaltigen Bänder über. Sichtbarkeit folgt einem weichen Übergang um die gemeinsame Straßen-/Flussschwelle. Ausgewählte oder konfliktbehaftete Verläufe bleiben sichtbar. GPU-Materialien berechnen die Breite und Deckkraft bei jeder Kamerazeichnung; dafür sind weder neue SQL-Abfragen noch neu erzeugte Geometrie nötig. Unterschiedliche Breiten teilen denselben Shader. Tunnelunterbrechungen, Brücken-/Wasserhöhen und ursprüngliche Objekt-IDs bleiben erhalten. Verdeckte oder ausgeblendete Linien blockieren keine Geländetreffer.

`terrain-route-clip.ts` begrenzt die Unterteilung langer Verläufe auf den geladenen Geländeausschnitt mit Breitenrand. Originale Streckenparameter erhalten Strichmuster und Verjüngung. Ein Zwei-Millionen-Meter-Verlauf wird in der 200-m-Testfläche mit weniger als 1000 Höhenabfragen dargestellt; seine Autorenpunkte bleiben unverändert.

## Nachweise

- [19 gezielte Tests](tests.log): weiche Übergänge, Treffer am sichtbaren Linienrand, unsichtbare Linien, Tunnel, geteilte Shader, begrenzte Höhenabfragen sowie bestehende Trassen-, Speicher- und Ausgabeprüfungen.
- [Native Zoomprobe](after-result.json), Quelle oben: normaler Kampagnen-/Atlas-Einstieg, derselbe Canvas über Zoom und Neigung, Auswahl des schmalen Waldwegs 0,45 logische Pixel neben seiner Mittellinie und unveränderte Autorenrecords. Keine Rendererfehler; Prozess beendet sich mit Exit 0 und bestätigter PID-Abwesenheit. `dirty: true` umfasst die vorhandenen ungetrackten historischen Belegordner; die Produktänderung war committed.
- Die ergänzende GPU-Probe misst bei DPR 1 und 2 für eine 2-m-Straße bei 4 m/Pixel rund 1,498 Pixel Farbdeckung. Bei 0,25 m/Pixel bleibt die maßhaltige Breite 8 Pixel; bei 32 m/Pixel ist sie unsichtbar und nicht auswählbar. Die geteilte Bildausgabe stimmt pixelgenau mit der vollständigen Ausgabe überein. Dies ist eine isolierte Rendererprüfung innerhalb des nativen Prozesses, kein Leistungstest.
- [Vorherige native Quelle](before-result.json): `df10ade64d8f57b2cd35e1139d8c995b752fc2ba`; gleicher normaler Atlasablauf ohne die zusätzlichen neuen Auswahl-/GPU-Assertions.

- [Bestehender nativer Trassenablauf](route-workflow-result.json), gleiche Produktquelle: sieben abgeschlossene Schritte einschließlich Straßen-/Flussplanung, Einheitenwechsel bei 200 %, Schutzwechsel, Löschen/Undo, Geländepinsel mit Profilrücknahme und frischem Prozess. [Planung auf der Hauptkamera](route-planning.png). Beide Prozesse endeten normal mit Exit 0 und bestätigter PID-Abwesenheit; keine Rendererfehler.

- [Wörtlicher Repository-Entwicklungsstart](repository-result.json): `npm run start:desktop` öffnet den normalen Atlas; Zoom während der Farbverfeinerung, Neigen/Drehen derselben Hauptkamera, GPU-Höhenlinien sowie Grafikverlust/Fallback/Wiederanlauf bestehen. [Geneigter Repository-Atlas](repository-atlas.png). Quelle und Main-/Preload-/Renderer-/HTML-Hashes stimmen mit der Zoomprobe überein. Normaler Exit 0, PID abwesend, keine Rendererfehler.

- App-/Desktop-Typprüfung, Repositoryprüfung, Desktopbuild und `git diff --check` bestanden; Logs liegen neben diesem Beleg.

## Grenzen

Die neue Regel betrifft die im Renderer gehaltenen Vektorverläufe. Bei hoher Objektdichte rasterisierte Verläufe benötigen noch eine gemeinsame Übergangspolitik. Maßstabsabhängige Namen, Bewuchs, andere Objektklassen und weltweite Geometrie-LOD bleiben offen. Die Bilder zeigen außerdem den noch zu knappen Geländekontext am oberen Rand bei starker Neigung. Keine vollständige Zoom-/Latenzabnahme, Candidate-CI, Main-Integration, Paket-, Installations- oder Nutzerabnahme.
