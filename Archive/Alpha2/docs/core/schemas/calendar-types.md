# Calendar Types Schema

Kalender-Datentypen für das Almanac-System und zeitbasierte Berechnungen.

## Implementation

`src/core/schemas/calendar-types.ts`

## Interfaces

### CalendarDate

Einfaches Datum für Simulation und Persistenz.

```typescript
interface CalendarDate {
  year: number;
  month: number;  // 0-11
  day: number;    // 1-31
}
```

## Verwendung

- Weather-Simulation (`MapWeatherState.lastSimulated`)
- Population-Simulation (`MapPopulations.lastSimulatedDate`)
- Juvenile-Maturation (`Juvenile.birthDate`)
- Klimazonen-Berechnung (`MapClimateZones.lastCalculated`)
