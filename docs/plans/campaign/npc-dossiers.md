# NPC-Dossier, Gespräch und bestehende Fachbesitzer

Stand: 15.10.2026. Ergänzt Kampagnenwissen, Party-/Livebetrieb,
Encounter und [Actor Autonomy](../runtime/actor-autonomy.md). Die fachlichen
Owner bleiben Weltprofil, LiveScene, Combat und Autonomie; das Dossier liest
und vermittelt zwischen ihnen. SRC-F02 verlangt kampagneneigene NPCs und
unabhängige Kopien bei gleichen möglichen Namen; narrative Aufzeichnungen
bleiben manuell aufgelöste GM-Inhalte. Eine Headerergänzung ist keine automatische
Quest- oder Ereignisauflösung.

## Aktueller Vertrag

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
native Wiederaufnahme und Erreichbarkeit bleiben offen. Die lokalen Faultproben
belegen den engeren Originalauftrag-/Rohentwurfsvertrag; sie sind keine vollständige
Produkt- oder Datenlebenszyklusabnahme.

### Desktop-Arbeitsstand 0.103: Wohn- und Arbeitsort wechseln

NSC-Schauplätze öffnen eine kampagnenweite Hausauswahl. Der bestehende Stadtinspektor bereitet Wohn-/Arbeitsbindung und optional einen neuen Haushalts-/Berufsnamen vor. Speichern löst die bisherige Bindung auch in einer anderen Stadt und setzt die neue in derselben Transaktion. Nur die Mitgliedschaft dieses NSC wird aus bisherigen Haushalts-/Berufseinträgen entfernt; andere Mitglieder und die benannten Einträge bleiben bestehen. Die aktuelle Position wird dabei nicht bewegt.

Der gemeinsame Historienschritt ist aus beiden beteiligten Städten rückgängig machbar und wiederholbar. Spätere Änderungen einer beteiligten Stadt müssen zuvor rückgängig gemacht werden. Veränderte Quellrevisionen brechen den vorbereiteten Wechsel ohne Teiländerung ab; die Hausauswahl dann neu öffnen. Dies beschreibt den implementierten Ablauf, keine Gesamtproduktabnahme.

### Desktop-Arbeitsstand 0.105: Haushalte und Berufsgruppen gemeinsam umziehen

Jeder Haushalts- und Berufseintrag im Hausinspektor öffnet jetzt eine Suche nach Zielhäusern in allen Städten. Die Bestätigung nennt Quelle, Ziel und alle Mitglieder. Der Umzug erhält Kennung und Namen des vollständigen Eintrags, bindet sämtliche Mitglieder im neuen Haus und entfernt den Eintrag aus dem bisherigen Haus. Andere Haushalte, Arbeitsbindungen, Bewohner und Hausnotizen bleiben bestehen. Auch leere benannte Einträge können verschoben werden.

Die vorhandene Stadttransaktion und gemeinsame Historie übernehmen Quell- und Zieländerung; Rückgängig/Wiederholen sind in beiden Städten verfügbar. Abbrechen vor der Bestätigung schreibt nichts. Quell- und Zielrevisionen werden beim Commit geprüft. Aktuelle Aufenthaltsorte werden durch den Umzug von Wohn-/Arbeitsbindungen nicht bewegt. Keine Aussage über vollständige Produktabnahme.
