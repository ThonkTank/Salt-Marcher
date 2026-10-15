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
Wiederholung und Dismissal. Unbekannte Ergebnisse werden gelesen; der Statusknopf
wiederholt keine Mutation. Wiederherstellen bleibt im Papierkorb und aktiviert
nichts. Aktives Trash setzt den Zeiger atomar leer. Endgültige Löschung verlangt
exakten Namen und aktuelle Papierkorbrevision; Restbereinigung von Recoverydateien
wird nach Unterbrechung beim Start oder Statuslesen fortgesetzt.

Installationseigene Nutzungsdaten und Katalogbelege gelangen nicht in Kampagnen-
pakete. Originaltexte und fremde Kampagnen bleiben bei Vorschau, Fehlern und
Transfer unverändert. Der Bildschirm wartet vor dem Öffnen auf die vorhandenen
strikten Flush-/Entwurfsgrenzen der zuständigen Editoren.

Grenzen: Der neue Einstellungsdialog liest Generatorpresets ohne Aktivierung;
die bestehende detaillierte Presetbearbeitung und -zuweisung benötigt noch eine
geöffnete Arbeitsfläche. Diese Unabhängigkeit bleibt offen. Historische und
importierte Kampagnen ohne lokale Nutzungsmetadaten zeigen unbekannte Daten.
Vollständige OS-, Tastatur-, 200-%- und Crashqualifikation bleibt eigenständig.
