# Erklärbare Kampagnenhistorie und Chronik

Stand: 13.10.2026. Verbindlicher Gesamtumfang: [SCOPE](../../SCOPE.md),
[Campaign/Data](../../../ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md)
und [Gesamtportfolio](../../../ROADMAP-SALTMARCHER-REPLACEMENT.md).
Die Chronikanzeige ist ein Zugang zur Historie; sie ersetzt deren Fachvertrag nicht.

## Quelle und Ziel

Die gepinnten Program Capabilities, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, Abschnitte
„Corrections And History“ (L530–535) und „Explanatory Campaign History“
(L887–904), verlangen bestätigte Zeit-, Reise-, Encounter-, XP-, Party-, NPC-,
Stock- und Korrekturfolgen. Eine Korrektur hängt einen verknüpften Eintrag an;
frühere Fakten bleiben erhalten. Rückdatierte Weltzeit und späterer Zeitpunkt
am Spieltisch sind getrennt. Reise-Undo und ausdrückliche Löschung besitzen
enge eigene Regeln. Das Quellenregister bindet die Datei an SHA256
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`;
der lokale Quellenstand wurde damit verglichen.

## Aktueller Anschluss und Korrektur

`src/app/storage/chronicle.ts` kombiniert bestätigte `progress_event`- und
`world_history`-Records in einer Lesetransaktion. `chronicle-contracts.ts`,
Main/preload und `chronicle-ui.ts` bieten Kategorien, Textfilter und Markdown.
Der aktuelle Ausschnitt liest je Quelle höchstens 2001 relevante Records und
zeigt höchstens 2000 zusammengefasste Einträge. Das ist keine vollständige
Historiennavigation oder vollständige Exportqualifikation.

Drei Gegenproben fanden zwei zusammenhängende Fehler: 2500 interne Statusrecords
verdrängten einen älteren sichtbaren XP-Eintrag aus dem Rohfenster; 2002
zusammengefasste Awardrecords meldeten den verbliebenen Eintrag als vollständig;
ein gekürzter Markdownexport trug keinen Hinweis. Der Reader filtert jetzt die
von `progressEntry` dargestellten Eventarten vor dem SQL-Limit. Die Lookahead-
Grenzen beider Quellen bleiben unabhängig von der Gruppierung im `truncated`-
Flag erhalten. Markdown übernimmt diesen Hinweis auch bei leerem Suchergebnis.
Datenquellen und ihre Textinhalte werden dabei nicht verändert.

`tests/desktop-chronicle-window.test.mjs` prüft diese drei Fehler, die genaue
2000/2001-Grenze, Weltquellenüberlauf, die gemeinsame Ausgabegrenze und eine
beschädigte sichtbare Quelle gegen SQLite. Sieben Prüfungen bestanden;
zusammen mit den betroffenen Narrativ-/Kampf-/Lade-/Codecprüfungen bestanden
35 gezielte Prüfungen und der Desktop-Typecheck. Keine native Chronikbedienung,
Hard-Crash- oder vollständige Produktabnahme ist damit belegt.

## Nächste ausführbare Lieferung

1. **Alle bestätigten Fachfolgen erschließen.** Quellenmatrix an den tatsächlichen
   Commands in `storage/live.ts`, `world.ts`, `progression.ts`, Shop- und
   Autonomieports erstellen. Fehlende Party-/Zeit-/Stock-/NPCfolgen aus dem
   jeweiligen autoritativen Commit publizieren; Fachwirkung, History und Receipt
   bleiben atomar. Bereits gespeicherte Events lesen, keine zweite allgemeine
   Eventarchitektur beginnen. Abnahme: je ein bestätigter Nutzerweg mit Fresh,
   Receiptreplay und kontrolliertem Rollback; keine doppelten Historieneinträge.
2. **Verknüpfte Korrekturen und Zeit zeigen.** `ChronicleEntry` braucht Quell-/
   Korrekturverweise sowie vorhandene Scene-/Weltzeit; `recordedAt` bleibt der
   Zeitpunkt am Spieltisch. Reader und UI unterscheiden ursprünglichen Fakt,
   Korrektur und aktuelle Wahrheit. Bestehende `correctionOf`-Verträge konsumieren.
   Abnahme: HP-/XP-/Lootkorrektur und rückdatierte Weltfolge behalten ihre
   ursprünglichen Records; kausales Reise-Undo entfernt nur erlaubte Folgen.
3. **Begrenzte Navigation und vollständige Ausgabe schließen.** API, Reader und
   UI auf stabile Cursor plus serverseitige Kategorie-/Textfilter umstellen,
   beide Quellen deterministisch zusammenführen und nur die benötigten Namen/
   Orte/Kämpfe lesen. Momentan laden diese Kontextmaps ganze Kampagnentabellen;
   ein Quellenlimit allein begrenzt diesen Aufwand nicht. Gruppierte Kampfawards
   dürfen an einer Seitengrenze keine Beteiligten verlieren. Ein vollständiger
   Export läuft unter einem festgelegten Snapshot in begrenzten Portionen mit
   Abbruch/Fortschritt; bis dahin bleibt der Ausschnitt ausdrücklich markiert.
   Abnahme: mehr als 2000 Fakten, viele interne Records, zwei Quellen, verschiedene
   Suchfilter und ein über die Grenze reichender Kampf liefern weder Lücken noch
   Duplikate; ein älterer Suchtreffer bleibt erreichbar.
4. **Daten- und Bedienabschluss.** Kampagnenkopie remappt strukturelle Quell-/
   Korrekturverweise, bewahrt Prosa und schützt den originalen Snapshot. Erasure
   entfernt eigene Fakten und verdeckte Rekonstruktionen; Konflikte nach erlaubter
   Ziellöschung bleiben erkennbar. Archivierte Eigentümer sind historische
   Referenzen. Abschließend tatsächliche Desktopprobe mit Kampagnenwechsel,
   Fresh, Tastatur, Skalierung und Markdownausgabe; lokale Tests ersetzen sie nicht.
