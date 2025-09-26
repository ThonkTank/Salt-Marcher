# Encounter Workspace – Gateway & Ist-Zustand

## Strukturdiagramm
```
TravelGuideMode.onEncounter
    └─ EncounterGateway.openEncounter (travel-guide/encounter-gateway.ts)
         ├─ ensureEncounterModule()
         │    └─ import core/layout → getRightLeaf()
         │    └─ import apps/encounter/view → VIEW_ENCOUNTER
         └─ WorkspaceLeaf.setViewState({ type: VIEW_ENCOUNTER })
EncounterView (apps/encounter/view.ts)
```

## Ablauf `openEncounter`
1. **Preload im Travel-Mode.** Während `onEnter` ruft der Travel-Mode `preloadEncounterModule()` auf, wodurch das Gateway `core/layout` und `apps/encounter/view` lazy importiert und zwischenspeichert.【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L153-L158】【F:salt-marcher/src/apps/cartographer/modes/travel-guide/encounter-gateway.ts†L10-L35】
2. **Encounter-Trigger.** `TravelLogic` meldet einen Encounter, sobald `createPlayback` in seiner Stundenuhr `checkEncounter()` mit einem Treffer beendet. Vor dem Gateway-Aufruf pausiert der Modus die aktive Logik.【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L233-L246】【F:salt-marcher/src/apps/cartographer/travel/domain/playback.ts†L60-L166】
3. **Leaf-Auflösung.** `openEncounter` wartet auf den Import, ruft `layout.getRightLeaf(app)` und erhält (oder erzeugt) den rechten Obsidian-Leaf.【F:salt-marcher/src/apps/cartographer/modes/travel-guide/encounter-gateway.ts†L12-L31】【F:salt-marcher/src/core/layout.ts†L7-L24】
4. **View-Aktivierung.** Das Gateway setzt den View-State auf `VIEW_ENCOUNTER`, aktiviert den Leaf und ruft `app.workspace.revealLeaf` auf. Fehler im Importpfad werden via `Notice` gemeldet und führen zu `false` als Rückgabewert, der aktuell ignoriert wird.【F:salt-marcher/src/apps/cartographer/modes/travel-guide/encounter-gateway.ts†L17-L43】

## Ist-Zustand des Encounter-Workspaces
- **View-Registrierung:** `main.ts` registriert `EncounterView` unter `VIEW_ENCOUNTER = "salt-encounter"`; das View-Objekt ist ein nacktes `ItemView`, das beim Öffnen lediglich eine Überschrift und einen leeren Beschreibungstext erzeugt.【F:salt-marcher/src/app/main.ts†L4-L40】【F:salt-marcher/src/apps/encounter/view.ts†L1-L21】
- **Datenfluss:** Weder `openEncounter` noch `EncounterView` akzeptieren Kontext zum auslösenden Encounter (Region, Tile, Odds, NPCs). Die Hand-off-Kette endet damit beim Öffnen des Pane ohne Nutzdaten.
- **Steuerung im Travel-Mode:** Nach dem Pausieren der Logik wird der Rückgabewert (`boolean`) des Gateways verworfen, sodass Fehler nicht bis zur Playback-Steuerung propagieren.【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L239-L246】
- **UI-Zustand:** Beim Schließen des Views wird ausschließlich der DOM geleert; es existieren keine weiteren Controller oder Store-Subscriptions.【F:salt-marcher/src/apps/encounter/view.ts†L11-L20】

## Fehlende Soll-Funktionen
- **Encounter-Kontext übergeben.** Travel-Mode liefert weder Encounter-Metadaten noch eine Callback-Schnittstelle in Richtung Encounter-Workspace. Erwartet wird perspektivisch mindestens die Übergabe von Region, Terrain, Uhrzeit und Würfelergebnis, damit Encounter-Tools entstehen können.
- **Workspace-spezifische UI.** `EncounterView` bietet keine Controls (Initiative, Monsterliste, Logbuch). Ohne definierte API existiert kein Pfad, um den Encounter-Vorgang abzubilden oder zu dokumentieren.
- **Fehlerpropagation.** `openEncounter` gibt zwar `false` bei fehlgeschlagenem Import zurück, doch der Travel-Modus ignoriert das Ergebnis. Dadurch bleibt der Modus in einem pausierten Zustand ohne Feedback oder Retry-Strategie.
- **Lebenszyklus & Cleanup.** Es gibt keinen Mechanismus, um beim Schließen des Encounter-Panes den Travel-Modus zu informieren (z. B. um Playback wieder freizugeben) oder Encounter-spezifische Ressourcen zu entsorgen.

## Offene Fragen für die Weiterentwicklung
1. Wie soll der Encounter-Kontext modelliert werden (DTO, Vault-Referenzen, Live-Store)?
2. Soll das Gateway Encounters stapeln (Queue) oder immer nur den neuesten Trigger anzeigen?
3. Wie werden manuell gestartete Encounter (z. B. via Library) in dieselbe Infrastruktur integriert?
4. Benötigt der Travel-Modus ein Recovery, falls das Öffnen des Views scheitert (z. B. Notice + Resume)?

Weitere Recherche- und Planungsschritte sind im To-Do [Encounter Workspace Roadmap](../../todo/encounter-workspace-roadmap.md) gebündelt.
