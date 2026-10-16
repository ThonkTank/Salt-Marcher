# Kampagnen als ausdrücklicher Startbereich

Quelle: Salt-Marcher `requirements-campaign-management.md`, gebundene Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`. Lieferung 0.138.

Die Anwendung startet auf einem eigenen Kampagnenbildschirm. Eine gespeicherte
aktive Identität markiert die Fortsetzen-Aktion, lädt aber weder Session noch
Arbeitsfläche automatisch. Bereichsnavigation und Session-Schnellaktionen bleiben
verborgen. Auswahl und Erstellung öffnen ausdrücklich den Spieltisch. Das
Anwendungsmenü enthält Kampagnen und Einstellungen; Transfers bleiben ein
separater Kinddialog mit den bisherigen Konflikt-/Medienwegen.

Der Katalog sortiert nach letzter Öffnung absteigend, Erstellung absteigend und
Identität. Historische fehlende Zeitpunkte bleiben null und werden als unbekannt
angezeigt. UTC-Daten werden bei echter Erstellung/Öffnung gebucht und lokal mit
Datum und Uhrzeit dargestellt. Lesen, Umbenennen, Wiederherstellen und Laden
einer bereits angenommenen Öffnung buchen keine neue Nutzung. Namen werden beim
Speichern getrimmt, erlauben 1–100 Zeichen und dürfen gleich lauten.

Create/Open/Rename/Trash/Erase besitzen gespeicherte, prüfbare Auftragsbelege.
Wiederholung liefert den ursprünglichen Beleg; andere Wirkung unter derselben
Kennung wird abgewiesen. Registryänderung, Nutzung und Beleg liegen in derselben
SQLite-Transaktion. Nach angenommenem Öffnen ist das Laden der Arbeitsfläche
ein eigener wiederholbarer Leseschritt. Ein späterer aktiver Identitätswechsel
sperrt das Laden eines alten Belegs. Offene Graphvorschauen bleiben geschützt.

Namens-, Papierkorb- und Löschdialoge schließen über X oder Escape, verwerfen
Namensentwürfe und ignorieren den Hintergrund. Ausstehende Aufträge sperren
Wiederholung und Dismissal bis einschließlich Aktualisierung und Arbeitsflächenladen.
Auch eine schon wartende Entwurfssicherung darf diese Sperre nicht umgehen.
Unbekannte Ergebnisse werden gelesen; der Statusknopf
wiederholt keine Mutation. Wiederherstellen bleibt im Papierkorb und aktiviert
nichts. Aktives Trash setzt den Zeiger atomar leer. Endgültige Löschung verlangt
exakten Namen und aktuelle Papierkorbrevision; Restbereinigung von Recoverydateien
wird nach Unterbrechung beim Start oder Statuslesen fortgesetzt.

Installationseigene Nutzungsdaten und Katalogbelege gelangen nicht in Kampagnen-
pakete. Originaltexte und fremde Kampagnen bleiben bei Vorschau, Fehlern und
Transfer unverändert. Der Bildschirm wartet vor dem Öffnen auf die vorhandenen
strikten Flush-/Entwurfsgrenzen der zuständigen Editoren.

Der lokale UI-Auftragsvermerk ist keine zweite Kampagnenwahrheit. Kann
`campaign-screen-ui.execute` die neue Absicht nicht vermerken, sendet es keinen
Storecommand und hält Namen/Bedienung für einen ausdrücklichen neuen Versuch
offen. Erst der erfolgreiche Vermerk aktiviert den Pending-/Busy-Zustand.
Nach geklärtem Storeergebnis darf dagegen ein fehlgeschlagenes Entfernen des
Vermerks weder den angenommenen Beleg noch das Laden der Arbeitsfläche
verwerfen. Der vorhandene Vermerk bleibt für eine erneute reine Statusabfrage
erhalten; der Kampagnenbildschirm erklärt die fehlgeschlagene Bereinigung.
Keine Mutation wird allein zur Bereinigung wiederholt, keine neue DB-/Journal-
Pipeline oder Migration eingeführt.

`desktop-campaign-catalog.test.mjs` verbindet DOMStoragefehler mit echten
Storebelegen: erfolgloser Intentwrite ohne Dispatch, Name erhalten und Retry
nur einmal; Cleanupfehler nach bestätigter Erstellung, zugängliche Arbeitsfläche
und Wiederinitialisierung mit Statuslesen bei unveränderten DBbytes. Das
qualifiziert weder beschädigte Vermerke noch vollständige Disk-/Crashfälle.
Ein vor Dispatch gesicherter, nach Neustart aber nachweislich ungebuchter Auftrag
ist ein eigener Wiederaufnahmefall. `check` liest nach dem null-Beleg zuerst den
aktuellen Kampagnenkatalog. Scheitert dieser Read, bleibt der ursprüngliche
Vermerk erhalten und ausschließlich erneut prüfbar. Erst mit aktuellem Katalog
wird er entfernt: Create und Rename stellen den Namensdialog wieder her, Erase
den Löschdialog mit eingegebener Bestätigung und derselben Ziel-ID. Trash/Restore
kehren zum passenden vorhandenen Dialog zurück; Open verlangt erneut Auswahl.
Fehlende oder inzwischen getrashte Ziele werden ausdrücklich erklärt, ohne
Ersatzkampagne oder automatische Mutation. Nicht übertragbare Namensentwürfe
bleiben im Ergebnistext sichtbar. Jede erneute Bestätigung erhält einen neuen
Command auf dem gelesenen aktuellen Stand; der alte Auftrag bleibt ungebucht.

Store-/DOMfälle prüfen diese Dialogfelder, Zielidentität, Restore ohne
Aktivierung und fehlerhaftes Kataloglesen ohne Verlust des Vermerks. Eine native
Profil-Neustartprobe prüft den vor Dispatch gesicherten Create-Intent, reine
Statusprüfung mit unveränderten Datenbankbytes und genau eine ausdrückliche
Erstellung nach Wiederherstellung des Namens. Rename-/Erase-Neustart, unbekannte
Outcomes und beschädigte Vermerke behalten eigene Abnahmen.

Weitere Abnahme am selben Kampagnenweg: Browser-/Profilneustart mit offenem
Vermerk vor und nach Storecommit, unlesbarer oder beschädigter Vermerk mit
klarer Wiederaufnahme, abgewiesene Registry-/Medienwrites und anschließendes
sicheres Lesen/Exportieren. Die jeweilige Commandkennung und ihr Storebeleg
bleiben Grundlage; kein blindes Wiederholen einer unbekannten Mutation.

Der vorhandene Einstellungsdialog lädt und bearbeitet Generatorpresets auch
ohne geöffnete Arbeitsfläche. Die optionale Kampagnenzuweisung wählt ausdrücklich
eine verfügbare Identität; Speichern oder Kopieren allein weist nichts zu.
Der konkrete Presetvertrag und seine weiteren Abnahmen stehen in
[Generatorregeln](generator-settings.md). Historische und importierte Kampagnen
ohne lokale Nutzungsmetadaten zeigen unbekannte Daten.
Vollständige OS-, Tastatur-, 200-%- und Crashqualifikation bleibt eigenständig.
