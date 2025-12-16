# Almanac View Components

UI components for the Almanac workmode calendar system.

## Contents

| File | Purpose |
|------|---------|
| almanac-mvp.ts | Main Almanac UI orchestrator - coordinates all views |
| almanac-toolbar.ts | Toolbar with navigation, view switching, quick actions |
| astronomical-panel.ts | Sun/moon phase display panel |
| calendar-selector.ts | Calendar selection dropdown |
| event-context-menu.ts | Right-click context menu for events |
| event-editor-modal.ts | Modal for creating/editing calendar events |
| event-inbox-panel.ts | Inbox panel with priority filtering |
| event-preview-panel.ts | Event detail preview sidebar |
| inline-editor.ts | Inline text editing component |
| jump-to-date-modal.ts | Modal for jumping to specific date |
| almanac-keyboard-shortcuts-help.ts | Keyboard shortcuts help overlay |
| month-view-calendar.ts | Monthly calendar grid view |
| occurrence-cache.ts | Cache for phenomenon occurrences |
| panel-collapse-util.ts | Utility for collapsible panels |
| quick-add-bar.ts | Quick event creation bar |
| quick-add-input.ts | Input component for quick-add |
| search-bar.ts | Event search input component |
| sidebar-resize-handle.ts | Resizable sidebar handle |
| template-editor-modal.ts | Modal for editing event templates |
| template-manager-modal.ts | Modal for managing templates |
| time-controls-panel.ts | Time advancement controls |
| timeline-view-calendar.ts | Timeline/agenda view |
| upcoming-events-list.ts | Upcoming events sidebar list |
| view-switcher.ts | View mode switcher (month/week/timeline) |
| week-view-calendar.ts | Weekly calendar view |

## Connections

**Dependencies:**
- `../domain/` - Calendar types, timestamp utilities
- `../data/` - Repositories, state gateway
- `@ui/patterns/` - Base modal, panel patterns

**Consumers:**
- `../mode/almanac-mode.ts` - Main mode entry point
- `../../session-runner/` - Calendar integration

## Public API

Main entry point: `createAlmanacMvp()` from `almanac-mvp.ts`

```typescript
import { createAlmanacMvp } from './almanac-mvp';

const handle = createAlmanacMvp({
    gateway: calendarStateGateway,
    container: parentElement,
});

// Update with new data
handle.update(events, phenomena, schema, timestamp);

// Cleanup
handle.destroy();
```
