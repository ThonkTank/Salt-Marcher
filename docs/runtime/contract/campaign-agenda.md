# Kampagnenagenda, Fantasy-Datum und Fristen

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 20.10.2026. Die Agenda ergänzt den vollständigen Reise-/Weltzeitvertrag
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

`storage/calendar-events.ts` prüft gespeicherte Ereignisse gemeinsam für Agenda,
Ortsmappe, Zeitvorschau, Weltansicht und Backup: Prüfsumme, Feldvertrag sowie
ID und Revision gegenüber dem Datensatz. Erst danach entscheiden die jeweiligen
Zugänge über Ort, Suche und Papierkorb. Ein archivierter Termin bleibt in der
Agenda wiederherstellbar; als direktes Zeitziel wird er abgewiesen. Der Livewriter
liest sein Ereignisziel unmittelbar aus diesem unabhängigen Modul. Die bisherigen
Listenreihenfolgen und gespeicherten Bytes bleiben erhalten; keine Migration.

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
Subminutenanzeige und den üblichen 24-Stunden-Tag. Der Agenda-UItest prüft den einzigen Ereigniseditor mit echten Storeabfragen:
exakte Zeitpunkte/Notizen, Ortswahl, Papierkorb und Wiederherstellung. Der
frühere zweite Editor im Weltbereich entfällt; dort öffnet derselbe Agendaeinstieg.
Offene Entwürfe blockieren erneutes Öffnen. Refresh entfernt die alten Controls;
verzögerte Bestätigungen gehören ausschließlich zu ihrem ursprünglichen Entwurf.
Nach bestätigtem Speichern ohne spätere Eingaben öffnet die Agenda gezielt dieselbe Ereignis-ID. Suche, Zeit- und Ortsfilter werden sichtbar auf einen einschließenden Bereich gesetzt; auch ein ferner, verschobener oder archivierter Termin bleibt so direkt bearbeitbar. Die beschriftete Einzelansicht verwendet den vorhandenen ID-Read statt einer Suche über weitere Listenseiten. „Zeit und Agenda aktualisieren“ löst die Einzelbindung und zeigt die Liste wieder.
Bei verlorener Antwort prüft die Agenda denselben Worldreceipt schreibfrei;
spätere Rohfelder bleiben erhalten und die Frist wird nicht erneut angelegt.
Die Änderungsprüfung vergleicht Ereignisdaten mit dem bestätigten Stand:
gleichwertige Zeiteinheiten oder Datumsschreibweisen benötigen keinen weiteren
Save; unveränderte Daten behalten auch Sekunden und Millisekunden. Nach einem
bestätigten Receipt kann der Editor direkt schließen, sofern keine späteren
Änderungen vorliegen.

## Kalenderregeln aus der Agenda

„Kalenderregeln bearbeiten…“ öffnet das bestehende Kalenderformular direkt in
einem Dialog. Der frühere Welt-Tab führt inzwischen zum Atlas und ist deshalb
kein verlässlicher Zugang zu diesen Feldern. Formular und Worldwriter bleiben
einmal vorhanden; Ereignisse und Gruppenuhren werden beim Ändern der Regeln
nicht verschoben. Dezimale Tagesstunden bilden die bereits unterstützte
sekundengenaue Tageslänge ab, etwa 1,5 Stunden für einen 90-Minuten-Tag.

Schließen und Escape bewahren offene Eingaben bis zum Speichern oder expliziten
Verwerfen. Während des Speicherauftrags sind die Kalenderfelder gesperrt.
Ein unbekannter Ausgang lässt sich im selben Dialog über den ursprünglichen
Worldreceipt klären, ohne erneutes Senden. Spätere Eingaben bleiben erhalten.
Die Kalenderrevision bleibt an den sichtbaren Entwurf gebunden; ein paralleles
Weltlesen überschreibt weder Rohfelder noch die Konfliktbasis.
`tests/desktop-calendar-rules.test.mjs` prüft diese Übergänge mit dem echten Store.

`tools/test-desktop-agenda-deadline.mjs` prüft nativ bei tatsächlichem 100-/200-%-Zoom:
90-Minuten-Tag konfigurieren, verlorene Speicherantwort klären, eine Frist sechs
Tage voraus anlegen, sieben Tage mit sichtbarer Vorschau vorsetzen, normal
schließen, neu starten und dieselbe Frist weiterbearbeiten. Bestehende Ereignisse
und Gruppeninhalte bleiben dabei erhalten. Das ist keine Ownerabnahme und keine
Neustartsicherung offener Rohentwürfe.

## Kontext und Speicherbestätigung

Editor und Antworten gehören zu Campaigntoken, Dialoganfrage und Entwurf.
Während eines Saves bleiben Rohfelder editierbar; dessen Bestätigung übernimmt
nur die eigene Eventrevision. Neuere Eingaben behalten ihre gezeigte Zeitbasis.
Der Writer prüft diese Bindung erneut nach Flush. Rebase liest dieselbe Gruppe;
eine andere Scene, ältere Clockrevision oder andere Kalenderregeln bleiben
sichtbare Konflikte. Ein offener Auftrag blockiert weitere Saves und Schließen;
fehlgeschlagene Receiptlesungen lassen denselben Auftrag erneut prüfen.
Rohentwürfe und unbekannte Ausgänge sind noch nicht über Fresh/Neustart gesichert.

Der Store-Worker führt die SQLite-Transaktion synchron aus. Bei späteren externen
Writern darf Receiptabwesenheit keine abgeschlossene Nichtausführung beweisen.
Receiptidentität, Eventrevision und Kalender-/Clockautorität bleiben getrennt.
Die tatsächlichen DOM-/Worldbridge-/SQLite-Prüfungen stehen gemeinsam in
`agenda-ui.test.ts`; sie ersetzen keine native Abnahme.

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

1. Rohentwürfe von Agenda und Zeitdialog vor Close/Fresh sichern; bestehende Entwurfspersistenz samt
   Backup-/Campaign-Lebenszyklus zuerst auf einen passenden Anschluss prüfen.
   Rohe Felder, ursprüngliche Event-/Kalender-/Clockbasis und ungeklärter
   Originalcommand samt ID bleiben erhalten. Altentwürfe ohne Basis verlangen
   sichtbare Prüfung. Abnahme: ungültige Eingaben/verlorene Antwort → Neustart
   → unveränderte Felder und Basen, genau ein Effekt.
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
