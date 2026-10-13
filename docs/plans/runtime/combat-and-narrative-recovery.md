# Kampfentwürfe und narrative Belohnungen: Datenregeln und nächste Lieferung

Stand: 13.10.2026, nach Integration der Narrativentwürfe. Ergänzt den [Party-/Liveplan](smr03-live-scene-contract.md)
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
Die vollständige native Abschluss- und Recoveryabnahme bleibt offen.

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

1. **Narrative Wiederaufnahme vervollständigen.** Metadatenrohentwürfe und
   der gemeinsame Kampf-/Questabschluss besitzen inzwischen persistente Eingaben
   einschließlich Ergebnistext in `finish_draft`. Ursprüngliche Notizbasis und
   unbekannter Commandausgang bleiben offen. `NarrativeDraft` enthält bisher keine ursprüngliche
   Notizrevision und keinen ungeklärten Command. In `src/app/narrative-ui.ts`
   überschreibt `writeAction` zudem vor dem Senden die erwartete Notizrevision mit
   einem neuen Read. Das bietet keine ursprüngliche Notizkonfliktbasis.
   Nächster Anschluss: Note-/Statebasis und Command-ID unter dem Entwurfsziel
   sichern; ursprüngliche erwartete Revisionen beim Submit erhalten; verlorene
   Antworten durch `commitStatus` lesen und erst danach ausdrücklich fortsetzen.
   Ein früheres Receipt darf spätere Eingaben nicht rebasieren oder verbrauchen.
   Abnahme: ungültige XP/Preiswerte und Ergebnistext → Wechsel/Close/Fresh →
   korrigieren → einmal bestätigen; zwischenzeitliche Notizänderung und
   Replyverlust erzeugen keine automatische Belohnungswiederholung und verlieren
   keine spätere Eingabe. Vorhandene Vorbereitung-/Kampfverträge nutzen.
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
