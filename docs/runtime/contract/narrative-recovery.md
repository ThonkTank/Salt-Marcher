# Quest-/Gerüchtabschluss: Entwürfe, Belohnung und Recovery

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Ergänzt [Party/Live](smr03-live-scene-contract.md) und die
[manuelle Vorbereitung](../../campaign/contract/manual-session-planner.md).
[Kampfentwürfe und Nachbereitung](combat-recovery.md) haben eigene Einstiege.
Gesamtumfang und Lieferabhängigkeiten: [SCOPE](../../project/requirements/scope.md),
[ROADMAP](../../project/delivery/roadmap.md). Der Atlas ist keine Voraussetzung.

## Zuständige Grenzen

Pfade sind relativ zu `src/app/`; Prüfungen stehen unter `tests/`.

| Aufgabe | Quelle | Gezielter Beleg |
| --- | --- | --- |
| Notiz, Status, Award und Metadatenentwurf | `storage/narrative.ts`, `narrative-ui.ts` | `desktop-narrative-integrity.test.mjs`, `desktop-narrative-basis.test.mjs` |
| Abschlussdialog, Autosave und Verbrauch | `finish-draft-contracts.ts`, `finish-draft-ui.ts`, `storage/finish-drafts.ts` | `desktop-finish-draft-dom.test.mjs`, `desktop-finish-draft-store.test.mjs`, `desktop-finish-note-basis.test.mjs` |
| Journalwechsel | `narrative-journal-ui.ts` | `desktop-narrative-journal-context.test.mjs` |
| Direkter Schatz am bestätigten Abschluss | `narrative-ui.ts`, `treasury-ui.ts`, `treasure-distribution-ui.ts` | `desktop-narrative-treasure.test.mjs`, `desktop-treasure-distribution-context.test.mjs` |
| XP, Beute und unabhängige Kopie | `storage/progression.ts`, `storage/campaign-data.ts` | `desktop-narrative-integrity.test.mjs` |

## Datenregeln, die mehrere Owner verbinden

Narrative Belohnungen verbinden Worldnotiz, Roster, XP und Loot. Byteintegrität
allein genügt nicht: SQL-Header, Notiz-/Status-/Awardidentität und Revision sowie
kampagneneigene Referenzen müssen semantisch zusammenpassen. Status und Award
werden in beiden Richtungen geprüft, auch beim transaktionalen Read und vor
Backup/Paketannahme. Ein verlorener Statuslink darf eine bestätigte Belohnung
nicht wieder unbezahlt erscheinen lassen. Der nicht eindeutige Index
`narrative_award_note(campaign_id,note_id)` beschleunigt die Suche; mögliche
Doppelbelohnungen sind Fehler und werden nicht automatisch bereinigt.

Archivierte Notizen und Orte bleiben gültige historische Eigentümer, unabhängig
von ihrer Editierbarkeit. Unabhängige Kopien remappen strukturierte Owner-IDs und
den `progress_event.sourceId` für Quest/Gerücht; andere Quellverträge und freie
Prosa bleiben erhalten. Awardtitel bleibt der damalige Titel. Beschädigte Quellen
werden weder normalisiert noch überschrieben; Zurückweisung erhält ein gültiges Backup.

`narrative_draft` hält rohe Status-/Orts-/Mitwirkenden-/XP-/Itemwerte, einschließlich
`-` und `1,5`, mit ursprünglicher Notiz- und Statusrevision. Falsche Owner,
Feldtypen oder fremde Mitwirkende scheitern bei Schreiben, Lesen und Backup.
Kopie/Fresh remappen Struktur, erhalten Wortlaut, unfertige Zahlen und gültige
archivierte Ziele. Ein Fehler ersetzt keine Rohwerte.

Der gemeinsame Abschlussdialog bindet Read, Autosave, Verwerfen und Bestätigung
an die ursprüngliche Öffnung. Ziel-/Campaignwechsel entwerten alte Antworten
und Timer; parallele Closeaktionen teilen einen Auftrag. Nach bestätigtem
Verwerfen werden spätere Eingaben unter neuer Schreibbasis gesichert. Ein Save
wiederholt nach Ownerwechsel keine neuen Rohfelder. Das Journal teilt diesen Editor.

Metadaten- und Abschlussentwurf bewahren die ursprüngliche Notiz-/Statusbasis.
Neue Reads oder gewöhnliches Editieren übernehmen keinen neueren Quellenstand;
ausdrückliche Prüfung ist nötig. Fehlende historische `noteRevision` bleibt
lesbar und ungeklärt. `narrative-ui.ts` übergibt die geprüfte Basis an Abschluss
und Awardcommand; der Writer prüft beide Actionbasen und verbraucht nur die
angenommene Draftfassung atomar. Replay verbraucht keine spätere Eingabe.
Diese Basisbindung benötigt weder Schemawechsel noch automatisches Legacyrewrite.

## Vorhandene Beute direkt weiterführen

Ein bestätigter Award mit `treasureId` bietet „Beute gemeinsam verteilen…“ direkt
am Abschlussbeleg an. Der Einstieg übergibt die bereits durch den Narrativread
geprüfte Schatz-ID an den gemeinsamen Treasurydialog. Er erzeugt weder einen
weiteren Award noch einen Schatz und wählt keine Gegenstandsempfänger aus.
Rohwerte werden vorher gesichert und der Notizbesitzer wird geflusht. Quest,
Kampagnenaktivierung und Awardbindung werden nach jedem Await erneut geprüft;
abgelöste Buttons dürfen den Dialog nicht öffnen. Ein Besitzerwechsel entwertet
auch laufende Schatzreads und die spätere Bestätigung im gemeinsamen Dialog.
Andere Treasuryaufrufe behalten ihren eigenen Kontext.

Die bestehende Verteilung liest aktuelle Bestände und nutzt den gemeinsamen
Progresswriter mit Receiptklärung. Teilmengen lassen den Rest im selben Schatz;
XP und das historische Questresultat werden nicht erneut gebucht. Der unten noch
offene Ausgang des eigentlichen narrativen Awardcommands bleibt davon getrennt.

## Noch vollständig zu liefern

1. **Unbekannter Commandausgang.** `NarrativeDraft` und `FinishDraft` speichern
   noch keinen ungeklärten Command. Vor Senden Command-ID, `progress`-Fingerprint,
   bestätigte Actionbasis und betroffene Write-ID dauerhaft an das Entwurfsziel
   binden. Nach Replyverlust zuerst `CampaignAPI.commitStatus` mit dem bestehenden
   Progressreceipt lesen, danach ausdrückliche Fortsetzung erlauben. Ein altes
   Receipt darf weder neue Eingaben rebasieren noch verbrauchen; ungeklärter
   Command und neuere Rohwerte müssen nebeneinander erhalten bleiben.
2. **Durchgängiger Abschluss.** Ungültige XP/Preise und Ergebnistext über
   Wechsel/Close/Fresh erhalten, korrigieren und einmal bestätigen. Replyverlust
   nach bestätigtem Write, Quellenänderung vor Publish und neue Eingabe während
   Recovery dürfen keine Belohnungswiederholung auslösen. Journal → Metadaten →
   Abschluss → Welttexteditor → Rückkehr nativ prüfen; Esc, langsamer Datenträger
   und unlesbarer Entwurf erhalten Rohwerte und schließen keine neuere Ansicht.
3. **Kopie und Erasure.** Award, XPhistory, Treasury und Entwürfe über Kopie,
   Archiv und Löschung gemeinsam prüfen: Receiptreplay, Weiterverkauf in der
   Kopie, Forks mit mehreren Notizen/Scenes, archivierte Roster-/Ortsreferenzen
   und Erasure einschließlich Historien/Entwürfen. Die Kopie behält gewählte
   Inhalte nach Quelllöschung; innerhalb gelöschte Personen dürfen nicht aus
   versteckten Historien rekonstruiert werden. Abschließend Vorbereitung → Live →
   Belohnung → Fresh nativ prüfen.

## Reichweite der vorhandenen Belege

Die [native Bedienprobe](../../../tools/test-desktop-narrative-recovery.mjs)
prüft fehlgeschlagenes Lesen ohne falsche Abschlussaktion, rohe Entwürfe über
Neustart sowie deren Korrektur und einmaligen Questabschluss: Mitwirkende im
gemeinsamen Dialog ausdrücklich ändern, XP aufrunden und den unverteilten Schatz
nach erneutem Neustart direkt am Abschlussbeleg öffnen. Der ursprüngliche
Lauf nutzte Geräteskalierung; die aktuelle Probe setzt echten Browserzoom
100 Prozent, sichert frische native Fensteraufnahmen und prüft normale Prozessenden.
Die Erweiterung prüft ausdrückliche Teilverteilung und lesende Statusklärung
nach verlorener Verteilungsantwort; der verbleibende Schatz behält seine Identität.

Die genannten Store-/DOMtests belegen Teilverträge für Integrität, Basen,
Rohwerterhalt, Replay und Kopie. Vollständige XP-/Loot-/History- sowie native
Abschluss-/Recoveryabnahme bleiben offen.
