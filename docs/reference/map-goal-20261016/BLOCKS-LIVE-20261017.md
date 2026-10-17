# Verbundene Viertel vorbereiten und im Spiel benutzen

## Reale GM-Aufgabe

Das bestehende Marktviertel mit vorhandenen Straßen und benannter Taverne erschließen, neue Häuser vorschlagen, den Entwurf verwerfen/wiederholen und gemeinsam übernehmen. Die Straßen anschließend einzeln bearbeiten, erneut bebauen, nach frischem Start wiederfinden und zur Gruppe im gespeicherten Innenraum wechseln.

## Vergleich und beobachtete Belastung

Die tatsächliche Ausgangsvorschau erzeugte bei Seed Markttag und Dichte 0.65 wieder 80 Häuser. Straßenfronten waren vorhanden, größere freie Bereiche aber ohne Nebenwege. Im tatsächlichen Watabou-Plan wurde ein lokaler Block mit „Reroll geometry“ geändert, der erhaltene Gasthausmarker „Zum Silbernen Ast“ wieder geöffnet und GeoJSON sowie SVG heruntergeladen. Watabous Straßen-/Parzellenstruktur bleibt organischer. Die Geometrieausgaben enthalten den ausgeschriebenen Markernamen nicht; sie belegen keinen vollständigen bearbeitbaren Save/Fresh- oder Live-Ablauf.

## Umsetzung

„Freie Flächen mit Nebenstraßen erschließen“ erzeugt eine ausdrückliche Vorschau aus Straßen, Knoten und Häusern. Neue Wege beginnen an vorhandenen Straßenenden und wachsen über gemeinsame Knoten in seitlich verbundene Reihen. Ein vorhandener Knoten unmittelbar am Viertelrand darf den kurzen Anschluss liefern. Neue Knoten liegen im Viertel; Wasser, Plätze, geschützte Häuser und Mauern bleiben frei. Bereits vorgeschlagene Netze dürfen sich nicht mit weiteren Diagonalen überlagern.

Eine verschärfte Prüfung deckte zunächst Anschlüsse auf, die nur geometrisch auf einem bestehenden Straßenzug lagen. Der finale Planer benutzt echte bestehende Knotenidentitäten. Er schreibt vorhandene Hauptstraßen, deren Geometrie und Namen nicht um. Fehlt ein anschließbares Ende, bleiben die vorhandenen Straßen erhalten; eine automatische Teilung bestehender Straßen ist noch offen.

Übernahme, Rückgängig und Wiederholen betreffen Knoten, Straßen, Häuser und Viertelrezept gemeinsam. Akzeptierte Wege sind normale einzeln bearbeitbare Stadtelemente. Weitere Bebauung erhält auch benannte oder verbreiterte Wege und erzeugt kein zweites Netz. Die kanonische Sortierung verhindert abweichende Hinterhofhäuser allein durch eine andere Datenbankreihenfolge.

Die Vorschau zeigt „Verwerfen“ bereits während der Berechnung, gibt der Oberfläche regelmäßig Rechenzeit zurück und hält Entscheidungen in einer stabilen Zeile. Fertige Entscheidungen werden sichtbar gescrollt. Bauweise-Felder bleiben beim Laden des vollständigen Stadtbezugs gesperrt, statt schnelle Eingaben später zu überschreiben.

Der Raum-Entwurfscheck beendet seine eigene Ladeanzeige, wenn kein offener Entwurf vorliegt; neuere Meldungen bleiben unangetastet. Hausnavigation hält die Innenraumaktion bis zu ihrem passenden Abschluss zurück. Neuere Ziele verwerfen wartende alte Innenraumaufrufe. „Zur Gruppe“, Weltübersicht und Zoom liegen direkt an der Live-Karte. Der Gruppensprung wird erst mit geladenem Atlas-Kontext freigegeben.

## Tatsächlicher Nachlauf

Die finale Ausgangsfläche liefert 163 Hausvorschläge und 27 zusätzliche Straßen. Verwerfen und Wiederholung liefern denselben Entwurf. Die Übernahme ergibt 198 Häuser und 30 Straßen insgesamt; Südmarkt und geschützte Taverne bleiben erhalten. Die konkrete Wiederholungs-, Neustart- und Benennungsprüfung sowie exakte Quellen, Prozessausgänge und CI stehen im Heartbeat-Checkpoint.

Die vorherige Zwischenvariante mit 210 Häusern und 33 Straßen bleibt als SQLite-Beleg erhalten. Ihre drei eigenen Autorenaktionen wurden über die Oberfläche zurückgenommen; fremde Daten wurden nicht geändert. Sie gilt nicht als finaler Anschlussnachweis.

Die ursprüngliche Tavernen-Notiz und beide Raum-Payloads wurden zusätzlich bytegleich gegen die Sicherung geprüft. Der tatsächliche UI-Ablauf öffnete Schankraum und Lagerraum, las Mira im Lagerraum bei Tag 0, 00:00:21 und kehrte zur Stadt zurück. Nach Kaltstart öffnet ein bereiter Gruppensprung die geladene Innenraumkarte. Vorher notwendiges Öffnen eines eingeklappten Reisemenüs und ein wirkungsloser früher Gruppenklick entfallen.

## Grenzen

Der Browser-Host verwendet kanonischen Renderer, Preload, Main, SQLite und Worker mit isoliertem Transport und Dateidialog-Shims. Das ist keine gepackte native Spielerfenster-Freigabe. Die Live-Seite benötigt in dieser Fensterhöhe weiterhin Seiten-Scrollen, um alle Karten-/Reisebereiche gleichzeitig zu überblicken. Organische Parzellenformen, Straßenanschlüsse mitten auf bestehenden Zügen, vollständige gepaarte Vorbereitung/Leitung, Scrawl Save/Fresh und Dunkelsicht bleiben offen. Nutzerabnahme ist nicht erteilt; der kontinuierliche Goal-Lauf bleibt pausiert.
