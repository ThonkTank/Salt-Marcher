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

## Nächste konkrete Prüfungen und Lieferung

1. Rohentwürfe vor Close/Fresh sichern: bestehende Entwurfspersistenz in
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
