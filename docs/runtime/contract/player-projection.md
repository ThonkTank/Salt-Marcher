# Passive Spielerprojektion: Karten, Art und sichere Ausgabe

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 20.10.2026. Ergänzt den [Player-/Extensionanschluss](../../project/requirements/product-scope-2.md#smr-10--zweites-display-extensions-und-vollständige-portabilität)
und den [Gesamtumfang](../../project/requirements/scope.md).

## Gebundener Vertrag und Entscheidung

Die Program Capabilities, Revision `9de85c1a26f526acbc1af332ac5962e185c0aab2`,
L289–302 und L388–406, verlangen einen passiven Bildschirm für Karten und
NPC-/Ortsart. Er folgt der fokussierten Scene, kombiniert dauerhafte
Characterkenntnis mit aktueller Wahrnehmung und bleibt durch GM-Blank und
Artoverride kontrollierbar. Neue Anzeigeänderungen binden zusätzlich an die
tatsächlich vorgesehene Focus-ID, Focusrevision, Mitgliedschaftsrevision und aktuelle Orts-ID; der GMdialog benennt diese
Gruppe ausdrücklich. Ein A/B/A-Wechsel oder geänderte Mitgliedschaft/Ortsbindung bei gleichem Fokus erhält keine alte Freigabeautorität. Die Quelle schließt Mechanik, Erzähltext und private
Notizen ausdrücklich aus. Die gebundenen Scene-/LiveSessionanforderungen
beschreiben die GM-Arbeitsflächen; sie erweitern diesen Displaykanal nicht.
Quellenhash: `714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`.

Die zuvor integrierten Initiative-/HP-/Chasepakete und der Vorlesetextmodus
widersprachen diesem Vertrag. Ihre Filtertests belegten einzelne ausgelassene
Privatfelder, keine zulässige Produktvariante. Die frühere positive Einordnung
war falsch. Die Entscheidung ist nun im tatsächlichen Ausgabeweg umgesetzt:
Mechanik und Vorlesetext bleiben in ihren GM-Ownerdaten und werden nicht über
den passiven Kanal publiziert. Automatische Actorart während Encounter/Chase
besitzt weiterhin ihren unten beschriebenen eigenen Anschluss.

## Aktueller Anschluss und Feldgrenze

`storage/player.ts.projectPlayer` komponiert nur Blank, Karte, Dungeonkarte
oder freigegebene Art. Laufende Kampf-/Verfolgungsmasken ersetzen eine gültige
Ortsart oder Karte nicht mehr durch Mechaniktabellen. Die GM kann NPC-/Orts-/
eigene Art weiterhin ausdrücklich hervorheben. Private Scene-/Maskentitel
werden nicht automatisch als öffentliche Überschrift übernommen; ausdrücklicher
öffentlicher Titel und freigegebene Kartenbeschriftungen bleiben eigene Metadaten.
Ein entferntes NPC-Porträt bleibt als historisches Asset erhalten, darf aber
bei keiner neuen Veröffentlichung erneut freigegeben werden. Das gilt auch
bei unveränderter Bild-ID und Gruppe; bestehende Ansichten werden dadurch
nicht aus der gespeicherten History gelöscht.

`PlayerFrame` und `PlayerDungeon` in `player-contracts.ts` enthalten nur diese
visuellen Varianten. Dungeonposition, bekannte/sichtbare Geometrie, freigegebene
Labels, Markerformen und Spurengeometrie bleiben erhalten. Beschreibung,
gehörte Hinweise, interne Geschossnamen und unbenutzte Marker-/Spurenprosa
werden nicht mitgeführt. Der reichere `dungeonDisplay` bleibt ein GM-/
Wahrnehmungsreader; seine Inhalte werden weder gelöscht noch umgeschrieben.

`visualPlayerFrame` in `player-frame.ts` führt die Feldfreigabe an der tatsächlichen
Hostgrenze aus. `desktop/player-window.ts` benutzt sie für Push und Pull.
Unbekannte/alte Text- und Mechanikvarianten ergeben ein neutrales Paket; auch
auf sonst gültigen Bildern/Karten angehängte fremde Daten und verschachtelte
Geometrieprosa werden nicht übertragen. GM-Erklärungen für Blank bleiben im
GMreader und gehören nicht ins Fensterpaket. Der Renderer akzeptiert ebenfalls
nur die visuellen Varianten, bevor er eine Überschrift erzeugt. Ein alter
Scene-/Combat-/Chaseframe darf daher weder Inhalt noch Kopfzeile zeichnen.

Die GM-Steuerung ist direkt im Atlas und im Arbeitsflächenkopf erreichbar.
Sie stellt die Hexfreigabe neben die tatsächliche Ausgabe: eine private GM-Karte
zeigt höchstens 61 ausgearbeitete Nachbarhexe; Namens-/Koordinatensuche führt
auch zu entfernten Hexen. Auswahl allein veröffentlicht nichts. Die private Hexkarte ist ein Tabstopp;
Pfeiltasten bewegen nur den Fokus, Enter oder Leertaste wählen das Hex. Der
Fokus bleibt bei Neuzeichnungen auf demselben Hex; Tab führt zur öffentlichen
Beschriftung, ohne durch sämtliche Nachbarhexe zurückzugehen. GM-Namen werden
nur durch ausdrückliches Übernehmen zu öffentlichen Beschriftungen. Eine
Hexentdeckung ohne Ortsbindung speichert den bestätigten Namen atomar mit der
Charakterkenntnis und erhält vorhandene Hidden-/Sichtblockerflags. Ortsgebundene
Entdeckungen behalten ihre eigene bestätigte Ortsbeschriftung. Ausblenden löscht
keine Kenntnis; die Wiederaufnahme erfolgt ausdrücklich über Anzeigen.
`PlayerView.maps[].cells` ist ausschließlich GM-Auswahldaten; `PlayerFrame`
und der passive Preload erhalten diese Daten nicht. Die Hexauswahl und ihr
Schreibweg liegen in `player-map-controls.ts`, `player-ui.ts` und
`storage/player.ts`. `tools/test-desktop-player-map-reveal.mjs` prüft den
vollständigen Kartenablauf mit nativer Ausgabe, Ausblenden und Neustart.

## Alte Einstellungen und neue Bedienung

Gespeicherte `mode: "scene"`-Einstellungen bleiben gültige historische Daten.
Reader, Backup und unabhängige Campaignkopie erhalten sie einschließlich
bisheriger Gruppenbindung oder zulässiger fehlender Altbindung. Der Composer
liefert dafür neutral Blank mit einer Erklärung im GMdialog. Er veröffentlicht
keinen Text und interpretiert die Einstellung nicht still als neue Freigabe.

Neue Textmoduscommands werden vor Wirkung und Receipt abgewiesen. Die
produktive Steuerung und der Live-Cue bieten automatische Karten-/Artansicht,
ausdrückliche Bildwahl bzw. Blank; beide Vorlesetextbuttons wurden entfernt.
Live-Cues öffnen Ortsart, NPC-Porträts oder ein
spontanes Handout direkt für die geprüfte Gruppe. Im geöffneten NSC-Dossier
am Szenentisch stehen „Porträt für Spieler zeigen“ und „Anzeige leeren“ direkt
neben den privaten Angaben. Das Zeigen verwendet den geöffneten NSC und die
geprüfte Fokusgruppe; offene Angaben werden vor der Freigabe gesichert.
Die bestätigte Schreibantwort aktualisiert Vorschau und Rückmeldung unmittelbar;
ein zweiter Previewread nach der Freigabe ist dafür nicht erforderlich. Ein
fehlgeschlagener oder hängender zusätzlicher Read darf eine bereits bestätigte
Anzeige nicht als fehlgeschlagen melden. Blank
wartet nicht auf diese Speicherung und widerruft einen noch offenen Bildauftrag.
Ein ausgeblendetes Bild bleibt nach Neustart ausgeblendet, bis es erneut bewusst
gezeigt wird. Die native Ablaufprüfung liegt in
[test-desktop-npc-portrait.mjs](../../../tools/test-desktop-npc-portrait.mjs);
Editorwechsel und konkurrierende Aufträge prüfen die
[Desk-Regressionen (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/runtime/desktop-desk-owner-dom.test.mjs).
Eine neu ausgewählte Orts-ID
wird als sichtbarer Auftrag gebunden; erst ihr erfolgreicher Save erlaubt die
direkte Bild-/Livefreigabe. Ein Savefehler veröffentlicht nichts.
Ein Pickerabbruch ändert die
Anzeige nicht. Änderungen an Fokus oder Mitgliedern während der Auswahl
verhindern die Freigabe; gespeicherte Art bleibt erhalten. Genau ein neues Bild
mit passendem Typ und Ziel muss die Auswahl bestimmen. Bei parallelen,
mehrdeutigen Ergänzungen erfolgt keine willkürliche Freigabe; das Bild lässt
sich im bestehenden Dialog auswählen. Die Gegenproben stehen in
[desktop-player-focus.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/runtime/desktop-player-focus.test.mjs).
Blank benötigt keinen vorgelagerten Previewread und funktioniert auch bei
ausgefallener oder hängender Steuerungsquery.
Ein ausdrücklich gewählter neuer visueller Modus ersetzt die alte Einstellung.
Scene-Vorlesetext, Notizen, Combat-/Chasestände, Drafts und Characterkenntnis bleiben
in ihren bisherigen Ownertabellen erhalten. Keine Datenmigration erforderlich.

## Große Karten und lokaler Nachweis

Die iterative Grenzberechnung des Renderers bleibt erhalten. Die früheren
Argumentlisten von `Math.min`/`Math.max` scheiterten bei 150.000 Hexen oder
160.000 Polygonpunkten. Laufende Extremwerte benötigen keine zusätzliche
geflattete Punkt-/Achsenliste; Geometrie und Kenntnis werden nicht abgeschnitten.
Der vorhandene schlanke DOMtest belegt diese Berechnung, keine native SVG-/GPU-
oder Latenzqualifikation. Der neue Hostfilter kopiert die freigegebenen Felder;
Gesamtkosten großer Frames sind weiterhin zu messen und gemeinsam zu begrenzen.

`desktop-player-visual-contract.test.mjs` belegt mit echtem Store:
Ortsart bleibt trotz aktiver Masken, Mechanik bleibt GM-owned, neue Textaufträge
haben keine Teilwirkung/Receipt und alte Textsettings bleiben über Fresh,
Backup/Copy erhalten und neutral. Eine weitere Storegegenprobe verwirft alte Freigaben bei neuer Mitgliedschaft
ohne Fokuswechsel atomar; nach erneutem Prüfen ist dieselbe visuelle Freigabe gültig.
Die direkte NPC-Bildprobe verwendet vorhandene freigegebene PNGart ohne neue
Dateiwahl; private NPC-/Scenerecords bleiben exakt erhalten.
Jede neue nichtleere NPC-Bildfreigabe prüft jetzt den aktiven Noteowner, auch
bei unveränderter Bild-ID. Die Retire-/Restore-/erneute Retire-Gegenprobe erhält
Bildhistorie und verweigert neue Freigabe ohne Teilwirkung.
Renderer-Gegenproben prüfen alte Pakete
samt Überschrift. `desktop-player-visual-host.test.mjs` prüft echte Hostmethoden mit
kontrollierten Fenstern: Push/Pull, erlaubte Feldmenge und verschachtelte Daten.
`desktop-player-focus.test.mjs` prüft inzwischen dieselben gültigen
Bildfreigaben mit realem PNG statt des früheren Textmodus: ältere Commands,
A/B/A, fehlende Basis, Replay, erhaltene GM-Entwürfe, verzögerte Writes,
Notfall-Blank ohne Previewread und Handoutwahl bei geänderter Gruppe.
Der vorhandene Windowtest ergänzt die Lebenszyklusfälle. Die weiteren
Dungeon-/Knowledge-/Editor- und Größenproben ergänzen
Karten, gespeicherte Kenntnis, GM-Steuerung und alte asynchrone Antworten.

`desktop-live-visual-context.test.mjs` benutzt die Browser-Event-Realm und
aktuelle Party-/Ledgerreads für sechs Autosave-/Create-Prüfungen einschließlich
Vorlesetext; drei weitere Fälle prüfen sofortige Freigabe einer neuen
Ortsauswahl und fehlgeschlagenes Speichern. Die früheren Coretests für Combat-/Chase-/Sceneprojektion wurden an den
gebundenen Vertrag angepasst: GM-Wirkungen und Sichtbarkeitswerte bleiben
prüfbar; ihr Fortschritt darf keine Mechanik auf den passiven Bildschirm bringen.
Ein falsches früheres Ausgabeergebnis ist keine Regressionserwartung.
`tools/test-desktop-player-scene-privacy.mjs` wurde an die Ortsartaufgabe statt
der früheren Text-/Mechanikausgabe angepasst. Der Fokusprüfer verwendet Karten und die aktuelle Mitgliedschaftsbasis.
Der native Dialog-/Handoutlauf auf dem Stand `ea0d616c` vom 14.10.2026
bestand: alte Freigabe abgewiesen, Neustart Blank, Entwurf nach Fehler erhalten,
Nachhutkarte nach erneuter Bestätigung und ein dekodiertes 80 × 50-Handout.
Sceneinhalte blieben unverändert; beide Appstarts endeten normal. Der erneute
native Live-Cue-Lauf blieb im Appstart hängen und ist für diesen Stand offen.
Die davor erfolgreichen Cue-Läufe ersetzen diese Wiederholung nicht. Der
aktualisierte native Ortsart-/Privacy-Lauf ist ebenfalls offen.
Die Nachweise sind lokale Store-/Host-/kontrollierte DOMbelege, keine native
Gesamt-/Privacy-/Plattformabnahme oder vollständige SMR-AC-14-Freigabe.

## Nächste ausführbare Abschlüsse

1. **Bounded Query und Darstellung gemeinsam liefern.** Composer,
   `dungeonDisplay`, Fensteradapter und Renderer bearbeiten noch vollständige
   bekannte Ausschnitte. Scene-/Kamerabasis gemeinsam definieren und nur nötige
   Geometrie/Details übertragen. Kenntnis außerhalb des Ausschnitts bleibt
   gespeichert. Abnahme: viele entfernte bekannte Orte, Fokuswechsel und Fresh;
   keine neue GM-Wahrheit aus ungesehenen Bereichen. Kopier-, JSON-/IPC-, Pfad-
   und DOMkosten am selben konkreten Größenfall messen.
2. **Artwork-/Maskenanschluss vollständig liefern.** GM-Hervorhebung bleibt
   ausdrücklich. Optionale automatische Art des aktuellen Encounter-/Chaseactors
   an dessen Identität, freigegebenes Asset und aktuelle Scene/Fokus binden.
   Fehlende oder verborgene Art erklärt/neutral behandeln; keine Ersatztexte,
   Status-/Mechanikwerte oder ungeprüften Actorbilder erfinden. GM-Override und
   Blank haben Vorrang. Maskenwechsel, Hidden, gelöschter Actor, Replyverlust und
   Fresh prüfen, ohne confirmed Masken-/GMdaten umzuschreiben.
3. **Public Assets und vollständige Ausgabeclosure prüfen.** Für jede tatsächlich
   veröffentlichte Karte/Art einen expliziten Publicprofil-/Assetnachweis führen.
   Originalcontainer, EXIF/PNGtext, private Pixels, lokale Pfade und ungeprüfte
   Providerresultate bleiben außerhalb des Displaykanals. Aktuelle Auswahl,
   Ressourcen-/Session-/Fenstergeneration und Widerruf gemeinsam binden.
4. **Native Wirkung qualifizieren.** Echte Player-Session mit großer Geometrie,
   Blank, Art-/Decoderfehlern, Scenewechsel und Neustart; physische Monitorwahl,
   DPI, Fullscreen, Tastatur/100 % sowie Linux/Windows/macOS. Ein kontrolliertes
   Fenster ist kein Beleg für diese Aufgaben. Nichtnative Feldtests bleiben
   separat von sichtbarer Ausgabe und gemessener Ressourcenfreigabe.
