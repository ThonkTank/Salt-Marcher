# Adventuring Day: Partyvorschau und bestätigte Rastfakten

Stand: 18.10.2026. Ergänzt den [Party-/Scenevertrag](smr03-live-scene-contract.md#party--roster--und-adventuring-day-projektion)
und den [Gesamtumfang](../../SCOPE.md). Der Rechner ist ein Party-/Live-Werkzeug;
der Atlas ist weder sein Owner noch eine Voraussetzung.

## Fachquelle und vorhandener Nutzerweg

Die gebundenen SaltMarcher-Quellen `requirements-adventuring-day-dropdown.md`
und `requirements-adventuring-day-calculator.md`, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, verlangen einen eigenen Topbartrigger,
aktuelle Partyzeilen, lokale eigene Zeilen sowie Budget- und XP→Tage-Modus.
Öffnen aktualisiert die Partybasis. Zeilenbearbeitung verändert weder Roster
noch Scenezuordnung. Die Inhaltsprüfung bestätigt die Registerhashes
`b5a97494844645ee7e94999201e6e90c14f20c0640379d6de8af210bf0969a11`
(Dropdown) und `ae57654b09149229410eff31e49545d1b0f71316c61c8f267c55f812342edc12`
(Rechner). Die zwei Oberflächenanforderungen allein qualifizieren noch keine
vollständige XP-/Rastregel.

`adventuring-day-ui.ts` führt Topbar, Popover, Quelle, Zeilen, XP-Eingaben und
Antwortgeneration. `CampaignStore.adventuringDay` liest in einer gemeinsamen
SQLite-Transaktion; `storage/adventuring-day.ts` komponiert die aktive Party.
`adventuring-day-model.ts` verwendet die gemeinsamen `dailyXp`, `levelXp`,
`xpLevel`, `xpShare` und Encounterthresholds. Bestätigte XP-/Raständerungen bleiben
bei `executeProgress`; die Vorschau erzeugt keine Writes oder Receipts.

Die aktuelle Rechnung verwendet feste Startlevelbudgets, zwei Drittelmarken
für kurze und eine Tagesmarke für lange Rasten. Verbrauchs-XP und optionale
Verdienst-XP sind getrennt; `xpShare` rundet je Empfänger auf. Aktive Figuren
beginnen die Levelvorschau mit ihren tatsächlichen bestätigten XP, eigene
Levelzeilen mit dem jeweiligen Levelminimum. Die Etappenanzeige begrenzt volle
Einzeltage auf 30 und fasst weitere Tage zusammen, ohne ihre Summe abzuschneiden.
Das sind vorhandene Rechenregeln, keine neu bestätigten Rasten oder XP-Awards.

## Leitung ab dem tatsächlichen Raststand

Version 0.126 ergänzt im selben Dropdown eine aktuelle Rastplanung. Der Partyreader
liefert `pacing` aus `projectDayPacing`, das ausschließlich das bestehende
`restFrame` und `xpShare` verwendet. Der Rechner besitzt keine eigenen Rastregeln.
„Heute“ zeigt den verbleibenden individuellen Tagesrahmen nach tatsächlich
abgeschlossenen kurzen Rasten; eine frühe Rast verschiebt die weiteren Marken.
Der Mittelwert ist ungewichtet, unbekannte XP/Rasten sind ausdrücklich ausgeschlossen.
Gemeinsame Marken erscheinen nur bei gleicher verbleibender Abschnittszahl.
Alle aktiven Figuren einschließlich Split Scenes bleiben die Empfängerbasis.

Im aktiven Modus „XP → Tage“ erscheint zusätzlich „Ab jetzt“: die eingegebene
Gruppenbelastung wird gleichmäßig aufgerundet verteilt und zu bestätigtem Long-/
Shortverbrauch addiert. Keine Rasten werden automatisch angenommen und kein
Verdienst-/Levelwechsel verändert diese Belastungsvorschau. Fällige kurze/lange
Rasten, numerische Überziehung und die kleinste Gruppen-XP-Menge bis zur ersten
individuellen Marke bleiben sichtbar. Unbekannte Mitglieder zählen zur Verteilung,
behaupten aber keinen Verlauf; bekannte Mitglieder bleiben als Teilbasis nutzbar.
Eigene Rechnerzeilen verändern diese aktuelle Partyprojektion nicht.

Die bisherigen Tagesmodelle/Etappen sind separat als „ab langer Rast“ beschriftet.
Sie verwenden weiterhin feste Startlevelbudgets. „Party / Rasten öffnen“ öffnet
den echten Party-Popup; die dort gewählten Mitglieder der Gruppe im Fokus und
die vorhandenen Commands bestätigen eine Rast. Rechnerreads schreiben weder
Fortschritt noch Roster, Scene, Weltzeit, Receipts oder Verlauf. Keine Migration.
Öffnen/Neuberechnen markiert den Trigger und Popup als ausstehend und räumt alte
Rastdetails ab. Individuelle Verläufe sind in 20er-Schritten nachladbar.

Gezielt geprüft: früher SR-Abschluss bei 240/1200 XP verschiebt die nächste Marke
auf 720 XP; gemischte Abschnittszahlen, Rundung, dritte SR, Longüberziehung und
unveränderter Store. Nativer Desktop: drei aktive Figuren, darunter unbekannte XP;
1141 Gruppenbelastung ergibt 381 je Figur/1143 insgesamt, bekannte Verläufe
340→721 und 100→481, eigene Zeilen, offengehaltener Detailbereich, Partyübergang
und Neustart. Zwei normale Exits, keine Rendererfehler, Fortschritts-/Roster-/
Uhrzeilen bytegleich. Das ist eine gezielte Ablaufprüfung, keine umfassende
Host-/Großparty-/Layoutabnahme.

## Rastentscheidung vor dem Schreiben

Die aktuelle gebundene `requirements-party-window.md` verlangt einen zweiten
Klick auf dieselbe Rastart. Die Party zeigte bislang bereits „bestätigen“, buchte
aber unmittelbar. `party-topbar-ui.ts` merkt nun beim ersten Klick nur die genaue
Scene-/Fokus-/Clock-/Progressbasis vor und zeigt Figuren, Dauer oder ausdrücklich
keine Zeitfortschreibung sowie die HP-Option. Erst der gleiche zweite Klick ruft
den bestehenden Live-/Progresscommand auf. Auswahl und Eingaben invalidieren
auch nach Zurückändern auf den alten Wert. Wechsel der Rastart, Verwerfen,
Popover-Dismissal, Einklappen des Rastbereichs, neuer Read, eine andere Mutation
und Kampagnenreaktivierung räumen die Vormerkung ab. Während Reads/Writes kann
keine neue Bestätigung entstehen. Fehlender Fortschritt einer gewählten Figur
wird nicht durch stilles Weglassen dieses Empfängers kaschiert.

Der vorhandene `ProgressAction.rest.scene` trennt jetzt die revisionierte
Scene-Bindung von der optionalen Dauer: `amount` und `unit` werden gemeinsam
angegeben oder gemeinsam weggelassen. Die Party bindet die fokussierte Scene
immer. `CampaignStore.executeProgress` prüft Focus, Mitgliedschaft, Clock und
Empfänger in derselben Transaktion wie die Rast, auch bei ausgeschalteter
Zeitfortschreibung. Ohne Dauer entstehen weder Clockänderung noch Clockreceipt;
der Verlauf nennt die gebundene Scene ohne erfundene Dauer. Bestehende Commands
mit Dauer und alte Receipts bleiben gültig; Replay prüft den Originalcommand.
Die historischen Commands ganz ohne Scene bleiben für ihre bestehenden Aufrufer
unterstützt und erhalten damit keine nachträglich erfundene Szenenbindung.
Keine Datenmigration oder zusätzliche persistente Vormerkung.

Nach bestätigter Buchung zeigt derselbe Rastbereich „Gebucht“ mit den tatsächlich
gewählten Figuren, der Zeitoption und der HP-Wirkung. Der zweite Klick endet damit
nicht mehr ohne sichtbare Rückmeldung. Eingaben, Reads, Einklappen und Schließen
räumen diese vorübergehende Meldung ab. Eine fehlgeschlagene oder unbestätigte
Buchung erzeugt keine Erfolgsmeldung; eine verspätete Antwort darf sie nach
Schließen/Wiederöffnen oder Kampagnenwechsel nicht in einen neuen Kontext setzen.
Der vorhandene native Ablauf prüft die Meldung vor Rückkehr der abwesenden Figur
und führt Begegnung, XP-Abschluss und Neustart weiterhin vollständig aus.

Bei gewählter HP-Heilung nennt der Rastbereich außerdem den bestätigten HP-Stand
jeder gewählten Figur. Der Progresswriter gibt dafür denselben bestätigten
`ProgressAck` über die bestehende Partybrücke zurück. Die Anzeige verwendet dessen
HP-Fakten und die eindeutigen Empfängerbezeichnungen; sie berechnet keine eigene
Heilungsregel und liest keinen späteren Stand als angebliches Buchungsergebnis.
0 HP und unbekannte HP bleiben damit direkt am Ergebnis erkennbar. Die native
Probe unterstützt mit `GM_QA_LONG_REST=1` die vollständige lange Rast mit positiver
HP-Heilung, unveränderten 0 HP, abwesender Figur, Rückkehr und Kampfabschluss.

Die Rastgrenze verwendet die bereits validierte fokussierte Scene aus demselben
Live-Read. Sind Fokus und Primary identisch, liest dieser deren vollständigen
Inhalt nur einmal; eine andere Primary wird weiterhin separat geprüft.

`desktop-party-rest-confirmation.test.mjs` prüft mit echten DOMhandlern und
SQLiteStore den read-only Erstklick, genau einen zweiten Commit, Verwerfen bei
Auswahl-/Dauer-ABA und Kontextwechseln, Readfehler, explizite Zeitwahl, fehlende
Empfängerbasis sowie atomare Ablehnung und Replay. Die Live-Screen-Bridge ist in
diesen kontrollierten Fällen ersetzt; deren Flush-/Recoverypfad ist dadurch
nicht qualifiziert. Native Escape-/Light-Dismiss-/Fokus-/Layoutprüfung und
unbekannte IPC-Ausgänge bleiben gesonderte Abnahmen.

Beim Ein-/Ausschalten einer Figur hält die Partyoberfläche nur Fokus-ID,
Roster- und Fokusrevision für den bestehenden Membershipcommand fest. Eine
Kopie der gesamten Liveansicht mit allen Profilen und Scenetexten entfällt;
die drei skalaren Werte bleiben auch über den anschließenden Flush unverändert.

Die vorhandene native Probe `tools/test-desktop-scene-selection-read.mjs`
verbindet nun Abwesenheit, zweistufige Rast und Rückkehr bei 100 % mit gespeicherten
Szenengruppen, Initiative/Abschluss bei 200 % und einer weiteren frischen Öffnung.
Sie prüft unveränderte Rastfakten der abwesenden Figur, genau 60 Minuten Szenenzeit,
alle drei zurückgekehrten Partyfiguren im Kampf und einmalig 120 XP / 40 je Figur.
Die inaktive Reserve bleibt unverändert. Quellenlesefehler und die gemeinsame
Encounter-Auswahl behalten ihre bisherigen gezielten Prüfungen. Dieser Ablauf
ersetzt keine vollständige Party-, Plattform- oder Recoveryabnahme.

Bei gleichnamigen Rastempfängern nennen Auswahl und Vormerkung zusätzlich
Spielername (oder „Spieler offen“) und einen eindeutigen kurzen ID-Präfix.
Beide verwenden dieselbe vollständige Szenengruppe: Abwählen einer Namensvetterin
verkürzt die Bestätigung nicht wieder auf den mehrdeutigen Namen. NFC- und
Leerraumvarianten zählen als sichtbare Namensgleichheit, ohne Profile umzuschreiben.
Eindeutige Namen bleiben kurz. Der bestehende ID-/Revisionsvertrag der Buchung
bleibt unverändert.

Die native Probe nutzt den gemeinsamen Sitzungsprüfer mit echtem Browserzoom.
`GM_QA_NAMESAKES=1 GM_QA_ZOOM=2` führt den gesamten Ablauf bei 200 Prozent mit
Noras und Noahs „Ada“ aus: nur Nora rastet, Noah und die abwesende Cora bleiben
unverändert; danach kämpfen wieder alle drei und erhalten genau einmal ihre XP.
DOM-/Storetests decken zusätzlich gleiche oder fehlende Spielernamen ab.

## Begegnungen als vollständigen Tagesplan bewerten

Version 0.127 verbindet den bestehenden Rechner mit gespeicherten Encounter-Vorlagen.
Im selben Dropdown können bis zu 20 Planzeilen mit je 1–99 Wiederholungen gesucht,
hinzugefügt, umgeordnet und entfernt werden. Die aktuelle aktive oder eigene
Rechnerparty bestimmt Multiplikator und Schwierigkeit; eine historische
Planungsparty in der Vorlage wird nicht heimlich übernommen.

`readDayItinerary` liest die gewählten Vorlagen im bestehenden Dayread innerhalb
der gemeinsamen SQLite-Transaktion. ID und gespeicherte Revision sind gebunden.
Geänderte Vorlagen liefern ein sichtbares Problem; „Vorlagen aktualisieren“ liest
bewusst deren aktuelle Revisionen. Fehlende oder beschädigte Quellen und fehlende
Kreatur-XP erzeugen keine scheinbar vollständige Nullsumme. Es werden weder Vorlagen
noch NPCs, Party, Kämpfe, Rasten, XP oder Uhren geändert. Keine neue IPC-Operation,
Datenbank oder Migration.

Mehrere Planzeilen dürfen dieselbe Quelle verwenden, etwa nach dem Teilen einer
Wiederholungszeile an einer Rastmarke. Der Reader liest und validiert jede
unterschiedliche Vorlage und bewertet sie nur einmal je Store-Aufruf. Jede
Planzeile prüft weiterhin ihre eigene erwartete Revision; Reihenfolge,
Wiederholungen, Rasten und Rundung bleiben zeilenbezogen. Die Wiederverwendung
endet mit dem Read und hat keine Invalidierungs- oder Speicherregeln zwischen
Aufrufen. Eine spätere Quellenänderung benötigt weiterhin ausdrückliches
Aktualisieren; eine inzwischen beschädigte Quelle wird erneut abgewiesen.

`assessEncounter` bewertet jede Vorlage mit derselben Rechnerparty. Angepasste XP
bilden die Belastung, Basis-XP den Verdienst. `xpShare` rundet beide je Begegnung
auf, bevor Wiederholungen und Planzeilen summiert werden. Beispiel mit drei Figuren:
zwei einzelne Goblins (50 XP pro Begegnung) und zwei Goblins gemeinsam
(100 Basis-/150 angepasste XP) ergeben 250 rohe Belastungs-/200 Basis-XP,
aber 252 tatsächlich verteilte Belastungs-/204 Verdienst-XP. Der Rechner prognostiziert
84 Belastungs-/68 Verdienst-XP je Figur. Bei sechs Figuren ändern sich Multiplikatoren
und Rundung: 162 Belastungs-/210 Verdienst-XP. Keine zweite Abrechnungsregel.

Je Etappe werden kumulierte Last/Verdienst und der Rastbedarf bekannter aktiver
Figuren angezeigt. Dazwischen werden keine Rasten oder Levelwechsel angenommen.
Bei eigenen Zeilen bleiben aktuelle Party-Raststände unabhängig. Etappen und
XP→Tage verwenden die verteilten Summen; die ursprünglichen Summen stehen daneben.
Manuelle XP-Eingaben werden vor Planmodus bewahrt und beim Ausschalten wieder
hergestellt. Suchantworten und auswählbare Treffer sind an Workspace/Antwortgeneration gebunden.
Schon die Änderung des Suchtexts entzieht alte Treffer während der Entprellzeit;
auch „Vorlagen aktualisieren“ räumt sie vor dem Read ab. Ladezustand und Fehler
bleiben sichtbar; erst eine aktuelle erfolgreiche Antwort bietet neue Auswahl.
Ausgewählte Planzeilen, rohe Anzahlen, Reihenfolge und Revisionen bleiben bei
Suche oder Lesefehler erhalten. Ein bewusstes erfolgreiches Aktualisieren ersetzt
die Revisionen. Verspätete Antworten und abgelöste Auswahlhandler können keine
Planzeile ergänzen. Das ändert weder IPC noch Entwurfsformat oder Datenbank.

Gezielter Beleg am 16.10.: DOM-Gegenproben scheitern vor der Korrektur an
weiter auswählbaren Alttreffern. Danach sind neue Suche, fehlgeschlagenes
Aktualisieren mit Wiederholung, verspätete Antworten und Kampagnenwechsel geprüft.
Nativ mit echter IPC/Store-Anbindung: gehaltene Suchantwort, Lesefehler, erneute
Suche, Hinzufügen, explizites Aktualisieren, Popupwiederöffnung und Escape mit
Fokus am Trigger; bestehende Anzahl und Vorlagenrevisionen bleiben erhalten.
Datenbankbytes während dieser Planungsaktionen unverändert, normaler App-Exit,
keine Rendererfehler und bestätigte XP nach erneutem Storeöffnen erhalten.
Diese Teilprüfung ersetzt keine Großparty-, 200-%- oder vollständige
Host-/Produktabnahme.

Die Rechnereingaben bleiben ein lokaler Entwurf auf diesem Gerät, getrennt je Kampagne.
Eigene Levelgruppen, manuelle XP und der geordnete Encounterplan einschließlich
Vorlagenrevisionen und Rasten werden nach Aktivierung oder Neustart wieder aufgenommen.
Ergebnisse werden neu gelesen und berechnet; eine Quelländerung benötigt weiterhin
„Vorlagen aktualisieren“. Der Entwurf gehört nicht zum Kampagnenexport. Speicherfehler
werden angezeigt, beschädigte Entwürfe bleiben bis zum ausdrücklichen Zurücksetzen
erhalten. DOM-Regressionen prüfen Wiederaufnahme, Kampagnenwechsel und Fehlerpfade.

Eine sofortige Aktualisierung beim Öffnen oder beim Wechsel zur aktiven Party
übernimmt auch eine bereits vorgemerkte Neuberechnung. Deren alter 120-ms-Timer
darf keinen zweiten Read oder unbeabsichtigten Wiederholungsversuch nach einem
Lesefehler auslösen. Die gemeinsame Main-/SQLite-Transaktion bleibt erforderlich,
damit Party, Raststände und Vorlagen aus derselben Lesebasis stammen. Eingaben
bleiben unabhängig vom Read gesichert; Fehler räumen Ergebnisse ab, nicht den
Entwurf. `tools/test-desktop-day-refresh.mjs` prüft diesen Weg über echte IPC und
SQLite bei 100/200 Prozent, Fehler und erneutes Öffnen sowie App-Neustart. Für den
gezielten Timingfall werden die DOM-Aktionen innerhalb eines Renderer-Tasks
ausgelöst; das ist keine Messung menschlicher Klickgeschwindigkeit oder eine
vollständige Leistungsabnahme.

Die native Tagesplanprobe `tools/test-desktop-day-refresh.mjs` führt zusätzlich
bei 100 und 200 Prozent die gespeicherte Wachpatrouille über 18 Begegnungen,
die Teilung nach Begegnung 6, den Wechsel zur eigenen Party und zurück sowie
die Wiederaufnahme der beiden Zeilen nach App-Neustart aus. Dabei bleiben
1.368 verteilte Belastungs-XP und 900 Verdienst-XP erhalten; Party-, Fortschritts-,
Scene- und Vorlagenrecords bleiben unverändert. Der sichtbare Vorlagenname und
die Grenzen aller Zeilencontrols werden mitgeprüft. Planzeilen verwenden zwei
flexible Eingabespalten mit Name und Aktionen über der gesamten Zeilenbreite;
das verhindert die zuvor beobachteten Einzelbuchstaben im schmalen Eingabebereich,
ohne eine Bildschirmbreiten-Sonderregel. Der Prüfweg verwendet jetzt echten
Browserzoom statt einer erhöhten Geräte-Pixeldichte. Er prüft zusätzlich, dass
Rastmarken beim Umordnen an ihrer Begegnungszeile bleiben und ausstehende
Antworten frühere Ergebnisse unsichtbar halten, ohne die Formulargeometrie zu
verschieben. Der gemeinsame native Sitzungsprüfer bindet Buildhashes, normale
Prozessenden und PID-Abwesenheit an den vollständigen Ablauf. Das ist eine gezielte Linuxprüfung,
keine vollständige Layout-, Plattform- oder Produktabnahme.

Gezielte Prüfung: Storeablauf mit echter Vorlagenspeicherung, abweichender alter
Vorlagenparty, Wiederholungen, Rundung, eigener Sechserparty, unveränderten
Datenbankbytes und sichtbarer Ablehnung einer später geänderten Vorlage.
Nativ geprüft: Hinzufügen, Wiederholungen, Reihenfolge, ungültige leere Anzahl,
Wechsel zwischen aktiver und eigener Party, gespeicherte Quelländerung mit
ausdrücklichem Refresh, Rückkehr zu manuellen Eingaben, Übergang zum Encounter-Editor
und Neustart. Party-, Fortschritts- und Uhrzeilen bleiben unverändert; zwei
normale Exits, keine Rendererfehler.

## Geprüfte Daten- und Eingabegrenzen

Der erste Reader verwendete `readProgress` für den gesamten Roster einschließlich
Kampfmasken und inaktiver Figuren. Eine beschädigte inaktive Fortschrittszeile
blockierte deshalb sowohl die gesunde aktive Party als auch eigene Rechnerzeilen.
Der Rechner konsumiert jetzt nur `active=1` in stabiler Rosterreihenfolge,
`readProgressCharacter` und `readCharacter` der betreffenden Figuren. Er liest
keine Kampfmasken oder Fortschrittsnotices. Beschädigte benötigte aktive
Fortschritts-/Profilrecords bleiben Fehler; die Einschränkung versteckt sie nicht.
Globale Backupprüfung und andere Fortschrittsverbraucher werden nicht gelockert.

Die aktive Party umfasst alle Split Scenes. Fokus, Sceneort und Uhr liefern
keine alternative Auswahl. Fehlende XP bleiben `null`; daraus wird weder Level 1
noch ein Budget erfunden. Ein unbekannter Raststand sperrt den bestätigten
Verbrauchsindikator, aber kein unabhängig aus bekannten Levels berechenbares
Tagesbudget. Eigene Levelzeilen bleiben auch bei unbekannten aktiven Levels
benutzbar. Leere Gesamt-/Verdienst-XP werden als ungültige numerische Eingabe
weitergereicht und durch denselben Partyrechner erklärt; `Number('')` darf sie
nicht zu einem gültigen Nullergebnis machen. Ausdrückliche Eingabe `0` ist gültig.

Eigene Zeilen und Rohwerte werden im lokalen Kampagnenentwurf bewahrt (siehe
Tagesplan oben). Schließen/Öffnen und Kampagnenreaktivierung nehmen diese Eingaben
wieder auf; Berechnungsergebnisse und die aktive Partybasis werden neu gelesen.
Antwortgeneration und Workspace-Token verhindern, dass ältere Reads nach
Reaktivierung eine neuere Partybasis überschreiben. Diese Vorschau erteilt
keine Autorität für einen späteren XP-/Rastcommand.

## XP-Korrektur und getrennte Abrechnung

Die aktuelle `requirements-party-window.md`, gleiche Quellrevision wie oben,
Hash `e02994fea23b879f478de2b6656aff88f0b79d048a608785ff61f09829569395`,
L31–48, ersetzt ausdrücklich die historischen Dropdownregeln: XP dürfen bis
null sinken, das Level wird dabei neu abgeleitet. Manuelle XP verändern weder
Long-/Short-Verbrauch noch A/k. Das Levelminimum begrenzt nur die grafische
Levelanzeige. Es ist keine Untergrenze für Korrekturen.

Der zuletzt ergänzte `party-xp-model.ts.changeCharacterXp` hatte die alte
Leveluntergrenze wieder eingeführt und negative Korrekturen auch von Long-/
Short-Verbrauch und A abgezogen. Gegenbeispiel: 1.000 XP mit 240 bestätigten
Belastungs-XP, früher kurzer Rast und weiteren 100 Belastungs-XP. Ein Abzug von
950 muss 50 XP / Level 1 ergeben; Longverbrauch 340, Shortverbrauch 100, A=240
und k=1 bleiben erhalten. Das kleinere aktuelle Budget 300 ist damit bereits
überzogen. Verbrauch zu löschen würde die nötige lange Rast verstecken.

Der gemeinsame Rechner begrenzt Abzüge jetzt ausschließlich auf null und
bewahrt alle Rastfakten. Party- und Charaktervorschau erklären die gleiche
Wirkung wie `executeProgress`; „Setzen“ und „Hinzufügen“ erhalten ebenfalls
Verbrauch und A/k. Ein unbekannter XP-Stand erlaubt weiterhin keinen Abzug;
ein ausdrückliches Setzen schafft die XP-Basis ohne eine Rast zu erfinden.
Keine Migration: bestehende bestätigte Fakten werden nicht nachträglich aus
früheren Awards rekonstruiert oder umgeschrieben.

Die neue `party-award`-Abrechnung verteilt Verdienst und Tagesbelastung mit
getrennten Empfängerlisten und gemeinsamer Aufrundung. Sie prüft Roster-,
Mitgliedschafts- und Fortschrittsrevisionen; Belastung benötigt aktive Figuren,
Verdienst kann ausdrücklich Reservefiguren erreichen. Belastung allein erzeugt
keine bekannte XP-Basis. `party-award-member` hält damalige Vorher-/Nachherwerte;
ein späterer manueller XP-Command mit `correctionOf` hängt einen eigenen Eintrag
an. Er ändert weder den referenzierten Award noch dessen Belastungsfakten.

Vier Fälle in `tests/desktop-xp-rest-corrections.test.mjs` prüfen den echten Store:
Abwärtskorrektur über Levelgrenzen bis null, erhaltene frühe/zweite/zusätzliche
Shortsections und Longreset, Vorschau/Writer-Gleichheit, unveränderte verlinkte
Herkunft, Replay ohne zweite Wirkung und Fresh. Belastung ohne bekannte XP und
Rollback der ersten Teilnehmerwirkung bei einem späteren stale Empfänger sind
getrennte Gegenproben. Eine tatsächliche Party-DOMvorschau zeigt den Abzug und
erklärt erhaltenen Verbrauch. Diese kontrollierten Fälle ersetzen keine native
XP-/Rast-/Abrechnungsabnahme.

Die direkten Abrechnungs-/Copyprüfungen stehen in
[desktop-party-xp.test.mjs](../../../tests/desktop-party-xp.test.mjs),
späte Speicherbestätigungen in
[desktop-party-award-dom.test.mjs](../../../tests/desktop-party-award-dom.test.mjs).

## Lokale Belege und Grenzen

Neun Fälle in `tests/desktop-day-calculator.test.mjs` verwenden den echten Store,
den echten Rechner und die tatsächliche HTML-/UIoberfläche in Linkedom:

- beschädigter inaktiver Fortschritt blockiert die gesunde Party nicht;
  beschädigter benötigter aktiver Fortschritt bleibt sichtbar abgewiesen,
- tatsächliche XP statt Levelminimum, gleiche aufgerundete Awardverteilung,
  unveränderte Datenbytes vor/nach Vorschau und identische Werte nach Fresh,
- fehlende XP und unbekannte Rasten mit eigenem unabhängigen Budget,
- numerische Grenzen und zusammengefasste große Tagesmengen,
- beide leeren XP-Felder mit ausdrücklicher Korrektur auf gültige Null,
- echte Aufteilung auf zwei Scenes, Fokuswechsel und Party-Deaktivierung,
- eigene Zeilen/Moduswechsel ohne Partywrite und ältere Antwort nach Reaktivierung.

Mit den eingegangenen Chase-Draft-/Wechselprüfungen bestanden 41 lokale Fälle
und der Desktop-Typecheck. Linkedom belegt kontrollierte Handler-/Readwirkungen;
native Popover-, IPC-, Tastatur-, Monitor-, Last- und Produktabnahmen bleiben offen.

## Nächste ausführbare Schritte

1. **Partyprojektion und aktuelle Faktengrundlage schließen.** Die aktuelle
   DayView besitzt noch keine explizite Roster-/Fortschrittsrevision pro Ergebnis.
   `adventuring-day-contracts.ts` und Reader um die tatsächlich konsumierte
   Mitgliedschafts-/Progressbasis ergänzen, wenn weitere Verbraucher sie nutzen.
   Profillabel und XP-/Rastbasis atomar halten. Alte Vorschauen dürfen nie als
   Schreibgrundlage dienen. Abnahme: XP-Korrektur, Mitgliedschaftsänderung,
   unbekannte Basis und Refresh im selben Workspace; keine Sceneänderung.
2. **Verbleibende Rast-/Awardübergänge prüfen.** Feste Dayvorschau-Startbudgets
   gegen die Originalrechnung und `restFrame` nach Leveländerung prüfen;
   theoretische Etappen bleiben von bestätigten Rasten getrennt. In
   `storage/progression.ts`/`progression-ui.ts` gültige XP-Herkunftstypen und
   prüfbare Referenzen einschließlich Storyawards konsistent schließen; der
   aktuelle Referenzguard prüft nur Campaign-/Characterzuordnung. Defekte
   Quellfacts, Health-/Lootfremdreferenzen und ältere Verlaufseiten prüfen.
   Getrennte Rundung bei Dayforecast, Completion und Partyaward mit gemischten
   aktiven/Reserve-/Load-only-/XP-only-Empfängern vergleichen. Zeitgebundene
   ausgewählte Rasten am realen Clock-/Autonomieanschluss abnehmen; spätere
   XP-/Loot-Ereignisse dürfen die ursprünglichen Rast-/Awardfacts nicht ändern.
3. **Oberfläche am Host abnehmen.** Popoveröffnung/-schließen, Fokus zurück zum
   Trigger, Escape, Tastatur, 200 %, Scrollen vieler Zeilen, lange Namen,
   Storage-/IPCfehler und tatsächliche numerische Browserfelder prüfen. Für
   fehlerhafte erforderliche aktive Records eine hilfreiche Ownernavigation
   bereitstellen. Öffnen/Refresh muss alte Summen sichtbar als ausstehend zeigen.
4. **Kosten nach realem Bedarf messen.** Die aktive Query ist enger, aber liest
   weiterhin jede aktive Figur. Große Party-/Rosterbestände und häufige
   Fortschrittsänderungen messen; danach eine gemeinsame begrenzte Partyprojektion
   verwenden, falls die Messung es erfordert. Kein separater persistierter
   Rechenergebniszustand und kein paralleles XP-/Rastmodell; der lokale
   Eingabeentwurf bleibt davon getrennt.


## Geplante Rasten zwischen Begegnungen (0.135)

Der lokale Encounter-Tagesplan erlaubt vor jeder Zeile „Ohne Rast“, „Kurze
Rast“ oder „Lange Rast“. Reihenfolge und Wiederholungen bleiben editierbar;
beim Aktualisieren der Vorlagen bleiben die gesetzten Rasten erhalten.
Eine Pause gilt für alle Rechnerfiguren und vor der gesamten Zeile. Für Pausen
zwischen Wiederholungen wird dieselbe Vorlage mehrfach eingefügt.

Der Party-Reader simuliert die Etappen auf isolierten Fortschrittskopien.
`restAfter` ist dieselbe Partyregel für bestätigte Rasten und Vorschau:
kurze Rast setzt Shortverbrauch zurück und teilt den verbleibenden Rahmen;
lange Rast setzt Tagesverbrauch und Abschnitte zurück. Eine kurze Rast heilt
kein überschrittenes Tagesbudget und keinen unbekannten Raststand. Eine
geplante lange Rast schafft nur einen hypothetischen bekannten Rahmen, während
Snapshot und Topbar weiterhin die bestätigte unbekannte Basis zeigen.
Die Einzelansicht zeigt auch diesen Übergang von offen zu hypothetisch bekannt.

Belastung und Verdienst werden weiterhin pro Begegnung gerundet und unabhängig
von den Pausen aufsummiert. Startlevel bleiben fest; Verdienst-Levelwechsel
ändern die Rastprognose nicht. Eigene Levelgruppen starten nach einer langen
Rast. Das allgemeine XP→Tage-Modell mit zwei kurzen Rasten pro Tag bleibt als
separates theoretisches Modell ausgewiesen. Keine Zeit, HP, XP, bestätigten
Rasten oder Journalereignisse werden geschrieben; kein neues Speicherschema.

Grenzen: Pausen gelten derzeit für die gesamte Rechnerparty; Dauer,
Teilnehmerauswahl, Reisekosten und Übernahme in einen dauerhaft gespeicherten
Sessionablauf sind nicht Bestandteil dieses lokalen Rechners.


## Levelmarken und Zielverdienst (0.144)

Im bestehenden Day-Popover zeigt „Levelentwicklung planen“ die nächsten
Levelmarken jeder Rechnerfigur. Die aktive Party nutzt ihre bestätigten XP,
eigene Levelgruppen starten am Levelminimum. Figuren aus anderen aktiven
Scenes bleiben einbezogen; Figuren auf Level 20 werden ausdrücklich gezählt.
Die Partyprojektion liefert den kleinsten Gruppenverdienst, der nach der
bestehenden Aufrundung der XP-Anteile die jeweilige Marke erreicht.

„Verdienst bis Level … einsetzen“ schaltet auf die Fortschrittsvorschau und
übernimmt ausschließlich diesen Gruppenverdienst als getrennte lokale
Planungseingabe. Belastung, Levelgruppen und gespeicherte Party bleiben erhalten.
Die Fortschrittsansicht listet alle erreichten Levelmarken mit dem jeweiligen
Gruppenverdienst, persönlichen Anteil und den betroffenen Figuren. Lange Listen
lassen sich in Schritten von 20 vollständig nachladen.

Bei eingeschaltetem Encounter-Tagesplan bleiben dessen XP maßgeblich; die
Zielknöpfe sind deaktiviert. Erreichte Levelmarken nennen die erste abgeschlossene
Planzeile, nach der sie erreicht sind. Wiederholungen innerhalb einer Planzeile
werden nicht einzeln aufgeschlüsselt. Veraltete Ergebnisaktionen werden bei
Eingabeänderung, Workspacewechsel oder Schließen verworfen.

Keine XP-, Rast-, Zeit- oder Rosterbuchung; kein neues Speicherschema.
Hypothetische Levelwechsel verändern weiterhin nicht die festen Startbudgets
der Tages- und Rastvorschau. Hostprüfung umfasst Zielübernahme, eigene Gruppen,
mehrere Levelwechsel, Encounterplan, Escape/Fokusrückkehr und Neustart mit
unveränderten Partyfacts. Breite Plattform-, Zoom- und Großpartyabnahme bleibt offen.

## Rastmarken innerhalb wiederholter Begegnungen (0.151)

Die Topbarplanung zeigt bei einer Wiederholungszeile jetzt, nach welcher einzelnen
Begegnung bekannte Figuren ihre nächste kurze oder lange Rast erreichen. Bereits
vor der Zeile fällige Rasten erscheinen bei null Begegnungen. `projectDayRestStops`
nutzt dasselbe `restFrame` wie Party und laufende Vorschau; frühe kurze Rasten,
übrig gebliebene Abschnitte, überzogene Budgets und unbekannte Raststände behalten
ihre Bedeutung. Die aufgerundete Belastung je Begegnung bleibt maßgeblich.
Zählereignisse statt einer Matrix aus Figuren und Wiederholungen halten die
Berechnung auf Partygröße plus tatsächlich angezeigte Marken begrenzt.

„Hier kurze/lange Rast einplanen“ teilt eine Zeile an der gewählten Marke und setzt
die Rast vor den verbleibenden Teil. Zum Beispiel werden zwölf Begegnungen zu
„3 Begegnungen, kurze Rast, 9 Begegnungen“. Der vorherige Rastbeginn bleibt am
ersten Teil; Quellen-ID und Revision, gesamte Gegnerzahl, Belastung und Verdienst
bleiben erhalten. Ab einer bereits fälligen Marke wird die Rast vor die vorhandene
Zeile gesetzt. Bei 20 Zeilen bleibt die Teilung gesperrt und erklärt die Grenze.
Alte Ergebnisaktionen verlieren bei Eingaben, neuem Read, Schließen und
Kampagnenwechsel ihre Wirkung. Der bestehende lokale Kampagnenentwurf speichert
die entstandenen Zeilen/Rasten; es gibt kein neues Speicherschema und keine
Party-, Zeit-, XP-, Encounter- oder Rastbuchung.

Die Marken liegen nach vollständigen Begegnungen: eine Belastungsmarke kann im
Kampf überschritten werden. Die Planung behauptet daher keine sichere Pause
innerhalb eines Kampfs. Unbekannte Figuren erhalten keine erfundene Marke;
eine geplante lange Rast kann wie bisher einen hypothetischen bekannten Zustand
schaffen. Pausen gelten weiterhin für alle Rechnerfiguren. Am Ende der letzten
Zeile ist keine weitere Begegnung aufzuteilen. Teilnehmerrasten, Dauer und
Übernahme in einen gespeicherten Sessionablauf bleiben offen.


## Vollständige Figurenansicht im Rechner (18.10.2026)

Die aktuellen Figurenfacts und die XP-/Levelvorschau zeigen zunächst höchstens
40 Figuren. „Weitere Figuren“ erweitert dieselbe bestätigte Tabelle in Schritten
von 40; ein Zähler nennt die sichtbare und gesamte Anzahl. Bisher waren weitere
aktuelle Facts nur als ausgelassen gemeldet und weitere XP-Projektionen still
abgeschnitten. Summen und Berechnung verwenden weiterhin die gesamte Party.

`adventuring-day-ui.ts` paginiert ausschließlich die bereits empfangenen Werte.
Keine neue IPC, keine zusätzlichen Reads, keine Datenmigration oder Partywrites.
Die Ergebnisgeneration, der Workspace-Token, der offene Popover und die Verbindung
zum aktuellen Dokument entziehen alten Seitenaktionen ihre Wirkung, sobald neue
Eingaben oder ein neuer Kontext die Antwort ablösen. Nach bestätigtem Refresh
beginnt die neue Tabelle wieder mit den ersten 40 Figuren.

Gezielter Store-/DOMgegenbeleg: 45 aktive Figuren, letzte Figur mit 299 XP;
aufgerundeter Gruppenverdienst von 1 XP erreicht auch bei ihr 300 XP / Level 2.
Beide Tabellen müssen diese Figur erreichbar machen. Seitenaktionen dürfen bei
laufender Neuberechnung keine alten Werte ergänzen oder neue Reads starten;
Roster-, Fortschritts- und Scenefacts bleiben unverändert. Native Probe:
`python3 tools/ui-session.py node tools/test-desktop-day-party.mjs`, bei 100 und
200 Prozent einschließlich erneutem Öffnen und normalem Prozessende. Dieser
begrenzte Ablauf ersetzt keine vollständige Party-/Produktabnahme.
