# Kampfentwürfe und narrative Belohnungen: Datenregeln und nächste Lieferung

Stand: 14.10.2026. Ergänzt den [Party-/Liveplan](smr03-live-scene-contract.md)
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

## Ursprüngliche Notiz- und Statusbasis

`NarrativeDraft.noteRevision` ergänzt die ursprüngliche Notizrevision neben
seiner bestehenden Statusrevision. Neue Rohentwürfe binden die tatsächlich
angezeigte Worldnotiz, nicht einen später gelesenen Notizstand. Der frische
Read vor Submit prüft diese Revision; er ersetzt sie nicht. Ändert sich die
Notiz während des Öffnens, ist die Übernahme des Entwurfs gesperrt, bis auch der
angezeigte Welttext aktualisiert wurde. Der Refresh desselben Editors sichert
zuerst dessen Rohwerte und zeigt dann die neue Notiz mit der alten Entwurfsbasis.

Bei unterschiedlichen Basisrevisionen bleibt der Entwurf editierbar und
kopierbar. Erst „Geprüften Entwurf auf aktuellen Stand übernehmen“ bestätigt
beide angezeigten Revisionen und sichert die überarbeiteten Rohwerte mit CAS.
Statusänderung und Award dürfen nur genau diesen Entwurf konsumieren; ein
Command mit neueren erwarteten Revisionen hebt dessen ältere Basis nicht auf.
Andernfalls scheitert die gesamte Transaktion ohne Receipt-/XP-/Lootteilwirkung.
Ändert sich eine Eingabe während Rohsicherung, Basisflush oder Quellenprüfung,
bleibt der neuere Rohstand gesichert. Der ältere Speicherklick darf ihn nicht
konsumieren oder überschreiben; die Spielleitung bestätigt die neue Fassung
erneut. Eingabe nach einem bereits gesendeten Command bleibt ein eigener
Folgestand.

Historische Entwürfe ohne `noteRevision` bleiben in ihrem ursprünglichen JSON
lesbar, exportierbar und verwerfbar. Sie gelten als unbekannte Notizbasis und
verlangen dieselbe ausdrückliche Prüfung vor Publish. Es gibt keine automatische
Nachtragung aus der aktuellen Notiz und keine Umschreibung beim Read. Das
optionale JSONfeld erfordert keine neue SQLtabelle oder spekulative Migration;
explizit vorhandene ungültige Revisionen werden als beschädigte Eingabe abgelehnt.
Eine unabhängige Kopie remappt Owner-/Write-IDs und erhält den ursprünglichen
Revisionswert sowie Rohwerte wie `-`.

Zehn Fälle in `desktop-narrative-basis.test.mjs` prüfen wirklichen Renderer und
SQLitewriter: Notizänderung vor Submit, Fresh/Prüfung, unbekannte Altbasis,
Status-/Awardverbrauch mit fremder Notizbasis, unabhängige Kopie, stale Note
beim Laden, fremde Statusbasis, ungültige Revisionswerte, neue Eingabe während der Rohsicherung
und ein unabhängiges Statusupdate nach dem eigenen bestätigten Write. Die bestehende
Narrativeintegrität bleibt bindend. Ein lokaler Fresh-Store ist keine native
Appwiederaufnahme; unbekannte Commandausgänge bleiben ein separater Schritt.

## Journal und gemeinsamer Editorowner

`narrative-journal-ui.ts` verwendet denselben Narrativeeditor wie die Welt-
vorbereitung. Der Journaleinstieg wird im Renderer nach Campaignaktivierung
freigegeben. Auswahl und Text-/Weltverweisnavigation binden Campaign, geöffneten
Dialog, tatsächlichen Listenstand beziehungsweise angezeigtes Detail. Schließen
entwertet ausstehende Auswahlvorgänge vor dem Flush; erst nach erfolgreichem
Speichern wird der ursprüngliche Editorowner wieder geöffnet. Parallel ausgelöste
Schließvorgänge teilen ihren Auftrag. Ein späterer Campaignwechsel oder eine neue
Öffnung darf von dessen Antwort weder geschlossen noch geleert werden.
Ein fehlgeschlagener Flush erhält Dialog und Rohfelder für eine ausdrückliche
Wiederholung. Veraltete Suchantworten ersetzen keine neuere Liste.

Auch die Narrativefelder und Speichern-/Verwerfencontrols binden ihren eigenen
Renderstand. Ein entferntes Control darf nicht den globalen Savehook eines neuen
Owners verwenden. `persist()` wiederholt einen neueren Rohstand nur, solange
sein ursprünglicher Owner noch aktuell ist. Ein tatsächlich gesendeter Write
beendet seinen ursprünglichen Auftrag; seine spätere Antwort startet keine
Wiederholung anhand der inzwischen anderen `draftVersion`. Ohne diese Grenze
konnte der veraltete Persistpfad endlos erneut laufen, den Renderer beschäftigen
und dessen Speicher belegen. Die korrigierte Probe beendet den alten Auftrag
und erhält die neuere unvollständige Eingabe ohne zusätzlichen Command.

Elf Fälle in `tests/desktop-narrative-journal-context.test.mjs` benutzen die
wirklichen Journal-/Narrativehandler und kontrollierte IPCantworten: normale
Auswahl samt unverändertem CRLF, Rückkehr zum ursprünglichen Editor, entfernte
Controls, Refresh, verzögertes Close/Navigieren nach Campaignwechsel, Antworten
in falscher Reihenfolge, doppelte Öffnung während Flush, Fehler/Retry und
Ownerwechsel mit noch unbestätigter neuer Eingabe. Dies sind lokale DOMbelege;
Native Dialog-/Tastatur-/Fokusabnahme und Unknown-Command-Recovery bleiben offen.

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
