# Gemeinsame Raumtexte ohne Überschreiben individueller Keys

GM-Aufgabe: Torhalle, Archiv und Keller der Burg Nebelwacht vorbereiten. Jeder
Raum hat eigenen Vorlesetext und ein eigenes Geheimnis; alle benutzen dieselbe
Mara-Notiz sowie gemeinsame Atmosphäre und eine private Botenregel. Das
Dienstsiegel anschließend zentral von Bernstein auf Blau ändern. Nach normalem
Neustart alle drei Räume wiederfinden, lesen und weiterbearbeiten.

## Beobachteter Ausgangsablauf

SaltMarcher auf Main `137a18fa88291ceed9c070f4f3c9bf158d87922b` erledigte die
Aufgabe einschließlich Neustart und privater/öffentlicher Vorschau. Der Zugang
führte aber über Atlas → Innenräume → Fachwerkzeuge → Raumauswahl → Key. Eine
vorhandene Vorlage musste pro Raum über einen neuen generischen Prosa-Block,
Typwechsel und Vorlagenwahl verknüpft werden. Der Typwechsel ließ die einzige
vorhandene Vorlage zunächst ungewählt und damit den Block ungültig.

Tatsächliche Gegenprobe: lokal installiertes Kanka 3.15, offizieller Quellstand
`79d951798fead551dfbd60d293a6c4695c31c42d`, eigenes Konto und Browserprofil.
Registrierung, Archetyp, Mara, drei Orte, kopierte gemeinsame Admin-Artikel,
individuelle Admin-Artikel und echte Erwähnungsverknüpfungen wurden über die
Oberfläche angelegt. Die zentrale Änderung des Archetyps ließ alle drei bereits
angelegten Orte unverändert. Erst drei individuelle Beschreibungsänderungen
zeigten dort das blaue Siegel. Alle drei Räume wurden nach frischem Browserstart
wiedergefunden und ihre Geheimnisse weiterbearbeitet. Artikel-Sichtbarkeit wurde
als „Admins“ eingestellt und im gerenderten DOM als `data-visibility=2` geprüft;
eine Anmeldung als Spieler wurde nicht geprüft. Das ist ein Befund für diesen
Archetyp-Kopierablauf, keine Behauptung über sämtliche Kanka-Funktionen.

Bei der automatisierten Texteingabe entstand zusätzliche Leerraumformatierung;
sie wurde mit normalen Absatz-Tastatureingaben berichtigt. Sie zählt nicht als
belegter Kanka-Produktmangel. Selektorfehler, Ladezeiten und Anmeldeeinrichtung
zählen ebenfalls nicht als abgeschlossene Gegenprobe oder Produktbefund.

## Änderung

- „Raum-Keys“ ist direkt in der Vorbereitung erreichbar.
- „Gemeinsame Raumtexte“ bietet Vorlagenwahl, direkte Bearbeitung der Quelle und
  Verknüpfung mit dem aktuellen Raum oder ausdrücklich markierten Räumen. Die
  Zielnamen und vorhandenen Verknüpfungen sind sichtbar. Wiederholtes Verknüpfen
  legt keine zweite direkte Verknüpfung an.
- Die vorhandene gemeinsame Key-Batch-Transaktion ergänzt nur die Verknüpfung.
  Raum- und Key-Revisionen sowie Vorlagenidentität, Bereich und Revision werden
  geprüft. Individuelle Blöcke, Originalabschnitte, Geheimnisse, Metadaten und
  Verweise bleiben erhalten. Rückgängig/Redo und Receipt-Replay bleiben beim
  bestehenden Autorenpfad. Kein neues Schema und kein zweiter Textspeicher.
- Beim generischen Typwechsel wird eine eindeutige einzelne Vorlage korrekt
  zugeordnet; bei mehreren Vorlagen gibt es eine ausdrückliche leere Auswahl.

Der neue Ablauf vermeidet sowohl wiederholte Blockverwaltung als auch späteres
manuelles Nachführen unabhängiger Prosa-Kopien. Die unabhängige Inhaltskopie
bleibt als eigener vorhandener Ablauf verfügbar. Eine allgemeine menschliche
Usability-Überlegenheit ist nicht aus dieser eigenen Bedienung abgeleitet.

## Nachweise und Grenzen

Lokale Nachweise sind im Chat-Checkpoint getrennt abgelegt: Ausgangsaufgabe,
Kanka-Gegenprobe, neue vollständige native Aufgabe, gezielte technische Tests,
Candidate-CI, Main-Integration und Main-CI. `tools/test-desktop-shared-template.mjs`
führt die neue Aufgabe einschließlich 200 %, normalem Prozessneustart,
Volltextsuche, privater/öffentlicher Vorschau und Weiterbearbeitung vollständig
durch; die initialen Daten enthalten nur drei leere Raumgeometrien. Texte,
Vorlage und NSC entstehen über echte UI-Bedienung. Native Aufnahmen werden mit
Fenstermaßen geprüft; lesbare Textstellen werden mit realem Mausradscrollen
sichtbar gemacht. Menschliche Abnahme und installiertes Paket bleiben getrennt.
