# Schema: JournalSettings

> **Produziert von:** User-Konfiguration (Settings-UI)
> **Konsumiert von:** [Journal-Feature](../features/Journal.md) (Steuert Auto-Generierung und Detail-Level)

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| autoLog | AutoLogSettings | Welche Events automatisch protokolliert werden | Required |
| encounterDetailLevel | 'minimal' \| 'standard' \| 'detailed' | Detail-Level fuer Encounter-Protokolle | Required, default: 'standard' |

## Eingebettete Typen

### AutoLogSettings

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| quests | boolean | Quest-Events loggen (default: true) |
| encounters | boolean | Encounter-Events loggen (default: true) |
| travel | boolean | Travel-Events loggen (default: true) |
| worldEvents | boolean | World-Events loggen (default: false) |

### EncounterDetailLevel

| Wert | Beschreibung |
|------|--------------|
| 'minimal' | Nur Ausgang |
| 'standard' | Creatures, Ausgang, XP |
| 'detailed' | Runden-Protokoll inkl. Schaden |

## Invarianten

- Alle `autoLog`-Felder haben sinnvolle Defaults (quests/encounters/travel: true, worldEvents: false)
- `encounterDetailLevel` beeinflusst nur Eintraege mit `category: 'encounter'`

## Beispiel

```typescript
const defaultSettings: JournalSettings = {
  autoLog: {
    quests: true,
    encounters: true,
    travel: true,
    worldEvents: false
  },
  encounterDetailLevel: 'standard'
};

const verboseSettings: JournalSettings = {
  autoLog: {
    quests: true,
    encounters: true,
    travel: true,
    worldEvents: true
  },
  encounterDetailLevel: 'detailed'
};
```
