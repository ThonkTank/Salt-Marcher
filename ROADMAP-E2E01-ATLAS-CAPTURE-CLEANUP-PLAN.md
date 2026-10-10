# RUNTIME-I01a-CLEAN-P01: Abschluss der nativen Atlas-Erfassung

Eigener begrenzter Aufräumplan vom 10. Oktober 2026 für
[E2E-01, Nutzerzeile 13](ROADMAP-E2E-GATES-CANDIDATE.md#e2e-01--kampagne-und-gemeinsamer-raum--saverestart).
Grundlage ist Stadts unabhängiger
[Code-R01 auf 80580c1](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/13#issuecomment-6094452280):
keine Pflichtbefunde, eigene Typprüfung, 530 Tests, sauberer Build und vier
zusätzliche Gegenproben bestanden. Die sechs Source-/Testblobs entsprechen dem
geprüften Implementierungsstand `ad265b2`. Dieser Lauf plant das Aufräumen;
Umsetzung und abschließender Review bleiben getrennte Läufe.

## Konkreter Umfang

Die Erfassung und Prüfung bleiben im vorhandenen Repository, derselben
Backendwarteschlange und History. Die tatsächlichen Änderungs- und
Lebensdauerzähler, defensive Byteprojektion und ursprünglichen Consumer-Guards
sind erforderlich. Der Review verlangt keine weitere Produktänderung. Die
begrenzte Restprüfung fand keinen neuen Debugzugang oder temporären Export.
Die bestehende Fehlerausgabe für History-Subscriber bleibt erhalten.

**Die Löschliste ist leer.** Der folgende I-Lauf erzeugt einen nachprüfbaren
Erhaltungsbeleg und schließt die eigenen Übergabemetadaten ab. Er eröffnet
keinen allgemeinen Refactoring-, Paritäts- oder weiteren Planungslauf.

Zu erhalten sind:

- alle sechs Source-/Testblobs einschließlich der 16 neuen Regressionen;
- der unabhängig geprüfte Runtimeplan, aktive und historische Fixtures,
  sämtliche nativen Kennungen und Markdowntexte;
- die 21 eigenen Capture-Belegdateien mit zusammen 22.691.336 Bytes im
  QA-Verzeichnis, einschließlich fehlgeschlagener Testläufe und ihrer
  dokumentierten Orakelkorrekturen;
- alle fremden Belege und Checkpoint-Wurzeln, die lokalen Änderungen im
  ursprünglichen Shared-Checkout und der Nutzervault.

Die exakte Dateiliste samt SHA-256 liegt in
`/home/aaron/.cache/dungeon-native-qa/hex-03/runtime-capture-i01a-cleanup-20261010/p01/retained-evidence-inventory.json`.
Der vorhandene Capture-Beleg bleibt an `ad265b2` gebunden; spätere
Synchronisation überschreibt weder dessen Provenienz noch den historischen
nativen I01b-Nachweis auf `88babcd`.

## Getrennte Folge

1. **CLEAN-P01, dieser Lauf:** tatsächlichen Code-R01 und seine Belegbindung
   übernehmen, Erhaltungsmenge und leere Löschliste festlegen; Planlinks,
   eindeutiges JSON und eigenen Diff prüfen. Eingehenden Shared-Stand vor
   Veröffentlichung normal integrieren und passend prüfen.
2. **CLEAN-I01, nächster eigener Lauf:** frischen Repo-Stand konsumieren;
   Source-/Fixtureblobs und die 21 Capture-Belege gegen den Plan prüfen.
   Keine Löschung oder Codeänderung. Nur eigene Abschlussmetadaten und einen
   externen Erhaltungsbeleg schreiben. Geänderte oder fehlende Pflichtbelege
   sichtbar melden, niemals durch neue Erfolgsbehauptungen ersetzen.
3. **CLEAN-R01, danach:** bestehender unabhängiger Stadtchat prüft genau den
   veröffentlichten I01-Abschluss, seine Hashbindung und den erlaubten Diff.
   Nur konkrete neue Pflichtbefunde führen zu Nachbesserung und Re-review.
4. Nach bestandenem Aufräumen folgt der bereits geplante **I01b
   Context-/Navigationsanschluss**. Keine neue allgemeine Owner- oder
   Ratifikationsrunde; I01c benötigt tatsächliche Host-/Providerinstanzen.

Eigene Repositoryänderungen sind auf diesen Plan, `checkpoint.hexAtlasExecution`
und `acceptance.hexAtlas` beschränkt. Erforderliche Shared-Synchronisation bleibt
als fremde, unveränderte Lieferung mit eigener SHA und Prüfung ausgewiesen.
Neue Source-/Test-/Tool-/Fixtureänderungen gehören nicht zu diesem Aufräumen.
Bei unveränderten Produktblobs werden bestandene Kernprüfungen nicht allein
für Metadaten wiederholt. Tatsächliche eingehende Codeänderungen erfordern die
passenden Basisprüfungen.

## Erhaltene Abnahmegrenzen

Native Capture ist `spatial-closure`, keine vollständige Campaign-Inventur
oder Registryautorität. Dateivergleiche sind kein atomarer Snapshot/CAS;
unbeobachtete externe Datei-ABA benötigt einen echten Revisionsprovider.
Gewöhnliche Editor-, Hydration- und Speicheraktionen sind noch nicht an einen
CampaignContext gebunden. Context/prepareLeave/Navigation, reale Provider,
Mehrbesitzer-Publish, P02/P04 und CompleteImport bleiben folgende Eingänge.
Dieser Abschluss liefert keine neue GUI-, physische, Originalparitäts-,
Großwelt-, Installations- oder vollständige E2E-Abnahme.
