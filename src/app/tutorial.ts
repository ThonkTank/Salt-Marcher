export const tutorialLessonRevision = 'desktop-tutorial-day-rest-stops-v151';
export interface TutorialRun {
  version: string;
  lessonRevision: string;
  runId: string;
  state: 'new' | 'shown' | 'finished' | 'skipped';
}
export function checkedTutorialRun(value: unknown, applicationVersion: string): TutorialRun {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype)
    throw new Error('Tutoriallauf ist beschädigt.');
  const fields = ['version', 'lessonRevision', 'runId', 'state'];
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(value).length !== fields.length ||
    fields.some((key) => !descriptors[key] || !('value' in descriptors[key]))
  )
    throw new Error('Tutoriallauf hat ein unbekanntes Format.');
  const row = value as TutorialRun;
  if (
    row.version !== applicationVersion ||
    typeof row.lessonRevision !== 'string' ||
    !row.lessonRevision ||
    typeof row.runId !== 'string' ||
    !row.runId ||
    !['new', 'shown', 'finished', 'skipped'].includes(row.state)
  )
    throw new Error('Tutoriallauf hat ungültige Werte.');
  return { ...row };
}
export const lessons = [
  {
    id: 'key-room-creation',
    title: 'Mehrere Räume direkt im Dungeon-Key vorbereiten',
    text: 'Lege unter Karte und Keys den ersten Raum an und öffne Raum-Key / Vorlagen. Raum anlegen in der Key-Seitenleiste sichert gültige Eingaben und öffnet den nächsten Raum direkt für Name, Vorlesetext und GM-Notizen. Neue Konturen liegen frei neben dem ausgewählten Kartenraum im selben Dungeon und Geschoss. Vorhandene Geometrie bleibt an ihrem Platz; Verbindungen planst du anschließend auf der Karte unter 3D, Verbindungen und Rauminhalte.',
  },
  {
    id: 'combat-resolution-treasury',
    title: 'Nach dem Kampf gemeinsam Beute verteilen',
    text: 'Nach dem bestätigten Kampfabschluss zeigt die Nachbereitung Ergebnis und bereits gebuchte XP. Sie listet Schätze aus diesem Kampf, der aktuellen Gruppe und ihrem aktuellen Ort, einschließlich unvergebener Einheiten. Gemeinsam verteilen öffnet die bestehende Schatzverteilung mit den Mitgliedern dieser Gruppe vorausgewählt. Prüfe Mengen und Empfänger und bestätige die Verteilung ausdrücklich. Der XP-Award wird dabei nicht wiederholt. Bereits verteilte Schätze bleiben erkennbar. Lesefehler sind vom Zustand ohne Beute getrennt; Beute aktualisieren liest erneut.',
  },
  {
    id: 'session-target-arc',
    title: 'Einen Spielabend mit Begegnungsbogen erzeugen',
    text: 'Wähle im Plan die geplante Party, den Anteil am Abenteuertag und einen Seed. Eine leere Begegnungszahl verwendet die reproduzierbare Automatik; alternativ wählst du 1–10 Begegnungen. Die XP-Ziele steigen vom Einstieg bis zum Abschluss und ergeben zusammen exakt das Planungsbudget. In der gespeicherten Vorschau zeigt der Begegnungsbogen Ziele, konkrete Gegner-XP und Abweichungen. Einzelne Begegnungen lassen sich neu erzeugen, während ihr Ziel, die übrigen Vorschläge, eigene Texte und Belohnungen erhalten bleiben. Erst die ausdrückliche Übernahme schreibt Szenen in die Timeline.',
  },
  {
    id: 'atlas-place-presentation',
    title: 'Orte auf der Hexkarte wiedererkennen',
    text: 'Suche im Ortsmarker-Werkzeug nach Ortsname, Stadttyp oder Kartenname. Marker zeigen springt ausdrücklich zu seiner Position. Zum Versetzen wählst du erst den Ort, dann das Zielhex und Marker auf ausgewähltes Hex versetzen. Ein belegtes Hex nimmt keinen zweiten Marker auf. Eigene Kartenbeschriftung, acht Symbole, Größe und gerade oder gekrümmte Beschriftung werden unabhängig vom Ortsinhalt gespeichert. Schieberegler zeigen die Änderung sofort und speichern beim Loslassen; Text beim Verlassen des Feldes. Ein Konflikt stellt die zuletzt bestätigte Darstellung wieder her.',
  },
  {
    id: 'hex-continuous-paint',
    title: 'Hexlandschaft mit zusammenhängenden Strichen malen',
    text: 'Öffne Atlas und Reise. Mit ausgeschaltetem Gelände malen verschiebt Ziehen die Karte; das Mausrad und Näher/Weiter ändern nur die Ansichtsgröße. Auswahl und offene Hexeingaben bleiben erhalten. Ansicht zurücksetzen zeigt den Ursprung bei 100 Prozent. Ein anderes Bearbeitungsraster wählst du ausdrücklich unter Karteneinstellungen und Austausch. Aktiviere Gelände malen, wähle Gelände und Radius und ziehe über mehrere Hexes: Zwischenräume werden automatisch geschlossen. Alt oder die mittlere Maustaste verschiebt bei aktivem Pinsel. Beim Loslassen wird der Strich gespeichert. Geländestrich zurücknehmen und wiederholen gelten für bis zu zwanzig Striche dieser Karte bis zum Kartenwechsel; Wege, Flüsse, Beschriftungen und Ortsmarker bleiben erhalten. Auf der fokussierten Karte wählen Pfeiltasten Hexes; Alt+Pfeiltasten verschieben die Ansicht. Strg+Z und Strg+Umschalt+Z nehmen Geländestriche zurück oder wiederholen sie.',
  },
  {
    id: 'treasure-anchors',
    title: 'Schätze finden und als Ganzes zuordnen',
    text: 'In Schätze findest du Beute über Titel, Gruppen-/Ortszuordnung oder den Posteingang für nicht platzierte und offene Zuordnungen. Nur mit unverteilten Mengen blendet vollständig vergebene Schätze aus. Ganzen Schatz einer Gruppe oder einem Ort zuordnen bewegt dieselbe Schatzidentität samt Bestand; vergebene Mengen und persönliche Ledger bleiben erhalten. Ziel und Begründung wählen, dann Ganzen Schatz umhängen. Offene Mengenentwürfe zuerst übernehmen oder verwerfen. Verlauf und Chronik halten die Herkunft und jede Umhängung fest.',
  },
  {
    id: 'autonomy-decision',
    title: 'NPC-Entscheidungen vor der Ausführung verstehen',
    text: 'Unter NPC-Verhalten öffnet Entscheidung ansehen die aktuell gespeicherte Auswahl für diesen NPC. Bei ausstehender bestätigter Zeit gilt deren damalige Regelbasis; andernfalls erscheint eine Vorschau mit heutigen Regeln. Du siehst Bedürfnisse, Prioritätsbeiträge, zulässige und abgelehnte Jobs sowie Party- und Pausengrenzen. Suche und Seiten zeigen auch Angebote jenseits des kurzen Verlaufs. Entscheidung neu prüfen liest erneut; Zeit, NPC-Positionen, Zielbuchungen und Zufallswürfe bleiben unverändert.',
  },
  {
    id: 'shop-catalog-restock',
    title: 'Shop mit passenden Katalogwaren beliefern',
    text: 'Unter Gegenstände und Shops legt Kataloglieferung anlegen auch in einem leeren Shop eine Regel an. Filtere nach Suche, Kategorie, Magie, Seltenheit, Einstimmung und Quelle. Katalogtreffer prüfen zeigt die Kandidaten; alle haben dieselbe Chance. Lege Mengenbereiche und Preise für neue Zeilen fest, dann würfle oder wähle einen Zeit-/Ereignisauslöser. Vorhandene Mengenstapel gleicher Gegenstandsrevision behalten Preise und Notizen; neue passende Waren erweitern das Sortiment. Jede Lieferung verwendet den aktuellen Katalog, aufgezeichnete Ergebnisse bleiben erhalten.',
  },
  {
    id: 'shop-restock',
    title: 'Warenlieferungen gewichten und automatisch auffüllen',
    text: 'Öffne Gegenstände und Shops, wähle einen Shop und lege unter Gewichtete Warenauffüllung eine Tabelle an. Wähle vorhandene Mengenstapel, Gewichte und Mindest-/Höchstmengen; Einzelstücke bleiben ausgeschlossen. Jetzt Warenlieferung würfeln speichert Tabelle und Lieferung gemeinsam. Als Auslöser wählst du manuelle Lieferung, Zeitintervall oder den Beginn eines Kalenderereignisses. Beim Intervall gilt: Seine 24-Stunden-Tage sind verstrichene Zeit, keine Fantasykalendertage. Die erste Fälligkeit beginnt an der gewählten Scenezeit. Bestätigte Zeit holt nur neue Fälligkeiten nach; der Shopverlauf zeigt die tatsächlichen Mengen. Einmalige Ereignisse liefern einmal, wiederkehrende Termine holen alle neuen Fälligkeiten nach. Die Bindung beginnt nach der gewählten Scenezeit. Nach Ereignisänderungen pausiert sie sichtbar; im Shop kannst du sie auf die aktuelle Ereignisrevision erneuern.',
  },
  {
    id: 'extension-installation',
    title: 'Zusatzpakete prüfen und Rechte kontrollieren',
    text: 'Öffne Erweiterungen und wähle eine lokale Paketdatei. Prüfe Name, Version, Pakethash und die angeforderten Rechte; bestätige diese ausdrücklich vor der Installation. Rechte widerrufen beendet die Rechteannahme, Paket entfernen hält den Installationsverlauf. Fehlt eine Schreibantwort, wähle Ergebnis prüfen statt erneut zu installieren. Bei einem beschädigten Auftragsvermerk prüfst du zuerst die aktuelle Installationsliste und kannst dann die Wiederaufnahme zurücksetzen; der ursprüngliche Vermerk bleibt gesichert. Die Paketinstallation bietet derzeit noch keinen zusätzlichen Inhaltseditor.',
  },
  {
    id: 'session-loot-guidance',
    title: 'Kumulierte Beute im Spielabend ausgleichen',
    text: 'Aktiviere Beuteausgleich für einzelne Roster-Figuren mit bekannten XP. Der Generator liest die Beute-Fortschrittskurve des wirksamen Presets, vergleicht erwartete Gesamtwerte mit dem persönlichen Ledger und berücksichtigt die geplanten neuen XP. Fehlender Wert hält die automatische Berechnung an; freie Planung bleibt mit abgeschaltetem Ausgleich nutzbar. Beutetabelleneinträge werden auf das Budget begrenzt, fehlender Wert als Münzen ergänzt. Die gespeicherte Empfehlung zeigt Inputs, Differenz und Ziel. Du kannst jede Belohnung trotzdem ändern; eigene Änderungen und bereits angenommene/platzierte Inhalte werden nicht automatisch umgeschrieben.',
  },
  {
    id: 'world-session',
    title: 'Einen Spielabend aus den Weltquellen vorbereiten',
    text: 'Im Spielabendprofil wählst du die Planungsparty, Adventure Day und den Seed. Markiere Orte und Fraktionen; bei aktiver Ortsquellenwahl erzeugt jede Szene ihre Begegnung aus genau diesem Ort. Vorschläge mit eindeutiger Beutetabelle erhalten eigene geplante Beute. Bearbeite Titel, Vorlesetext, GM-Notizen, Wissensverweise und Belohnung vor der Timeline-Übernahme. Begegnung und Beute lassen sich unabhängig neu erzeugen; die anderen Vorschläge und eigenen Texte bleiben erhalten. Ein Ortswechsel braucht eine neue Begegnungsvorschau. Verwerfen und Wiederherstellen betreffen nur den Vorschlag. Belohnungen entstehen erst bei Übernahme als Besuchsvorbereitung und lassen sich dann separat platzieren oder verteilen.',
  },
  {
    id: 'npc-world',
    title: 'NSCs als bestehende Individuen führen',
    text: 'Unter NSCs und Monstergruppen suchst du einzelne Figuren nach Name, Status, Fraktion, Ort und ihrem gesamten Weltprofil. Lege erzählerische NSCs mit Aussehen, Verhalten und Geschichte an; ein optionaler Kreaturverweis eröffnet dauerhafte HP und Begegnungsteilnahme. Fraktionshaltung plus persönlicher Modifikator ergeben verbündet, neutral oder feindlich. Besiegt sperrt neue Teilnahme, verändert keine HP und beendet keine laufende Maske. Formulare werden als Arbeitsentwürfe gesichert, auch mit noch ungültigen Zahlen. „NPC übernehmen“ bestätigt die Weltänderung. Bei fehlender Antwort bleiben deine Texte gesichert und das Profil gesperrt; „Originalauftrag prüfen“ klärt den Ausgang. Es hängt kein zweites Gespräch an. Nach „Nicht übernommen“ entscheidest du erneut; „Entwurf verwerfen“ lädt nur für diese Figur den gespeicherten Stand. „In aktuelle Begegnung übernehmen“ verwendet nach dem Speichern dieselbe Weltidentität und startet keinen Kampf.',
  },
  {
    id: 'world-sources',
    title: 'Begegnungen aus Ort und Fraktion',
    text: 'Lege Fraktionen und Orte in Welt und Spielabend an. Unter Katalog und Encounter verbindest du die Fraktion mit einer Haupttabelle und ihren Beständen: leer ist unbegrenzt, 0 ist nicht verfügbar. Orte verknüpfen eigene Tabellen und Fraktionen. Wähle den Weltkontext für neue Vorschläge; alle gewählten Filter schneiden ihre Quellen. Vorschläge verbrauchen keinen Bestand. Nach Änderungen an Quellen oder Beständen erzeugst du die Vorschau neu.',
  },
  {
    id: 'live-packet',
    title: 'Mit der Mappe am Spieltisch leiten',
    text: 'Öffne bei „Spielabend und Besuchsergebnisse“ die Mappe am Spieltisch. Leitungsfunktionen und Mappe bleiben gleichzeitig bedienbar. Blättere durch Besuche oder suche nach Texten. „Besuch übernehmen“ öffnet die vorhandene Vorschau; Vorlesetexte lassen sich ausdrücklich in die laufende Szene kopieren. Die Spielersteuerung bleibt separat; eine bereits freigegebene Szene folgt ihrem bestehenden Anzeigemodus. Die Party-Bearbeitung kannst du bei Bedarf einblenden. Fokus- und Planwechsel binden die Mappe neu.',
  },
  {
    id: 'session-progress',
    title: 'Vom Besuch zum bestätigten Ergebnis',
    text: 'Am Spieltisch zeigt „Spielabend und Besuchsergebnisse“ die Besuchsfolge eines Plans. „Besuch übernehmen“ öffnet die vorhandene Übernahmevorschau. Halte für den aktuellen übernommenen Besuch Ergebnis und Status fest: abgeschlossen, übersprungen oder wieder offen. Nach Abschluss oder Überspringen kannst du das Ergebnis speichern und direkt den nächsten noch offenen Besuch prüfen. Die nächste Übernahme, XP, Beute und Zeit bestätigst du weiterhin separat. Chronik und Spielabendmappe behalten alle bestätigten Ergebnisse, auch nach Korrektur.',
  },
  {
    id: 'quick-reference',
    title: 'Eine Referenz sofort finden und verwenden',
    text: 'Öffne „Schnellsuche“ in der oberen Leiste oder mit Strg+K. Suche über Weltinhalte und Regeln, Kreaturen, Gegenstände und Begegnungen; Quellen laden getrennt nach. Lies Details, folge benannten Weltverweisen und blättere mit Zurück/Vorwärts durch deinen Verlauf. Anheften verbindet die Referenz mit der angezeigten Fokusgruppe. Vorlesetext kopierst du ausdrücklich in diese laufende Szene. Kreaturen mit Anzahl/Initiative und Begegnungen gehen in die bestehende Vorbereitung am Spieltisch. Spielerfreigabe, Kampfbeginn und Belohnungen bleiben ihre eigenen Aktionen.',
  },
  {
    id: 'narrative-journal',
    title: 'Aufträge und Gerüchte am Tisch führen',
    text: 'Öffne in der oberen Leiste „Aufträge und Gerüchte“. Suche über Titel, GM- und Vorlesetext oder bestätigte Ergebnisse. Filtere Quests/Gerüchte und offene/geschlossene Einträge. Rechts stehen Texte, Weltverweise und der bestehende narrative Status- und Belohnungseditor. Mitwirkende, Ort und Belohnung werden als Eingabe gesichert. Ein Abschluss verlangt ein manuelles Ergebnis und ausdrücklich gewählte XP-Empfänger oder keine XP. Er gibt die Belohnung nur einmal aus. Die Spielabendmappe zeigt den bestätigten Status und Abschluss gebundener Aufträge.',
  },
  {
    id: 'session-review',
    title: 'Einen Abend gemeinsam vorbereiten',
    text: 'Erzeuge in der Vorbereitung Spielabend-Vorschläge. Suche über Titel, GM- und Vorlesetext, Orte, Weltverweise und Gegner. Wähle die sichtbaren passenden Szenen aus; ausgeblendete ausgewählte Szenen bleiben im Auswahlzähler sichtbar. Öffne die gemeinsame Prüfung und bestätige die Reihenfolge. Die ausgewählten Besuche werden zusammen hinten an die Timeline angefügt. Öffne anschließend die Spielabendmappe. Einzelbearbeitung und Neugenerierung bleiben möglich; übernommene Vorschläge findest du über den Statusfilter.',
  },
  {
    id: 'session-packet',
    title: 'Den ganzen Spielabend griffbereit haben',
    text: 'Wähle unter Vorbereitung einen Plan und öffne seine Spielabendmappe. Die Besuchsfolge führt zu Vorlesetext, GM-Notizen, Ortsabschnitten, Weltverweisen, Begegnungen mit Statblocks und Belohnungen. Suche über alle Inhalte. Mit „Am Spieltisch prüfen“ wechselst du mit genau diesem Besuch direkt in den Übernahmedialog. Dort siehst du seine konkrete Wirkung und kannst nach der ausdrücklichen Übernahme sofort seine Mappe am Spieltisch öffnen. Party, Zeit, Kampf und Belohnung bleiben eigene Aktionen. Aktualisieren liest den gespeicherten Stand; als Markdown speichern gibt genau diesen Stand aus. Die Mappe ist für den GM und kann private Inhalte enthalten.',
  },
  {
    id: 'live-travel',
    title: 'Reisen direkt am Spieltisch',
    text: 'Öffne bei der laufenden Fokusgruppe „Reise“. Die Konsole erscheint, die Szenenmitte bleibt erhalten. „Karte öffnen“ zeigt dieselbe Hexkarte in der Mitte. Ziehe den roten Party-Token auf ein beschriebenes Hex, um die Gruppe ohne Reisezeit administrativ zu platzieren. Der gestrichelte Token ist bis zum Loslassen nur eine Vorschau; Escape, ein ungültiges Ziel oder Kontextwechsel verwerfen sie. Alternativ wähle mit Pfeiltasten ein Hex und nutze „Gruppe am Cursor platzieren“; dieser ausdrückliche Weg erlaubt auch die kontinuierliche ungezeichnete Landschaft. Wähle Ziele oder Wegpunkte und bestätige Vorschau und Reiseabschnitte hier. Ein Fokuswechsel folgt der neuen Gruppe und entfernt alte Reiseziele. Einklappen und Atlaswechsel behalten den Entwurf derselben Gruppe. Gelände und Kalender bearbeitest du über „Atlas bearbeiten“.',
  },
  {
    id: 'map-route',
    title: 'In derselben Welt erkunden',
    text: 'Unter Erkunden setzt ein Kartenklick das Reiseziel. Weg prüfen zeigt Strecke und Zeit; erst Reise starten und Ein Schritt oder Eine Runde bewegen die Fokusgruppe und ihre Uhr. Innerhalb von Städten meidet der Fußweg Gebäude, Wasser und Mauern. Wähle einen verbundenen Eingang in Reichweite, um ausdrücklich ins Haus oder hinaus zu gehen. Längere Wege verwenden die vorhandene Weltreise. Zoomen und Suchen bewegen keine Gruppe. Gruppe platzieren ist ein ausdrücklicher GM-Eingriff ohne Reisezeit.',
  },
  {
    id: 'dungeon-rounds',
    title: 'Dungeonbewegung in Erkundungsrunden',
    text: 'Wähle unter Gruppentempo und Erkundungsrunde 1, 5, 10, 15 oder 30 Minuten oder eigene Sekunden. Übernimm die Reisevorgaben. Eine Erkundungsrunde bewegt bis zur gewählten Zeitgrenze, Ankunft oder einem GM-Hinweis. Lange Rasterabschnitte behalten ihren Zeitfortschritt; der Marker bleibt bis zum Erreichen am letzten bestätigten Rasterpunkt. Wiedergabe starten führt Runden ohne Einzelbestätigung fort. 1/2/5/10× ändert nur die Präsentation. Navigation, Fokusverlust und Fensterwechsel halten die Wiedergabe an; nach Neustart ausdrücklich fortsetzen. Freie Tischhandlungen erhalten keine automatischen Aktionskosten.',
  },
  {
    id: 'generation-fill',
    title: 'Vorbereitete Begegnung auffüllen',
    text: 'Öffne eine gespeicherte Encounter-Vorlage mit Planungsparty und vorhandenen Gegnern. Unter Generator wählst du Aktuelle Vorlage auffüllen. Die vorhandenen Gegner zählen fest zu XP und Besetzung; Quellenfilter und harte Kompositionsregeln gelten nur der Ergänzung. Jeder Vorschlag bewahrt den Bestand und die Notizen als unabhängige neue Vorlage. Eine geänderte Ausgangsvorlage verlangt vor Übernahme eine neue Vorschau.',
  },
  {
    id: 'party-awards',
    title: 'XP für den ganzen Spielabend abrechnen',
    text: 'Öffne die Party und „Spielabend-XP abrechnen…“. Wähle Fokusgruppe, aktive Figuren oder einzelne Empfänger. XP-Verdienst und Tagesbelastung haben getrennte Summen und Empfänger. Die Vorschau zeigt XP je Figur und neue Level; bestätige den Grund für eine gemeinsame Buchung. Reservefiguren können XP erhalten. Negative Einzelkorrekturen gehen bis null und leiten auch niedrigere Level automatisch ab. Bestätigter Rastverbrauch und abgeschlossene Rastabschnitte bleiben erhalten.',
  },
  {
    id: 'roster-archive',
    title: 'Figuren archivieren und zurückholen',
    text: 'Öffne die Party oben und wähle bei einer Figur „Archivieren…“. Bestätige ihren genauen Namen. Party und offene Masken verlieren die Figur; Fortschritt, Beute und Erinnerungen bleiben erhalten. Unter „Archivierte Figuren“ findest du sie nach Namen oder ID wieder. Wiederherstellen setzt sie zunächst inaktiv ins Roster. Wähle ihre Teilnahme danach ausdrücklich.',
  },
  {
    id: 'party-topbar',
    title: 'Party direkt am Tisch verwalten',
    text: 'Öffne oben die Party (Alt+P). Die eingeklappten Figuren zeigen XP, Rastfenster und deine installationsweit gewählten Schnellwerte. Klappe einen Namen für alle Werte und Profilaktionen auf. Die Rastanzeige im Kopf mittelt verlässliche Figurenstände ungewichtet; eine Teilbasis wird benannt. Das Fenster lässt sich am Rand vergrößern. Durchsuche das Roster, lege inaktive Figuren an und ändere ihre Teilnahme ausdrücklich. Profilwerte, Sprachen und passive Werte bleiben optional. Klicke den XP-Balken für Level- und XP-Korrekturen. Gruppenrasten gelten der ausgewählten Gruppe im Fokus und können die gemeinsame Szenenzeit fortschreiben.',
  },
  {
    id: 'campaign',
    title: 'Kampagne als Arbeitsraum',
    text: 'Lege eine Kampagne an oder übernimm eine v4-Dungeondatei als neue Kampagne. Der Import zeigt seine Grenzen vor der Übernahme; die Quelldatei bleibt unverändert. „Name ändern“ aktualisiert nur die geöffnete Kampagne und behält ihre Identität und Inhalte.',
  },
  {
    id: 'campaign-transfer',
    title: 'Kampagnen vollständig übertragen und löschen',
    text: 'Unter „Verwalten / Transfer“ exportierst du die geöffnete Kampagne mit Karten, Bildern, lokalen Audiodateien und wiederaufnehmbarem Arbeitsstand oder legst eine unabhängige Kopie an. Vor einem Import vergleichst und entscheidest du Konflikte gemeinsamer Definitionen. Der Papierkorb bleibt wiederherstellbar; dauerhaftes Löschen ist eine getrennte, ausdrücklich bestätigte Aktion.',
  },
  {
    id: 'drawing-and-key',
    title: 'Raum und Key zusammen bearbeiten',
    text: 'Suche nach Raumname, Nummer oder Keytext. Ziehe Eckpunkte oder gib Meterkoordinaten ein. Der Text bleibt daneben bearbeitbar. Geschosse werden getrennt angezeigt. Gezeichnete Konturen sind noch keine physischen 3D-Räume. Mittlere Maustaste verschiebt die Karte, das Mausrad zoomt am Zeiger. Auswahl, Bearbeitung und Layoutwechsel behalten den Ausschnitt; Einpassen und Übersicht sind ausdrückliche Kamerabefehle. Derselbe passive Kamerakern dient der Hexkarte. Wenn Zeichnen fehlschlägt, bleiben Daten und Navigation erhalten; Karte erneut zeichnen ersetzt nur die Darstellung.',
  },
  {
    id: 'saving',
    title: 'Automatisch speichern und Arbeit wieder aufnehmen',
    text: 'Gültige Eingaben werden nach kurzer Pause gespeichert. „Gespeichert“ bestätigt den Autorenstand. Ungültige Raumtexte bleiben beim Kampagnenwechsel oder Schließen als Arbeitsentwurf erhalten. Nach Schreibfehlern zuerst den Speicherstatus prüfen. Rückgängig und Wiederholen ändern Kontur und Key gemeinsam.',
  },
  {
    id: 'adventuring-day',
    title: 'Tagesbudget und Level-Prognose immer griffbereit',
    text: '„Rastbudget“ in der Kopfleiste zeigt den aktuellen Verbrauch der aktiven Party. Öffne den Rechner für Tagesbudget, Rastschwellen und Encounter-Schwierigkeiten. „XP → Tage“ zeigt Etappen und prognostizierte Level. Für Kämpfe kannst du Tagesbelastung und XP-Verdienst getrennt rechnen. „Aktive Party“ nutzt bestätigte XP; eigene Zeilen und „Leeren“ verändern nur die Vorschau. „Heute“ zeigt die tatsächlichen individuellen Rastmarken, auch nach frühen kurzen Rasten. Im aktiven XP-Modus zeigt „Ab jetzt“ zusätzliche Belastung ohne Rasten oder Levelwechsel; unbekannte Raststände sind als Teilbasis markiert. Das separate Tagesmodell beginnt bei einer frischen langen Rast. „Party / Rasten öffnen“ führt direkt zur Party mit den bestätigten Rastaktionen der Gruppe im Fokus. Unter „Tagesplan aus Encounter-Vorlagen“ stellst du gespeicherte Begegnungen mit Wiederholungen und Reihenfolge zusammen. Der Rechner verwendet deine aktuelle Rechnerparty, trennt angepasste Belastungs-XP und Basis-XP als Verdienst und rundet jede Begegnung einzeln auf. Geänderte Vorlagen über „Vorlagen aktualisieren“ ausdrücklich neu übernehmen. Beim Ausschalten kehren deine manuellen XP-Eingaben zurück. Deine Eingaben bleiben pro Kampagne auf diesem Gerät auch nach Neustart erhalten. Unter „Rastmarken“ siehst du die genaue Wiederholung, an der bekannte Figuren eine Rast brauchen. „Hier kurze/lange Rast einplanen“ teilt die Wiederholungszeile und setzt die Pause vor den Rest; anschließend wird neu gerechnet. Die Summe der Begegnungen und XP bleibt erhalten. Es wird keine echte Rast gebucht. Große Zeiträume bleiben als zusammengefasste Etappen lesbar. Nächste Levelmarken verwenden bei aktiven Figuren ihre tatsächlichen XP. „Verdienst bis Level … einsetzen“ ersetzt nur den geplanten Gruppenverdienst und schaltet die getrennte Verdienstrechnung ein; Tagesbelastung, Party und bestätigte XP bleiben erhalten. Erreichte Levelmarken stehen in einer eigenen Verdienst-Zeitleiste. Im Encounter-Tagesplan werden die passenden Planzeilen genannt und freie Zielwerte sind gesperrt.',
  },
  {
    id: 'scene-rest',
    title: 'Rast am laufenden Spieltisch',
    text: 'Wähle unter einer Partyfigur „Mit der Gruppe rasten“ die beteiligten Figuren. Passe die Dauer an und bestätige eine kurze oder lange Rast. Uhr, Rastbudget und freigegebene Weltfolgen werden gemeinsam fortgeschrieben. Lange Rasten können bekannte Figuren mit positiven HP vollständig heilen; 0 HP, unbekannte HP, temporäre HP und Zustände bleiben erhalten. Ohne Zeitoption korrigierst du nur das Rastbudget. Laufende Kämpfe oder Verfolgungen zuerst abschließen. Die Chronik hält Dauer, Gruppe und HP-Wirkung fest.',
  },
  {
    id: 'magic-pools',
    title: 'Gezielte und abwechslungsreiche Magiebeute',
    text: 'Öffne in der Spielabendplanung „Magiebeute für diesen Spielabend auswählen“, suche im Katalog und wähle passende Gegenstände. Die Auswahl aktiviert den Seltenheitsausgleich. Vorschläge bleiben in diesem Pool, auch nach Beute-Neugenerierung und Neustart. Fehlende Seltenheiten werden als offene Kontingente gemeldet. Der Pool behält die gewählten Gegenstandsversionen. Ohne eigenen Pool verwendet der Generator den aktiven Katalog. Größere Kontingente werden auf verschiedene Definitionen verteilt; einzelne Vorschläge kannst du weiter manuell bearbeiten.',
  },
  {
    id: 'required-opponents',
    title: 'Einen Gegner verbindlich einplanen',
    text: 'Öffne im Encounter-Generator oder Spielabend „Verbindliche NPC-Gegner“, suche einen aktiven feindlichen NPC mit Statblock und wähle ihn aus. Der Generator rechnet seinen XP-Beitrag vor der Ergänzung anderer Gegner ein. Monsterfilter und Tabellen gelten für die Ergänzung. Jeder gesetzte NPC behält seine Identität und einen eigenen Initiativeplatz. Ein Spielabend verteilt die gesetzten Gegner einmal auf ihre gewählten Orte; ohne Orte auf unterschiedliche Szenen. Vorschau, Übernahme und einzelne Neugenerierung bleiben getrennte Schritte.',
  },
  {
    id: 'world-notes',
    title: 'Weltwissen wiederfinden',
    text: 'Unter „Welt und Spielabend“ legst du NSCs, Fraktionen, Quests und Gerüchte an. Vorlesetext und GM-Notizen sind getrennte Felder. Die Suche findet auch GM-Notizen. Der Papierkorb hält Einträge für eine Wiederherstellung vor.',
  },
  {
    id: 'preparation-recovery',
    title: 'Offene Vorbereitung sicher wiederaufnehmen',
    text: 'Gültige Änderungen an Weltwissen, Orten und dem manuellen Plan werden nach kurzer Pause gespeichert. Ein ungeklärter Schreibausgang sperrt weitere Änderungen: „Speicherstatus der Vorbereitung prüfen“ klärt zuerst den ursprünglichen Auftrag und bewahrt den offenen Entwurf. „Entwurf verwerfen und aktualisieren“ verwirft nur den betroffenen Arbeitsstand. Wiederaufgenommene Entwürfe sind noch kein bestätigter Autorenstand. Spielabendprofil und Besuchsdetails besitzen ihren eigenen Speicherweg und müssen bei ungültigen Eingaben vor dem Wechsel abgeschlossen werden.',
  },
  {
    id: 'manual-planning',
    title: 'Eine Szenenfolge vorbereiten',
    text: 'Wähle unter Welt und Spielabend „Spielabend planen“. Lege einen Plan an, füge Szenen hinzu und verschiebe sie in der Reihenfolge. Notizen und Reihenfolge bleiben nach Neustart erhalten. Ein Plan braucht weder Party noch Ort. Er erzeugt noch keine LiveSession.',
  },
  {
    id: 'session-generation',
    title: 'Spielabendvorschläge mit bindenden Vorgaben erzeugen',
    text: 'Wähle „Spielabend planen“ und öffne „Vorschläge für diesen Spielabend“. Trage Level und Anzahl der geplanten Figuren sowie Szenenzahl und Tagesanteil ein. Freie Zeilen lassen sich wieder entfernen; die Gruppe am Spieltisch bleibt unabhängig. Beuteausgleich, Weltquellen und verbindliche Inhalte kannst du bei Bedarf aufklappen. Der Ledger-Ausgleich wird ausdrücklich eingeschaltet und braucht bekannte XP einzelner Roster-Figuren. Ausgewählte Orte, Weltinhalte und Encounter-Tabellen sind bindend; ein nicht erfüllbarer Auftrag bleibt mit Erklärung gesperrt. Vorschauen sind gespeichert und reproduzierbar. Anzahl, Stärkeverteilung und Vielfalt kannst du als Vorlieben setzen; die Spielabendplanung nutzt sonst die aktuellen Presetvorgaben. Unter „Komposition und Zielabweichungen“ siehst du CR-Blöcke, Kreaturen, Statblocks, Initiativeplätze und Zielabweichungen. Vorlieben sind keine Garantie gegen bindende Rollen und Quellen. Dieselben Vorgaben öffnen bei unveränderten Quellen die bestehende Vorschau mit deinen Bearbeitungen. Für einen weiteren Entwurf wähle „Neuer Seed“. Unter „Gespeicherte Berechnungsgrundlage“ siehst du Regeln, Katalog und ursprüngliche Belohnungen. Du kannst einzelne Ergebnisse annehmen oder neu erzeugen, ohne andere angenommene oder manuelle Inhalte zu ersetzen.',
  },
  {
    id: 'locations',
    title: 'Orte, Szenen und Karten verbinden',
    text: 'Unter „Orte“ legst du einen Ort oder eine Stadt mit eigenen Abschnitten an. Verknüpfe eine vorhandene Dungeonzeichnung und wähle denselben Ort in einer Szene. „Ort öffnen“ führt zu den Notizen, „Karte öffnen“ zur Zeichnung. Ein Ort darf auch unverortet und ohne Karte bestehen. Die Zuordnung erzeugt keine Reise oder LiveSession.',
  },
  {
    id: 'relationships',
    title: 'Beziehungen verfolgen',
    text: 'Verknüpfe einen Wissenseintrag mit einem NSC, einer Fraktion, Quest oder einem Gerücht und benenne die Beziehung. Die Schaltfläche öffnet das Ziel; eingehende Verweise führen zurück zur Quelle. Ein Ziel im Papierkorb bleibt als solches sichtbar, statt den Verweis zu löschen.',
  },
  {
    id: 'live-party',
    title: 'Party und laufender Spielabend',
    text: 'Unter „Party und Leiten“ fügt „Neue Figur…“ eine Figur wahlweise direkt zur angezeigten heutigen Gruppe oder nur zum Roster hinzu. Nach dem Aktivieren kannst du ihre HP direkt eintragen. Profilwerte bleiben optional. Vorhandene Gruppen öffnen sich direkt. „Gruppe am Spieltisch öffnen“ legt die erste Gruppe ausdrücklich an. Übernimm einen vorbereiteten Besuch nach Vorschau und bearbeite seine Inhalte während des Spiels weiter. Vorbereitung und Herkunft bleiben erhalten; der nächste Besuch benutzt dieselbe Scene und Uhr. Nach Neustart öffnet sich der zuletzt benutzte Arbeitsbereich samt Scrollposition. Eine vorhandene Szene ist direkt benutzbar; „Spielabend beginnen“ bleibt eine eigene ausdrückliche Aktion.',
  },
  {
    id: 'live-recovery',
    title: 'Offene Live-Eingaben sicher klären',
    text: 'Scene- und Figurenänderungen werden nach kurzer Pause gespeichert; „Eingabe abschließen“ versucht offene gültige Werte sofort zu übernehmen. Bleibt der Ausgang eines Schreibauftrags unklar, sperrt die Sitzung weitere Änderungen. „Speicherstatus der Sitzung prüfen“ klärt genau diesen Auftrag und lässt einen konkurrierenden Entwurf offen. „Entwurf verwerfen und aktualisieren“ lädt ausdrücklich den gespeicherten Sitzungsstand und verwirft offene Scene- und Figureneingaben.',
  },
  {
    id: 'scene-desk',
    title: 'Kampagnenwissen an der Scene bearbeiten',
    text: 'Der Szenentisch folgt der fokussierten Gruppe. „Am Ort“ zeigt ortsanwesende NSCs, ortsgebundene Aufträge und Gerüchte sowie verknüpfte Fraktionen. Öffnen erlaubt das Bearbeiten direkt am Tisch; Anheften behält einen Eintrag auch beim Ortswechsel. Shops ortsanwesender NSCs erscheinen am aktuellen Ort, auch ohne vorbereitete Figurengruppe. Aktualisieren liest die bestätigten Ortsbindungen neu; es erzeugt keine Inhalte und beginnt keinen Kampf. Suche Weltwissen, Gegenstände, Kreaturen oder Encountervorlagen und hefte passende Treffer an diese Scene. Für einen neuen NPC, eine Fraktion, Quest, ein Gerücht oder einen Ort genügt der Name. „An diese Szene heften“ ist vorbelegt und kann vor dem Anlegen abgewählt werden. Quest-Mitwirkende bleiben leer, bis du die aktuelle Gruppe ausdrücklich auswählst. Die Eingabe bleibt je Gruppe auch nach Neustart erhalten. Bei unklarer Antwort prüft „Originalauftrag prüfen“ den gespeicherten Auftrag, bevor du erneut anlegst. Inhalt, Queststatus und gewählte Szenenbindung werden gemeinsam bestätigt. Weltwissen und Orte kannst du direkt bearbeiten; diese Inhalte bleiben kampagnenweit gemeinsam, während die Auswahl am Szenentisch gruppenspezifisch ist. Vor einem Inhaltswechsel wird eine gültige Eingabe gespeichert; ein wiederaufgenommener Entwurf wird sichtbar gemeldet. Kreaturen und Encounter gehen erst über ihre eigene Schaltfläche in eine Kampfmaske.',
  },
  {
    id: 'plan-replacement',
    title: 'Einen neuen Abend aus vorhandener Vorbereitung bauen',
    text: 'Plan ersetzen / wiederverwenden öffnet eine Vorschau. Wähle eine leere Timeline oder einen vorhandenen Plan und übernimm auf Wunsch dessen Planungsparty und Adventure Day. Besuche und noch nicht angenommene Gruppen werden als neue Vorbereitung kopiert. Platzierte Gruppen und Schätze behalten ihre Identität; bereits vergebene Besuchsbelohnungen bleiben abgeschlossen. Der bisherige Plan verliert seine Timeline und Vorschläge, während laufende Scenes ihre übernommenen Inhalte behalten. Timeline leeren verwendet denselben Ablauf ohne Vorlage und behält den Plannamen und die Planungsparty.',
  },
  {
    id: 'multiple-encounters',
    title: 'Mehrere Begegnungen in derselben Scene',
    text: 'Weitere Begegnung bleibt auch während eines offenen Kampfes verfügbar. Wähle die gewünschte Begegnung im Auswahlfeld; jede führt ihre eigene Initiative, Runden und ihr Ergebnis. Eine Figur darf an mehreren Begegnungen teilnehmen. HP und Zustände werden zwischen diesen Masken geteilt. Änderungen aus einer anderen Maske machen ältere Rückgängig-Schritte ungültig; ein Hinweis erklärt das. Beim Verschieben oder Deaktivieren eines PCs wird er aus allen offenen Begegnungen und Verfolgungen entfernt. Sein HP-Stand und die bisherigen Masken bleiben erhalten.',
  },
  {
    id: 'magic-guidance',
    title: 'Magiebeute für den Spielabend',
    text: 'Der zusätzliche magische Beuteausgleich vergleicht bestätigte XP mit bereits erhaltenen Gegenständen nach Seltenheit. Käufe und Weitergaben zählen nicht erneut. Münzbeute und magische Kontingente werden getrennt berechnet; unbekannte Magiepreise blockieren diesen Modus nicht. Neue Kontingente werden einmal für den ganzen Abend kaufmännisch gerundet und auf Szenen verteilt. Der Katalog ergänzt konkrete Gegenstände, fehlende Seltenheiten bleiben als offen sichtbar. Unter Inhalte und Belohnung bearbeiten ergänzt du Kataloggegenstände mit ihrer Definition oder bearbeitest ausdrücklich einen eigenen freien Eintrag. Beute neu erzeugen hält die gespeicherten Ziele auch ohne Beutetabelle ein. Vorschau und Bearbeitung vergeben nichts automatisch.',
  },
  {
    id: 'mixed-opponents',
    title: 'Benannte Gegner mit einer Eskorte',
    text: 'Der gemischte Modus bevorzugt vorhandene feindliche NPCs, wenn ihr Kreaturtyp in der gewählten Begegnung vorkommt. Die übrige Menge entsteht aus den Tabellen. Benannte Gegner verbrauchen Plätze derselben Bestandsgrenze; sie werden nicht zusätzlich auf die Menge aufgeschlagen. Ort, Fraktion und Katalogfilter gelten weiter. Vorschläge zeigen die Namen plus die noch unbenannte Menge. Beim Platzieren oder Leiten entstehen neue Weltfiguren nur für diese übrige Menge. Benannte Gegner behalten ihren aktuellen Zustand. Nur NPCs bleibt ein eigener Modus ohne neue Tabellengegner.',
  },
  {
    id: 'npc-generation',
    title: 'Benannte Gegner für den Spielabend',
    text: 'In Encounter- und Spielabend-Vorschauen wählt Vorhandene feindliche NPCs die tatsächlichen Weltfiguren. Sie benötigen einen Statblock, positive HP und eine feindliche Haltung. Ort, Fraktion und Katalogfilter begrenzen die Auswahl; optionale Tabellen begrenzen die Kreaturtypen. Jeder NPC erscheint pro Begegnung höchstens einmal. Die Vorschau verändert weder Standort noch HP. Beim Leiten werden dieselben Figuren mit ihrem aktuellen Zustand geöffnet, keine Kopien. Figuren an einem anderen Ort müssen zuvor ausdrücklich umplatziert werden. Der Katalogmodus bleibt für neue Monstergruppen verfügbar.',
  },
  {
    id: 'prepared-groups',
    title: 'Monstergruppen dauerhaft vorbereiten',
    text: 'Unter Monstergruppen suchst du gespeicherte Gruppen oder legst eine leere Gruppe beziehungsweise eine Kopie einer Encounter-Vorlage an. Die Vorlage liefert den Ausgangsstand; danach besitzt jede Weltfigur ihre eigene Identität. Ergänze Figuren aus dem Katalog, bearbeite Namen, HP, Zustände und Notizen und wähle einen Standort. Offene Eingaben bleiben als gruppengebundener Entwurf erhalten. „Gruppenangaben übernehmen“ bestätigt den Weltinhalt; „Gespeicherten Stand laden“ verwirft nur diesen Entwurf. Aus Gruppe entfernen erhält die NPC-Figur und ihren Verlauf. Am aktuellen Szenenort wählst du die gewünschten Figuren vor „Begegnung vorbereiten“; das startet noch keine Kampfrunden.',
  },
  {
    id: 'treasury',
    title: 'Schätze bearbeiten und verschieben',
    text: 'Unter Schätze bearbeitest du den unverteilten Rest, setzt einen Standort und ergänzt Kataloggegenstände. Bereits vergebene Mengen bleiben im persönlichen Ledger erhalten. Schatzangaben übernehmen bestätigt gültige Eingaben; erst danach kannst du Teilmengen verschieben oder vergeben. Ein angefangener Entwurf bleibt nach Neustart verfügbar. Am aktuellen Szenenort öffnet Schatz öffnen und zuweisen den platzierten Fund, ohne Beute automatisch zu vergeben.',
  },
  {
    id: 'groups',
    title: 'Partygruppen führen',
    text: '„Gruppe im Fokus“ wählt die Gruppe, deren Inhalte und Uhr du bearbeitest. Unter „Party aufteilen / zusammenführen“ wählst du Figuren und eine neue oder bestehende Zielgruppe. Eine neue Gruppe beginnt am Ort und Zeitpunkt der Ausgangsgruppe und besitzt danach eine eigene Uhr. Eine bestehende Zielgruppe behält ihre Inhalte und Uhr; prüfe den angezeigten Zeitpunkt vor der Übernahme. Leere frühere Gruppen findest du im Archiv zum Nachlesen.',
  },
  {
    id: 'relative-time',
    title: 'Zeit einer Gruppe fortsetzen',
    text: 'Unter „Zeit verstreichen lassen“ wählst du eine positive ganze Dauer in Sekunden, Minuten, Stunden oder Tagen. „Danach“ zeigt den Zeitpunkt vor der Bestätigung. Die Uhr der gewählten Gruppe wird gespeichert, andere Gruppenuhren bleiben unabhängig. Die Anzeige zählt seit Kampagnenbeginn; Fantasykalender, Reise und automatische Weltfolgen werden erst mit ihren jeweiligen Funktionen verbunden.',
  },
  {
    id: 'item-reference',
    title: 'SRD-Gegenstände lokal nachschlagen',
    text: 'Im gemeinsamen Katalog wechselt Gegenstände zur schreibgeschützten lokalen SRD-Referenz. Name, Kategorie, Unterkategorie, Seltenheit, Magie, Einstimmung und Preis grenzen die Treffer ein; Tabellenköpfe sortieren. Der Inspector zeigt Originalbeschreibung, Rüstungs- und Schadensangaben sowie Quellen. Nicht angegebene Preise sind keine Nullpreise. Der Import ist ausdrücklich unvollständig. Die Referenz verändert deinen Encounter-Entwurf nicht.',
  },
  {
    id: 'hex-access',
    title: 'Passierbare Hexrouten planen',
    text: 'Im Hexeditor legt Passierbarkeit für Reisen eine ausdrückliche Sperre oder benannte Voraussetzung wie Boot fest. Frei passierbar entfernt die Vorgabe. Die Karte markiert Sperren mit × und Voraussetzungen mit !. Ungezeichnetes Gelände bleibt passierbar. Vor der Routenauswertung bestätigst du vorhandene Voraussetzungen; dies verändert kein Inventar. Die Planung umgeht gesperrte Hexe und Ziele ohne Voraussetzung werden abgelehnt. Eine feste Enddauer hebt Sperren nicht auf. Änderungen an Karte oder Gruppe verlangen eine neue Auswertung; angenommene Voraussetzungen bleiben mit der Reise gespeichert. Administrative Platzierung ist weiterhin keine Reise.',
  },
  {
    id: 'encounter-catalog',
    title: 'Kreaturen finden und ausdrücklich verwenden',
    text: 'Unter „Katalog und Encounter“ filterst und sortierst du den lokalen SRD-Katalog und öffnest den vollständigen Statblock samt Quelle. Name, HG, Typ, Größe, RK, HP, Bewegung, Sinne, Resistenzen und Immunitäten lassen sich gemeinsam eingrenzen. Klick auf einen Gegner in einer Vorlage zeigt deren gespeicherten Statblock. Die Quellenzeile unterscheidet ihn vom heutigen Katalog. „Aktuellen Katalogstand ansehen“ und Vor-/Zurücknavigation wechseln nur die Leseansicht; die Vorlage bleibt erhalten. Anzahl und gemeinsame Initiative gelten erst bei „Zur Vorlage hinzufügen“ oder „Für aktuelle Gruppe vorbereiten“. Die erste Aktion ändert nur die geöffnete Vorlage; die zweite legt eine neue Kampfvorbereitung für die aktuelle Gruppe an und startet noch keine Initiative.',
  },
  {
    id: 'encounter-templates',
    title: 'Eine Encounter-Vorlage sicher vorbereiten',
    text: 'Lege eine wiederverwendbare Vorlage an, suche vorhandene Vorlagen und ergänze Kreaturen aus dem Katalog. Die Planungsparty dient nur Schwellen und Bewertung; „Aktuelle Party übernehmen“ kopiert ihren jetzigen Fortschrittsstand in die Vorbereitung. Gültige Eingaben werden automatisch gespeichert. Nach einem Schreibkonflikt bleibt der Entwurf gesperrt offen: Lade den gespeicherten Stand oder sichere ihn als unabhängige Kopie. Erst „Mit aktueller Gruppe vorbereiten“ erzeugt eine eigene Live-Maske; spätere Initiative, HP und Zustände verändern die Vorlage nicht.',
  },
  {
    id: 'encounter-tables',
    title: 'Eine Begegnungstabelle zusammenstellen',
    text: 'Öffne Katalog und Encounter und dann Begegnungstabellen und Generator. Neue Tabelle öffnet den Kreaturenkatalog neben deinem Entwurf. Benenne die Tabelle, wähle links Kreaturen und füge sie hinzu. Gewichte sind relative Häufigkeiten; die Chancen aktualisieren sich bei jeder Eingabe. Beschreibung, Bedingungen und Beute findest du im aufklappbaren Bereich. Speichern ist erst mit Namen, mindestens einer Kreatur und gültigen Gewichten möglich. Danach bleibt deine gespeicherte Tabelle zum Bearbeiten ausgewählt. Beim Generieren siehst du aktive Katalogfilter direkt am Auftrag und kannst sie dort zurücksetzen, ohne Tabellen, Umgebung oder Tageszeit zu ändern. Zur Planungsparty führt zur vorhandenen Encounter-Vorlage; Vorschläge für diese Party führt von dort wieder zum Auftrag. Berechnung und Fehler werden direkt bei Vorschläge erzeugen gemeldet; nach Filteränderungen erzeugst du eine neue Vorschau. Kampagnenweite Tabellen können Beute verknüpfen; installationsweite nicht. Offene Entwürfe speicherst du oder verwirfst sie ausdrücklich.',
  },
  {
    id: 'loot-tables',
    title: 'Beute reproduzierbar aus Tabellen würfeln',
    text: 'Beutetabellen kombinieren gewichtete Einträge mit Kategorie, Goldwert und Mengenbereich. Die Anzahl der Würfe und der Seed bestimmen ein reproduzierbares Ergebnis. „Auswürfeln und als unverteilte Beute anlegen“ erzeugt einen neuen Schatz, vergibt ihn aber an keine Figur. Verknüpfte Encounter-Vorschauen akzeptieren nur die darin festgehaltene Tabellenrevision; nach Änderung oder Papierkorb erzeugst du die Vorschau neu. Ungespeicherte Dialogeingaben werden beim Schließen nicht still verworfen.',
  },
  {
    id: 'generator-presets',
    title: 'Den Encounter-Generator kontrolliert konfigurieren',
    text: 'Das geschützte Systempreset bleibt lesbar und unveränderbar. Kopiere es für eigene Rollenmatrix, Mengen-, Mischungs-, Mob- und Schwierigkeitsregeln. Speichern legt die Presetversion an; erst „Dieser Kampagne zuweisen“ macht sie wirksam. Zurücksetzen übernimmt wieder die Systemwerte in den offenen eigenen Entwurf. Gespeicherte Vorschauen halten Preset-ID, Revision und Hash fest und werden durch spätere Presetänderungen nicht umgedeutet.',
  },
  {
    id: 'encounter-generation',
    title: 'Reproduzierbare Encounter-Vorschläge prüfen',
    text: 'Der Generator kombiniert die Planungsparty der geöffneten Vorlage mit Katalogfiltern, ausgewählten Tabellen, Weltkontext, Preset, Schwierigkeit und Seed. Er speichert die Vorschau samt Quellenrevisionen und zeigt XP, Zusammensetzung und Warnungen. Änderst du einen Eingang, ist die alte Vorschau nicht mehr übernehmbar; erzeuge sie neu. „Diesen Vorschlag als Vorlage übernehmen“ erstellt oder öffnet eine Encounter-Vorlage, aber weder Live-Maske noch Kampfbeginn. Frühere Vorschauen bleiben über ihre Historie prüfbar.',
  },
  {
    id: 'combat-rewards',
    title: 'Kampf, XP und Beute gemeinsam abschließen',
    text: 'Beim Kampfabschluss bestätigst du Ergebnis, XP-Pool, Empfänger und optionale Beute zusammen. Die Vorschau zeigt den aufgerundeten Anteil je ausgewählter Figur; „Keine XP“ bleibt eine ausdrückliche Wahl. Vorbereitete oder platzierte Beute wird dadurch nicht automatisch vergeben: Für jeden Posten wählst du den Empfänger. Spätere XP- und Beutekorrekturen ändern den aktuellen Stand und behalten den erklärenden Verlauf.',
  },
  {
    id: 'character-health',
    title: 'HP, Zustände und Todesrettungswürfe führen',
    text: 'Klicke am Spieltisch auf eine Partykarte für HP und Zustände. Von dort öffnet Profil und Fortschritt die vollständige Figur. Bei der ausgewählten Figur speicherst du aktuelle, maximale und temporäre HP, Zustände und Konzentration zusammen; ungespeicherte Eingaben bleiben als Entwurf stehen und sperren die schnellen Schaden-/Heilknöpfe. Bei 0 HP erscheinen Todesrettungswürfe mit Erfolgen, Fehlschlägen, natürlicher 1 und 20 sowie ausdrücklichem Stabilisieren, Tod und Zurücksetzen. Während eines Kampfes führst du diese Werte im Kampftracker; sein bestätigter Stand geht nach dem Abschluss zurück an die Figur.',
  },
  {
    id: 'character-progression',
    title: 'XP und Rastbudget nachvollziehbar ändern',
    text: 'Manuelle XP kannst du hinzufügen, abziehen oder auf einen Gesamtstand setzen und mit Grund sowie optionalem früherem Eintrag als Korrektur speichern. Level, nächste Schwelle und Rastbudget folgen dem aktuellen XP-Stand. Kurze und lange Rasten bestätigst du für die ausgewählten Figuren der fokussierten Gruppe; sie ändern das Belastungsbudget und auf Wunsch die gemeinsame Gruppenzeit. Bei einer langen Rast kann die ausdrückliche HP-Erholung bekannte Figuren mit positiven HP vollständig heilen; 0 HP, unbekannte HP, temporäre HP und Zustände bleiben erhalten. Der Fortschritts- und Beuteverlauf hält die bestätigten Änderungen fest.',
  },
  {
    id: 'personal-loot',
    title: 'Persönliche Beute mit Herkunft weiterführen',
    text: 'Weise unverteilte Beute ausdrücklich einer aktiven Figur zu oder erfasse einen persönlichen Eintrag als Belohnung, Kauf oder manuelle Herkunft. Suche und Filter zeigen erhaltene, verkaufte und weitergegebene Einträge; Verkäufe, Weitergaben und Mengenkorrekturen bewahren den früheren Stand im Verlauf. Mengenstapel kannst du teilen, passende Stapel zusammenführen oder an eine andere Figur übertragen. Interne Weitergaben und Käufe zählen nicht als neue erhaltene Kampagnenbeute; Münzen werden nicht automatisch gebucht.',
  },
  {
    id: 'chase',
    title: 'Eine Verfolgung über Runden führen',
    text: 'Im Livebereich startest du für die fokussierte Gruppe eine Verfolgung. Trage Verfolger und Flüchtende mit Tempo ein. Pro Runde hältst du relative Distanz, Erschöpfung und eine Komplikation fest. Der Stand bleibt nach Neustart erhalten; der ausdrückliche Abschluss schreibt das Ergebnis in die Kampagnenchronik.',
  },
  {
    id: 'chronicle',
    title: 'Momente festhalten und Kampagnenfolgen nachlesen',
    text: 'Unter „Party und Leiten“ hältst du einen Moment für die fokussierte Gruppe fest und kannst daraus zugleich eine offene Quest oder ein Gerücht vorbereiten. Ein Fokuswechsel bewahrt den Entwurf bei seiner Gruppe; neuere Eingaben werden nach einer langsamen Speicherantwort nicht gelöscht. Quest- und Gerüchtstreffer der Live-Suche zeigen ihren aktuellen Stand und öffnen ihre Verwaltung in der Vorbereitung. Die Kampagnenchronik ordnet bestätigte Kämpfe, Resultate, Belohnungen, Reisen, Partyänderungen und Weltfolgen zeitlich ein, lässt sie filtern und als Markdown ausgeben. Sie ersetzt kein vollständiges Kampagnenpaket.',
  },
  {
    id: 'session-recap',
    title: 'Einen Spielabend beginnen und mit Rückblick beenden',
    text: '„Spielabend beginnen“ setzt eine dauerhafte Markierung in der Kampagnenchronik. Danach zeigt der Rückblick die bestätigten Ereignisse seit diesem Beginn; bei mehr als zwölf Einträgen findest du den vollständigen Abschnitt in der Chronik. „Spielabend beenden“ speichert Abschlussnotiz und Übergabe für den nächsten Abend. „Nächsten Abend vorbereiten“ vergleicht fortbestehende Gruppen, Weltlage, Besuche, Aufträge, Masken und Beute; erst „Spielabend hier beginnen“ setzt den neuen Marker. Die Markierung folgt der ganzen Kampagne und teilt keine Partygruppen oder deren Uhren zusammen.',
  },
  {
    id: 'session-content',
    title: 'Spielabendinhalte und Vorschläge verwenden',
    text: 'Ein vorbereiteter Besuch kann Vorlesetext, Weltverweise, NPC-Gruppen und Beute enthalten. Gruppen und Schätze werden ausdrücklich am Ort platziert. Generierte Vorschläge bleiben Vorschläge, bis du einzelne Besuche annimmst. Beim Spielen übernimmt die Vorschau den ausgewählten Besuch in die fortbestehende Gruppe; platzierte NPCs behalten ihre Trefferpunkte.',
  },
  {
    id: 'item-definitions',
    title: 'Gegenstände als Definitionen pflegen',
    text: 'Suche und filtere den Gegenstandskatalog oder lege eine eigene Definition mit Beschreibung, Eigenschaften und optionalem Richtwert an. SRD-5.1-Einträge sind schreibgeschützt; „Eigene Kopie anlegen“ erzeugt eine bearbeitbare Definition. Papierkorb und spätere Änderungen betreffen ihre aktuelle Verwendung. Bereits aufgezeichnete Vergabe- und Handelswerte bleiben im Verlauf erhalten. Von einer Definition aus kannst du persönliche Beute, unverteilte Beute oder einen Shopbestand ausdrücklich anlegen.',
  },
  {
    id: 'items-trade',
    title: 'Shops, Bestand und Handel führen',
    text: 'Lege einen Shop für einen vorhandenen Ort oder NPC an und bestimme Bestand sowie Verkaufs- und Ankaufspreise. Bei einem Gegenstand ohne Richtwert bestätigst du die Shoppreise ausdrücklich. Käufe ändern Shopbestand und persönlichen Ledger zusammen; Verkäufe halten Menge und tatsächlichen Erlös fest. Münzen buchst du weiterhin am Charakterbogen. Einzelstücke werden nicht automatisch aufgefüllt. Andere Auffüllregeln folgen bestätigter Spielzeit; die Handels- und Auffüllhistorie zeigt ihre Wirkung.',
  },
  {
    id: 'atlas-hex',
    title: 'Eine Kampagnenwelt gemeinsam bearbeiten',
    text: 'Jede Kampagne besitzt genau einen Atlas. Unter Landschaft malst du Gelände auf der gewählten Hexstufe. Stadt hier anlegen verortet eine Stadt am zuletzt angeklickten Punkt. Straßen, Viertel, Bebauung und einzelne Häuser bearbeiten dieselbe Welt. Zoome mit dem Mausrad am Zeiger; die mittlere Maustaste verschiebt nur die Ansicht. Weltübersicht und Ort finden springen innerhalb dieser Karte. Rückgängig und Wiederholen gelten gemeinsam für Landschaft, Gebäude, Räume und ihre Texte.',
  },
  {
    id: 'travel-checkpoints',
    title: 'Eine Reise wirklich fortsetzen',
    text: 'Wähle Gruppe und Ziel und lass Route, Dauer und Ankunft anzeigen. Gelände, Tempo und Wetter wirken auf die Vorschau; eine vorgegebene Enddauer gewinnt. Mit der Annahme startet die Wiedergabe: 1× entspricht einer Echtsekunde je Spielstunde, −/+ wählen 1×, 2×, 5× oder 10×. Jeder erreichte Hex speichert Position und Gruppenzeit gemeinsam. Pause und Reise beenden halten die Wiedergabe an; ein bereits begonnener Speicherauftrag wird zuerst geklärt. Markierte Hinweise halten für deine Entscheidung an. Alternativ bestätigst du einzelne Abschnitte oder bis zur nächsten Grenze direkt. Nach Bereichswechsel oder Neustart bleibt die Wiedergabe am letzten bestätigten Hex pausiert; ▶ setzt sie ausdrücklich fort. Ankunft und Abbruch blenden die Route aus.',
  },
  {
    id: 'calendar-events',
    title: 'Kalender und örtliche Ereignisse',
    text: 'Bearbeite Monate, Tageslänge, Wochentage und erstes Jahr im Atlasbereich. Ein anderer Kalender deutet dieselben aufgezeichneten Zeitpunkte neu. Ereignisse können einmalig oder wiederkehrend und an einen Ort gebunden sein. Im Livebereich erscheinen die Ereignisse, die zur Zeit und zum Ort dieser Gruppe passen; narrative Folgen entscheidest du selbst.',
  },
  {
    id: 'weather-control',
    title: 'Wetter entwickeln und ausdrücklich vorgeben',
    text: 'Das Kartenklima und regionale Hexklimate liefern saisonales Wetter. Eigene Wettergebiete besitzen Zentrum, Größe, Bewegung, Dauer und Hinweise und können pausiert oder beendet werden. Wetter folgt bestätigter Gruppenzeit. Die Liveanzeige nennt Sicht und Reiseeffekte. Ein GM-Wetteroverride bleibt für diese Gruppe bestehen, bis du „Wetterautomatik freigeben“ wählst.',
  },
  {
    id: 'dungeon-tools',
    title: 'Innenräume auf derselben Karte zeichnen',
    text: 'Wähle eine Raumgruppe oder erzeuge ein Gebäude beziehungsweise einen Dungeon mit eingerichteten Räumen. Zeichne Raumrechtecke oder nutze unter Fachwerkzeuge freie Polygone, Höhlenpinsel, Türen, Licht und Ausstattung. Gebäuderäume behalten freie Meterkoordinaten. Hausbewegung und Skalierung führen gebundene Innenräume mit. Geschosse und Höhenschnitte ändern die Ansicht; Dächer lassen sich ausblenden. Raumtexte, Dungeon-Keys und gemeinsame Rücknahme gehören zu denselben Räumen. Ein Dungeonimport wird in die bestehende Kampagnenwelt eingefügt.',
  },
  {
    id: 'dungeon-structure',
    title: 'Dungeonstruktur, Inhalte und 3D-Verbindungen vertiefen',
    text: 'Die Schaltflächen über der Karte öffnen getrennte Werkzeuge für 3D-Volumen, Triggerfelder, platzierte Inhalte, Graphentwurf, Dungeon-Keys und Passagen. Graphänderungen bleiben in einer geschützten Arbeitskopie, bis du die Rastervorschau ausdrücklich übernimmst. Volumen und Paths verwenden Meter- und 5-Fuß-Höhen; bewegte Endpunkte schreiben bestehende Volumen nicht stillschweigend um. Inhalte und Trigger behalten ihre Besitzer und Anker oder werden sichtbar zur Neuzuordnung erhalten.',
  },
  {
    id: 'dungeon-volumes',
    title: 'Mit Pinsel und Flächen im 3D-Raster bauen',
    text: 'Wähle einen Raum und öffne „3D-Volumen“. Pinselzüge mit rundem oder quadratischem Radius, Rechtecke und Ellipsen bearbeiten Raumzellen, Boden, Decke, Wand und Wasser. Loslassen speichert den ganzen Zug unmittelbar; Escape verwirft die laufende Markierung, Rückgängig nimmt den gespeicherten Zug gemeinsam zurück. PageUp / PageDown wechselt während des Zugs den Höhenschnitt. Mausrad zoomt, die mittlere Maustaste verschiebt; „Volumen einpassen“ holt den Raum zurück. Ein genauer 3D-Rasterbereich bleibt bis „Bereichsvorschau übernehmen“ ungespeichert. Pro Zug sind 2000 Zellen möglich. Abgeteilte Volumen erhalten leere Räume, der bestpassende Teil behält den vorhandenen Key. Veraltete Vorschauen werden abgewiesen: verwerfen und den gespeicherten Stand neu laden.',
  },
  {
    id: 'dungeon-triggers',
    title: 'Triggerfelder und Fallenlaufzustand getrennt führen',
    text: 'Wähle eine Falle und zeichne unabhängige Triggerzellen über mehrere Volumen und Höhenschnitte. Das Feld kann eine Reise anhalten oder nur benachrichtigen; es verändert weder Begehbarkeit noch fiktionale Wirkung und verbraucht beim Betreten keine Charge. Speichere Feldgeometrie und Fallenregel getrennt. Maximum, Resetdauer und Startpolitik sind Autorenwerte. Aktuelle Charges und Countdown gehören zur fokussierten Scene: Nur eine bestätigte Aktivierung verbraucht eine Charge, null blockiert sie, weiterer Verbrauch startet den Countdown nicht neu und Reset lädt alle Charges. Autoren-Undo spult diesen Laufzustand nicht zurück.',
  },
  {
    id: 'dungeon-content',
    title: 'Dungeon-Inhalte an Volumen binden',
    text: 'Lege Encounter, Loot, Falle, Besonderheit oder Rätsel mit öffentlichem Text, privaten Hinweisen und einem relativen Voxelanker an. Encounter können eine Vorlage oder eine vorhandene NPC-Gruppe referenzieren; Loot verweist auf einen vorhandenen Schatz. Ein physischer Encounter oder Loot besitzt höchstens eine Dungeonplatzierung. Der Anker bewegt sich mit dem Raum. Geht seine Geometrie verloren, bleibt der Inhalt sichtbar zur Neuzuordnung erhalten. Suche kann den GM benachrichtigen; Gruppenkenntnis, NPC-Bindung, Kampf und Beute werden erst im Leitablauf ausdrücklich bestätigt.',
  },
  {
    id: 'dungeon-graph',
    title: 'Dungeonfluss in einer geschützten Vorschau planen',
    text: 'Der Graph zeigt Räume, Routen und ausdrücklich platzierte Inhalte in wählbaren Detail- und Heatmapansichten. Lege Räume an, verschiebe, kopiere oder löse sie, plane Verbindungen und verteile Dungeonbudgets in einer geschützten Arbeitskopie. „Zur Rastervorschau“ übersetzt den Entwurf in bearbeitbare Geometrie; erst „Graph- und Rastervorschau übernehmen“ ändert den bestätigten Autorenstand. „Ursprung vollständig wiederherstellen“ verwirft die ganze Grapharbeitskopie unabhängig von der normalen Undo-History. Veraltete Paths werden nur auf ausdrücklichen Auftrag neu übersetzt.',
  },
  {
    id: 'dungeon-keys',
    title: 'Dungeon-Keys, Vererbung und Ausgabe pflegen',
    text: 'Suche und filtere Räume und bearbeite Raum-, Dungeon-, Level-, Gruppen-, Vorlagen- oder Oberflächeninhalte. Vorlesetext, GM-Blöcke, Geheimnisse, Referenzen und beschreibende Attribute bleiben getrennt; lokale Werte können Vererbung ergänzen oder unterdrücken. Die Beschreibungsvorschau ändert keine Gruppenkenntnis. Gültige Einzeländerungen speichern automatisch, „Jetzt übernehmen“ schließt sie ab und „Gespeicherten Stand laden“ verwirft den offenen Entwurf. Eine Sammeländerung schreibt alle ausgewählten Räume als eine gemeinsame rückgängig machbare Aktion. Unter „Rauminhalte unabhängig auf andere Räume kopieren“ ist der geöffnete Raum die Quelle; markiere links die Ziele, wähle die Inhalte und prüfe die Vorschau. Ergänzen behält bestehende Inhalte, Ersetzen betrifft nur ausgewählte Teile. Vorlagen werden zu eigenständigen Blöcken; geerbte Attribute kannst du ausdrücklich als lokale Werte übernehmen. Kopien erhalten eigene Kennungen und keine Entdeckungen. Änderungen an Quelle, Vorlagen oder Zielen verlangen eine neue Vorschau. Öffentliche SVG-, Markdown-, Dokument- und Dungeondatenausgaben lassen geheime Autoreninhalte aus; die Dungeondaten enthalten keinen bestätigten Fallenlaufzustand.',
  },
  {
    id: 'dungeon-paths',
    title: '3D-Paths und gerichtete Passagen verbinden',
    text: 'Wähle zwei Räume mit Volumen, setze bei Bedarf gepinnte 5-Fuß-Anker und ergänze Wegpunkte, Form, Breite, Höhe und Zeitfaktor. „Verbindung vorschlagen“ zeigt Route, Endhöhen und Volumen, ohne sie zu speichern. Erst „Vorschau übernehmen“ schreibt Pfadvolumen und beide Passagen gemeinsam. Bewegte Endpunkte ändern vorhandene Volumen nicht stillschweigend. Jede Passagenseite besitzt eigene Beschreibung, Zusatzzeit, Ziel sowie Begehbarkeit und Sicht-, Licht- und Schallübertragung; übernimm beide Richtungen getrennt. Offene Eingaben lassen sich gezielt verwerfen, und gelöste Passagen bleiben zur Wiederzuordnung erhalten.',
  },
  {
    id: 'live-rules',
    title: 'Regelreferenzen und Proben bei der Gruppe halten',
    text: 'Im Livebereich suchst du Regelnotizen und heftest einen eingefrorenen Stand an die fokussierte Gruppe. Eine geänderte oder fehlende Quelle überschreibt ihn nicht; Aktualisieren bleibt ausdrücklich. Schnelle d20-Proben und Statblockformeln werden mit Wurfart, Modifikator, optionalem SG oder RK und Scene-Zeit bei dieser Gruppe protokolliert. Ein unbekannter SG bewahrt ein offenes Ergebnis statt Erfolg oder Fehlschlag zu erfinden.',
  },
  {
    id: 'npc-autonomy',
    title: 'NPCs mit begrenztem Verhalten beauftragen',
    text: 'Unter NPC-Verhalten aktivierst du bestehende Figuren oder Gruppen. Bedürfnisse, Rollen und Prioritäten wählen gültige Jobangebote. Lege erreichbare Ortswege und exklusive Angebote an. Nur bestätigte Gruppen-/Reisezeit zählt; ausstehende Intervalle behalten ihre damaligen Regeln. Bestätigte Zeit nachholen arbeitet in kurzen atomaren Schritten. Partygefahr hält vor einer Wirkung an; der Verlauf erklärt Auswahl, Ausschlüsse und GM-Entscheidungen.',
  },
  {
    id: 'player-cues',
    title: 'Inhalte am Spieltisch ausdrücklich freigeben',
    text: 'Die Schaltflächen neben der laufenden Scene zeigen das aktuelle Ortsbild, ein gewähltes NPC-Porträt oder ein spontanes Bild-Handout für die geprüfte Gruppe. Vorlesetext und GM-Notizen bleiben im GM-Arbeitsraum. Beim ersten Bild wählst du eine lokale Datei; danach reicht die ausdrückliche Freigabe. „Live-Automatik“ kehrt zur fokussierten Karte oder zum aktuellen Ortsbild zurück. Ein inzwischen geänderter Gruppenfokus stoppt die Freigabe. „Anzeige leeren“ blendet nur das Fenster aus; GM-Notizen und Charakterkenntnis werden nicht mitgesendet oder verändert.',
  },
  {
    id: 'player-display',
    title: 'Kenntnis und aktuelle Sicht der Gruppe trennen',
    text: 'Spieleranzeige öffnet eine schreibgeschützte Vorschau und ein Fenster auf dem gewählten Bildschirm. Entdecken und Vergessen ändern dauerhafte Karten- und Ortskenntnis nur für die ausgewählten Figuren; Sichtweite, Dunkelsicht und Augenhöhe bestimmen dagegen die momentane Sicht. Die Ausgabe vereinigt ausschließlich die fokussierte Gruppe und filtert sie zusätzlich mit Licht, Wetter, Höhe und Sichtmasken. Öffentliche Beschriftungen bleiben von GM-Texten getrennt. Ausblenden, Schließen und ein Bildoverride verändern weder Kenntnis noch aktuelle Weltwahrheit.',
  },
  {
    id: 'extensions',
    title: 'Lokale Erweiterungspakete kontrollieren',
    text: 'Unter „Erweiterungen“ prüfst du ein lokales Paket und bestätigst genau die angezeigten Rechte. Widerrufen entfernt die Rechte; Entfernen löscht zusätzlich den gespeicherten Paketcode, bewahrt aber kampagneneigene Zusatzdaten. Ein unklarer früherer Auftrag sperrt neue Änderungen, bis der aktuelle Installationsstand vollständig gelesen und der beschädigte Vermerk ausdrücklich gesichert wurde. Erweiterungscode wird in diesem Produktstand noch nicht ausgeführt.',
  },
  {
    id: 'city-infill',
    title: 'Eine Stadt im Atlas aufbauen',
    text: 'Wähle im Atlas einen Punkt, gib der Stadt einen Namen und lege sie dort an. Unter Fachwerkzeuge und Details zeichnest du Straßen, Viertel, Wasser und Plätze; Bebauung vorschlagen füllt dein Viertel mit Häusern. Geschützte Häuser bleiben bei neuer Bebauung erhalten. Jedes neue Haus enthält passende Räume, Türen und Einrichtung. Hineinzoomen zeigt dieselben editierbaren Räume.',
  },
  {
    id: 'city-regeneration',
    title: 'Ein Viertel mit geschützter Vorschau bebauen',
    text: 'Wähle ein Viertel und lege Seed, Dichte, Hausgröße, Straßenabstand und Nutzung fest. „Bebauung vorschlagen“ berechnet Häuser gegen die aktuelle Stadtrevision, schreibt aber noch nichts. Geänderte Vorgaben oder „Vorschau abbrechen/verwerfen“ entfernen nur die Vorschau. Erst „Bebauung übernehmen“ ersetzt die ungeschützten generierten Häuser dieses Viertels in einer gemeinsamen rückgängig machbaren Änderung. Manuell angelegte oder bearbeitete und ausdrücklich geschützte Häuser bleiben erhalten. Unberührte generierte Räume verhindern keine Regeneration. Hat sich die Stadt seit der Vorschau verändert, musst du sie neu erzeugen.',
  },
  {
    id: 'city-buildings',
    title: 'Häuser, Haushalte und Berufe binden',
    text: 'Wähle ein Haus, suche vorhandene World-NPCs und markiere „Wohnt hier“ oder „Arbeitet hier“. Ein NPC besitzt kampagnenweit je einen bestätigten Wohnort und Arbeitsplatz. Gruppiere Bewohner in benannten Haushalten und Beschäftigte in benannten Berufen; jede Person gehört höchstens einem Datensatz der jeweiligen Art. Ein Umzug in ein anderes Haus derselben oder einer anderen Stadt verschiebt Haushalt samt Wohnorten oder Beruf samt Arbeitsplätzen gemeinsam in einem rückgängig machbaren Schritt. Auflösen entfernt nur den Haushalt oder Beruf und bewahrt NPCs sowie Wohn- oder Arbeitsorte. „Beziehungen öffnen“ zeigt für genau diesen NPC den kanonischen World-Graphen mit gerichteten ein- und ausgehenden Beziehungen. Dort lassen sich zwei ausdrücklich benannte Gegenrichtungen als atomisches Paar speichern, gemeinsam lösen und über die eigene Paar-History rückgängig machen oder wiederholen; diese Änderungen gehören weiterhin nicht zur Stadt-History. Elternteil/Kind, Geschwister und Partner werden nur durch eine ausdrückliche Typwahl zur Familie und erscheinen dann in der Familienansicht. Freie Bezeichnungen werden nicht umgedeutet. Im NPC-Weltprofil lassen sich Herkunft/Spezies, Geschlecht und Alter ausdrücklich pflegen. „Bevölkerung und Demografie“ zählt genau diese Angaben für bestätigte Bewohner; Haushalt, Beruf, Name und freie Notizen werden nicht gedeutet. Spätere Änderungen an einer beteiligten World-Notiz sperren den Historyschritt, statt Texte oder andere Beziehungen zu überschreiben. Aktuelle NPC-Position, Autonomy und Zeit bleiben außerhalb der Stadt. Häuser und Viertel können auf eine vorhandene World-Fraktion verweisen; dieselbe Auswahl filtert die NPC-Suche. „Fraktionen in der Stadt“ zählt Bewohner, Beschäftigte sowie gebundene Häuser oder Viertel je kanonischer Fraktion. Eine archivierte Fraktion bleibt lesbar markiert, kann aber nicht neu gewählt werden. Fraktionsgebundene Elemente bleiben vor Regeneration geschützt. Regierung, Wachen, Fraktionswirkungen, Verteilungen für neue Bewohner, Religion und Lebensstandard bleiben offen. Gültige Hauseingaben speichern nach kurzer Pause und schützen bearbeitete Häuser vor Regeneration. SVG und Stadtdaten geben den bestätigten Stadtstand aus.',
  },
  {
    id: 'city-life-moves',
    title: 'Familien und Werkstätten gemeinsam umziehen',
    text: 'Im Hausinspektor hat jeder Haushalt Haushalt umziehen und jeder Beruf Berufsgruppe umziehen. Suche ein Zielhaus in einer beliebigen Stadt. Die Bestätigung nennt Quelle, Ziel und sämtliche Mitglieder; Abbrechen ändert nichts. Gemeinsam umziehen übernimmt den vollständigen benannten Eintrag mit gleicher Kennung und allen Mitgliedern. Andere Bewohner, Berufe und Hausnotizen bleiben bestehen. Rückgängig und Wiederholen wirken auf beide Städte. Aktuelle NSC-Positionen, HP und Gruppenzeit ändern sich nicht.',
  },
  {
    id: 'npc-daily-plans',
    title: 'NSC-Tagesabläufe am Spieltisch lesen',
    text: 'Im Weltprofil unter Täglicher Ablauf fügst du Aktivitäten mit Beginn, Ende, Bezeichnung, Wohnhaus/Arbeitsplatz, festem Kampagnenort oder frei beschriebenem Ziel hinzu. Ein Ende vor dem Beginn geht über Mitternacht. Die Stunden folgen der Länge des Kampagnentags; Überlappungen werden beim Übernehmen abgewiesen. Unvollständige Eingaben bleiben als Profilentwurf erhalten. NPC übernehmen bestätigt den Plan. Unter NSCs am Spieltisch liest das Dossier anhand der Gruppenzeit die geplante Aktivität, das aktuelle Ziel und den nächsten Beginn. Wohnorte, Arbeit und Tagesziel öffnet die bestehenden Schauplätze. Stand aktualisieren liest eine fortgeschrittene Gruppenzeit neu. Pläne bewegen keine NPCs, ändern keine HP und aktivieren keine Autonomie. Unter Wochenplan wählst du für jede Aktivität alle oder bestimmte Wochentage; maßgeblich ist der Tag ihres Beginns. Datumsausnahmen ersetzen den vollständigen Kampagnentag, einschließlich Resten aus der vorherigen Nacht. Kampagnentag 1 ist der erste Kalendertag. Eine leere Ausnahme ist ein Ruhetag, eine Ausnahme mit Aktivitäten ein besonderer Tagesablauf. Entfernen stellt den normalen Wochenplan wieder her. Das Dossier zeigt Wochentag, Ausnahme und den nächsten vollständigen Beginn.',
  },
  {
    id: 'city-activities',
    title: 'Eine Stadt zur Gruppenzeit leiten',
    text: 'Stadt am Spieltisch liest die bestätigten Bewohner und Beschäftigten der gewählten Stadt. Wähle eine bestehende Gruppenuhr; diese Auswahl ändert weder Fokus noch Zeit. Suche nach NSC, Aktivität oder Tagesausnahme. Nur ausgewähltes Haus beschränkt die Liste auf dessen Wohn-/Arbeitsbindungen. Je 40 NSC zeigen geplante Aktivität, Zielhaus, nächsten Beginn und aktuellen Standort getrennt. Haus-Schaltflächen öffnen den frischen Stadtinspektor, NSC-Profil öffnen führt zur Figur und ihrem Wochenplan. Aktivitäten aktualisieren liest neue Gruppenzeit und Profilangaben. Ist die zuvor gewählte Gruppenuhr nicht mehr verfügbar, bleibt die Projektion leer und verlangt eine neue ausdrückliche Auswahl. Es wird keine Anwesenheit simuliert oder Position verändert.',
  },
  {
    id: 'npc-building-bindings',
    title: 'Vom NSC aus Wohnhaus und Arbeit vorbereiten',
    text: 'In NSC-Schauplätze wählst du Wohnhaus oder Arbeitsplatz wählen / wechseln. Suche ein vorhandenes Haus in einer beliebigen Stadt. Auch bestehende Wohn- und Arbeitsbindungen lassen sich direkt über Stadtgrenzen wechseln. Ein optionaler Haushalts- oder Berufsname bereitet einen neuen Eintrag für diesen NSC vor. Der Stadtinspektor zeigt die Personenbindung vor dem Speichern. Hausangaben speichern übernimmt neue Zuordnung und das Entfernen der bisherigen Bindung gemeinsam. Rückgängig/Wiederholen wirkt bei einem Stadtwechsel auf beide Städte und ist aus beiden erreichbar; spätere Änderungen in einer beteiligten Stadt zuerst rückgängig machen. Andere Bewohner, Berufe und Hausnotizen bleiben erhalten. Aktuelle Position, Dungeonraum, HP und Gruppenzeit ändern sich nicht.',
  },
  {
    id: 'npc-places',
    title: 'Vom NSC zu Haus, Arbeit und Dungeonraum',
    text: 'Schauplätze in der Ortsmappe oder Gruppenübersicht und Wohnorte, Arbeit und Dungeonraum im Weltprofil lesen die vorhandenen Bindungen desselben NSCs. Wohnhäuser zeigen Haushalte, Arbeitsgebäude die Berufe; ein aktueller Dungeonraum steht gesondert dabei. Ein Klick öffnet genau das Gebäude im Stadtinspektor oder den Raum im Atlas. Haushalts-, Berufs- und Hausangaben im vorhandenen Stadtbereich bearbeiten. Öffnen verändert keine Position, keine HP und keine Gruppenzeit. Es entstehen keine kopierten NSCs oder neuen Ortsbindungen.',
  },
  {
    id: 'location-groups',
    title: 'Figurengruppen am Ort führen',
    text: 'Figurengruppen in der Ortsmappe suchen oder unter Material hier anlegen neu erstellen. Die Gruppenübersicht zeigt aktuelle Mitglieder, HP und ihre einzelnen Weltstandorte in 25er-Schritten. Weltprofil öffnet dieselbe NSC-Identität. Der kampagnenweite Suchbereich findet auch Gruppen ohne gemeinsamen Ort. Gruppenort vorbereiten belegt den Zielort im bestehenden Gruppenbereich vor. Erst Gruppenangaben übernehmen versetzt sämtliche enthaltenen NSCs; ihre HP werden dabei nicht zurückgesetzt. Offene Gruppenangaben bleiben erhalten. Neue leere Gruppen bekommen den gewählten Ort; Kreaturen anschließend im Gruppenbereich hinzufügen.',
  },
  {
    id: 'location-material-binding',
    title: 'Vorhandenes Material am Ort wiederverwenden',
    text: 'In der Ortsmappe wählst du bei NSCs, Aufträgen/Gerüchten oder Shops den Suchbereich Vorhandenes Kampagnenmaterial. Die Suche lädt 40 Treffer je Seite und zeigt ihre aktuelle Bindung. Ein Treffer öffnet den bestehenden Fachbereich. Ortsbindung bearbeiten belegt dort den gewählten Ort vor: bei NSCs ausdrücklich NPC übernehmen, bei Aufträgen Narrative Angaben speichern, bei Shops Shop speichern. Andere offene Angaben und Identitäten bleiben erhalten. Eine Shopbindung an einen NSC wird nur durch die ausdrückliche neue Wahl zu einem Ortsbesitzer. Zur Ortsmappe führt auch nach dem Öffnen von Fraktionsquellen, Karten oder vorhandenen Einträgen zum ursprünglichen Ort zurück.',
  },
  {
    id: 'location-material-authoring',
    title: 'Einen Ort mit spielbarem Material füllen',
    text: 'In der Ortsmappe öffnet Material hier anlegen die Auswahl NSC, Auftrag, Gerücht oder Shop. Name und ausgewählter Ort werden gemeinsam in den vorhandenen Fachbereich übernommen: ein NSC erhält ein eigenes Weltprofil, ein Auftrag oder Gerücht einen offenen narrativen Status ohne Belohnung, ein Shop den Ort als Besitzer und einen leeren Warenbestand. Bearbeite dort die Texte, Werte und Waren. Zur Ortsmappe führt zum ursprünglichen Ort zurück. Die Anlage bewegt weder eine Gruppenuhr noch erzeugt sie Kampf, XP, Beute oder einen Verkauf.',
  },
  {
    id: 'local-world-planner',
    title: 'Fraktionen und Fristen am Ort planen',
    text: 'Öffne eine Ortsmappe. Unter Fraktionen und Begegnungsquellen verknüpfst du bestehende Fraktionen und Tabellen mit genau diesem Ort. Fraktionen im Materialbereich führen zu ihren Originalnotizen oder zu Haltung und Beständen. Fristen dieses Ortes öffnet die Kalenderagenda mit allen örtlichen Ereignissen, auch abgelaufenen. Neue Frist übernimmt den gewählten Ort; Beginn, Dauer, Wiederholung und private Notizen bearbeitest du im vorhandenen Ereigniseditor. Countdown und Warten verwenden weiterhin die fokussierte Gruppenzeit. Lesen, Zuordnen und Planen bewegen keine Uhr. Zur Ortsmappe führt nach Speichern oder ausdrücklich verworfenen Eingaben zurück.',
  },
  {
    id: 'complete-chronicle',
    title: 'Die gesamte Kampagnenchronik lesen und ausgeben',
    text: 'Die Kampagnenchronik lädt 100 Ereignisse je Seite. Ältere Ereignisse und Vorige Seite blättern im festen Lesestand, auch wenn inzwischen weitergespielt wird. Aktualisieren, eine andere Suche oder ein anderer Bereich öffnen einen neuen Lesestand. Markdown ausgeben schreibt sämtliche passenden Ereignisse, einschließlich älterer Einträge jenseits von 2.000; der Fortschritt zählt ausgegebene Ereignisse. Ausgabe abbrechen erhält eine vorhandene Zieldatei. Kampfbelohnungen bleiben je Award gemeinsam, mit allen Beteiligten. Öffnen und Ausgeben verändern keine Kampagnenfakten.',
  },
  {
    id: 'location-visitors',
    title: 'Geplante Ortsbesuche lesen',
    text: 'Öffne in der Ortsmappe Geplante NSC-Besuche. Die gewählte Gruppenuhr zeigt aktuelle Aktivitäten und den nächsten Besuch aus Wochenplänen und Datumsausnahmen. Feste Ortsziele sowie Wohn- und Arbeitsgebäude an diesem Ort werden berücksichtigt. Suche nach NSC oder Besuchstext; weitere Profile folgen in 40er-Schritten. Tatsächlicher Standort und geplanter Besuch stehen getrennt. Profil öffnen führt zur bestehenden Figur, Gebäude öffnen zum vorhandenen Stadtinspektor. Lesen und Wechsel der Gruppenuhr verändern keine Position, keine HP und keine Zeit.',
  },
  {
    id: 'location-notebook',
    title: 'Einen Ort für den Spielabend vorbereiten',
    text: 'Die Ortsmappe verbindet geordnete Originaltexte, Verweise, Karten und zugeordnete NSCs, Aufträge, Figurengruppen und Shops. Suche einen Ort, lies die Abschnitte und öffne das Material in seinen bestehenden Fachbereichen. Nur den ausdrücklich gewählten Abschnitt als Vorlesetext in die benannte Fokusgruppe übernehmen; weitere Abschnitte werden nicht mitkopiert. Im Ortseditor Abschnitte hinzufügen, Titel ändern und nach oben/unten anordnen. Ihre Kennungen und Texte bleiben erhalten. Textverweis einfügen arbeitet an Cursor/Markierung des Abschnitts und nutzt die vorhandenen geschützten Ortsentwürfe.',
  },
  {
    id: 'text-references',
    title: 'Notiztexte mit Quellen verbinden',
    text: 'Im Notizeditor fügt Textverweis einfügen eine ausgewählte Welt- oder Katalogquelle an der markierten Stelle der GM-Notiz ein. Wähle einen eigenen Anzeigenamen; er wird zum Suchbegriff im Bereich Verknüpfte Begriffe der Schnellsuche und des Zusammenhangsplans. Beim Lesen öffnet ein Klick auf den Namen die Quelle, Zurück führt wieder zum Text. Ziele behalten ihre Identität bei Umbenennung. Verweise in langen Texten bleiben über Verknüpfte Begriffe auffindbar; ein begrenzter Leser weist auf weitere Ziele hin. Fehler einzelner Quellen werden angezeigt, gesunde Treffer bleiben erreichbar. Papierkorbziele bleiben sichtbar als nicht verfügbar. Unabhängige Kampagnenkopien binden interne Verweise an ihre neuen Identitäten; Katalogverweise behalten ihren Installationsbezug. Codebeispiele, wörtlich maskierte Verweise und Bilder bleiben Text und erzeugen keine Quellenaktion. Ändern sich Notizkontext, Wortlaut oder Ziel während der Auswahl, füge den Verweis erneut ein. Der Notiztext und seine Entwürfe bleiben beim vorhandenen Editor.',
  },
  {
    id: 'world-links',
    title: 'Zusammenhänge der Kampagne erkunden',
    text: 'Zusammenhänge verbindet NSCs, Fraktionen, Quests, Gerüchte, Regeln und Orte in einer zoombaren Karte. Knoten wählen, eingehende und ausgehende Verbindungen lesen und an der Quelle weiterarbeiten. Durchgezogene Pfeile sind bearbeitbare Beziehungen; gestrichelte Verweise bleiben bei ihren bestehenden Fachbereichen. Wähle Kreaturen, Gegenstände oder Begegnungen als Quelle: NSCs zeigen ihren Statblock, Begegnungen ihre Kreaturen und benannten Teilnehmer, Quests ihre Gegenstandsbelohnungen. Katalogdefinitionen und eingefrorene Vorlagen-/Belohnungsstände sind getrennt. Referenz lesen öffnet die Schnellsuche mit ihren vorhandenen Aktionen; Katalog / Vorlage öffnen führt direkt zum bestehenden Editor. Auch die Schnellsuche öffnet den Zusammenhangsplan der ausgewählten Quelle. Beziehungsziel suchen, benennen und ausdrücklich übernehmen. „Als gegenseitiges Paar“ verlangt eine eigene Bezeichnung der Rückrichtung und speichert oder löst beide Kanten atomar. Wähle zusätzlich Elternteil, Kind, Geschwister oder Partner, um das NPC-Paar ausdrücklich als Familie zu typisieren; die passende Gegenrichtung wird gemeinsam gespeichert. Familienansicht zeigt nur diese Typen. Freie Beziehungsnamen bleiben in der Gesamtansicht sichtbar und werden nicht als Familie interpretiert. Rückgängig und Wiederholen gelten für das vollständige Paar und sind gegen spätere Änderungen beider World-Notizen geschützt. Der Paarauftrag bleibt bis zur Ergebnisprüfung erhalten; gewöhnliche Einzelbeziehungsentwürfe bleiben im Notizentwurf. Bei geändertem Stand Auftrag prüfen und aktuelle Basis ausdrücklich laden; Texte werden erhalten. Neue Weltinhalte können direkt angelegt werden, Orte über ihren Editor.',
  },
  {
    id: 'npc-dossier',
    title: 'NSCs am Spieltisch führen',
    text: 'NSCs am Spieltisch listet die Figuren am Gruppenort oder aus der ganzen Kampagne. Das Dossier verbindet Aussehen, Verhalten, Vorlesetext, Geschichte, Fraktion, eingehende und ausgehende Beziehungen, Gruppen, HP und bestätigtes NPC-Verhalten. Statblocks laden erst beim Öffnen. Ladefehler erscheinen im Statblockbereich mit „Statblock erneut laden“. Gespräch festhalten öffnet den bestehenden Profilentwurf mit Datum und Gruppe; die Eingabe wird als Entwurf gesichert und erst mit NPC übernehmen bestätigt. Vorlesetext und Begegnung nutzen ihre bestehenden Live-Besitzer. Ein Dossier aktiviert keine Autonomie und startet keinen Kampf.',
  },
  {
    id: 'travel-camp',
    title: 'Unterwegs warten, rasten und den Restweg fortsetzen',
    text: 'Die Reisevorschau zeigt Ankunft, Gelände, Wetter und GM-Halte je Abschnitt sowie Fristen an Reiseorten. Am Live-Spieltisch öffnet Pausieren / warten den Zeitdialog und Pausieren / rasten die vorhandene Party-Rast. Keine Bewegung erfolgt dabei automatisch. Nach Zeit-, Wetter-, Karten- oder Gruppenänderungen Restweg neu bewerten: Ziel und verbliebene Hexfolge bleiben erhalten, die Vorschau berechnet neue Zeiten. Erst Restreise ausdrücklich annehmen ersetzt den alten Plan; danach Abschnitte bestätigen. Bereits gereiste Abschnitte und der frühere Plan bleiben im Verlauf.',
  },
  {
    id: 'calendar-time',
    title: 'Bis Datum oder Ereignis warten',
    text: 'Am Spieltisch öffnet Warten bis Datum / Ereignis einen Zeitdialog. Wähle Dauer, Datum, Ereignisbeginn/-ende oder nächsten Tagesbeginn. Die Vorschau zeigt das genaue Ziel im Kampagnenkalender und Kalenderereignisse unterwegs. Erst Zeit ausdrücklich verstreichen lassen schreibt die vorhandene Gruppen-Clock fort und verarbeitet ihre Zeitfolgen. Auch Tage in der normalen Zeitsteuerung folgen jetzt der Kampagnen-Tageslänge. Frühere Zeitbelege behalten ihre damalige Bedeutung. Bei geänderter Uhr, Kalenderdefinition oder Ereignisrevision eine neue Vorschau prüfen; Rastwirkungen weiterhin im Rastbereich bestätigen.',
  },
  {
    id: 'campaign-agenda',
    title: 'Fristen an der Gruppenzeit planen',
    text: 'Kalender / Fristen öffnet die Agenda zur bestätigten Zeit der fokussierten Gruppe. Suche über Ereignisnamen und GM-Notizen; begrenze Zeitraum und Ort. Lege Fristen in Minuten, Stunden, Kampagnentagen oder Wochen an oder wähle Jahr, Monat, Tag und Uhrzeit. Wiederkehrende Ereignisse zeigen ihre aktuelle oder nächste Ausführung. Prüfe die Datums- und Wiederholungsvorschau und speichere ausdrücklich. Ereignisse einschließlich Papierkorb öffnen sich auch aus den Kalenderregeln. Bestehende Orte lassen sich zuordnen, Ereignisse ausdrücklich wiederherstellen. Der bestehende Kalender bleibt die einzige Quelle; Planung verändert keine Gruppenzeit. Offene Angaben bleiben bis Speichern oder ausdrücklichem Verwerfen erhalten.',
  },
  {
    id: 'dungeon-binder',
    title: 'Raum-Keys beim Leiten lesen',
    text: 'Öffne den Dungeon-Binder auf der Karte oder unter Dungeon leiten. Suche über alle Räume, Vorlagentexte, Geheimnisse und Rauminhalte; filtere Dungeon oder Geschoss. Lies GM-Blöcke, Suchhinweise, wirksame Attribute, verbundene Räume und Fallenstände. Die öffentliche Textvorschau nutzt das bestätigte Gruppenwissen; die Spieleranzeige behält ihre tatsächliche Wahrnehmung. Als Reiseziel wählen öffnet den bestehenden Leitablauf. Erst dessen Bestätigung bewegt die Gruppe. Lesen oder Weiterblättern verändert keine Zeit, Entdeckung, Charges oder Beute.',
  },
  {
    id: 'scene-visits',
    title: 'Übernommene Besuche bleiben bei der Gruppe',
    text: 'Öffne am Spieltisch „Übernommene Besuche ansehen“. Der Besuchsbinder hält Titel, GM-Notizen, Vorlesetext und Notizbindungen einer Übernahme fest, auch wenn du danach den Plan ersetzt oder den Besuch aus der Timeline entfernst. Ergebnisse und übernommene Begegnungsgruppen bleiben erreichbar. Weltverweise und NPC-Werte zeigen den aktuellen Weltstand. Du kannst einen festgehaltenen Vorlesetext ausdrücklich in die laufende Gruppe kopieren. Ältere Übernahmen ohne Snapshot sind als solche markiert; fehlende frühere Inhalte werden nicht erfunden.',
  },
  {
    id: 'treasure-distribution',
    title: 'Einen Schatz gemeinsam verteilen',
    text: 'Öffne im Schatzbereich oder am Spieltisch „Beute verteilen“. Wähle den Schatz und die aktiven Empfänger. Die Gleichverteilung verteilt ganze Einheiten; Reste bleiben im Schatz. Korrigiere einzelne Mengen oder weise einen besonderen Posten vollständig einer Figur zu. Prüfe die Gesamtverteilung und bestätige sie zusammen. Herkunft, Gegenstandsdefinitionen und Werte werden im persönlichen Lootledger bewahrt. Bereits vergebene Mengen stehen nicht erneut zur Auswahl; XP und Käufe gehören zu ihren eigenen Abläufen.',
  },
  {
    id: 'live-generation',
    title: 'Begegnungen direkt für die laufende Gruppe erzeugen',
    text: 'Öffne am Spieltisch „Begegnung erzeugen“. Die aktuelle fokussierte Gruppe mit ihren bekannten XP/Leveln ersetzt eine gesonderte Planungsparty. Wähle Schwierigkeit, Tabellen, Ortsquellen, Fraktionen oder verbindliche NPCs und erzeuge bis zu fünf gespeicherte Vorschläge. Vergleiche XP und Statblocks. „Für diese Gruppe vorbereiten“ übernimmt einen Vorschlag samt Vorlage in eine neue Kampfmaske. Die bisherigen Masken bleiben erhalten; Start, Initiative, Abschluss und Belohnungen bleiben ausdrückliche Schritte. Gespeicherte Vorschauen findest du nach Neustart wieder. Veränderte Gruppe, Orte oder Quellen erfordern eine neue Vorschau.',
  },
  {
    id: 'session-reuse',
    title: 'Vorbereitete Szenen für den nächsten Abend nutzen',
    text: 'Öffne im Plan „Szenen wiederverwenden“. Wähle einen Quellplan, durchsuche seine Besuche und stelle die gewünschte Reihenfolge zusammen. Erstelle einen eigenen Abend samt Planungsparty oder hänge die Auswahl an einen bestehenden Plan an. Vorlesetexte, GM-Notizen, Weltverweise und offene Belohnungen werden übernommen. Noch nicht platzierte Begegnungen werden unabhängig vorbereitet; platzierte Gruppen bleiben dieselben NPCs. Gebuchte Belohnungen bleiben gebucht. Laufende Gruppen und Besuchsergebnisse gehören weiterhin zum tatsächlich gespielten Abend.',
  },
  {
    id: 'live-soundboard',
    title: 'Den Spielabend direkt am Tisch vertonen',
    text: 'Öffne in der laufenden Szene das Soundboard oder springe mit „Soundboard“ im kleinen Player direkt dorthin. Merke Titel und Umgebungsgeräusche aus der Bibliothek als Kampagnenfavoriten. Starte Musik, füge Sounds hinzu oder stelle mehrere ausgewählte Titel gemeinsam in die Warteschlange. Pause, Stopp und Automatikfreigabe verwenden denselben Player wie der Musikbereich. Favoriten und Soundwahl bleiben gespeichert; nach Neustart gibt erst ein ausdrücklicher Start wieder Ton frei. Der Musikbereich bleibt für Beschreibungen, Medienimport, Lautstärke und Szenenregler erreichbar.',
  },
  {
    id: 'music-library',
    title: 'Lokale Musik und Umgebungs-Sounds',
    text: 'Unter „Musik und Ambience“ fügst du lokale Audiodateien hinzu und beschreibst sie mit Intensität, Stimmung, Vibes, Genres und Notizen. Eigene Stimmungsachsen stehen auch als Szenenregler bereit. Fehlende, veränderte oder nicht decodierbare Dateien bleiben sichtbar und lassen sich erneut prüfen. Die Bibliothek lässt sich samt Medien exportieren, abbrechen und auf einem anderen Rechner importieren. Beschreibungen und Medien werden lokal verwaltet.',
  },
  {
    id: 'music-transport',
    title: 'Manuelle Wiedergabe hat Vorrang',
    text: 'Wähle einen Titel, stelle die Warteschlange zusammen und bediene Pause, Stopp, Weiter, Zurück, Position und Loop. Der kleine Player bleibt beim Wechsel des Arbeitsbereichs sichtbar. Ein manueller Stopp hält auch eingeschaltetes Autoplay an. „Automatik freigeben“ setzt die Auswahl aus der aktuellen fokussierten Gruppe fort. Auswahl und bestätigte Position bleiben gespeichert. Nach erneutem Öffnen bleibt die Ausgabe stumm, bis du ▶ oder einen Titel ausdrücklich startest.',
  },
  {
    id: 'music-context',
    title: 'Musik und Wetter zur Gruppe passen lassen',
    text: 'Autoplay verwendet Stimmungsregler und Tags der fokussierten Gruppe. Orte, NPCs, Fraktionen und Kreaturprofile können Vibes oder Genres ergänzen oder ersetzen. Die Umgebungsautomatik wählt passende Sounds für Gelände, Wetter und Tageszeit. Ein unlesbarer Wetter- oder Umweltstand ersetzt die letzte gültige Automatik nicht. Füge Sounds ausdrücklich hinzu oder unterdrücke einzelne automatische Sounds; erst die Freigabe beendet diese Vorgabe.',
  },
];

export const tutorialSurfaceLessons = {
  'application-trigger': 'campaign',
  'campaign-header-name': 'campaign',
  'campaign-screen-open': 'campaign',
  'application-settings': 'generator-presets',
  'world-links-open': 'world-links',
  'agenda-open': 'campaign-agenda',
  'live-generation-open': 'live-generation',
  'session-copy-open': 'session-reuse',
  atlas: 'drawing-and-key',
  preparation: 'world-notes',
  live: 'live-party',
  chronicle: 'chronicle',
  catalog: 'encounter-catalog',
  groups: 'npc-world',
  treasury: 'treasury',
  items: 'items-trade',
  dungeon: 'dungeon-tools',
  autonomy: 'npc-autonomy',
  city: 'city-infill',
  world: 'atlas-hex',
  music: 'music-library',
  'rename-campaign': 'campaign',
  'new-campaign': 'campaign',
  'soundboard-shortcut': 'live-soundboard',
  'quick-reference-open': 'quick-reference',
  'narrative-journal-open': 'narrative-journal',
  'day-trigger': 'adventuring-day',
  'party-shortcut': 'party-topbar',
  'player-open-controls': 'player-display',
  'campaign-manager': 'campaign-transfer',
  import: 'campaign',
  'extensions-open': 'extensions',
} as const;

export const tutorialCapabilityLessons = {
  'location-notebook-open': 'location-notebook',
  'location-notebook-read': 'location-notebook',
  'note-text-reference': 'text-references',
  'text-reference-insert': 'text-references',
  'journey-replan': 'travel-camp',
  'journey-wait': 'travel-camp',
  'journey-rest': 'travel-camp',
  'time-plan-open': 'calendar-time',

  'live-npc-cast': 'npc-dossier',
  'npc-cast': 'npc-dossier',
  'npc-cast-search': 'npc-dossier',
  'npc-cast-scope': 'npc-dossier',
  'npc-cast-document': 'npc-dossier',
  'npc-contact': 'npc-dossier',

  'live-agenda-open': 'campaign-agenda',
  'dungeon-binder-open': 'dungeon-binder',
  'dungeon-binder-live': 'dungeon-binder',
  'scene-visit-open': 'scene-visits',
  'live-loot-distribute': 'treasure-distribution',
  'treasury-distribute': 'treasure-distribution',

  'world-links': 'world-links',
  'world-link-form': 'world-links',
  'world-link-paired': 'world-links',
  'world-link-family-kind': 'world-links',
  'world-links-family': 'world-links',
  'world-link-reverse-label': 'world-links',
  'world-link-pair-undo': 'world-links',
  'world-link-pair-redo': 'world-links',
  'world-links-map': 'world-links',
  npcs: 'npc-world',
  'npc-search-form': 'npc-world',
  'npc-filter-life': 'npc-world',
  'npc-filter-faction': 'npc-world',
  'npc-filter-location': 'npc-world',
  'npc-drafts': 'npc-world',
  'npc-editor': 'npc-world',
  'npc-reload': 'npc-world',
  'npc-creature-find': 'npc-world',
  'npc-enter': 'npc-world',
  'groups-search-form': 'prepared-groups',
  'groups-template': 'prepared-groups',
  'groups-new': 'prepared-groups',
  'groups-editor': 'prepared-groups',
  'groups-apply': 'prepared-groups',
  'groups-reload': 'prepared-groups',
  'groups-creature-form': 'prepared-groups',
  'groups-actors': 'prepared-groups',
  'scene-prepared-groups': 'prepared-groups',
  'autonomy-actors': 'npc-autonomy',
  'autonomy-groups': 'npc-autonomy',
  'autonomy-actor-form': 'npc-autonomy',
  'dungeon-round-preset': 'dungeon-rounds',
  'dungeon-round-seconds': 'dungeon-rounds',
  'dungeon-round-step': 'dungeon-rounds',
  'dungeon-play': 'dungeon-rounds',
  'generation-fill': 'generation-fill',
  'party-quick': 'party-topbar',
  'party-rest-average': 'party-topbar',
  'party-popover': 'party-topbar',
  'party-search': 'party-topbar',
  'party-create': 'party-topbar',
  'party-editor': 'party-topbar',
  'party-profile-form': 'party-topbar',
  'party-active': 'party-topbar',
  'party-rest': 'party-topbar',
  'party-archive': 'roster-archive',
  'party-archive-form': 'roster-archive',
  'party-archive-list': 'roster-archive',
  'live-continue': 'live-party',
  'running-editor': 'live-party',
  'character-form': 'live-party',
  'live-party-new': 'live-party',
  'scene-adopt': 'live-party',
  'scene-focus': 'groups',
  'group-move': 'groups',
  'move-dialog': 'groups',
  'live-archives': 'groups',
  'archive-dialog': 'groups',
  'archive-mask-detail': 'groups',
  'time-controls': 'relative-time',
  'time-form': 'relative-time',
  'time-advance': 'relative-time',
  'live-apply': 'live-recovery',
  'live-reconcile': 'live-recovery',
  'live-refresh': 'live-recovery',
  'hex-access-fields': 'hex-access',
  'travel-access-choices': 'hex-access',
  'catalog-item-reference': 'item-reference',
  'catalog-items-tab': 'item-reference',
  'scene-desk': 'scene-desk',
  'desk-search-form': 'scene-desk',
  'desk-create-form': 'scene-desk',
  'desk-editor': 'scene-desk',
  'combat-panel': 'multiple-encounters',
  'combat-history-open': 'multiple-encounters',
  'combat-start': 'multiple-encounters',
  'combat-drafts': 'multiple-encounters',
  'chase-panel': 'chase',
  'chase-new': 'chase',
  'chase-start': 'chase',
  'chase-round': 'chase',
  'chase-finish': 'chase',
  'chase-history-open': 'chase',
  'chase-draft-retry': 'chase',
  'session-profile-form': 'session-generation',
  'session-generate-form': 'session-generation',
  'session-history': 'session-generation',
  'combat-finish': 'combat-rewards',
  'visit-reward-award': 'combat-rewards',
  'reward-panel': 'combat-rewards',
  'live-health-dialog': 'character-health',
  'health-form': 'character-health',
  'death-saves': 'character-health',
  'xp-form': 'character-progression',
  'rest-members': 'character-progression',
  'progress-history-list': 'character-progression',
  'manual-loot-form': 'personal-loot',
  'ledger-list': 'personal-loot',
  'ledger-form': 'personal-loot',
  'ledger-stack-tools': 'personal-loot',
  'item-new': 'item-definitions',
  'items-search-form': 'item-definitions',
  'item-form': 'item-definitions',
  'item-copy': 'item-definitions',
  'item-trash': 'item-definitions',
  'item-award': 'personal-loot',
  'item-treasure': 'treasury',
  'shop-new': 'items-trade',
  'shop-add-item': 'items-trade',
  'shop-form': 'items-trade',
  'shop-stock': 'items-trade',
  'stock-price-form': 'items-trade',
  'shop-time-refresh': 'items-trade',
  'shop-sale-form': 'items-trade',
  'shop-history': 'items-trade',
  'treasury-new': 'treasury',
  'treasury-catalog-form': 'treasury',
  'treasury-apply': 'treasury',
  'treasury-move-form': 'treasury',
  'treasury-allocate-form': 'treasury',
  'treasury-history': 'treasury',
  'knowledge-tab': 'world-notes',
  'world-search': 'world-notes',
  'world-new': 'world-notes',
  'note-editor': 'world-notes',
  'note-remove': 'world-notes',
  'note-restore': 'world-notes',
  'locations-tab': 'locations',
  'location-search': 'locations',
  'location-new': 'locations',
  'location-editor': 'locations',
  'location-map-actions': 'locations',
  'location-remove': 'locations',
  'location-restore': 'locations',
  'relation-create': 'relationships',
  'note-relations': 'relationships',
  'note-incoming': 'relationships',
  'narrative-editor': 'narrative-journal',
  'narrative-journal': 'narrative-journal',
  'journal-narrative-editor': 'narrative-journal',
  'campaign-agenda': 'campaign-agenda',
  'agenda-search': 'campaign-agenda',
  'agenda-list': 'campaign-agenda',
  'agenda-event-form': 'campaign-agenda',
  'preparation-apply': 'preparation-recovery',
  'preparation-reconcile': 'preparation-recovery',
  'preparation-refresh': 'preparation-recovery',
  'plan-create': 'manual-planning',
  'plan-controls': 'manual-planning',
  'scene-search': 'manual-planning',
  'scene-editor': 'manual-planning',
  'scene-up': 'manual-planning',
  'scene-down': 'manual-planning',
  'plan-replace': 'plan-replacement',
  'plan-clear': 'plan-replacement',
  'plan-replacement-form': 'plan-replacement',
  'plan-replacement-confirm': 'plan-replacement',
  'visit-preparation': 'session-content',
  'visit-note-refs': 'session-content',
  'visit-attach': 'session-content',
  'visit-groups': 'session-content',
  'session-proposal-search': 'session-review',
  'session-proposal-filter': 'session-review',
  'session-review-selection': 'session-review',
  'session-selection-dialog': 'session-review',
  'session-packet-open': 'session-packet',
  'session-packet-search': 'session-packet',
  'session-packet-content': 'session-packet',
  'session-packet-export': 'session-packet',
  'session-review-open-packet': 'session-packet',
  'session-copy-dialog': 'session-reuse',
  'session-copy-search': 'session-reuse',
  'session-copy-order': 'session-reuse',
  'session-copy-confirm': 'session-reuse',
  'live-session-navigator': 'session-progress',
  'live-session-visits': 'session-progress',
  'live-visit-outcome-form': 'session-progress',
  'live-session-resume': 'session-recap',
  'live-session-resume-worlds': 'session-recap',
  'live-session-resume-visits': 'session-recap',
  'live-session-resume-narratives': 'session-recap',
  'live-moment-form': 'chronicle',
  'live-knowledge-results': 'chronicle',
  'live-session-start': 'session-recap',
  'live-session-end': 'session-recap',
  'running-player-location': 'player-cues',
  'running-player-npc-show': 'player-cues',
  'running-player-handout': 'player-cues',
  'running-player-follow': 'player-cues',
  'running-player-blank': 'player-cues',
  'player-show-follow': 'player-cues',
  'player-show-image': 'player-cues',
  'player-pick-art': 'player-cues',
  'player-blank': 'player-cues',
  'player-observers': 'player-display',
  'player-discover': 'player-display',
  'player-forget': 'player-display',
  'player-mask-save': 'player-display',
  'world-map-new': 'atlas-hex',
  'world-map-copy': 'atlas-hex',
  'world-map-form': 'atlas-hex',
  'world-map-export': 'atlas-hex',
  'world-map-import': 'atlas-hex',
  'hex-form': 'atlas-hex',
  'world-anchor-save': 'atlas-hex',
  'world-place-group': 'atlas-hex',
  'world-reveal': 'player-display',
  'live-travel-toggle': 'live-travel',
  'travel-mode-target': 'map-route',
  'travel-mode-route': 'map-route',
  'travel-place-cursor': 'map-route',
  'world-travel-form': 'travel-checkpoints',
  'travel-preview-accept': 'travel-checkpoints',
  'journey-step': 'travel-checkpoints',
  'journey-many': 'travel-checkpoints',
  'journey-pause': 'travel-checkpoints',
  'journey-play': 'travel-checkpoints',
  'journey-end': 'travel-checkpoints',
  'calendar-form': 'calendar-events',
  'world-agenda-open': 'campaign-agenda',
  'phen-editor': 'weather-control',
  'weather-override-form': 'weather-control',
  'weather-release': 'weather-control',
  'audio-pick': 'music-library',
  'audio-export': 'music-library',
  'audio-import': 'music-library',
  'audio-cancel-transfer': 'music-library',
  'audio-search-form': 'music-library',
  'audio-editor': 'music-library',
  'audio-clone': 'music-library',
  'music-axes': 'music-library',
  'music-axis-add': 'music-library',
  'music-axis-save': 'music-library',
  'music-mini-open': 'music-transport',
  'music-seek': 'music-transport',
  'music-settings': 'music-transport',
  'music-queue': 'music-transport',
  'music-layers': 'music-context',
  'music-ambience-release': 'music-context',
  'music-scene-editor': 'music-context',
  'music-subject-editor': 'music-context',
  'live-soundboard': 'live-soundboard',
  'soundboard-transport': 'live-soundboard',
  'soundboard-favorites': 'live-soundboard',
  'soundboard-queue': 'live-soundboard',
  'soundboard-browser': 'live-soundboard',
  'soundboard-queue-selected': 'live-soundboard',
  'live-rules-panel': 'live-rules',
  'live-check-form': 'live-rules',
  'city-select': 'city-infill',
  'city-new-open': 'city-infill',
  'city-new-form': 'city-infill',
  'city-location': 'city-infill',
  'city-workbench': 'city-infill',
  'city-tool': 'city-infill',
  'city-map': 'city-infill',
  'city-finish': 'city-infill',
  'city-cancel-path': 'city-infill',
  'city-undo': 'city-infill',
  'city-redo': 'city-infill',
  'city-refresh': 'city-infill',
  'city-zoom': 'city-infill',
  'city-district': 'city-regeneration',
  'city-seed': 'city-regeneration',
  'city-density': 'city-regeneration',
  'city-size': 'city-regeneration',
  'city-reach': 'city-regeneration',
  'city-use': 'city-regeneration',
  'city-generate': 'city-regeneration',
  'city-cancel-preview': 'city-regeneration',
  'city-preview-summary': 'city-regeneration',
  'city-preview-accept': 'city-regeneration',
  'city-inspector': 'city-buildings',
  'city-unit-form': 'city-buildings',
  'city-unit-protected': 'city-buildings',
  'city-unit-faction': 'city-buildings',
  'city-people-faction': 'city-buildings',
  'city-factions': 'city-buildings',
  'city-people-search': 'city-buildings',
  'city-people-results': 'city-buildings',
  'city-household-add': 'city-buildings',
  'city-households': 'city-buildings',
  'city-job-add': 'city-buildings',
  'city-jobs': 'city-buildings',
  'city-unit-reload': 'city-buildings',
  'city-delete': 'city-buildings',
  'city-paper': 'city-buildings',
  'city-roof': 'city-buildings',
  'city-export-svg': 'city-buildings',
  'city-export-json': 'city-buildings',
  'volume-open': 'dungeon-volumes',
  'volume-dialog': 'dungeon-volumes',
  'volume-slice-map': 'dungeon-volumes',
  'volume-isometric': 'dungeon-volumes',
  'volume-initialize': 'dungeon-volumes',
  'volume-operation': 'dungeon-volumes',
  'volume-apply': 'dungeon-volumes',
  'volume-discard': 'dungeon-volumes',
  'trigger-fields-open': 'dungeon-triggers',
  'trigger-dialog': 'dungeon-triggers',
  'trigger-config-save': 'dungeon-triggers',
  'trigger-correct': 'dungeon-triggers',
  'trigger-refill': 'dungeon-triggers',
  'trigger-manual-activate': 'dungeon-triggers',
  'trigger-new': 'dungeon-triggers',
  'trigger-box-apply': 'dungeon-triggers',
  'trigger-clear-volume': 'dungeon-triggers',
  'trigger-remove-unbound': 'dungeon-triggers',
  'trigger-save': 'dungeon-triggers',
  'dungeon-content-open': 'dungeon-content',
  'content-dialog': 'dungeon-content',
  'content-new': 'dungeon-content',
  'content-encounter-owner': 'dungeon-content',
  'content-reference': 'dungeon-content',
  'content-reference-detail': 'dungeon-content',
  'content-save': 'dungeon-content',
  'content-discard': 'dungeon-content',
  'graph-open': 'dungeon-graph',
  'graph-dialog': 'dungeon-graph',
  'graph-map': 'dungeon-graph',
  'graph-create': 'dungeon-graph',
  'graph-connect': 'dungeon-graph',
  'graph-reroute': 'dungeon-graph',
  'graph-raster': 'dungeon-graph',
  'graph-preview-banner': 'dungeon-graph',
  'graph-accept': 'dungeon-graph',
  'graph-restore': 'dungeon-graph',
  'graph-budget-save': 'dungeon-graph',
  'graph-budget-clear': 'dungeon-graph',
  'graph-budget-discard': 'dungeon-graph',
  'key-open': 'dungeon-keys',
  'key-dialog': 'dungeon-keys',
  'key-search': 'dungeon-keys',
  'key-owner': 'dungeon-keys',
  'key-create-owner': 'dungeon-keys',
  'key-template-from-room': 'dungeon-keys',
  'key-reference-query': 'dungeon-keys',
  'key-reference-matches': 'dungeon-keys',
  'key-add-block': 'dungeon-keys',
  'key-save': 'dungeon-keys',
  'key-reload': 'dungeon-keys',
  'key-batch-apply': 'dungeon-keys',
  'drawing-public-export': 'dungeon-keys',
  'drawing-export-svg': 'dungeon-keys',
  'drawing-export-keys': 'dungeon-keys',
  'drawing-export-document': 'dungeon-keys',
  'drawing-export-json': 'dungeon-keys',
  'path-open': 'dungeon-paths',
  'path-dialog': 'dungeon-paths',
  'path-refresh': 'dungeon-paths',
  'path-new': 'dungeon-paths',
  'path-preview': 'dungeon-paths',
  'path-commit': 'dungeon-paths',
  'path-discard': 'dungeon-paths',
  'passage-create': 'dungeon-paths',
  'path-passages': 'dungeon-paths',
  'dungeon-binder': 'dungeon-binder',
  'dungeon-binder-search': 'dungeon-binder',
  'dungeon-binder-scope': 'dungeon-binder',
  'dungeon-binder-floor': 'dungeon-binder',
  'dungeon-binder-filter': 'dungeon-binder',
  'dungeon-binder-public': 'dungeon-binder',
} as const;

export async function initTutorial() {
  const dialog = document.getElementById('tutorial-dialog') as HTMLDialogElement;
  const content = document.getElementById('tutorial-lessons')!;
  const search = document.getElementById('tutorial-search') as HTMLInputElement;
  const status = document.getElementById('tutorial-search-status')!;
  const help = document.getElementById('help')!;
  const rows = lessons.map((lesson) => {
    const item = document.createElement('li'),
      title = document.createElement('h3'),
      text = document.createElement('p');
    title.textContent = lesson.title;
    text.textContent = lesson.text;
    item.append(title, text);
    return { lesson, item };
  });
  const contextLessons: Readonly<Record<string, string>> = {
    ...tutorialSurfaceLessons,
    ...tutorialCapabilityLessons,
  };
  const lessonAt = (target: Element | null): string | undefined => {
    for (let element = target; element; element = element.parentElement) {
      if (Object.hasOwn(contextLessons, element.id)) return contextLessons[element.id];
    }
  };
  const filter = () => {
    const query = search.value.trim().toLocaleLowerCase('de');
    let count = 0;
    for (const row of rows) {
      row.item.hidden =
        !!query &&
        !(row.lesson.title + ' ' + row.lesson.text).toLocaleLowerCase('de').includes(query);
      if (!row.item.hidden) count++;
    }
    status.textContent = query
      ? count + ' Hilfethemen gefunden.'
      : 'Passendes Thema zuerst. Alle Themen bleiben durchsuchbar.';
  };
  search.oninput = filter;
  const heading = document.getElementById('tutorial-heading')!;
  let opener: HTMLElement | null = null,
    opened = false;
  const warning = () => {
    document.getElementById('tutorial-warning')!.textContent =
      'Tutorialstatus konnte nicht gespeichert werden. Das Werkzeug bleibt benutzbar.';
  };
  const open = (target: Element | null = null) => {
    if (dialog.open) return;
    opener = document.activeElement as HTMLElement | null;
    opened = true;
    help.textContent = 'Hilfe';
    help.title = 'Hilfe (F1 zur fokussierten Funktion)';
    const tab = document
      .querySelector('#workspace-navigation button[aria-pressed="true"]')
      ?.id.replace(/-tab$/, '');
    const currentLesson =
      lessonAt(target) ??
      (tab && document.body.classList.contains('has-workspace')
        ? (tutorialSurfaceLessons[tab as keyof typeof tutorialSurfaceLessons] ?? 'campaign')
        : 'campaign');
    content.replaceChildren(
      ...[...rows]
        .sort(
          (a, b) => Number(b.lesson.id === currentLesson) - Number(a.lesson.id === currentLesson),
        )
        .map((row) => row.item),
    );
    search.value = '';
    filter();
    dialog.showModal();
    heading.focus({ preventScroll: true });
    content.scrollTop = 0;
    dialog.scrollTop = 0;
    void window.campaign
      .tutorial('shown')
      .then((result) => {
        if (!result.ok) warning();
      })
      .catch(warning);
  };
  help.onclick = () => open();
  document.addEventListener('keydown', (event) => {
    if (
      event.key !== 'F1' ||
      event.defaultPrevented ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey
    )
      return;
    event.preventDefault();
    open(document.activeElement);
  });
  const finish = async (state: 'finished' | 'skipped') => {
    dialog.close();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    try {
      const result = await window.campaign.tutorial(state);
      if (!result.ok) warning();
    } catch {
      warning();
    }
  };
  document.getElementById('tutorial-done')!.onclick = () => {
    void finish('finished');
  };
  document.getElementById('tutorial-skip')!.onclick = () => {
    void finish('skipped');
  };
  dialog.addEventListener('cancel', () => {
    void finish('skipped');
  });
  // New or revised instructions are offered without interrupting campaign work.
  content.replaceChildren(...rows.map((row) => row.item));
  filter();
  try {
    const result = await window.campaign.tutorial();
    if (!result.ok) throw new Error(result.error);
    if (result.value.state === 'new' && !opened) {
      help.textContent = 'Hilfe · neu';
      help.title = 'Neue Hilfe verfügbar. F1 erklärt die fokussierte Funktion.';
    }
  } catch {
    document.getElementById('tutorial-warning')!.textContent =
      'Tutorialstatus nicht verfügbar. Hilfe bleibt erreichbar.';
  } finally {
    document.body.dataset.tutorialReady = 'true';
  }
}
