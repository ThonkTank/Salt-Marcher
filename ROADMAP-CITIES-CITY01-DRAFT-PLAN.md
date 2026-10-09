# CITY-01-Vorbereitung: Werkzeugentwurf, Abbruch und Apply

## Start, Auftrag und Modulgrenze

CITY-01-PREP-P05 folgt der reviewten [lokalen Szene](ROADMAP-CITIES-CITY01-SCENE-PLAN.md). Ziel ist der transiente Kern für Straßen-/Hausaktionen: kein dauerhafter Zwischenstand, expliziter gültiger Abschluss, ein gemeinsamer Historybefehl und unveränderte Kennungen. CTY-002.01/CTY-002.02 und die I40-Hauskonturpräzisierung bleiben Maßstab. Renderer, Pointerrouter, Werkzeugleiste, gespeicherte Atlasplatzierung und Save/Reload folgen weiter dem [HEX-05-Anschluss](ROADMAP-CITIES-CITY01-INTEGRATION-PLAN.md).

Neue Datei `src/features/city/draft.ts`, Tests `tests/core/city-draft.test.ts`, ein Import im vorhandenen Testeinstieg. Keine eigene Kamera, History, Source-Registrierung, Dateiaktion, globale Werkzeugwahl oder zweite mutable Stadtquelle. Der Aufrufer liefert die vorhandene CitySource und lokale Edits; project/unproject und rohe ungeschlossene Zeichenpunkte liegen beim späteren Atlasrouter. Der Draft verwaltet den unveränderlichen Beginn und genau eine aktuelle, davon abgeleitete Vorschau.

## Reproduzierte gemeinsame History-Lücke

CITY-HISTORY-P05-01: Im aktuellen `AtlasHistory.notify()` wirft der erste fehlerhafte Subscriber durch `execute/undo/redo` hindurch. Aktuelle Modulgegenprobe: execute wirft `observer failure`, Besitzerwert ist dennoch 2 statt 1 und undoDepth ist 1; zweiter Subscriber wurde nullmal aufgerufen. Beleg: `/home/aaron/.cache/dungeon-native-qa/city-plans/city01-gestures-20261009/p05-history-observer-probe.json`. Das betrifft auch TerrainStroke.finish, dessen ended-Flag erst nach execute gesetzt wird.

Vor einem verlässlichen Draft-Apply muss gelten: History wirft nur vor Übernahme; Beobachterfehler können keinen bereits übernommenen Befehl als abgelehnt erscheinen lassen. Mit dem Hex-Besitzer koordiniert: privates notify isoliert Fehler je Subscriber, meldet sie separat und informiert die übrigen Subscriber weiter. Keine neue öffentliche API, kein Rollback nach Benachrichtigung und keine zweite Befehlsquelle. Geplante minimale Diagnose: console.error mit festem Kontext und Fehlerobjekt; auch eine fehlerhafte Diagnoseausgabe darf den bereits übernommenen Befehl nicht nachträglich scheitern lassen. Validierungs-/Stalekonflikte bleiben unverändert werfend **vor** Mutation. Vor I05 prüfen, ob der Besitzer diese Reparatur inzwischen selbst übernommen hat; seine Version gezielt reviewen statt parallel implementieren.

## Konkrete Draft-API

`CityDraft` besitzt folgende readonly Zustandszugriffe und Methoden:

| API | Verhalten |
|---|---|
| `new CityDraft(source: CitySource)` | Einmal source.read als tief unveränderlichen Gestenanfangsstand aufnehmen. State editing, keine fertige Vorschau, kein Historyeintrag. Kein erneutes Registrieren/Hydrieren. |
| `before: CityDocument` | Nur der unveränderliche Beginn. Entwurf verwendet danach niemals einen frisch gelesenen Vorherstand für Apply. |
| `state` | editing, invalid, failed, applied oder cancelled. failed ist terminal für SetEdits/Apply; Cancel darf den fehlgeschlagenen Entwurf schließen. Ein neuer Zug braucht eine neue Draftinstanz. |
| `preview: CityDraftPreview \| null` | Nur das aktuelle gültige Ergebnis, mit document und daraus berechneter CityScene. Eigene tief unveränderliche Daten. Initial, nach clearPreview, Invalidität, Apply, Fehler oder Cancel null. Keine scheinbar gültige ältere Vorschau bei neuer ungültiger Bewegung. |
| `setEdits(edits: readonly CityEdit[]): CityDraftPreview` | Immer alle finalen Edits gegen before berechnen; nicht kumulativ auf voriger Vorschau. editCity und cityScene vollständig prüfen, dann die Vorschau als eine Einheit austauschen. Fehler löscht Vorschau, setzt invalid und wirft; gültiges Folgeupdate kann invalid wieder in editing überführen. Keine Historymutation. |
| `clearPreview(): void` | In editing/invalid fertige Vorschau entfernen und editing setzen. Der Router nutzt dies bei unvollständiger Kontur oder veränderter Zeichnung, bis explizites Schließen einen vollständigen CityEdit liefert. Rohpunkte sind kein gültiger gespeicherter Stadtstand. |
| `apply(label: string): boolean` | Nur editing mit vollständiger Vorschau. Nichtleeres string-Label bis 200 Zeichen vor Befehl prüfen. cityDocumentChange(before, preview.document) als einzigen Change über source.history.execute übernehmen. Erst nach erfolgreicher Rückkehr state applied und Vorschau löschen; No-op liefert false, schließt den Entwurf und erhält Redo. Echte Precommit-Ablehnung setzt failed, löscht Vorschau und wirft. Kein Retry, Rebase oder Lesen neuer Baseline. |
| `cancel(): boolean` | editing/invalid/failed → cancelled, Vorschau null. Kein Historyaufruf, keine Rückschreibung des alten before. applied/cancelled liefern false; Cancel nach Apply ist kein heimliches Undo. |

CityDraftPreview enthält ausschließlich document und scene. Kein Pixiobjekt, Callback, Pointer, persistenter Entwurf oder Cache anderer Dokumente. Nach Apply bleibt das ausgewählte Werkzeug im Atlas unverändert; die Klasse startet keine zweite Platzierung und erstellt keine neuen Kennungen. Erneuter Aufruf von Apply oder SetEdits auf einem geschlossenen/fehlgeschlagenen Draft wird kontrolliert abgelehnt.

## Gestenvertrag für den späteren Router

- Bei Beginn eine stabile Dokument-/Elementadresse und den CityDraft aufnehmen. Lokale Pointerwerte kommen aus dem bestätigten unproject-Vertrag. Bewegung, Drehung und Skalierung werden aus Anfangspose und aktueller lokaler Eingabe berechnet; wiederholte Pointerupdates addieren keinen Drift. CityEdit bleibt Besitzer der finalen Geometrieprüfung.
- Straßen-/Hauszeichnung behält ihre rohen endlichen Punkte in einer abbrechbaren Routervorschau. Solange nicht ausdrücklich geschlossen/abgeschlossen, keine fertige Draftpreview und kein Apply. Ein gültiger Abschluss materialisiert einen Edit mit den am Zugbeginn reservierten callerbestimmten IDs. Erneutes Ändern der Rohkontur ruft clearPreview auf, damit ein alter Abschluss nicht versehentlich übernommen wird.
- Escape, Pointerabbruch und Schließen entsorgen die Vorschau über Cancel. Zwischenzeitlich fremd geänderte CitySource wird dabei erhalten; niemals before restaurieren. Zoom/Pan löschen weder Ziel noch Werkzeug, sondern verändern nur die Aufruferprojektion.
- Während des Zugs geänderte aktuelle Stadt führt beim Apply zum bestehenden Atlas-Stalekonflikt. Entwurf failed; Nutzer muss ausdrücklich einen neuen Zug beginnen. Andere Besitzer und Redo bleiben erhalten. Vollständige sichtbare Bedienung, Pointercapture und Routerereignisse sind nicht Teil dieser Coreabnahme.
- Dokumentübergreifende Gesten brauchen weiterhin einen gemeinsam gebauten AtlasCommand. Dieser Draft gilt für genau einen CityOwner; Bindungsbewegung mehrerer Dokumente wird erst am echten HEX-05-Vertrag erweitert.

## Bedeutungsvolle Prüfungen

1. Neue Draftinstanz und mehrere vollständige Vorschauupdates erzeugen keine Historyeinträge, Benachrichtigungen oder Sourceänderungen. Anfangsstand unverändert; letzter Kandidat enthält nur den finalen Meterwert, keine kumulative Drift. Ergebnis und Szene tief gefroren, fremde Payloads bleiben ungefroren und nachträgliche Mutation wirkt nicht auf die Vorschau.
2. Stadtstraße und Haus in einem Paket: ein Apply/Undo, exakte gemeinsame Wiederherstellung und Redo. Cancel vor Apply erhält alle Werte, Stack und Redo; Cancel nach Apply verändert nichts. No-op erhält vorhandenes Redo, wiederholter Apply erzeugt keinen zweiten Befehl.
3. Anfänglich unvollständiger Draft, clearPreview nach validem Abschluss und ungültige Geometrie können nicht übernommen werden. Ungültiges Update löscht die vorige Vorschau; gültiges Folgeupdate kann neu vorbereitet werden. Hauskonturabschluss und Straßenabschluss per vollständigem Edit nachbilden, keine sichtbare Pointergeste aus dieser Nachbildung behaupten.
4. Reale CitySource plus TerrainSource an derselben History: fremde Cityänderung nach Beginn verhindert das ganze City-Apply, andere Besitzer bleiben erhalten. Fremder Terrainbefehl allein macht City nicht stale; Apply folgt in derselben gemeinsamen Undo-Reihenfolge. Cancel nach Fremdänderung stellt before nicht wieder her.
5. failed/applied/cancelled sind für weitere Updates geschlossen; falsches oder leeres Label wird vor Historyaufruf abgelehnt, gültige Labels werden unverändert übernommen. Kein neu erzeugtes Source-/Dokument-/Element-ID.
6. Reproduzierte Subscriberlücke als Regression: erster Listener wirft, zweiter zählt. execute, undo und redo liefern trotzdem korrekte Ergebnisse/Werte/Stacks, alle verbleibenden Subscriber werden informiert, Fehler wird separat diagnostiziert. No-op und echte Precommit-Ablehnung benachrichtigen weiterhin nicht. Ein fehlerhafter Diagnosesink darf keine falsche Apply-Ablehnung erzeugen. Zusätzlich echter TerrainStroke.finish und CityDraft.apply mit werfendem Listener, kein nachträglicher zweiter Commit.

`npm run check`, `npm test`, `npm run build` nacheinander. Externe Quellenhashes/Logs und separate Zustandsgegenprobe unter `/home/aaron/.cache/dungeon-native-qa/city-plans/city01-gestures-20261009/`. I05, R06, erforderliche N/R und Aufräum-P/I/R sind getrennte fokussierte Läufe. Review betrachtet History-Fehlergrenze, terminale Zustände, unvollständige Zeichnung, Stalekonflikte und Quellenownership; Aufräumen betrachtet unnötige zweite Kandidaten, APIfläche, Abhängigkeiten und Listenerlebensdauer. Alle CTY-/CO-, Grafik-, Host-, physische Bedien- und Speicherabnahmen bleiben offen.
