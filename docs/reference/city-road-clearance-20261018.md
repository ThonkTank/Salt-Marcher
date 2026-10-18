# Gasse um ein vorhandenes Haus führen · 18.10.2026

Die Aufgabe: Eine Gasse vom Blockrand an eine vorhandene Straße zeichnen, ein bestehendes
Haus erhalten, einen falsch gesetzten Punkt korrigieren, speichern, Undo/Redo
verwenden, nach neuem Laden wiederfinden und zur Spielleitung wechseln.

Vorher ließ sich die acht Meter breite Straße in der198-Häuser-Stadt Eichenfurt
quer durch ein Haus speichern. Der Hinweis nannte nur Punkte und Anschluss.
Die Vorschau zeichnete einen dünnen Strich unabhängig von der Straßenbreite.
Der tatsächlich gespeicherte Fehlversuch wurde anschließend zurückgenommen.

Jetzt zeigt der Entwurf seine wirkliche Breite. Kapselabstände entlang aller
Segmente prüfen die gedrehte Hauskontur einschließlich Straßenrand und Endkappen;
angrenzende Bordkanten ohne Überlappung sind zulässig. Betroffene Häuser werden rot
markiert und im Hinweis benannt. Abschließen bleibt bei einer Überschneidung
inaktiv, bis der Verlauf frei ist oder der GM „Durch Häuser zeichnen“ ausdrücklich
wählt. Diese Freigabe gilt nur für die aktuelle Geometrie/Breite und Revision.
Sie verändert oder entfernt keine Häuser. „Letzten Punkt zurück“ korrigiert den
Entwurf, ohne seine bisherigen Punkte zu verlieren. Anschlüsse und History nutzen
weiter den kanonischen Straßenwriter; die Prüfung folgt dem eingerasteten Verlauf.

Tatsächlich erneut bedient: derselbe kreuzende Zweipunktzug → rote Kontur und
inaktiver Abschluss → letzten Punkt zurücknehmen → um das Haus führen → freie,
acht Meter breite Vorschau → abschließen → Lagerhausgasse benennen → frisch
wiederfinden → Undo/Redo → Spielleitung/Gruppe → identische Bearbeitungskamera.
Der erste Ausweichversuch streifte mit dem Straßenrand ein weiteres Haus; die
Prüfung erkannte das ebenfalls. Belege liegen im Chat-Arbeitsbereich unter
`evidence/saltmarcher-road-clearance-20261018/`.

Im tatsächlichen Scrawl-Vergleich wurden Haus und Zugang auf zwei benannten Ebenen
gezeichnet. Der kreuzende Zugang wurde rückgängig gemacht und durch drei vereinigte
Rechtecke um den erhaltenen Hausgrundriss geführt. Undo/Redo, .ds-Speicherung,
frischer Import beider benannter Ebenen und PNG-Ausgabe wurden durchgeführt.
Das zeigt die geometrische Aufgabe und Persistenz. Scrawls Ebenen sind keine
kanonischen Häuser/Straßennetze, und daraus folgt keine Reise- oder Gesamtparität.
In diesem bedienten Ablauf kam keine automatische Hausüberschneidungswarnung.

Die aktuelle Main-Integration erhält ihre wiederverwendbaren Canvaspfade, exakte
Objektauswahl und getrennte Autor-Ebene. Aufrechte Beschriftungen, deduplizierte
Ortsmarker und unsere Trennung zwischen Bearbeiten/Leiten bleiben erhalten.
Ein sofortiges Undo nach dem Stadt-Autosave wartet bei Bedarf auf einen aktuellen
Kartenfence. Entfernt Undo das gerade neu angelegte Element, kehrt die Auswahl zur
verbleibenden Stadt zurück; das ist kein fehlgeschlagener Leseversuch. Eine neue
Gasse übernimmt die gemeinsame Auswahl. Die öffentliche Gruppensicht zeigt bei
Ladefehlern ihre fehlende Verfügbarkeit und die erneute Ladeaktion, während die
GM-Bearbeitung den vorherigen bestätigten Hintergrund behalten darf.

Technische Prüfungen decken gerade und geknickte Züge, Breitenüberlappung,
gedrehte Häuser, eingerastete Enden, bewusst erlaubte Durchquerung,
Freigabewiderruf, Erhalt der Hausdaten, History und verspätete Kartenantworten ab.
Die Kollisionshilfe gilt für neu gezeichnete Straßen. Bestehende Straßenbreiten,
Formgriffe und Hausverschiebungen benötigen dieselbe Rückmeldung in weiteren
Abläufen. Paketierter nativer Host, vollständige weitere Atlas-/Reisevergleiche
und ausdrückliche Nutzerabnahme bleiben offen.
