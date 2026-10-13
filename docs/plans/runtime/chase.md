# Verfolgung als laufende Scenemaske

Stand: 13.10.2026. Ergänzt den [Party-/Livevertrag](smr03-live-scene-contract.md),
[Nachbereitung](combat-and-narrative-recovery.md) und den [Gesamtumfang](../../SCOPE.md).

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
Actor-/Membershipabschluss, Zeitport,
Workingdrafts und vollständige Datenclosure bleiben offen. Die inzwischen
integrierte Receiptstrecke bietet Commandreplay und lesende Statusaufklärung.
Der aktuelle Tracker ist daher eine Teillieferung.

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

`tests/desktop-chase-authority-dom.test.mjs` enthält elf kontrollierte DOMfälle
mit verzögerten/ersetzten IPCantworten. Zusammen mit den betroffenen
Szenensuche-/Reiseziel-, Codec-, Store-/Transfer- und Draftmigrationprüfungen
bestanden 35 lokale Prüfungen und Desktop-Typecheck.
Native Bedienung und reale Crossworkflow-/Speicher-/Maskenabnahme stehen aus.

## Nächste ausführbare Schritte

1. **Roharbeit und vollständige Klärung schließen.** Der integrierte
   `chase_receipt`-Writer bindet Command-ID/Fingerprint und ursprüngliches Ergebnis
   atomar. `commitStatus` und `writeConfirmed` klären den Ausgang lesend; Replay
   von Create, Round und Finish sowie Fresh erzeugten im SQLitetest keine zweite
   Maske/Runde/History. Die UI behält ihre Kontextprüfung auch an diesem Port.
   Commitkontrolländerungen sperren nur Controls und bauen keine Eingabefelder
   neu auf. Unbestätigte Werte bleiben dabei erhalten. Persistente Workingdrafts
   mit Original-Scene-/Chasebasis fehlen weiterhin. Abnahme als nächster Schritt:
   rohe ungültige Werte und Ausgangsklärung vor/nach Commit über Close/Fresh,
   A/B/A und späteren Receiptread erhalten; kein blindes Retry oder neues Ziel.
2. **Datenabschluss vervollständigen.** Der integrierte Backupvalidator prüft
   Header/Shape und gespeicherte Belege. Zwei Legacygegenproben fanden allerdings
   Fehler bei Schema 38 ohne Chase bzw. ohne Receipttabelle; der Validator
   berücksichtigt jetzt diese historischen Varianten. Der integrierte
   Gruppenanschluss nutzt Schema 40; dessen Adapter installiert Chase ebenfalls
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
   Roundcommand bindet den echten Sceneclockport; 6000 ms, Chasewirkung,
   Worldfolgen und Receipt gehören in dieselbe bestätigte Wirkung. Keine zweite
   Uhr und keine bloß angezeigten Sekunden. Abnahme: zwei Scenes, mehrere Masken,
   verschobene Figur, Worldzeitfault und Replay ohne verlorene/doppelte Intervalle.
4. **Mehrfachmasken und Anzeige bedienen.** Der neue Maskenstart ermöglicht
   mehrere laufende Masken; `recent` erschließt die letzten 30. Aktualisieren
   behält die gewählte Maske mit den vorhandenen Kontextguards. Vollständige
   Navigation über ältere Masken und native Rohwert-/Wechselabnahme fehlen. Aktive Actor-Art nur über die bestehende Publicprojektion freigeben.
   Danach echter Desktopablauf mit paralleler Party, Scenewechsel, Replyverlust,
   normalem Fresh und erforderlicher Plattform-/Tastatur-/Skalierungsprüfung.
