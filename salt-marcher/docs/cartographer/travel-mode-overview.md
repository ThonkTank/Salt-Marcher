# Cartographer – Travel Mode Architecture

## Strukturdiagramm
```
CartographerPresenter
    └─ createTravelGuideMode (travel-guide.ts)
         ├─ TravelPlaybackController (playback-controller.ts)
         ├─ TravelInteractionController (interaction-controller.ts)
         ├─ EncounterGateway (encounter-gateway.ts)
         ├─ RouteLayer / TokenLayer (travel/ui)
         └─ TravelLogic (travel/domain)
```

## Funktionen & Verantwortlichkeiten
- **`travel-guide.ts`** – orchestriert den Modus-Lifecycle. Baut Sidebar und Layer auf, koppelt Domain-Logik an UI-Controller und reagiert auf Dateiauswahl, Hex-Klicks sowie Speichern.
- **`playback-controller.ts`** – kapselt die Verbindung zwischen Playback-UI und `TravelLogic`. Erstellt die Controls, synchronisiert deren Zustand und räumt beim Verlassen auf.
- **`interaction-controller.ts`** – bündelt Drag-&-Drop sowie Kontextmenü der Route. Delegiert alle Operationen an `TravelLogic` und sorgt für sauberes Cleanup.
- **`encounter-gateway.ts`** – lädt Encounter-Abhängigkeiten frühzeitig und öffnet die Encounter-Ansicht fehlertolerant. Stellt sicher, dass der Modus nutzbar bleibt, falls das Modul fehlt.

## Datenfluss
1. **Initialisierung** – `createTravelGuideMode.onEnter` lädt Terrains (`loadTerrains` → `setTerrains`), registriert ein Workspace-Event (`salt:terrains-updated`) und montiert Sidebar & Playback-Controller.
2. **Datei-Wechsel** – `onFileChange` erzeugt Route- & Token-Layer, instanziiert `TravelLogic` und übergibt Render-Adapter sowie Callback-Hooks an die Controller.
3. **State-Updates** – `TravelLogic` ruft `onChange`, worauf `travel-guide.ts` Layer, Sidebar und Playback synchronisiert.
4. **Interaktion** – Drag- und Kontext-Events laufen über den Interaction-Controller und werden unmittelbar an `TravelLogic` delegiert; Hex-Klicks werden nach Suppression-Check ebenfalls an `TravelLogic` weitergereicht.
5. **Encounter** – `TravelLogic` meldet Begegnungen über `onEncounter`. Das Gateway öffnet die Encounter-View; Fehler bei Importen werden per `Notice` angezeigt.
6. **Terrain-Refresh** – Der Workspace-Listener lädt Terrains nach, sobald `salt:terrains-updated` ausgelöst wird (z. B. durch den File-Watcher).

## Skript-Notizen
- **`travel-guide.ts`** – Fokus auf Lifecycle-Steuerung: Terrain-Synchronisierung, Controller-Mounting, Cleanup. Hält keinerlei UI-spezifische Closures mehr.
- **`playback-controller.ts`** – API: `mount`, `sync`, `reset`, `dispose`. Erwartet einen Driver mit `play`, `pause`, `reset`, `setTempo`.
- **`interaction-controller.ts`** – API: `bind(env, logic)`, `consumeClickSuppression`, `dispose`. Stellt sicher, dass Drag und Kontextmenü atomar aufgeräumt werden.
- **`encounter-gateway.ts`** – API: `preloadEncounterModule`, `openEncounter`. Nutzt `Promise.all` ohne `try/catch`-Wrapper und zeigt Fehler via `Notice`.

## Feature-Zusammenfassung
- Entkoppelte Controller reduzieren geteilten Mutable State im Modus.
- Terrain-Änderungen werden über Workspace-Events erkannt und automatisch nachgeladen.
- Encounter-Aufrufe sind vorab geladen und benachrichtigen bei Fehlern.
