# Verfolgung als laufende Scenemaske

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Ergänzt den [Party-/Livevertrag](smr03-live-scene-contract.md),
[Nachbereitung](combat-recovery.md#nachbereitung-und-bestehende-schätze) und den [Gesamtumfang](../../project/requirements/scope.md).

## Quellen und aktueller Anschluss

Die gepinnten Program Capabilities, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, L248–252 und L270–283, verlangen
mehrere parallele Encounter-/Chasemasken über einer kontinuierlichen Scene,
Teilnahme bestehender PC/NPC/Monster, bereinigte Teilnahme beim Scenemove und
sechs Sekunden Scenezeit pro Runde. Die passive Anzeige erhält ausschließlich
freigegebene Art/Karten (L289–302). Der lokale Quellenstand stimmt mit dem
Registryhash `714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e` überein.

`chase-contracts.ts`, `storage/chase.ts`, Main/preload und `chase-ui.ts` bieten
zurzeit eine manuelle persistente Liste mit freien Teilnehmern, Abstand, Tempo,
Erschöpfung, Komplikation, Runde und Abschluss. Abschluss schreibt einen
Welthistorieneintrag. Die integrierte Auswahl erschließt zuletzt gespeicherte
Masken derselben Scene; Pflichtfelder sperren verfrühte Aktionen. Vollständiger
Actor-/Membershipabschluss und vollständige Datenclosure bleiben offen.
Persistente Rohentwürfe und der echte Roundzeitport sind angeschlossen. Die inzwischen
integrierte Receiptstrecke bietet Commandreplay und lesende Statusaufklärung.
Der aktuelle Tracker ist daher eine Teillieferung.

## Abschluss mit unbestätigten Eingaben

Ein Abschluss bestätigt das Ergebnis und verbraucht nur `chase-outcome` aus dem
zugehörigen Entwurf. Unbestätigte Abstand-/Erschöpfungswerte, Komplikation und
angefangene Teilnehmer bleiben im bestehenden Entwurfsspeicher erhalten. Sie
erzeugen weder eine Runde noch Gruppenzeit. Ein reiner Ergebnisentwurf wird nach
Bestätigung vollständig entfernt.

Abgeschlossene oder archivierte Masken zeigen den bestätigten Teilnehmerstand.
Übrige Rohwerte stehen getrennt unter **Unbestätigte Eingaben** zum Lesen und
Kopieren, auch nach Neustart und in einer unabhängigen Kampagnenkopie. Sie dürfen
keine bestätigten Werte überblenden. Der bestehende Draft-/Receiptvertrag bindet
den Restentwurf atomar an die neue Revision; Replay bestätigt dasselbe Ergebnis.
Store-/DOMfälle prüfen diese Grenze, die native Wechselprobe zusätzlich den
Abschluss mit leeren Zahlenfeldern und die kopierbare Wiederaufnahme bei 200 %.

## Behobene Antwortzuordnung

Vier kontrollierte Gegenproben bestätigten: späte Reads überschrieben eine neue
Scene; späte Commandantworten zeichneten im falschen Kontext; ältere Refreshes
ersetzten neuere Revisionen; Fehler der vorherigen Kampagne erschienen im neuen
Kontext. Ein Folgecommand konnte dadurch unter dem aktuellen Kontext die alte
Chase-ID adressieren.

`chase-ui.ts` bindet Reads und Commands jetzt an erfasste primitive Token-,
Campaign-/Scene-ID und Aktivierungsfolge. Reads besitzen zusätzlich eine
Anfragefolge. Contextwechsel und bestätigte Commands verwerfen überholte Reads;
A→B→A akzeptiert keine Antwort der ersten A-Aktivierung. Antworten gehören zur
erwarteten Scene und dürfen eine bereits bekannte höhere Revision derselben
Maske nicht zurücksetzen. Die fachliche Wirkung eines zuvor gesendeten Commands
bleibt beim ursprünglichen Ziel; sein Reply zeichnet und meldet nur im weiterhin
passenden Kontext. Aktuelle IPCfehler bleiben sichtbar und Refresh bleibt möglich.
Anlage nach abgeschlossenem Tracker sendet außerdem keine alte Chase-ID/Basis.

`tests/runtime/desktop-chase-authority-dom.test.mjs` enthält elf kontrollierte DOMfälle
mit verzögerten/ersetzten IPCantworten. Zusammen mit den betroffenen
Szenensuche-/Reiseziel-, Codec-, Store-/Transfer- und Draftmigrationprüfungen
bestanden 35 lokale Prüfungen und Desktop-Typecheck.
Dieser historische DOMbeleg ersetzt keine reale Crossworkflow-/Speicher-/Maskenabnahme.

## Integrierter Partyabgleich vom 14.10.2026

Move und Deaktivierung entfernen Teilnahmen in allen offenen Combat-/Chasemasken
unter demselben Partycommand. Je betroffenem Owner wird ein revisionsgebundener
`mask_reconciliation_receipt` gespeichert. Combat nutzt dafür den vorhandenen
Shared-Health-Writer, Turnnachfolge und den sichtbaren Abgleichhinweis; eine zweite
Gesundheitsberechnung für dieselbe Wirkung wurde vermieden. Die integrierten
Core-/SQLiteprüfungen belegen Turnnachfolge, Stale-Undo, eindeutige Teilnahme und
Receiptreplay.

Die unabhängige Kopie remappt zusätzlich `removedCharacterIds`. Eine Gegenprobe
mit Combat und Chase vor Deaktivierung fand zunächst alte IDs; danach gehörten
beide Abgleichbelege zu den kopierten Characters. Party-/Scenehistorie, freie
Scenetitel und Quellpaketbytes bleiben erhalten; Folgebackup ist geprüft.
Der weitere integrierte Abgleich archiviert Masken beim Retirement ihrer Scene
mit unverändertem Ergebnis-/Rewardstand: `retired` ist kein Abschluss. Der
Shared-Health-Writer und Statusqueries konsumieren nur aktive Masken; alte
Archivfakten werden nicht durch spätere HP-Änderungen neu geschrieben. Core-/
SQLitebelege decken Split, erhaltene NPCs und fehlende abgeleitete Rewards ab.
Provider-Pending, vollständiger Tombstone-/Archivabschluss
und vollständige native Crossworkflowabnahme bleiben offen.

## Nächste ausführbare Schritte

1. **Roharbeit und vollständige Klärung schließen.** Der integrierte
   `chase_receipt`-Writer bindet Command-ID/Fingerprint und ursprüngliches Ergebnis
   atomar. `commitStatus` und `writeConfirmed` klären den Ausgang lesend; Replay
   von Create, Round und Finish sowie Fresh erzeugten im SQLitetest keine zweite
   Maske/Runde/History. Die UI behält ihre Kontextprüfung auch an diesem Port.
   Commitkontrolländerungen sperren nur Controls und bauen keine Eingabefelder
   neu auf. Unbestätigte Werte bleiben dabei erhalten. Persistente Workingdrafts
   binden inzwischen Rohfelder an Scene, Chase und Revision. Nur die bestätigte
   Fassung wird atomar verbraucht. Store-/Controllerprüfungen decken rohe
   ungültige Werte, A/B/A, CAS und späteren Receiptread ab; native Hard-Crash-
   und vollständige Kontextwechselabnahme bleiben gesondert offen.
2. **Datenabschluss vervollständigen.** Der integrierte Backupvalidator prüft
   Header/Shape und gespeicherte Belege. Zwei Legacygegenproben fanden allerdings
   Fehler bei Schema 38 ohne Chase bzw. ohne Receipttabelle; der Validator
   berücksichtigt jetzt diese historischen Varianten. Der integrierte
   Aktueller World-/Shared-Health-Anschluss nutzt Schema 43 einschließlich NPCrecords; dessen Adapter installiert Chase ebenfalls
   auf der eigenen Migrationskopie. Ältere Formatadapter
   installieren die Chasetabellen auf der eigenen Importkopie.
   Eine weitere Gegenprobe fand den alten Abschlussverweis nach unabhängiger
   Kopie. `campaign-data.ts` remappt nun den strukturellen `chaseId`-Slot in
   `world_history.facts`, bewahrt freie Ergebnisprosa und Originaldatei. Gültige
   Kopie/Backup und lesender Replaystatus nach Fresh sind geprüft. Eine
   zusätzliche Gegenprobe entlarvte gelöschte Tabellen mit erhaltenem
   Abschlussverweis; die Ownerprüfung verweigert jetzt diesen hängenden Verweis,
   während wirklich leere Legacyfähigkeiten gültig bleiben. Danach
   Receipt-/Recent-Ownerclosure, archivierte Scenes und Erasure testen. Keine allgemeine Bodytext-Ersetzung.
3. **Teilnahme und Zeit koppeln.** Die neue Scene-Gruppenübernahme bindet
   Character-IDs; der Livewriter bereinigt laufende Masken bei Move und
   Deaktivierung atomar. Die Chasestrecke prüft referenzierte Character-Membership
   bei Teilnahmecommands jedoch noch nicht vollständig. Bestehende Roster-/Worldactoridentitäten und
   die geprüften Combat-/Live-Membershipregeln konsumieren. Move/Split/Rejoin
   bereinigen betroffene Teilnahme atomar, ohne den Scenemove zu blockieren.
   Der Roundcommand nutzt inzwischen den vorhandenen `executeLive`-Zeitwriter
   innerhalb der Chase-Transaktion: sechs Sekunden, Entwurfverbrauch, Chase,
   Worldfolgen und beide Belege werden gemeinsam bestätigt oder zurückgenommen.
   Replay verlässt den Writer vor dem Zeitport; es repariert historische Runden
   nicht nachträglich. Parallele Masken derselben Scene buchen nacheinander je
   sechs Sekunden; fremde Scenes behalten ihre Uhr. Der bestehende Zeitweg
   besitzt weiterhin Kalender, Autonomie, Restock und Dungeonfolgen.
   `tests/runtime/desktop-chase-time.test.mjs` prüft zwei Scenes und drei Masken, Fresh,
   lesende Statusklärung, Replay und atomare Rücknahme bei beschädigter
   Kalenderbasis bzw. fehlgeschlagener Belegablage. Die Anzeige zeigt die Gruppenzeit direkt beim Verfolgungsstand.
   Rundenentwurf, Teilnehmerverwaltung und Abschluss sind getrennt gruppiert;
   gesicherte Ergebniseingaben öffnen den Abschluss beim Wiederaufruf. Eine
   abgeschlossene Maske zeigt ihren bestätigten Stand, ohne automatisch eine
   neue Anlage vorzublenden. Die Anzeige liest die aktuelle
   Sceneuhr nach Bestätigung und Statusklärung; späte Reads dürfen weder eine
   andere Scene noch eine höhere Uhrrevision ersetzen. Offen bleibt die
   vollständige Actor-/Move-/Autonomieabnahme mit mehreren Maskentypen.
4. **Mehrfachmasken und Anzeige bedienen.** Der neue Maskenstart ermöglicht
   mehrere laufende Masken; `recent` erschließt die letzten 30. Aktualisieren
   behält die gewählte Maske mit den vorhandenen Kontextguards. Die begrenzte
   native Wechsel-/Rohwertprobe ist `tools/test-desktop-chase-switch.mjs`;
   vollständige Navigation über ältere Masken bleibt gesondert zu prüfen. Aktive Actor-Art nur über die bestehende Publicprojektion freigeben.
   Danach echter Desktopablauf mit paralleler Party, Scenewechsel, Replyverlust,
   normalem Fresh und erforderlicher Plattform-/Tastatur-/Skalierungsprüfung.

## Begrenzte native Roundzeitprüfung

`tools/test-desktop-chase-switch.mjs` öffnet die Kampagne über ihre sichtbare
Karte, prüft zwei Verfolgungen, gesicherte Rundenentwürfe, fehlgeschlagene Reads
mit Wiederaufnahme und eine verlorene Bestätigungsantwort. Die Statusklärung
zeigt Runde 1 und `00:00:06`; ein separater Store bestätigt genau einen
Zeitschritt und unveränderte Bytes der anderen Maske. Nach normalem Close
folgen Wiederaufnahme und einmaliger Abschluss bei echtem Browserzoom 200 %.
Die Probe protokolliert Quellrevision, Dirty-Status, fünf Runtimehashes,
Zoomfaktoren und tatsächliche normale Prozessenden samt fehlender PID.
Sie verwendet ein diskbasiertes `TMPDIR`, begrenzte Lebensdauer und frische
native Fensteraufnahmen. Ihr Ergebnis ersetzt weder Paket-/Installationsprüfung
noch vollständige Party-/World-/Mehrplattform- oder menschliche Abnahme.
