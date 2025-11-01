# Almanac System Documentation

**Status:** Phase 13 Priority 1-2 Complete (Vault Integration + Event Editor) | Priority 3-7 Planned
**Last Updated:** Nov 1, 2025

## Overview

The Almanac is a calendar management workmode that tracks campaign time, schedules events, and triggers automated simulation updates. It provides:

- **Current Time Display**: Shows campaign calendar timestamp with precise minute-level tracking
- **Time Controls**: Advance/rewind time by day, hour, or minute increments
- **Event Scheduling**: Create and manage calendar events and phenomena
- **Multiple Calendar Views**: Toggle between list view (upcoming events) and month grid view with event indicators
- **Vault Persistence**: Calendar schema loaded from vault, time advances persist automatically to almanac state file
- **Simulation Integration**: Automatically triggers faction actions, weather updates, and other time-based systems when calendar advances (hooks defined, integration planned)

## Architecture

### Core Components

```
src/workmodes/almanac/
├── domain/                      # Calendar domain logic (pure functions)
│   ├── index.ts                # Core types and functions (CalendarSchema, CalendarTimestamp, advanceTime)
│   ├── conflict-resolution.ts  # Event conflict detection and resolution
│   └── __tests__/              # Domain logic tests
├── data/                        # Data layer (state management, persistence)
│   ├── calendar-state-gateway.ts        # Vault persistence and simulation hook coordination
│   ├── repositories.ts                  # Vault repositories (calendar, event, phenomenon)
│   ├── faction-simulation-hook-factory.ts
│   └── weather-simulation-hook-factory.ts
├── gateway-factory.ts           # Factory for creating vault-backed gateway
├── view/                        # UI components
│   ├── almanac-mvp.ts          # MVP integration (mock data, component orchestration, view switching)
│   ├── almanac-time-display.ts # Time display and advance controls
│   ├── upcoming-events-list.ts # 7-day event preview (list view)
│   ├── month-view-calendar.ts  # Month calendar grid with event indicators
│   └── event-editor-modal.ts   # Event creation/editing (placeholder)
└── index.ts                     # Obsidian ItemView registration
```

### Key Concepts

**CalendarSchema** - Defines calendar structure
- Months, days per week, hours per day, minutes per hour
- Epoch (reference point for calculations)
- Pluggable: supports custom fantasy calendars (not just Gregorian)
- Location: `src/workmodes/almanac/domain/index.ts:20-40`

**CalendarTimestamp** - Precise point in campaign time
- Year, month, day, hour, minute (all required for MVP)
- Precision field supports lower-resolution timestamps (future: "day" precision for vague dates)
- Immutable - all time operations return new timestamp objects
- Location: `src/workmodes/almanac/domain/index.ts:42-60`

**CalendarEvent** - Scheduled occurrence
- One-time or recurring (recurrence patterns: daily, weekly, monthly, yearly, custom interval)
- Title, description, category, tags
- Triggers optional hooks when reached (e.g., "spawn faction encounter")
- Location: `src/workmodes/almanac/domain/index.ts:80-110`

**PhenomenonOccurrence** - Calendar-independent natural cycles
- Moon phases, eclipses, seasonal transitions
- Precomputed timestamps (not recurrence-based like events)
- Used for astronomical and environmental effects
- Location: `src/workmodes/almanac/domain/index.ts:112-130`

## Data Flow

### Time Advancement

```
User clicks +/- button in Almanac UI
  ↓
almanac-time-display.ts fires onAdvance callback
  ↓
almanac-mvp.ts updates local currentTimestamp state
  ↓
Triggers re-render of time display and events list
  ↓
(Future) calendar-state-gateway.ts persists to vault
  ↓
(Future) Simulation hooks execute (faction AI, weather, etc.)
```

**Current Implementation (Phase 13 Priority 1):**
- Vault data integration complete via CalendarStateGateway
- Calendar schema loaded from `SaltMarcher/Calendars/` (auto-selects first if no default)
- Time advances persist to `SaltMarcher/Almanac/state.json`
- Event/phenomenon data loaded from vault
- Two calendar views: list (upcoming 7 days) and month grid with event indicators
- View switching buttons to toggle between views
- Month grid shows day cells with event count badges
- Simulation hooks defined but not yet triggered (Phase 13+)

**Future Implementation (Phase 13 Priority 3-7):**
- Week/timeline calendar views
- Month navigation controls (prev/next month)
- Astronomical cycles UI
- Event inbox with priority sorting
- Search functionality
- Automatic simulation trigger when calendar advances (hook execution)

### Event Scheduling

**Planned Flow (Not Yet Implemented):**
```
User clicks "Add event" button
  ↓
event-editor-modal.ts opens (currently placeholder)
  ↓
User fills title, timestamp, recurrence pattern, tags
  ↓
calendar-state-gateway.ts saves event to vault
  ↓
Event appears in upcoming-events-list.ts
  ↓
When calendar reaches event timestamp:
  - Event hook executes (if defined)
  - Event appears in inbox (if unread)
  - Notification shown (if enabled)
```

## Current Limitations (Phase 13 Priority 1)

### Vault Data Integration Complete
- ✅ Calendar schema loaded from `SaltMarcher/Calendars/*.md`
- ✅ Time advances persist to `SaltMarcher/Almanac/state.json`
- ✅ Event/phenomenon data loaded from vault repositories
- ✅ Gateway factory pattern for dependency injection (gateway-factory.ts)

### Event Editor (Phase 13 Priority 2 Complete)
- ✅ Full event editor modal implementation (event-editor-modal.ts)
- ✅ Create and edit events in UI with comprehensive form
- ✅ Basic fields: title, description, category, tags, priority
- ✅ Timestamp selection: year, month, day, hour, minute
- ✅ All-day event toggle
- ✅ Single vs recurring event type selection
- ✅ Recurrence patterns: Annual, Monthly, Weekly, Custom
- ✅ Form validation (required fields, date/time bounds checking)
- ✅ Save callback integration with almanac MVP
- 📋 Future: Bounds/end dates for recurring events, duration fields

### Limited Calendar Grid Views
- **Implemented:** List view (upcoming 7 days) and month grid view with event indicators
- **Missing:** Week view, timeline view
- Month grid has simplified weekday calculation (assumes month starts Monday for MVP)
- No month navigation (prev/next month buttons) - always shows current month

### No Simulation Integration
- Time advances don't trigger faction AI, weather updates, etc.
- Simulation hooks exist but aren't connected
- **Why:** Requires vault persistence first (can't trigger simulations without saving state)

### No Search or Filtering
- Search button shows placeholder notice (index.ts:52)
- Events list shows all occurrences without filtering
- **Why:** Deferred until event creation works

## Implementation Details

### Time Arithmetic

All time calculations use pure functions in `domain/index.ts`:

```typescript
advanceTime(schema: CalendarSchema, timestamp: CalendarTimestamp, amount: number, unit: TimeUnit): {
    timestamp: CalendarTimestamp;
    overflow: { years: number; months: number; days: number; hours: number; minutes: number };
}
```

**Features:**
- Handles month/year rollovers correctly
- Returns overflow information (e.g., advancing 400 days → 1 year + overflow)
- Immutable - never mutates input timestamp
- Supports negative amounts (go backward in time)

**Testing:**
- 24 unit tests covering edge cases (devkit/testing/unit/workmodes/almanac/time-arithmetic.test.ts)
- Month boundary tests (Jan 31 + 1 month → Feb 28/29)
- Year rollover tests (Dec 31 + 1 day → Jan 1 next year)
- Negative amounts (backward time travel)

### Event Recurrence

**Supported Patterns (Domain Logic Complete):**
- `daily`: Every N days
- `weekly`: Every N weeks on specific weekdays
- `monthly`: Every N months on specific day-of-month
- `yearly`: Every N years on specific month+day
- `custom`: Arbitrary day interval

**Implementation:**
```typescript
computeNextEventOccurrence(event: CalendarEvent, schema: CalendarSchema, currentTime: CalendarTimestamp): CalendarTimestamp | null
computeEventOccurrencesInRange(event: CalendarEvent, schema: CalendarSchema, start: CalendarTimestamp, end: CalendarTimestamp, options: { includeStart?: boolean; limit?: number }): EventOccurrence[]
```

**UI Status:** Not yet exposed in editor modal (Phase 13)

### Component Patterns

**Handle-Based Components:**
All Almanac UI components return "handles" with standard interface:

```typescript
interface ComponentHandle {
    readonly root: HTMLElement;      // Container for appending to DOM
    update(...args): void;            // Re-render with new data
    destroy(): void;                  // Cleanup (remove event listeners, clear DOM)
}
```

**Why This Pattern:**
- Allows parent to control lifecycle (manual cleanup)
- No framework dependencies (vanilla JS)
- Testable (can call update() with different data states)
- Consistent with other Salt Marcher UI components

**Example:**
```typescript
const timeDisplay = createAlmanacTimeDisplay({ currentTimestamp, schema, onAdvanceDay, onAdvanceHour, onAdvanceMinute });
container.appendChild(timeDisplay.root);

// Later: update with new data
timeDisplay.update(newTimestamp, schema);

// Cleanup
timeDisplay.destroy();
```

### Code Duplication (Identified Technical Debt)

**Issue:** Three nearly-identical handlers in almanac-mvp.ts

```typescript
function handleAdvanceDay(amount: number): void {
    logger.info("[almanac-mvp] Advancing time by days", { amount });
    const result = advanceTime(mockSchema, currentTimestamp, amount, "day");
    currentTimestamp = result.timestamp;
    timeDisplay?.update(currentTimestamp, mockSchema);
    eventsList?.update(mockEvents, mockPhenomena, mockSchema, currentTimestamp);
}

function handleAdvanceHour(amount: number): void { /* identical except "day" → "hour" */ }
function handleAdvanceMinute(amount: number): void { /* identical except "day" → "minute" */ }
```

**Impact:** [LOW] - Only 3 handlers, minimal duplication, works correctly

**Suggested Fix (Future):**
```typescript
function createAdvanceHandler(unit: TimeUnit) {
    return (amount: number) => {
        logger.info(`[almanac-mvp] Advancing time by ${unit}s`, { amount });
        const result = advanceTime(mockSchema, currentTimestamp, amount, unit);
        currentTimestamp = result.timestamp;
        timeDisplay?.update(currentTimestamp, mockSchema);
        eventsList?.update(mockEvents, mockPhenomena, mockSchema, currentTimestamp);
    };
}

const handleAdvanceDay = createAdvanceHandler("day");
const handleAdvanceHour = createAdvanceHandler("hour");
const handleAdvanceMinute = createAdvanceHandler("minute");
```

## Integration Points

### Calendar State Gateway

**File:** `src/workmodes/almanac/data/calendar-state-gateway.ts`

**Purpose:** Bridge between Almanac UI and vault/simulation systems

**Current Status (Phase 13 Priority 1):** ✅ Connected to UI
- Vault persistence fully functional
- Time advances automatically persisted via `advanceTimeBy(amount, unit)`
- Calendar schema loaded on initialization
- Event/phenomenon repositories integrated
- Simulation hook interfaces defined (FactionSimulationHook, WeatherSimulationHook)
- **Simulation hooks not yet executed** - interface defined, implementation planned

**Key Functions:**
```typescript
loadSnapshot(): Promise<AlmanacSnapshot>  // Loads complete calendar state
advanceTimeBy(amount: number, unit: TimeUnit): Promise<{ timestamp: CalendarTimestamp }>
```

**Gateway Factory:**
- `createAlmanacGateway(app: App): CalendarStateGateway` (gateway-factory.ts)
- Creates vault-backed repositories and wires them to gateway
- Used by Almanac view on initialization (index.ts:75-76)

**Data Persistence:**
- Calendar schemas: `SaltMarcher/Calendars/*.md`
- Almanac state: `SaltMarcher/Almanac/state.json` (current time, active calendar)
- Events: Loaded via VaultEventRepository
- Phenomena: Loaded via VaultAlmanacRepository

### Faction System Integration

**Hook:** `FactionSimulationHook` (defined in calendar-state-gateway.ts:26-31)

**Purpose:** When calendar advances, trigger faction AI simulation for elapsed days

**Status:** Interface defined, not yet called by Almanac UI

**Future Behavior:**
1. User advances calendar by N days
2. calendar-state-gateway.ts detects time change
3. Calls `factionHook.onDayAdvanced(daysElapsed, newTimestamp)`
4. Faction AI executes N daily simulation ticks
5. Faction events (battles, expansions, etc.) added to calendar inbox
6. Player sees inbox notification

**Tests:** See devkit/testing/unit/features/factions/faction-simulation.test.ts

### Weather System Integration

**Hook:** `WeatherSimulationHook` (defined in calendar-state-gateway.ts)

**Purpose:** When calendar advances, update weather conditions for active hex

**Status:** Interface defined, not yet called by Almanac UI

**Future Behavior:**
1. User advances calendar time
2. calendar-state-gateway.ts calls `weatherHook.onTimeAdvanced(newTimestamp, activeHex)`
3. Weather store simulates weather transitions for elapsed time
4. Session Runner UI reflects new weather automatically

**Current Workaround:** Session Runner manually triggers weather simulation when travel advances time (separate from Almanac)

**Tests:** See devkit/testing/unit/workmodes/almanac/weather-calendar-integration.test.ts

## Testing Strategy

### Unit Tests (14 tests - 100% passing)

**File:** `devkit/testing/unit/apps/almanac/almanac-mvp.test.ts`

**Coverage:**
- Time display component rendering and updates
- Upcoming events list rendering (empty state, with events, sorting)
- Month view calendar grid rendering
  - Day cells with event indicators
  - Current day highlighting
  - Proper grid layout (weeks)
  - Event/phenomenon counting
- View switching between list and month views
- Event click handler invocation
- Component lifecycle (creation, update, destruction)

**Key Test Cases:**
```typescript
// Time display updates correctly
expect(timeDisplay.textContent).toContain("Jan 1, 2025, 12:00");
timeDisplay.update(newTimestamp, schema);
expect(timeDisplay.textContent).toContain("Jan 2, 2025, 12:00");

// Events list shows next 7 days only
const occurrences = computeEventOccurrencesInRange(event, schema, currentTime, sevenDaysLater);
expect(occurrences.length).toBe(3); // Correct filtering

// Event click handler invoked
const eventItem = list.querySelector('[data-type="event"]');
eventItem.click();
expect(mockOnEventClick).toHaveBeenCalledWith(expect.objectContaining({ id: "test-event" }));
```

### Integration Tests (Planned - Phase 13)

**Missing Tests:**
- Vault persistence (save/load calendar state)
- Simulation hook execution (faction/weather triggers)
- Event editor modal form submission
- Search functionality

**Why Deferred:** Require vault integration, which isn't implemented in MVP

## Known Issues

### [LOW] Code Duplication in Time Handlers
- **Location:** almanac-mvp.ts:98-117
- **Impact:** Minimal - only 3 handlers, easy to maintain
- **Fix:** Extract to higher-order function (see "Code Duplication" section above)
- **Note:** Handlers now call `updateAllViews()` helper (line 92-96) to update all views simultaneously

### [LOW] Missing Keyboard Shortcuts
- **Location:** All Almanac UI components
- **Impact:** Mouse-only interaction
- **Suggested Fix:** Add keyboard listeners for common actions:
  - Arrow keys: Navigate event list / Navigate month days
  - Space/Enter: Activate focused item
  - Ctrl+Plus/Minus: Advance time
  - Tab: Switch between list/month views
  - Escape: Close modal

### [LOW] No Loading States
- **Location:** almanac-mvp.ts (future vault integration)
- **Impact:** UI appears frozen during async operations
- **Suggested Fix:** Add loading spinner when loading calendar from vault

## Future Enhancements (Phase 13+)

### Full Calendar Views
- **Month View:** ✅ **Implemented** - Grid layout with clickable days, event indicators
  - Future enhancements: Month navigation (prev/next), proper weekday calculation, click-to-add events
- **Week View:** 7-day horizontal layout with hourly slots (planned)
- **Timeline View:** Chronological list with date separators (planned)

### Event Editor Implementation
- **Form Fields:**
  - Title (text input)
  - Description (textarea)
  - Timestamp picker (year/month/day/hour/minute dropdowns)
  - Recurrence pattern selector (dropdown + configuration)
  - Category/tags (multiselect)
  - Hook type (dropdown: none, faction goal, weather event, custom)

### Astronomical Cycles UI
- **Moon Phases:** Visual moon icon showing current phase
- **Eclipses:** Highlighted in calendar when occurring
- **Seasons:** Background color/icon changes based on current season

### Event Inbox
- **Purpose:** Shows unread events requiring DM attention
- **Priority Sorting:** Critical faction events first, then regular events
- **Mark Read/Unread:** Manual control over inbox status
- **Integration:** Appears in Almanac header + status bar item

### Vault Data Integration
- **Replace Mock Data:** Load schema from `SaltMarcher/Calendar/schema.md`
- **Persist State:** Save current time to `SaltMarcher/Calendar/state.md`
- **Event Storage:** Each event as separate markdown file in `SaltMarcher/Calendar/Events/`
- **Phenomena:** Generated dynamically (not stored, computed on-demand)

## API Reference

### Domain Functions

**advanceTime(schema, timestamp, amount, unit)**
- Returns: `{ timestamp: CalendarTimestamp, overflow: {...} }`
- Units: "minute", "hour", "day", "month", "year"
- Handles all rollovers correctly
- Supports negative amounts (backward time)

**formatTimestamp(timestamp, monthName?)**
- Returns: Human-readable string (e.g., "Jan 15, 2025, 14:30")
- Optional monthName parameter (if not provided, uses monthId)

**computeNextEventOccurrence(event, schema, currentTime)**
- Returns: Next occurrence timestamp or null (if event doesn't repeat)
- Respects recurrence patterns

**computeEventOccurrencesInRange(event, schema, start, end, options)**
- Returns: Array of occurrences within time range
- Options: includeStart (boolean), limit (number)
- Efficient: stops early if limit reached

### Component Creation Functions

**createAlmanacTimeDisplay(options)**
- Returns: AlmanacTimeDisplayHandle
- Options: currentTimestamp, schema, onAdvanceDay, onAdvanceHour, onAdvanceMinute

**createUpcomingEventsList(options)**
- Returns: UpcomingEventsListHandle
- Options: events, phenomena, schema, currentTimestamp, onEventClick

**createMonthViewCalendar(options)**
- Returns: MonthViewCalendarHandle
- Options: events, phenomena, schema, currentTimestamp, onDayClick, onEventClick

**openEventEditor(app, options)**
- Opens modal (no return value)
- Options: event (optional), onSave (callback)

## File Locations

**Core Implementation:**
- Domain logic: `src/workmodes/almanac/domain/index.ts` (500+ lines)
- MVP UI: `src/workmodes/almanac/view/almanac-mvp.ts` (225 lines)
- Time display: `src/workmodes/almanac/view/almanac-time-display.ts` (127 lines)
- Events list: `src/workmodes/almanac/view/upcoming-events-list.ts` (196 lines)
- Month view: `src/workmodes/almanac/view/month-view-calendar.ts` (248 lines)
- Event editor: `src/workmodes/almanac/view/event-editor-modal.ts` (560 lines)

**Data Layer:**
- State gateway: `src/workmodes/almanac/data/calendar-state-gateway.ts` (400+ lines)
- Faction hook: `src/workmodes/almanac/data/faction-simulation-hook-factory.ts`
- Weather hook: `src/workmodes/almanac/data/weather-simulation-hook-factory.ts`

**Tests:**
- MVP tests: `devkit/testing/unit/apps/almanac/almanac-mvp.test.ts` (405 lines, 14 tests)
- Event editor tests: `devkit/testing/unit/apps/almanac/event-editor.test.ts` (375 lines, 18 tests)
- Domain tests: `src/workmodes/almanac/domain/__tests__/` (24+ tests)

**Documentation:**
- This file: `docs/almanac-system.md`
- Weather integration: `docs/weather-system.md` (mentions Almanac hooks)
- Faction integration: `docs/faction-system.md` (mentions Almanac hooks)

## Related Systems

- **Weather System:** Uses Almanac hooks for automatic weather simulation (docs/weather-system.md)
- **Faction System:** Uses Almanac hooks for AI decision-making (docs/faction-system.md)
- **Session Runner:** Displays current calendar time in compact sidebar widget
- **Event Engine:** Generic timeline/inbox system (Almanac provides event sources)
