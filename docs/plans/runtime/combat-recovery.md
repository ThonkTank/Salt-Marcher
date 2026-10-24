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
| Gemeinsame PC-Gesundheit | `progression.ts`, `storage/mask-health.ts` | `desktop-combat-hit.test.mjs`, `desktop-review-integrity.test.mjs` |
| Konzentrationswarteschlange und SG | [storage/combat.ts](../../../src/app/storage/combat.ts): `applyCombatDamage`, Commands `concentration`/`concentration-roll`; [combat-contracts.ts](../../../src/app/combat-contracts.ts): `concentrationDc`, `checkedCombat` | [desktop-combat-hit.test.mjs](../../../tests/desktop-combat-hit.test.mjs) |
| CON-Vorschlag und Feldkorrektur | [combat.ts](../../../src/app/combat.ts): `creatureConstitutionSave`, `renderConcentrationEffect`, `execute`, `recoveredCombat` | [desktop-combat-switch.test.mjs](../../../tests/desktop-combat-switch.test.mjs), [native Konzentrationsprobe](../../../tools/test-desktop-concentration.mjs) |
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

## Konzentration im Kampf

Konzentration lässt sich bei der ausgewählten Figur unter **Zustände und
Konzentration** unmittelbar beginnen oder beenden; der vollständige Werteeditor
ist dafür nicht erforderlich. Offene Werteentwürfe sperren diese Schnellaktion,
damit keine unbestätigten Angaben übergangen werden. Bei einer offenen
Konzentrationsprüfung bleibt sie ebenfalls gesperrt. Zugwechsel und Abschluss
warten weiterhin auf die ausdrückliche Klärung.

Die Prüfung übernimmt den CON-Rettungswurf aus dem im Kampf gespeicherten
Statblock, einschließlich eines dort angegebenen Rettungswurfbonus. Ohne
gesonderten Bonus gilt der CON-Attributsmodifikator. Unbekannte Werte bleiben
ausdrücklich zu prüfen; die Zahl ist für GM-Korrekturen editierbar.
`renderConcentrationEffect` erhält diese flüchtige Korrektur bei erneutem Lesen
und zusätzlichen Treffern. Erst die bestätigte Prüfung oder Rücknahme setzt
`checkKey` zurück und beginnt wieder mit dem Statblockwert. Dafür beide
Bestätigungswege in `execute` und `recoveredCombat` beachten, auch bei verlorener
Antwort; Ablehnung darf den Feldinhalt nicht verwerfen. Gleicher Schaden und SG
sind keine Prüfidentität. Die Rückbindung nutzt die [gemeinsame
Buchungsbestätigung](../../../ARCHITECTURE.md#buchungsantworten-klären) ohne
neue gespeicherte Kennungen.
Die native Probe `tools/test-desktop-concentration.mjs` führt zwei gleiche,
getrennt gebuchte Treffer, Bestanden/Rücknahme/Verloren, weiteren Schaden ohne Konzentration,
Neustart mit offener Warteschlange und Abschluss samt erneutem Öffnen bei
100/200 Prozent Browserzoom aus. Der gemeinsame Sitzungshelfer prüft Buildbindung,
frische Bilder und reguläres Prozessende. Das ist keine menschliche Bedienabnahme.

## Kampf wechseln und erneut laden

Die Schnellauswahl und der ausgewählte Kampf verwenden dieselben Zeilen aus
einem SQLite-Lesestand. Liegt die Auswahl unter den letzten 100 Kämpfen, wird
ihre bereits geprüfte Zeile auch für die Liste verwendet. Nur ältere Ziele
benötigen eine zusätzliche gezielte Abfrage. Alle übrigen Listeneinträge werden
weiterhin auf Prüfsumme, Format und Zuordnung geprüft. Der Read verändert weder
Kämpfe noch Rohentwürfe.

Leseaufträge behalten ihre eigene laufende Nummer und den Szenen-/Kampagnenbezug.
Während eines Wechsels sperrt die Oberfläche alte Schreibaktionen; nur die
aktuelle Antwort darf Auswahl und Editor übernehmen. Ein Lesefehler erhält das
angeforderte Ziel für einen ausdrücklichen Retry. Die Fehlermeldung nennt den
bekannten Kampftitel und bietet direkt **Erneut laden** an; dafür muss das Menü
**Andere Kämpfe / aktualisieren** nicht geöffnet werden. Beide Ladebuttons
verwenden denselben angeforderten Zielbezug und dieselbe Antwortprüfung.
Entwürfe bleiben ihrem Kampf zugeordnet, auch beim Besuch eines abgeschlossenen
Kampfes.

`tools/test-desktop-combat-switch.mjs` prüft den direkten Retry bei 100/200 Prozent
Browserzoom, den erhaltenen unvollständigen Notizentwurf nach Kampfwechsel und
Neustart sowie seine Korrektur, Speicherung und erneute Wiederöffnung. Die
Controllerprüfungen in `desktop-combat-switch.test.mjs` ergänzen verspätete
Antworten und Schreibsperren. Native Automatisierung ersetzt keine menschliche
Bedienabnahme.

## Spontane Katalogübernahme ohne Teilkampf

Die spontane Auswahl öffnet am Spieltisch dieselbe Suche wie spätere Verstärkung.
Ein separater Vorlagenkatalog und die erneute Quellenwahl entfallen. Der erste
`catalogCreature`-Auftrag erzeugt Szenengruppe, Weltfiguren und Initiative in
einer Transaktion. Weitere `add-creature`-Aufträge materialisieren ihre Figuren
auf dieselbe Weise. `scene_opponent_group` bindet diese Gruppen auch ohne Ort
oder übernommenen Spielabendbesuch an die Szene (Speicherversion 51).

Die Originalanforderungen verlangen Scene-eigene Figuren und fortgeführte HP;
der bisherige Katalogweg erzeugte nur anonyme Kampfteilnehmer. Die Katalogwahl
ist deshalb eine Übernahme in die Szene. Die Initiative referenziert deren
`worldActorId` und verwendet den bestehenden gemeinsamen HP-Speicher. Der
Abschluss behält sein historisches Ergebnis; eine erneute Begegnung verwendet
die überlebenden Figuren mit ihrem aktuellen Zustand. Alte anonyme Kampfarchive
werden nicht nachträglich mit erfundenen Weltidentitäten versehen.

Während der Vorbereitung bleibt die Katalogauswahl nach bestätigter Übernahme offen. Sie zeigt die tatsächlich vorbereiteten Trupps, leert die übernommene Auswahl und bietet den direkten Übergang zu „Initiative eintragen“. So lassen sich mehrere Kreaturenarten nacheinander übernehmen, ohne zwischen Auswahl und Kampfansicht zu wechseln. Erst die bestätigte Übernahme zählt zum angezeigten Bestand; eine fehlgeschlagene oder ungeklärte Buchung erhält ihre Eingaben und den bestehenden Schreibschutz. Verstärkung im laufenden Kampf kehrt nach Bestätigung zur Runde zurück.

Ungültige Daten, veraltete Membershipbasis und spätere Receiptfehler rollen die
gesamte Übernahme einschließlich Gruppen und Figuren zurück. Replay und
`commitStatus` bestätigen denselben vollständigen Vorgang. Bestehende
Receiptformate und Kampfarchive bleiben erhalten.

Initiativewürfe verwenden ausschließlich die Vorschau in `combat-initiative.ts`
und den gesicherten Initiativeentwurf; erst `initiative` übernimmt die Werte
atomar. Der frühere direkte `roll`-Schreibweg entfällt. Bereits bestätigte
historische Receipts werden weiterhin als gespeichertes Ergebnis wiederholt,
ohne neu zu würfeln.

Kreatur- und Vorlagenübergabe aus dem Katalog verwenden denselben Einstieg in
die Liveansicht. Er bindet das Kampagnentoken vor dem Flush und prüft es nach
Flush und Live-Read erneut. Ein verworfener oder fehlgeschlagener Read beendet
die Übergabe; eine neu geöffnete Kampagne erhält keinen alten Anlageauftrag.

Die gezielten Store-/Controllerprüfungen decken Party/Mob, Fresh/Replay,
Quellenkonflikte, Rollback und verlorene Antwort ab. Die native Probe führt bei
100/200 % Katalogauswahl, kontrollierte Ablehnung/Replyverlust, Spieler-/Gruppeninitiative,
individuelle HP, Zugwechsel/Undo, XP-Abschluss und Neustart gemeinsam aus.
Das ersetzt keine großen Kampf-/History-, Mehrplattform- oder physischen
Eingabeabnahmen. Anlage-/Gegnerrohentwürfe und andere Anlagewege bleiben offen.

## Flächenschaden: eine gebundene Entscheidung

Die Zielauswahl übernimmt auf Wunsch die Party, einen vorhandenen Trupp oder
alle Teilnehmer; einzelne Ausnahmen bleiben direkt abwählbar. Die Auswahl ist
ein Entwurf, bucht keinen Schaden und erhält bereits gewählte Rettungswürfe.
Figuren mit unbekannten HP bleiben ausgeschlossen.

Der Dialog bindet Teilnehmer, Statblock und Revision beim Öffnen. Seine Vorschau
verwendet diese geprüfte Basis direkt; ein neuer Kampfstand sperrt die Übernahme
bis zum ausdrücklichen Wiederöffnen. Alte Zeilenangaben werden nicht mit neuer HP
oder neuer Abwehr vermischt. Die gemeinsame Schadensfunktion erhält nur den
betroffenen Statblock, statt selbst im gesamten Kampf zu suchen.

Der Writer indiziert seine kanonischen Teilnehmer und Quellen einmal je Command.
Ziel-ID, Dopplungen, Quellenbezug und Revision werden weiterhin atomar geprüft;
vorhandene Quellenreihenfolge und Receiptformate bleiben erhalten. Erst der
Rettungswurfanteil, dann die Abwehr: Die Berechnung bleibt mit der Vorschau geteilt.
Der bestehende native Katalog-/Kampflauf prüft zusätzlich zwei Feuerziele mit
vollem/halbem Anteil, unveränderte übrige Teilnehmer, ein gemeinsames Undo,
erneutes Anwenden, Fortsetzen, Abschluss und Wiederöffnen bei 100/200 %.

Nach bestätigtem Flächenschaden öffnen sich die betroffenen Mobkarten, damit
individuelle HP und unbetroffene Mitglieder direkt kontrollierbar sind. Andere
Trupps behalten ihren Aufklappzustand. Die Schreibbestätigung nennt die
tatsächlichen HP jedes Ziels; Rundenzähler und aktiver Zug bleiben erhalten.
`tools/test-desktop-area-results.mjs` prüft den vollständigen Ablauf mit vier
Ogern, drei Zielen und zwei bestandenen Rettungswürfen bis zum Abschluss und
Wiederöffnen bei 100/200 %. Das belegt keine menschliche Bedienabnahme oder
einen vollständigen aktuellen Vergleichslauf in einem anderen Produkt.

Schließen, Escape und Schreibschutz folgen dem gemeinsamen
[modalen Buchungsvertrag](../../../ARCHITECTURE.md#modale-buchungen).
Der Schadensdialog erhält bei fehlender Bestätigung seine Zielauswahl und Eingaben.
Nach erfolgreicher Statusklärung werden die betroffenen Mobkarten aus dem neu
lesbaren aktuellen Kampfstand geöffnet. Die Ziel-IDs bleiben dafür während des
laufenden Aufrufs im Bestätigungskontext; nach Neustart besitzt das Ticket nur
seine Belegreferenz. Dann öffnet die ausdrückliche Kontrolle die Gruppen des
bestätigten Kampfes. Fremde Kämpfe und fehlgeschlagene Reads übernehmen diese
Anzeigeentscheidung nicht. Historische Beleg-HP ersetzen niemals aktuelle HP.
Die native Flächenschaden-Probe führt den vollständigen Ablauf auch mit verlorener
Antwort bis zur Statusklärung, zum Abschluss und zum normalen Wiederöffnen aus.
Fehlenden flüchtigen Zielkontext prüft zusätzlich die Controllerprobe.

## Gemeinsame Gesundheitsfakten über Kampfmasken

Reguläre Party- und Kampfaktionen verwenden dieselben Übergänge für Schaden und
Heilung: Schaden bei 0 HP hebt Stabilisierung auf und zählt Fehlschläge; massiver
Schaden setzt den Todeszustand, 0 HP beendet Konzentration. Temporäre HP werden
zuerst verbraucht. Normale Heilung belebt Tote nicht wieder. Bewusste Party-Korrektur
(`set`) und ausdrückliche Wiederbelebung bleiben getrennte Aktionen. Die normalen
Eingabegrenzen gehören zum jeweiligen Command; bereits regelgerecht verstärkter
Flächenschaden darf diese Eingabegrenze überschreiten.

Bei 0 HP stehen Todesrettungen unmittelbar neben den HP-Aktionen, vor Zustands-
und Werteverwaltung. Erfolg, Fehlschlag und interner W20 bleiben direkt erreichbar;
die ausführliche Schadensregel steht unter „Sonderfälle und Korrektur“.
`tools/test-desktop-death-saves.mjs` führt Schaden, Erfolg und Fehlschlag, normalen
Neustart, Heilung, Zugwechsel, Abschluss und erneutes Öffnen mit Skalierungsfaktoren
1 und 2 aus. Die Sichtprüfung berücksichtigt die feste Musikleiste.

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
Die Verstärkungsauswahl nennt die ersten zwei vorhandenen Mitglieder je Trupp
(bei weiteren mit Auslassungszeichen), optional dessen Namen sowie Initiative
und Anzahl. Gleiche Kreatur, Initiative und Menge dürfen die Mitgliedsidentität
nicht verdecken. Der Command bindet weiterhin die gespeicherte Trupp-ID; die
Vorschau führt keine eigene Identität oder persistierten Namen ein.

## Verstärkung bei kurzer Ansicht

Laufende quellgebundene Mobkarten öffnen über „Verstärken…“ denselben Dialog
mit ihrer gespeicherten Trupp-ID und Fokus auf der Anzahl. Ein bloßes Öffnen
bucht nichts; eine veraltete Karte darf keinen neuen Dialog öffnen. Vorbereitete
Weltgruppen behalten ihren eigenen Auswahlweg.

Trupp/Katalogziel und Anzahl stehen nebeneinander; bei neuer Kreatur stehen
Initiative und Bestätigung gemeinsam darunter. Die laufende Runde und der
aktive Teilnehmer bleiben im Dialog sichtbar. Freie Einträge und vorbereitete
Szenengruppen bleiben ausdrücklich erreichbar. Bei geringer Fensterhöhe
scrollt die große Anwendungskopfzeile normal mit; die Bereichsnavigation bleibt
oben. Kampfroster und Tabelle erzwingen dort keine eigenen vertikalen
Scrollflächen. Musiktransport bleibt unmittelbar verfügbar.

Die [native Wiederholung und DM-Screen-Gegenprobe](../../reference/gm-ux-qa/2026-10-15-encounter-comparison.md#verstärkung-bei-kurzer-ansicht)
belegen den begrenzten Gegnerablauf mit unveränderten HP/Zuständen/Zug,
Neustart und Abschluss bei 100/200 %. Keine vollständige Party-, Reward-,
Mehrplattform- oder menschliche Bedienabnahme.

Die Verstärkung nutzt den [modalen Buchungsvertrag](../../../ARCHITECTURE.md#modale-buchungen)
und erhält Fehler und gewählte Eingaben im Dialog. Nach Belegklärung liest sie
den aktuellen Kampf, ohne Gegner erneut anzulegen.
Der Fehlerhinweis gilt auch für die erste Kataloganlage und freie Teilnehmer
ohne Statblock; vorbereitete Gruppen verwenden
ihren eigenen Auswahlweg. Die native Verstärkungsprobe wählt den Trupp ausdrücklich,
wartet vor dem Zoom auf das Fenster und entfernt alte Erfolgsdateien vor dem Start.
Mit `--reply-loss` prüft sie bei 100 % Truppverstärkung und bei 200 % eine neue
Katalogkreatur mit verlorener Antwort, einmaligem Receipt, unveränderten bisherigen
Teilnehmern, Fresh, Fortsetzen, Abschluss und erneutem Fresh. Kontrollierte Ablehnung
der ersten Kataloganlage prüft sie anschließend am abgeschlossenen Kampf ohne
neue Kampfmaske; den Schließschutz während des laufenden Writes prüft zusätzlich
der Controller.

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
