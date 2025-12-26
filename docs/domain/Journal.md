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
  linkedNPCs?: EntityId<'npc'>[];         // Schnell-Zugriff fuer NPC-Historie

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

## NPC-Link-UI

NPCs koennen direkt aus ihrer Detail-Ansicht auf ihre Journal-Historie zugreifen:

### Link-Komponente

```
┌─────────────────────────────────────────────────┐
│  Griknak der Hinkende                           │
│  ─────────────────────                          │
│  Persoenlichkeit: misstrauisch, gierig          │
│  Status: alive                                  │
│                                                 │
│  📜 Journal-Eintraege (3)  ← Hover zeigt Preview│
│                                                 │
└─────────────────────────────────────────────────┘
```

### Verhalten

| Aktion | Ergebnis |
|--------|----------|
| **Hover** | Tooltip mit Summary der letzten 3 Encounters |
| **Klick** | Wechsel zu Journal-Tab, gefiltert nach NPC-ID |

### Hover-Preview

```typescript
function getNpcJournalSummary(npcId: EntityId<'npc'>): string {
  // Letzte 3 Eintraege mit diesem NPC
  const entries = journal
    .filter(e => e.linkedNPCs?.includes(npcId))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3);

  if (entries.length === 0) return 'Keine Begegnungen dokumentiert.';

  // Kompakte Summary
  return entries.map(e => `• ${formatDate(e.timestamp)}: ${e.summary ?? e.title}`).join('\n');
}
```

**Beispiel-Tooltip:**
```
📜 Letzte Begegnungen mit Griknak:
• 15. Flamerule: Kampf - Goblin-Patrouille besiegt
• 12. Flamerule: Sozial - Verhandlung gescheitert
• 8. Flamerule: Spur - Goblin-Lager entdeckt
```

### Query: Eintraege zu NPC

```typescript
function getJournalEntriesForNPC(npcId: EntityId<'npc'>): JournalEntry[] {
  return journal.filter(e => e.linkedNPCs?.includes(npcId));
}
```

**Hinweis:** Das `linkedNPCs`-Feld ist ein dediziertes Array fuer schnelle NPC-Queries. Es ergaenzt `relatedEntities`, das alle Entity-Typen abdeckt.

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

// Eintraege zu einem NPC (optimiert via linkedNPCs)
function getJournalEntriesForNPC(npcId: EntityId<'npc'>): JournalEntry[];
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

*Siehe auch: [Quest.md](Quest.md) | [Time-System.md](../features/Time-System.md) | [encounter/Encounter.md](../features/encounter/Encounter.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 2200 | 📋 | Journal | core | JournalEntry Schema implementieren (id, timestamp, category, source, content, relatedEntities) | hoch | Ja | #901 | Journal.md#schema, ../architecture/EntityRegistry.md | src/core/schemas/journal.ts:journalEntrySchema, src/core/schemas/index.ts |
| 2201 | 📋 | Journal | core | JournalCategory Enum (quest, encounter, travel, discovery, worldevent, session, note) | hoch | Ja | #2200 | Journal.md#schema | src/core/schemas/journal.ts:journalCategorySchema |
| 2202 | 📋 | Journal | core | JournalSource Enum (auto, gm, player) | hoch | Ja | #2200 | Journal.md#schema | src/core/schemas/journal.ts:journalSourceSchema |
| 2203 | 📋 | Journal | core | JournalEntityRef Schema (entityType, entityId, displayName) | hoch | Ja | #2200 | Journal.md#schema, ../architecture/EntityRegistry.md | src/core/schemas/journal.ts:journalEntityRefSchema |
| 2204 | ⬜ | Journal | core | Session Schema (id, name, startTime, endTime, summary, stats) | mittel | Nein | #901, #902 | Journal.md#session-management, ../features/Time-System.md#schemas | [neu] src/core/schemas/journal.ts:Session, [neu] src/core/schemas/journal.ts:SessionStats |
| 2205 | ⛔ | Journal | features | Auto-Generierung: Quest-Events zu Journal-Einträgen (discovered, activated, completed, failed) | hoch | Ja | #414, #415, #417, #418, #901, #907, #2200, #2201, #2209 | Journal.md#auto-generierung, Journal.md#event-zu-journal-mapping, ../domain/Quest.md#events, ../features/Quest-System.md | [neu] src/features/journal/auto-generator.ts:handleQuestEvents(), src/features/journal/templates.ts:QuestEventTemplate [neu] |
| 2206 | ⛔ | Journal | features | Auto-Generierung: Encounter-Events zu Journal-Einträgen (started, resolved) | hoch | Ja | #901, #907, #2200, #2201, #2209 | Journal.md#auto-generierung, Journal.md#event-zu-journal-mapping, ../features/encounter/Encounter.md#events | [neu] src/features/journal/auto-generator.ts:handleEncounterEvents(), src/features/journal/templates.ts:EncounterEventTemplate [neu] |
| 2207 | ⛔ | Journal | features | Auto-Generierung: Travel-Events zu Journal-Einträgen (completed, departed) | mittel | Nein | #12, #901, #907, #2200, #2201, #2209 | Journal.md#auto-generierung, Journal.md#event-zu-journal-mapping, ../features/Travel-System.md#event-flow | [neu] src/features/journal/auto-generator.ts:handleTravelEvents(), src/features/journal/templates.ts:TravelEventTemplate [neu] |
| 2208 | ⛔ | Journal | features | Auto-Generierung: WorldEvent-Events zu Journal-Einträgen (weather-changed, faction-poi-claimed) | niedrig | Nein | #110, #901, #907, #1414, #2200, #2201, #2209 | Journal.md#auto-generierung, Journal.md#event-zu-journal-mapping, ../features/Weather-System.md#event-flow, ../domain/Faction.md#events | [neu] src/features/journal/auto-generator.ts:handleWorldEvents(), src/features/journal/templates.ts:WorldEventTemplate [neu] |
| 2209 | ⛔ | Journal | features | Event-zu-Journal Mapping Tabelle implementieren (getJournalTemplate) | hoch | Ja | #901, #2200, #2201, #2203 | Journal.md#event-zu-journal-mapping, Journal.md#generierungs-logik | [neu] src/features/journal/auto-generator.ts:getJournalTemplate(), src/features/journal/templates.ts:JournalTemplate [neu] |
| 2210 | ⛔ | Journal | core | JournalSettings Schema (autoLog-Optionen, encounterDetailLevel) | niedrig | Nein | #2200 | Journal.md#konfigurations-optionen | [neu] src/core/schemas/journal.ts:JournalSettings, [neu] src/core/schemas/journal.ts:AutoLogSettings |
| 2211 | ⛔ | Journal | features | encounterDetailLevel Konfiguration (minimal, standard, detailed) | niedrig | Nein | #2210 | Journal.md#konfigurations-optionen | [neu] src/features/journal/auto-generator.ts:formatEncounterDetails() |
| 2212 | ⛔ | Journal | features | Manuelle Notizen: GM Quick-Note Funktion | hoch | Ja | #2200, #2228 | Journal.md#prioritaet, Journal.md#uebersicht, ../application/SessionRunner.md | [neu] src/features/journal/orchestrator.ts:createQuickNote() |
| 2213 | ⛔ | Journal | application | Entity-Linking: Clickable References in Journal-Einträgen | hoch | Ja | #2203, #2228 | Journal.md#prioritaet, Journal.md#verwendung-in-anderen-features, ../application/DetailView.md | [neu] src/application/session-runner/panels/JournalPanel.svelte:EntityLink (Component), [neu] src/application/session-runner/panels/JournalPanel.svelte:handleEntityClick() |
| 2214 | ⛔ | Journal | features | Session-Management: Session starten/beenden Workflow | mittel | Nein | #901, #2204, #2228 | Journal.md#session-workflow, Journal.md#session-management | [neu] src/features/journal/orchestrator.ts:startSession(), [neu] src/features/journal/orchestrator.ts:endSession() |
| 2215 | ⛔ | Journal | features | Session Stats Tracking (encountersCompleted, questsProgressed, distanceTraveled, inGameTimeElapsed) | mittel | Nein | #901, #2204, #2214 | Journal.md#session-management, ../features/Time-System.md#schemas | [neu] src/features/journal/orchestrator.ts:updateSessionStats(), src/features/journal/types.ts:SessionState [neu] |
| 2216 | ⛔ | Journal | core | journal:entry-created Event publizieren | hoch | Ja | #2200, #2228 | Journal.md#events, ../architecture/Events-Catalog.md#journal | [neu] src/core/events/domain-events.ts:JOURNAL_ENTRY_CREATED, [neu] src/core/events/domain-events.ts:JournalEntryCreatedPayload, src/features/journal/orchestrator.ts:publishEntryCreated() [neu] |
| 2217 | ⛔ | Journal | core | journal:entry-updated Event publizieren | hoch | Ja | #2200, #2228 | Journal.md#events, ../architecture/Events-Catalog.md#journal | [neu] src/core/events/domain-events.ts:JOURNAL_ENTRY_UPDATED, [neu] src/core/events/domain-events.ts:JournalEntryUpdatedPayload, src/features/journal/orchestrator.ts:publishEntryUpdated() [neu] |
| 2218 | ⛔ | Journal | core | journal:entry-deleted Event publizieren | hoch | Ja | #2200, #2228 | Journal.md#events, ../architecture/Events-Catalog.md#journal | [neu] src/core/events/domain-events.ts:JOURNAL_ENTRY_DELETED, [neu] src/core/events/domain-events.ts:JournalEntryDeletedPayload, src/features/journal/orchestrator.ts:publishEntryDeleted() [neu] |
| 2219 | ⛔ | Journal | core | journal:session-started Event publizieren | mittel | Nein | #2214 | Journal.md#events, ../architecture/Events-Catalog.md#journal | [neu] src/core/events/domain-events.ts:JOURNAL_SESSION_STARTED, [neu] src/core/events/domain-events.ts:JournalSessionStartedPayload, src/features/journal/orchestrator.ts:publishSessionStarted() [neu] |
| 2220 | ⛔ | Journal | core | journal:session-ended Event publizieren | mittel | Nein | #2214 | Journal.md#events, ../architecture/Events-Catalog.md#journal | [neu] src/core/events/domain-events.ts:JOURNAL_SESSION_ENDED, [neu] src/core/events/domain-events.ts:JournalSessionEndedPayload, src/features/journal/orchestrator.ts:publishSessionEnded() [neu] |
| 2221 | ⛔ | Journal | features | Query: getEntriesBySession(sessionId) | hoch | Ja | #2200, #2228 | Journal.md#queries | [neu] src/features/journal/queries.ts:getEntriesBySession() |
| 2222 | ⛔ | Journal | features | Query: getEntriesByCategory(category) | hoch | Ja | #2200, #2201, #2228 | Journal.md#queries | [neu] src/features/journal/queries.ts:getEntriesByCategory() |
| 2223 | ⛔ | Journal | features | Query: getEntriesForEntity(entityType, entityId) | hoch | Ja | #2200, #2203, #2228 | Journal.md#queries, Journal.md#entity-beziehungen | [neu] src/features/journal/queries.ts:getEntriesForEntity() |
| 2224 | ⛔ | Journal | features | Query: getEntriesInRange(from, to) - Zeitraum-basierte Abfrage | hoch | Ja | #2200, #901, #2228 | Journal.md#queries, ../features/Time-System.md#schemas | [neu] src/features/journal/queries.ts:getEntriesInRange() |
| 2225 | ⛔ | Journal | features | Query: getPinnedEntries() | mittel | Nein | #2200, #2228 | Journal.md#queries | [neu] src/features/journal/queries.ts:getPinnedEntries() |
| 2226 | ⛔ | Journal | application | Journal-Panel UI im SessionRunner (Quick Note Button, filterbare Liste) | hoch | Ja | #2212, #2213, #2221, #2222, #2223, #2224, #2225, #2228 | Journal.md#sessionrunner, ../application/SessionRunner.md#journal-integration | [neu] src/application/session-runner/panels/JournalPanel.svelte, [neu] src/application/session-runner/panels/JournalPanel.svelte:QuickNoteButton, [neu] src/application/session-runner/panels/JournalPanel.svelte:EntryList |
| 2227 | ⛔ | Journal | application | Timeline-View in Almanac (chronologische Ansicht, Filter nach Kategorie/Tags) | mittel | Nein | #2221, #2222, #2223, #2224, #2225 | Journal.md#almanac, ../features/Time-System.md | [neu] src/application/almanac/views/TimelineView.svelte, [neu] src/application/almanac/almanac-viewmodel.ts [ändern] |
| 2228 | 📋 | Journal | features | Journal Feature/Orchestrator mit CRUD-Logik | hoch | Ja | - | Journal.md, ../architecture/Features.md | [neu] src/features/journal/orchestrator.ts:createJournalOrchestrator(), [neu] src/features/journal/types.ts:JournalFeaturePort, [neu] src/features/journal/storage.ts:JournalStoragePort [neu], [neu] src/features/journal/index.ts |
| 2976 | ⛔ | Journal | core | linkedNPCs Feld im JournalEntry-Schema für schnelle NPC-Queries (Array<EntityId<'npc'>>) | mittel | Ja | #2200 | Journal.md#schema | src/core/schemas/journal.ts:journalEntrySchema (linkedNPCs Feld hinzufügen) |
| 2977 | ⛔ | Journal | application | NPC-Link-Komponente mit Hover-Summary (Klick → Journal-Tab, Hover → letzte 3 Encounters) | niedrig | Nein | #2976, #2228, #3115, #1300 | Journal.md#npc-link-ui, Journal.md#hover-preview | [neu] src/application/shared/components/NPCJournalLink.svelte, [neu] src/application/shared/components/NPCJournalLink.svelte:getNpcJournalSummary() |
| 3115 | ⬜ | Journal | features | Query: getJournalEntriesForNPC(npcId) - optimiert via linkedNPCs-Feld | hoch | --imp | - | Journal.md#queries, Journal.md#npc-link-ui | - |
