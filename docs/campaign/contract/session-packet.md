# Spielabendmappe: Quellenstand, Suche und Ausgabe

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: campaign
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Die GM-Mappe ordnet vorbereiteten Wortlaut nach Besuchsfolge. Im Planner öffnet
sie als Dialog, im Live-Spiel dockt derselbe Leser neben der laufenden Szene an.
Private GM-Inhalte gelangen darüber nicht in die Spieleranzeige.

## Vorhandene Abläufe

- Besuche nach Titel, Ort, Überschrift und Blocktext durchsuchen; über
  Sprungmarken zu einzelnen Abschnitten wechseln. Der Export enthält immer
  alle Besuche, unabhängig vom Suchfilter.
- Gebundene Ortsabschnitte, Weltverweise, Begegnungen mit konkreten Statblocks
  und Belohnungen lesen. Quest-/Gerüchtblöcke zeigen bestätigten Status,
  vorbereitete Belohnung oder vergebenes Ergebnis. Offene Entwürfe sind Hinweise
  und ersetzen den bestätigten Quellenstand nicht.
- Aus der Spielabend-Übergabe einen Einstieg mit Zielplan, privatem Vorlesetext
  und Ortsquellen vorbereiten. [Zielwahl, Speicherung und Recovery](manual-session-planner.md#besuchsübergabe-und-recovery)
  gehören zum vorhandenen Planeditor.
- Beim Spielabendabschluss die bestätigte Übergabe unmittelbar im selben Editor
  weiterbearbeiten. Der Abschluss wird vor dem Öffnen gespeichert; erst die
  zweite Bestätigung erzeugt Planbesuch und Mappeninhalt gemeinsam. „Vorbereiten
  + Mappe öffnen“ zeigt danach unmittelbar den neu erzeugten Besuch in der
  vollständigen GM-Mappe.
- Von jeder Besuchsseite der Vorbereitungsmappe mit „Am Spieltisch prüfen…“ in
  die vorhandene Übernahmeprüfung am Spieltisch wechseln. Ein noch nicht
  geöffneter gespeicherter Sitzungsstand wird dabei geöffnet; Plan und Besuch
  sind ausgewählt und die Prüfung erscheint direkt. Sie zeigt die konkrete
  Wirkung, gebundene Quellen, Begegnungsgruppen und Belohnungsstand. Der GM kann
  nur übernehmen oder nach bestätigter Übernahme direkt die Mappe dieses Besuchs
  öffnen. Der Wechsel selbst übernimmt noch keinen Inhalt und startet keinen
  Spielabend.
- Im Live-Spiel einen Besuch übernehmen, Vorlesetext in den GM-Szenenentwurf
  kopieren, die Originalquelle öffnen, eine Begegnung vorbereiten oder die
  Belohnung dieses Besuchs im vorhandenen Fachbereich verwalten.
- Einen Block als Chronikmoment vormerken. Sein Auszug ergänzt den vorhandenen
  lokalen Momententwurf; Titel und Kategorie bleiben bei bestehender Eingabe
  erhalten. Erst die separate Speicherung bucht den tatsächlichen Ausgang.
- Besuchsergebnisse über den vorhandenen Navigator bestätigen. Nach Abschluss
  oder Überspringen kann derselbe Auftrag unmittelbar die Übernahmeprüfung des
  nächsten noch offenen Planbesuchs öffnen. Mappe und Chronik zeigen Übernahmen
  und höchstens die fünf neuesten Ergebnisse je Besuch, einschließlich Hinweis
  auf weitere. Das vergibt keine XP, Beute oder Zeit und übernimmt den nächsten
  Besuch noch nicht.
- Die vollständige Mappe als Markdown ausgeben. Autorenwortlaut, CRLF und
  führende Leerzeichen bleiben erhalten; erzeugte Überschriften sind einzeilig.

Zusammenhängende Abschnitte derselben Originalnotiz erscheinen als eine
Quellkarte mit einem Originalzugang. Vorlesetext und GM-Teile behalten eigene
Beschriftungen und ihre jeweiligen Live-Aktionen. Der Vorlesebefehl verwendet
nur den öffentlichen Originaltext. Die kanonischen Blöcke, Suche und Markdown-
ausgabe behalten ihre bisherigen Inhalte und Reihenfolge.

**Besuche und Suche** klappt den Index auf oder zu. Beim Öffnen auf höchstens
750 CSS-Pixel breiter Fläche beginnt er geschlossen, sodass der gewählte Besuch
Platz zum Lesen hat. Auf größerer Fläche bleibt er zunächst offen. Aktualisieren
und Rückkehr aus dem Originaleditor erhalten die aktuelle Aufklappentscheidung.
[Native Protokollaufgabe und TiddlyWiki-Vergleich](https://github.com/ThonkTank/Salt-Marcher/blob/16eb0aa8807ac21704abfea5412ac3a22033a23a/docs/reference/gm-ux-qa/protocol-note-selection-20261018/README.md#originalnotizen-als-lesekarten--19102026).

## Verbindliche Daten- und Bedienregeln

1. Der Store liest benötigte Quellen in einer SQLite-Lesetransaktion.
   Ungebundene Worldnotizen werden nicht geladen. Fehlende/archivierte Orts-
   und Weltverweise erzeugen Warnungen; beschädigte benötigte Quellen brechen
   den Read ab. Fehlende Begegnungsgruppen/Actorprofile sind derzeit ebenfalls
   Fehler der ganzen Mappe; zulässige Archivierung gesondert prüfen.
2. Öffnen und Aktualisieren speichern zuerst offene Basis-/Sessioneingaben und
   entfernen die alte Anzeige und Exportfreigabe. Nur die aktuelle Antwort
   derselben Kampagne und desselben Plans darf Inhalte und Aktionen freigeben.
3. Aktionen binden den dargestellten Besuch, Quellenstand und Live-Kontext auch
   über Flush und Quellenreads hinweg. Entfernte, deaktivierte oder in einer
   anderen Oberfläche verborgene Controls bleiben wirkungslos. Neuer eigener
   Vorlesetext während eines Flush wird nicht überschrieben.
4. Begegnungsaktionen verlangen den übernommenen Besuch am aktuellen Szenenort
   und die dargestellte Gruppenrevision. Geänderte Gruppen erfordern eine neue
   Mappe. Alte Deskriptoren ohne Revision bleiben ohne Begegnungsfreigabe lesbar.
5. Quellenlesen, Besuchsübernahme, Kampfentwurf, Beuteplatzierung/-vergabe und
   Chronikspeicherung bleiben ausdrückliche getrennte Aktionen ihrer bestehenden
   Fachbereiche. Es gibt keinen weiteren Writer, Inhaltsbestand oder Graph.
6. Vor und nach dem Dateidialog wird die Ausgabebasis geprüft. Geänderte Quellen
   verlangen Aktualisieren; geschrieben wird der geprüfte Stand. Abbruch schreibt
   nichts. Die Markdownausgabe schreibt zuerst einen exklusiven Kandidaten im
   Zielverzeichnis, synchronisiert und schließt ihn und prüft den Quellen-/
   Kampagnenkontext unmittelbar vor dem atomaren Ersetzen erneut. Schreib-, Sync-,
   Kontext- und Umbenennungsfehler erhalten eine vorhandene Zieldatei und entfernen
   den eigenen Kandidaten. Alte Read-/Exportantworten dürfen nach Schließen oder Kontextwechsel
   weder Aktionen reaktivieren noch neuere Ergebnisse überschreiben.
7. Wird ein übernommener Besuch aus der Planung entfernt, bleiben historische
   Szeneninhalte und Herkunft erhalten. Aktuelle Notizbindungen und Folgebesuche
   werden daraus nicht mehr abgeleitet.
8. Vorschlagsprüfung und Mehrfachübernahme behalten gefilterte Auswahlen und ihre
   Reihenfolge. Review bindet Kampagne, Planrevision, Vorschlagsstand und Anfrage;
   nach Flush werden Revisionen nicht umgebogen. Timeline, Gruppen, Details und
   Receipts werden gemeinsam bestätigt. Ein ungültiger Besuch verwirft den ganzen
   Auftrag. Späte Antworten verändern keine neuere Auswahl/Vorschau.

## Noch zu schließen, in dieser Reihenfolge

1. **Vollständigkeit:** Einen realen Abend mit mehreren Besuchen, wiederverwendeten
   Orten/NSCs, geänderten HP, platzierten/unplatzierten Gruppen und Belohnungen
   zwischen Planner, Mappe und Markdown vergleichen. Fehlende Plannerfelder,
   manuelle Lootnotizen und geplante Rasten nicht durch die Ausgabe als erledigt
   behandeln. Vollständige Ergebnishistorie und Verlaufsexport prüfen.
2. **Native Bedienung und Ausgabe:** Live → Quelle/Kampf/Belohnung → zurück mit
   offenen Entwürfen und Fehlern bedienen. Fokus/Rückkehr, Tastatur, leere Suche,
   100 %, lange Texte und Statblocks prüfen. Im Speicherdialog Quellen ändern,
   abbrechen, Schreibfehler und vorhandene Zieldateien testen. Exportbytes und
   Darstellung offener Markdownfences prüfen, ohne Autorenprosa umzuschreiben.
3. **Wiederaufnahme:** Offenes Review, Plan-/Kampagnenwechsel, laufendes Submit und
   nachfolgenden Read nativ prüfen. Unbestätigte Auswahl, Filter und Eingaben an
   Kampagne/Plan/Run binden und nach Neustart anbieten; veraltete Revisionen
   erkennbar machen. Ergebnisfelder im Prozess sind noch kein dauerhafter Entwurf.
4. **Last:** Reale große Pläne samt Ergebnisreads messen: Zeit, Antwortbytes,
   Peak-RAM und wiederverwendete Quellen. Erst bei Bedarf Übersicht/Suche und
   Besuchsdetail gemeinsam in Store, IPC und UI trennen. Ausgabe bleibt vollständig
   und konsistent; kein allgemeiner Suchindex oder zusätzliches Framework auf Vorrat.

## Quellen und Nachweisgrenzen

`storage/session-packet.ts`, `session-packet-ui.ts` und `session-packet-contracts.ts`
führen Lesen, Bedienung und Markdownausgabe; `desktop/main.ts` den Dateidialog
und `desktop/session-packet-export.ts` die Veröffentlichung der Datei.
`session-progress-ui.ts`/`storage/visit-outcomes.ts` führen Besuchsergebnisse.
Kontrollierte DOM-/SQLiteprüfungen, insbesondere
[desktop-session-packet-context.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/campaign/desktop-session-packet-context.test.mjs), belegen die dort getesteten
Daten- und Kontextgrenzen. `tests/campaign/desktop-session-packet-export.test.mjs` prüft
mit tatsächlichen temporären Dateien und kontrollierten Schreib-/Sync-/Rename-
Fehlern: ursprüngliche Zielbytes oder fehlendes Ziel erhalten, Quellenwechsel
während des Schreibens verworfen, Kandidat entfernt und erfolgreicher Export
bytegleich zum bestehenden Markdownwriter. Das ist kein Nachweis für Stromausfall,
Prozesskill, native Speicherdialoge oder fremde gleichzeitige Zielbearbeitung.
Native Ausgabe und der vollständige Abendablauf sind
weiter offen. Der gemeinsame Textvertrag steht in
[Autorenverweise](authored-text-references.md).
