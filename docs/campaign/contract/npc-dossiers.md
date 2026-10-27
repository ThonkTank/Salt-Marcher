# NPC-Dossier, Gespräch und bestehende Fachbesitzer

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: campaign
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 20.10.2026. Ergänzt Kampagnenwissen, Party-/Livebetrieb,
Encounter und [Actor Autonomy](../../runtime/contract/actor-autonomy.md). Die fachlichen
Owner bleiben Weltprofil, LiveScene, Combat und Autonomie; das Dossier liest
und vermittelt zwischen ihnen. SRC-F02 verlangt kampagneneigene NPCs und
unabhängige Kopien bei gleichen möglichen Namen; narrative Aufzeichnungen
bleiben manuell aufgelöste GM-Inhalte. Eine Headerergänzung ist keine automatische
Quest- oder Ereignisauflösung.

## Aktueller Vertrag

Familienbeziehungen bleiben beim Verschieben einer NPC-Notiz in den Papierkorb
beidseitig gespeichert. Auch archivierte Endpunkte müssen vorhandene NPCs mit
passender Gegenrichtung sein; Restore, Backup und unabhängige Kampagnenkopie
erhalten die Beziehungen. Die Paaridentität bleibt `targetId + label`, unabhängig
von einer Familienklassifikation. Beide Ergebnisnotizen werden vor dem Schreiben
validiert. Eine Notiz mit Teilnehmerbindung in einer vorbereiteten oder laufenden
Begegnung kann erst nach Teilnehmerentfernung oder Kampfabschluss in den Papierkorb;
abgeschlossene Kampfstände bleiben historisch.
Regression: `tests/campaign/desktop-review-integrity.test.mjs`; Grenzen und Befunde im
[Review vom 24.10.2026](https://github.com/ThonkTank/Salt-Marcher/blob/16eb0aa8807ac21704abfea5412ac3a22033a23a/docs/reference/independent-code-review-20261024-second/README.md).

`storage/npc-cast.ts` liest Ortsliste und Dossier über die Transaktionen von
`CampaignStore.npcCast/npcDossier`. Der Rückgabestand verbindet Worldnotiz,
NPC-Record, Fraktionshaltung, Actor/HP, Ort, Beziehungen, Gruppen, Autonomie und
bestätigte Logs. Die Ergebnisgrenzen von Beziehungen/Logs begrenzen die Anzeige;
sie sind kein Lastbeleg für den Such-/Relationsscan. Der Ortsfilter verwendet
derzeit die Scene-Ortsbindung, bei fehlendem Ort unverortete NPCs. Das belegt
keine Hex-/Dungeonsichtlinie, Wahrnehmung oder Anwesenheit am selben Kartenpunkt;
diese Übergänge zum Spatial-/Player-/Autonomieowner bleiben separat offen.

`NpcCastBinder` bindet Öffnen, Listen-/Detailantworten und Schaltflächen an den
ursprünglichen Dialog, Campaigntoken, Scene und Gruppenort. Eine frühere Auswahl
oder entfernte Schaltfläche darf keine spätere Figur verwenden. Vor einer
Fachaktion wird die angezeigte NPC-Basis nochmals geprüft: Notiz-/Record-/Actor-/
Positionsrevision sowie abgeleitete Haltung und Rolle. Das Lesen einer neueren
Fassung ist keine Zustimmung zu deren Übernahme. Bei geändertem Stand bleibt
das Dossier offen und verlangt Aktualisieren und erneute Auswahl der Aktion.
Ein Gespräch bindet außerdem angezeigte Gruppenzeit, Datum und Titel. Der
Vorlesetext behält die gezeigten Autorenbytes einschließlich CRLF.

Die Übergabe trägt eine Gültigkeitsprüfung durch weitere Workspace-/Editor-
Flusches. `openNpcProfile` prüft sie auch nach Profil-/Draftlesen, bevor ein
Gesprächsheader ergänzt wird. `addLiveNpc/addWorldNpc` prüfen sie nach Runtime-/
NPC-Lesen und vor Dispatch; Combat prüft sie nochmals nach seiner Rohsicherung.
Ein bereits gesendeter Command bleibt eine eigene fachliche Tatsache. Das
Anlegen einer neuen Maske und Hinzufügen des NPC sind weiterhin zwei Commands:
wird die Übergabe danach ungültig, darf der bestätigte erste Schritt nicht
stillschweigend rückgängig gemacht oder erneut gesendet werden.

`NpcDraft.fields.contact` hält Gespräch/Beobachtung als Rohtext getrennt von der
bestätigten Geschichte. Der bestehende Draftwriter sichert unvollständige
Eingaben; erst ausdrückliches „NPC übernehmen“ hängt den Text an die Geschichte
und übernimmt genau den passenden CAS-Entwurf. Altentwürfe ohne dieses optionale
Feld bleiben lesbar; fehlender Text wird nicht als historische Tatsache ergänzt.
„Gespräch festhalten…“ führt direkt zum sichtbaren Gesprächsfeld im
vorhandenen Profilformular. Ein vorhandener Gesprächsrohtext erhält keinen weiteren Zeitheader, auch wenn
er ausschließlich Leerzeilen, Leerzeichen oder Tabs enthält. Nur ein tatsächlich
leeres Feld erhält beim Gesprächseinstieg den angezeigten Zeit-/Gruppenheader. Der allgemeine Profileinstieg bleibt bei den Stammdaten.
Alte Dialogantworten melden oder entsperren keine neue Übergabe.

Vor Dispatch sichert `npc-ui.ts` den Originalauftrag einschließlich Command-ID,
Payload und Draft-CAS als optionales `NpcDraft.pendingCommand`. Solange sein
Ausgang offen ist, bleibt das Profil gesperrt und der Rohtext lesbar; „Originalauftrag
prüfen“ bleibt außerhalb des gesperrten Formulars erreichbar. Der NPCwriter
behält diesen Entwurf auch nach erfolgreichem Write. Ein abgewiesener oder
verlorener Response erlaubt keinen erneuten Gesprächsanhang.

`reconcileNpc` prüft Campaigntoken, Originalfingerprint ohne Aktivierungstoken,
Receiptchecksum, NPC-Identität, bestätigte Autorenfelder/Revisionen und passende
Draftkennung in einer Writertransaktion. Eine gültige Checksum ohne passenden
Inhalt ist kein Erfolgsbeleg.
Bei passendem Beleg räumt sie ausschließlich den Originalentwurf auf. Danach
liest der Editor das aktuelle Profil; der historische Beleg darf einen späteren
Notiz-/HP-/Ortsstand nicht zurücksetzen. Ohne Beleg rotiert die Transaktion die
Draftkennung und gibt denselben Rohtext frei. Ein verspäteter ursprünglicher
Write scheitert dann vor jeder Weltwirkung an seinem alten CAS. Keine automatische
Wiederholung; „NPC übernehmen“ ist eine neue ausdrückliche Aktion.
`rejectedCommand` hält die Zuordnung für eine verlorene Prüfantwort; erneut
Prüfen ist idempotent und erzeugt keine Produktfakten. Fehlerhafte/anders verwendete
Belege bleiben offen, ohne Verwerfen oder Überschreiben durch einen anderen Draftwriter.

Die vorhandene Backup-/Snapshotprüfung prüft die Draft-/Receiptbindung.
Unabhängige Kopien remappen Campaign-, NPC-, Command- und Draftkennungen über den
bestehenden Transfer und passen nur den vor Remap geprüften Pendingreceipt-
Fingerprint an den kopierten Auftrag an. Eine Kopie hat keine ursprüngliche
Tokenautorität; sie führt keinen Auftrag automatisch aus. Autorenwortlaut inklusive
Kontakt-/CRLF-Prosa bleibt erhalten. Deklarierte lokale `dungeon-ref`-Ziele werden
auch in Rohfeldern, Pendingauftrag und bestätigter Geschichte an die kopierten
Identitäten gebunden; Aliastext, Whitespace und externe Vaultlinks bleiben
unverändert. Eine bloße Klartextprojektion ersetzt diese Autorenquelle nicht. Optionalfelder brauchen keine neue
SQL-Tabelle; Altentwürfe bleiben Rohentwürfe, der bisherige direkte Writer für
Entwürfe ohne Pendingauftrag bleibt kompatibel. Ein schon durch eine alte Version
konsumierter Rohentwurf lässt sich damit nicht rückwirkend rekonstruieren.
Die bisherigen 4 MB Rohentwurf werden durch den zusätzlichen Command nicht halbiert;
die gebundene Gesamtpayloadgrenze beträgt 12 MB. Downgrade/Releasequalifikation
und native Wiederaufnahme sind separat zu prüfen.

## Bestätigte NPC-Verluste nach einem Kampf

Die Nachbereitung eines abgeschlossenen Combat zeigt dessen benannte World-NPCs
mit HP zum Abschluss und aktuellem Lebenszyklus. Die Auswahl beginnt leer; eine
Schaltfläche wählt ausdrücklich die noch verfügbaren NPCs mit null Abschluss-HP.
Erst „Ausgewählte NSCs als besiegt bestätigen“ ändert den World-Lebenszyklus.
Auch ein überlebender NPC kann nach einer manuellen GM-Entscheidung ausgewählt
werden. Das System leitet aus dem Ergebnistext weder Tod noch Gefangenschaft ab.
HP, Statblock, Fraktion, Autorenprosa und laufende Masken werden nicht verändert.

`confirm-npc-losses` benutzt den bestehenden Combat-Command-, Receipt- und
ungeklärten Write-Pfad. Combatrevision sowie angezeigte NPC-Notiz-, Record- und
Actorrevision binden die Zustimmung. Die ganze Auswahl wird vor jeder Mutation
geprüft. World-Records, gemeinsame Chronik, Combat-Abschlussvermerk und Receipt
werden atomar übernommen. Veraltete Profile verlangen eine neue Auswahl; Retry
wiederholt keine Niederlage. Der Combat hält bereits bestätigte Actor-IDs, sodass
auch nach ausdrücklicher Reaktivierung derselbe Abschluss keine zweite Niederlage
buchen kann. Die unabhängige Kampagnenkopie remappt diese Referenzen mit.

Von jeder verfügbaren Zeile führt „Weltprofil / Reaktivierung“ in den vorhandenen
NPC-Editor. Aktivieren und eine eventuelle HP-Korrektur bleiben ausdrückliche
Änderungen dort. Die bestätigte historische Niederlage bleibt dabei erhalten.
Die Nachbereitung besitzt ihre eigenen Auswahl-/Ladesperren; allgemeine
Kampf-Refreshes dürfen bestätigte Zeilen nicht erneut auswählbar machen.

Lokale Store-/DOMfälle prüfen Bestätigung, Replay, Stale-Gesamtabbruch,
Transaktionsrollback, Reopen, unabhängige Kopie und spätere Reaktivierung.
Native Bedienung, vollständige CI und Main-Veröffentlichung sind gesonderte
Belege. Ein Fraktionsbestand wird dabei nicht automatisch einem NPC oder einem
unbenannten Kämpfer zugerechnet. Der gesonderte manuelle Bestandsabschluss sowie
vollständige Plattform-/Accessibility-/Owner-Abnahme bleiben offen.

Der native Ablauf `tools/test-desktop-npc-conversation.mjs` prüft Dossier →
sichtbares Gesprächsfeld → gesicherter Rohentwurf → regulärer Close/Fresh →
Fortsetzung und ausdrückliche einmalige Übernahme → erneuter Close/Fresh bei
100 und 200 Prozent Appzoom über den gemeinsamen nativen Sitzungshelfer. Die
Wiederöffnung eines nur aus Leerraum bestehenden Gesprächsentwurfs wird vor dem
eigentlichen Gespräch geprüft. Unveränderte Autorenprosa einschließlich CRLF, der zweite
NSC und der Live-Szenenstand werden getrennt geprüft. Das qualifiziert diesen
Bedienweg; Antwortverlust und die vollständige SMR-AC-03/04-Abnahme bleiben offen.

## Nächste Lieferung und Abnahme

- Native Antwortverluste vor/nach Dispatch und beim Prüfen mit kontrollierter
  Transportbedingung → normaler Close/Fresh → Originalauftrag prüfen → Rohtext
  oder genau einmalige Geschichte. Technische Renderer-/SQLiteproben decken diese
  Fälle samt unabhängiger Kopie und späterem Profil ab; sie ersetzen keinen
  unabhängigen Bedienlauf. Ein verschwundener Draft allein ist kein Erfolgsbeleg.
- Gespräch als freien Autorenrohtext von strukturierten späteren Zeit-/Quest-
  Folgen unterscheiden. Eine spätere strukturierte Gesprächschronik braucht
  Scene-/NPC-Identität, Kalender-/Clockbasis und Migration; bestehende Prosa wird
  dadurch nicht umgeschrieben oder als automatisch verifizierter Fakt behandelt.
- Beziehungen/Fraktion/Papierkorb, NPC-Defeat/Reaktivierung, Maskeneintritt und
  Autonomie-Catch-up gemeinsam prüfen. Bestätigte NPC-Identität und HP bleiben
  gemeinsame Fakten; freigegebene Autonomie wird vom Dossier nicht aktiviert.
- Nativ: NPC am Gruppenort wählen → Gespräch beginnen → während Flush/Fachwechsel
  Gruppe, Ort oder Figur wechseln → keine fremde Eingabe/alte Statusmeldung;
  aktuellen Gesprächsrohtext → Neustart → explizit übernehmen → genau einmalige
  Geschichte. Vorlesen, Tastatur/200 %, abgelegte Schaltflächen, beschädigte
  Einzelquellen und verzögerte Antworten gehören in denselben Ablauf.

Lokale Kontexttests sowie echter NPC-Renderer/SQLitewriter prüfen diese engeren
Übergänge und Entwurfsbytes. Frischer SQLite-Leser, Rendereraktivierung und
native Appwiederaufnahme sind getrennte Belege; vollständige Produktabnahme,
native Fehler-/Kontextwechselqualifikation und vollständige Erreichbarkeit
bleiben offen. Die lokalen Faultproben
belegen den engeren Originalauftrag-/Rohentwurfsvertrag; sie sind keine vollständige
Produkt- oder Datenlebenszyklusabnahme.

### Desktop-Arbeitsstand 0.103: Wohn- und Arbeitsort wechseln

NSC-Schauplätze öffnen eine kampagnenweite Hausauswahl. Der bestehende Stadtinspektor bereitet Wohn-/Arbeitsbindung und optional einen neuen Haushalts-/Berufsnamen vor. Speichern löst die bisherige Bindung auch in einer anderen Stadt und setzt die neue in derselben Transaktion. Nur die Mitgliedschaft dieses NSC wird aus bisherigen Haushalts-/Berufseinträgen entfernt; andere Mitglieder und die benannten Einträge bleiben bestehen. Die aktuelle Position wird dabei nicht bewegt.

Der gemeinsame Historienschritt ist aus beiden beteiligten Städten rückgängig machbar und wiederholbar. Spätere Änderungen einer beteiligten Stadt müssen zuvor rückgängig gemacht werden. Veränderte Quellrevisionen brechen den vorbereiteten Wechsel ohne Teiländerung ab; die Hausauswahl dann neu öffnen. Dies beschreibt den implementierten Ablauf, keine Gesamtproduktabnahme.

### Desktop-Arbeitsstand 0.106: Haushalte und Berufsgruppen gemeinsam umziehen

Jeder Haushalts- und Berufseintrag im Hausinspektor öffnet jetzt eine Suche nach Zielhäusern in allen Städten. Die Bestätigung nennt Quelle, Ziel und alle Mitglieder. Der Umzug erhält Kennung und Namen des vollständigen Eintrags, bindet sämtliche Mitglieder im neuen Haus und entfernt den Eintrag aus dem bisherigen Haus. Andere Haushalte, Arbeitsbindungen, Bewohner und Hausnotizen bleiben bestehen. Auch leere benannte Einträge können verschoben werden.

Die vorhandene Stadttransaktion und gemeinsame Historie übernehmen Quell- und Zieländerung; Rückgängig/Wiederholen sind in beiden Städten verfügbar. Abbrechen vor der Bestätigung schreibt nichts. Quell- und Zielrevisionen werden beim Commit geprüft. Aktuelle Aufenthaltsorte werden durch den Umzug von Wohn-/Arbeitsbindungen nicht bewegt. Keine Aussage über vollständige Produktabnahme.

### Desktop-Arbeitsstand 0.108: Explizite Demografie und Stadtprojektion

Das kanonische World-NPC-Profil besitzt optionale Felder für Herkunft/Spezies, Geschlecht und ein exaktes Alter in Jahren. Alte Profile und Entwürfe ohne diese Felder bleiben lesbar. Der bestehende konfliktgeschützte NPC-Auftrag, sein Receipt, die History, Backups und unabhängige Kampagnenkopien tragen die Angaben gemeinsam mit dem übrigen Weltprofil.

Eine Stadt zählt diese Angaben ausschließlich für NPCs mit bestätigter Wohnbindung. Sie zeigt Gesamtzahl, Zahl gepflegter Profile sowie exakte Häufigkeiten je Textwert und Alter. Änderungen am World-NPC werden beim nächsten Stadtlesen sichtbar, ohne die Stadtrevision oder Stadt-History zu verändern. Namen, Freitext, Haushalt und Beruf werden nicht als demografische Merkmale interpretiert. Verteilungen für neu erzeugte Personen, Religion und Lebensstandard bleiben Teil der offenen CITY-06-Inventur.

### Desktop-Arbeitsstand 0.111: kanonische Stadtfraktionen

Häuser und Viertel können nun eine vorhandene aktive World-Fraktion referenzieren. Die Stadt projiziert aus denselben IDs die Zahl bestätigter Bewohner, Beschäftigter und gebundener Elemente und bietet die Fraktion als Filter der World-NPC-Suche an. Archivierte Fraktionen bleiben an bestehenden Referenzen lesbar markiert, stehen aber nicht für neue Zuordnungen bereit. Eine Fraktionsbindung schützt Haus oder Viertel vor Regeneration; City-History, Neustart und Kampagnentransfer erhalten die Referenz. Regierung, Wachen und weitergehende Fraktionswirkungen bleiben offen, weil die sichtbaren Originalformulare ihre konkrete Semantik nicht ausreichend belegen.

## Tagespläne und geplante Ortsbesuche

### Profil, Kalender und Bestätigung

Das kanonische World-NPC-Profil trägt bis zu 48 benannte Aktivitäten mit Beginn,
Ende, Autorenhinweisen und Ziel Wohnhaus, Arbeitsplatz, freier Hinweis oder festem
Kampagnenort. Rohentwürfe bewahren unvollständige Zeiten und Texte; erst „NPC
übernehmen“ bestätigt den Plan über die bestehende NPC-Transaktion samt Receipt.
Es gibt keine zusätzliche Tabelle oder Schreibgrenze. Neue feste Ziele benötigen
einen aktiven Ort; archivierte Referenzen bleiben als nicht verfügbar lesbar.
Kampagnenkopien binden auch Ortsziele in gesicherten Entwurfsrohfeldern neu.

Die [Zeitregeln](../../../src/app/campaign/npc-daily-plan.ts) gelten für Tages-, Wochen-
und Ausnahmepläne gemeinsam:

- Aktivitäten gelten täglich oder an ausgewählten Wochentagen; maßgeblich ist
  ihr Beginn. Ein Ende vor dem Beginn läuft über Mitternacht.
- Bis zu 64 Datumsausnahmen ersetzen den ganzen Kampagnentag einschließlich
  Resten der vorherigen Nacht. Tag 1 ist der erste Kalendertag; die Oberfläche
  zeigt seine Kalenderbezeichnung. Eine leere Ausnahme ist ein Ruhetag;
  Entfernen stellt den Wochenplan wieder her.
- Überlappungen, auch über Wochen-/Ausnahmegrenzen, und Zeiten außerhalb des
  aktuellen Kampagnentags werden beim Übernehmen abgewiesen. Kalenderänderungen
  können einen Plan ungültig machen; Wochentagsindizes werden nicht umgedeutet.

### Leseuhr und Aussagegrenze

Das Dossier liest die gewählte Livegruppenuhr und den gemeinsamen Kalender;
Stadt- und Ortsübersicht verwenden ebenfalls eine gewählte bestehende Gruppenuhr.
Ihre Wahl ändert weder Fokus noch Zeit. Verschwindet die gewählte Uhr, bleibt die
Auswahl leer und verlangt eine neue Wahl, ohne auf Fokus- oder erste Gruppe
zurückzufallen.

Aktuelle Aktivität, nächster Beginn mit vollständigem Datum, Ruhetag,
Kalenderprobleme und fehlende Hausbindungen bleiben sichtbar. Geplante Ziele
stehen getrennt vom tatsächlichen World-Ort und Dungeonraum. Ein Plan oder eine
Wohn-/Arbeitsbindung beweist keine Anwesenheit; Lesen und Planbestätigung bewegen
niemanden, schreiten keine Uhr fort und aktivieren keine Autonomie. Automatische
Ausführung bleibt offen. Profil und Haus öffnen dieselben kanonischen Identitäten;
feste Ortsziele führen zur vorhandenen Ortsmappe.

### Stadt- und Ortsprojektion

Die [Stadtaktivitäten](../../../src/app/storage/city-activity.ts) berücksichtigen
bestätigte Bewohner und Beschäftigte. Namens-/Plantextsuche und der Filter auf
das gewählte Haus begrenzen die Auswahl vor der Projektion von höchstens 40
Profilen je Seite; weder vollständige Stadtgeschichte noch alle Profile werden
dafür in die Oberfläche geladen.

Die aufklappbaren [Ortsbesuche](../../../src/app/storage/location-activity.ts)
berücksichtigen feste Ortsziele und Wohn-/Arbeitsgebäude an diesem Ort. Suche und
SQL wählen 40 Profile je Seite vor der kanonischen Projektion. Die Suche findet
Namen und Aktivitätstexte mit diesem Ziel; auch vergangene Ausnahmen können einen
NPC ohne weiteren Besuch auffindbar halten. Ein Termin andernorts verdeckt den
nächsten Besuch hier nicht. Wochenregeln und nächtliche Aktivitäten bleiben
wirksam; auch leere Datumsausnahmen müssen beim Ortsfilter erhalten bleiben,
weil sie den normalen Plan und den Überhang der vorherigen Nacht aufheben.

Der nächste reguläre Beginn wird je verwendetem Wochentag am ersten folgenden
Tag ohne Datumsausnahme gesucht; Ausnahmen mit eigenen Aktivitäten treten mit
ihren tatsächlichen Terminen hinzu. Es gibt kein festes Vorschaufenster:
aufeinanderfolgende wöchentliche Ruhetage dürfen den späteren regulären Besuch
nicht verschwinden lassen. Dossier, Stadt und Ortsbesuche verwenden dieselbe
Berechnung; eine Ortsprojektion behält auch Ausnahmen ohne passenden Besuch.
Eine zusätzliche Uhr, gespeicherte Terminprojektion oder Migration ist dafür
nicht erforderlich.

`tests/campaign/desktop-npc-schedule.test.mjs` prüft diesen Vertrag einschließlich 64
ausgefallener Termine, unterschiedlicher Wochenlängen, Nachtaktivitäten und
ferner Einzeltermine gegen eine unabhängige tageweise Referenzrechnung.
[city-people-storage.test.ts (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/shared/core/city-people-storage.test.ts) verbindet die drei Leser mit bestätigten
Profilen und frischer SQLite-Wiederöffnung. Der native Ablauf
`tools/test-desktop-npc-weekly-visits.mjs` prüft Wochenplan und unvollständigen
Ruhetagentwurf → regulärer Neustart → Bestätigung → Dossier und Ortsmappe →
weiterer Ruhetag → erneuter Neustart bei 100 und 200 Prozent. Tatsächlicher Ort,
Gruppenzeit, andere NSCs und unveränderte Autorenprosa werden dabei gesondert
geprüft. Das ist keine vollständige CITY-07- oder Owner-Abnahme.
