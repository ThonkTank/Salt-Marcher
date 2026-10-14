export const tutorialLessonRevision = 'desktop-tutorial-accessibility-v13';
export interface TutorialRun { version: string; lessonRevision: string; runId: string; state: 'new' | 'shown' | 'finished' | 'skipped' }
export function checkedTutorialRun(value: unknown, applicationVersion: string): TutorialRun {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw new Error('Tutoriallauf ist beschädigt.');
  const fields = ['version', 'lessonRevision', 'runId', 'state'];
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).length !== fields.length || fields.some(key => !descriptors[key] || !('value' in descriptors[key]))) throw new Error('Tutoriallauf hat ein unbekanntes Format.');
  const row = value as TutorialRun;
  if (row.version !== applicationVersion || typeof row.lessonRevision !== 'string' || !row.lessonRevision || typeof row.runId !== 'string' || !row.runId || !['new', 'shown', 'finished', 'skipped'].includes(row.state)) throw new Error('Tutoriallauf hat ungültige Werte.');
  return { ...row };
}
export const lessons = [
  { id: 'campaign', title: 'Kampagne als Arbeitsraum', text: 'Lege eine Kampagne an oder übernimm eine v4-Dungeondatei als neue Kampagne. Der Import zeigt seine Grenzen vor der Übernahme. Die Quelldatei bleibt unverändert.' },
  { id: 'campaign-transfer', title: 'Kampagnen vollständig übertragen und löschen', text: 'Unter „Verwalten / Transfer“ exportierst du die geöffnete Kampagne mit Karten, Bildern, lokalen Audiodateien und wiederaufnehmbarem Arbeitsstand oder legst eine unabhängige Kopie an. Vor einem Import vergleichst und entscheidest du Konflikte gemeinsamer Definitionen. Der Papierkorb bleibt wiederherstellbar; dauerhaftes Löschen ist eine getrennte, ausdrücklich bestätigte Aktion.' },
  { id: 'drawing-and-key', title: 'Raum und Key zusammen bearbeiten', text: 'Suche nach Raumname, Nummer oder Keytext. Ziehe Eckpunkte oder gib Meterkoordinaten ein. Der Text bleibt daneben bearbeitbar. Geschosse werden getrennt angezeigt. Gezeichnete Konturen sind noch keine physischen 3D-Räume.' },
  { id: 'saving', title: 'Automatisch speichern und Arbeit wieder aufnehmen', text: 'Gültige Eingaben werden nach kurzer Pause gespeichert. „Gespeichert“ bestätigt den Autorenstand. Ungültige Raumtexte bleiben beim Kampagnenwechsel oder Schließen als Arbeitsentwurf erhalten. Nach Schreibfehlern zuerst den Speicherstatus prüfen. Rückgängig und Wiederholen ändern Kontur und Key gemeinsam.' },
  { id: 'world-notes', title: 'Weltwissen wiederfinden', text: 'Unter „Welt und Spielabend“ legst du NSCs, Fraktionen, Quests und Gerüchte an. Vorlesetext und GM-Notizen sind getrennte Felder. Die Suche findet auch GM-Notizen. Der Papierkorb hält Einträge für eine Wiederherstellung vor.' },
  { id: 'manual-planning', title: 'Eine Szenenfolge vorbereiten', text: 'Lege einen Plan an, füge Szenen hinzu und verschiebe sie in der Reihenfolge. Notizen und Reihenfolge bleiben nach Neustart erhalten. Ein Plan braucht weder Party noch Ort. Er erzeugt noch keine LiveSession.' },
  { id: 'locations', title: 'Orte, Szenen und Karten verbinden', text: 'Unter „Orte“ legst du einen Ort oder eine Stadt mit eigenen Abschnitten an. Verknüpfe eine vorhandene Dungeonzeichnung und wähle denselben Ort in einer Szene. „Ort öffnen“ führt zu den Notizen, „Karte öffnen“ zur Zeichnung. Ein Ort darf auch unverortet und ohne Karte bestehen. Die Zuordnung erzeugt keine Reise oder LiveSession.' },
  { id: 'relationships', title: 'Beziehungen verfolgen', text: 'Verknüpfe einen Wissenseintrag mit einem NSC, einer Fraktion, Quest oder einem Gerücht und benenne die Beziehung. Die Schaltfläche öffnet das Ziel; eingehende Verweise führen zurück zur Quelle. Ein Ziel im Papierkorb bleibt als solches sichtbar, statt den Verweis zu löschen.' },
  { id: 'live-party', title: 'Party und laufender Spielabend', text: 'Unter „Party und Leiten“ legst du Figuren an und aktivierst die heutige Party. Profilwerte bleiben optional. „Sitzung starten / weiterführen“ öffnet ausdrücklich die laufende Scene. Übernimm einen vorbereiteten Besuch nach Vorschau und bearbeite seine Inhalte während des Spiels weiter. Vorbereitung und Herkunft bleiben erhalten; der nächste Besuch benutzt dieselbe Scene und Uhr. Nach Neustart führt dieselbe Schaltfläche weiter.' },
  { id: 'groups', title: 'Partygruppen führen', text: '„Gruppe im Fokus“ wählt die Gruppe, deren Inhalte und Uhr du bearbeitest. Unter „Party aufteilen / zusammenführen“ wählst du Figuren und eine neue oder bestehende Zielgruppe. Eine neue Gruppe beginnt am Ort und Zeitpunkt der Ausgangsgruppe und besitzt danach eine eigene Uhr. Eine bestehende Zielgruppe behält ihre Inhalte und Uhr; prüfe den angezeigten Zeitpunkt vor der Übernahme. Leere frühere Gruppen findest du im Archiv zum Nachlesen.' },
  { id: 'relative-time', title: 'Zeit einer Gruppe fortsetzen', text: 'Unter „Zeit verstreichen lassen“ wählst du eine positive ganze Dauer in Sekunden, Minuten, Stunden oder Tagen. „Danach“ zeigt den Zeitpunkt vor der Bestätigung. Die Uhr der gewählten Gruppe wird gespeichert, andere Gruppenuhren bleiben unabhängig. Die Anzeige zählt seit Kampagnenbeginn; Fantasykalender, Reise und automatische Weltfolgen werden erst mit ihren jeweiligen Funktionen verbunden.' },
  { id: 'encounter-catalog', title: 'Begegnungen vorbereiten und leiten', text: 'Unter „Katalog und Encounter“ suchst du Kreaturen, liest ihren Statblock und stellst wiederverwendbare Begegnungsvorlagen zusammen. Planungsparty und Schwierigkeit gehören zur Vorbereitung. Erst die ausdrückliche Vorbereitung für die aktuelle Gruppe öffnet die Begegnung im Livebereich; Initiative, Trefferpunkte, Zustände und Abschluss sind dort bedienbar.' },
  { id: 'chase', title: 'Eine Verfolgung über Runden führen', text: 'Im Livebereich startest du für die fokussierte Gruppe eine Verfolgung. Trage Verfolger und Flüchtende mit Tempo ein. Pro Runde hältst du relative Distanz, Erschöpfung und eine Komplikation fest. Der Stand bleibt nach Neustart erhalten; der ausdrückliche Abschluss schreibt das Ergebnis in die Kampagnenchronik.' },
  { id: 'chronicle', title: 'Bestätigte Kampagnenfolgen nachlesen', text: 'Die Kampagnenchronik ordnet bestätigte Kämpfe, Questresultate, Belohnungen, Reisen, Partyänderungen und wichtige Weltfolgen zeitlich ein. Suche oder filtere die Einträge und gib die aktuelle Auswahl als Markdown aus. Korrekturen ergänzen den erklärenden Verlauf; die Chronik ist kein Ersatz für ein vollständiges Kampagnenpaket oder eine beliebige Zustandswiederherstellung.' },
  { id: 'session-content', title: 'Spielabendinhalte und Vorschläge verwenden', text: 'Ein vorbereiteter Besuch kann Vorlesetext, Weltverweise, NPC-Gruppen und Beute enthalten. Gruppen und Schätze werden ausdrücklich am Ort platziert. Generierte Vorschläge bleiben Vorschläge, bis du einzelne Besuche annimmst. Beim Spielen übernimmt die Vorschau den ausgewählten Besuch in die fortbestehende Gruppe; platzierte NPCs behalten ihre Trefferpunkte.' },
  { id: 'items-trade', title: 'Gegenstände, Beute und Shops', text: 'Unter „Gegenstände und Shops“ legst du eigene Gegenstände mit Beschreibung und Richtwert an. Vergib Beute ausdrücklich oder bestücke den Shop eines Ortes / NPCs. Käufe buchen Bestand und persönlichen Verlauf zusammen und zählen nicht als erhaltene Beute. Teilverkäufe halten den tatsächlichen Erlös fest. Feste Auffüllregeln folgen bestätigter Spielzeit.' },
  { id: 'atlas-hex', title: 'Hexkarten und Orte bearbeiten', text: 'Unter „Atlas und Reise“ erstellst du eine Hexkarte und klickst ein Hex zum Bearbeiten an. Gelände, Höhen, Straßen, Flüsse und Klima sind editierbar. Mit dem Pinsel bearbeitest du mehrere Hexes. Markiere bestehende Orte auf der Karte; Mauswheel oder die Zoomschaltflächen wechseln den Maßstab. „Gruppe hier platzieren“ setzt eine ausdrücklich gestartete Gruppe ohne Reisezeit.' },
  { id: 'travel-checkpoints', title: 'Eine Reise wirklich fortsetzen', text: 'Wähle Gruppe und Ziel und lass Route, Dauer und Ankunft anzeigen. Gelände, Tempo und Wetter wirken auf die Vorschau; eine vorgegebene Enddauer gewinnt. Die Annahme bewegt noch niemanden. Bestätige den nächsten Abschnitt oder gehe bis zur nächsten Grenze weiter. Ein markierter Hinweis hält für deine Entscheidung an. Nach Neustart bleibt die angenommene Reise verfügbar.' },
  { id: 'calendar-events', title: 'Kalender und örtliche Ereignisse', text: 'Bearbeite Monate, Tageslänge, Wochentage und erstes Jahr im Atlasbereich. Ein anderer Kalender deutet dieselben aufgezeichneten Zeitpunkte neu. Ereignisse können einmalig oder wiederkehrend und an einen Ort gebunden sein. Im Livebereich erscheinen die Ereignisse, die zur Zeit und zum Ort dieser Gruppe passen; narrative Folgen entscheidest du selbst.' },
  { id: 'weather-control', title: 'Wetter entwickeln und ausdrücklich vorgeben', text: 'Das Kartenklima und regionale Hexklimate liefern saisonales Wetter. Eigene Wettergebiete besitzen Zentrum, Größe, Bewegung, Dauer und Hinweise und können pausiert oder beendet werden. Wetter folgt bestätigter Gruppenzeit. Die Liveanzeige nennt Sicht und Reiseeffekte. Ein GM-Wetteroverride bleibt für diese Gruppe bestehen, bis du „Wetterautomatik freigeben“ wählst.' },
  { id: 'dungeon-tools', title: 'Grundriss, Geschosse und gebundene Details zeichnen', text: 'Karte und Keys enthält direkte Zeichenwerkzeuge. Rechteck oder Polygon bestätigen, Höhlen mit Pinsel anfügen oder ausradieren und Wände, Türen, Licht, Objekte, Flächen und Text setzen. Türen binden an die gewählte Raumkontur; Raumtransformationen bewegen gebundene Details gemeinsam. Alle Autorenänderungen nutzen denselben Undo-Cursor. Raum-Keys behalten ihre IDs, Archiv und Geschossgeometrie-Kopien erhalten Originaltexte. Deckenhöhe und Schnittansicht zeigen die metrischen Höhen. Fallen-Charges verbrauchst du ausdrücklich; Reset benutzt bestätigte Gruppenzeit und wird durch Autoren-Undo nicht zurückgespult.' },
  { id: 'npc-autonomy', title: 'NPCs mit begrenztem Verhalten beauftragen', text: 'Unter NPC-Verhalten aktivierst du bestehende Figuren oder Gruppen. Bedürfnisse, Rollen und Prioritäten wählen gültige Jobangebote. Lege erreichbare Ortswege und exklusive Angebote an. Nur bestätigte Gruppen-/Reisezeit zählt; ausstehende Intervalle behalten ihre damaligen Regeln. Bestätigte Zeit nachholen arbeitet in kurzen atomaren Schritten. Partygefahr hält vor einer Wirkung an; der Verlauf erklärt Auswahl, Ausschlüsse und GM-Entscheidungen.' },
  { id: 'player-display', title: 'Der fokussierten Gruppe ein eigenes Fenster geben', text: 'Spieleranzeige öffnet eine schreibgeschützte Anzeige auf dem gewählten Bildschirm. Reisen zeigen bekannte Geometrie und aktuelle Sicht der fokussierten Figuren; am Ort folgt ein hinterlegtes Ortsbild. NPC-Bilder zeigst du ausdrücklich. Ausblenden und Bildoverride ändern keine Charakterkenntnis. Sichtweiten, Licht, Wetter, Höhen und Masken filtern die Ansicht; freigegebene Beschriftungen sind getrennt von GM-Texten.' },
  { id: 'extensions', title: 'Lokale Erweiterungspakete kontrollieren', text: 'Unter „Erweiterungen“ prüfst du ein lokales Paket und bestätigst genau die angezeigten Rechte. Widerrufen entfernt die Rechte; Entfernen löscht zusätzlich den gespeicherten Paketcode, bewahrt aber kampagneneigene Zusatzdaten. Ein unklarer früherer Auftrag sperrt neue Änderungen, bis der aktuelle Installationsstand vollständig gelesen und der beschädigte Vermerk ausdrücklich gesichert wurde. Erweiterungscode wird in diesem Produktstand noch nicht ausgeführt.' },
  { id: 'city-infill', title: 'Vom Straßenzug zum editierbaren Stadtplan', text: 'Lege zuerst einen Kampagnenort an und öffne Städte. Zeichne Straßen, Viertelflächen und Hindernisse in Metern. Dichte, Hausgröße, Abstand und Seed erzeugen eine Vorschau; erst Bebauung übernehmen speichert Häuser. Benenne oder verändere einzelne Häuser: sie bleiben bei Regeneration geschützt. Rückgängig/Wiederholen, Papier-/Dachfarben und SVG-Ausgabe verwenden den gespeicherten Stadtstand.' },
  { id: 'music-library', title: 'Lokale Musik und Umgebungs-Sounds', text: 'Unter „Musik und Ambience“ fügst du lokale Audiodateien hinzu und beschreibst sie mit Intensität, Stimmung, Vibes, Genres und Notizen. Eigene Stimmungsachsen stehen auch als Szenenregler bereit. Die Bibliothek lässt sich mit Medien exportieren und auf einem anderen Rechner importieren. Beschreibungen und Medien werden lokal verwaltet.' },
  { id: 'music-transport', title: 'Manuelle Wiedergabe hat Vorrang', text: 'Wähle einen Titel, stelle die Warteschlange zusammen und bediene Pause, Stopp, Weiter, Zurück, Position und Loop. Der kleine Player bleibt beim Wechsel des Arbeitsbereichs sichtbar. Ein manueller Stopp hält auch eingeschaltetes Autoplay an. „Automatik freigeben“ setzt die Auswahl aus der aktuellen fokussierten Gruppe fort. Auswahl und bestätigte Position bleiben gespeichert. Nach erneutem Öffnen bleibt die Ausgabe stumm, bis du ▶ oder einen Titel ausdrücklich startest.' },
  { id: 'music-context', title: 'Musik und Wetter zur Gruppe passen lassen', text: 'Autoplay verwendet Stimmungsregler und Tags der fokussierten Gruppe. Orte, NPCs, Fraktionen und Kreaturprofile können Vibes oder Genres ergänzen oder ersetzen. Die Umgebungsautomatik wählt passende Sounds für Gelände, Wetter und Tageszeit. Füge Sounds ausdrücklich hinzu oder unterdrücke einzelne automatische Sounds; erst die Freigabe beendet diese Vorgabe.' },
];

export const tutorialSurfaceLessons={
  atlas:'drawing-and-key',preparation:'world-notes',live:'live-party',chronicle:'chronicle',catalog:'encounter-catalog',items:'items-trade',dungeon:'dungeon-tools',autonomy:'npc-autonomy',city:'city-infill',world:'atlas-hex',music:'music-library',
  'player-open-controls':'player-display','campaign-manager':'campaign-transfer',import:'campaign','extensions-open':'extensions',
} as const;

export async function initTutorial() {
  const dialog = document.getElementById('tutorial-dialog') as HTMLDialogElement;
  const content = document.getElementById('tutorial-lessons')!;
  for (const lesson of lessons) {
    const item = document.createElement('li'), title = document.createElement('h3'), text = document.createElement('p');
    title.textContent = lesson.title; text.textContent = lesson.text; item.append(title, text); content.append(item);
  }
  const heading=document.getElementById('tutorial-heading')!;let opener:HTMLElement|null=null;
  const open=()=>{if(dialog.open)return;opener=document.activeElement as HTMLElement|null;dialog.showModal();heading.focus({preventScroll:true});};
  document.getElementById('help')!.onclick = open;
  let dismissed = false;
  const warning = () => { document.getElementById('tutorial-warning')!.textContent = 'Tutorialstatus konnte nicht gespeichert werden. Das Werkzeug bleibt benutzbar.'; };
  const finish = async (state: 'finished' | 'skipped') => {
    dismissed = true;
    dialog.close();
    if(opener?.isConnected)opener.focus({preventScroll:true});
    try { const result = await window.campaign.tutorial(state); if (!result.ok) warning(); }
    catch { warning(); }
  };
  document.getElementById('tutorial-done')!.onclick = () => { void finish('finished'); };
  document.getElementById('tutorial-skip')!.onclick = () => { void finish('skipped'); };
  dialog.addEventListener('cancel', () => { void finish('skipped'); });
  try {
    const result = await window.campaign.tutorial();
    if (!result.ok) throw new Error(result.error);
    if (result.value.state === 'new' && !dismissed) {
      open();
      const marked = await window.campaign.tutorial('shown');
      if (!marked.ok) warning();
    }
  } catch { document.getElementById('tutorial-warning')!.textContent = 'Tutorialstatus nicht verfügbar. Erste Schritte bleiben über „Hilfe“ erreichbar.'; }
  finally { document.body.dataset.tutorialReady = 'true'; }
}
