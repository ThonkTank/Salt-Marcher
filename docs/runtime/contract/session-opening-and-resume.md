# Spielabendstart und Wiederaufnahme

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 18.10.2026. `live.ts` verbindet vorhandene Gruppen, Weltlage, Mappe und
Chronik. Der Start markiert einen Spielabend in der bestehenden Scene; er
übernimmt keinen Besuch, bewegt keine Zeit und verteilt keine Beute.


## Ein bestätigter Live-Laufstand, eine gemeinsame Aktualisierung

Die [Live-Originalanforderung](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/session/requirements/requirements-live-session.md)
verlangt eine lesende Sessionkomposition der fokussierten Scene. `openLive`
liest Scene/Party und Vorbereitungsquellen; `mergeAck` übernimmt bestätigte
Writerantworten samt Revisionen und erhält neuere Textentwürfe. Der gemeinsame
Aufbau versorgt Sceneprosa, Party, Weltlage, Referenzen und Maskenkontexte.

Der Standardpfad projiziert jeden bestätigten Stand einmal. Die Auswahl eines
Charakterprofils und die noch ungespeicherte Ortsauswahl ändern nur ihre lokalen
Controls. Erst die bestätigte Änderung aktualisiert abhängige Kontexte. Dies
braucht weder einen weiteren Store noch einen Cache oder eine künstliche Revision.

Zuvor rief die Profil-/Membershipdarstellung bereits den gesamten Scenekontext
auf; der übergeordnete Aufbau tat dasselbe nochmals. Writerantworten und ihre
Aufrufer wiederholten dies zusätzlich. Diese Verschachtelung ist entfernt:
`openLive` und `mergeAck` verwenden denselben Sceneaufbau, nachgeordnete Controls
starten keinen zweiten Gesamtaufbau. Focus-, Move-, Besuchs-, Membership- und
Zeitaktionen verlassen sich auf die bestätigte Komposition. Ein bereits laufender
Runtimekontext wird vor einer Folgeaktion nicht nochmals vollständig aufgebaut.
Die Entwurfs-/Flush- und Receiptregeln bleiben bei ihren bisherigen Besitzern.
Auch Party-Profilantworten werden nur hier übernommen. Die frühere zweite
Übernahme im Topbaradapter überschrieb eine während der Antwort entstandene
Live-Profileingabe. Der Writeraufruf hält deshalb die abgesendete Profilfassung;
eine neue Eingabe besitzt bereits ein neues Profilobjekt und bleibt einschließlich
eines bewussten Rückwechsels zum alten Wortlaut erhalten. Ohne spätere Eingabe
gilt die bestätigte Profilfassung. Derselbe offene Auftrag hält diese lokale
Aufrufbasis bis zur Receiptklärung. Eine bestätigte verlorene Antwort wird somit
identisch übernommen und kann nicht beim nächsten Flush durch den alten
unberührten Formulartext zurückgeschrieben werden. Eine verworfene Recovery
verliert ihre Wirkung; keine automatische Wiederholung oder zweite Schreibroute.

Notwendige Unterschiede: Die Initialisierungsantwort enthält noch nicht die
vollständige Gruppen-/Fokusprojektion; danach bleibt ein gezieltes Wiederlesen
nötig. Eigenständige Kampf-, Referenz- und Inhaltsdialoge behalten ihre fachlichen
Reads und Revisionen. Eine Gesamtaktualisierung ist damit kein atomarer
Crossfeatureframe und keine Zusage genau eines Datenbankreads für sämtliche
Dialoge. Die separaten Welt-/Agendabasen beschreibt der [Reiseplan](../../atlas/contract/hex-travel.md).

Gezielte Prüfungen zählen den gemeinsamen Vorbereitungs-/Referenzanschluss beim
Öffnen und Textsave, bei Fokus/Membership mit geschlossenem Kampfauswahldialog
und nach bestätigter Ortsänderung. Profilinspektion und lokaler Ortsentwurf
lösen diesen Anschluss nicht aus. Native Gegenproben zählen reale Welt-/Agenda-
IPC-Aufrufe, erhalten Eingabetext, Fokus und Cursor über automatisches Speichern
und lesen nach normalem Neustart bei200% denselben Text und Reisestand.
Große Vorbereitungs-/Rosterprojektionen und parallele Inhaltsreads
eigenständiger Dialoge bleiben gesondert zu messen;
keine vollständige Last-, Plattform- oder Produktabnahme aus diesen Teilbelegen.

## Scene zuerst, ergänzende Vorbereitung unabhängig

Scene, Party und ihre Revisionen kommen aus `LiveView`. `Preparation` liefert
Orte, Wissen und auswählbare Pläne. Der maßgebliche Scene-Read wird vor den
optionalen Material-/Chronikreads an die gemeinsame Main-Bridge geschickt. Beide
Ergebnisse werden unabhängig übernommen; eine langsame
oder unlesbare Vorbereitung verhindert weder Sceneöffnung noch Texteingabe und
Speicherung. Fehlende Vorbereitung ist ausdrücklich unbekannt, kein leerer
Inhaltsbestand. Nur ihre Auswahlcontrols sind gesperrt; bestehende Orts- und
Besuchsidentitäten bleiben erhalten. Der Quellenstatus bietet einen gezielten
Retry ohne Live-Readback, Sceneaufbau oder Rücksetzen von Eingaben.

Die Materialantwort besitzt eine eigene, an die Kampagnenaktivierung gebundene
Readgeneration. Schreibantworten und Gruppenauswahl widerrufen diese kampagnenweite
Quelle nicht. Neuer Quellenread und Kampagnenwechsel widerrufen ältere Antworten.
Die späte Übernahme aktualisiert ausschließlich Materialcontrols und Planangebot,
nicht Sceneprosa, Party, Zeit, Besuchsergebnisentwurf oder deren Kontexte. Auch
der Inhaltsrefresh nach bestätigtem Live-Moment verwendet diesen Pfad. Der
bestätigte Moment und die nächste Eingabe warten nicht auf diesen Zusatzread;
sein Fehler erscheint ausschließlich am Quellenstatus.

Notwendiger Unterschied: Eine ausdrücklich angeforderte Planübernahme wartet auf
ihre Quelle. Neue Eingaben oder Kontextwechsel widerrufen die alte Öffnungsabsicht;
die später geladene Quelle bleibt für die dann aktuelle Scene nutzbar. Der
Besuchsstand einer bereits übernommenen Plan-ID kann unabhängig lesbar bleiben;
eine fehlende Planliste löscht weder Übernahme noch Ergebnis. Ein Fehler von
`LiveView` bleibt ein Gesamtfehler. Keine neue Persistenz, Migration, IPC oder
Schreibroute; die bestehenden Writer-, Revisions- und Receiptregeln gelten weiter.

Gegenproben prüfen Fehler/Transportabbruch, hängende Quelle, Quellenretry ohne
Live-Read, unveränderte Ortsbindung und Prosa, späte Antworten nach Textwrite,
Kampagnenwechsel, überholtem Retry und widerrufener Planabsicht. Die native
Live-/Reiseprobe ergänzt eine fehlerhafte echte Preparation-IPC-Antwort und einen
verzögerten Retry über Textautosave hinweg, anschließend normalen Close/Fresh bei
100%/200%. Große Quellbestände einschließlich synchroner Arbeit im gemeinsamen
Main-Prozess gesondert messen; die unabhängige Rendererübernahme ist keine
Garantie gegen dortige Blockaden. Weitere Plattformen und vollständige
Produktabnahme bleiben offen.

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
Unlesbare Altwerte liefern in `LiveView` einen eigenen `recapDraftError`,
keinen leeren oder bestätigten Entwurf. Die gesunde Scene und Party bleiben
lesbar; ohne bereits ungesicherten eigenen Rückblick lassen sich ihre normalen
Eingaben weiter sichern. Eine bestehende ungesicherte eigene Rückblickfassung
behält ihre übergreifende Flush-/Close-Sicherung bis zur Klärung. Rückblickfelder
bleiben schreibgeschützt, der davon abhängige Abschluss bleibt gesperrt.
„Rückblick erneut laden“ liest nur diese Fassung neu und ersetzt keine offenen
Sceneeingaben. Nach einer wieder lesbaren Quelle werden die Texte geladen;
eine noch offene eigene Fassung bleibt erhalten und benötigt vor dem Ersetzen
einer anderen gespeicherten Fassung die vorhandene ausdrückliche Entscheidung.

Der Schreibguard prüft den gespeicherten Originalwert weiterhin strikt. Auch
Backup und Kampagnentransfer weisen ihn ab; ein sicherer Backupvorgänger wird
nicht ersetzt. Es gibt keine automatische Reparatur, Datenmigration oder neue
Marker-/Schreibroute. Ein Fehler der eigentlichen Scene-/Partyquelle bleibt
ein Gesamtfehler und wird nicht als Rückblickproblem abgeschwächt.

## Originaltext vom Entwurf bis zum nächsten Besuch

Rückblick und Übergabe erhalten beim Lesen normalisierter Browserfelder die
Originalzeilenenden, Leerzeichen und Textverweise über den bestehenden
`preserveLiteralEdit`-Helfer. Unveränderte Felder werden anhand ihrer sichtbaren
Eingabefassung verglichen; CRLF allein gilt nicht als neuer Entwurf. Ein bestätigter
Abschluss übernimmt den abgesendeten Originalwortlaut. Der bestehende
`session-marker`-Writer verbraucht dazu passende Entwurfsfelder in derselben
SQLite-Transaktion wie Chronik und Receipt. Abweichende gespeicherte Felder bleiben
stehen; ein Receipt-Replay bereinigt keine späteren Texte. Der Rückblick hat dafür
einen Speicherbesitzer in `storage/session-recap.ts` für Lesen, Compare-and-set
und Verbrauch. Ein Renderer-Nachlauf ist zum Bereinigen nicht mehr erforderlich.

Die Antwort enthält den verbliebenen Entwurf als bestätigte Basis.
`mergeAck` übernimmt ihn auch bei Receiptklärung mit `acknowledgeFields` und erhält
seit dem Absenden geänderte Eingaben. Während der Abschlussantwort werden diese
lokal behalten; erst danach werden ausschließlich neuere Texte weiter gesichert.
Damit kann kein zusätzlicher leerer Save sie überholen.

Der Einstiegsdialog hält die bearbeiteten privaten Notizen am bisherigen lokalen
Dialogbesitzer. Der Planeditor erhält diese Bytes und bewahrt sie auch bei späterer
Bearbeitung des Besuchs. Der bestätigte Chroniktext bleibt unverändert. Kein neues
Schema, keine Migration und kein weiterer Writer. Ein Abbruch der Einstiegsvorbereitung
verwirft deren unbestätigte Bearbeitung, erhält aber den Abschluss; der Einstieg
lässt sich danach im Startbriefing erneut aus der historischen Übergabe vorbereiten.
Ein unfertiger Einstiegsdialog ist damit noch kein über Neustart gesicherter Planentwurf.

`tools/test-desktop-evening-handoff.mjs` prüft den vollständigen Linuxablauf bei
100 und 200 %: CRLF-Rückblick ergänzen, normal schließen und frisch fortsetzen,
bestätigen, Vorbereitung abbrechen, nach Neustart aus der historischen Übergabe
vorbereiten, Mappe speichern und nach erneutem Neustart denselben Besuch bearbeiten.
Jeder Lauf prüft vier normale Prozessenden, einen unveränderten historischen Abschluss,
stabile Plan-/Besuchsidentitäten und unveränderte Gruppenzeit. Ein gesperrter
separater Bereinigungsport belegt, dass der Abschluss keinen zweiten Draft-Write
benötigt. Start, reale Zoomstufe, Quellenbindung, Aufnahmen und normales Ende
nutzen `tools/native-session.mjs`. Store-Gegenproben öffnen direkt nach dem
Abschluss einen frischen Store ohne Renderer-Nachlauf und prüfen neuere Felder,
Receipt-Replay und vollständigen Rollback bei einem Receiptfehler. Kontrollierte DOMproben
normalisieren Textareas wie ein Browser und halten die Markerantwort für neuere
Eingaben zurück. Native verzögerte Antworten, IME und physischer Crash bleiben offen.

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
- Native Wiederaufnahme mit unlesbarem Rückblick, unabhängiger Sceneeingabe,
  wiederhergestellter Quelle und später Readantwort prüfen; Texte wortgetreu
  erhalten und keinen Abschluss aus einem Ersatztext erzeugen.
- Native Tastatur-, Fokus- und 200-%-Bedienung bei fehlender Quelle und nach
  unabhängiger Kampagnenkopie abnehmen.

`desktop-live-moment-context.test.mjs` prüft Abbruch während Flush und
Gruppenwechsel vor/nach dem Prüfread mit tatsächlichen Markerwrites.
Kontrollierte Store-/DOMtests und die Resume-Consumerprobe prüfen Teilverhalten.
Ersetzte Writer-/Flushports beweisen keine native oder vollständige Produktabnahme.
Scene, Schema und Commandformat erhalten ihre bestehenden Besitzer; der
[NPC-Rohentwurfsvertrag](../../campaign/contract/npc-dossiers.md) gilt getrennt.

Die integrierten Startbriefings zeigen dieselben geprüften Sources je Gruppe.
Fehlende Bereitschaft, Weltlage oder Masken-/Journalquelle bleibt ausdrücklich
unvollständig; bekannte Roster-Mitgliedschaft bleibt davon getrennt lesbar.
Briefingaktionen einschließlich Ortsmappe verwenden die vorhandene Resumelease.
Die Ortsmappe prüft diese Autorität nach ihrem eigenen Flush nochmals; sie
übernimmt keinen neueren Campaign- oder Fokusstand als alte Freigabe.


## Desktop 0.142: Inhalte unmittelbar in der Scene anlegen

Die [programmweite Originalbasis](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/project/requirements/requirements-program-capabilities.md)
verlangt Namensanlage mit vorbelegter, vor der Bestätigung abwählbarer
Szenenbindung. Der Szenentisch erfüllt diesen Weg für NPC, Fraktion, Quest,
Gerücht und Ort. Notizen sind optional. Neue Quests beginnen ohne Mitwirkende;
eine eigene Auswahl übernimmt ausdrücklich die aktuelle Gruppe. Die Anlage
ändert weder Scene-Ort noch Zeit und startet keinen Kampf.

Der bestehende Vorbereitungsauftrag bestätigt Inhalt, offenen narrativen Status,
optionale Ortsbindung und Szenen-Pin in einer SQLite-Transaktion mit einem
Receipt. Veränderte Scene-, Membership- oder Pinrevisionen verhindern eine
Teilpublikation. Eine abgewählte Szenenbindung erzeugt keinen Pin und keine
implizite narrative Ortsbindung. Ausdrücklich ausgewählte Mitwirkende bleiben
davon unabhängig.

Die unbestätigte Formulareingabe und ein gesendeter Auftrag werden pro Scene im
Kampagnenspeicher gehalten. Neustart und Gruppenwechsel öffnen sie wieder.
„Originalauftrag prüfen“ klärt eine ausgebliebene Antwort anhand des bestehenden
Receipts; es sendet keine zweite Anlage. Erst ein nachweislich nicht ausgeführter
Auftrag gibt die Eingabe für einen bewusst neuen Versuch frei. Übernahme,
Anzeigen und das Entfernen des erledigten Arbeitsvermerks sind getrennt: Eine
fehlgeschlagene Anzeige löscht keinen bestätigten Inhalt. Kampagnenkopien ordnen
Scene-, Inhalts- und Auftragsidentitäten um und binden den Receipt neu; permanente
Kampagnenlöschung entfernt auch diese Arbeitsdaten. Kein zweiter Notizbestand im
Browserspeicher.

Gezielt geprüft: gemeinsame Veröffentlichung und Rollback, Receipt-Wiederholung,
verlorene Rendererantwort, unabhängige Kopie samt offenem Auftrag und Löschung.
Native Linux: alle fünf Inhaltsarten, Abwahl, ausdrückliche Quest-Mitwirkende,
getrennte Gruppeneingaben und Neustart. Vollständige Crash-/Plattformabnahme und
eine über alle Unterfähigkeiten konsolidierte Scene-Komposition bleiben offen.
