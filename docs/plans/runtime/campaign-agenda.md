# Kampagnenagenda, Fantasy-Datum und Fristen

Stand: 15.10.2026. Die Agenda ergänzt den vollständigen Reise-/Weltzeitvertrag
und die Spielabendvorbereitung; sie ersetzt weder Timelinebesuche noch World
Planner, Shoprestock oder zeitgebundene Autonomie.

## Ausführbarer Anschluss

`CampaignStore.agenda` / `storage/agenda.ts` lesen Kalender, gewählte Scenezeit
und Kalenderereignisse in einer SQLite-Lesetransaktion. `AgendaQuery` filtert
Text, Horizont und Ort und liefert höchstens 40 Einträge plus Fortsetzung mit
Zeit-/Kalenderbasis. Die Ergebnisgröße ist begrenzt; die Suche scannt derzeit
alle bestehenden Kalenderereignisse. Ein kleines Ergebnis ist kein Lastnachweis.

Die Ortsbeschränkung wird erst nach Prüfsumme und Datensatzidentität/-revision
angewendet. Ein manipuliertes `locationId` darf eine beschädigte Frist nicht
vor der Prüfung aus der Ortsagenda entfernen. Ohne gezielte Event-ID prüft der
Reader deshalb alle Kalenderereignisse der Kampagne; bei einer beschädigten
Definition liefert er einen Fehler statt einer vermeintlich vollständigen leeren
Ortsliste. Das ist eine bewusst strenge Lesegrenze, keine Datenreparatur.
Ortslabels prüfen ebenfalls die ID des Ortsdokuments gegen die
Datensatzidentität. Die Ortsrevision liegt ausschließlich in den Tabellenmetadaten;
das externe `.location`-Format erhält kein neues Revisionsfeld. Fehlende oder
archivierte Orte bleiben bei allgemeinen
Ereignislisten als nicht verfügbar erkennbar; direktes Öffnen ihrer Ortsagenda
wird abgewiesen. Autoreninhalte und Ereignisdefinitionen werden beim Lesen
nicht verändert. Die gezielten Storegegenproben stehen in `agenda-storage.test.ts`.

`CampaignAgenda` zeigt Ereignisse und Fristen, bereitet neue Einträge relativ
zur angezeigten Gruppenzeit oder als absolutes Fantasy-Datum vor und schreibt
über den bestehenden Worldwriter. `AgendaBasis` bindet die Kalenderrevision
und bei relativen Fristen Scene, Clockrevision und Instant. Eine geänderte
Gruppenzeit verlangt eine neue sichtbare Vorschau. Lesen und Planung ändern
weder Scenezeit noch Position; Effekte aus Eventablauf bleiben ausdrückliche
World-/GM-Entscheidungen.

Der gemeinsame `checkedCalendarEvent` prüft Zeitwerte, Feldtypen und Status
beim Schreiben sowie an den Reader-/Backupgrenzen. Bestehende, korrekt
zugeordnete Titel, Notizen und Identitäten werden nicht durch nachträglich
erfundene Längenlimits als beschädigt verworfen. Der Kompatibilitätsfall in
`agenda-storage.test.ts` liest längere, vom vorherigen Writer zulässige Inhalte
unverändert und erstellt daraus einen Kampagnensnapshot. Das ist ein lokaler
Formatnachweis, keine Lastqualifikation beliebig großer Texte.

Die Tageslänge ist `FantasyCalendar.daySeconds`, kein festes Vielfaches einer
irdischen Stunde. Der bestehende Writer erlaubt 3600 bis 604800 ganze Sekunden.
Ein Countdown zieht zuerst vollständige Fantasy-Tage ab und zerlegt nur den
verbleibenden Rest in Stunden und Minuten. Bei einem gespeicherten 90-Minuten-Tag
sind 90 Minuten genau ein Tag, nicht zusätzlich 30 Minuten. `agenda-time.test.ts`
prüft den echten Kalenderwriter, nichtstündige Tage, positive/negative Restzeiten,
Subminutenanzeige und den üblichen 24-Stunden-Tag. Der bestehende Agenda-UItest
prüft separat Papierkorbaktionen für neue bzw. gespeicherte Ereignisse.

## Kontext und Speicherbestätigung

`agenda-ui.ts` bindet Öffnen und asynchrone Antworten an Campaigntoken und
Dialoggeneration, Editoraktionen zusätzlich an die konkrete Editorfassung und
Liste/Navigation an die Lesefassung. Ein verspäteter Refresh übernimmt keine
neuen Kalender-/Zeit-/Eventbasen in offene Rohfelder. Eingaben bleiben während
Speichern möglich; eine eigene bestätigte Speicherung übernimmt ausschließlich
ihre Eventrevision. Danach eingegebene Felder behalten die vorher gezeigte
Zeitbasis. Explizites Aktualisieren dieser Basis liest dieselbe Ursprungsscene;
eine andere Scene, rückläufige Clockrevision oder geänderte Kalenderregeln
werden nicht still übernommen.

Bei verlorener Worldantwort bietet die Agenda „Ereignisauftrag prüfen“.
`world-ui.ts` klärt den unveränderten ursprünglichen Worldcommand über das
bestehende Receipt. Diese Leseoperation erzeugt keinen zweiten Kalenderauftrag.
Erneute Lesefehler halten den Ausgang offen. Eine bestätigte Eventrevision muss
zur gesendeten ID und Revision gehören; spätere Eingaben bleiben erhalten.
Das gilt innerhalb der laufenden Anwendung: Rohentwürfe und unbekannte Ausgänge
sind noch nicht über Neustart/Fresh hinweg gesichert.

Der derzeitige Mainwriter führt die SQLite-Transaktion synchron aus; die
Receiptprüfung folgt auf eine beendete IPC-Anfrage. Ein fehlendes Receipt wird
unter dieser Voraussetzung als nicht übernommen behandelt. Bei einem späteren
asynchronen/externen Writer darf bloße Receiptabwesenheit keine abgeschlossene
Nichtausführung beweisen: Ein noch laufender Auftrag braucht einen eindeutigen
terminalen Zustand oder eine Nichtausführungsbindung, bevor ein neuer Auftrag
zulässig ist. Receiptidentität, Ereignisrevision und Kalender-/Clockautorität
bleiben verschiedene Prüfungen.

Lokale Gegenproben in `agenda-context.test.ts` prüfen verzögertes Öffnen,
Refresh und Speichern, abgelöste Aktionen, spätere Rohangaben und verlorene
Antworten. Der echte Worldbridge-/SQLite-Fall prüft dabei eine einzige Ausführung
und unveränderte Datenbankbytes bei anschließender Receiptleseoperation.
Diese Teilbelege ersetzen keinen nativen Spielabendablauf.

## Übergang zum ausdrücklich bestätigten Zeitsprung

`TimeNavigator` in `time-plan-ui.ts` ist der Anschluss für Dauer, Datum,
Tagesbeginn und Ereignisbeginn/-ende. Seine Lese-/Vorschau-/Bestätigungs- und
Recoveryantworten binden den ursprünglichen Dialog, Campaigntoken und die Scene.
Eine abgelöste Ereignisschaltfläche darf keine ältere Eventrevision auswählen.
Agenda-Handoff und Refresh behalten die ausgewählte Eventrevision; eine Änderung
verlangt eine ausdrückliche neue Ereignisauswahl vor der Vorschau.
Die Live-Schreibschnittstelle prüft diese Bindung nochmals nach dem Flush und
vor Dispatch; ein bereits gesendeter Auftrag behält seinen eigenen Ausgang.
Alte Antworten schließen oder entsperren keine spätere Zeitwahl, auch bei
identischer Campaign und Scene. Nur die aktuelle Bestätigung meldet den
Zeitsprung als übernommen.

Neue Zeitangaben während Kalenderlesen bleiben unverändert; ohne passende
Lesefassung ist die Vorschau gesperrt. „Kalender und Ereignisse neu lesen“
ermöglicht anschließend das Lesen ohne Verlust ungültiger Rohwerte. Andere
Sceneantworten und geänderte Kalenderregeln werden nicht als Basis übernommen.
Die explizite Receiptklärung beendet die Sperre vor einer weiteren Vorschau;
bei einem Lesefehler bleiben Eingaben und Ausgang offen. Der Dialog nutzt den
bestehenden Livewriter und `recoverTimeWrite`, keinen zweiten Zeitwriter.

Die Zeitsprungvorschau zeigt weiterhin höchstens 40 zukünftige Ereignisbeginne,
zeitlich geordnet für den aktuellen Szenenort und globale Ereignisse. Sie zählt
alle im Intervall `(aktuelle Zeit, Zielzeit]` enthaltenen Beginne mit ganzzahliger
Arithmetik; auch sehr lange regelmäßige Folgen werden nicht vollständig
expandiert. `TimePreview.eventCount` liefert die genaue Dezimalzahl als String,
getrennt von den begrenzten Detailzeilen. Der Renderer nennt bei weiteren
Beginnen „erste 40 von …“. Ältere Antworten ohne Count behalten einen expliziten
Begrenzungshinweis. Die Vorschau
beschreibt Beginne, keine automatisch ausgeführten Wirkungen und keine Liste
aller zu diesem Zeitpunkt aktiven Ereignisse.

Auch der Papierkorbfilter der Vorschau folgt auf die Quellenprüfung. Eine
manipulierte `trashed`-Angabe mit ungültiger Prüfsumme darf ein Ereignis nicht
stumm verschwinden lassen. Gültig archivierte Definitionen bleiben ausgeschlossen;
der direkte Ereignisziel-Read lehnt sie weiterhin ab. Das Datenformat der
Kampagne ändert sich nicht; Count und Detailprojektion werden bei jedem Read
abgeleitet. `time-plan-storage.test.ts` prüft gemischte einmalige und periodische
Beginne, Ortsrelevanz, einen Count oberhalb der sicheren JavaScript-Zahlgrenze
und manipulierte Archivierung. Die Rendererprobe prüft Gesamtzahl und ältere
Antworten. Das qualifiziert weder Worldfolgen noch die native Zeitbestätigung.

Gezielte Gegenproben in `time-plan-context.test.ts` prüfen unter anderem Öffnen vor
Flush, spätes positives/negatives Write, ältere finally-Blöcke, Recoveryfehler,
abgelöste Eventaktionen, ungültige Rohdaten während Load und die erneute Bindung
vor Dispatch. Der Label-/Filtertest und die bestehenden Agenda-/World-/Reise-
prüfungen bleiben getrennte Teilbelege. Noch offen: dauerhafte Rohsicherung auch
für diesen Zeitdialog, native Recovery und gruppenübergreifende Fachabnahmen.

## Nächste konkrete Prüfungen und Lieferung

1. Rohentwürfe von Agenda und Zeitdialog vor Close/Fresh sichern: bestehende Entwurfspersistenz in
   `storage/combat-drafts.ts`, `finish-drafts.ts` und `store.ts` samt Backup-/Campaign-Lebenszyklus zuerst auf einen passenden
   Anschluss prüfen. Das versionierte Agendaformat braucht rohe Feldwerte,
   Campaign-/Scene-/Eventidentität, ursprüngliche Event-/Kalender-/Clockrevision
   und Instant sowie ursprüngliche Datumsdarstellung/Notizzeilen. Ungültige
   numerische Eingaben bleiben Text; Restore darf sie nicht normalisieren.
   Bestätigte Fakten werden nicht durch Entwurfsmigration umgeschrieben.
   Fehlende Basen in Altentwürfen verlangen sichtbare Prüfung statt Aufwertung
   auf die neueste Revision. Unbekannte Ausgänge brauchen den vollständigen
   ursprünglichen Command samt ID und eine klare Trennung von Receiptlesen und
   erneutem Senden. Abnahme: offene und ungültige Felder sowie verlorene Antwort
   → Fresh/Neustart → unveränderte Felder, unveränderte Basen, genau ein Effekt.
2. Relative Frist, Reisen/Weiterreise, Rast/Warten, Shoprestock und zeitgebundene
   Autonomie gemeinsam gegen Kalender-/Scenezeit prüfen. Fokuswechsel ist keine
   Zustimmung zur Zeit einer anderen Gruppe. Vorwärts-/Rückwärts-Clockänderung,
   Kalenderänderung, gelöschter Ort und Eventänderung brauchen unterscheidbare
   Konflikte; nur ein ausdrücklicher neuer Plan darf Effekte auslösen.
3. Aktuelle/grenzenübergreifende und wiederholte Ereignisse mit kundenspezifischen
   Tages-/Monats-/Wochenlängen gegen Daten-/Backupregeln prüfen. Den Scan am
   relevanten Größenprofil messen; erst einen bestätigten Engpass durch
   begrenzte Storequeries/Indizes beheben. Kein zweiter Timer oder Eventstore.
4. Nativ: Datum und relative Frist anlegen → Zeit ändern → sichtbare Vorschau
   bestätigen → Neustart → dieselbe Frist finden. Papierkorb/Restore, Tastatur,
   200 %, unbekannte Antwort und bestehende offene Session prüfen. Lokale
   Mathematik-/DOMtests schließen diese Produktabnahme nicht.
