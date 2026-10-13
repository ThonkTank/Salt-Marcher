# Kampfentwürfe und narrative Belohnungen: Datenregeln und nächste Lieferung

Stand: 13.10.2026. Ergänzt den [Party-/Liveplan](smr03-live-scene-contract.md)
und die [manuelle Vorbereitung](../campaign/manual-session-planner.md).
Der Atlas ist keine Voraussetzung für diese Abläufe. Gesamtumfang und
Lieferabhängigkeiten bleiben in [SCOPE](../../SCOPE.md) und [ROADMAP](../../ROADMAP.md).

## Implementierter Anschluss

Kampfteilnehmerfelder und Kampfnotizen besitzen eigene Rohentwürfe in
`combat_working_draft`. `src/app/combat-draft-contracts.ts` beschreibt ursprüngliche
Basis, Ziel und Schreib-ID; `src/app/storage/combat-drafts.ts` prüft Eigentümer,
Byteintegrität und CAS. `src/app/combat-draft-cache.ts` hält pro Editor höchstens
einen laufenden Schreibauftrag und den neuesten Folgestand. Rohe Zwischenwerte
wie `-` und `1,5` bleiben Eingaben; sie ändern keinen bestätigten Kampfwert.
Ein ausdrücklicher Kampfcommand bestätigt Fachwerte, Receipt und Verbrauch nur
der passenden Entwurfs-ID gemeinsam. Ein Receipt-Replay verbraucht keine spätere
Eingabe. Entfernte Teilnehmer und beendete Kämpfe behalten kopierbare Entwürfe.

Narrative Quest-/Gerüchtbelohnungen teilen Worldnotiz, Roster, XP und Loot.
Ein Bytehash allein beweist keine gültige Zuordnung: Drei Gegenproben mit neu
berechnetem Hash und falscher Notiz-ID, Revision oder Belohnungs-ID wurden vor
der Korrektur beim Lesen akzeptiert. Auch die Backupprüfung besaß keinen
semantischen Narrativvertrag. `src/app/storage/narrative.ts` prüft
jetzt SQL-Header gegen Inhalt, kampagneneigene Referenzen und beide Richtungen
zwischen Status und Award. Eine bestätigte Belohnung darf durch Verlust ihres
Statuslinks nicht wieder als unbezahlt erscheinen. `CampaignStore.narrative`
liest den verbundenen Zustand innerhalb einer Transaktion. `validateDatabase`
verwendet denselben Vertrag vor Backup und Paketannahme.

Archivierte Notizen und Orte bleiben zulässige historische Eigentümer; aktuelle
Editierbarkeit ist davon getrennt. Die unabhängige Kopie remappt strukturelle
Owner-IDs, erhält den damaligen Awardtitel und unveränderte Prosa. Beschädigte
Quellen werden weder normalisiert noch überschrieben. Ein vorhandenes gültiges
Backup bleibt nach Zurückweisung bytegleich. Der nicht eindeutige Index
`narrative_award_note(campaign_id,note_id)` begrenzt die Zuordnungssuche; mögliche
Doppelbelohnungen werden als Vertragsbruch gemeldet und nicht bereinigt.

## Geprüfter Umfang

- `tests/desktop-narrative-integrity.test.mjs`: falsche Statusidentität/-revision,
  falsche Awardidentität, verlorener Status oder Awardlink, archivierte Notiz,
  unabhängige Kopie mit unveränderter Prosa/Quelldatei und indizierte Abfrage.
- `tests/desktop-combat-drafts.test.mjs`: Fresh-Store, CAS, Replay, atomarer
  Draftverbrauch und Rollback, stale Basis, entfernte/beendete Ziele, beschädigte
  Quelle, Backup, Kopie/Erasure und tatsächliche Format-33-Aufrüstung auf den
  aktuellen Stand auf einer eigenen Kopie. Format 33 besitzt die späteren
  Draft-/Content-/Narrativtabellen im Test ausdrücklich noch nicht.
- Zusammen mit `tests/desktop-key-discovery.test.mjs`: 22 lokale Storeprüfungen
  bestanden; Desktop-Typecheck bestanden. Das qualifiziert diese Verträge,
  nicht die vollständige XP-/Loot-/History- oder Produktbedienung.
- [Linux-Close/Fresh-Beleg](../../reference/technical-foundation-20261011/combat-drafts-native-20261013.json):
  vier kleine Abläufe in zwei regulär beendeten Electronprozessen des dort
  hashgebundenen Builds 0.29.0. Dieser frühere Build wurde nach der jetzigen
  Integration nicht erneut nativ qualifiziert. Hard-Crash, große Draftmengen,
  IME, Screenreader und andere Plattformen bleiben offen.

## Nächste ausführbare Schritte

1. **Narrative Eingabe wiederaufnehmen.** In `src/app/narrative-contracts.ts`,
   `src/app/storage/narrative.ts`, `desktop/main.ts`, `desktop/preload.ts` und `src/app/narrative-ui.ts` rohe
   Status-, XP-, Item- und Ergebnisfelder an einen zielgebundenen Workingdraft
   anschließen. Vor Umsetzung die vorhandenen Vorbereitung-/Kampfverträge
   übernehmen, keine zweite generische Draftarchitektur bauen. Ursprüngliche
   Note-/Statebasis und ungeklärter Command bleiben getrennt; eine spätere
   Textänderung wird nicht durch Receiptaufklärung rebasiert. Abnahme: ungültige
   XP/Preiswerte → Kampagnenwechsel/Close/Fresh → korrigieren → einmal bestätigen;
   verlorene Antwort nur lesend klären, erneute Vergabe verweigern, spätere Eingabe
   erhalten. Danach positive Awardfälle mit XP, Loot und aktiver Scene sowie
   kopierte und archivierte Eigentümer prüfen.
2. **Kampfanlage und Abschluss schließen.** In `src/app/combat-contracts.ts`,
   `src/app/combat.ts` und bestehendem Draftstore Anlage-, Gegner- und Abschlussfelder
   ergänzen. Anlage bindet Scene und Membershipbasis ohne erfundene Kampf-ID;
   Abschluss bindet konkreten Kampf und offene Outcome-/Rewardeingaben. Bestätigung
   verbraucht genau die angenommene Draftfassung atomar. Abnahme: Scenewechsel,
   beendetes Ziel und verzögerte Antwort verlieren keine Rohwerte und schreiben
   keine andere Scene. Diese Erweiterung qualifiziert keine Characterprofile,
   Timelinebesuche, Wetter- oder Musikfelder; deren eigene offene Anschlüsse im
   jeweiligen Fachplan bleiben bestehen.
3. **Datenabschluss über die Übergänge prüfen.** In `storage/progression.ts`,
   `storage/campaign-data.ts` und der Backupvalidierung prüfen, ob Award,
   XPhistory, Treasure und Entwürfe vollständig kopiert, archiviert und gelöscht
   werden. Kleinste Gegenprobe zuerst: positive XP-/Lootbelohnung kopieren,
   weiterbearbeiten, Quellkampagne löschen; Ziel und Quelle dürfen weder fremde
   Eigentümer noch rekonstruierbare gelöschte Personen enthalten. Danach native
   Spielabendprobe mit Vorbereitung, Live-Scene, Belohnung und Fresh. Lokale
   Tabellen-/Checksumprüfungen ersetzen diese Produktabnahme nicht.
