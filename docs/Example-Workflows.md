# Example Workflows

> **Lies auch:** [Data-Flow.md](architecture/Data-Flow.md), [Features.md](architecture/Features.md)
Konkrete User-Stories durchgespielt: Wie der GM SaltMarcher in der Praxis nutzt.

---

## 1. Session starten

### Szenario

Der GM oeffnet Obsidian und will eine Session fortsetzen.

### Ablauf

```
1. GM oeffnet Obsidian
   └── Plugin laedt automatisch
       ├── Features initialisieren
       ├── Letzte Map laden (aus Plugin-Data)
       └── Zeit wiederherstellen (aus Vault)

2. GM oeffnet SessionRunner
   └── View zeigt:
       ├── Aktuelle Map mit Party-Position
       ├── Aktuelle Zeit und Wetter
       └── Aktive Quests im Quest-Panel

3. GM prueft den Stand
   └── Almanac-Timeline zeigt letzte Journal-Entries
       └── "Party erreichte Moorwald" (vor 3 Tagen)
```

### Beteiligte Features

| Feature | Aktion |
|---------|--------|
| Map | Laedt gespeicherte Map, stellt Party-Position wieder her |
| Time | Laedt gespeicherten Timestamp |
| Environment | Berechnet Wetter basierend auf Zeit und Location |
| Party | Laedt Party-Daten (Members, Inventar) |

---

## 2. Party reist zu neuem Ziel

### Szenario

Die Party will von ihrer aktuellen Position zu einem 5 Hexes entfernten Dorf reisen.

### Ablauf

```
1. GM klickt auf Ziel-Tile (das Dorf)
   └── Tile Content Panel zeigt:
       ├── Location: "Dorf Nebelhain"
       ├── Terrain: Wald
       └── [Reise hierher starten]

2. GM klickt "Reise hierher starten"
   └── Travel-Feature plant Route:
       ├── Berechnet optimalen Pfad (5 Tiles)
       ├── Schaetzt Reisezeit: 8 Stunden (Wald-Terrain)
       └── ETA: Ankunft um 18:00 Uhr

3. GM startet Travel
   └── Animation beginnt:
       └── Party-Token bewegt sich ueber Tiles

4. Bei jedem Tile-Wechsel:
   ├── Zeit wird vorgerueckt (basierend auf Terrain)
   ├── Encounter-Check (via EncounterFeature)
   │   └── Tile 3: Encounter generiert!
   │       └── Travel pausiert automatisch
   └── Weather-Update (optional bei Segment-Wechsel)

5. Encounter erscheint in DetailView
   └── GM sieht Preview:
       ├── "Goblin-Patrouille (Combat)"
       ├── Lead-NPC: "Griknak der Hinkende" (wiederkehrend!)
       └── 3 weitere Goblins
   └── GM waehlt: [Starten] [Ignorieren] [Regenerieren]

6. Nach Encounter-Aufloesung:
   └── Travel wird fortgesetzt
       └── Party erreicht Dorf um 19:30 Uhr

7. Ankunft:
   ├── Journal-Entry: "Party erreichte Nebelhain"
   ├── Zeit: 19:30 Uhr (Dusk)
   └── Wetter: Leichter Regen (Environmental)
```

### Event-Flow

```
travel:start-requested
    │
    └── travel:started
        │
        ├── travel:moved (x5)
        │   ├── time:state-changed
        │   ├── encounter:generate-requested (optional)
        │   │   └── encounter:generated
        │   │       └── travel:paused
        │   │
        │   └── encounter:resolved
        │       └── travel:resumed
        │
        └── travel:completed
            └── party:position-changed
```

---

## 3. Sub-Map betreten

### Szenario

Die Party steht vor einem Dungeon-Eingang und will ihn betreten.

### Ablauf

```
1. Party steht auf Tile mit Location "Goblinhöhle"
   └── Tile Content Panel zeigt:
       ├── Location: "Goblinhöhle"
       ├── Type: Dungeon
       └── [Betreten]

2. GM klickt "Betreten"
   └── Navigation-Event:
       ├── Aktuelle Position wird in History gespeichert
       ├── DungeonMap "Goblinhöhle" wird geladen
       └── Party spawnt am Eingangs-Tile

3. Map wechselt zu Dungeon-Ansicht
   └── View zeigt:
       ├── Grid-basierte Karte (5-foot Tiles)
       ├── Fog of War (unexplored = dunkel)
       └── Party-Token am Eingang

4. Exploration beginnt
   └── Zeit-Tracking wechselt zu Dungeon-Modus:
       └── Bewegung = Zeit (basierend auf Geschwindigkeit)
```

### Event-Flow

```
map:navigate-requested
    │
    └── map:navigated
        ├── map:unloaded (Overworld)
        ├── map:loaded (Dungeon)
        └── party:position-changed (Dungeon-Koordinate)
```

---

## 4. Combat-Encounter abwickeln

### Szenario

Ein Combat-Encounter wurde generiert, der GM will den Kampf durchfuehren.

### Ablauf

```
1. Encounter-Preview in DetailView
   └── GM sieht:
       ├── 4 Goblins (CR 1/4 each)
       ├── XP Budget: 200 XP (Medium fuer 4er Party)
       └── Terrain-Modifikatoren

2. GM klickt "Combat starten"
   └── Combat-Feature uebernimmt:
       ├── Initiative wuerfeln (alle Teilnehmer)
       ├── Combat-Tracker oeffnet sich
       └── Encounter-Status: 'active'

3. Combat laeuft
   └── GM trackt Runden:
       ├── Initiative-Reihenfolge
       ├── HP-Tracking pro Kreatur
       ├── Conditions (Poisoned, Stunned, etc.)
       └── Zeit: +6 Sekunden pro Runde

4. Combat endet (Goblin besiegt oder geflohen)
   └── Resolution:
       ├── XP-Verteilung: 40% sofort (80 XP), 60% in Quest-Pool
       ├── Loot-Generierung basierend auf Kreaturen
       └── NPC-Status-Update (dead fuer besiegte NPCs)

5. Nach Combat:
   ├── Journal-Entry: "Party besiegte Goblin-Patrouille"
   ├── Loot-Preview in DetailView
   └── GM verteilt Loot manuell oder automatisch
```

### Event-Flow

```
encounter:start-requested
    │
    └── combat:start-requested
        │
        └── combat:started
            │
            ├── combat:round-started (x mehrere)
            │   ├── combat:participant-hp-changed
            │   └── time:state-changed (+6s)
            │
            └── combat:ended
                ├── encounter:resolved
                │   ├── party:xp-gained
                │   └── quest:xp-accumulated (falls Quest)
                │
                └── loot:generate-requested
                    └── loot:generated
```

---

## 5. Quest annehmen und verfolgen

### Szenario

Ein NPC bietet der Party eine Quest an.

### Ablauf

```
1. Social Encounter mit NPC "Dorfaeltester Maron"
   └── GM erstellt Quest manuell:
       ├── Name: "Die Goblins vertreiben"
       ├── Beschreibung: "Goblinhöhle säubern"
       └── Objectives:
           ├── [x] Goblinhöhle finden
           ├── [ ] Goblin-Anführer besiegen
           └── [ ] Zum Dorfältesten zurückkehren

2. Quest wird aktiv
   └── Quest-Panel zeigt neue Quest
       └── Objective 1 sofort als erledigt markiert
           (Party war bereits dort)

3. Waehrend der Quest:
   └── Encounters in der Höhle werden Quest zugeordnet:
       ├── Combat XP: 40% sofort, 60% akkumuliert
       └── Objective-Progress wird automatisch geprueft

4. Quest-Abschluss:
   ├── Letztes Objective erfuellt
   ├── Akkumulierte XP (60%) wird ausgezahlt
   ├── Quest-Reward (Items, Gold) wird angezeigt
   └── Journal-Entry: "Quest 'Die Goblins vertreiben' abgeschlossen"
```

### Event-Flow

```
quest:created
    │
    └── quest:started
        │
        ├── encounter:resolved (mehrere)
        │   └── quest:xp-accumulated
        │
        ├── quest:objective-completed (mehrere)
        │
        └── quest:completed
            ├── party:xp-gained (akkumulierte 60%)
            └── party:items-gained (Rewards)
```

---

## 6. Zeit manuell vorruecken

### Szenario

Die Party rastet in einer Taverne, der GM will 8 Stunden fuer Long Rest vorruecken.

### Ablauf

```
1. GM oeffnet Zeit-Kontrolle im SessionRunner
   └── Aktuelle Zeit: 22:00 Uhr

2. GM waehlt "Long Rest" (8 Stunden)
   └── Time-Feature:
       ├── Zeit vorruecken: 22:00 → 06:00 Uhr (+1 Tag)
       ├── TimeSegment-Wechsel: night → dawn
       └── Publish time:state-changed Event

3. Reactive Features reagieren:
   ├── Environment: Neues Wetter fuer dawn berechnen
   ├── Audio: Ambient wechselt zu Dawn-Tracks
   └── Faction: Naechtliche Bewegungen verarbeiten (optional)

4. UI aktualisiert:
   ├── Zeit-Anzeige: "Tag 15, 06:00 Uhr, Dawn"
   ├── Wetter: "Morgennebel"
   └── Journal-Entry: "Party rastete in der Taverne"
```

### Event-Flow

```
time:set-requested
    │
    └── time:state-changed
        ├── time:segment-changed (night → dawn)
        ├── environment:weather-changed
        └── audio:context-changed
```

---

## 7. Dungeon erkunden

### Szenario

Die Party erkundet einen Dungeon mit mehreren Raeumen.

### Ablauf

```
1. Party im Eingangsbereich
   └── GM sieht:
       ├── Sichtbare Tiles (Lichtradius der Party)
       ├── Fog of War fuer unerforschte Bereiche
       └── Tuer nach Norden (geschlossen)

2. Party bewegt sich
   └── GM zieht Party-Token:
       ├── Tiles werden aufgedeckt (explored = true)
       ├── Zeit wird vorgerueckt (5 feet = ~1 Sekunde)
       └── Lichtquellen brennen ab (Fackel-Timer)

3. Geheime Tuer erkannt
   └── System prueft automatisch:
       ├── Passive Perception >= DC? → GM-Popup
       └── "Spieler könnte Geheimtür entdecken"
   └── GM entscheidet: [Zeigen] [Ignorieren]

4. Falle ausgeloest
   └── Party betritt Trap-Tile:
       ├── Passiver Check gegen Trap-DC
       ├── Erfolg: "Ihr bemerkt eine Druckplatte"
       ├── Fehlschlag: Trap wird ausgelöst
       └── Schaden, Effekte, etc.

5. Raum mit Kreaturen betreten
   └── GM sieht Kreatur-Tokens:
       ├── Kreaturen sind vorplatziert (nicht random)
       ├── GM klickt Token → Encounter starten
       └── Combat beginnt auf Grid
```

### Besonderheiten

- **Zeit-Tracking:** Automatisch basierend auf Bewegung
- **Lichtquellen:** Brenndauer wird getrackt, Reichweite als Overlay
- **Fog of War:** Persistiert zwischen Sessions
- **Kreaturen:** Als Tokens vorplatziert, kein Random-Spawn

---

## 8. Loot verteilen

### Szenario

Nach einem Combat soll Loot verteilt werden.

### Ablauf

```
1. Combat endet
   └── Loot-Feature generiert:
       ├── Basierend auf Kreatur-Tags: [goblin, humanoid, tribal]
       ├── Matching Items aus Registry mit gleichen Tags
       └── Gewichtete Wahrscheinlichkeit (mehr Tag-Matches = wahrscheinlicher)

2. Loot-Preview in DetailView
   └── GM sieht:
       ├── 15x Goldmuenze (15 GP)
       ├── Kurzschwert (common)
       ├── Heiltrank (consumable)
       └── [Alle annehmen] [Einzeln verteilen] [Neu wuerfeln]

3. GM verteilt Loot
   └── Option A: Alle an einen Charakter
   └── Option B: Einzeln auf Charaktere verteilen

4. Nach Verteilung:
   ├── Alle Items (inkl. Goldmuenzen) werden in Charakter-Inventare hinzugefuegt
   └── Journal-Entry: "Loot gefunden: 15 GP, Kurzschwert, Heiltrank"
```

### Tag-Matching Beispiel

```
Goblin-Encounter Tags: [goblin, humanoid, tribal, forest]

Item-Registry:
├── Kurzschwert: [weapon, martial, common] → 0 Matches
├── Goblin-Dolch: [weapon, goblin, tribal] → 2 Matches ✓✓
├── Stammestalisman: [tribal, magic, rare] → 1 Match ✓
└── Heilkräuter: [consumable, forest] → 1 Match ✓

Wahrscheinlichkeit: Goblin-Dolch > Stammestalisman = Heilkräuter > Kurzschwert
```

---

## 9. NPC wiedererkennen

### Szenario

Ein zuvor getroffener NPC taucht erneut auf.

### Ablauf

```
1. Encounter wird generiert
   └── NPC-Auswahl-Algorithmus:
       ├── Suche existierende NPCs mit:
       │   ├── Kreaturtyp: Goblin
       │   ├── Fraktion: Goblinstamm der Zähne
       │   └── Status: alive
       ├── Scoring:
       │   ├── +15 fuer vorherige Begegnungen
       │   ├── -30 wenn kuerzlich getroffen (<3 Tage)
       │   └── +10 wenn lange nicht gesehen (>30 Tage)
       └── Ergebnis: "Griknak der Hinkende" (Score: 35)

2. Encounter-Preview zeigt:
   └── ★ Wiederkehrender NPC
       ├── Name: "Griknak der Hinkende"
       ├── Letzte Begegnung: Vor 12 Tagen
       ├── Bisherige Begegnungen: 2
       └── Persoenlichkeit: Misstrauisch, Feige

3. GM kann:
   ├── [NPC akzeptieren] → Griknak wird verwendet
   ├── [Anderen NPC] → Alternativen anzeigen
   └── [Neu generieren] → Frischer NPC
```

---

## 10. Session beenden

### Szenario

Die Session ist zu Ende, der GM schliesst Obsidian.

### Ablauf

```
1. GM beendet aktive Aktivitaeten
   └── Falls Travel aktiv: Pausieren oder abbrechen
   └── Falls Combat aktiv: Snapshot speichern (Resumable)

2. GM schliesst SessionRunner
   └── Automatisch:
       ├── Aktuelle Map-ID wird gespeichert
       ├── Party-Position wird gespeichert
       └── Zeit wird gespeichert

3. Plugin entlaedt
   └── Features werden disposed:
       ├── EventBus-Subscriptions aufräumen
       ├── Timer stoppen
       └── Resumable-State speichern

4. Naechster Session-Start:
   └── Alles wird wiederhergestellt
       └── Party steht genau wo sie war
```

---

