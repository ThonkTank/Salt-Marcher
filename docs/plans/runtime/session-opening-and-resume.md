# Spielabendstart und Wiederaufnahme

Stand: 15.10.2026. `live.ts` verbindet vorhandene Gruppen, Weltlage, Mappe und
Chronik. Der Start markiert einen Spielabend in der bestehenden Scene; er
übernimmt keinen Besuch, bewegt keine Zeit und verteilt keine Beute.

## Vorhandener Ablauf

„Nächsten Abend vorbereiten“ sichert offene Liveeingaben. Jede Gruppe erhält
Startbriefing, Übergabe, Partywerte, Weltlage, nächsten Besuch, örtliche offene
Fäden und laufende Szenen. Partywerte, Agenda, Ortsmappe und Besuchsmappe öffnen
ihre bestehenden Werkzeuge. Fehlende Quellen bleiben ausdrücklich ungeprüft;
eine gesunde Eröffnung bleibt bei einer anderen fehlenden Quelle nutzbar.
Der Spielabendabschluss behält seine eigene Laufstandprüfung.
„Beenden + Einstieg vorbereiten…“ speichert zuerst Rückblick und Übergabe als
bestätigten Abschluss. Erst danach öffnet es dieselbe Einstiegsvorbereitung mit
dem gerade bestätigten Wortlaut, dem aktuellen Gruppenort, den offenen örtlichen
Fäden und dem nächsten Planbesuch. Abbrechen im zweiten Dialog lässt den
Abschluss bestehen und legt keinen Besuch an. Fehlen optionale Startquellen,
bleibt der Abschluss möglich und die Mappe startet mit der bekannten Basis.

Die Abschlussprüfung bindet ihre Dialoggeneration, Campaignaktivierung, Fokus,
Teilnehmer- und Clockstände. Alte Prüfantworten geben keine Abschlussaktion für
einen neueren Gruppenstand frei; „Erneut prüfen“ bindet ihn ausdrücklich neu.
Abbrechen während des vorangestellten Textflushs widerruft den noch nicht
abgesendeten Markerauftrag. Bereits bestätigte Marker bleiben nach Abbruch oder
verlorener Antwort erhalten; keine automatische Wiederholung oder Rückbuchung.
Die folgende Einstiegsvorbereitung behält dieselbe ursprüngliche Gruppenbasis.

Ohne nächsten übernommenen Besuch hat der sichtbar gewählte Plan Vorrang.
Danach werden Vorlagen bis zum ersten offenen Besuch geprüft; ein Vorschlag
nennt seine Herkunft. Gruppen werden nacheinander gelesen, je Gruppe höchstens
drei unabhängige Basisquellen gleichzeitig. Mappen teilen einen Read je Plan.
Schließen oder ein Ownerwechsel stoppt weitere Fallbackreads. Viele bereits
abgeschlossene Pläne können weiterhin entsprechend viele Reads erfordern.

Jede Aktion hält Dialoggeneration, Campaign, Fokus und Zielgruppe samt Clock
und Membership. Entfernte Controls und veränderte Gruppen verlieren ihre
Gültigkeit auch über Flushes und einen eigenen bestätigten Fokuswechsel hinweg.
Vor Besuchsvorschau, Mappenöffnung oder kombiniertem Start werden Plan-ID,
Revision, Mappenbasis und Besuch erneut geprüft. Eine neue Fassung benötigt
neue ausdrückliche Auswahl; es gibt keinen zusätzlichen Writer oder Replayweg.

„Spielabend beginnen + Text in Szene“ verwendet den sichtbaren Vorleseblock.
Weitere GM-, Referenz-, Encounter- und Belohnungsblöcke bleiben in der Mappe.
Marker und Textspeicherung sind getrennte bestätigte Schritte: Neuere eigene
Prosa während der Markerantwort bleibt erhalten, ein bestätigter Marker wird
bei Textfehlern nicht zurückgenommen. Die bestehende Live-Recovery sichert
ungeklärte Textwrites. Spielerfreigabe und Besuchsübernahme bleiben separat.

## Unfertigen Rückblick erhalten

`SessionRecapDraft` hält Rückblick und Übergabe getrennt vom bestätigten
Spielabendmarker. `live.ts` sichert neuere Eingaben über den vorhandenen
`keepSessionRecapDraft`-Port; die Textbasis verhindert stilles Überschreiben
einer anderen gespeicherten Fassung. Normales Wiederöffnen lädt die Texte,
ohne den Abend zu beenden oder einen weiteren Marker zu schreiben.

An der SQLitegrenze sind beide Felder begrenzte Strings in einem einfachen
Objekt mit eigenen aufzählbaren Datenproperties. Arrays, Zugriffswerte,
verborgene Textfelder und eigene/geerbte Serializer dürfen keine andere
JSONform als den geprüften Entwurf speichern. Ungültige Eingabe oder erwartete
Basis wird vor jeder Schreibwirkung abgewiesen; vorhandene Autorenbytes
bleiben erhalten. Read, Backup und Kampagnentransfer teilen denselben Guard.
Unlesbare Altwerte werden offengelegt und nicht automatisch als leerer
Entwurf neu gespeichert. Deren Fehlerisolation gegenüber unabhängiger
Livebedienung bleibt gesondert zu prüfen.

## Offene Prüfungen

- Echter Marker-/Textwriter mit verzögerter Antwort, neuer eigener Prosa,
  Antwortverlust, Recovery und normalem Close/Fresh; exakte gespeicherte
  Autorenbytes einschließlich CRLF und Textverweisen vergleichen.
- Zwei Gruppen mit verschiedenen Clocks/Teilnehmern: Wechsel während Flush,
  Mappenread und Start darf keine fremde Textablage oder alte Statusmeldung
  auslösen; der selbst angeforderte Fokuswechsel muss weiterhin funktionieren.
- Größere Kampagne mit vielen abgeschlossenen Plänen: Requestzahl, Historyscan
  und Zeit bis zur bedienbaren Startgruppe messen. Erst daraus Query-/Index-
  oder Pagingbedarf ableiten.
- Native Tastatur-, Fokus- und 200-%-Bedienung bei fehlender Quelle und nach
  unabhängiger Kampagnenkopie abnehmen.

`desktop-live-moment-context.test.mjs` prüft Abbruch während Flush und
Gruppenwechsel vor/nach dem Prüfread mit tatsächlichen Markerwrites.
Kontrollierte Store-/DOMtests und die Resume-Consumerprobe prüfen Teilverhalten.
Ersetzte Writer-/Flushports beweisen keine native oder vollständige Produktabnahme.
Scene, Schema und Commandformat erhalten ihre bestehenden Besitzer; der
[NPC-Rohentwurfsvertrag](../campaign/npc-dossiers.md) gilt getrennt.

Die integrierten Startbriefings zeigen dieselben geprüften Sources je Gruppe.
Fehlende Bereitschaft, Weltlage oder Masken-/Journalquelle bleibt ausdrücklich
unvollständig; bekannte Roster-Mitgliedschaft bleibt davon getrennt lesbar.
Briefingaktionen einschließlich Ortsmappe verwenden die vorhandene Resumelease.
Die Ortsmappe prüft diese Autorität nach ihrem eigenen Flush nochmals; sie
übernimmt keinen neueren Campaign- oder Fokusstand als alte Freigabe.
