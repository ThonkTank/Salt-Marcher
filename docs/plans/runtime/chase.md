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
Welthistorieneintrag. Mehrfachmaskenwahl, Actor-/Membershipbindungen, Zeitport,
Workingdrafts, Receiptaufklärung und vollständige Datenclosure bleiben offen.
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

`tests/desktop-chase-authority-dom.test.mjs` enthält zehn kontrollierte DOMfälle
mit verzögerten/ersetzten IPCantworten. Zusammen mit den betroffenen
Szenensuche-/Reisezielprüfungen bestanden 17 lokale Prüfungen und Desktop-Typecheck.
Native Bedienung und reale Crossworkflow-/Speicher-/Maskenabnahme stehen aus.

## Nächste ausführbare Schritte

1. **Commandidentität und Roharbeit schließen.** `storage/chase.executeChase`
   verwendet bisher `commandId` nicht. An bestehendes Receipt-/Fingerprintmuster
   anschließen und lesenden `commitStatus`-Port für Chase ergänzen; identischer
   Create-/Round-/Finish-Replay publiziert keine zweite Maske/Runde/History.
   Persistente Rohfelder, Original-Scene-/Chasebasis und unbekannter Command
   bleiben getrennt. Kein blindes Retry nach verlorener Antwort. Abnahme: Fehler
   vor/nach Commit, Fresh und A/B/A erhalten Eingaben und klären genau den alten
   Auftrag, ohne ein neues Ziel zu beschreiben.
2. **Datenabschluss anschließen.** `storage/chase`-Header-/Shapeprüfung am Backup,
   Export und Import wiederverwenden; ältere Pakete ohne die neue Tabelle
   ausdrücklich migrieren oder als kompatibel leere Fähigkeit behandeln.
   `campaign-data.ts` braucht den strukturellen `chaseId`-Referenzslot für
   `world_history.facts`; freie Texte bleiben unverändert. SQL- und Body-Scene,
   Revision und Status müssen stimmen. Abnahme: gültiger und checksummed falsch
   zugeordneter Tracker, kopierter Abschlussverweis, unveränderte Quelle,
   archivierte Scene, Erasure sowie früheres Format ohne Chaserecords.
3. **Teilnahme und Zeit koppeln.** Bestehende Roster-/Worldactoridentitäten und
   die geprüften Combat-/Live-Membershipregeln konsumieren. Move/Split/Rejoin
   bereinigen betroffene Teilnahme atomar, ohne den Scenemove zu blockieren.
   Roundcommand bindet den echten Sceneclockport; 6000 ms, Chasewirkung,
   Worldfolgen und Receipt gehören in dieselbe bestätigte Wirkung. Keine zweite
   Uhr und keine bloß angezeigten Sekunden. Abnahme: zwei Scenes, mehrere Masken,
   verschobene Figur, Worldzeitfault und Replay ohne verlorene/doppelte Intervalle.
4. **Mehrfachmasken und Anzeige bedienen.** Vorhandene `recent`-Query als begrenzte
   Auswahl mit stabilem Ziel nutzen; mehrere laufende Masken müssen erreichbar
   bleiben. Aktive Actor-Art nur über die bestehende Publicprojektion freigeben.
   Danach echter Desktopablauf mit paralleler Party, Scenewechsel, Replyverlust,
   normalem Fresh und erforderlicher Plattform-/Tastatur-/Skalierungsprüfung.
