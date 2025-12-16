export const almanacCss = `
/* === Almanac Design System === */

/* Priority Colors */
:root {
    --sm-almanac-priority-urgent: #EF4444;   /* red-500, 9-10 */
    --sm-almanac-priority-high:   #F59E0B;   /* amber-500, 7-8 */
    --sm-almanac-priority-normal: #3B82F6;   /* blue-500, 4-6 */
    --sm-almanac-priority-low:    #6B7280;   /* gray-500, 1-3 */

    /* Typography */
    --sm-almanac-font-h1: 18px;
    --sm-almanac-font-h2: 16px;
    --sm-almanac-font-h3: 14px;
    --sm-almanac-font-body: 13px;
    --sm-almanac-font-small: 12px;
    --sm-almanac-font-tiny: 11px;

    /* Spacing */
    --sm-almanac-space-xs: 4px;
    --sm-almanac-space-sm: 8px;
    --sm-almanac-space-md: 12px;
    --sm-almanac-space-lg: 16px;
    --sm-almanac-space-xl: 24px;
    --sm-almanac-space-2xl: 32px;

    /* Shadows */
    --sm-almanac-shadow-hover: 0 2px 8px rgba(0, 0, 0, 0.1);
    --sm-almanac-shadow-active: 0 4px 16px rgba(0, 0, 0, 0.15);

    /* Transitions */
    --sm-almanac-transition-fast: 150ms ease-in-out;
    --sm-almanac-transition-normal: 250ms ease-in-out;
}

/* === Almanac MVP Container === */

.sm-almanac-mvp {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
    overflow: hidden;
}

.sm-almanac-mvp__layout {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
    gap: var(--sm-almanac-space-md);
}

.sm-almanac-mvp__sidebar {
    width: 300px;
    min-width: 240px;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: var(--sm-almanac-space-md);
    overflow-y: auto;
    padding: var(--sm-almanac-space-md);
    background: var(--background-secondary);
    border-right: 1px solid var(--background-modifier-border);
}

.sm-almanac-mvp__main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.sm-almanac-mvp__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sm-almanac-space-md);
    border-bottom: 1px solid var(--background-modifier-border);
    gap: var(--sm-almanac-space-md);
}

.sm-almanac-mvp__view-switcher {
    display: flex;
    gap: var(--sm-almanac-space-xs);
    padding: var(--sm-almanac-space-sm);
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
}

.sm-almanac-mvp__view-switcher button {
    padding: var(--sm-almanac-space-sm) var(--sm-almanac-space-md);
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    border-radius: 6px;
    cursor: pointer;
    font-size: var(--sm-almanac-font-body);
    font-weight: 500;
    transition: all var(--sm-almanac-transition-fast);
}

.sm-almanac-mvp__view-switcher button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
}

.sm-almanac-mvp__view-switcher button.is-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
    font-weight: 600;
}

.sm-almanac-mvp__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
}

.sm-almanac-mvp__view-container {
    flex: 1;
    overflow-y: auto;
    padding: var(--sm-almanac-space-md);
}

/* === List View === */

.sm-almanac-list {
    display: flex;
    flex-direction: column;
    gap: var(--sm-almanac-space-md);
}

.sm-almanac-list__day-header {
    position: sticky;
    top: 0;
    z-index: 10;
    font-size: var(--sm-almanac-font-h2);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-normal);
    padding: var(--sm-almanac-space-md) var(--sm-almanac-space-lg);
    background: var(--background-secondary);
    border-bottom: 2px solid var(--background-modifier-border);
    border-radius: 6px 6px 0 0;
}

.sm-almanac-list__events {
    display: flex;
    flex-direction: column;
    gap: var(--sm-almanac-space-sm);
}

.sm-almanac-list__event {
    display: flex;
    align-items: flex-start;
    padding: var(--sm-almanac-space-md) var(--sm-almanac-space-lg);
    background: var(--background-primary);
    border-left: 4px solid var(--text-muted);
    border-radius: 6px;
    transition: all var(--sm-almanac-transition-fast);
    cursor: pointer;
}

.sm-almanac-list__event:hover {
    background: var(--background-modifier-hover);
    box-shadow: var(--sm-almanac-shadow-hover);
}

.sm-almanac-list__event.is-selected {
    background: var(--background-modifier-hover);
    box-shadow: var(--sm-almanac-shadow-active);
    border-color: var(--interactive-accent);
}

/* Priority color variations */
.sm-almanac-list__event[data-priority="urgent"] {
    border-left-color: var(--sm-almanac-priority-urgent);
}

.sm-almanac-list__event[data-priority="high"] {
    border-left-color: var(--sm-almanac-priority-high);
}

.sm-almanac-list__event[data-priority="normal"] {
    border-left-color: var(--sm-almanac-priority-normal);
}

.sm-almanac-list__event[data-priority="low"] {
    border-left-color: var(--sm-almanac-priority-low);
}

.sm-almanac-list__event-icon {
    margin-right: var(--sm-almanac-space-sm);
    font-size: var(--sm-almanac-font-h3);
}

.sm-almanac-list__event-content {
    flex: 1;
}

.sm-almanac-list__event-title {
    font-size: var(--sm-almanac-font-h3);
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: var(--sm-almanac-space-xs);
}

.sm-almanac-list__event-time {
    font-size: var(--sm-almanac-font-small);
    font-family: var(--font-monospace);
    color: var(--text-muted);
    margin-right: var(--sm-almanac-space-sm);
}

.sm-almanac-list__event-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sm-almanac-space-sm);
    font-size: var(--sm-almanac-font-small);
    color: var(--text-faint);
    margin-top: var(--sm-almanac-space-xs);
}

.sm-almanac-list__event-description {
    font-size: var(--sm-almanac-font-body);
    color: var(--text-muted);
    margin-top: var(--sm-almanac-space-sm);
    line-height: 1.5;
}

/* === Month View === */

.sm-almanac-month-view {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.sm-almanac-month-view__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sm-almanac-space-md);
    border-bottom: 1px solid var(--background-modifier-border);
}

.sm-almanac-month-view__title {
    font-size: var(--sm-almanac-font-h1);
    font-weight: 700;
    color: var(--text-normal);
}

.sm-almanac-month-view__nav {
    display: flex;
    gap: var(--sm-almanac-space-sm);
}

.sm-almanac-month-view__nav button {
    padding: var(--sm-almanac-space-sm) var(--sm-almanac-space-md);
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    border-radius: 6px;
    cursor: pointer;
    font-size: var(--sm-almanac-font-body);
    transition: all var(--sm-almanac-transition-fast);
}

.sm-almanac-month-view__nav button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
}

.sm-almanac-month-view__grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    background: var(--background-modifier-border);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    overflow: hidden;
    flex: 1;
}

.sm-almanac-month-view__weekday-header {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    background: var(--background-modifier-border);
}

.sm-almanac-month-view__weekday {
    padding: var(--sm-almanac-space-sm);
    font-size: var(--sm-almanac-font-tiny);
    font-weight: 700;
    text-transform: uppercase;
    text-align: center;
    color: var(--text-faint);
    background: var(--background-secondary);
}

.sm-almanac-month-view__day {
    min-height: 80px;
    padding: var(--sm-almanac-space-sm);
    background: var(--background-primary);
    cursor: pointer;
    transition: background var(--sm-almanac-transition-fast);
    position: relative;
    display: flex;
    flex-direction: column;
}

.sm-almanac-month-view__day:hover {
    background: var(--background-modifier-hover);
}

.sm-almanac-month-view__day.is-current {
    background: color-mix(in srgb, var(--interactive-accent) 10%, var(--background-primary));
    border: 2px solid var(--interactive-accent);
}

.sm-almanac-month-view__day.is-other-month {
    opacity: 0.4;
}

.sm-almanac-month-view__day-number {
    font-size: var(--sm-almanac-font-h3);
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: var(--sm-almanac-space-xs);
}

.sm-almanac-month-view__day.is-current .sm-almanac-month-view__day-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

.sm-almanac-month-view__day-icons {
    display: flex;
    gap: 4px;
    margin-bottom: 4px;
    flex-wrap: wrap;
}

.sm-almanac-month-view__day-icon {
    font-size: 14px;
    line-height: 1;
    opacity: 0.7;
    cursor: help;
    transition: opacity var(--sm-almanac-transition-fast);
}

.sm-almanac-month-view__day-icon:hover {
    opacity: 1;
}

.sm-almanac-month-view__day-events {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
}

.sm-almanac-month-view__event-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--sm-almanac-font-tiny);
    padding: 2px 4px;
    border-radius: 3px;
    background: var(--background-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sm-almanac-month-view__event-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
}

.sm-almanac-month-view__event-dot[data-priority="urgent"] {
    background: var(--sm-almanac-priority-urgent);
}

.sm-almanac-month-view__event-dot[data-priority="high"] {
    background: var(--sm-almanac-priority-high);
}

.sm-almanac-month-view__event-dot[data-priority="normal"] {
    background: var(--sm-almanac-priority-normal);
}

.sm-almanac-month-view__event-dot[data-priority="low"] {
    background: var(--sm-almanac-priority-low);
}

.sm-almanac-month-view__event-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sm-almanac-month-view__day-overflow {
    font-size: var(--sm-almanac-font-tiny);
    color: var(--text-muted);
    font-weight: 600;
    margin-top: 2px;
    cursor: pointer;
}

.sm-almanac-month-view__day-overflow:hover {
    color: var(--interactive-accent);
}

.sm-almanac-month-view__empty {
    padding: var(--size-4-8);
    text-align: center;
    color: var(--text-muted);
    font-style: italic;
}

.sm-almanac-month-view__error {
    padding: var(--size-4-8);
    text-align: center;
    color: var(--text-error);
    font-weight: 600;
}

/* === Week View === */

.sm-almanac-week-view {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.sm-almanac-week-view__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sm-almanac-space-md);
    border-bottom: 1px solid var(--background-modifier-border);
}

.sm-almanac-week-view__week-title {
    font-size: var(--font-ui-large);
    font-weight: 600;
    color: var(--text-normal);
    margin: 0;
}

.sm-almanac-week-view__empty {
    padding: var(--size-4-8);
    text-align: center;
    color: var(--text-muted);
    font-style: italic;
}

.sm-almanac-week-view__title {
    font-size: var(--sm-almanac-font-h1);
    font-weight: 700;
}

.sm-almanac-week-view__grid {
    display: grid;
    grid-template-columns: 60px repeat(7, 1fr);
    flex: 1;
    overflow-y: auto;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
}

.sm-almanac-week-view__time-column {
    position: sticky;
    left: 0;
    z-index: 2;
    background: var(--background-secondary);
    border-right: 1px solid var(--background-modifier-border);
}

.sm-almanac-week-view__time-slot {
    height: 60px;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: var(--sm-almanac-space-xs);
    font-size: var(--sm-almanac-font-tiny);
    font-family: var(--font-monospace);
    color: var(--text-faint);
    border-bottom: 1px solid var(--background-modifier-border);
}

.sm-almanac-week-view__day-column {
    display: grid;
    grid-template-rows: 60px;
    grid-auto-rows: 60px;
    position: relative;
}

.sm-almanac-week-view__day-header {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--background-secondary);
    border-bottom: 2px solid var(--background-modifier-border);
    padding: var(--sm-almanac-space-sm);
    text-align: center;
}

.sm-almanac-week-view__day-name {
    font-size: var(--sm-almanac-font-h3);
    font-weight: 600;
    color: var(--text-normal);
}

.sm-almanac-week-view__day-date {
    font-size: var(--sm-almanac-font-small);
    color: var(--text-muted);
}

.sm-almanac-week-view__hour-cell {
    border-bottom: 1px solid var(--background-modifier-border);
    border-right: 1px solid var(--background-modifier-border);
    position: relative;
}

.sm-almanac-week-view__hour-cell:hover {
    background: var(--background-modifier-hover);
}

.sm-almanac-week-view__event {
    position: absolute;
    left: 2px;
    right: 2px;
    padding: 4px 8px;
    border-radius: 4px;
    border-left: 4px solid var(--text-muted);
    background: color-mix(in srgb, var(--interactive-accent) 20%, var(--background-primary));
    font-size: var(--sm-almanac-font-small);
    overflow: hidden;
    cursor: pointer;
    transition: all var(--sm-almanac-transition-fast);
}

.sm-almanac-week-view__event:hover {
    box-shadow: var(--sm-almanac-shadow-hover);
    z-index: 10;
}

.sm-almanac-week-view__event[data-priority="urgent"] {
    border-left-color: var(--sm-almanac-priority-urgent);
    background: color-mix(in srgb, var(--sm-almanac-priority-urgent) 15%, var(--background-primary));
}

.sm-almanac-week-view__event[data-priority="high"] {
    border-left-color: var(--sm-almanac-priority-high);
    background: color-mix(in srgb, var(--sm-almanac-priority-high) 15%, var(--background-primary));
}

.sm-almanac-week-view__event[data-priority="normal"] {
    border-left-color: var(--sm-almanac-priority-normal);
    background: color-mix(in srgb, var(--sm-almanac-priority-normal) 15%, var(--background-primary));
}

.sm-almanac-week-view__event[data-priority="low"] {
    border-left-color: var(--sm-almanac-priority-low);
    background: color-mix(in srgb, var(--sm-almanac-priority-low) 15%, var(--background-primary));
}

.sm-almanac-week-view__event-time {
    font-size: var(--sm-almanac-font-tiny);
    font-weight: 600;
    color: var(--text-muted);
}

.sm-almanac-week-view__event-title {
    font-weight: 600;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* === Upcoming Events List View === */

.sm-almanac-upcoming-events {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-3);
}

.sm-almanac-upcoming-events__header {
    padding: var(--size-4-3);
    background: var(--background-primary);
    border-radius: var(--radius-m);
    border-bottom: 2px solid var(--interactive-accent);
}

.sm-almanac-upcoming-events__header h3 {
    margin: 0;
    font-size: var(--font-ui-large);
    color: var(--text-normal);
}

.sm-almanac-upcoming-events__list {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-2);
}

.sm-almanac-upcoming-events__day-header {
    font-size: var(--font-ui-medium);
    font-weight: 600;
    color: var(--text-normal);
    padding: var(--size-4-2) var(--size-4-3);
    margin-top: var(--size-4-3);
    background: var(--background-secondary);
    border-radius: var(--radius-s);
    border-left: 3px solid var(--interactive-accent);
}

.sm-almanac-upcoming-events__item {
    display: flex;
    align-items: flex-start;
    gap: var(--size-4-3);
    padding: var(--size-4-3);
    background: var(--background-primary);
    border-radius: var(--radius-m);
    border-left: 3px solid var(--interactive-accent);
    transition: all 0.2s;
}

.sm-almanac-upcoming-events__item.is-clickable {
    cursor: pointer;
}

.sm-almanac-upcoming-events__item.is-clickable:hover {
    background: var(--background-modifier-hover);
    border-left-color: var(--interactive-accent-hover);
    transform: translateX(2px);
}

.sm-almanac-upcoming-events__item.is-phenomenon {
    border-left-color: var(--text-accent);
}

.sm-almanac-upcoming-events__item.is-empty {
    padding: var(--size-4-8);
    text-align: center;
    color: var(--text-muted);
    font-style: italic;
    border-left: none;
}

.sm-almanac-upcoming-events__time {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-1);
    flex-shrink: 0;
    min-width: 120px;
}

.sm-almanac-upcoming-events__relative-time {
    font-size: var(--font-ui-small);
    font-weight: 600;
    color: var(--text-muted);
}

.sm-almanac-upcoming-events__absolute-time {
    font-size: var(--font-ui-small);
    font-family: var(--font-monospace);
    color: var(--text-faint);
}

.sm-almanac-upcoming-events__title {
    font-size: var(--font-ui-medium);
    font-weight: 600;
    color: var(--text-normal);
}

.sm-almanac-upcoming-events__type {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    font-style: italic;
}

.sm-almanac-upcoming-events__empty {
    padding: var(--size-4-8);
    text-align: center;
    color: var(--text-muted);
    font-style: italic;
}

/* === Timeline View === */

.sm-almanac-timeline-view {
    display: flex;
    flex-direction: column;
    gap: var(--sm-almanac-space-md);
}

.sm-almanac-timeline-view__header {
    padding: var(--size-4-3);
    background: var(--background-primary);
    border-radius: var(--radius-m);
}

.sm-almanac-timeline-view__header h3 {
    margin: 0;
    font-size: var(--font-ui-large);
    color: var(--text-normal);
}

.sm-almanac-timeline-view__timeline {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-4);
}

.sm-almanac-timeline-view__empty {
    padding: var(--size-4-8);
    text-align: center;
    color: var(--text-muted);
    font-style: italic;
}

.sm-almanac-timeline-view__title {
    font-size: var(--font-ui-large);
    font-weight: 600;
    color: var(--text-normal);
    margin: 0 0 var(--size-4-3) 0;
}

.sm-almanac-timeline-view__day-section {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-2);
}

.sm-almanac-timeline-view__day-section.is-today .sm-almanac-timeline-view__day-header {
    background: var(--interactive-accent-hover);
    border-left-color: var(--interactive-accent);
    color: var(--interactive-accent);
}

.sm-almanac-timeline-view__day-header {
    padding: var(--size-4-2) var(--size-4-3);
    background: var(--background-secondary);
    border-radius: var(--radius-m);
    border-left: 3px solid var(--text-muted);
    font-weight: 600;
    color: var(--text-normal);
}

.sm-almanac-timeline-view__entry {
    display: flex;
    gap: var(--size-4-3);
    padding: var(--size-4-3);
    background: var(--background-primary);
    border-radius: var(--radius-m);
    cursor: pointer;
    transition: all 0.2s;
}

.sm-almanac-timeline-view__entry:hover {
    background: var(--background-modifier-hover);
    transform: translateX(4px);
}

.sm-almanac-timeline-view__entry.is-event {
    border-left: 3px solid var(--interactive-accent);
}

.sm-almanac-timeline-view__entry.is-phenomenon {
    border-left: 3px solid var(--text-accent);
}

.sm-almanac-timeline-view__entry-time {
    flex-shrink: 0;
    width: 60px;
    padding: var(--size-4-1) var(--size-4-2);
    background: var(--background-secondary);
    border-radius: var(--radius-s);
    text-align: center;
    font-size: var(--font-ui-small);
    font-weight: 600;
    color: var(--text-muted);
    font-family: var(--font-monospace);
}

.sm-almanac-timeline-view__entry-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--size-4-1);
}

.sm-almanac-timeline-view__entry-title {
    font-size: var(--font-ui-medium);
    font-weight: 600;
    color: var(--text-normal);
    margin: 0;
}

.sm-almanac-timeline-view__entry-description {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    margin: 0;
}

.sm-almanac-timeline-view__entry-type {
    font-size: var(--font-ui-small);
    color: var(--text-faint);
    font-style: italic;
}

/* === Sidebar Panels === */

.sm-astronomical-panel,
.sm-event-inbox-panel {
    display: flex;
    flex-direction: column;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    overflow: hidden;
}

.sm-astronomical-panel__header,
.sm-event-inbox-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sm-almanac-space-md);
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    cursor: pointer;
    user-select: none;
}

.sm-astronomical-panel__header:hover,
.sm-event-inbox-panel__header:hover {
    background: var(--background-modifier-hover);
}

.sm-astronomical-panel__title,
.sm-event-inbox-panel__title {
    font-size: var(--sm-almanac-font-h3);
    font-weight: 600;
    color: var(--text-normal);
}

.sm-astronomical-panel__toggle,
.sm-event-inbox-panel__toggle {
    font-size: var(--sm-almanac-font-h3);
    color: var(--text-muted);
    transition: transform var(--sm-almanac-transition-fast);
}

.sm-astronomical-panel__toggle.is-collapsed,
.sm-event-inbox-panel__toggle.is-collapsed {
    transform: rotate(-90deg);
}

.sm-astronomical-panel__body,
.sm-event-inbox-panel__body {
    padding: var(--sm-almanac-space-md);
}

.sm-event-inbox-panel__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--sm-almanac-priority-urgent);
    color: var(--text-on-accent);
    font-size: var(--sm-almanac-font-tiny);
    font-weight: 700;
}

.sm-event-inbox-panel__filters {
    display: flex;
    flex-direction: column;
    gap: var(--sm-almanac-space-sm);
    margin-bottom: var(--sm-almanac-space-md);
}

.sm-event-inbox-panel__filter-group {
    display: flex;
    gap: var(--sm-almanac-space-xs);
}

.sm-event-inbox-panel__filter-btn {
    flex: 1;
    padding: var(--sm-almanac-space-xs) var(--sm-almanac-space-sm);
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--sm-almanac-font-small);
    transition: all var(--sm-almanac-transition-fast);
}

.sm-event-inbox-panel__filter-btn:hover {
    background: var(--background-modifier-hover);
}

.sm-event-inbox-panel__filter-btn.is-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
}

.sm-event-inbox-panel__events {
    display: flex;
    flex-direction: column;
    gap: var(--sm-almanac-space-sm);
    max-height: 400px;
    overflow-y: auto;
}

.sm-event-inbox-panel__event {
    display: flex;
    align-items: flex-start;
    gap: var(--sm-almanac-space-sm);
    padding: var(--sm-almanac-space-sm);
    background: var(--background-secondary);
    border-radius: 4px;
    cursor: pointer;
    transition: all var(--sm-almanac-transition-fast);
}

.sm-event-inbox-panel__event:hover {
    background: var(--background-modifier-hover);
}

.sm-event-inbox-panel__event.is-unread {
    font-weight: 600;
    border-left: 3px solid var(--interactive-accent);
}

.sm-event-inbox-panel__event-priority {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 4px;
}

.sm-event-inbox-panel__event-priority[data-priority="urgent"] {
    background: var(--sm-almanac-priority-urgent);
}

.sm-event-inbox-panel__event-priority[data-priority="high"] {
    background: var(--sm-almanac-priority-high);
}

.sm-event-inbox-panel__event-priority[data-priority="normal"] {
    background: var(--sm-almanac-priority-normal);
}

.sm-event-inbox-panel__event-priority[data-priority="low"] {
    background: var(--sm-almanac-priority-low);
}

.sm-event-inbox-panel__event-content {
    flex: 1;
    min-width: 0;
}

.sm-event-inbox-panel__event-title {
    font-size: var(--sm-almanac-font-body);
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sm-event-inbox-panel__event-time {
    font-size: var(--sm-almanac-font-small);
    color: var(--text-muted);
}

/* === Responsive === */

@media (max-width: 768px) {
    .sm-almanac-mvp__layout {
        flex-direction: column;
    }

    .sm-almanac-mvp__sidebar {
        width: 100%;
        max-width: none;
        border-right: none;
        border-bottom: 1px solid var(--background-modifier-border);
    }

    .sm-almanac-month-view__grid {
        grid-template-columns: repeat(7, minmax(40px, 1fr));
    }

    .sm-almanac-month-view__day {
        min-height: 60px;
        padding: var(--sm-almanac-space-xs);
    }

    .sm-almanac-week-view__grid {
        grid-template-columns: 50px repeat(7, minmax(80px, 1fr));
    }
}

/* ================================
   SIDEBAR RESIZE HANDLE (PHASE 2)
   ================================ */

.sm-almanac-sidebar__resize-handle {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    background: transparent;
    transition: background-color var(--sm-almanac-transition-fast);
    z-index: 10;
}

.sm-almanac-sidebar__resize-handle:hover {
    background-color: var(--interactive-accent);
    opacity: 0.3;
}

.sm-almanac-sidebar__resize-handle.is-dragging {
    background-color: var(--interactive-accent);
    opacity: 0.5;
}

/* Prevent text selection during resize */
body.sm-almanac-sidebar-resizing {
    user-select: none;
    cursor: col-resize !important;
}

/* Make sidebar relatively positioned for absolute handle */
.sm-almanac-mvp__sidebar {
    position: relative;
}

/* ================================
   PANEL COLLAPSE (PHASE 2)
   ================================ */

.sm-almanac-panel__collapse-btn,
.sm-event-inbox-panel__collapse-btn,
.sm-astronomical-panel__collapse-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: var(--sm-almanac-space-xs);
    font-size: var(--sm-almanac-font-small);
    color: var(--text-muted);
    transition: color var(--sm-almanac-transition-fast);
    margin-right: var(--sm-almanac-space-xs);
}

.sm-almanac-panel__collapse-btn:hover,
.sm-event-inbox-panel__collapse-btn:hover,
.sm-astronomical-panel__collapse-btn:hover {
    color: var(--text-normal);
}

/* Panel headers should be flex to accommodate collapse button */
.sm-astronomical-panel__header,
.sm-event-inbox-panel__header {
    display: flex;
    align-items: center;
    gap: var(--sm-almanac-space-xs);
}

/* ================================
   QUICK-ADD BAR (PHASE 2)
   ================================ */

.sm-quick-add-bar {
    margin-bottom: var(--sm-almanac-space-md);
    padding: var(--sm-almanac-space-sm);
    background: var(--background-secondary);
    border-radius: 6px;
}

.sm-quick-add-bar__header {
    display: flex;
    align-items: center;
    gap: var(--sm-almanac-space-xs);
    cursor: pointer;
    padding: var(--sm-almanac-space-xs);
}

.sm-quick-add-bar__header:hover {
    background: var(--background-modifier-hover);
    border-radius: 4px;
}

.sm-quick-add-bar__collapse-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: var(--sm-almanac-space-xs);
    font-size: var(--sm-almanac-font-small);
    color: var(--text-muted);
    transition: color var(--sm-almanac-transition-fast);
}

.sm-quick-add-bar__collapse-btn:hover {
    color: var(--text-normal);
}

.sm-quick-add-bar__title {
    margin: 0;
    font-size: var(--sm-almanac-font-h3);
    font-weight: 600;
    color: var(--text-normal);
}

.sm-quick-add-bar__form {
    display: flex;
    flex-direction: column;
    gap: var(--sm-almanac-space-sm);
    margin-top: var(--sm-almanac-space-sm);
}

.sm-quick-add-bar__row {
    display: flex;
    align-items: center;
    gap: var(--sm-almanac-space-sm);
    flex-wrap: wrap;
}

.sm-quick-add-bar__label {
    font-size: var(--sm-almanac-font-small);
    color: var(--text-muted);
    min-width: 60px;
}

.sm-quick-add-bar__input {
    flex: 1;
    min-width: 150px;
    padding: var(--sm-almanac-space-xs) var(--sm-almanac-space-sm);
    font-size: var(--sm-almanac-font-body);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-normal);
}

.sm-quick-add-bar__input:focus {
    outline: none;
    border-color: var(--interactive-accent);
}

.sm-quick-add-bar__input--small {
    flex: 0 1 120px;
    min-width: 80px;
}

.sm-quick-add-bar__select {
    padding: var(--sm-almanac-space-xs) var(--sm-almanac-space-sm);
    font-size: var(--sm-almanac-font-body);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-normal);
    cursor: pointer;
}

.sm-quick-add-bar__select:focus {
    outline: none;
    border-color: var(--interactive-accent);
}

.sm-quick-add-bar__select--small {
    flex: 0 1 80px;
    min-width: 60px;
}

.sm-quick-add-bar__time-separator {
    font-size: var(--sm-almanac-font-h3);
    font-weight: 600;
    color: var(--text-muted);
}

.sm-quick-add-bar__actions {
    display: flex;
    gap: var(--sm-almanac-space-sm);
    justify-content: flex-end;
    margin-top: var(--sm-almanac-space-sm);
}

.sm-quick-add-bar__btn {
    padding: var(--sm-almanac-space-xs) var(--sm-almanac-space-md);
    font-size: var(--sm-almanac-font-body);
    border-radius: 4px;
    cursor: pointer;
    border: none;
    transition: all var(--sm-almanac-transition-fast);
}

.sm-quick-add-bar__btn--primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

.sm-quick-add-bar__btn--primary:hover {
    background: var(--interactive-accent-hover);
}

.sm-quick-add-bar__btn--secondary {
    background: var(--background-modifier-border);
    color: var(--text-normal);
}

.sm-quick-add-bar__btn--secondary:hover {
    background: var(--background-modifier-border-hover);
}

/* ========================================
   PHASE 3: TOOLBAR & NAVIGATION
   ======================================== */

/* ALMANAC TOOLBAR */
.sm-almanac-toolbar {
    display: flex;
    flex-direction: column;
    gap: var(--sm-almanac-space-sm);
    padding: var(--sm-almanac-space-md);
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    position: sticky;
    top: 0;
    z-index: 10;
}

.sm-almanac-toolbar__row-1,
.sm-almanac-toolbar__row-2 {
    display: flex;
    align-items: center;
    gap: var(--sm-almanac-space-md);
}

.sm-almanac-toolbar__row-1 {
    justify-content: space-between;
}

.sm-almanac-toolbar__nav-group,
.sm-almanac-toolbar__action-group {
    display: flex;
    gap: var(--sm-almanac-space-sm);
}

.sm-almanac-toolbar__time-display {
    font-size: var(--sm-almanac-font-h2);
    font-weight: bold;
    cursor: pointer;
    padding: var(--sm-almanac-space-xs) var(--sm-almanac-space-sm);
    border-radius: 4px;
    transition: var(--sm-almanac-transition-fast);
}

.sm-almanac-toolbar__time-display:hover {
    background: var(--background-modifier-hover);
    text-decoration: underline;
}

.sm-almanac-toolbar__btn {
    padding: var(--sm-almanac-space-xs) var(--sm-almanac-space-sm);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--sm-almanac-font-body);
    transition: var(--sm-almanac-transition-fast);
}

.sm-almanac-toolbar__btn:hover {
    background: var(--background-modifier-hover);
}

.sm-almanac-toolbar__btn--primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
}

.sm-almanac-toolbar__btn--primary:hover {
    background: var(--interactive-accent-hover);
}

.sm-almanac-toolbar__btn--today {
    font-weight: bold;
}

/* CALENDAR SELECTOR */
.sm-almanac-toolbar__calendar-selector {
    position: relative;
    display: inline-block;
}

.sm-calendar-selector__button {
    display: flex;
    align-items: center;
    gap: var(--sm-almanac-space-xs);
    padding: var(--sm-almanac-space-xs) var(--sm-almanac-space-sm);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--sm-almanac-font-body);
    transition: var(--sm-almanac-transition-fast);
}

.sm-calendar-selector__button:hover {
    background: var(--background-modifier-hover);
}

.sm-calendar-selector__button.is-open {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
}

.sm-calendar-selector__icon {
    font-size: var(--sm-almanac-font-body);
}

.sm-calendar-selector__text {
    font-weight: 500;
    color: var(--text-normal);
}

.sm-calendar-selector__arrow {
    font-size: var(--sm-almanac-font-tiny);
    color: var(--text-faint);
}

/* Calendar Dropdown Menu */
.sm-calendar-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 280px;
    max-height: 400px;
    overflow-y: auto;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
}

.sm-calendar-dropdown__item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto auto;
    gap: var(--sm-almanac-space-xs) var(--sm-almanac-space-sm);
    padding: var(--sm-almanac-space-sm) var(--sm-almanac-space-md);
    cursor: pointer;
    border-bottom: 1px solid var(--background-modifier-border);
    transition: var(--sm-almanac-transition-fast);
}

.sm-calendar-dropdown__item:hover {
    background: var(--background-modifier-hover);
}

.sm-calendar-dropdown__item.is-active {
    background: var(--background-modifier-active-hover);
}

.sm-calendar-dropdown__icon {
    grid-row: 1 / 3;
    font-size: var(--sm-almanac-font-h3);
    align-self: center;
}

.sm-calendar-dropdown__name {
    grid-column: 2;
    grid-row: 1;
    font-weight: 600;
    color: var(--text-normal);
    font-size: var(--sm-almanac-font-body);
}

.sm-calendar-dropdown__checkmark {
    grid-column: 3;
    grid-row: 1 / 3;
    color: var(--interactive-accent);
    font-size: var(--sm-almanac-font-h3);
    align-self: center;
}

.sm-calendar-dropdown__meta {
    grid-column: 2;
    grid-row: 2;
    font-size: var(--sm-almanac-font-small);
    color: var(--text-faint);
}

.sm-calendar-dropdown__separator {
    height: 1px;
    background: var(--background-modifier-border);
    margin: var(--sm-almanac-space-xs) 0;
}

.sm-calendar-dropdown__create {
    padding: var(--sm-almanac-space-sm) var(--sm-almanac-space-md);
    cursor: pointer;
    color: var(--interactive-accent);
    font-weight: 600;
    font-size: var(--sm-almanac-font-body);
    transition: var(--sm-almanac-transition-fast);
}

.sm-calendar-dropdown__create:hover {
    background: var(--background-modifier-hover);
}

.sm-calendar-dropdown__empty {
    padding: var(--sm-almanac-space-md);
    text-align: center;
    color: var(--text-faint);
    font-size: var(--sm-almanac-font-body);
}

/* VIEW SWITCHER */
.sm-almanac-view-switcher {
    display: flex;
    gap: var(--sm-almanac-space-xs);
}

.sm-almanac-view-switcher__btn {
    padding: var(--sm-almanac-space-xs) var(--sm-almanac-space-md);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--sm-almanac-font-body);
    display: flex;
    align-items: center;
    gap: var(--sm-almanac-space-xs);
    transition: var(--sm-almanac-transition-fast);
}

.sm-almanac-view-switcher__btn:hover {
    background: var(--background-modifier-hover);
}

.sm-almanac-view-switcher__btn.is-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
}

.sm-almanac-view-switcher__btn-number {
    font-weight: bold;
    font-size: var(--sm-almanac-font-small);
}

.sm-almanac-view-switcher__btn-icon {
    font-size: var(--sm-almanac-font-h3);
}

.sm-almanac-view-switcher__btn-label {
    font-size: var(--sm-almanac-font-body);
}

/* JUMP-TO-DATE MODAL */
.sm-jump-to-date-modal {
    padding: var(--sm-almanac-space-lg);
}

.sm-jump-to-date-modal h2 {
    margin-bottom: var(--sm-almanac-space-md);
    font-size: var(--sm-almanac-font-h1);
    font-weight: bold;
}

.sm-jump-to-date-modal__form {
    display: flex;
    flex-direction: column;
    gap: var(--sm-almanac-space-md);
}

.sm-jump-to-date-modal__row {
    display: flex;
    align-items: center;
    gap: var(--sm-almanac-space-sm);
}

.sm-jump-to-date-modal__label {
    min-width: 80px;
    font-weight: bold;
    font-size: var(--sm-almanac-font-body);
}

.sm-jump-to-date-modal__select {
    flex: 1;
    padding: var(--sm-almanac-space-xs) var(--sm-almanac-space-sm);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    font-size: var(--sm-almanac-font-body);
}

.sm-jump-to-date-modal__quick-jump {
    display: flex;
    flex-direction: column;
    gap: var(--sm-almanac-space-sm);
    padding-top: var(--sm-almanac-space-md);
    border-top: 1px solid var(--background-modifier-border);
}

.sm-jump-to-date-modal__quick-jump h3 {
    font-size: var(--sm-almanac-font-h3);
    font-weight: bold;
    margin-bottom: var(--sm-almanac-space-xs);
}

.sm-jump-to-date-modal__quick-jump-buttons {
    display: flex;
    gap: var(--sm-almanac-space-sm);
    justify-content: flex-start;
}

.sm-jump-to-date-modal__actions {
    display: flex;
    gap: var(--sm-almanac-space-sm);
    justify-content: flex-end;
    padding-top: var(--sm-almanac-space-md);
    border-top: 1px solid var(--background-modifier-border);
}

.sm-jump-to-date-modal__btn {
    padding: var(--sm-almanac-space-xs) var(--sm-almanac-space-md);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--sm-almanac-font-body);
    transition: var(--sm-almanac-transition-fast);
}

.sm-jump-to-date-modal__btn:hover {
    background: var(--background-modifier-hover);
}

.sm-jump-to-date-modal__btn--primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
}

.sm-jump-to-date-modal__btn--primary:hover {
    background: var(--interactive-accent-hover);
}

/* TIME CONTROLS PANEL */
.sm-time-controls-panel {
    margin-bottom: var(--sm-almanac-space-md);
    padding: var(--sm-almanac-space-sm);
    background: var(--background-secondary);
    border-radius: 6px;
}

.sm-time-controls-panel__header {
    display: flex;
    align-items: center;
    gap: var(--sm-almanac-space-xs);
    cursor: pointer;
    padding: var(--sm-almanac-space-xs);
}

.sm-time-controls-panel__header:hover {
    background: var(--background-modifier-hover);
    border-radius: 4px;
}

.sm-time-controls-panel__collapse-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: var(--sm-almanac-space-xs);
    font-size: var(--sm-almanac-font-small);
    color: var(--text-muted);
    transition: color var(--sm-almanac-transition-fast);
}

.sm-time-controls-panel__collapse-btn:hover {
    color: var(--text-normal);
}

.sm-time-controls-panel__title {
    font-size: var(--sm-almanac-font-h3);
    font-weight: bold;
    flex: 1;
}

.sm-time-controls-panel__body {
    display: flex;
    flex-direction: column;
    gap: var(--sm-almanac-space-sm);
    margin-top: var(--sm-almanac-space-sm);
}

.sm-time-controls-panel__row {
    display: flex;
    align-items: center;
    gap: var(--sm-almanac-space-sm);
}

.sm-time-controls-panel__label {
    min-width: 60px;
    font-size: var(--sm-almanac-font-body);
    font-weight: 500;
}

.sm-time-controls-panel__btn {
    padding: var(--sm-almanac-space-xs) var(--sm-almanac-space-sm);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--sm-almanac-font-body);
    font-weight: bold;
    transition: var(--sm-almanac-transition-fast);
    min-width: 32px;
}

.sm-time-controls-panel__btn:hover {
    background: var(--background-modifier-hover);
}

/* PHASE 4 WEEK 2: INLINE EDITING FEATURES */

/* INLINE EDITOR */
.sm-inline-editor {
    width: 100%;
    padding: 4px 8px;
    border: 2px solid var(--interactive-accent);
    border-radius: 4px;
    font-size: inherit;
    font-weight: inherit;
    font-family: inherit;
    background: var(--background-primary);
    color: var(--text-normal);
    transition: var(--sm-almanac-transition-fast);
}

.sm-inline-editor:focus {
    outline: none;
    border-color: var(--interactive-accent-hover);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.sm-inline-editor--loading {
    opacity: 0.6;
    pointer-events: none;
    cursor: wait;
}

/* EVENT CONTEXT MENU */
.sm-event-context-menu {
    position: fixed;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    padding: 4px;
    min-width: 200px;
    z-index: 1000;
}

.sm-event-context-menu__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.15s ease;
    font-size: var(--sm-almanac-font-body);
    gap: var(--sm-almanac-space-sm);
}

.sm-event-context-menu__item:hover {
    background: var(--background-modifier-hover);
}

.sm-event-context-menu__item--danger {
    color: var(--text-error);
}

.sm-event-context-menu__item--danger:hover {
    background: var(--background-modifier-error);
}

.sm-event-context-menu__shortcut {
    font-size: var(--sm-almanac-font-small);
    color: var(--text-muted);
    opacity: 0.7;
}

.sm-event-context-menu__arrow {
    font-size: var(--sm-almanac-font-small);
    color: var(--text-muted);
}

.sm-event-context-menu__divider {
    height: 1px;
    background: var(--background-modifier-border);
    margin: 4px 0;
}

.sm-event-context-menu__priority-indicator {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 8px;
}

/* EVENT CONTEXT MENU SUBMENU */
.sm-event-context-menu__submenu {
    position: fixed;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    padding: 4px;
    min-width: 160px;
    z-index: 1001;
}

/* EVENT PREVIEW PANEL */
.sm-event-preview-panel {
    padding: var(--sm-almanac-space-lg);
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    margin-left: var(--sm-almanac-space-lg);
    flex-shrink: 0;
    width: 300px;
    max-height: 500px;
    overflow-y: auto;
}

.sm-event-preview-panel__header {
    font-size: var(--sm-almanac-font-h3);
    font-weight: bold;
    margin-bottom: var(--sm-almanac-space-md);
    color: var(--text-muted);
}

.sm-event-preview-panel__card {
    background: var(--background-primary);
    border-left: 4px solid var(--priority-normal);
    padding: var(--sm-almanac-space-md);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.sm-event-preview-panel__priority {
    display: flex;
    align-items: center;
    gap: var(--sm-almanac-space-xs);
    margin-bottom: var(--sm-almanac-space-sm);
}

.sm-event-preview-panel__priority-indicator {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.sm-event-preview-panel__priority-text {
    font-size: var(--sm-almanac-font-small);
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.sm-event-preview-panel__title {
    font-size: var(--sm-almanac-font-h3);
    font-weight: bold;
    margin-bottom: var(--sm-almanac-space-xs);
    color: var(--text-normal);
}

.sm-event-preview-panel__metadata {
    font-size: var(--sm-almanac-font-small);
    color: var(--text-muted);
    margin-bottom: var(--sm-almanac-space-md);
    display: flex;
    flex-wrap: wrap;
    gap: var(--sm-almanac-space-xs);
}

.sm-event-preview-panel__tag {
    color: var(--text-accent);
}

.sm-event-preview-panel__date,
.sm-event-preview-panel__recurrence {
    font-size: var(--sm-almanac-font-small);
    margin-bottom: var(--sm-almanac-space-xs);
    display: flex;
    align-items: center;
    gap: var(--sm-almanac-space-xs);
}

.sm-event-preview-panel__description {
    font-size: var(--sm-almanac-font-body);
    color: var(--text-normal);
    margin-top: var(--sm-almanac-space-md);
    line-height: 1.5;
    white-space: pre-wrap;
}

.sm-event-preview-panel__empty {
    font-size: var(--sm-almanac-font-body);
    color: var(--text-muted);
    font-style: italic;
    text-align: center;
    padding: var(--sm-almanac-space-xl);
}
`;
