# Kampagnenagenda, Fantasy-Datum und Fristen

Stand: 14.10.2026. Die Agenda ergänzt den vollständigen Reise-/Weltzeitvertrag
und die Spielabendvorbereitung; sie ersetzt weder Timelinebesuche noch World
Planner, Shoprestock oder zeitgebundene Autonomie.

## Ausführbarer Anschluss

`CampaignStore.agenda` / `storage/agenda.ts` lesen Kalender, gewählte Scenezeit
und Kalenderereignisse in einer SQLite-Lesetransaktion. `AgendaQuery` filtert
Text, Horizont und Ort und liefert höchstens 40 Einträge plus Fortsetzung mit
Zeit-/Kalenderbasis. Die Ergebnisgröße ist begrenzt; die Suche scannt derzeit
alle bestehenden Kalenderereignisse. Ein kleines Ergebnis ist kein Lastnachweis.

`CampaignAgenda` zeigt Ereignisse und Fristen, bereitet neue Einträge relativ
zur angezeigten Gruppenzeit oder als absolutes Fantasy-Datum vor und schreibt
über den bestehenden Worldwriter. `AgendaBasis` bindet die Kalenderrevision
und bei relativen Fristen Scene, Clockrevision und Instant. Eine geänderte
Gruppenzeit verlangt eine neue sichtbare Vorschau. Lesen und Planung ändern
weder Scenezeit noch Position; Effekte aus Eventablauf bleiben ausdrückliche
World-/GM-Entscheidungen.

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
Bei verlorener Antwort prüft die Agenda denselben Worldreceipt schreibfrei;
spätere Rohfelder bleiben erhalten und die Frist wird nicht erneut angelegt.
Die Änderungsprüfung vergleicht Ereignisdaten mit dem bestätigten Stand:
gleichwertige Zeiteinheiten oder Datumsschreibweisen benötigen keinen weiteren
Save; unveränderte Daten behalten auch Sekunden und Millisekunden. Nach einem
bestätigten Receipt kann der Editor direkt schließen, sofern keine späteren
Änderungen vorliegen.

## Nächste konkrete Prüfungen und Lieferung

1. Die lokalen Guards für Editorabsicht und Eventrevision in `agenda-ui.ts`
   nativ gegen Dialog-, Kampagnen- und Lesefassungswechsel prüfen. Bei verzögertem Load/Save/Refresh/Rebase
   dürfen neue Rohfelder oder eine neuere Eventauswahl nicht ersetzt werden.
   Relative Fristen behalten ausdrücklich ihre gezeigte Ursprungsscene;
   Fokuswechsel ist keine Zustimmung zu einer anderen Zeitbasis. Kleinste
   Gegenproben: Gruppen-/Campaignwechsel während Flush, weiterer Text während
   Pending und gleiche Campaign mit neu geöffneter Agenda.
2. Rohentwürfe samt Kalender-/Scene-/Eventbasis vor Close/Fresh sichern und
   unbekannte Worldcommandausgänge anhand des ursprünglichen Receipts klären.
   Kein erneutes Anlegen derselben Frist zur Aufklärung. Vorwärts-/Rückwärts-
   Clockänderung, Kalenderänderung, gelöschter Ort und Zeitbasis-Update behalten
   ihre unterschiedlichen Ursachen und sichtbaren Konflikte.
3. Aktuelle/grenzenübergreifende und wiederholte Ereignisse mit kundenspezifischen
   Tages-/Monats-/Wochenlängen gegen Daten-/Backupregeln prüfen. Den Scan am
   relevanten Größenprofil messen; erst einen bestätigten Engpass durch
   begrenzte Storequeries/Indizes beheben. Kein zweiter Timer oder Eventstore.
4. Nativ: Datum und relative Frist anlegen → Zeit ändern → sichtbare Vorschau
   bestätigen → Neustart → dieselbe Frist finden. Papierkorb/Restore, Tastatur,
   200 %, unbekannte Antwort und bestehende offene Session prüfen. Lokale
   Mathematik-/DOMtests schließen diese Produktabnahme nicht.
