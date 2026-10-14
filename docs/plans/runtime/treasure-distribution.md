# Einen Schatz gemeinsam verteilen

Fachumfang: [Nachbereitung und Loot](../../SCOPE.md),
[Encounter-/Rewardvertrag](../../../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md)
und [Beutebilanz](loot-balance.md). Der GM wählt aktive Empfänger, verteilt ganze
Einheiten und bestätigt die geprüfte Gesamtverteilung. Restmengen bleiben im
Schatz. XP, Käufe und Münzabbuchungen gehören zu anderen Commands.

## Aktueller Daten- und Bedienweg

`treasure-distribution-ui.ts` liest den ausgewählten Schatz und aktive Figuren,
zeigt Mengen je Posten/Empfänger und eine abschließende Zusammenfassung.
`ProgressAction.allocate-batch` bindet Schatzrevision, Gegenstandsdefinitionen und
Membershiprevision jedes Empfängers. `storage/progression.ts` führt alle
Teilzuweisungen in derselben Transaktion aus. Jede Portion prüft den noch
unverteilten Bestand; erst danach schreibt sie Ledger und History. Der Schatz
bekommt genau eine neue Revision. Ein ungültiger späterer Empfänger, eine falsche
Definition oder ein Ledgerfehler lässt keine frühere Teilzuweisung und kein
Receipt zurück. Keine zweite allgemeine Verteilungsarchitektur.

Die Bestätigung trägt die tatsächlich angezeigte Action mit Mengen, Empfängern
und ihren Basen. Veränderte Eingaben brauchen eine neue Prüfung. Ein alter
Bestätigungsaufruf darf weder diese neue Verteilung buchen noch den nächsten
Dialog schließen. Owner, Dialoggeneration und dargestellte Grid-/Empfängerfassung
binden auch entfernte Eingabe-, Auswahl- und Pagingcontrols. Reset stellt
gesperrte Controls wieder her und invalidiert ausstehende Reads sowie den Flush
vor Öffnung. Späte Fehler oder `finally`-Antworten entsperren keine neuere Ansicht.

Storeproben in `desktop-treasure-batch.test.mjs` prüfen Restmengen, mehrere
Empfänger, bekannte und unbekannte Definitionwerte, unveränderte XP-/Rastdaten,
Receiptreplay/Fresh und bytegleichen Rollback bei Mengen-, Definition-,
Membership-, Doppelzuordnungs- und kontrolliertem zweitem Ledgerfehler.
`desktop-treasure-distribution-context.test.mjs` prüft die beschriebenen
Dialog-/Bestätigungsgrenzen. Das qualifiziert lokale Teilverträge, keine native
oder vollständige Recovery-/Portabilitätsabnahme.

## Nächste ausführbare Schritte

1. Den vorhandenen `writeConfirmed('progress', …)`-Weg in `treasury-ui.ts`
   mit der Batchaction vollständig prüfen: verlorene Antwort nach bestätigtem
   Write, Pendingstatus und Reopen/Fresh. OriginalcommandID/Fingerprint und
   neuere Rawmengen getrennt erhalten. Ein bestätigtes Receipt verbraucht nur
   seinen Auftrag; fehlende Antwort erzeugt keine zweite Verteilung.
2. Authored Rohmengen und Empfängerauswahl vor Navigation/Close dauerhaft sichern,
   auch bei ungültigen Zahlen und nicht lesbarer Quelle. Wiederaufnahme benötigt
   ursprüngliche Schatz-/Definition-/Membershipbasis und ausdrückliche Prüfung;
   nicht auf einen frisch gelesenen Stand umbiegen. Andere Workingdraftstores
   dienen als Anschluss, kein paralleles Ledger oder neues Dokumentformat.
3. Ursprung aus verschobenen/angenommenen Rewards, archivierte Figuren,
   Trash/Restore, Definitionänderung und unabhängige Kampagnenkopie einschließlich
   bereits verteilter Mengen qualifizieren. Bekannte Werte bleiben Definitions-
   bzw. historische Ledgerwerte; ein unbekannter Wert wird nicht als null Euro
   oder null Gold erfunden. Verkäufe und Kaufpreise haben eigene Wahrheiten.
4. Große Schätze/Roster über begrenzte Queries anbinden und Kosten messen.
   25 Posten, acht Spalten und 25 sichtbare Figuren begrenzen die Darstellung,
   nicht bereits die vollständig gelesenen Quellen. Native Tastatur, Dialogscroll,
   Esc/Fokusrückgabe, 200 %, Close/Fresh und langsame Reads separat prüfen.
