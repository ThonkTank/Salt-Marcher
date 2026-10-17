# Straßenfronten statt verstreuter Rasterhäuser

Die GM-Aufgabe: beide vorbereiteten Viertel neu bebauen, getrennte Bauweisen behalten, die benannte Taverne samt Innenräumen erhalten, nach frischem Hoststart wiederfinden und im laufenden Spiel benutzen.

## Beobachteter Unterschied

Der akzeptierte Ausgangsplan enthielt 104 Häuser. Die tatsächliche bisherige Vorschau für das Marktviertel erzeugte mit Seed Markttag und Dichte 0.65 wieder 86 verstreute Häuser auf einem versetzten Raster. Im tatsächlich verwendeten Watabou-Plan liegen Häuser dagegen in zusammenhängenden Fronten an Straßen und um Blöcke. Ein lokales „Reroll geometry“, ein benanntes Gasthaus, erneute lokale Regeneration, SVG-Ausgabe und das anschließende Öffnen des Namens „Zum Silbernen Ast“ wurden über die Oberfläche durchgeführt. „Reroll all“ erwies sich zuvor als breiter Gesamtwurf, der auch Viertelnamen änderte; das wurde nicht als gezielte Viertelbearbeitung gewertet. Der anschließend lokale Nachlauf erhielt den benannten Marker. Private GM-Texte, Innenräume oder eine separate Spieleransicht sind damit nicht nachgewiesen.

## Änderung

Die Vorschau beansprucht zuerst die Straßenseiten: variable Hausbreiten und Tiefen, gemeinsame straßenseitige Ausrichtung, von der Dichte abhängige Lücken. Eine zurückhaltende zweite Phase ergänzt verbleibende Flächen innerhalb des bisherigen Straßenabstands. Polygonabstände ersetzen die übergroßen Kreis-/Rechteck-Ausschlussflächen: geneigte Häuser können enger nebeneinander stehen, ohne Straßen, geschützte Häuser, Wasser oder Plätze zu schneiden. Bezirke mit gleichem Seed erhalten getrennte Gebäude-IDs.

Bestehende Häuser werden erst bei ausdrücklicher Vorschauübernahme ersetzt. Hausidentität und gespeicherte Innenräume geschützter Häuser bleiben erhalten; akzeptierte Viertelrezepte verwenden den bestehenden atomaren Auftrag. Das erzeugt Straßenfronten, noch keine vollständige organische Parzellen- oder Nebenstraßengenerierung.

Beim tatsächlichen Rückweg vom Haus/Innenraum über Live zur Stadtsuche blieb außerdem der Hausinspektor unter dem Stadttitel stehen. Derselbe Stadtaufruf leert jetzt diese Auswahl nach dem Speichern offener Hausangaben und zeigt wieder die Stadtwerkzeuge.

## Tatsächlicher Nachlauf

- Gleiche Straßen und Viertel wie zuvor. Marktviertel: 80 Vorschläge; Verwerfen und Wiederholung ergeben wieder 80. Übernahme ersetzt 86 ungeschützte Häuser.
- Südmarkt: 34 Vorschläge statt 17 bisheriger Häuser bei gespeicherter Dichte 0.4. Übernahme ergibt insgesamt 115 Häuser, drei Straßen, zwei Viertel und eine geschützte Taverne.
- Nach echtem QA-Host-Neustart: 115 Häuser sowie Vierteldichten 0.65/0.4 erneut gelesen. Tavernen-Notiz unverändert; Schankraum und Lagerraum wieder geöffnet.
- Live-Karte: Mira bleibt im Lagerraum bei Tag 0, 00:00:21. Der öffentliche Kapellentext bleibt erhalten. Rückkehr zur Stadt zeigt 115 geladene Gebäude, ausgeblendeten Hausinspektor und aktive Stadtwerkzeuge.
- Kanonischer Renderer/Preload/Main/SQLite/Worker im isolierten Browser-Host; kein Nachweis eines gepackten nativen Fensters.

## Eingabe-Reparatur

Ein erneut globaler nativer Dialog von improvedinitiative.app fing die Klicks ab, ohne in den Tab-Dialog-APIs sichtbar zu sein. Die passive Diagnose zählte null zugestellte Ereignisse. Fenstergebundene native Versuche stellten die Eingabe nicht verlässlich wieder her; ein fokussierter XTest-Versuch wurde vor jeder Taste abgebrochen, weil der Fokus einer anderen Anwendung gehörte. Schließlich brach der dokumentierte Browseraufruf `pressKey(null, 'Escape')` den Dialog ab. Danach wurden echte Pointer-/Click-Ereignisse protokolliert und die vollständigen eigenen und Watabou-Teilabläufe durchgeführt. Keine Löschbestätigung akzeptiert, keine Eingabeberechtigung oder Systemeinstellung erweitert. Die Diagnose ist im normalen finalen Build aus.

## Technische Nachprüfung

Der erste vollständige 75-Fall-Stadt-/Atlas-Nachlauf meldete drei Fehler in den Abbruchfällen. Die neue kleine Vorschau blieb unter der bisherigen periodischen Unterbrechungsgrenze und konnte sich abschließen, bevor Abbruch/Kampagnenwechsel griffen. Ein früher asynchroner Unterbrechungspunkt erhält diese Eigentümerschaft auch für kleine Vorschauen; die bisherigen Abbruchassertionen bleiben unverändert. Der finale betroffene Generierungs-/Rezept-/Navigationsnachlauf und die Generator-/Main-Raumtextfälle werden separat protokolliert. Exakte Prozessausgänge und die eigene Kandidaten-CI stehen im Checkpoint.

## Grenzen

Die Gebäude folgen jetzt nachvollziehbar den vorhandenen Straßen. Watabous organische Blockstruktur und Detailwirkung bleiben reicher. Vollständiger gepaarter Vorbereitung-/Leitungsablauf, bearbeitbarer Scrawl-Save/Fresh, Dunkelsicht und gepacktes Spielerfenster bleiben offen. Ebenso bleibt die gesondert beobachtete globale Ladeanzeige nach Rückgängig zu prüfen. Nutzerabnahme ist nicht erteilt; der kontinuierliche Goal-Lauf bleibt pausiert.
