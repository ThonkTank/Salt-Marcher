# Gemeinsamer Editor-Lebenszyklus

Status: Current; native und automatisierte Nachweise bleiben von Produktabnahme getrennt.
Owner: project
Last Reviewed: 2026-10-29 (Runde 9: Vorbereitungs-, Kampf- und Livebesitzer; native Teilproben bei 100 Prozent)
Source of Truth: Sitzungskern und Übergangsregistrierung; Fachmodule besitzen Entwürfe und Receipts.

## Zuständigkeiten

`src/app/shared/editor-session.ts` besitzt ohne DOM, Electron oder Datenbank die
Kontextgeneration, Leselaufzeiten, Eingabe-/Sicherungszähler, laufende Operationen
und ungeklärte Commands. `editor-transition.ts` behält die reine Rückbindung an
zusätzliche View-Identitäten und die feldweise Annahme bestätigter Werte.
`EditorSession.capture` verbindet diese Rückbindung mit der Sitzungsgeneration.

Ein gesicherter Arbeitsentwurf ist kein übernommener Fachstand. NPC-, Gruppen-,
Schatz- und Notizeditoren behalten ihre bestehenden Rohtext-/CAS-Codecs; Kampf,
Verfolgung, Abschluss, Rückblick und Live-Moment behalten ihre bisherigen
Entwurfsbesitzer. Fehlerhafte Rohwerte und abgewiesene Übernahmen werden weder
normalisiert noch durch einen erfolgreichen Transport als übernommen markiert.
Validierung, fachliche Commands, ID-Erzeugung, Receipt-Auswertung und Sperrbereich
bleiben im jeweiligen Modul. Persistenz- und Archivformate ändern sich nicht.

Operationsslots ersetzen lokale Pending-Variablen. Das Zurücksetzen einer
sichtbaren Auswahl entfernt keine angenommene Operation aus der Drain-Menge.
Eine alte Antwort kann den Slot eines neueren Auftrags nicht löschen. Erst der
Abschluss oder die ausdrückliche Freigabe des passenden Auftrags durch seinen
Besitzer beendet dessen Drain-Verpflichtung. Diese Freigabe ist vor anschließender
Navigation nötig, damit ein bestätigter Auftrag nicht auf sich selbst wartet.
`run` registriert vor dem Dispatch; es gibt keine automatische Schreibwiederholung.
Transportabschluss allein ist keine Speicherbestätigung: Die Fachgrenze entscheidet
weiterhin anhand ihrer eigenen Entwürfe und Receipts, ob Verlassen zulässig ist.

Abmelden entwertet Leases und bricht ausschließlich registrierte Lese-/Vorschau-
Signale und noch nicht ausgelöste Autosave-Timer ab. Angenommene Writes besitzen
kein Abbruchsignal. Alte Notizlesevorgänge gehören nicht zum Ladezähler einer
neueren Sitzung und dürfen deren Controls nicht verändern.

## Zentrale Registrierung

`src/app/workspace/workspace-editors.ts` registriert die bisherigen Aktivierungs- und
Sicherungsbesitzer einmal. `renderer.ts` bindet die Hostoberfläche und deren
Eingabeereignisse an `editor-registry.ts` an. Neue Eingabe während eines Drains
führt vor dem Verlassen zu einem erneuten geordneten Durchlauf. Ein Kontextwechsel
entwertet eine noch laufende alte Grenze.

| Grenze | Erhaltenes Verhalten |
| --- | --- |
| Checkpoint | NPC → Gruppen → Schatz → Trigger → Dungeoninhalt → Graph → Keys → Paths → Volumen → Dungeon → Zeichnung → Autonomie → Stadt → Musik → Welt → Items → Katalog → Live → Vorbereitung → Raum. Vorbereitung und Raum verwenden ihren fachlichen Flush. |
| Navigation | Zuerst Atlas und World-Playback; danach dieselbe Writerreihenfolge. Nach Stadt bleiben die Aktivierungs-/Ladeprüfungen. Vorbereitung und Raum dürfen ihre bestehenden Arbeitsentwürfe sichern. |
| Kampagnenwechsel | Navigationsgrenze plus bestehende Prüfung der Graph-Gesamtvorschau. Erst erfolgreiche Sicherung erlaubt Abmeldung und Aktivierung. |
| Schließen | Eigene Grenze mit derselben Fachsicherung und Graph-Prüfung. Erst danach meldet Main die Rendererbereitschaft; der Store-Worker bestätigt unabhängig sein tatsächliches Ende. |
| Werkzeugvorbereitung | Registrierter Suffix der bisherigen Werkzeugkette; der auslösende Writer und Dungeon bleiben wie zuvor ausgenommen. Vorbereitung verwendet Leave, Raum weiterhin den fachlichen Flush. |

Die Aktivierungsreihenfolge unterscheidet sich absichtlich von der Flushreihenfolge.
Live aktiviert seine Untereditoren, Katalog seine Generierung, Vorbereitung ihre
Sessionplanung. Die Registrierung kennt diese Sitzungen für Abmeldung und Drain,
wiederholt aber nicht die fachlichen Unterketten. Native Ausgabe und Atlasleser
werden bereits
vor dem Laden pausiert. Der Atlas entwertet dabei seine Anfragegeneration, bevor
Main beim Aktivieren die alten Regionsleser abbricht; deren Abbruchantwort darf
keinen sichtbaren Ansichtsfehler mehr veröffentlichen. Die gesicherte Quellsitzung
wird erst nach erfolgreichem
Lesen des neuen Kontexts abgemeldet. Ein fehlgeschlagener Ladevorgang bleibt
schreibgeschützt und kann erneut geöffnet werden. Kampf, Verfolgung, Fortschritt,
Scene-Desk, narrative Bearbeitung, Sessionplanung, Generierung und Abschlussentwurf
verwenden ebenfalls den gemeinsamen Kern. Reine Anzeige-/Kontextbeobachter erhalten
Aktivierungshooks ohne künstliche Schreibsitzung. Atlas-Gesten, Pinselqueue und
Buchungsjournal behalten ihre speziellen Commands und Lockgrenzen.

## Prüfung und Grenzen

- `tests/shared/editor-session.test.mjs`: Generationen, getrennte Entwurfszustände,
  parallele Writes, verlorene Antworten ohne Wiederholung, Abmeldung, reale
  Auftragsbeendigung und erneuter Drain bei neuer Eingabe.
- `tests/workspace/desktop-editor-activation.test.mjs`: fehlgeschlagenes Laden und erneutes
  Öffnen, verweigerte Quellsicherung, konkurrierende Wechsel und Öffnen nach
  Entfernen des bisherigen Kontexts.
- `tests/workspace/workspace-editor-registry.test.mjs`: konkrete Reihenfolgen, alle vier
  Grenzarten, Graph-/Aktivierungs-Ausnahmen und Werkzeugvorbereitung.
- `tests/campaign/desktop-preparation-owner.test.mjs`: vollständige Preparation-Fabrik
  mit eigenem SQLite-Store; alte Antworten nach A → B → A, spätere Eingaben im
  Write-Drain und ausdrückliche Klärung angewandter oder nicht angewandter
  Aufträge. Der echte Verweisconsumer behält seine Auswahl über Flush,
  neue Eingabe und erneute Aktivierung gebunden.
- [desktop-npc-switch.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/campaign/desktop-npc-switch.test.mjs): echter Renderer/SQLite-Draft mit alter
  Antwort während einer neuen Sicherung, weiterer Eingabe und unveränderten
  Rohbytes; vorhandene Receipt-/Neustartregressionen bleiben erhalten.
- [desktop-preparation-context.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/campaign/desktop-preparation-context.test.mjs): alte Entwurfsleseantwort während
  einer neuen Aktivierung sowie vorhandene Notiz-/Plan-/Quellenregressionen.
- Bestehende DOM-/Storeprüfungen für Gruppen, Schatz, Zeichnung, Kampf, Verfolgung,
  Sessionplanung und Abschluss bleiben die fachlichen Anschlussprüfungen.

Die nativen Werkzeuge für NPC-Wechsel, Notizquellen, Kampagnentransfer,
Spielerprojektion, Atlaspinsel und große Mischwelt prüfen dieselben Abläufe vor
und nach dem Umbau einschließlich Schließen und frischem Öffnen. Laufartefakte
enthalten geprüfte Runtime-Hashes; Links im Capability-Katalog sind Navigationshilfen
und kein zusätzlicher Abnahmebeleg. Main-Eventloop-Verzögerung und sichtbare
Eingabereaktion werden separat gemessen. Weder der Sitzungskern noch eine
Radiusänderung belegen das weiterhin offene 100-ms-Ziel für einen Terrainpinselzug.

## Zustandszuordnung der drei Kompositionen

Die Zuordnung benennt den aktuellen Besitzer, keine neue Abnahme und kein
zusätzliches Register. Runde 9 wurde in der Reihenfolge Vorbereitung → Kampf →
Live umgesetzt und geprüft; erster Lieferabschluss war die entkoppelte Vorbereitung.

| Zustand | Vorbereitung | Kampf | Live |
| --- | --- | --- | --- |
| Bestätigte Daten | `PreparationNoteDirectory`: Quellenprojektion und ungefilterte Notizidentitäten | `createCombat`: bestätigter `CombatView`; Fachwriter bleibt zentral | `createLive`: bestätigter `LiveView`; Fachwriter bleibt zentral |
| Rohentwurf und Basisrevision | `PreparationDraftOwner`: Notiz, Plan und Ort samt späterer Eingabe und gesichertem Entwurf; Sessionplanung behält eigene Entwürfe | `CombatDraftCache`: Figuren-/Notiz-/Initiativeentwürfe; `combat-roll-editor.ts`: offene Angriffs-/Save-/Schadensübergaben | Bestehende Moment-/Rückblick-/Abschlussbesitzer; Figuren-/Szenenentwurf weiterhin `createLive` |
| Auswahl und Dialog | `createPreparation` hält Oberflächenauswahl; Notizfaden, Quellen, Merge und Sessionplanung behalten ihre eigenen Dialoge | `combat-reinforcement-editor.ts`: Verstärkungssuche, Katalog-/Truppauswahl und Buchungsdialog; übrige Panels behalten ihre Auswahl | `live-party-move-editor.ts`: Verschiebe-/Split-/Rejoin-Auswahl, Titel, Ziele und Revisionsbasis; Resume und Abschluss bleiben eigene Besitzer |
| Laufende Reads | Entwurfsreads: `PreparationDraftOwner` mit `EditorSession`; Notizensuche: Verzeichnisgeneration; übrige Oberflächenreads: Komposition mit Kontextlease | `EditorSession` und bestehende Panel-/Cachebesitzer; Verstärkungsreads und eigene Anfragegeneration beim Verstärkungsbesitzer | `EditorSession` und bestehende Live-Untereditoren; kein neuer Snapshotstart geliefert |
| Angenommene Writes | `PreparationWriteCoordinator`: Originalcommand, Blockade, Receiptklärung und geordneter Drain; Session-/Narrativewriter bleiben ihre bestehenden Grenzen | Zentraler Kampfwriter und Commitbestätigung; Verstärkungs- und Würfelbesitzer erhalten die gebundene Bestätigung | Zentraler `execute`-/Receiptwriter; Verschiebedialog liefert ausschließlich einen kontextgebundenen Auftrag |

## Vorbereitungsinstanz

`createPreparation` komponiert `PreparationNoteDirectory`,
`PreparationDraftOwner`, `PreparationWriteCoordinator`, `PreparationListView`
und die bestehende Sessionplanung. Kontext, Oberflächenauswahl und DOM-Ereignisse
bleiben in der Komposition. Es wird kein veränderlicher Gesamtcontext an die
Unterbesitzer übergeben und keiner importiert den Kompositionsroot zurück.

Das Verzeichnis besitzt bestätigte Notiz-/Plan-/Ortsprojektionen; gefilterte
Treffer verdrängen die bearbeitete Originalnotiz nicht. Der Entwurfsbesitzer
besitzt rohe Notiz-, Plan- und Ortsfelder, deren Revisionsbasis, gespeicherte
Arbeitsentwürfe und Entwurfslesefehler. Feldaktionen erhalten CRLF/Rohtexte und
bewahren spätere Eingaben nach einer Bestätigung. Die Projektionen sind an der
Besitzergrenze eingefroren; die Listenansicht erhält zusätzlich rekursiv
unveränderliche Lesetypen und benannte Auswahlaktionen.

Der Writer besitzt die angenommenen Commands, laufende direkte Änderungen,
Flushoperationen, Blockade und Receiptklärung. Er sichert weiterhin zuerst
Narrative und Sessionplanung, dann Notiz → Plan → Ort; die Komposition reicht
bestätigte Einzelwerte an Narrative und Sessionplanung weiter. Eine neue Eingabe
während der Sicherung bleibt offen und wird vor dem erfolgreichen Verlassen
mit der bestätigten Revision gesichert. Ein verlorener Transportabschluss löst
keine Wiederholung aus. Klärung verwendet denselben Originalcommand; gesicherte
spätere Eingaben werden gegen dessen bestätigte Basis weitergeführt.

Der Renderer übergibt eigene DOM-Wurzeln, Preload, Entwurfsspeicher und benannte
Navigation; Workspace und Notizbuch verwenden dieselbe Instanz. Die
Sicherungs-/Wechsel-/Resume-Reihenfolgen und sämtliche Speicher-/Archiv-/
Preloadverträge bleiben erhalten. Angenommene direkte Änderungen sind ebenso
wie Flushes im gemeinsamen `EditorSession`-Drain registriert; Abmeldung
entwertet ausschließlich ihre sichtbare Antwortberechtigung.

`tests/campaign/desktop-preparation-owner.test.mjs` prüft A → B → A, spätere
Rohtexte im Save, denselben Command bei angewandter und nicht angewandter
Antwortklärung, Navigation und Close-Drain samt weiterer Eingabe, isolierte
Instanzen und den Drain direkter Anlagen. Die vorhandene Priorityprüfung
prüft daneben Planübergaben, spätere Sessioneingaben, Quellen, Notiz-Mount und
Ortsabschnittslesegrenzen. Der native Quellenprüfweg bleibt
`tools/test-desktop-note-source-recovery.mjs` bei 100 Prozent Appzoom.

Lokale Prüfung des Vorbereitungsabschlusses am 29.10.2026: 124 gezielte
Preparation-/Quellen-/Plan-/Workspacefälle bestanden; die aktuelle Ownerdatei
mit den ergänzten Grenzen besteht mit 11 Fällen. Typ-/Umgebungsprüfung,
Repositoryprüfung und Desktopbuild bestehen. Die native Quellenprobe besteht
bei 100 Prozent Zoom mit drei regulär beendeten Prozessen; ihr Neustartorakel
wurde von einer auf die zuvor bestätigten zwei Quellen korrigiert.

Die E2E-02-Teilprobe besteht bei 100 Prozent mit Software-GPU
(`.build/round9-plan3-preparation-e2e02/result.json`: `workflowSubset=passed`,
`complete=false`). Das technische Gate bleibt für E02-01, E02-02, E02-03,
E02-05 und E02-11 offen; Paket-/Installations- und Ownerabnahme sind damit
nicht erfolgt. Die Quellenprobe liegt unter
`.build/round9-plan3-preparation-native/result.json`. Capability-Zuordnungen
wurden nach Testinhalt ergänzt und die tatsächlich geprüften Abläufe markiert.

Runde 9: Die drei vorgesehenen Besitzerschnitte sind umgesetzt. Der fehlende
Snapshotstart aus Plan 2 und die offenen E2E-02-Gates werden durch diese
Zustandsentkopplung nicht geschlossen.

## Live-Instanz

`createLive` komponiert die Live-Oberfläche und besitzt weiterhin Kontext,
bestätigten `LiveView`, Figuren-/Szenenentwürfe, Command-Recovery und die gemeinsame
Schreibgrenze. Der Renderer übergibt DOM-Wurzeln, Preload und benannte Navigation
und verbindet dieselbe Instanz mit Workspace und Party. Die Party erhält ihre
drei Schreib-/Verschiebeaktionen ausdrücklich.

| Besitzer in `src/app/runtime/` | Privater Zustand und Übergabe |
| --- | --- |
| `live-recap-editor.ts` | Kampagnengebundene Rückblickentwürfe, CAS-Basis, Fehler und laufende Sicherung; Abschluss hält die Publish-Sperre bis zur Ack-Annahme. Spätere Prosa bleibt erhalten. |
| `live-moment-editor.ts` | Szenengebundene Momententwürfe, Sicherungsoperationen und Formularaktionen; bestätigte Folgeaktionen bleiben an ihren ursprünglichen Kontext gebunden. |
| `live-session-close-ui.ts` | Abschlussaudit, Reviewgeneration, Dialoge und Übergabeentwurf; Änderungen am geprüften Gruppenstand entwerten die Bestätigung. |
| `live-session-resume-ui.ts` | Wiederaufnahmedialog und eigene Anfragegeneration; Aktionen erhalten eine geprüfte Lease für Fokus, Navigation und Beginn. |
| `live-knowledge-ui.ts` | Narrative Lesegeneration, Cache, Fehler und Suchdarstellung; eine alte Antwort gibt keinen neueren Leseauftrag frei. |
| `live-party-move-editor.ts` | Mitglieder-/Titel-/Zielentwurf, geklonte Ausgangs-/Zielrevisionen, Dialog und gebundene MoveAction; execute und Receiptannahme bleiben zentral. |
| `live-session-readers.ts` | Gemeinsame Audit-/Vorbereitungsabfragen mit expliziten Leseranschlüssen; kein eigener langlebiger Zustand oder Writer. |

Diese Besitzer erhalten die benötigten Projektionen und benannte Aktionen.
Kein Untermodul importiert den Live-Kompositionsroot zurück oder erhält dessen
veränderlichen Gesamtzustand. `EditorSession` bleibt die gemeinsame Drain-Grenze;
angenommene Writes werden beim Wechsel nicht abgebrochen. `flushLive` sichert
weiterhin Moment, Rückblick, Scene-Desk, Fortschritt/Kampf/Chase und danach
Figuren-/Szenenentwürfe in dieser Reihenfolge. Ein Entwurf mit Fehler blockiert
die erfolgreiche Navigation. Mappenübergaben verwenden benannte Funktionen.

`tests/runtime/desktop-live-owner-lifecycle.test.mjs` prüft getrennte Besitzer
mit identischen IDs, spätere Rohtexte während einer Sicherung, Drain nach
Abmeldung, fehlgeschlagene Sicherung und überholte narrative Reads. Die
bestehenden Live-Moment-/Wiederaufnahmeprüfungen behalten die durchgängigen
Receipt-, Wechsel-, Abschluss- und Textorakel. Der native Spielabend-Prüfweg
`tools/test-desktop-evening-handoff.mjs` ergänzt Abschluss, Übergabe und frischen
Prozess; diese Zuordnung allein behauptet keinen neuen Lauf oder Produkt-PASS.

Der Verschiebebesitzer erhält eine rekursiv unveränderliche, zusätzlich geklonte
Projektion der nötigen Ausgangs-/Zielwerte statt eines `LiveView`. Vor dem
Öffnen entwässert die Komposition wie bisher die gemeinsame Schreibgrenze und
liest den aktuellen Livekontext. Eine vor diesem Await erfasste `EditorSession`-
Lease verhindert eine alte Öffnung nach A → B → A. Absenden verwendet die
festgehaltenen Ausgangsrevisionen und die beim Besitzer gewählten Mitglieder;
eine ungültige Ziel-ID wird nicht als neue Gruppe interpretiert. Der zentrale
`mergeAck` bestätigt nur die tatsächlich gesendete ursprüngliche Aktion zurück,
auch bei Receiptklärung. Eine spätere Öffnung kann dadurch weder geschlossen
noch mit einer alten Auswahl überschrieben werden. Abmelden schließt nur den
Dialog; der zentrale Writer behält seine Drain-Verpflichtung.

`tests/runtime/desktop-live-owner-lifecycle.test.mjs` besteht aktuell mit zehn
Fällen einschließlich sechs neuer Verschiebegrenzen: unveränderte Basis,
isolierte Rohtexte/Auswahl, A → B → A und abgelöste Controls, Close-Drain,
verlorene Antwort ohne erneutes Senden und ausdrücklicher Neuversuch nach
nicht angewandtem Auftrag. Die vorhandenen Live-/Publikations-/Resume-/
Handoff-/Aktivierungsprüfungen bestehen unverändert. Die aktuelle native
E2E-02-Teilprobe qualifiziert Split, Zielwahl und Rejoin bei 100 Prozent Appzoom;
sie schließt die weiterhin offenen E2E-02-Fälle nicht. Der abschließende Bericht
`.build/round9-plan3-live-e2e02/result.json` hält `workflowSubset=passed`,
`complete=false`, Software-GPU und vier reguläre Starts/Exits bei Zoom 1 fest.
Die abschließende gezielte Auswahl besteht mit 71 Fällen. Darunter bestätigen
zwei echte Renderer-/SQLiteprüfungen in
`tests/runtime/desktop-live-priority.test.mjs` den angewandten und nicht
angewandten Verschiebeauftrag über dieselbe ursprüngliche Command-ID; erst
nach nicht angewandter Klärung erlaubt eine neue ausdrückliche Aktion einen
anderen Command. Beide Varianten erzeugen insgesamt genau eine Teilgruppe.
Typ-/Umgebungs-, Desktoptyp- und Repositoryprüfung sowie Desktopbuild bestehen.

Der historische native Prüfweg `tools/test-desktop-split-knowledge.mjs` bleibt
für seinen Dungeon-/Wissensanteil offen: Er verwendet den ausgeblendeten
`#dungeon-tab` und einen unbedingten Einstieg über `#live-continue`. Der
Diagnoselauf ist unter `.build/round9-plan3-live-native/failure.json` erhalten;
das Werkzeug wurde nicht als Bestandteil dieses Umbaus auf einen anderen
Fachablauf umgeschrieben. Das ist kein bestandener nativer Wissenssplitnachweis.

`LiveTimeControls` besitzt literale Zeitfelder je Szene und Kalender-Vorschauen.
Ein Read gehört zur `EditorSession`; Abmeldung und neue Generationen verwerfen
seine Veröffentlichung, ohne die nächste Anfrage freizugeben. Zeitbuchungen,
Flush und Receipts bleiben im Live-Writer. Der isolierte Test
[desktop-live-time-controls.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/runtime/desktop-live-time-controls.test.mjs) prüft zwei Oberflächen mit
gleichen IDs, Szenenwechsel, Rohtexte und alte Antworten nach Wiederöffnung.
Die Live-/Wiederaufnahme- und Partytests verwenden die erzeugte Instanz bzw.
explizite Writer-Ports; bestehende Recovery- und Textregressionen bleiben erhalten.

## Kampfinstanz

`createCombat` komponiert die bestätigte Kampfprojektion, den zentralen Writer,
`CombatDraftCache`, die bestehenden Panels und zwei abgegrenzte Besitzer.
Renderer und Live erhalten dieselbe Instanz; native Navigation bleibt ein
benannter Port. Kein Unterbesitzer importiert den Kompositionsroot zurück oder
erhält dessen veränderlichen Gesamtzustand.

`combat-reinforcement-editor.ts` besitzt Suchwort, Anfragegeneration, Treffer,
Katalog-/Truppauswahl, die eigenen Controls und den `BookingDialog`. Kampf- oder
Sitzungswechsel entwerten alte Reads, einschließlich A → B → A. Ein bereits
angenommener Auftrag behält seine laufende Dialogoperation, auch wenn die
sichtbare Auswahl wechselt; die Bestätigung kann anschließend nur in ihre
ursprüngliche Generation zurückkehren. Der zentrale Kampfwriter bleibt der
Besitzer von Command, dauerhaftem Receipt und gemeinsamer Schreibsperre.

`combat-roll-editor.ts` besitzt offene Angriffe, Rettungswürfe und die ausstehenden
Schadensübergaben. `combat-roll-state.ts` bleibt die reine Regel-/Queuehilfe,
`CombatDraftCache` behält Figuren-/Notiz-/Initiativerohwerte und deren CAS-Basis.
Die Würfeloberfläche nimmt weder HP noch Kosten als Speicherbestätigung vorweg.
Der zentrale Writer meldet eine bestätigte Aktion einmal an den ursprünglichen
Würfelbesitzer; bei expliziter Receiptklärung geschieht dieselbe Rückbindung nur
in der ursprünglichen Generation. Bestätigte legendäre Kosten werden dadurch
nicht erneut gebucht, und bestätigter Würfelschaden verschwindet genau einmal
aus seiner offenen Übergabe. Eine nicht angewandte Buchung erlaubt erst mit der
nächsten ausdrücklichen Aktion einen neuen Auftrag. Dies ist eine fachliche
Korrektur der bisherigen Oberflächenrückbindung, keine Änderung an Command-,
Speicher-, Archiv- oder Preloadformaten.

Abmeldung löst Commit-/Progress-Abonnements, widerruft Reads und schließt Panel-
Kontexte. Angenommene Writes bleiben im `EditorSession`-Drain. Der Cache verwirft
keine offenen Rohwerte. Zwei Instanzen erhalten ihre eigenen Suchergebnisse,
Auswahlen und Würfelübergaben.

`tests/runtime/desktop-combat-owner-lifecycle.test.mjs` ergänzt die vorhandenen
Combat-Draft-/Live-/Workspacefälle um alte Such-/Würfelantworten, getrennte
Instanzen, angenommene Verstärkung beim Wechsel und Close-Drain, bestätigte
legendäre Kosten und angewandte/nicht angewandte Schadensklärungen.
Die native Probe `tools/test-desktop-combat-switch.mjs --apply-rolled-damage`
besteht bei 100 Prozent Appzoom mit drei regulären Starts/Exits: echter
Statblockangriff, ausdrücklicher halber Würfelschaden, abgewiesener Read,
Entwurfssicherung und frisches Öffnen. Beleg:
`.build/round9-plan3-combat-native/combat-after.json`.

Die native Verstärkungsprobe mit `--reply-loss` besteht ebenfalls bei 100 Prozent:
Trupp und neue Katalogkreatur, zweimal echter Antwortverlust mit derselben
Command-/Receiptidentität, frischer laufender/abgeschlossener Kampf und
abgewiesene Anfangsanlage. Der wiederholt installierte Fehlerlogger wurde so
korrigiert, dass er die ursprünglichen IPC-Handler statt den eigenen vorherigen
Logger umhüllt; ein Command wird dadurch nicht doppelt gezählt. Beleg:
`.build/round9-plan3-reinforcement-native/result.json`.
Die aktuelle Ownerdatei besteht mit acht Fällen; die E2E-02-Teilprobe nach dem
Kampfschnitt besteht weiterhin mit denselben fünf offenen Gates unter
`.build/round9-plan3-combat-e2e02/result.json`.

## Instanzen für NPCs, Musik und Gegenstände

`createNpcEditor`, `createMusicEditor` und `createItemsEditor` besitzen jeweils
Sitzung, Entwürfe, Auswahl, Anfragen und Timer. Der Workspace erzeugt sie und
übergibt sie an die Editorregistry. Live erhält Shopdarstellung und Musikrefresh
als Host-Ports; das Soundboard erhält die konkrete Musikinstanz. Die Hosts liefern
Preload-API und eigene DOM-Wurzeln. `createEditorSurface` hält die Elementidentitäten
innerhalb dieser Wurzeln; eine fehlende Control wird nicht im Gesamtdokument gesucht.
Initialisierung erfolgt einmal je Instanz. Die bestehenden produktiven IDs und
Aktivierungs-/Drain-Reihenfolgen bleiben erhalten.

`dispose()` der drei Editoren prüft zuerst den fachlichen Flush und entwässert
angenommene Operationen. Bei `false` bleibt die Instanz verwendbar und behält ihre
Eingaben. Erfolgreicher Abbau entwertet die Sitzung und entfernt eigene Timer,
Beobachtungen und erzeugte Controls; eine abgebaute Instanz wird nicht reaktiviert.
Der Host führt den Abbau an einer geordneten Übergangsgrenze aus und unterbindet
währenddessen neue Eingaben, wie beim bestehenden Workspace-Drain. Normale
Kampagnenwechsel verwenden weiterhin die bisherigen Aktivierungsgrenzen.

Der Audio-Player hält seinen eigenen Container; Transferbeobachter im Preload
liefern eine Abmeldefunktion. Items erhält den gemeinsamen Buchungsdienst als
Port, statt beim Aufbau dessen Workspace-Kontext umzusetzen. Kampagnenweite
Buchungssperren und gespeicherte Receipts bleiben absichtlich gemeinsam; eine
weitere Oberfläche darf eine ungeklärte Buchung nicht umgehen.

Die Instanzprüfung liegt in
`tests/shared/desktop-tool-editor-instances.test.mjs`. Sie ergänzt die bestehenden
NPC-, Musik-, Item- und Shop-Fachtests. Getrennte Instanzen in getrennten
DOM-Dokumenten sind der hier geprüfte Zusammensetzungsfall. Mehrere vollständige
Workspaces mit ihren heutigen identischen HTML-IDs in einem Dokument sowie eine
neue Mehrfensterfunktion sind damit nicht geliefert.

## Weltinstanz und gemeinsame Schreibgrenze

`createWorldEditor(host)` erzeugt die Weltoberfläche einmal je Workspace. Der
Renderer übergibt eigene DOM-Wurzeln, Preload, Atlaswriter und konkrete Live-/
Navigationsanschlüsse. `createWorkspaceEditors` erhält diese Instanz ausdrücklich;
Live, `CampaignAgenda`, `AtlasJourney`, `AtlasAuthor` und `AtlasDrawing` verwenden
benannte Methoden dieser Instanz. Es gibt keinen veränderlichen Welteditorzustand
auf Modulebene und keinen Rückimport eines Fachbesitzers zur Kompositionswurzel.

| Besitzer unter `src/app/runtime/` | Veränderlicher Zustand, Eingaben und Lebensdauer |
| --- | --- |
| `world-write-coordinator.ts` | Angenommene Aufträge, Drainoperationen, ursprünglicher Command samt Token/Generation und ungeklärte Bestätigung. Diese Zustände überleben eine sichtbare Aktivierung bis zu ihrem tatsächlichen Abschluss oder ihrer Receiptklärung. |
| `world-map-editor.ts` | Gelesene Kampagnen-/Sceneprojektionen, Karten-/Hex-/Markerentwürfe mit eigenen Eingabezählern, Auswahl, Kamera, Gesten und Ortsformulare. Aktivierung entwertet Leser und sichtbare Entwürfe; bestätigte Werte werden nur vom passenden Besitzer angenommen. |
| `world-travel-editor.ts` | Routenfelder, Wegpunkte, Vorschau, Gruppenplatzierung, Reiseaktionen, Playback und Live-Docking. Kampagnen-, Scene- und Kartenauswahl gehören zur Lease; auch A → B → A macht eine frühere Aktion nicht wieder aktuell. |
| `world-calendar-editor.ts` | Kalenderdialog und dessen Revisionsbasis, Eingabezähler, Agenda-Lesegeneration und Fristspeicheranschluss. `CampaignAgenda` behält ihren eigenen Dialog-/Ereignisentwurf und bekommt ausschließlich Save/Pending/Recovery-Methoden. |
| `world-weather-editor.ts` | Sceneantworten, GM-Overridebasis mit ursprünglicher Eingabeversion, laufende Wetteraktion und Wettergebietsentwurf. Ein Auswahlwechsel entwertet die alte Antwortberechtigung; offene manuelle Wettereingabe bleibt bis zum ausdrücklichen Speichern oder Verwerfen erhalten. |
| `world-editor-surface.ts` | Unveränderliche Hostports, `EditorSession`, registrierte DOM-Identitäten und Listenerfreigaben. Ausgeliehene Controls behalten ihren Besitzer, insbesondere Kalenderdialog und Live-Reisekarte. |

Die Fachports in `world-owner-ports.ts` geben rekursiv unveränderliche
Lesemodelle weiter, einschließlich Routenarrays und verschachtelter Scene- und
Kartendaten. Die konkreten Besitzer bleiben innerhalb der Komposition.
Karten-/Scenewechsel melden fachliche Übergänge an Reise; Reise entwertet selbst
Vorschau, Playback und Transportlease. Reise übergibt bestätigte Positionen samt
Kampagnen-, Karten- und Sceneauswahlkontext an die Kartenannahme. Nur Karte
entscheidet danach über Frame, Kartenentwurf und Kamera; ein veralteter Kontext
oder ein offener Kartenentwurf erlaubt keine fremde Entwurfsübernahme.
Wetter übergibt bestätigte Sceneprojektionen ebenso an die Kartenannahme.
Kalender übernimmt seine bestätigte Revisionsbasis selbst, auch bei
Receiptklärung mit späteren offenen Dialogeingaben. Der direkte Einstieg aus
Live vor jedem Atlasread liest, zeigt und sichert diese eigene vollständige
Kalenderbasis; ein fehlender Quellenstand wird ausdrücklich abgewiesen und
kann keinen Drain ohne Fortschritt erzeugen. Ein altes Transport-Finally
kann die Controls einer neueren Auswahlgeneration nicht entsperren.

`flushWorld` beendet zuerst die aktuelle Kartengeste und wartet auf die beim
Eintritt bereits angenommenen Aktionen. Danach folgen Marker, Karte/Hex,
Kalender und Wettergebiet in der bisherigen Reihenfolge. Neue Eingabe während
eines Writes bleibt offen und wird im nächsten Durchlauf gesichert. Der Drain
wartet nicht auf seine eigenen erst danach gestarteten Writes. Ein abgewiesener
Entwurf oder ungeklärter Command verweigert die Wechselgrenze und behält die
Eingaben. Aktivierung löscht oder ersetzt keinen Originalcommand. Eine späte
Receiptklärung darf dessen Ausgang klären, bestätigt aber keine neue
Besitzergeneration und übernimmt dort keine alten Entwurfswerte.

Erfolgreiches `dispose` entwässert die gemeinsame Grenze, entwertet die Sitzung,
beendet Playback und Gesten und entfernt ausschließlich die eigenen Controls und
Listener. Ein fehlgeschlagener Flush lässt die Instanz verwendbar. Andere
Live-Controls bleiben erhalten. `createEditorSurface` registriert dynamische
Dialoge, bevor sie ihre ursprüngliche DOM-Wurzel verlassen.

`tests/runtime/desktop-world-owner-lifecycle.test.mjs` baut vollständige
Produktionsfabriken mit echten SQLite-Stores und kontrollierten Hostantworten.
Die Prüfungen umfassen getrennte Oberflächen/Receipts, Mount/Dispose, weitere
Eingabe während einer Sicherung, ungültige Entwürfe, Originalcommandklärung,
A → B → A, späte Scene-/Wetter-/Reiseantworten, kalenderseitige Receiptübernahme
und spätere Karten-/Kalender-/Wettergebietseingaben während des Drains. Native Zusammensetzung prüfen
`tools/test-desktop-world-authoring.mjs`, `tools/test-desktop-weather-override.mjs`,
`tools/test-desktop-agenda-deadline.mjs` und die fachlich passenden Reiseproben.
Die Laufbelege bleiben von Plattformqualifikation, Paketinstallation und
Ownerabnahme getrennt; dieser Umbau ändert keine Speicher- oder Archivformate.
