# Calendar Presets

This document describes how calendar presets work in the Almanac app.

## Overview

Calendar presets are pre-configured calendar systems that are automatically available when the Almanac is first opened. If no calendars exist in the user's vault, the system will automatically create a default calendar from the presets.

## Available Presets

### Gregorian Calendar (Default)

The standard Earth calendar with:
- **12 months**: January (31), February (28), March (31), April (30), May (31), June (30), July (31), August (31), September (30), October (31), November (30), December (31)
- **7 days per week**
- **24 hours per day**
- **60 minutes per hour**
- **Epoch**: January 1, 2024

**ID**: `gregorian-standard`

## Implementation

### File Structure

```
src/apps/almanac/
├── fixtures/
│   └── gregorian.fixture.ts      # Gregorian calendar definition
└── data/
    └── calendar-presets.ts        # Preset loading and initialization
```

### How It Works

1. **Preset Definition**: Calendar presets are defined in `fixtures/*.fixture.ts` files
2. **Registration**: Presets are registered in `calendar-presets.ts` in the `CALENDAR_PRESETS` array
3. **Auto-initialization**: When the Almanac opens, `ensureDefaultCalendar()` is called
   - If no calendars exist, it creates the first preset (Gregorian) as the default
   - If calendars exist but no default is set, it marks the first calendar as default

### Code Example

```typescript
import type { CalendarSchema } from '../domain/calendar-schema';

export const myCustomCalendar: CalendarSchema = {
  id: 'my-custom-calendar',
  name: 'My Custom Calendar',
  description: 'A custom fantasy calendar',
  daysPerWeek: 10,
  hoursPerDay: 20,
  minutesPerHour: 60,
  secondsPerMinute: 60,
  minuteStep: 15,
  months: [
    { id: 'winter', name: 'Winter Moon', length: 30 },
    { id: 'spring', name: 'Spring Bloom', length: 30 },
    // ... more months
  ],
  epoch: {
    year: 1,
    monthId: 'winter',
    day: 1,
  },
  schemaVersion: '1.0.0',
};
```

## Adding New Presets

To add a new calendar preset:

1. **Create a fixture file** in `src/apps/almanac/fixtures/`:
   ```typescript
   // my-calendar.fixture.ts
   import type { CalendarSchema } from '../domain/calendar-schema';

   export const MY_CALENDAR_ID = 'my-calendar-id';

   export const myCalendarSchema: CalendarSchema = {
     id: MY_CALENDAR_ID,
     name: 'My Calendar',
     // ... rest of the schema
   };
   ```

2. **Register the preset** in `calendar-presets.ts`:
   ```typescript
   import { myCalendarSchema } from '../fixtures/my-calendar.fixture';

   export const CALENDAR_PRESETS: ReadonlyArray<CalendarSchema> = [
     gregorianSchema,
     myCalendarSchema, // Add your preset here
   ];
   ```

3. **Optional**: If you want your calendar to be the default instead of Gregorian, reorder the array (the first preset is used as default).

## Testing

Calendar presets should be tested to ensure:
- Correct structure (months, days per week, time units)
- Default flag is properly set
- No duplicate IDs

See `tests/apps/almanac/calendar-presets.test.ts` for examples.

## Popular Fantasy Calendar Systems

Here are some popular fantasy calendar systems that could be added as presets:

### Harptos Calendar (Forgotten Realms)
- 12 months of 30 days each
- 5 special festival days between months
- 365 days total

### Eberron Calendar
- 12 months of 28 days each
- 4 weeks per month, 7 days per week
- 336 days total

### Golarion Calendar (Pathfinder)
- 12 months of 30-31 days
- 7 days per week
- 365 days total

### Exandria Calendar (Critical Role)
- 11 months of varying length
- 7 days per week
- Custom holidays and festivals
