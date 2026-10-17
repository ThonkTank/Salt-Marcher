# Expliziter Straßenanschluss · 17.10.2026

GM-Aufgabe: Eine Gasse vom Häuserblock an die Mitte einer vorhandenen Straße
zeichnen, den Anschluss vor der Bestätigung erkennen, den Verlauf korrigieren,
zurücknehmen, wiederholen und nach erneutem Öffnen weiterverwenden.

Der frühere Writer erzeugte am Straßenmittelpunkt einen unabhängigen Endknoten.
Die neue Vorschau projiziert Straßenenden auf nahe Straßen oder deren Endknoten.
Ein grüner Ring und der Straßenname kennzeichnen den Anschluss; „Zug abschließen“
bestätigt ihn. Nur die ausdrücklich berührte Straße wird geteilt. Eine ihrer IDs,
alle Merkmale und die Geometrie beider Teilstücke bleiben erhalten. Neue Gasse,
Teilstraßen und Knoten bilden einen kanonischen Historybefehl. Mauern ziehen keine
Straßenanschlüsse an. Automatische Bebauung verändert bestehende Straßen weiterhin
nicht. Zeichnen lädt die vollständige Stadt, bevor neue Punkte angenommen werden;
eine begrenzte Einzelauswahl ist keine ausreichende Anschlussbasis.

Tatsächliche Bedienung im isolierten Browserhost: gleicher Anschlussversuch vor
und nach der Änderung, anschließende Benennung als Verbindungsgasse, eingefügter
Zwischenpunkt und tatsächlicher Griffzug, Undo/Redo und frisches Laden. Undo stellte
alle 378 ursprünglichen city_unit-Zeilen exakt wieder her. Der Anschluss besitzt
einen gemeinsamen Knoten für drei Straßen. Bei vergrößerter Sicht zeigte die erste
Korrektur eine Hausüberschneidung; die Gasse wurde auf vier Meter verengt und um das
Haus geführt. Kein automatischer Kollisionsschutz wird behauptet.

Vergleich: In der bereits vorbereiteten Watabou-Stadt Far Market wurde ein
bestehender Straßenanschluss mit Warp/Displace tatsächlich versetzt, mit Apply
übernommen und als SVG ausgegeben. Der geprüfte Menüablauf bot keinen separaten
Befehl zum Zeichnen einer zusätzlichen Gasse. Dies belegt die lokale Verformung und
eine konkrete Grenze dieses Vergleichsablaufs; es ist kein abgeschlossener
identischer Gassen-/Undo-/Fresh-Ablauf in Watabou und kein allgemeines UX-Urteil.

Technische Belege: tests/desktop-city-junction.test.mjs prüft geknickte Polylinien,
zweifaches Teilen derselben Straße, Metadaten, Wiederverwendung und Mauerausschluss.
Die City-Controller-Prüfungen verwenden den tatsächlichen SQLite-Writer für Vorschau,
atomaren Anschluss und Undo/Redo sowie eine verzögerte vollständige Straßenlesung.
Sie ersetzen weder physische Eingabe noch den paketierten Electron-Host.

Externe Bedienbelege und Datenvergleiche liegen im Chat-Arbeitsbereich unter
`evidence/saltmarcher-blocks-20261017/junction-*` und `watabou-junction-*`.
Paketierter nativer Host, vollständige weitere Konkurrenzabläufe und Nutzerabnahme
bleiben separat offen. Atlas-Bearbeitung und Atlas-Spielleitung sind absichtlich
getrennt; gleichzeitige Reise- und Zeichenwerkzeuge werden nicht verlangt.
