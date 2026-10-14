# SMR-11: Versionierte In-game-Tutorials

Stand: 14. Oktober 2026. Normative Quelle: [Program Capability Requirements, fixierter Stand](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/project/requirements/requirements-program-capabilities.md#in-game-capability-tutorials).

## Ausführbarer Stand

Die Desktop-App öffnet bei der ersten Installation und für jede neue Anwendungsversion automatisch einen optionalen Tutorialdialog. `Fertig`, `Überspringen` und Escape schließen ihn; Hilfe öffnet ihn später erneut. Zustand, Anwendungsversion, Lehrrevision und Laufkennung liegen installationweit in SQLite. Der vorherige Run wird vor einem Lehrrevisionswechsel unter seiner Laufkennung mit seinen unveränderten Originalbytes archiviert. Eine neue Lehrrevision beginnt auch innerhalb derselben Anwendungsversion einen neuen optionalen Lauf, damit ergänzte Produktfähigkeiten nicht durch einen älteren Abschluss verborgen bleiben.

Der Dialog ist scrollbar, setzt den Tastaturfokus auf seine Überschrift und gibt ihn beim Schließen an den vorherigen Auslöser zurück. Ein nicht speicherbarer Status blockiert das Produkt nicht und wird sichtbar gemeldet.

## Mindestabdeckung der sichtbaren Produktoberfläche

Eine ausführbare Invariante bindet die primären Arbeitsbereiche und die ausgewählten statischen Kopfzeilenfähigkeiten aus `index.html` an mindestens eine vorhandene Lektion:

| Oberfläche | Leitende Lektion |
| --- | --- |
| Karte und Keys | Raum und Key zusammen bearbeiten |
| Welt und Spielabend | Weltwissen wiederfinden |
| Party und Leiten | Party und laufender Spielabend |
| Kampagnenchronik | Bestätigte Kampagnenfolgen nachlesen |
| Katalog und Encounter | Begegnungen vorbereiten und leiten |
| NSCs und Monstergruppen | Monstergruppen dauerhaft vorbereiten |
| Schätze | Schätze bearbeiten und verschieben |
| Party öffnen | Party direkt am Tisch verwalten |
| Rastbudget | Tagesbudget und Level-Prognose immer griffbereit |
| Gegenstände und Shops | Gegenstände, Beute und Shops |
| Dungeon leiten | Grundriss, Geschosse und gebundene Details zeichnen |
| NPC-Verhalten | NPCs mit begrenztem Verhalten beauftragen |
| Städte | Vom Straßenzug zum editierbaren Stadtplan |
| Atlas und Reise | Hexkarten und Orte bearbeiten |
| Musik und Ambience | Lokale Musik und Umgebungs-Sounds |
| Spieleranzeige | Der fokussierten Gruppe ein eigenes Fenster geben |
| Verwalten / Transfer | Kampagnen vollständig übertragen und löschen |
| Dungeon übernehmen | Kampagne als Arbeitsraum |
| Erweiterungen | Lokale Erweiterungspakete kontrollieren |

Weitere Lektionen trennen unter anderem Autosave/Recovery, Beziehungen, manuelle Planung, Partygruppen, Scene-Zeit, Chase, Kalender, Wetter, Travel-Checkpoints, Autonomy und Music-Transport. Lektionstexte beschreiben nur heute vorhandene Bedienwirkung und benennen wichtige Grenzen wie Vorschau vor Übernahme, ausdrückliche Bestätigung und fehlende Extensionausführung.

Das erste Unterfähigkeitsinventar bindet zusätzlich konkrete Einstiege statt nur ihre Hauptfläche:

| Capabilitygruppe | Geprüfte Einstiege | Lektion |
| --- | --- | --- |
| Sessiongenerierung | Planungsprofil, bindende Generierung, gespeicherte Vorschauen | Spielabendvorschläge mit bindenden Vorgaben erzeugen |
| Kampf und Rewards | Kampfabschluss, vorbereitete Rewardvergabe, Rewardpanel | Kampf, XP und Beute gemeinsam abschließen |
| Charakterzustand | HP-Formular, Schaden/Heilung, Todesrettungswürfe | HP, Zustände und Todesrettungswürfe führen |
| Fortschritt und Rast | manuelle XP/Korrektur, Gruppenauswahl für Rast, Verlauf | XP und Rastbudget nachvollziehbar ändern |
| Persönliche Beute | manueller Eintrag, Suche/Filter, Statusänderung und Stapelwerkzeuge | Persönliche Beute mit Herkunft weiterführen |
| Live-Momente | gruppengebundener Moment mit optionaler Quest-/Gerüchtspur und Verwaltung aus der Live-Suche | Momente festhalten und Kampagnenfolgen nachlesen |
| Live-Regeln | dynamisches Regelpanel und d20-Probenformular | Regelreferenzen und Proben bei der Gruppe halten |
| Erweiterter Dungeon | 3D-Volumen, Trigger, Inhalte, Graph, Key und Paths | Dungeonstruktur, Inhalte und 3D-Verbindungen vertiefen |

## Verbleibende Abnahme

Die Hauptflächen- und erste Unterfähigkeitsinvariante beweisen noch nicht, dass jede einzelne Capability fachlich verständlich erklärt wird. Das Inventar wird arbeitsbereichsweise fortgeführt; jede weitere Gruppe wird einer konkreten Lektion oder einer begründeten gemeinsamen Lektion zugeordnet. Neue Hauptoberflächen sowie die oben inventarisierten Einstiege dürfen die Invariante nicht ohne vorhandene Lektion passieren.
Dynamisch erzeugte Kopfzeilencontrols wie Questjournal und Schnellsuche sind durch die HTML-Invariante noch nicht erfasst; ihre vorhandenen Lektionen und ihre tatsächliche Erzeugung müssen zusätzlich gemeinsam geprüft werden.

Die DOM-/Storebelege ersetzen keine native Bedienabnahme. Offen bleiben ein echter Erstinstallations- und Update-Lauf im gepackten Desktopprodukt, vollständige Tastaturbedienung einschließlich Escape und Fokusrückgabe, 200-%-Darstellung bei üblicher Laptopauflösung, Screenreader-Reihenfolge, Kontrast sowie die Prüfung, dass der lange Dialog schnelle Arbeitsabläufe nicht behindert.
