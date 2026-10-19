# Kampf: Entwürfe, Auswahl und Nachbereitung

Fachrahmen: [Party/Live](smr03-live-scene-contract.md),
[Encounter-Anforderung](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/encounter/requirements/requirements-encounter.md).
Quest-/Gerüchtabschlüsse: [Narrative Recovery](narrative-recovery.md).
Ein Atlas ist für diese Abläufe keine Voraussetzung.

## Code und gezielte Prüfungen

Pfade: `src/app/`; Prüfungen: `tests/`.

| Änderung | Zuständige Quelle | Regression |
| --- | --- | --- |
| Spontane Katalogübernahme | `combat-contracts.ts`, `combat.ts`, `storage/combat.ts` | `desktop-combat-reinforcement.test.mjs`, `tools/test-desktop-catalog-combat.mjs` |
| Teilnehmer-/Notizentwurf | `combat-draft-contracts.ts`, `combat-draft-cache.ts`, `storage/combat-drafts.ts` | `desktop-combat-drafts.test.mjs` |
| Szenen-/Mehrgruppenauswahl | `storage/scene-encounter-selection.ts`, `combat-selection-ui.ts`, `storage/combat.ts` | `desktop-scene-encounter-selection.test.mjs` |
| Gemeinsame PC-Gesundheit | `storage/mask-health.ts` | `desktop-combat-hit.test.mjs` |
| Legendäre Aktion nach Kopie | `storage/campaign-data.ts`, `storage/mask-health.ts` | `desktop-legendary-transfer-integrity.test.mjs` |
| Mobdarstellung | `combat-mob-ui.ts` | `desktop-combat-mob.test.mjs` |
| Abschluss und Schatzverteilung | `storage/combat-resolution.ts`, `combat-resolution-ui.ts` | `desktop-combat-resolution.test.mjs` |

## Grenzen zwischen Entwurf und Kampf

`combat_working_draft` erhält Rohwerte (`-`, `1,5`), Ziel, ursprüngliche Basis und
Schreib-ID über Neustart. Je Editor laufen höchstens ein Write und sein neuester
Folgestand; nur die eigene Bestätigung schreibt die Statusbasis fort, kein
fremder Read. Ein ausdrücklicher Kampfcommand bestätigt Werte, Receipt und
Verbrauch genau dieser Draftfassung atomar; Replay verbraucht keine Folgeeingabe.
Entfernte/beendete Ziele behalten kopierbare Entwürfe. Zustandskürzel schreiben
sofort, bei offenen Werteingaben erst nach deren Übernahme/Verwerfung.

Die Auswahl liest Fokus, Szenenparty und vorbereitete Gruppen transaktional;
unbeteiligte Progressions-/Beuteleser sind keine Voraussetzung. Der Kampfwriter
prüft Party-/Fokus- und Gruppenbasis vor Übernahme erneut. Verstärkung verwendet
denselben Gruppenprüfweg; verworfene oder fremde Gruppen erzeugen keine Runtime.

## Spontane Katalogübernahme ohne Teilkampf

Die erste Katalogkreatur gehört zur atomaren Kampfanlage. `CombatAction.create`
bindet optional `catalogCreature` (ID, Anzahl, Gruppenmodus); derselbe
`addCreature`-Pfad wie bei Verstärkung löst sie vor dem ersten Kampfrecord auf.
Plan, Generator und Szenengruppenauswahl sind getrennte Anlagequellen und dürfen
nicht gleichzeitig gebunden werden. Bei fehlendem/abgeschlossenem Kampf sendet
der Renderer einen Anlageauftrag, bei offenem Kampf einen `add-creature`-Auftrag.
Die ausdrückliche spontane Katalogübernahme und die Szenengruppenauswahl bleiben
erreichbar; es entsteht keine zweite veränderliche Planungskopie.

Ungültige Daten, veraltete Membershipbasis und spätere Receiptfehler rollen die
gesamte Anlage zurück, einschließlich der ersten Gegner. Replay und bestehende
`commitStatus`-Klärung bestätigen denselben vollständigen Kampf. Bestehende
Receiptformate und Kampfdaten bleiben ohne Schemawechsel erhalten.

Initiativewürfe verwenden ausschließlich die Vorschau in `combat-initiative.ts`
und den gesicherten Initiativeentwurf; erst `initiative` übernimmt die Werte
atomar. Der frühere direkte `roll`-Schreibweg entfällt. Bereits bestätigte
historische Receipts werden weiterhin als gespeichertes Ergebnis wiederholt,
ohne neu zu würfeln.

Die gezielten Store-/Controllerprüfungen decken Party/Mob, Fresh/Replay,
Quellenkonflikte, Rollback und verlorene Antwort ab. Die native Probe führt bei
100/200 % Katalogauswahl, kontrollierte Ablehnung/Replyverlust, Spieler-/Gruppeninitiative,
individuelle HP, Zugwechsel/Undo, XP-Abschluss und Neustart gemeinsam aus.
Das ersetzt keine großen Kampf-/History-, Mehrplattform- oder physischen
Eingabeabnahmen. Anlage-/Gegnerrohentwürfe und andere Anlagewege bleiben offen.

## Gemeinsame Gesundheitsfakten über Kampfmasken

`character_progress` publiziert vollständige PC-Gesundheit samt Todesrettungen
in offene Masken derselben Figur; entfernte Flags dürfen nicht fortbestehen.
Initiative, Identität, Runde und Zug bleiben maskenlokal. Der atomare Write
erhöht Maskenrevisionen und entwertet ihr Undo; Undo beim ursprünglichen Owner
publiziert die Wiederherstellung erneut. Abgeschlossene Kämpfe bleiben historisch.
Reopen übernimmt den neuesten offenen PC-Fakt, erfindet keine verlorenen Fakten.

Kopien remappen `lastUsedTurnId` mit Zug-ID/Teilnehmern und erhalten `lastUsedRound`:
sonst wäre die verbrauchte legendäre Aktion erneut verfügbar.

Mobkarten erhalten bestätigte Trupp-/Teilnehmeridentitäten und individuelle Züge;
kein HP-Pool oder Schadensüberlauf. Anzeige und Frontwechsel erklärt
`combat-mob-ui.ts`; die Karte besitzt keine zweite Kampfautorität.

## Nachbereitung und bestehende Schätze

Ein Snapshot liest Outcome-/XP-Buchung und vorhandene Kampf-/Scene-/Ortsschätze
(25 pro Seite) mit Gesamt-/Restmenge, auch vollständig verteilte. Geprüfte IDs und
Cursor begrenzen den Read; er erzeugt keine Beute, Awards oder Gruppen. Ein
Abschluss ohne neue Beute bedeutet nicht Schatzfreiheit.
`TreasureDistribution` verwendet bestehenden Command/Ledgerwriter und wählt
aktuelle Scene-Mitglieder vor. Der Guard bindet Read, Öffnung nach Flush und
Bestätigung an den Abschluss; Kontextwechsel schließen nur den alten Aufruf,
nicht globale Treasuryaufrufe. Verteilung aktualisiert Restmenge, nicht XP.
Lesefehler bieten Retry statt Beutefreiheit.

## Offene Lieferung und Beleggrenzen

- Anlage-/Gegnerentwürfe ergänzen: Anlage bindet Scene/Membership ohne erfundene
  Kampf-ID, Abschluss den Kampf und Outcome/Reward. Scenewechsel, beendetes Ziel,
  Konflikt, Replyverlust und späte Antwort erhalten Rohwerte; nur die bestätigte
  Draftfassung wird verbraucht. Andere Editoren brauchen eigene Abnahmen.
- Vollständige NPC-/Sourcegruppen-Provenienz und Reconciliation sowie der
  originale Resolution-Schritt vor dem XP-Command bleiben offen. Mehrgruppenstart,
  Rewardpolicy und einmaliger Abschluss brauchen einen gemeinsamen
  Restart-/Scenewechselnachweis. Gesundheits-, Mob- und Treasurytests ersetzen ihn nicht.
- Storetests prüfen CAS/Replay/Rollback, Korruption, Backup und Kopie/Erasure.
  Format-33-Pakete ohne spätere Draft-/Content-/Narrativtabellen werden abgewiesen;
  eigene alte Stores rüsten die Tabellen auf. Beides erhält Quelldaten.
  [Historischer Linux-Close/Fresh-Beleg](../../reference/technical-foundation-20261011/combat-drafts-native-20261013.json):
  vier Abläufe, zwei normale Exits, hashgebundener Build 0.29.0; kein aktueller
  Buildnachweis. Offen bleiben Hard-Crash, große Draftmengen, IME, Screenreader,
  andere Plattformen und vollständige Legendary-/Mehrmasken-/Undo-Bedienung.
