# Benannte Gasse wiederfinden · 18.10.2026

GM-Aufgabe: Die bereits vorbereitete Verbindungsgasse in Eichenfurt erneut finden,
die Breite korrigieren, Undo/Redo prüfen, zur Gruppe im Lagerraum wechseln und
zur gleichen Bearbeitungsaufgabe zurückkehren. Nach erneutem Laden dieselbe Gasse
über ihren Namen öffnen und die Karte als Bild ausgeben.

## Beobachtung und Änderung

Die globale Atlas-Suche fand die Stadt und Häuser, aber keine benannte Straße.
Die Stadtwurzel und die manuelle Auswahl auf der Karte waren dafür ein Umweg.
Die Suche liest jetzt benannte Straßen, Mauern, Viertel, Plätze und Gewässer in
begrenzten SQL-Seiten. Treffer zeigen Stadt, Elementtyp, Namen und Startkoordinate
zur Unterscheidung. Ein Treffer öffnet genau diese Element-ID über den begrenzten
Fokusleser. Zum Wiederfinden oder Auswählen wird nicht die vollständige Stadt
mit allen Häusern geladen. Veraltete Antworten und Cursor bleiben an Kampagne,
Revision und Suchtext gebunden. Zeichnen lädt weiterhin ausdrücklich die nötige
vollständige Anschlussbasis.

Die Integration des aktuellen Main übernimmt native Canvas-Primitive, direkte
Polygonpfade und den unabhängigen Autor-Layer. Sichtbare Hexe begrenzen aktuelle
Landschaft über numerische Clip-Polygone; Erinnerung bleibt ein öffentlicher
Snapshot. Öffentliche Ortsmarker und der genaue Gruppenpunkt bleiben erhalten.
Raumgriffe werden ausschließlich im Autor-Layer gezeichnet und bleiben dadurch
auch über einem dichten Rasterhintergrund bedienbar. Editor und Spielleitung
bleiben getrennte Arbeitsbereiche mit Rückkehr zur exakten Auswahl/Aufgabe.

## Tatsächlicher Ablauf und Vergleich

Isolierter Browserhost mit kanonischem Electron-/SQLite-Code und Loopback-Bridge:
Die Suche nach Verbindungsgasse lieferte vor der Änderung keinen Treffer.
Danach öffnete der Treffer die richtige Gasse in Eichenfurt (198 Häuser). Breite
4 → 3,8 m, Undo → 4, Redo → 3,8 und Undo → 4 wurden an der Oberfläche geprüft.
Atlas leiten → Zur Gruppe zeigte Mira im Lagerraum; Atlas bearbeiten stellte die
vorige Auswahlaufgabe wieder her. Nach erneutem Laden war dieselbe benannte Gasse
wieder auffindbar. Diese Moduswechsel lassen die Spielzeit unverändert.

Dungeon Scrawl wurde tatsächlich mit einer vergleichbaren Zugangsgeometrie benutzt:
Rechtecke zu einem zusammenhängenden T vereinigt, Ebene Verbindungsgasse benannt,
als .ds gespeichert, in einer frischen Ansicht importiert, einen seitlichen Zugang
ergänzt, Undo/Redo bedient, erneut gespeichert und PNG ausgegeben. Ein zweiter
frischer Import der korrigierten Datei erhielt Name und korrigierte Geometrie.
Scrawl verwendet hier vereinigte Bodengeometrie und einen Ebenennamen. Das belegt
keine semantische Straßennetz-, Gruppen- oder Reiseparität. Die optische T-Verbindung
ist sofort erkennbar; SaltMarchers kanonischer geteilter Straßenknoten wurde
separat im vorigen Ablauf geprüft. Die erfolgreiche Scrawl-Bedienung begründet
kein allgemeines Überlegenheitsurteil.

Der frühere native Speicherdialog wurde im eigenen isolierten Chrome-Profil
umgangen, indem die lokale File-System-Access-Picker-API dort deaktiviert wurde.
Scrawls regulärer Download-Fallback lieferte echte .ds-Dateien. Keine Änderung an
Benutzerprofilen oder globalen Sicherheitseinstellungen; kein Konto und keine
externen Nutzungsbedingungen bestätigt. Das ursprüngliche alte Kartenprojekt
wurde dabei nicht als erfolgreich gespeichert ausgegeben.

## Evidenzgrenzen

Arbeitsbereich: evidence/saltmarcher-search-20261018/. Vorher-/Nachher-Suche,
Auswahl, frisches Laden und Live-Ansicht sind als Screenshots erhalten; beide
Scrawl-Dateien, frischer korrigierter Import und PNG liegen daneben. Technische
Prüfungen decken begrenzte Suche, identische Namen, Cursorinvalidierung,
verzögerte Antworten, exakte Auswahl ohne vollständige Stadtlesung, Clip-Hits,
öffentliche Projektion und Autor-Griffe ab. Sie ersetzen keine tatsächliche UI.
Der Test für geheime Raumnamen vergrößert den GM-Ausschnitt ausdrücklich, bevor
er Namensdarstellung prüft: Die neue Seitenverhältnis-Anpassung blendet den Namen
eines kleinen Raums bei weiter Übersicht korrekt aus; die Geheimhaltungs-
Assertions bleiben erhalten.

Ein paketierter nativer Electron-Lauf, vollständige weitere Vergleichsaufgaben
und die ausdrückliche Nutzerabnahme sind weiterhin offen. Der gesamte Auftrag
bleibt offen, bis Aaron den Zustand akzeptiert. Keine Main-Promotion erfolgt.
