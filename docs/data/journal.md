# Schema: JournalEntry

> **Produziert von:** [Journal-Feature](../features/Journal.md) (Auto-Generierung, manuelle Eintraege)
> **Konsumiert von:** [SessionRunner](../application/SessionRunner.md), [Almanac](../application/Almanac.md), [Quest](../features/Quest-System.md)

Persistente Aufzeichnung aller Session-relevanten Ereignisse - automatisch generierte und manuelle Eintraege.

---

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `id` | `EntityId<'journal'>` | Eindeutige ID | Required |
| `timestamp` | `Timestamp` | In-Game Zeit des Ereignisses | Required |
| `realWorldTime` | `Date` | Echtzeit der Session | Optional |
| `category` | `JournalCategory` | Kategorisierung | Required |
| `source` | `JournalSource` | Quelle des Eintrags | Required |
| `title` | `string` | Titel des Eintrags | Required, non-empty |
| `content` | `string` | Markdown-formatierter Inhalt | Required |
| `summary` | `string` | Kurzfassung fuer Listen-Ansicht | Optional |
| `relatedEntities` | `JournalEntityRef[]` | Verknuepfte Entities | Optional |
| `linkedNPCs` | `EntityId<'npc'>[]` | Schnellzugriff fuer NPC-Historie | Optional |
| `sessionId` | `string` | Zuordnung zur Session | Optional |
| `tags` | `string[]` | User-definierte Tags | Optional |
| `pinned` | `boolean` | Wichtiger Eintrag | Optional, default: false |

---

## Sub-Schemas

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

Verknuepfung zu beliebigen Entities mit gecachtem Display-Namen.

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `entityType` | `EntityType` | Typ der Entity | Required |
| `entityId` | `string` | ID der Entity | Required |
| `displayName` | `string` | Gecachter Anzeigename | Optional |

---

## Invarianten

- `category` muss gueltiger JournalCategory-Wert sein
- `source` muss gueltiger JournalSource-Wert sein
- `timestamp` muss gueltige Timestamp sein
- `linkedNPCs` ist redundant zu `relatedEntities` mit `entityType: 'npc'` - existiert fuer Performance-Optimierung bei NPC-Queries

---

## Konsumenten

### SessionRunner

Journal-Panel mit filterbarer Liste aller Eintraege. Quick Note Button fuer schnelle GM-Notizen. Clickable Entity-Links in Eintraegen fuehren zur jeweiligen Detail-Ansicht.

→ [SessionRunner.md](../application/SessionRunner.md)

### Almanac

Timeline-View zeigt Journal-Eintraege chronologisch an. Filter nach Kategorie und Tags moeglich.

→ [Almanac.md](../application/Almanac.md)

### Quest-Feature

Quest-Events werden automatisch geloggt: Quest entdeckt, Objective abgeschlossen, Quest beendet.

→ [Quest-System.md](../features/Quest-System.md)

---

## Beispiel

```typescript
const journalEntry: JournalEntry = {
  id: 'journal:goblin-ambush-001',
  timestamp: { day: 15, month: 'Flamerule', year: 1492, hour: 14 },
  realWorldTime: new Date('2024-03-15T19:30:00'),
  category: 'encounter',
  source: 'auto',
  title: 'Kampf: Goblin-Patrouille',
  content: `Die Gruppe wurde von einer Goblin-Patrouille ueberrascht.

## Ausgang
- 5 Goblins besiegt
- Keine Verluste
- 25 XP pro Charakter

## Beute
- 3 Kurzschwerter
- 12 Goldmuenzen`,
  summary: 'Goblin-Patrouille besiegt, 25 XP',
  relatedEntities: [
    { entityType: 'creature', entityId: 'creature:goblin', displayName: 'Goblin' },
    { entityType: 'poi', entityId: 'poi:forest-road', displayName: 'Waldweg' }
  ],
  linkedNPCs: ['npc:griknak'],
  sessionId: 'session-12',
  tags: ['combat', 'goblin'],
  pinned: false
};
```
