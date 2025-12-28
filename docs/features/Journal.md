# Journal

> **Verantwortlichkeit:** Single Source of Truth fuer Session-Journal und automatische Event-Protokollierung
>
> **Referenzierte Schemas:**
> - [journal-entry.md](../entities/journal-entry.md) - Journal-Eintraege
> - [journal-settings.md](../entities/journal-settings.md) - Journal-Konfiguration
> - [session.md](../entities/session.md) - Session-Daten
>
> **Verwandte Dokumente:**
> - [Time-System.md](Time-System.md) - Zeit-basierte Eintraege
> - [Quest-System.md](Quest-System.md) - Quest-Events
> - [encounter/Encounter.md](../services/encounter/Encounter.md) - Encounter-Events
>
> **Wird benoetigt von:** SessionControl, Almanac

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

---

## Session-Management

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

## UI-Integration

### NPC-Link-Komponente

NPCs koennen direkt aus ihrer Detail-Ansicht auf ihre Journal-Historie zugreifen:

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

| Aktion | Ergebnis |
|--------|----------|
| **Hover** | Tooltip mit Summary der letzten 3 Encounters |
| **Klick** | Wechsel zu Journal-Tab, gefiltert nach NPC-ID |

**Hover-Preview Beispiel:**
```
📜 Letzte Begegnungen mit Griknak:
• 15. Flamerule: Kampf - Goblin-Patrouille besiegt
• 12. Flamerule: Sozial - Verhandlung gescheitert
• 8. Flamerule: Spur - Goblin-Lager entdeckt
```

---

## API

### Queries

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

### NPC-Summary Helper

```typescript
function getNpcJournalSummary(npcId: EntityId<'npc'>): string {
  const entries = journal
    .filter(e => e.linkedNPCs?.includes(npcId))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3);

  if (entries.length === 0) return 'Keine Begegnungen dokumentiert.';

  return entries.map(e => `• ${formatDate(e.timestamp)}: ${e.summary ?? e.title}`).join('\n');
}
```

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

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
