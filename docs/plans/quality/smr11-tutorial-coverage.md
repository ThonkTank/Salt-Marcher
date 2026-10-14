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

## Verbleibende Abnahme

Diese Mindestinvariante beweist noch nicht, dass jede einzelne Unterfähigkeit fachlich verständlich erklärt wird. Dynamisch erzeugte Kopfzeilencontrols wie Questjournal und Schnellsuche sind durch diese HTML-Invariante noch nicht erfasst; ihre vorhandenen Lektionen und ihre tatsächliche Erzeugung müssen zusätzlich gemeinsam geprüft werden. Als nächster Schritt ist ein Inventar der tatsächlich sichtbaren Capability-Gruppen pro Arbeitsbereich nötig; jede Gruppe wird einer konkreten Lektion oder einer begründeten gemeinsamen Lektion zugeordnet. Neue Hauptoberflächen dürfen die Invariante nicht ohne Lektion passieren.

Die DOM-/Storebelege ersetzen keine native Bedienabnahme. Offen bleiben ein echter Erstinstallations- und Update-Lauf im gepackten Desktopprodukt, vollständige Tastaturbedienung einschließlich Escape und Fokusrückgabe, 200-%-Darstellung bei üblicher Laptopauflösung, Screenreader-Reihenfolge, Kontrast sowie die Prüfung, dass der lange Dialog schnelle Arbeitsabläufe nicht behindert.
