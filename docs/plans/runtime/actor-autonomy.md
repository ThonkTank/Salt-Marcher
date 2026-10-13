# Actor Autonomy: geprüfte Jobangebote und Zeitwiederaufnahme

Stand: 14.10.2026. Ergänzt [SMR-09](../../../ROADMAP-SALTMARCHER-REPLACEMENT.md#smr-09--actor-autonomy)
und den [Live-/Scenevertrag](smr03-live-scene-contract.md).

## Anforderungen und vorhandener Anschluss

Die gepinnten `docs/autonomy/requirements/requirements-actor-autonomy.md`, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, verlangen ausdrücklich aktivierte
NPCs/Monster, bestätigte Campaignzeit, erreichbare Jobs und Reservierungen,
begrenzte Ownerwirkungen, Pausen vor Partygefahr und erklärbare atomare Folgen.
Der geprüfte Quellenhash entspricht
`95c42de5341aa005de49e0e5aea8c426f8793ea41ac1a96170a76ee0210abf0c` im Register.
Keine Wall-clock-Simulation, autonome Partyentscheidung oder Löschung von Identitäten.

`storage/autonomy.ts` speichert Actors, Jobs, bestätigte Intervalle, Reservierungen,
Buchungen, Logs und Receipts. `captureAutonomyBasis` bindet damalige Actor-/Job-/
Raum-/Routeneingänge; `recordAutonomyTime` hält den bestätigten Zeitrahmen fest.
`catchUpAutonomy` arbeitet begrenzt und hält bei einer späteren externen
Positionskorrektur an. Dungeon-/Ressourcen- und NPC-Owneroperationen stehen in
`autonomy-dungeon.ts`, `autonomy-resources.ts`, `npc-world.ts` und den jeweiligen
Raum-/Actorports. Die UI bietet Konfiguration, Angebote, Zuweisung und Catch-up.
Das ist ein Teilanschluss, keine vollständige SMR-AC-13-Abnahme.

## Geschlossene Lücke bei aktuellen Jobs

Vier SQLite-Gegenproben zeigten: korrekt gehashte Jobpayloads mit falscher ID oder
Revision wurden gelesen; nichtboolesche Schalter und ungültige Rollen-/Bedürfnis-
Formate konnten gespeichert oder gelesen werden. Ein Bytehash belegt keine
gültige Jobkonfiguration. Die globale Backupprüfung erkannte bereits beschädigte
Prüfsummen; die fachliche Jobprüfung fehlte dagegen.

`checkedAutonomyJob` in `autonomy-contracts.ts` ist jetzt die gemeinsame
Shape-/Wertprüfung für Schreibweg, aktuelle Query und Backup. `checkedJobRow`
bindet Payload-ID/Revision an die SQL-Zeile. `captureAutonomyBasis` benutzt
denselben geprüften aktuellen Reader, sodass eine ungültige Jobbasis keine neue
bestätigte Zeitwirkung erhält. Optionale spätere Dungeonfelder bleiben optional;
Custom-Needs bleiben zulässig. Historische Inhalte werden nicht neu geschrieben.

Sechs Prüfungen in `desktop-autonomy-jobs-integrity.test.mjs` belegen ungültige
Jobsteuerung ohne Teilzustand/Receipt, Row-/Payloadwidersprüche, abgewiesene
Zeitbestätigung ohne Wirkung, Backup-/Exportschutz sowie gültige Jobs nach Fresh
und unabhängiger Kopie mit unveränderten Paketbytes. Zusammen mit den 14 bestehenden
Autonomyprüfungen und 23 Chase-/Lootintegrationsprüfungen bestanden 43 Tests und
der Desktop-Typecheck. Das sind lokale SQLite-/kontrollierte DOM-Belege; native
Bedienung, Prozessabbruch, Cancel und gesamte Autonomyqualifikation bleiben offen.

## Nächste ausführbare Schritte

1. **Historische Zeitbasis schließen.** `validateAutonomy` und `catchUpAutonomy`
   prüfen gespeicherte Intervalle derzeit vor allem über ihren Hash. Die damaligen
   `basis.jobs` ebenfalls mit der reinen Jobprüfung lesen; Runtime-/Zeitfelder und
   Snapshotidentitäten gesondert binden. Keine Prüfung historischer Targets gegen
   ausschließlich heutige aktive Inhalte: archivierte Herkunft muss erhalten
   bleiben. Abnahme: alter gültiger Job, spätere Job-/Raumänderung, korrekt gehashte
   beschädigte Intervallbasis und Fresh; Catch-up verändert keinen Teilzustand.
2. **Reservierungs-/Receipt-/Logabschluss prüfen.** `autonomy_booking`,
   `autonomy_reservation`, `autonomy_log` und `autonomy_receipt` bei Backup und
   Transfer fachlich prüfen. IDs und Campaignowner, Zeitbereiche sowie historische
   Target-/Jobbindungen bewahren; Fehler erklären und nicht still reparieren.
   Abnahme: zwei konkurrierende Jobs, unterbrochene Reservierung, Positionsoverride,
   unabhängige Kopie, Receiptreplay und erklärbare erhaltene Konfliktrollen.
3. **Zeit-/Ownerwirkung gemeinsam qualifizieren.** Den realen
   `CampaignStore.executeLive`-/Catch-up-Anschluss mit World-/Dungeon-/Trap-/Actor-
   Effekten prüfen: vor Partygefahr pausieren, auf Ownerfehler den ganzen
   betreffenden Step zurückrollen, damalige Grundlage nicht umdeuten. Ein Limit
   pro Actor ist noch kein Nachweis der Gesamtstep-Atomarität. Gezielt einen
   Ownerfehler zwischen zwei Actorwirkungen sowie Resume nach Fresh prüfen.
4. **Bedienbarkeit und Größenfall messen.** `autonomy-ui.ts` mit A/B/A,
   unbestätigten Rohwerten, Pending/Replyverlust, erklärtem Jobausschluss und
   Tastatur prüfen. Danach 200 Actors unter der Quellbedingung für ≤2 s p95 und
   Fortschritt ≤100 ms messen; Cancel vor Commit ohne Wirkung. Nur konkrete
   gemessene Engstellen ändern, keine zusätzliche persistierte Simulation.
