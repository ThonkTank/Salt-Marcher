# SMR-11: Versionierte In-game-Tutorials

Stand: 15. Oktober 2026. Normative Quelle: [Program Capability Requirements, fixierter Stand](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/project/requirements/requirements-program-capabilities.md#in-game-capability-tutorials).

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
| Weltwissen | Suche, Anlage, getrennte Vorlese-/GM-Texte, Papierkorb und Wiederherstellung | Weltwissen wiederfinden |
| Orte und Kartenbindung | Ortssuche/-anlage, Abschnitte, Dungeonzuordnung, Papierkorb und Navigation aus dem Besuch | Orte, Szenen und Karten verbinden |
| Beziehungen und Aufträge | ausgehende/eingehende Referenzen sowie eingebetteter und gemeinsamer Quest-/Gerüchteditor | Beziehungen verfolgen; Aufträge und Gerüchte am Tisch führen |
| Vorbereitungs-Recovery | Sofortspeichern, fortbestehender Entwurf, Statusklärung und gezieltes Verwerfen | Offene Vorbereitung sicher wiederaufnehmen |
| Roster, aktuelle Party und Profil | Partysuche, Anlage, Profilwerte, Teilnahme sowie gruppengebundene Rast | Party direkt am Tisch verwalten; Party und laufender Spielabend |
| Figurenarchiv | bestätigtes Archivieren, Suche, paginierte Liste und Wiederherstellung als inaktive Figur | Figuren archivieren und zurückholen |
| Live-Start und Recovery | ausdrücklicher Start/Wiedereinstieg, Sofortspeichern, Statusklärung und gezieltes Verwerfen | Party und laufender Spielabend; Offene Live-Eingaben sicher klären |
| Gruppen, Fokus und frühere Scenes | Fokuswahl, Split/Rejoin, neue unabhängige Uhr sowie Archiv mit Kampf- und Verfolgungsmasken | Partygruppen führen |
| Unabhängige Scene-Zeit | Dauer, Einheit, Vorschau und bestätigte Fortschreibung nur der Fokusgruppe | Zeit einer Gruppe fortsetzen |
| Szenentisch | gruppengebundene Pins, Suche, direkte Anlage, gemeinsamer Inhaltseditor und Übergabe an Encounter | Kampagnenwissen an der Scene bearbeiten |
| Kampfmasken | weitere Maske, Maskensuche, ausdrücklicher Start, Initiative und gesicherte offene Eingaben | Mehrere Begegnungen in derselben Scene; Kampf, XP und Beute gemeinsam abschließen |
| Verfolgungsmasken | Anlage, Teilnehmer, Start, Rundenfortschritt, gesicherte Eingaben, Suche und Abschluss | Eine Verfolgung über Runden führen |
| Kreaturenkatalog | Filter, Sortierung, Statblock, Provenienz, Menge und getrennte Übergabe an Vorlage oder aktuelle Gruppe | Kreaturen finden und ausdrücklich verwenden |
| Encounter-Vorlagen | Suche, Anlage, Planungsparty, Bewertung, Autosave, Konfliktauswege, Kopie und ausdrückliche Live-Vorbereitung | Eine Encounter-Vorlage sicher vorbereiten |
| Gewichtete Encounter-Tabellen | Kampagnen-/Installationsscope, Katalogauswahl, exakte Gewichte, Kontext, Beutelink und Papierkorb | Gewichtete Encounter-Quellen pflegen |
| Weltquellen und Bestände | Orts-/Fraktionsbindung, Haupttabelle, Schnittmenge und explizite Bestandsgrenzen | Begegnungen aus Ort und Fraktion |
| Gewichtete Beutetabellen | Einträge, Kategorien, Werte, Mengen, Seed, Tabellenrevision und Übergabe als unverteilten Schatz | Beute reproduzierbar aus Tabellen würfeln |
| Generatorpresets | geschütztes Systempreset, eigene Kopie, Rollenmatrix, Speichern, Zuweisung und versionierte Vorschau | Den Encounter-Generator kontrolliert konfigurieren |
| Encounter-Generierung | Party, Katalogfilter, Tabellen, Weltkontext, Preset, Seed, gespeicherte Vorschau und Vorlagenübernahme | Reproduzierbare Encounter-Vorschläge prüfen |
| Benannte Weltgegner | verbindliche Auswahl, reiner NPC-Modus und gemischte Tabellenbegegnung | Einen Gegner verbindlich einplanen; Benannte Gegner für den Spielabend; Benannte Gegner mit einer Eskorte |
| Live-Encounter-Generierung | aktuelle Fokusgruppe, Quellenwahl, gespeicherte Vorschau und ausdrückliche Übernahme in eine neue Kampfmaske | Begegnungen direkt für die laufende Gruppe erzeugen |
| NPC-Weltprofile | Suche/Filter/Pagination, dauerhafte Identität, optionaler Statblock und HP, Profilentwurf, gezieltes Verwerfen sowie Übergabe an die aktuelle Begegnung | NSCs als bestehende Individuen führen |
| Vorbereitete Monstergruppen | Suche/Pagination, Anlage aus Vorlage, gruppengebundener Entwurf, Katalogergänzung, Standort und bestätigte Weltfiguren | Monstergruppen dauerhaft vorbereiten |
| NPC-Dossier am Spieltisch | Gruppenort-/Kampagnensuche, Dossier, Gesprächsentwurf, Profil-, Autonomy-, Vorlese- und Encounterübergabe | NSCs am Spieltisch führen |
| NPC-Autonomy-Übergang | einzelne Weltfiguren und bestehende Gruppen aktivieren, konfigurieren und über bestätigte Zeit fortsetzen | NPCs mit begrenztem Verhalten beauftragen |
| Manuelle Timeline und Ersatz | plan-/ort-/partyfreie Besuche, Suche, Reihenfolge sowie Vorschau für Wiederverwendung oder Leeren | Eine Szenenfolge vorbereiten; Einen neuen Abend aus vorhandener Vorbereitung bauen |
| Besuchsvorbereitung und Übergabe | Vorlesetext, Weltverweise, Gruppen, Belohnung und ausdrückliche Übernahme in die laufende Gruppe | Spielabendinhalte und Vorschläge verwenden; Party und laufender Spielabend |
| Gemeinsame Auswahl und Mappe | Vorschlagssuche/-auswahl, Reihenfolge, vollständige GM-Mappe, Suche und Markdownexport | Einen Abend gemeinsam vorbereiten; Den ganzen Spielabend griffbereit haben |
| Wiederverwendung und Ergebnisse | Besuchsauswahl aus früheren Plänen sowie gruppengebundener Status und Ergebnis | Vorbereitete Szenen für den nächsten Abend nutzen; Vom Besuch zum bestätigten Ergebnis |
| Agenda und Wiedereinstieg | Fristen nach Gruppenzeit; Übergabe, Weltlage, Besuch, Auftrag, Masken und Beute vor neuem Startmarker | Fristen an der Gruppenzeit planen; Einen Spielabend beginnen und mit Rückblick beenden |
| Live-Momente | gruppengebundener Moment mit optionaler Quest-/Gerüchtspur und Verwaltung aus der Live-Suche | Momente festhalten und Kampagnenfolgen nachlesen |
| Spielabend-Rückblick | Beginnmarkierung, laufende bestätigte Ereignisse, Abschlussprüfung sowie Ende mit Rückblick und Übergabe | Einen Spielabend beginnen und mit Rückblick beenden |
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
| Dungeonstruktur | getrennte Einstiege für 3D-Volumen, Trigger, Inhalte, Graph, Key und Paths | Dungeonstruktur, Inhalte und 3D-Verbindungen vertiefen |
| 3D-Volumen | Konturvorschau, Schnitte, Zellen/Flächen, Übernahme und Verwerfen | Raumkonturen als 3D-Volumen ausarbeiten |
| Trigger und Fallenlaufzustand | mehrteilige Triggerfelder, Fallenregel, Chargekorrektur, Reset und bestätigte Aktivierung | Triggerfelder und Fallenlaufzustand getrennt führen |
| Dungeon-Inhalte | Encounter-/Lootbesitzer, öffentliche und private Texte, Voxelanker, Entdeckung und verlorene Geometrie | Dungeon-Inhalte an Volumen binden |
| Graphentwurf | Ansichten, Änderungen, Budgetplanung, Rastervorschau, Übernahme und vollständige Wiederherstellung | Dungeonfluss in einer geschützten Vorschau planen |
| Dungeon-Key und Ausgabe | Suche/Filter, Besitzer und Vererbung, Blöcke/Referenzen, Sammeländerung, öffentliche und GM-Ausgaben | Dungeon-Keys, Vererbung und Ausgabe pflegen |
| Paths und Passagen | Anker, Wegpunkte, Vorschau/Übernahme sowie getrennte Passagenseiten und Wiederzuordnung | 3D-Paths und gerichtete Passagen verbinden |
| Dungeon-Binder | Suche, Dungeon-/Geschossfilter, GM-Key, öffentliche Vorschau und Navigation in bestehende Abläufe | Raum-Keys beim Leiten lesen |

## Verbleibende Abnahme

Die Hauptflächen- und erste Unterfähigkeitsinvariante beweisen noch nicht, dass jede einzelne Capability fachlich verständlich erklärt wird. Das Inventar wird arbeitsbereichsweise fortgeführt; jede weitere Gruppe wird einer konkreten Lektion oder einer begründeten gemeinsamen Lektion zugeordnet. Neue Hauptoberflächen sowie die oben inventarisierten Einstiege dürfen die Invariante nicht ohne vorhandene Lektion passieren.
Dynamisch erzeugte Kopfzeilencontrols wie Questjournal und Schnellsuche sind durch die HTML-Invariante noch nicht erfasst; ihre vorhandenen Lektionen und ihre tatsächliche Erzeugung müssen zusätzlich gemeinsam geprüft werden.

Die DOM-/Storebelege ersetzen keine native Bedienabnahme. Offen bleiben ein echter Erstinstallations- und Update-Lauf im gepackten Desktopprodukt, vollständige Tastaturbedienung einschließlich Escape und Fokusrückgabe, 200-%-Darstellung bei üblicher Laptopauflösung, Screenreader-Reihenfolge, Kontrast sowie die Prüfung, dass der lange Dialog schnelle Arbeitsabläufe nicht behindert.
