# Schema: JournalEntry

> **Produziert von:** Quest-Feature (auto), Encounter-Feature (auto), Travel-Feature (auto), GM/Player (manuell)
> **Konsumiert von:** [SessionRunner](../application/SessionRunner.md) (Journal-Panel, Quick-Note), [Almanac](../application/Almanac.md) (Timeline-View)

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| id | EntityId<'journal'> | Eindeutige Entry-ID | Required |
| timestamp | Timestamp | In-Game Zeit des Ereignisses | Required |
| realWorldTime | Date | Echtzeit der Session | Optional |
| category | JournalCategory | Kategorisierung des Eintrags | Required |
| source | JournalSource | Herkunft (auto/gm/player) | Required |
| title | string | Titel des Eintrags | Required |
| content | string | Markdown-formatierter Inhalt | Required |
| summary | string | Kurzfassung fuer Listen-Ansicht | Optional |
| relatedEntities | JournalEntityRef[] | Verknuepfte Entities | Optional |
| linkedNPCs | EntityId<'npc'>[] | Schnell-Zugriff fuer NPC-Historie | Optional |
| sessionId | string | Zugehoerige Session-ID | Optional |
| tags | string[] | User-definierte Tags | Optional |
| pinned | boolean | Wichtiger Eintrag markiert | Optional, default: false |

## Eingebettete Typen

### JournalCategory

```typescript
type JournalCategory =
  | 'quest'          // Quest-bezogene Eintraege
  | 'encounter'      // Kampf-Protokolle
  | 'travel'         // Reise-Ereignisse
  | 'discovery'      // Neue Orte, NPCs, Lore entdeckt
  | 'worldevent'     // Welt-Ereignisse (Wetter, Fraktionen)
  | 'session'        // Session-Zusammenfassungen
  | 'note';          // Freie Notizen
```

### JournalSource

```typescript
type JournalSource =
  | 'auto'           // Automatisch generiert
  | 'gm'             // Vom GM erstellt
  | 'player';        // Von Spieler erstellt
```

### JournalEntityRef

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| entityType | EntityType | Typ der verknuepften Entity |
| entityId | string | ID der verknuepften Entity |
| displayName | string | Cached Name fuer Performance (Optional) |

## Invarianten

- `linkedNPCs` ist ein dediziertes Array fuer schnelle NPC-Queries, ergaenzt `relatedEntities`
- `content` ist Markdown-formatiert
- Bei `source: 'auto'` wird `realWorldTime` automatisch gesetzt

## Beispiel

```typescript
const questEntry: JournalEntry = {
  id: 'journal-001' as EntityId<'journal'>,
  timestamp: { day: 15, month: 'Flamerule', year: 1492 },
  realWorldTime: new Date('2024-03-15T19:30:00'),
  category: 'quest',
  source: 'auto',
  title: 'Quest abgeschlossen: Goblin-Hoehle saeubern',
  content: 'Die Gruppe hat die Goblin-Hoehle erfolgreich gesaeubert...',
  summary: 'Goblin-Hoehle gesaeubert, 150 Gold erhalten',
  relatedEntities: [
    { entityType: 'quest', entityId: 'q-goblin-cave', displayName: 'Goblin-Hoehle saeubern' },
    { entityType: 'npc', entityId: 'npc-tavern-keeper', displayName: 'Barkeep Grim' }
  ],
  linkedNPCs: ['npc-tavern-keeper' as EntityId<'npc'>],
  sessionId: 'session-12',
  tags: ['combat', 'reward'],
  pinned: false
};
```
