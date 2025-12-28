# Schema: Session

> **Produziert von:** sessionState (Session starten/beenden)
> **Konsumiert von:** [Journal-Feature](../features/Journal.md) (Entry-Gruppierung via sessionId), [SessionRunner](../views/SessionRunner.md) (Session-Stats Anzeige)

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| id | string | Eindeutige Session-ID | Required |
| name | string | Session-Name (z.B. "Session 12: Die Goblin-Hoehle") | Required |
| startTime | Date | Startzeit der Session (Echtzeit) | Required |
| endTime | Date | Endzeit der Session | Optional (gesetzt bei Session-Ende) |
| summary | string | Zusammenfassung (manuell oder AI-generiert) | Optional |
| stats | SessionStats | Statistiken der Session | Required |

## Eingebettete Typen

### SessionStats

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| encountersCompleted | number | Anzahl abgeschlossener Encounters |
| questsProgressed | number | Anzahl fortgeschrittener Quests |
| distanceTraveled | number | Zurueckgelegte Distanz in Hex-Tiles |
| inGameTimeElapsed | Duration | Verstrichene In-Game-Zeit |

## Invarianten

- `endTime` ist nur gesetzt wenn Session beendet wurde
- `stats` werden automatisch waehrend der Session aktualisiert
- Alle JournalEntry mit `sessionId` gehoeren zu dieser Session

## Beispiel

```typescript
const session: Session = {
  id: 'session-12',
  name: 'Session 12: Die Goblin-Hoehle',
  startTime: new Date('2024-03-15T18:00:00'),
  endTime: new Date('2024-03-15T22:30:00'),
  summary: 'Die Gruppe reiste zur Goblin-Hoehle und saeuberte sie erfolgreich.',
  stats: {
    encountersCompleted: 3,
    questsProgressed: 2,
    distanceTraveled: 8,
    inGameTimeElapsed: { hours: 14, minutes: 30 }
  }
};
```
