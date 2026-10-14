# Vorbereitete Szenen wiederverwenden

Fachlicher Umfang: [Spielabendplanung](manual-session-planner.md),
[Timeline-Portabilität](timeline-portability.md) und [Gesamtumfang](../../SCOPE.md).
Szenen auswählen und ordnen, als neuen Abend übernehmen oder an einen vorhandenen
Plan anfügen. Bestätigte Weltfiguren, platzierte Beute und vergebene Belohnungen
werden dadurch nicht erneut erzeugt oder vergeben.

## Aktueller Anschluss

`session-copy-ui.ts` zeigt Quellplan, Ziel, Auswahlreihenfolge und Texte;
`SessionAction.copy-visits` bindet Quell- und Zielvorbereitung mit ihren
`replacementBasis`-Werten. `storage/session-copy.ts` erstellt neue Besuchs-IDs,
erhält authored Texte und Weltverweise, erzeugt unabhängige offene Rewards und
bereitet nicht platzierte Gruppen unabhängig vor. Schon platzierte Gruppen
bleiben Weltindividuen. Plan, Details und Sessionreceipt entstehen innerhalb der
bestehenden Transaktion. Keine zweite Speicher- oder Scenezeitarchitektur.

Der Dialog bindet Öffnen, Read, Writeantwort und Folge-Navigation an denselben
Owner und dieselbe Dialoggeneration. Getrennte Source-/Targetrequestzähler
verhindern, dass ein Zielwechsel einen noch ausstehenden Quellenread verwirft.
Dynamische Auswahl-, Sortier- und Pagingcontrols prüfen die dargestellte Fassung;
entfernte Controls verändern keine neuere Auswahl. Close/Reset entwertet die
Aufträge. Nach dem Navigationcallback wird nochmals geprüft; alte `finally`-
Rückläufe entsperren keine neuere Ansicht.

Fünf kontrollierte DOMgegenproben waren vor der Korrektur rot: Reopen nach
Close, alter Readfehler über neuer Ansicht, entfernte Checkbox, alte Bestätigung
über neuem Dialog und Zielwechsel während Source-Read. Storeproben prüfen
Quell-/Textschutz, unabhängige offene Reward-ID, Belegreplay, schreibfreien
Stalereject und Anfügen bei erhaltenen ursprünglichen Besuchen. Das sind lokale
Teilbelege; native Dialog-/Fokus-/Tastaturabnahme bleibt offen.

## Nächste ausführbare Schritte

1. **Ungeklärten Ausgang erhalten.** Der lokale Retrycommand ist noch nicht
   dauerhaft gesichert und wird bei semantischer Auswahländerung/Reset verworfen.
   `CommitFamily`/Receiptreader unterstützen bisher keinen Sessionbeleg. Den
   existierenden `session_receipt` an `commitStatus` anschließen, Originalcommand
   mit Fingerprint und Quell-/Zielbasis vor Send sichern und nach Fresh zuerst
   dessen Status prüfen. Eine verlorene Antwort nach bestätigtem Anfügen darf
   keinen zweiten Besuch erzeugen. Neuere Auswahl neben dem ursprünglichen
   Auftrag erhalten; nicht still übernehmen oder durch dessen Antwort schließen.
2. **Alle Vorbereitungswirkungen qualifizieren.** Gebuchte/platzierte Rewards,
   mehrfach referenzierte Gruppen, angenommene Weltindividuen, Worldnoten,
   Profilparty und Trash/Restore jeweils mit Copy und Append prüfen. Exakte
   Originalprosa und vorhandene Buchungs-/Weltidentitäten müssen erhalten bleiben.
   Unabhängige offene Inhalte bekommen neue Identitäten; weder Live-Ergebnisse
   noch bereits bestätigte Belohnungswirkungen werden vervielfacht.
3. **Native und Lastgrenzen prüfen.** Quell-/Zielwechsel, Esc/Fokusrückgabe,
   sortierte gefilterte Auswahl, 200%-Darstellung, langsame Reads und Close/Fresh
   am zusammengeführten Build prüfen. Die derzeitige Quellenliste liest die
   vollständige Preparation; 40 sichtbare Auswahlkarten beweisen keine begrenzte
   Quellabfrage oder vollständige große-Plan-Qualifikation.
