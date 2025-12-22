# Journal

> **Lies auch:** [Time-System](../features/Time-System.md)
> **Wird benoetigt von:** SessionRunner, Almanac

Single Source of Truth fuer Session-Journal und automatische Event-Protokollierung.

**Design-Philosophie:** Das Journal ist die persistente Aufzeichnung aller Session-relevanten Ereignisse. Es kombiniert automatisch generierte Eintraege (Encounters, Quests, Reisen) mit manuellen GM/Spieler-Notizen.

---

## Uebersicht

Das Journal erfuellt zwei Funktionen:

1. **Automatische Protokollierung** - Events werden automatisch als Eintraege erfasst
2. **Manuelle Notizen** - GM und Spieler koennen eigene Eintraege hinzufuegen

```
Journal
├── Auto-generierte Eintraege
│   ├── Quest-Events (discovered, completed, failed)
│   ├── Encounter-Events (started, resolved)
│   ├── Travel-Events (completed, departed)
│   ├── Time-Events (significant time passed)
│   └── World-Events (weather change, faction event)
│
└── Manuelle Eintraege
    ├── Session-Notizen (GM)
    ├── Character-Notizen (Spieler)
    └── Lore/Discoveries
```

---

## Schema

### JournalEntry

```typescript
interface JournalEntry {
  id: EntityId<'journal'>;

  // === Zeitpunkt ===
  timestamp: Timestamp;                  // In-Game Zeit
  realWorldTime?: Date;                  // Optional: Echtzeit der Session

  // === Kategorisierung ===
  category: JournalCategory;
  source: JournalSource;

  // === Inhalt ===
  title: string;
  content: string;                       // Markdown-formatiert
  summary?: string;                      // Kurzfassung fuer Listen-Ansicht

  // === Verknuepfungen ===
  relatedEntities?: JournalEntityRef[];

  // === Metadaten ===
  sessionId?: string;                    // Zu welcher Session gehoert dieser Eintrag
  tags?: string[];                       // User-definierte Tags
  pinned?: boolean;                      // Wichtiger Eintrag
}

type JournalCategory =
  | 'quest'          // Quest-bezogene Eintraege
  | 'encounter'      // Kampf-Protokolle
  | 'travel'         // Reise-Ereignisse
  | 'discovery'      // Neue Orte, NPCs, Lore entdeckt
  | 'worldevent'     // Welt-Ereignisse (Wetter, Fraktionen)
  | 'session'        // Session-Zusammenfassungen
  | 'note';          // Freie Notizen

type JournalSource =
  | 'auto'           // Automatisch generiert
  | 'gm'             // Vom GM erstellt
  | 'player';        // Von Spieler erstellt
```

### JournalEntityRef

```typescript
interface JournalEntityRef {
  entityType: EntityType;
  entityId: string;
  displayName?: string;                  // Cached fuer Performance
}

// Beispiele:
// { entityType: 'quest', entityId: 'q-goblin-cave', displayName: 'Goblin-Hoehle saeubern' }
// { entityType: 'npc', entityId: 'npc-tavern-keeper', displayName: 'Barkeep Grim' }
// { entityType: 'poi', entityId: 'poi-old-mill', displayName: 'Die alte Muehle' }
```

---

## Auto-Generierung

### Event-zu-Journal Mapping

| Event | Journal-Kategorie | Titel-Template | Trigger |
|-------|-------------------|----------------|---------|
| `quest:discovered` | `quest` | "Quest entdeckt: {name}" | GM-Aktion |
| `quest:activated` | `quest` | "Quest angenommen: {name}" | GM-Aktion |
| `quest:completed` | `quest` | "Quest abgeschlossen: {name}" | GM-Aktion |
| `quest:failed` | `quest` | "Quest fehlgeschlagen: {name}" | GM-Aktion |
| `encounter:started` | `encounter` | "Kampf: {creatures}" | System |
| `encounter:resolved` | `encounter` | "Kampf beendet: {outcome}" | System |
| `travel:completed` | `travel` | "Ankunft: {location}" | System |
| `travel:departed` | `travel` | "Aufbruch von: {location}" | System |
| `weather:changed` | `worldevent` | "Wetterwechsel: {newWeather}" | System |
| `faction:poi-claimed` | `worldevent` | "{faction} uebernimmt {poi}" | System |

### Generierungs-Logik

```typescript
// Event-Handler fuer Journal-Generierung
function handleEventForJournal(event: DomainEvent): JournalEntry | null {
  const template = getJournalTemplate(event.type);
  if (!template) return null;

  return {
    id: createEntityId('journal'),
    timestamp: timeTracker.getCurrentTimestamp(),
    realWorldTime: new Date(),
    category: template.category,
    source: 'auto',
    title: template.formatTitle(event),
    content: template.formatContent(event),
    relatedEntities: extractRelatedEntities(event),
    sessionId: sessionStore.getCurrentSessionId()
  };
}
```

### Konfigurations-Optionen

```typescript
interface JournalSettings {
  // Welche Events automatisch protokolliert werden
  autoLog: {
    quests: boolean;           // Default: true
    encounters: boolean;       // Default: true
    travel: boolean;           // Default: true
    worldEvents: boolean;      // Default: false (optional)
  };

  // Detail-Level
  encounterDetailLevel: 'minimal' | 'standard' | 'detailed';
  // minimal: Nur Ausgang
  // standard: Creatures, Ausgang, XP
  // detailed: Runden-Protokoll inkl. Schaden
}
```

---

## Session-Management

### Session-Konzept

Sessions gruppieren Journal-Eintraege die in einer Spielsitzung entstanden sind:

```typescript
interface Session {
  id: string;
  name: string;                          // "Session 12: Die Goblin-Hoehle"
  startTime: Date;
  endTime?: Date;

  // Zusammenfassung (manuell oder AI-generiert)
  summary?: string;

  // Statistiken
  stats: {
    encountersCompleted: number;
    questsProgressed: number;
    distanceTraveled: number;            // In Hex-Tiles
    inGameTimeElapsed: Duration;
  };
}
```

### Session-Workflow

```
Session starten → Events werden geloggt → Session beenden → Summary generieren
                         ↓
                  [sessionId wird an alle Eintraege angehaengt]
```

---

## Entity-Beziehungen

```
JournalEntry
├──→ Quest (N:M - via relatedEntities)
├──→ NPC (N:M - via relatedEntities)
├──→ POI/Location (N:M - via relatedEntities)
├──→ Creature (N:M - via relatedEntities)
├──→ Faction (N:M - via relatedEntities)
└──→ Session (N:1 - sessionId)
```

---

## Verwendung in anderen Features

### SessionRunner

Journal-Integration:
- "Quick Note" Button fuer schnelle Notizen
- Journal-Panel mit filterbarer Liste
- Clickable Entity-Links in Eintraegen

### Almanac

Timeline-View kann Journal-Eintraege anzeigen:
- Chronologische Ansicht aller Ereignisse
- Filter nach Kategorie/Tags

### Quest-Feature

Quest-Events werden automatisch geloggt:
- Neue Quest entdeckt
- Objective abgeschlossen
- Quest beendet

---

## Events

```typescript
// Journal-CRUD
'journal:entry-created': {
  entry: JournalEntry;
  correlationId: string;
}
'journal:entry-updated': {
  entryId: EntityId<'journal'>;
  changes: Partial<JournalEntry>;
  correlationId: string;
}
'journal:entry-deleted': {
  entryId: EntityId<'journal'>;
  correlationId: string;
}

// Session-Management
'journal:session-started': {
  sessionId: string;
  sessionName: string;
  correlationId: string;
}
'journal:session-ended': {
  sessionId: string;
  stats: SessionStats;
  correlationId: string;
}
```

→ Vollstaendige Event-Definitionen: [Events-Catalog.md](../architecture/Events-Catalog.md)

---

## Queries

```typescript
// Eintraege einer Session
function getEntriesBySession(sessionId: string): JournalEntry[];

// Eintraege nach Kategorie
function getEntriesByCategory(category: JournalCategory): JournalEntry[];

// Eintraege zu einer Entity
function getEntriesForEntity(
  entityType: EntityType,
  entityId: string
): JournalEntry[];

// Zeitraum-basierte Abfrage
function getEntriesInRange(
  from: Timestamp,
  to: Timestamp
): JournalEntry[];

// Gepinnte Eintraege
function getPinnedEntries(): JournalEntry[];
```

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| JournalEntry Schema | ✓ | | Kern-Entity |
| Auto-Generierung (Quest, Encounter) | ✓ | | Basis-Events |
| Manuelle Notizen | ✓ | | GM Quick-Note |
| Session-Grouping | | mittel | Session-Management |
| Entity-Linking | ✓ | | Clickable References |
| Travel-Logging | | mittel | Optional |
| WorldEvent-Logging | | niedrig | Optional |
| Detail-Level Konfiguration | | niedrig | Encounter-Details |

---

*Siehe auch: [Quest.md](Quest.md) | [Time-System.md](../features/Time-System.md) | [Encounter-System.md](../features/Encounter-System.md)*

## Tasks

| # | Beschreibung | Prio | MVP? | Deps | Referenzen |
|--:|--------------|:----:|:----:|------|------------|
| 2200 | JournalEntry Schema implementieren (id, timestamp, category, source, content, relatedEntities) | hoch | Ja | #901 | Journal.md#schema, ../architecture/EntityRegistry.md |
| 2201 | JournalCategory Enum (quest, encounter, travel, discovery, worldevent, session, note) | hoch | Ja | #2200 | Journal.md#schema |
| 2202 | JournalSource Enum (auto, gm, player) | hoch | Ja | #2200 | Journal.md#schema |
| 2203 | JournalEntityRef Schema (entityType, entityId, displayName) | hoch | Ja | #2200 | Journal.md#schema, ../architecture/EntityRegistry.md |
| 2204 | Session Schema (id, name, startTime, endTime, summary, stats) | mittel | Nein | #901, #902 | Journal.md#session-management, ../features/Time-System.md#schemas |
| 2205 | Auto-Generierung: Quest-Events zu Journal-Einträgen (discovered, activated, completed, failed) | hoch | Ja | #414, #415, #417, #418, #901, #907, #2200, #2201, #2209 | Journal.md#auto-generierung, Journal.md#event-zu-journal-mapping, ../domain/Quest.md#events, ../features/Quest-System.md |
| 2206 | Auto-Generierung: Encounter-Events zu Journal-Einträgen (started, resolved) | hoch | Ja | #221, #223, #901, #907, #2200, #2201, #2209 | Journal.md#auto-generierung, Journal.md#event-zu-journal-mapping, ../features/Encounter-System.md#events |
| 2207 | Auto-Generierung: Travel-Events zu Journal-Einträgen (completed, departed) | mittel | Nein | #12, #901, #907, #2200, #2201, #2209 | Journal.md#auto-generierung, Journal.md#event-zu-journal-mapping, ../features/Travel-System.md#event-flow |
| 2208 | Auto-Generierung: WorldEvent-Events zu Journal-Einträgen (weather-changed, faction-poi-claimed) | niedrig | Nein | #110, #901, #907, #1414, #2200, #2201, #2209 | Journal.md#auto-generierung, Journal.md#event-zu-journal-mapping, ../features/Weather-System.md#event-flow, ../domain/Faction.md#events |
| 2209 | Event-zu-Journal Mapping Tabelle implementieren (getJournalTemplate) | hoch | Ja | #2200, #2201, #901 | Journal.md#event-zu-journal-mapping, Journal.md#generierungs-logik |
| 2210 | JournalSettings Schema (autoLog-Optionen, encounterDetailLevel) | niedrig | Nein | #2200 | Journal.md#konfigurations-optionen |
| 2211 | encounterDetailLevel Konfiguration (minimal, standard, detailed) | niedrig | Nein | #2210 | Journal.md#konfigurations-optionen |
| 2212 | Manuelle Notizen: GM Quick-Note Funktion | hoch | Ja | #2200, #2228 | Journal.md#prioritaet, Journal.md#uebersicht, ../application/SessionRunner.md |
| 2213 | Entity-Linking: Clickable References in Journal-Einträgen | hoch | Ja | #2203, #2226 | Journal.md#prioritaet, Journal.md#verwendung-in-anderen-features, ../application/DetailView.md |
| 2214 | Session-Management: Session starten/beenden Workflow | mittel | Nein | #2204, #2228, #901 | Journal.md#session-workflow, Journal.md#session-management |
| 2215 | Session Stats Tracking (encountersCompleted, questsProgressed, distanceTraveled, inGameTimeElapsed) | mittel | Nein | #2204, #2214, #901 | Journal.md#session-management, ../features/Time-System.md#schemas |
| 2216 | journal:entry-created Event publizieren | hoch | Ja | #2200, #2228 | Journal.md#events, ../architecture/Events-Catalog.md#journal |
| 2217 | journal:entry-updated Event publizieren | hoch | Ja | #2200, #2228 | Journal.md#events, ../architecture/Events-Catalog.md#journal |
| 2218 | journal:entry-deleted Event publizieren | hoch | Ja | #2200, #2228 | Journal.md#events, ../architecture/Events-Catalog.md#journal |
| 2219 | journal:session-started Event publizieren | mittel | Nein | #2214 | Journal.md#events, ../architecture/Events-Catalog.md#journal |
| 2220 | journal:session-ended Event publizieren | mittel | Nein | #2214 | Journal.md#events, ../architecture/Events-Catalog.md#journal |
| 2221 | Query: getEntriesBySession(sessionId) | hoch | Ja | #2200, #2228 | Journal.md#queries |
| 2222 | Query: getEntriesByCategory(category) | hoch | Ja | #2200, #2201, #2228 | Journal.md#queries |
| 2223 | Query: getEntriesForEntity(entityType, entityId) | hoch | Ja | #2200, #2203, #2228 | Journal.md#queries, Journal.md#entity-beziehungen |
| 2224 | Query: getEntriesInRange(from, to) - Zeitraum-basierte Abfrage | hoch | Ja | #2200, #901, #2228 | Journal.md#queries, ../features/Time-System.md#schemas |
| 2225 | Query: getPinnedEntries() | mittel | Nein | #2200, #2228 | Journal.md#queries |
| 2226 | Journal-Panel UI im SessionRunner (Quick Note Button, filterbare Liste) | hoch | Ja | #2212, #2213, #2221, #2222, #2223, #2224, #2225, #2228 | Journal.md#sessionrunner, ../application/SessionRunner.md#journal-integration |
| 2227 | Timeline-View in Almanac (chronologische Ansicht, Filter nach Kategorie/Tags) | mittel | Nein | #2221, #2222, #2223, #2224, #2225 | Journal.md#almanac, ../features/Time-System.md |
| 2228 | Journal Feature/Orchestrator mit CRUD-Logik | hoch | Ja | - | Journal.md, ../architecture/Features.md |
