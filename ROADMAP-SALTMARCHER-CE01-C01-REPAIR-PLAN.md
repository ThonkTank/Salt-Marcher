# CE-01-C01-N01 – Nachbesserung der Draft-Zuordnung

Stand: 9. Oktober 2026. Dieser eigene Nachbesserungsplan folgt auf den
unabhängigen Cleanup-Review des exakten Produktkandidaten
`5759cc9b3b2f016849f3e8325e0f7effe59edc2b`. Der Kandidat bestand Check,
246/246 Tests, Build und alle drei automatisierten echten Obsidian-Läufe. Der
Review behält diese Nachweise, schließt das Aufräumtor aber wegen eines
Pflichtbefunds nicht.

## Pflichtbefund C01-R01-1

`CREATURE_CATALOG_DRAFT_FILTERS` besitzt Restore, Apply und Reset, aber
`CreatureCatalogViewContent` übergibt für Bewegung, Sinne, Verwundbarkeit,
Resistenz, Immunität und Zustandsimmunität weiterhin je einen manuell genannten
Draftschlüssel an `textFilterInput()`. Die Namenssuche besitzt zusätzlich den
separaten Pfad `searchInput()`/`publishSearch()`. Damit existiert außerhalb der
kanonischen Zuordnung weiterhin Wissen über alle sieben Filter-/Draftpaare. Ein
neuer Textfilter könnte Restore/Reset und Content getrennt ändern und erneut
driften.

## C01-N01 – begrenzte Umsetzung

1. `creature-catalog-view-state.ts` stellt eine totale hostneutrale Abfrage
   bereit, die für einen `CreatureCatalogTextFilter` den Draftschlüssel allein
   aus `CREATURE_CATALOG_DRAFT_FILTERS` liefert. Es entsteht keine zweite
   Record- oder Switch-Zuordnung.
2. `CreatureCatalogViewContent.textFilterInput()` erhält nur noch Label,
   Fokusschlüssel und Textfilter. Es ermittelt den Draftschlüssel über diese
   Abfrage. Die Namenssuche benutzt denselben Eingabe-/Debounce-/Enter-Pfad;
   lediglich ihr bestehender Placeholder `Name suchen` und ihr ARIA-Label
   `Monstername suchen` bleiben erhalten.
3. `searchInput()` und `publishSearch()` sowie alle manuell übergebenen
   `*Draft`-Argumente entfallen. Filterlabels, Fokuskeys, 200-ms-Debounce,
   Enter-Flush, Query, Chips, Reset, Auswahl, Scroll und Persistenz bleiben
   unverändert.
4. Gezielte Kern- und DOM-Prüfungen laufen über alle sieben Einträge der
   kanonischen Zuordnung. Sie belegen Draftanzeige, Veröffentlichung und Reset,
   ohne eine zweite unabhängige Filter-/Draftliste einzuführen. Die bestehende
   Prüfung für einen ausdrücklich leeren Namensdraft bleibt grün.

Betroffen sind ausschließlich
`src/features/catalog/creature-catalog-view-state.ts`,
`src/features/catalog/creature-catalog-view-content.ts` und die zugehörigen
Kern-/DOM-Tests sowie anschließend die bestehenden CE-01-Metadaten. Der
Hostrunner selbst, andere Katalogfunktionen und fremde Produktbereiche bleiben
unverändert.

## Prüfung und Re-Review

`npm run check`, `npm test` und `npm run build` müssen auf einem sauberen
Kandidaten bestehen. Da produktive Content-Logik berührt wird, laufen Edit,
frischer Prozess/Reopen und beschädigte Payload/Retry erneut in echten
isolierten Obsidian-Prozessen auf genau diesem Kandidaten. Der darauffolgende
unabhängige Read-only-Re-Review prüft insbesondere, dass außerhalb
`CREATURE_CATALOG_DRAFT_FILTERS` keine Filter-/Draftpaar-Zuordnung verbleibt und
alle früheren C01-Gates grün bleiben.

Physische Tastatur/Maus, Screenreader und weitere Plattformen bleiben offen.
CE-01 und das C01-Aufräumtor werden aus diesem Plan nicht freigegeben.

Der unabhängige Read-only-Planreview auf `9bbacb5` bestätigte den Umfang ohne
Pflichtbefund: eine einzige Paarquelle, gemeinsamer Input-/Debounce-/Enter-Pfad,
erhaltene Name-UX, gezielte Matrix und erneute exakte Hostläufe. C01-N01 darf
damit beginnen.

## C01-N01 – Ergebnis

Die Nachbesserung ist auf dem exakten sauberen Commit
`c1582b384acbc5025ad529c17e664bc5fb04ef8f` abgeschlossen. Alle sieben
Textfilter beziehen ihren Draftschlüssel über
`creatureCatalogDraftKeyForFilter()` aus `CREATURE_CATALOG_DRAFT_FILTERS`;
Namenssuche und übrige Filter verwenden denselben Contentpfad. Der bestehende
Name-Placeholder, das ARIA-Label, Fokus, Debounce und Enter bleiben erhalten.

`npm run check`, 247/247 Tests und `npm run build` bestanden. `main.js` ist
1.338.655 Byte groß, liegt mit 149.285 Byte Wachstum unter dem Limit und hat
SHA-256 `9ea37b4c8942ce1df4739e3f7786dde8fd62fbec227198023f85fa61275a63d3`.
Die drei automatisierten echten Obsidian-Läufe bestanden auf exakt diesem
Commit und Build:

- `/home/aaron/.cache/dungeon-native-qa/evidence/1791559080712-ce01-catalog-edit`
- `/home/aaron/.cache/dungeon-native-qa/evidence/1791559092369-ce01-catalog-reopen`
- `/home/aaron/.cache/dungeon-native-qa/evidence/1791559102197-ce01-catalog-damaged-edit`

Alle drei Prozesse besitzen eigene Unit, Invocation-ID und Prozessidentität,
endeten normal mit Status 0 und ohne erzwungene Terminierung. Der unabhängige
Re-Review bleibt offen; ebenso physische Eingabe, Screenreader und weitere
Plattformen.
