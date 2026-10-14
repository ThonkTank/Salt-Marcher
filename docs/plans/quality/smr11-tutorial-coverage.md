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
| NSCs und Monstergruppen | NSCs als bestehende Individuen führen |
| Schätze | Schätze bearbeiten und verschieben |
| Party öffnen | Party direkt am Tisch verwalten |
| Rastbudget | Tagesbudget und Level-Prognose immer griffbereit |
| Gegenstände und Shops | Shops, Bestand und Handel führen |
| Dungeon leiten | Grundriss, Geschosse und gebundene Details zeichnen |
| NPC-Verhalten | NPCs mit begrenztem Verhalten beauftragen |
| Städte | Vom Straßenzug zum editierbaren Stadtplan |
| Atlas und Reise | Hexkarten und Orte bearbeiten |
| Musik und Ambience | Lokale Musik und Umgebungs-Sounds |
| Spieleranzeige | Kenntnis und aktuelle Sicht der Gruppe trennen |
| Neue Kampagne / Name ändern | Kampagne als Arbeitsraum |
| Rastbudget in der Kopfzeile | Tagesbudget und Level-Prognose immer griffbereit |
| Party in der Kopfzeile | Party direkt am Tisch verwalten |
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
| Gegenstandsdefinitionen | Katalogsuche, eigene Definition, schreibgeschützte SRD-Quelle, Kopie und Papierkorb | Gegenstände als Definitionen pflegen |
| Shops und Handel | Shopanlage, Bestand und Preise, Auffüllzeit, Kauf, Verkauf und Verlauf | Shops, Bestand und Handel führen |
| Schatzverwaltung | Anlage, Katalogposten, bestätigter Entwurf, Teilmengenverschiebung, Einzelzuweisung und Verlauf | Schätze bearbeiten und verschieben |
| Gemeinsame Schatzverteilung | Einstieg im Schatzbereich und am Spieltisch, Gleichverteilung, Einzelkorrektur und Bestätigung | Einen Schatz gemeinsam verteilen |
| Live-Momente | gruppengebundener Moment mit optionaler Quest-/Gerüchtspur und Verwaltung aus der Live-Suche | Momente festhalten und Kampagnenfolgen nachlesen |
| Spielabend-Rückblick | Beginnmarkierung, laufende bestätigte Ereignisse, Ende mit Abschlussnotiz | Einen Spielabend beginnen und mit Rückblick beenden |
| Direkte Spielerfreigaben | Vorlesetext, Ortsbild, NPC-Porträt, Handout, Live-Automatik und Leeren | Inhalte am Spieltisch ausdrücklich freigeben |
| Spielerkenntnis und Sicht | Beobachterwerte, Entdecken/Vergessen, Masken und öffentliche Beschriftungen | Kenntnis und aktuelle Sicht der Gruppe trennen |
| Atlas-Authoring | Karte neu/kopieren/importieren, Hex bearbeiten, Ort markieren, Gruppe platzieren und Kenntnis aufdecken | Hexkarten und Orte bearbeiten |
| Kartenroute | Ziel-/Wegpunktmodus, Tastaturcursor und administrative Erstplatzierung | Eine Reise auf der Karte planen |
| Persistente Reise | Vorschau/Annahme, Abschnitte, Pause/Fortsetzen, Grenze und Ende | Eine Reise wirklich fortsetzen |
| Kalender und Ereignisse | Kalenderregeln sowie einmalige/wiederkehrende örtliche Ereignisse | Kalender und örtliche Ereignisse |
| Wetter | bewegte Wettergebiete, gruppengebundener GM-Override und Freigabe | Wetter entwickeln und ausdrücklich vorgeben |
| Musikbibliothek | lokale Medienaufnahme, Suche, Beschreibung/Kopie, Stimmungsachsen sowie abbrechbarer Export und Import samt Medien | Lokale Musik und Umgebungs-Sounds |
| Musiktransport | großer und kleiner Player, Position, Einstellungen, Queue, Loop, Stopp und Automatikfreigabe | Manuelle Wiedergabe hat Vorrang |
| Scene-Musik und Ambience | gruppengebundene Scene-Regler, Weltquellen, Wetter-/Umweltlayer sowie manuelles Hinzufügen, Unterdrücken und Freigeben | Musik und Wetter zur Gruppe passen lassen |
| Live-Soundboard | gemeinsamer Transport, Kampagnenfavoriten, Bibliotheksauswahl und Mehrfach-Queue am Spieltisch | Den Spielabend direkt am Tisch vertonen |
| Live-Regeln | dynamisches Regelpanel und d20-Probenformular | Regelreferenzen und Proben bei der Gruppe halten |
| Erweiterter Dungeon | 3D-Volumen, Trigger, Inhalte, Graph, Key und Paths | Dungeonstruktur, Inhalte und 3D-Verbindungen vertiefen |

## Verbleibende Abnahme

Die Hauptflächen- und erste Unterfähigkeitsinvariante beweisen noch nicht, dass jede einzelne Capability fachlich verständlich erklärt wird. Das Inventar wird arbeitsbereichsweise fortgeführt; jede weitere Gruppe wird einer konkreten Lektion oder einer begründeten gemeinsamen Lektion zugeordnet. Neue Hauptoberflächen sowie die oben inventarisierten Einstiege dürfen die Invariante nicht ohne vorhandene Lektion passieren.
Dynamisch erzeugte Kopfzeilencontrols wie Questjournal und Schnellsuche sind durch die HTML-Invariante noch nicht erfasst; ihre vorhandenen Lektionen und ihre tatsächliche Erzeugung müssen zusätzlich gemeinsam geprüft werden.

Die DOM-/Storebelege ersetzen keine native Bedienabnahme. Offen bleiben ein echter Erstinstallations- und Update-Lauf im gepackten Desktopprodukt, vollständige Tastaturbedienung einschließlich Escape und Fokusrückgabe, 200-%-Darstellung bei üblicher Laptopauflösung, Screenreader-Reihenfolge, Kontrast sowie die Prüfung, dass der lange Dialog schnelle Arbeitsabläufe nicht behindert.
