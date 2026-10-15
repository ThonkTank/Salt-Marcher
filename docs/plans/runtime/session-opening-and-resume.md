# Spielabend-Eröffnung und Wiederaufnahme

Stand: 15.10.2026. Der Anschluss in `src/app/live.ts` verbindet bestehende
Party-/LiveScene-, Timeline-, Mappen- und Chronikbesitzer. Eine Eröffnung ist
kein zusätzlicher Scene-Aggregat und keine automatische Besuchsübernahme.
Die bestätigte kontinuierliche Scene bleibt bestehen. Die Originalquelle
Program Capabilities, „Planning Workspace And Timeline“, unterscheidet
wiederverwendbare Vorbereitung von resumierbarer Runtime; sie beschreibt einen
aktuellen Plan. Der vorhandene Desktop kann mehrere Planvorlagen verwalten.
Deshalb hat bei fehlendem nächsten übernommenen Besuch der sichtbar ausgewählte
aktuelle Plan Vorrang. Ein weiterer Vorschlag zeigt seine Planherkunft und
benötigt eine ausdrückliche Wahl; er darf nicht unbemerkt den aktuellen Plan ersetzen.

## Ausführbarer Nutzerweg und Datenregeln

„Nächsten Abend vorbereiten“ sichert offene Liveeingaben und hält die ursprüngliche
Campaign-/Fokusbasis. Startgruppen werden nach dem Laufstandlesen angezeigt,
während weitere Vorbereitungsquellen noch laden. Die Gruppenbereitschaft verbindet gelesene HP, Zustände, Level und Rastbudget
mit dem jeweiligen Partyowner. Unbekannte HP oder Rastbudget bleiben als Warnung
sichtbar; Partywerte und Rastplanung benutzen dieselben guarded Übergaben.
Ein fehlender Masken-, Beute-, Party- oder Journalread ist fehlender Nachweis und keine leere Liste. Die Gruppe kann
explizit einen Spielabendmarker beginnen; keine Maske wird dabei beendet, kein
Schatz verteilt, keine Zeit vorgerückt und kein Besuch übernommen. Der
Spielabendabschluss behält seine eigene Laufstandprüfung.

`readSessionResumePrep` liest Gruppen nacheinander, pro Gruppe höchstens drei
unabhängige Basisquellen gleichzeitig. Ohne sequenziellen Besuch prüft es zuerst
den gewählten Plan, dann vorhandene Vorlagen in ihrer Listenfolge und endet beim
ersten offenen oder noch nicht übernommenen Besuch für diese Gruppe. Fehlende
Planreads und Revisionsabweichungen bleiben als Probleme erhalten. Eine defekte
später unbenutzte Vorlage blockiert den ersten gesunden Vorschlag nicht. Die
Mappen werden je Plan und Leseaufruf geteilt. Nach Schließen, neuer Öffnung oder
Ownerwechsel beginnen keine weiteren Fallbackreads.

Die Reihenfolge ist eine begrenzte Vorschlagsregel, keine vollständige
Prioritätsoptimierung oder Aussage über andere Gruppen. Bei nur abgeschlossenen
Plänen können weiterhin alle Planstände nötig sein; `sessionProgress` liest
bestehende Besuchs-/Historydaten. Ein Index-/Paginganschluss ist erst anhand einer
realen größeren Kampagne zu entscheiden. Die Reduktion von 30 auf einen
Planrequest im ersten passenden Fall beweist keine allgemeine Ladezeit oder
Produktlastgrenze.

Ein gezeichneter Button hält Dialoggeneration, Campaignowner, Fokus, Gruppen-
Clock/Membership und Zielgruppenbasis. Entfernte Buttons, geschlossene Dialoge,
neue Dialoge oder geänderte Gruppen dürfen keine alte Aktion verwenden.
Vor Mappenöffnung, Übernahmevorschau oder kombiniertem Start wird die gezeigte
Mappenbasis nochmals gelesen: Plan-ID, Planrevision, Basis und Besuch müssen
passen. Ein neueres Ergebnis ist keine Zustimmung zur neuen Fassung. Bei
Abweichung bleibt der Dialog offen und fordert Schließen, erneutes Öffnen und
neue Wahl. Ein Snapshot der angezeigten Zeile hält die Autorenbytes unabhängig
von späteren Änderungen des Quellobjekts.

Die Übergabe führt ihre Gültigkeit durch weitere Flushes und einen eigenen
Fokuswechsel. Dieser darf die erwartete Fokusbasis nur nach dem bestätigten
angeforderten Wechsel erneuern. Eine Kampagnen-/Fokus-/Gruppenänderung außerhalb
dieses Wegs stoppt weitere UIaktionen und alte Fehlermeldungen. Der normale
Livewriter bleibt revisionsgebunden; kein neuer Writer oder Queuemechanismus.

„Spielabend beginnen + Text in Szene“ kopiert genau den aufgeklappt gezeigten
Vorleseblock, einschließlich CRLF. Die vollständige Mappe kann weitere Vorlese-,
GM-, Referenz-, Encounter- und Rewardblöcke enthalten; diese werden dadurch
nicht zusammengeführt oder gelöscht. Ein vorhandener laufender Vorlesetext wird
nur durch diese ausdrückliche Textaktion ersetzt. Der Marker und die folgende
Textspeicherung bleiben zwei bestätigte Schritte. Ändert sich eigene Prosa
während der Startbestätigung, bleibt sie erhalten; der bestätigte Marker wird
nicht zurückgenommen. Eine fehlgeschlagene Textspeicherung bleibt im bestehenden
Liveentwurf/Recoveryweg. Weder Start noch Mappe geben Spielerinformationen frei
oder führen Encounter-/Rewardwirkungen aus.

Die Mappenprüfung findet vor der Übergabe statt. Spätere Autorenänderungen
promovieren keine neuen Texte in die Aktion; kopiert werden die geprüften
gezeigten Bytes. Es gibt keine gemeinsame Transaktion aus Mappe, Marker und
Szenentext. Für spätere strukturierte Eröffnungsfolgen ist diese Grenze mit
Provenienz und eigener Quell-/Scene-Revision zu gestalten, nicht durch ein
stilles Replay nachträglich zu schließen.

## Nächste Umsetzung und Abnahme

1. Echter Marker-/Textwriter: vorbereiteten Besuch auswählen → Eröffnung prüfen
   → Markerantwort verzögern → eigenen Szenentext ändern → nur Marker bestätigt,
   neuere Prosa erhalten. Getrennt Antwortverlust des Textwrites → vorhandene
   Live-Recovery → normaler Close/Fresh → genau passende Fakten und Rohentwurf.
2. Zwei Gruppen mit verschiedenen Clocks/Teilnehmern und wiederverwendeter
   Timeline: Szene wechseln während Flush/Mappe/Start → keine fremde Textablage,
   keine alte Statusmeldung. Eigener bestätigter Fokuswechsel bleibt nutzbar.
   Aktuelle Planvorlage, frühere Übernahmeherkunft und Livewerte separat prüfen.
3. Mehrere Vorlagen und viele abgeschlossene Besuche am realen Store messen:
   Requestzahl, Zeilen-/Historyscan und Zeit bis zu benutzbarer Startgruppe.
   Erst dann gezielte Query/Index-/Pagingänderung in `storage/session.ts` und
   `storage/visit-outcomes.ts`; keine vorsorgliche neue Suchinfrastruktur.
4. Native Dialog-/Keyboard-/200-%-/Fokusabnahme mit vorliegendem Vorlesetext,
   fehlender Quelle und unabhängiger Kopie. Sichtbarer erster Vorleseblock und
   volle Mappe dürfen nicht als derselbe Inhaltsumfang ausgegeben werden.

Die lokalen Consumerproben verwenden den tatsächlichen Live-Code mit allein
im Testbundle exportierten privaten Funktionen und ersetzten Writer-/Flush-/
Mappenports. Sie prüfen Owner, ausgewählte Bytes, fehlende Evidenz und Request-
Fanout. Ein Test benutzt den echten Start-Consumer vor dessen Dispatchport.
Das ist keine native oder vollständige Writer-/Fresh-/Produktabnahme.
Schema und Commandformat bleiben unverändert; eine Datenmigration ist für diese
Dialog-/Lesekorrektur nicht nötig. Der bestehende
[NPC-Rohentwurfsvertrag](../campaign/npc-dossiers.md) gilt getrennt.

Die integrierten Startbriefings zeigen dieselben geprüften Sources je Gruppe.
Fehlende Bereitschaft, Weltlage oder Masken-/Journalquelle bleibt ausdrücklich
unvollständig; bekannte Roster-Mitgliedschaft bleibt davon getrennt lesbar.
Briefingaktionen einschließlich Ortsmappe verwenden die vorhandene Resumelease.
Die Ortsmappe prüft diese Autorität nach ihrem eigenen Flush nochmals; sie
übernimmt keinen neueren Campaign- oder Fokusstand als alte Freigabe.
