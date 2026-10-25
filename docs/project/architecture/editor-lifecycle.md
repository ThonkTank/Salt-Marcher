# Gemeinsamer Editor-Lebenszyklus

Status: Current; native und automatisierte Nachweise bleiben von Produktabnahme getrennt.
Owner: project
Last Reviewed: 2026-10-25
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
wiederholt aber nicht die fachlichen Unterketten. Native Ausgabe wird bereits
vor dem Laden pausiert; die gesicherte Quellsitzung wird erst nach erfolgreichem
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
- `tests/campaign/desktop-npc-switch.test.mjs`: echter Renderer/SQLite-Draft mit alter
  Antwort während einer neuen Sicherung, weiterer Eingabe und unveränderten
  Rohbytes; vorhandene Receipt-/Neustartregressionen bleiben erhalten.
- `tests/campaign/desktop-preparation-context.test.mjs`: alte Entwurfsleseantwort während
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

## Vorbereitungsinstanz

`createPreparation` erzeugt einen eigenen `EditorSession`, Entwürfe, laufende
Reads und Schreibslots. Der Renderer übergibt die eigenen DOM-Wurzeln, den
Preload-Anschluss, Entwurfsspeicher und benannte Raum-/Notizbuchnavigation;
`createWorkspaceEditors` erhält diese Instanz statt eines Modul-Singletons.
Die bisherige Sicherungs- und Aktivierungsreihenfolge bleibt erhalten.

`PreparationNoteDirectory` besitzt das vollständige Notizverzeichnis und die
Suchanfragen. Gefilterte Treffer verdrängen die aktuell bearbeitete Notiz nicht.
Planungsübergaben bleiben an die ausdrücklich gewählte Plan-/Visit-Identität
gebunden; die bestehende Sessionplanung kann als Untereditor übergeben werden.
`createEditorSurface` bindet Controls an ihre Oberfläche und behält ihre Identität
beim vorübergehenden Ausleihen an Kontextdialoge. Die Notizkomposition hört auf
diese Controls statt auf das gesamte Dokument. Abmeldung verwendet weiterhin
`EditorSession` und bricht keine angenommenen Writes ab.

Die Vorbereitungsregression erzeugt zwei Instanzen mit gleichen Control-IDs,
verbietet globale ID-Abfragen beim Initialisieren der zweiten und prüft getrennte
Rohtexte, abgemeldete Reads und erneutes Öffnen. Die vorhandenen Prüfungen für
Notizquellen, ungeklärte Commands, Planungsübergaben und CRLF-Text bleiben erhalten.
