# Timelineersatz und unabhängige Kampagnenkopie

Stand: 14.10.2026. Der Fachumfang folgt [Spielabendplanung](manual-session-planner.md)
und [Campaign/Data](../../../ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md).
Die gepinnten Program Capabilities (Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, L57–70 und L648–666)
verlangen unabhängige Campaigninhalte und fortbestehende historische Fakten.
Quellenbindung: [Quellenregister](../../scope-sources.json), SHA256
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`.

## Iststand und korrigierter Fehler

`storage/plan-replacement.ts` ersetzt eine Timeline unter ihrer ursprünglichen
`replacementBasis` und gegebenenfalls der geprüften Vorlagenbasis. Neue Besuche
bekommen neue Identitäten; der Zielplan bleibt derselbe. Der Sessionwriter und
sein Planpublisher bilden eine gemeinsame Transaktion. Die Historie hält
`planId`, `sourcePlanId`, `previousVisitIds` und `visitIds` fest. Entfernte Besuche
sind historische Identitäten und müssen nicht wieder als aktuelle Besuche existieren.

Beim Import remappte `storage/campaign-data.ts` bisher die Planreferenzen, aber
nicht die beiden Besuchslisten. Dadurch verwiesen Fakten einer unabhängigen
Kopie weiter auf IDs der Quellkampagne, einschließlich bereits entfernter
Besuche. Beide Listen gehören jetzt zu den ausdrücklichen lokalen ID-Feldern
im gemeinsamen JSON-Walker. Seine erste Phase erfasst auch nur historisch
vorhandene IDs; die zweite benutzt dieselbe Zuordnung für alle Referenzen.
Titel, Notizen und eingefrorene Texte werden weiterhin exakt erhalten. Ein
Text, der zufällig eine frühere ID enthält, wird nicht durch Textersetzung geändert.
Quellpaket und archivierte Originalbytes bleiben unverändert; JSON-Checksummen
werden für die neue Kopie neu gebildet. Keine Formatmigration ist erforderlich.

## Lokaler Nachweis und Grenzen

`tests/desktop-plan-replacement-copy.test.mjs` führt den echten Sessionwriter,
Export, unabhängigen Import und Fresh aus, jeweils für Ersetzen aus einer
Vorlage und vollständiges Leeren. Es prüft historische und aktuelle
Besuchszuordnung, unveränderte Notiztexte/Paketbytes und Backupfähigkeit.
Dieser Nachweis qualifiziert die Referenzkorrektur. Worldplatzierungen,
angenommene Gruppen, vergebene Rewards, Undo/Redo und offene Eingaben brauchen
weiter eigene kombinierte Szenarien; vollständige Produktabnahme bleibt offen.

## Nächste ausführbare Abschlüsse

1. `plan-replacement.ts`, `session.ts`, `npc-world.ts`: kombinierte Vorlage mit
   unplatziertem Entwurf und bereits angenommenen World-NPCs ersetzen. Entwurf
   unabhängig kopieren; Worldidentität/HP erhalten, keine erneute NPCanlage.
   Abnahme: Original editieren, Kopie unverändert; Timeline leeren und Fresh,
   Worldinhalte/Übernahmehistorie bleiben erhalten.
2. `plan-replacement.ts`, `progression.ts`, `campaign-data.ts`: vorbereitete und
   bereits vergebene Rewards gemeinsam prüfen. Vorbereitete Belohnung bekommt
   unabhängige Identität; vergebene Fakten bleiben historische Fakten. Ersatz,
   Retry, Kopie und Fresh dürfen XP/Loot nicht erneut gutschreiben. Abnahme:
   tatsächliche Ledger-/Receiptzeilen und Bestände vergleichen.
3. `session-ui.ts` und persistente Vorbereitung: offenen Profil-/Besuchs-/Gruppen-
   und Rewardtext vor Ersatz sichern; Preview unter ursprünglichem Context und
   Basis bestätigen. Geänderte Vorlage/Zielbasis verwirft die Vorschau ohne
   Datenänderung. Unklarer Commitausgang wird per Status geklärt. Abnahme:
   Eingabe während verzögerter Antwort, Contextwechsel, Savefehler und Fresh.

Die vorhandene Replacement-Basis bleibt der konkrete Anschluss. Diese Schritte
brauchen keine zweite Timelinearchitektur oder generische Historyabstraktion.
