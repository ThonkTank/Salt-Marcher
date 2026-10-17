# Tür und Rückweg zur Taverne: tatsächlicher Nachtest

Am 17.10.2026 wurde die vorhandene synthetische Taverne im isolierten QA-Host weiterbearbeitet. Die bestehende Reise von Mira ins Lager und ihre 21 Sekunden Gruppenzeit wurden nicht neu angelegt. Main `b857b0ba8` ist integriert; reguläre Nutzerdaten und fremde Arbeitskopien bleiben unverändert.

## Drei beobachtete Hindernisse behoben

- **Tür an gemeinsamer Wand:** Vorher setzte der tatsächliche Klick → Enter die Raumbindung auf Lagerraum, aber den verbundenen Raum auf „Keine Bindung“. Die Platzierung erkennt jetzt genau einen Raum auf der gegenüberliegenden Wandseite und übernimmt ihn automatisch. Der gleiche UI-Ablauf zeigt danach **Raumbindung: 2. Lagerraum; Verbundener Raum: 1. Schankraum**. Die kleine Zeichnungsabweichung der beiden real gezeichneten Wände wird berücksichtigt; Außenwände, entfernte Räume und mehrdeutige Überlagerungen erhalten keine erfundene Verbindung. Bestehende Türen und manuelle Korrektur werden nicht geändert.
- **Rückgängig bei ausgewählter Tür:** Das tatsächliche Rückgängigmachen entfernte die Prüftür, der saubere Inspektor versuchte jedoch weiterhin ihre Detaildaten zu laden: „Zeichnungselement fehlt.“ Nach dem Aktualisieren wird eine nachweislich entfernte/archivierte saubere Auswahl verworfen. Ungespeicherte Änderungen behalten ihren bisherigen Konfliktschutz. Nachtest: Tür anlegen → Auswahl → Rückgängig meldet „Gespeichert“, schließt den Elementinspektor und erlaubt „Zum Haus“.
- **Hausrückkehr:** Das Öffnen des Innenraums schaltete Dächer global aus. Beim Rückweg lagen deshalb Hausname und Raumlabels übereinander. Der aktive Innenraum öffnet nun seine Geometrie unabhängig von der beibehaltenen Dach-Einstellung. Die Stadt-/Hausansicht mit Dächern zeigt das Haus und dessen Namen; die Innenraumansicht zeigt wieder die Räume. Tatsächlicher frischer Ablauf: Suche → Haus → Innenraum öffnen → Zum Haus. Dächer bleiben an, keine Raumlabels über dem Dach, Hausname und Notiz unverändert. Anschließend wurde die Hausansicht tatsächlich als PNG ausgegeben und die Datei visuell geprüft.

## Vergleich

Der vorhandene Zwei-Raum-Grundriss mit Trennwand, Tür und beiden Beschriftungen wurde in Dungeon Scrawl erneut über **Exportieren** als PNG heruntergeladen und visuell geprüft. Er bleibt als Kartenhandout verwendbar. Scrawl zeichnet hier ein Türsymbol; eine SaltMarcher-Raumbindung wird dadurch nicht nachgewiesen. Die neue automatische Verbindung verbessert die zuvor tatsächlich nötige manuelle Bindungsarbeit im eigenen Tool. Kein vollständiger Stadt-/Regions-/Leitungsvergleich oder allgemeiner Überlegenheitsnachweis wird daraus abgeleitet.

Bearbeitbares Speichern/frisches Öffnen im Vergleichswerkzeug bleibt offen. Der native KDE-Speicherweg war bereits ausprobiert und sicher abgebrochen; die Desktop-Sperre wurde nicht umgangen. Es erfolgte keine Anmeldung, Vertragsannahme oder Veröffentlichung. Browser-UI und Bildausgabe sind belegt, eine gepackte native Electron-Abnahme weiterhin nicht.

## Technische Prüfung

5/5 Platzierungsfälle, 21/21 Zeichnungs-DOM-Fälle und 3/3 betroffene Haus-/Innenraum-/Exportfälle bestehen. Die neuen Fälle prüfen beide gespeicherten Türbindungen, fehlende Verbindung bei Außen-/mehrdeutigen Wänden, Lesen nach Rücknahme und beibehaltene Dach-Einstellung. Der erste neue Undo-Test verwendete unterschiedliche IDs im äußeren und inneren Befehl und erreichte die Produktprüfung nicht; nach Verwendung des kanonischen gemeinsamen Befehls besteht er. Der Haus-Test setzt die native Checkbox-Eigenschaft ausdrücklich, da Linkedom den HTML-Standardwert nicht nachbildet. Ein vorheriger fehlgeschlagener Lauf wurde nach übermäßigem DOM-Assertion-Dump gestoppt; Endprüfungen haben normale Prozessenden. Kein Erfolg dieses abgebrochenen Laufs behauptet.

Frontend-/Desktop-Typprüfung, Repositoryprüfung, Desktop- und QA-Build werden separat erfasst. Der vorherige Kandidat `e6ded7859` ist mit erfolgreicher vollständiger CI `38990432662` archiviert: 3744 bestanden, 0 Fehler, 1 optional übersprungen. Der Nachfolger benötigt seine eigene Pflicht-CI. Die ausdrückliche Nutzerabnahme bleibt offen; der kontinuierliche Goal bleibt pausiert.
