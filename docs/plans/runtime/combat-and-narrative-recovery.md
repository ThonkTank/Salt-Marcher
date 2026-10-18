# Kampfentwürfe und narrative Belohnungen: Datenregeln und nächste Lieferung

Stand: 16.10.2026. Ergänzt den [Party-/Liveplan](smr03-live-scene-contract.md)
und die [manuelle Vorbereitung](../campaign/manual-session-planner.md).
Der Atlas ist keine Voraussetzung für diese Abläufe. Gesamtumfang und
Lieferabhängigkeiten bleiben in [SCOPE](../../SCOPE.md) und [ROADMAP](../../ROADMAP.md).

## Implementierter Anschluss

Kampfteilnehmerfelder und Kampfnotizen besitzen eigene Rohentwürfe in
`combat_working_draft`. `src/app/combat-draft-contracts.ts` beschreibt ursprüngliche
Basis, Ziel und Schreib-ID; `src/app/storage/combat-drafts.ts` prüft Eigentümer,
Byteintegrität und CAS. `src/app/combat-draft-cache.ts` hält pro Editor höchstens
einen laufenden Schreibauftrag und den neuesten Folgestand. Seine Statusbasis darf nur um den eigenen bestätigten Schritt
fortschreiten; ein späterer Read eines fremden Updates darf sie nicht ersetzen. Rohe Zwischenwerte
wie `-` und `1,5` bleiben Eingaben; sie ändern keinen bestätigten Kampfwert.
Ein ausdrücklicher Kampfcommand bestätigt Fachwerte, Receipt und Verbrauch nur
der passenden Entwurfs-ID gemeinsam. Ein Receipt-Replay verbraucht keine spätere
Eingabe. Entfernte Teilnehmer und beendete Kämpfe behalten kopierbare Entwürfe.

Zustandskürzel ändern den Zustand direkt. Bei offenen
Werteingaben bleiben sie gesperrt, bis diese ausdrücklich übernommen oder
verworfen wurden; ein Zustandsklick bestätigt keine nebenbei bearbeiteten HP
oder Initiative. Rohe Entwürfe bleiben auch über einen Neustart erhalten.

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

Narrative Metadaten besitzen inzwischen einen eigenen Rohentwurf in
`narrative_draft`: Status, Ort, Mitwirkende, XP und Itemzeilen. Gemeinsame
Struktur-/Ownerprüfungen gelten für Schreiben, Lesen und Backup/Paketannahme.
Checksummed falsche Notiz-IDs, fremde Mitwirkende oder falsche Rohfeldtypen
werden zurückgewiesen; `-`, `1,5` und archivierte gültige Eingaben bleiben erhalten.
Der unveränderte Entwurf wird bei einem Fehler nicht überschrieben.

Bei der unabhängigen Kopie wurde zusätzlich eine konkrete Historylücke gefunden:
`progress_event` behielt bei `sourceKind=quest/rumor` die alte `sourceId`, obwohl
Notiz, Award und Empfänger remappt waren. Der Transfer remappt jetzt genau diese
fachliche Notizreferenz. Andere `sourceId`-Verträge und freie Prosa bleiben erhalten.

Der gemeinsame Abschlussdialog bindet Lesen, Autosave, Verwerfen und Bestätigung
an die ursprüngliche Sitzung. Ziel- und Kampagnenwechsel entwerten alte Antworten
und Timer; spätere Eingaben werden nach einer bestätigten Verwerfung unter neuer
Schreibbasis gesichert. Die [Dialogprüfungen](../../../tests/desktop-finish-draft-dom.test.mjs)
prüfen diese Übergänge und den Erhalt wortgetreuer Rohtexte über echte Stores.
Der [Entwurfsspeicher](../../../tests/desktop-finish-draft-store.test.mjs) prüft
Rohfeldtypen, Ziel, Revision, Empfänger und Gegenstandsreferenzen beim Lesen,
Schreiben und Backup. Beschädigte Daten ersetzen keine gültige Sicherung.
Kopie und Fresh remappen strukturierte IDs, erhalten Prosa und unfertige Zahlen;
archivierte Ziele bleiben zulässige historische Eigentümer.
Das Journal teilt den bestehenden Editor. Auswahl, Navigation und Close binden
Campaign, Öffnung und Listen-/Detailstand; parallele Closeaktionen teilen einen
Auftrag. Ein gesendeter Save wiederholt nach Ownerwechsel keine neuen Rohfelder.
Die Kontextgegenproben in `desktop-narrative-journal-context.test.mjs` ergänzen
die Store-/DOMprüfungen; die vollständige native Abschluss- und Recoveryabnahme
bleibt offen.

Narrative Rohentwürfe binden ihre ursprüngliche Notiz- und Statusrevision.
Frische Reads prüfen diese Basis; erst ausdrückliches Übernehmen bestätigt einen
geänderten Stand. Altentwürfe ohne Notizrevision bleiben lesbar und verlangen
eine ausdrückliche Prüfung. Status/Award konsumieren genau den geprüften Entwurf;
neuere Rohfelder werden durch ältere Speicherklicks nicht überschrieben.
`desktop-narrative-basis.test.mjs` prüft diesen Weg mit echtem Store und Controller.

## Legendäre Aktion nach unabhängiger Kopie

Der neue legendäre Aktionsstand speichert `lastUsedRound` und `lastUsedTurnId`.
Die Zugreferenz ist eine lokale Teilnehmeridentität. `campaign-data.ts` remappt
sie beim Kopieren zusammen mit aktueller Zug-ID und Teilnehmern; andernfalls
könnte eine bereits benutzte Aktion im kopierten selben Zug wieder verfügbar
erscheinen. `desktop-legendary-transfer-integrity.test.mjs` führt eine echte
Abolethaktion aus, exportiert/kopiert die Campaign, prüft die neue Zugreferenz
und weist eine zweite Aktion im selben Zug ohne Zustand/Receiptwirkung ab.
Die Originalpaketbytes bleiben unverändert.

`removePartyFromMasks` bleibt der gemeinsame Übergang für alle laufenden Masken.
Der integrierte legendäre Reset beim Wechsel des entfernten aktiven Teilnehmers
bleibt mit Roundfortschritt, Before-/Afterrevision und Reconciliationrecord
verbunden. Diese lokalen Belege und die vorhandenen Wechselprüfungen schließen
nicht die gesamte Legendaryregel-, Mehrmasken-/Undo- oder native Bedienabnahme.

## Spontane Katalogübernahme ohne Teilkampf

Die erste Katalogkreatur gehört zur atomaren Kampfanlage. `CombatAction.create`
bindet optional `catalogCreature` mit ID, Anzahl und Gruppenmodus;
die Quelle wird vor dem ersten Kampfrecord über denselben `addCreature`-Pfad
wie spätere Verstärkung aufgelöst. Kombinationen mit Plan, Generator oder
Szenengruppenauswahl werden abgewiesen. Der Renderer sendet bei fehlendem oder
abgeschlossenem Kampf genau diesen einen Auftrag. Ein bestehender offener Kampf
erhält weiterhin einen einzelnen `add-creature`-Auftrag.

Damit entfallen die frühere leere Anlage und der zweite Schreibauftrag für
die ersten Gegner. Ungültige Daten, eine nicht mehr passende Membershipbasis
oder ein später Receiptfehler rollen die gesamte Anlage zurück. Receipt-Replay
und die vorhandene `commitStatus`-Klärung bestätigen genau den vollständigen
Kampf; bestehende Receiptformate und gespeicherte Kämpfe bleiben unverändert.
Ein eigener Tabellen-/Schemawechsel ist nicht erforderlich. Die ursprüngliche
reine Szenengruppenauswahl bleibt ein eigener Einstieg; die im Produkt bereits
angebotene ausdrückliche spontane Katalogübernahme bleibt erhalten.

`desktop-combat-reinforcement.test.mjs` prüft Anlage mit Party und Mob,
Fresh/Replay, Fehlerrollback einschließlich Receipt, Quellenkonflikte und den
tatsächlichen Rendererauftrag bei fehlender Kreatur und verlorener Antwort.
Die native Prüfung `tools/test-desktop-catalog-combat.mjs` führt Katalogauswahl,
kontrollierte Ablehnung/Replyverlust, individuelle Spieler-/gemeinsame
Gegnerinitiative, Schaden, Zugwechsel/Undo, Abschluss und Neustart bei 100/200 %
zusammen aus. Diese kleinen Fixtures ersetzen keine große Kampf-/History-,
Mehrplattform- oder physische Eingabequalifikation. Anlage-/Gegnerrohentwürfe
und unbekannte Ausgänge über andere Einstiegspfade bleiben unten offen.

## Geprüfter Umfang

- `tests/desktop-narrative-integrity.test.mjs`: falsche Statusidentität/-revision,
  falsche Awardidentität, verlorener Status oder Awardlink, archivierte Notiz,
  unabhängige Kopie mit unveränderter Prosa/Quelldatei und indizierte Abfrage;
  zusätzlich Rohentwurf mit falscher Owner-ID/Feldtyp/fremdem Mitwirkenden,
  Kopie/Archiv gültiger Rohwerte und positive Belohnung in aktiver Scene mit
  101 XP auf zwei Empfänger (je 51), zwölf Münzen, drei zugeteilten Münzen,
  remapptem XPquellverweis und unabhängiger Weiterexistenz nach Quelllöschung.
- `tests/desktop-combat-drafts.test.mjs`: Fresh-Store, CAS, Replay, atomarer
  Draftverbrauch und Rollback, stale Basis, entfernte/beendete Ziele, beschädigte
  Quelle, Backup, Kopie/Erasure und tatsächliche Format-33-Aufrüstung auf den
  aktuellen Stand auf einer eigenen Kopie. Format 33 besitzt die späteren
  Draft-/Content-/Narrativtabellen einschließlich `narrative_draft` im Test ausdrücklich noch nicht.
- Zusammen mit `tests/desktop-key-discovery.test.mjs`: 27 lokale Storeprüfungen
  bestanden; Desktop-Typecheck bestanden. Das qualifiziert diese Verträge,
  nicht die vollständige XP-/Loot-/History- oder Produktbedienung.
- [Linux-Close/Fresh-Beleg](../../reference/technical-foundation-20261011/combat-drafts-native-20261013.json):
  vier kleine Abläufe in zwei regulär beendeten Electronprozessen des dort
  hashgebundenen Builds 0.29.0. Dieser frühere Build wurde nach der jetzigen
  Integration nicht erneut nativ qualifiziert. Hard-Crash, große Draftmengen,
  IME, Screenreader und andere Plattformen bleiben offen.

## Nächste ausführbare Schritte

1. **Unbekannten Narrative-Commandausgang schließen.** Notiz-/Statusbasis sind
   inzwischen im Metadatenentwurf erhalten; der Renderer behält sie beim Submit
   und der Writer bindet den Entwurfsverbrauch daran. `NarrativeDraft` und
   `FinishDraft` speichern jedoch noch keinen ungeklärten Command. Der separate
   Abschlussentwurf bindet jetzt ebenfalls Status- und ursprüngliche Notizrevision.
   `finish-draft-contracts.ts` hält `noteRevision` optional für historische Rohdaten;
   `finish-draft-ui.ts` erhält fehlende/alte Basen bei gewöhnlichem Editieren und
   bietet ausdrückliche Übernahme. `narrative-ui.ts` übergibt die tatsächlich
   geprüfte Notizbasis an den Abschluss und verwendet sie im Awardcommand.
   `storage/finish-drafts.ts` prüft positive sichere Revisionswerte sowie die
   gespeicherte Basis beim atomaren Consume; `storage/progression.ts` übergibt
   beide Actionbasen. Kein SQLschemawechsel oder automatisches Legacyrewrite.
   Fresh-/DOM-/SQLiteproben in `desktop-finish-note-basis.test.mjs` prüfen
   verworfene Publikation mit unveränderten DBbytes, Legacyprüfung, rohe ungültige
   Zahlen/Wortlaut, unabhängige Kopie, ausdrücklichen Abschluss und Receiptreplay.
   Diese lokalen Belege ersetzen keine native Abschlussabnahme. Nächster
   Anschluss in `narrative-ui.ts` und bestehender Entwurfsspeicherung: vor dem
   Senden Command-ID, `progress`-Fingerprint, bestätigte Actionbasis und die
   betroffene Write-ID dauerhaft an das Entwurfsziel binden. Nach Replyverlust
   `CampaignAPI.commitStatus` mit dem bestehenden Progressreceipt lesen; erst
   danach eine ausdrückliche Fortsetzung freigeben. Ein früheres Receipt darf
   spätere Eingaben nicht rebasieren oder verbrauchen. Nicht bestätigte Commands
   und neuere Rohwerte müssen dabei nebeneinander erhalten bleiben.
   Abnahme: ungültige XP/Preiswerte und Ergebnistext → Wechsel/Close/Fresh →
   korrigieren → einmal bestätigen; verlorene Antwort nach bestätigtem Write,
   Quellenänderung vor Publish und spätere Eingabe während Recovery erzeugen
   keine automatische Belohnungswiederholung. Danach Journal → Metadatenentwurf
   → Abschluss → Welttexteditor → Rückkehr nativ gemeinsam abnehmen. Esc,
   langsamer Datenträger und nicht lesbarer Entwurf erhalten Rohwerte und
   schließen keine neuere Ansicht.
2. **Kampfanlage und Abschluss schließen.** In `src/app/combat-contracts.ts`,
   `src/app/combat.ts` und bestehendem Draftstore Anlage- und Gegnerfelder
   ergänzen; die integrierten Abschlussentwürfe gegen Konflikte/Replyverlust prüfen. Anlage bindet Scene und Membershipbasis ohne erfundene Kampf-ID;
   Abschluss bindet konkreten Kampf und offene Outcome-/Rewardeingaben. Bestätigung
   verbraucht genau die angenommene Draftfassung atomar. Abnahme: Scenewechsel,
   beendetes Ziel und verzögerte Antwort verlieren keine Rohwerte und schreiben
   keine andere Scene. Diese Erweiterung qualifiziert keine Characterprofile,
   Timelinebesuche, Wetter- oder Musikfelder; deren eigene offene Anschlüsse im
   jeweiligen Fachplan bleiben bestehen.
3. **Datenabschluss über die Übergänge prüfen.** In `storage/progression.ts`,
   `storage/campaign-data.ts` und der Backupvalidierung prüfen, ob Award,
   XPhistory, Treasure und Entwürfe vollständig kopiert, archiviert und gelöscht
   werden. Die kleine positive XP-/Loot-/Kopier-/Quelllöschprobe ist jetzt bestanden;
   danach Receiptreplay und Weiterverkauf in der Kopie, Forks mit mehreren
   Notizen/Scenes, archivierte Roster-/Ortsreferenzen sowie Erasure der Kopie
   einschließlich Historien und Entwürfen prüfen. Eine unabhängige Kopie behält
   ihre gewählten Inhalte nach Quelllöschung; Löschung innerhalb einer Kampagne
   darf diese Personen nicht aus versteckten Historien rekonstruieren. Danach native
   Spielabendprobe mit Vorbereitung, Live-Scene, Belohnung und Fresh. Lokale
   Tabellen-/Checksumprüfungen ersetzen diese Produktabnahme nicht.

## Gemeinsame Gesundheitsfakten über Kampfmasken

Die [Encounter-Originalanforderung](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/encounter/requirements/requirements-encounter.md)
trennt Scene-/Partygesundheit von Initiative, Runde und Zug. Der bestehende
`storage/mask-health.ts`-Anschluss publiziert deshalb den vollständigen bestätigten
PC-Gesundheitswert, einschließlich optionaler Todesrettungen, in
`character_progress` und die anderen offenen Kampfmasken derselben Figur.
Er übernimmt neue Zähler und entfernt Todesflags nach Heilung ausdrücklich;
ein fehlendes Optionalfeld darf keine ältere Kopie zurücklassen. Die lokale
letzte Todeswurfmeldung wird bei geänderten gemeinsamen HP/Todesfakten entfernt.
Endet die gemeinsame Konzentration, entfallen unauflösbare offene Prüfungen in
den anderen Masken. Initiative, Teilnehmeridentität, Runde und Zug bleiben erhalten.

Der bestehende gemeinsame Write aktualisiert diese Projektionen atomar, erhöht
betroffene Maskenrevisionen und entwertet deren älteres Undo. Undo im ursprünglichen
Owner publiziert die tatsächlich wiederhergestellten Gesundheitsfakten erneut.
Abgeschlossene Kämpfe bleiben historische Ergebnisse und werden nicht synchronisiert.
Die vorhandene Reopenmigration übernimmt den neuesten offenen PC-Fakt pro Figur
mit derselben vollständigen Projektion; keine neue Tabelle oder Schemaänderung.
Bereits verlorene historische Fakten werden dabei nicht erfunden.

Echte Storegegenfälle prüfen zwei Masken mit abwechselnden Erfolgen/Fehlschlägen,
kanonische Progressbytes, Heilung/Undo/Reopen, unveränderte abgeschlossene History
und beendete Konzentration bei offener Prüfung. Native Bedienung prüft den
entsprechenden Todesrettungs-/Heilungsweg und die gesperrte alte Undoaktion.
Die Mehrgruppenauswahl liest inzwischen über
`storage/scene-encounter-selection.ts::readSceneEncounterSelection` einen
transaktionalen Stand aus Fokus, Szenenparty und vorbereiteten Gruppen; fremde
Progressions- und Beuteleser sind keine Voraussetzung. `combat-selection-ui.ts`
bewertet diese Auswahl, `storage/combat.ts` prüft Party-/Fokus- und Gruppenbasis
vor der Übernahme erneut. Verstärkung verwendet dort denselben Gruppenprüfweg.
[Store-/DOM-Gegenfälle](../../../tests/desktop-scene-encounter-selection.test.mjs)
prüfen Auswahl, veraltete Basis, einzelne Figuren und unabhängige Lesefehler.
Vollständige NPC-Reconciliation, Rewardpolicy und einmaliger Abschluss benötigen
weiter ihren gemeinsamen Restart-/Scenewechselnachweis; Gesundheitsproben und
Auswahltests ersetzen diese Abnahme nicht.

## Nachbereitung und bestehende Schätze

Der abgeschlossene Encounter zeigt seine bestätigte Outcome-/XP-Buchung und
eine paginierte, typisierte Treasuryprojektion (25 Zeilen): Provenienz aus
diesem Kampf, Zuordnung zu dieser Scene oder dem aktuellen Scene-Ort sowie
Gesamt-/Restmenge. `storage/combat-resolution.ts` liest Abschluss und Schätze in
einem Snapshot. Scene-/Kampf-ID und Kampagne werden geprüft; das Read erzeugt
keine zweite Beute, keinen Award und keine Gruppen. Auch ohne neue Beute im
Abschlussdialog können bereits zugehörige Schätze vorliegen. Vollständig
verteilte Schätze bleiben als solche sichtbar.

`combat-resolution-ui.ts` öffnet die gemeinsame `TreasureDistribution`, mit den
aktuellen Scene-Mitgliedern vorausgewählt. Der Dialog behält seinen vorhandenen
Prüf-/Bestätigungscommand und Ledgerwriter. Ein optionaler Aufruferguard bindet
Lesen, Öffnen nach Flush und Bestätigung an den ursprünglichen Abschluss. Scene-,
Campaign- oder Kampfwechsel entwerten alte Rückläufe und schließen ausschließlich
den dadurch veralteten Aufruf. Neue globale Treasuryaufrufe bleiben unabhängig.
Nach Verteilung wird die Restmenge erneut gelesen; XP bleibt unverändert.
Fehlende Lesbarkeit wird nicht als Beutefreiheit angezeigt, sondern bietet Retry.

Store-/DOMgegenproben: Abschluss mit einmaligem 101-XP-Pool auf zwei Figuren,
Verteilung/Restmenge, Fresh und unabhängige Kopie mit remappten Schatz-/Kampf-IDs,
28 Ortsschätze mit zwei Seiten, echter Leerzustand, fremde Scene/ungültiger Cursor,
späte Reads, Kontextwechsel und ausstehender Flush. Native Bedienung wird am
aktuellen Paket separat geprüft.

Die volle originale Encounter-Selection mit Mehrgruppenstart, durchgehender
Sourcegruppen-Provenienz/Reconciliation und vorgeschaltetem
Resolution-Schritt vor dem XP-Command bleibt gesonderter Umfang. Dieser Anschluss
schließt die Treasuryübergabe nach dem bestehenden atomaren Abschluss ab.

## Kompakte Mobübersicht

Bestätigte `partitionKind=mob`-Initiativeplätze erscheinen als eine kompakte
Karte mit der Anzahl von Mitgliedern über 0 HP, vorderem lebendem Mitglied,
individuellen HP/temporären HP, RK, Initiative und dessen Zuständen. Getrennte
Trupp-IDs bleiben getrennt, auch bei identischem Statblock. Alte unmarkierte
Gruppen und Einzelpartitionen werden nicht aus einer neuen Größenschwelle
umgedeutet. „Mitglieder zeigen“ öffnet alle individuellen Zeilen einschließlich
der Mitglieder mit 0 HP. Schaden und Heilung öffnen den bestehenden Editor für
die ausgewählte Identität; es gibt keinen zweiten Mob-HP-Pool und keinen
Schadensüberlauf auf weitere Mitglieder.

Das vordere Mitglied rückt beim Verlust seiner letzten HP weiter; Undo stellt
die ursprünglichen Werte und damit auch die Vorderposition wieder her. Der
aktive Teilnehmer kann davon abweichen und bleibt ausdrücklich erreichbar.
Jeder Teilnehmer behält seinen bisherigen Zug. Bereits beendete Züge sind
markiert, die Karte zeigt ihren Fortschritt in der aktuellen Runde. Neue
Verstärkung bleibt an die bestätigte Partition gebunden. Die aufgeklappte
Ansicht ist nur lokaler Anzeigezustand; HP, Zustände, Runde und Zug kommen
nach Neustart erneut aus dem gespeicherten Kampf und seinen kanonischen
Szenenmitgliedern. Alte Kartenaktionen verlieren bei Kontext-/Revisionswechsel
ihre Berechtigung.

Die Store-/DOMfälle in `tests/desktop-combat-mob.test.mjs` prüfen Frontwechsel,
individuelle Werte, Undo/Reopen, getrennte Partitionen, Verstärkung, Zugfortschritt
und veraltete Kartenaufrufe. Die vollständige ursprüngliche Encounter-Selection
und sämtliche Reconciliation-/Resolutionvorgaben bleiben eigenständiger Umfang.
