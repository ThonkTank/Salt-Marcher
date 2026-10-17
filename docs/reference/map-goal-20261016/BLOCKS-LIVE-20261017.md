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

Latest Main integration: `574f98bdc` retains one source-bound landscape/geometry frame, bounded previews and exact landscape selection. Own independent viewport/selection readers, guarded navigation, interior visibility and scope-specific exports are preserved. The full-CI-qualified predecessor `5f235472` is pushed as `archive/atlas-qualified-5f235472-20261017`; qualification of this later integration is recorded separately in the task checkpoint.

Direct visible geometry now retains its click intent only when the source-fenced canonical candidate reader confirms the same kind and ID. An unlabelled/ambiguous point still opens the full bounded overlap chooser. Active house placement and shape correction route points to their retained draft, while canonical POI markers retain their dedicated notebook path. Actual before/after evidence and the complete affected city test result are recorded in the checkpoint; the original Main landscape/candidate readers are retained.


## Getrennte Atlas-Bearbeitung und Spielleitung

Nutzervorgabe vom 17.10.: Reise und Bearbeitung müssen nicht gleichzeitig verfügbar sein; getrennte Arbeitsbereiche sind ausdrücklich gewünscht. Der sichtbare Einstieg heißt nun **Atlas bearbeiten**. **Atlas leiten** öffnet direkt die gemeinsame Karte in **Party und Leiten**, ohne eine zweite Karte oder Reiseinstanz. Das frühere Erkunden-Werkzeug entfällt im Bearbeitungsbereich. Der Link **Atlas bearbeiten** an der Live-Karte verwendet denselben vorhandenen Navigations-/Speicherschutz wie die Bereichsnavigation.

Beim Andocken merkt sich der Controller den Bearbeitungskontext (Werkzeug, Auswahl, Stadt/Innenraum/Geschoss, Wissensansicht und Kamera). Beim Rückweg stellt er ihn nur für denselben Kampagnentoken wieder her. Der Live-Gruppenfokus verdrängt daher nicht die Arbeitsansicht. Live-Öffnung verwendet die bestehende Map-Tab-Intentgrenze: Eine neuere Szenenwahl während wartender Speicherungen bleibt gültig. Uhr, Position und Kartendaten werden durch den Wechsel nicht geschrieben.

Realer Ausgangsbefund: Rückkehr nach Party und Leiten zeigte Erkunden statt des zuvor gewählten Stadtwerkzeugs. Der erste Gegenlauf behob das Werkzeug, ließ nach Zur Gruppe aber den Innenraum-Zoom zurück. Der ergänzte Rücksprung ist tatsächlich geprüft: Stadt/Bebauen mit198 Häusern → Atlas leiten → Zur Gruppe zeigt Schankraum und Lagerraum bei unverändert00:00:21 → Atlas bearbeiten kehrt zu Stadt/Bebauen mit exakt gleichem Ursprung und ViewBox zurück. Neues UI-Bookmarking ist flüchtiger Arbeitskontext und kein weiterer persistenter Karten-/Reisemodellbestand. Eigenständige native Qualifikation und vollständiger Gegenwerkzeugvergleich bleiben getrennt.


## Main-Integration: gemeinsame Canvas2D-Fläche

Main `b5992cdc9` ersetzt die Bildschirm-SVG durch genau eine Canvas2D-Fläche. Erhalten bleiben eigene kanonische Auswahlbestätigung, Marker, geschützte Bebauung, Innenraumsicht, beschriftete Räume, Gruppenfokus und getrennte Arbeitskontexte. Gemeinsame Zeichner für Raumlabels und Stadt-Formgriffe können jetzt sowohl die bestehenden Vektorexporte als auch die retenierten Canvas-Zeichenbefehle bedienen. Gruppenansichten konvertieren ausschließlich ihre vorhandene öffentliche Projektion; keine GM-Geometrie wird dafür zusätzlich freigegeben.

Die Canvas-Hit-Auswahl bestimmt das sichtbare Objekt vor einer neuen Zeichnung. Stadt-Formgriffe leiten Pointerdrags durch die Stadtbindung in lokale Meter um, statt Dungeonbindungen zu verwenden. Verwerfen schreibt weiterhin nichts. Ein nativer Eckpunktwähler und „Punkt danach einfügen“ erhalten die Auswahl von Formpunkten auch ohne einzelne DOM-Griffe. Unbenannte ausgewählte Häuser heißen nun ausdrücklich „Unbenanntes Haus“.

Die historischen DOM-Controllertests verwenden einen ausdrücklich benannten Testadapter, der retenierte Zeichenbefehle für ihre Auswahl-/History-/Draftassertionen als abfragbaren Baum projiziert. Dieser Adapter qualifiziert keine Canvas-Pixel oder native Treffer. Dafür bleiben die echten Canvas-Publikations-/Hit-/Decode-/Kontexttests und der tatsächliche Browserablauf erforderlich. Der neue Controllerfall prüft einen übersetzten Stadt-Formdrag und bytegleichen Zustand nach Verwerfen. Der alte Test für einen nachfolgenden Raumklick sendet nun wie ein echter Klick Pointerdown/Pointerup; die neue Main-Gestenunterdrückung endet bewusst erst beim nächsten echten Druck. Kein bestehendes Daten-/Historyorakel entfernt.


### Sichtausschnitte in Canvas

Bei der Integration fiel auf, dass das öffentliche Landschafts-SVG aktuelle Bilder per `clip-path` auf tatsächlich sichtbare Hexe begrenzt, während Canvas bisher nur die Vektorgeometrie übernahm. Canvas kompiliert nun diese Ausschnitte einschließlich Gruppen-Transformationen und erzwingt sie sowohl beim Zeichnen als auch für Treffer und Tooltips. Fehlende Definitionen oder unbekannte Ausschnitteinheiten erzeugen einen expliziten Fehler statt ungeclipptem Inhalt. Der neue Regressionstest unterscheidet einen sichtbaren Punkt von einem verdeckten Punkt im selben aktuellen Landschaftsobjekt und prüft den tatsächlichen Canvas-Clip-Aufruf. Die bestehenden zehn Renderer-/Decode-/Kontextfälle bleiben erhalten. Diese technischen Belege ersetzen keine native Spielerabnahme oder vollständige Sicht-/Dunkelsichtprüfung.
