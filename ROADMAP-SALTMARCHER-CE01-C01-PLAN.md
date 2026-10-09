# CE-01-C01 – begrenztes Katalog-Aufräumen

Stand: 9. Oktober 2026. Dieser eigene Planlauf folgt auf den unabhängig
reviewten automatisierten Real-Host-Umfang von `CE-01-H01`. Dessen exakter
Produktstand ist Commit `aa6d92d6cb1d8c8e06a0a61233ad837d25e40c05`,
`main.js` SHA-256
`3a383cbc8853133e4d55af388c86ec70e93230cee8dffc32ba35cf0676f3cdad`.
Der aktuelle gemeinsame Dokumentationsstand bei Planbeginn ist
`c00bd417c6cb8c65d303fc7765e7b3b393405eab`. Dieser Plan ändert keinen
Produktcode und nimmt CE-01 nicht vollständig ab.

## Konkrete Schwächen und Grenzen

1. **Wiederherstellungsregeln sind mehrfach ausgedrückt.**
   `CreatureCatalogViewContent` setzt Name/aufsteigend/Seite 0 selbst und
   ergänzt sieben Draftwerte einzeln. `creature-catalog-view-state.ts` kennt
   dieselbe Draft-Zuordnung bereits für Übernahme und Reset. Der H01-Lauf hat
   einen echten Driftfehler gefunden: normalisierte `undefined`-Werte
   überschrieben die expliziten Sortier-, Richtungs- und Seitendefaults, sodass
   Query und sichtbares `aria-sort` auseinanderliefen. Die Reparatur ist
   korrekt, ihre Regeln bleiben aber dupliziert.
2. **Reset und Restore können bei neuen Textfiltern getrennt altern.** Die
   Draftliste ist in `DRAFT_FILTERS`, im View-Restore und im Reset jeweils
   manuell ausformuliert. Ein späterer Filter kann dadurch in Query, Draft,
   Persistenz oder Reset fehlen, obwohl die übrigen Pfade kompilieren.
3. **Der H01-Szenarioeingang erhält eine ungenutzte Abhängigkeit.**
   `tools/host/ce01-catalog.cjs` destrukturiert `crypto`, verwendet es aber
   nicht. Das ist ein kleiner Host-Harness-Befund, keine Produktabweichung.
   Baseline-Datei, Lifecycle-Receipt und alle drei H01-Szenarien bleiben nötig,
   solange physische und weitere Hostabnahmen offen sind.

## C01-I01 – begrenzte Umsetzung

1. In `src/features/catalog/creature-catalog-view-state.ts` entsteht genau ein
   hostneutraler Restore-Helfer. Er normalisiert fremden Zustand, setzt die
   verbindlichen Defaults `sort: "name"`, `direction: "asc"`, `page: 0` und
   leitet jeden fehlenden Draft über die bestehende `DRAFT_FILTERS`-Zuordnung
   vom akzeptierten Filterwert ab. Ein ausdrücklich gespeicherter leerer Draft
   bleibt leer und darf nicht durch den veröffentlichten Filter ersetzt werden.
2. Konstruktor und `setState()` von
   `src/features/catalog/creature-catalog-view-content.ts` benutzen nur diesen
   Helfer. Query-, Chip-, Reset-, Scroll-, Paging- und ARIA-Semantik ändern sich
   nicht. Es wird keine allgemeine View-Abstraktion und kein breiter Umbau der
   derzeit großen Content-Klasse eingeführt.
3. Gezielte Zustandsprüfungen decken leeren Zustand, gültige Nichtdefaults,
   jeden Textfilter mit fehlendem Draft, ausdrücklich leere Drafts sowie
   ungültige Sortier-/Richtungs-/Seitenwerte ab. Der DOM-Harness bestätigt für
   den leeren Restore weiterhin `aria-sort="ascending"`, Seite 0 und sichtbare
   Defaultsortierung.
4. Aus `tools/host/ce01-catalog.cjs` wird ausschließlich der ungenutzte
   `crypto`-Parameter entfernt. H01-Runner, Baseline, Screenshots,
   Prozess-Lifecycle und Fault-Szenario bleiben wiederholbar erhalten; frühere
   Belege werden nicht umgeschrieben.

Begrenzt betroffene Dateien sind
`src/features/catalog/creature-catalog-view-state.ts`,
`src/features/catalog/creature-catalog-view-content.ts`, die zugehörigen
Zustands-/DOM-Tests, `tools/host/ce01-catalog.cjs` sowie nach Abschluss die
vorhandenen Checkpoint-/Acceptance-Einträge. Andere Katalogfunktionen,
Encounter, Atlas, City, Dungeon und die Plattformprototypen bleiben unberührt.

## Prüfung und exakter Hostnachweis

Die Umsetzung muss `npm run check`, `npm test` und `npm run build` bestehen.
Weil sie produktive Restore-Logik berührt, genügt ein unveränderter
Funktionstest nicht: Auf dem exakten sauberen C01-Kandidaten werden die drei
automatisierten H01-Folgen Edit, frischer Prozess/Reopen und beschädigtes Asset
erneut ausgeführt. Buildidentität, Prozess-Lifecycle, Defaults, Filter-/Detail-
Zustand und beide Layoutgrößen werden an diesen einen Kandidaten gebunden.

Playwright-Eingaben werden weiterhin nicht als physische Tastatur-/Mausabnahme
ausgegeben. Screenreader und nicht geprüfte Plattformen bleiben offen. Der
Runner wird erst nach diesen offenen Abnahmen oder einem ausdrücklich
versionierten Ersatz entfernt.

## C01-R01 – eigener Review und Abschluss

Ein getrennter unabhängiger Lauf liest Plan, Diff, Restore-Matrix, DOM-Test,
Buildinventar und die neuen Real-Host-Receipts. Er prüft insbesondere, dass
leere Drafts erhalten bleiben, alle sieben Textfilter dieselbe Zuordnung nutzen,
keine Defaultsemantik im Content dupliziert bleibt und der Harness nur um die
ungenutzte Abhängigkeit kleiner wurde. Pflichtbefunde führen zu einem eigenen
Nachbesserungs- und erneuten Reviewlauf.

Erst der bestandene C01-R01 schließt das CE-01-Aufräumtor. CE-01 selbst bleibt
bis zu den noch offenen physischen, Screenreader- und Plattformabnahmen ohne
vollständige Fachfreigabe. CE-02 darf geplant, aber gemäß der bestehenden
Roadmap erst nach dem bestandenen Aufräumreview implementiert werden.
