# Kampagnen als ausdrücklicher Startbereich

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: campaign
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

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
qualifiziert zunächst weder beschädigte Vermerke noch vollständige Disk-/Crashfälle.
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
Outcomes und vollständige Disk-/Crashfälle behalten eigene Abnahmen.

## Unlesbare lokale Auftragsvermerke

`campaign-catalog-command.ts` validiert denselben unveränderten Commandvertrag
vor dem Storefingerprint und beim Wiederlesen lokaler Absichten. Die Prüfung
normalisiert keine Namen, IDs oder Bytes und ändert bestehende Belege nicht.
Ein fehlender Schlüssel bedeutet keine offene Absicht; ein Lesefehler oder
ungültiges JSON/Commandformat bedeutet dagegen ausdrücklich unklaren Zustand.
Die Kampagnenliste bleibt lesbar, neue Identitätsaufträge bleiben gesperrt und
die Warnung bleibt nach dem Katalogread sichtbar. „Auftragsvermerk erneut lesen“
versucht nur den lokalen Read und danach für einen gültigen Command den
vorhandenen Buchungsstatus. Es sendet keine Mutation. Ungebuchte gültige
Absichten erhalten weiterhin ihre Dialogfelder und brauchen neue Bestätigung.

Bei beschädigten lesbaren Bytes zeigt der Bildschirm das Original als
schreibgeschützten Text. Ausschließlich „Beschädigten Vermerk sichern und
freigeben“ kopiert es unter eine neue lokale Sicherungskennung und prüft die
wortgetreue Rücklesbarkeit. Nur wenn auch der aktuelle ursprüngliche Schlüssel
noch dieselben Bytes enthält, wird dieser entfernt. Geänderte Vermerke werden
neu gelesen; fehlgeschlagene Sicherung oder Entfernung erhält die Sperre. Ein erneuter Versuch
verwendet eine schon bestätigte Sicherung desselben Originals weiter.
Ein bloßer Zugriffsfehler ohne gelesene Bytes bietet keine Freigabe. Die
Sicherung bleibt auf demselben Gerät, gehört nicht zum Kampagnenpaket und ist
kein zweites Buchungsjournal. Der Bildschirm erklärt, dass bereits gebuchte
Wirkungen weder zurückgenommen noch automatisch wiederholt werden; vor einem
neuen Auftrag ist der aktuelle Kampagnenstand maßgeblich. Keine DBmigration.

Die gezielten DOM-/Storefälle prüfen einen bereits gebuchten Create-Command
nach vorübergehend fehlendem lokalem Lesezugriff, JSON-/Formatfehler, unveränderte
Originalbytes, Sicherungs-/Entfernungsfehler, ausgetauschte Vermerke und erst
nach der Freigabe ausdrücklich erstellte Kampagnen. Die reine Statusklärung
und lokale Sicherung verändern keine Datenbankbytes. Vollständige
Disk-/Crash-/Mehrfensterqualifikation bleibt eine eigene Abnahme. Nativ geprüft:
Lesefehler nach Profilreload, Sperre und reine Belegprüfung vor Freigabe des
Arbeitsflächenladens, Sicherungsfehler, explizite Freigabe, Auswahl zwischen
zwei gleichnamigen Identitäten und Profilneustart mit erhaltener Sicherung und
Originalnotiz. Zwei normale Exits, keine Rendererfehler. Das vollständige
Arbeitsflächenladen speichert die gewählte Vorbereitungsnotiz als UI-Präferenz;
dies ist von der bytegleichen Belegprüfung und lokalen Sicherung getrennt.


Weitere Abnahme am selben Kampagnenweg: Browser-/Profilneustart mit offenem
Vermerk vor und nach Storecommit, Vermerkwiederaufnahme einschließlich Prozessabbruch zwischen lokaler Sicherung
und Schlüsselentfernung, abgewiesene Registry-/Medienwrites und anschließendes
sicheres Lesen/Exportieren. Die jeweilige Commandkennung und ihr Storebeleg
bleiben Grundlage; kein blindes Wiederholen einer unbekannten Mutation.

Der vorhandene Einstellungsdialog lädt und bearbeitet Generatorpresets auch
ohne geöffnete Arbeitsfläche. Die optionale Kampagnenzuweisung wählt ausdrücklich
eine verfügbare Identität; Speichern oder Kopieren allein weist nichts zu.
Der konkrete Presetvertrag und seine weiteren Abnahmen stehen in
[Generatorregeln](generator-settings.md). Historische und importierte Kampagnen
ohne lokale Nutzungsmetadaten zeigen unbekannte Daten.
Vollständige OS-, Tastatur-, 100 %- und Crashqualifikation bleibt eigenständig.

## Bestätigte Kopie und lokale Transferbereinigung

Kopie und Paketimport teilen den bestehenden Main-/Snapshot-/Receiptweg. Nach
bestätigter Übernahme darf ein Fehler beim Entfernen von
`campaign-pending-transfer` weder die neue Kampagne noch die Aktualisierung der
Liste blockieren. Der lokale Vermerk bleibt in diesem Fall erhalten; neue
Transfers bleiben gesperrt, bis „Übernahme prüfen“ das gespeicherte Ergebnis
liest und den Vermerk entfernen kann. Auch bei verlorener Annahmeantwort und
nach Profilneustart wird ausschließlich der Beleg gelesen. Keine erneute
Annahme, zusätzliche Zielkampagne oder Änderung des Archivformats.

`desktop-campaign-transfer-ui.test.mjs` prüft direkte und wiederaufgenommene
Bestätigung sowie einen ungebuchten Auftrag bei fehlgeschlagener Bereinigung.
Die native Probe `python3 tools/ui-session.py node tools/test-desktop-campaign-copy.mjs`
führt Original → Kopie bearbeiten → Paketexport → unabhängiger Import → Neustart
und getrennte Weiterarbeit aus. Ein Raum mit Geometrie/Prosa, zwei verknüpfte
Notizen und ihre Raum-Key-Verweise erhalten getrennte Zielkennungen. Sourceprosa,
Geometrie, literale Linkbeispiele und Paketbytes bleiben erhalten. Die Probe
lenkt nur die Dateiauswahl auf Testpfade und injiziert Bereinigungsfehler sowie
eine verlorene Antwort nach echtem Commit. Status-/Bereinigungswiederholung
lässt die serialisierten SQLitebytes unverändert; drei Prozesse enden normal.
Die Fixture qualifiziert diesen Notiz-/Kartenweg; Medienumfang, andere
Betriebssysteme, Hard-Crash und Ownerabnahme behalten ihre eigenen Kriterien.
