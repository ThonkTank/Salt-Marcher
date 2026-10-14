# Regelreferenzen zwischen Wissen und laufender Scene

Stand: 14.10.2026. Ergänzt [Katalog und Regeln](../../../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md),
[Live-Scenes](smr03-live-scene-contract.md) und [Gesamtumfang](../../SCOPE.md).

## Anforderungen und aktueller Anschluss

Die gepinnten Program Capabilities, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, L57–70 und L659–668, verlangen
wiederverwendbare, installationsweite Regeldefinitionen, aktuelle Referenzen
für laufendes/künftiges Spiel und erhaltene historische Fakten. Der lokale
Quellenhash entspricht `714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`
im Register. Suche, Detailansicht und ausdrückliche Übergabe an Scene/Encounter
gehören weiterhin zum vollständigen Katalog-/Regelumfang.

Der integrierte `rule`-Notiztyp ist kampagnengebunden. `rule-reference-ui.ts`,
Main/preload und `storage/rule-references.ts` heften bis zu 50 Notizstände an eine
Scene, zeigen Quellenänderungen und aktualisieren/lösen sie ausdrücklich.
SourceRevision, Titel, Vorlesetext und GM-Notizen werden eingefroren gespeichert;
ein Commandreceipt bewahrt sein damaliges Ergebnis. Die Installation unterstützt
damit einen manuellen Teilweg. Installationsweite Regeldefinitionen, gemeinsame
Referenzsuche und deren Konfliktimport fehlen noch. Der eingefrorene Stand einer
laufenden Scene erfüllt die allgemeine Regel für aktuelle Definitionen noch nicht
vollständig; abgeschlossene Geschichte und heutige Referenzlesung sind zu trennen.

## Behobene Antwortautorität und Commandprüfung

Sechs kontrollierte DOM-Gegenproben bestätigten verspätete A-Reads/-Commands,
A/B/A, falsche Sceneantworten, ältere Revisionen und mehrfaches Schreiben vor
Ack. Die UI setzte `view` vor ihrer Kontextprüfung und konnte damit einen neuen
Command aus der falschen Revisionsbasis bilden. Jetzt werden primitive
Campaign-/Token-/Scene-/Aktivierungswerte vor Übernahme geprüft; neuere bekannte
Revisionen bleiben erhalten. Reads vor einem Command werden verworfen,
Suchantworten und Suchfehler besitzen eine Lesereihenfolge. Während eines
ausstehenden Commands bleiben Änderungsaktionen gesperrt.

Zwei SQLite-Gegenproben fanden unbekannte Aktionen, die als Anheften behandelt
wurden, und ungültige `scene_rule_state.revision`-Werte. Der Writer weist
unbekannte Aktionen vor jeder Wirkung ab; der Reader und Backupvalidator
verweigern ungültige Revisionen. Ein gültiger Pin bleibt nach Quellenänderung
lesbar, sein Receipt replaybar; Fresh und unabhängige Kopie erhalten Prosa und
korrekte Scene-/Notizbindungen bei unveränderten Paketbytes.

Sieben DOM- und drei Storeprüfungen stehen in
`desktop-rule-reference-authority.test.mjs` und `desktop-rule-reference-store.test.mjs`.
Mit den betroffenen Chase-, Combatdraft-, Autonomy- und Gruppensuchprüfungen
bestanden 46 lokale Tests und der Desktop-Typecheck. Keine native Bedienabnahme,
Hard-Crash-, vollständige Referenzgraph- oder Regelkatalogqualifikation.

## Integrierte Writerprüfung vom 14.10.2026

Die erweiterte Commandprüfung bindet jetzt alle Identitäten und die erwartete
Revision vor dem ersten Storagezugriff. Die Zusammenführung mit dem lesenden
Reader zeigte eine fehlende State-Anlage beim ersten Pin: Ein Update ohne State
bestätigte keine steigende Revision. Der Writer legt den State nun ausdrücklich
innerhalb seines Commands an. Reads und readonly Snapshotprüfung schreiben
weiterhin nichts. Die Storegegenprobe prüft den ersten bestätigten Revisionswert
zusätzlich zu Fresh, Replay und unabhängiger Kopie.

## Nächste ausführbare Schritte

1. **Bestätigungs-/Closeweg schließen.** `executeSceneRule` besitzt lokale
   Receipts, ist aber noch nicht an den gemeinsamen `CommitReference`-/Status-
   und `writeConfirmed`-Port angeschlossen. `flushLive` berücksichtigt diesen
   Pendingweg ebenfalls noch nicht. Main/preload, `commit-receipt.ts`, Store und
   UI gemeinsam anschließen; Replyverlust lesend am gleichen Command aufklären.
   Abnahme: Pin/Refresh/Unpin vor und nach Commit unterbrochen, Scenewechsel,
   Close/Fresh, keine neue Command-ID als automatischer Retry.
2. **Gezielte Suche liefern.** Die UI lädt für ihre maximal 20 dargestellten
   Regeln noch die gesamte `Preparation`, einschließlich fremder Notizarten,
   Pläne und Orte. Ein kleiner Rulequery in Store/Vertrag/Main/preload soll
   Campaign/Kind/Text vor Cursor und Limit filtern, nur nötige Texte liefern und
   weitere Treffer erreichbar halten. Abnahme: wenige Regeln hinter vielen
   anderen Notizen, GM-Textsuche, Quellenänderung und A/B/A.
3. **Definitionen und aktive Referenzen fachlich verbinden.** Den vorhandenen
   SharedDefinition-/Importkonfliktweg für installationsweite Regeln ausbauen,
   Quellen-/Lizenzprovenienz erhalten und kampagneneigene Hausregeln explizit
   abbilden. Laufende/künftige Referenzen lesen aktuelle Definitionen;
   abgeschlossene Fakten behalten ihre damalige Basis. Bestehende eingefrorene
   Pins und freie Prosa migrieren, nicht verwerfen. Abnahme: zwei Kampagnen,
   gleichnamige Definitionen, Änderung, abgeschlossene Scene und Konfliktimport.
4. **Daten- und Anzeigeabschluss prüfen.** Pins ohne State, Row-/Sourceidentität,
   semantische Receiptprüfung, archivierte Quellen und Erasure fachlich schließen.
   GM-Notizen dürfen nur in der GM-Oberfläche erscheinen; die passive Anzeige
   konsumiert ausschließlich ihre eigene geprüfte Projektion. Danach native
   Pin-/Gruppenwechsel-/Restart-, Tastatur- und Skalierungsabnahme durchführen.
