export const sessionRunnerCss = `
/* === Session Runner - 3-Column Layout === */

/* Main container */
.sm-session {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    gap: 0.75rem;
    min-height: 0;
}

/* Header */
.sm-session__header {
    display: flex;
    align-items: center;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    padding: 0.75rem;
    gap: 0.5rem;
}

.sm-session__header .sm-map-header h2 {
    margin: 0;
}

.sm-session__header .sm-map-header .sm-map-header__secondary-left {
    margin-left: auto;
    margin-right: 0;
}

/* Body - 3 columns */
.sm-session__body {
    display: flex;
    flex: 1 1 auto;
    gap: 1.25rem;
    align-items: stretch;
    width: 100%;
    min-height: 0;
}

/* Left Sidebar (Context Info: Weather, Calendar, Hex Info) */
.sm-session__left-sidebar {
    flex: 0 0 280px;
    max-width: 320px;
    min-width: 200px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    padding: 1rem;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow-y: auto;
    transition: flex-basis 200ms ease, opacity 200ms ease;
}

.sm-session__left-sidebar.is-collapsed {
    flex: 0 0 0px;
    min-width: 0;
    padding: 0;
    opacity: 0;
    overflow: hidden;
    border: none;
}

/* Canvas (Map) */
.sm-session__canvas {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    position: relative;
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    background: var(--background-primary);
    padding: 0.75rem;
    box-sizing: border-box;
}

.sm-session__canvas .sm-view-container {
    width: 100%;
    height: 100%;
}

.sm-session__canvas .sm-hex-map-svg {
    height: 100%;
    max-width: none;
}

/* Right Sidebar (Actions: Playback, Speed, Audio, Encounters) */
.sm-session__right-sidebar {
    flex: 0 0 280px;
    max-width: 320px;
    min-width: 200px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    padding: 1rem;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow-y: auto;
    transition: flex-basis 200ms ease, opacity 200ms ease;
}

.sm-session__right-sidebar.is-collapsed {
    flex: 0 0 0px;
    min-width: 0;
    padding: 0;
    opacity: 0;
    overflow: hidden;
    border: none;
}

/* Sidebar Toggle Buttons (in header) */
.sm-session__sidebar-toggle {
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: background 120ms ease, color 120ms ease;
}

.sm-session__sidebar-toggle:hover {
    background: var(--background-modifier-hover);
}

.sm-session__sidebar-toggle.is-active {
    background: var(--interactive-accent, var(--color-accent));
    color: var(--text-on-accent, #fff);
}

/* === Panel Card - Collapsible Panels === */

.sm-panel-card {
    display: flex;
    flex-direction: column;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    overflow: hidden;
}

.sm-panel-card__header {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 0.25rem 0.35rem;
    background: var(--background-primary-alt);
    cursor: pointer;
    user-select: none;
    transition: background 120ms ease;
}

.sm-panel-card__header:hover {
    background: var(--background-modifier-hover);
}

.sm-panel-card__header-left {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    flex: 1;
}

.sm-panel-card__title {
    font-weight: 600;
    font-size: 0.95rem;
    margin: 0;
}

.sm-panel-card__icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 200ms ease;
}

.sm-panel-card.is-expanded .sm-panel-card__icon {
    transform: rotate(90deg);
}

.sm-panel-card__body {
    padding: 0.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex-shrink: 0;
    transition: max-height 200ms ease, padding 200ms ease, opacity 200ms ease;
}

.sm-panel-card.is-collapsed .sm-panel-card__body {
    max-height: 0;
    padding: 0 0.25rem;
    opacity: 0;
    overflow: hidden;
}

/* Panel Card Variants */
.sm-panel-card--compact .sm-panel-card__header {
    padding: 0.2rem 0.3rem;
}

.sm-panel-card--compact .sm-panel-card__body {
    padding: 0.25rem;
}

/* Right sidebar cards use content-based height */
.sm-session__right-sidebar .sm-panel-card {
    flex: 0 0 auto;
}

/* === Session Runner Panel Styles === */

/* Weather Panel */
.sm-weather-panel {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
}

.sm-weather-panel__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
}

.sm-weather-panel__title {
    font-weight: 600;
    font-size: 1rem;
    color: var(--text-normal);
}

/* Compact header (2 lines) */
.sm-weather-panel__compact-header {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.25rem;
    background: var(--background-secondary);
    border-radius: 6px;
}

.sm-weather-panel__header-line1 {
    display: flex;
    align-items: center;
    gap: 0.15rem;
}

.sm-weather-panel__header-line2 {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    font-size: 0.85rem;
    color: var(--text-muted);
}

.sm-weather-panel__icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-accent);
}

.sm-weather-panel__icon svg {
    width: 100%;
    height: 100%;
}

.sm-weather-panel__weather-label {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-normal);
    flex: 1;
}

.sm-weather-panel__temp-value {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-accent);
}

.sm-weather-panel__speed-display,
.sm-weather-panel__next-update-display {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.sm-weather-panel__speed-label,
.sm-weather-panel__next-label {
    font-size: 0.85rem;
    color: var(--text-muted);
}

.sm-weather-panel__speed-value,
.sm-weather-panel__next-value {
    font-size: 0.85rem;
    font-weight: 600;
}

.sm-weather-panel__speed-value--good {
    color: var(--text-success);
}

.sm-weather-panel__speed-value--warning {
    color: var(--text-warning);
}

.sm-weather-panel__speed-value--bad {
    color: var(--text-error);
}

/* Details section (expandable) */
.sm-weather-panel__details-section {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
}

.sm-weather-panel__details-content {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding-left: 0.25rem;
}

.sm-weather-panel__detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.1rem 0.25rem;
    background: var(--background-secondary);
    border-radius: 4px;
}

.sm-weather-panel__detail-label {
    font-size: 0.85rem;
    color: var(--text-muted);
}

.sm-weather-panel__detail-value {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-normal);
}

/* History and Forecast sections */
.sm-weather-panel__history-section,
.sm-weather-panel__forecast-section {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
}

.sm-weather-panel__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.15rem 0.25rem;
    background: var(--background-secondary);
    border-radius: 4px;
    cursor: pointer;
    transition: background 120ms ease;
}

.sm-weather-panel__section-header:hover {
    background: var(--background-modifier-hover);
}

.sm-weather-panel__section-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-normal);
}

.sm-weather-panel__toggle {
    font-size: 0.8rem;
    color: var(--text-muted);
    transition: transform 120ms ease;
}

.sm-weather-panel__history-content,
.sm-weather-panel__forecast-content {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding-left: 0.25rem;
}

.sm-weather-panel__placeholder {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--text-muted);
    font-style: italic;
}

/* === Audio Panel - Compact Card-Based UI === */

/* Context Display (shared above both players) */
.sm-audio-context-display {
    margin-bottom: 0.1rem;
}

.sm-audio-context {
    display: flex;
    flex-wrap: wrap;
    gap: 0.1rem;
}

.sm-audio-context__tag {
    padding: 0.15rem 0.4rem;
    background: var(--background-modifier-border);
    border-radius: 10px;
    font-size: 0.7rem;
    color: var(--text-muted);
}

.sm-audio-context__tag--empty {
    color: var(--text-muted);
    font-style: italic;
}

/* Track Info (name + time in header, playlist below) */
.sm-audio-track {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    min-width: 0;
    margin-bottom: 0.1rem;
}

.sm-audio-track__header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 0.15rem;
    min-width: 0;
}

.sm-audio-track__name {
    font-weight: 600;
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-normal);
    flex: 1;
    min-width: 0;
}

.sm-audio-track__time {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
}

.sm-audio-track__playlist {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Progress Bar (seekable) */
.sm-audio-progress-container {
    margin-bottom: 0.1rem;
}

.sm-audio-progress {
    width: 100%;
    height: 6px;
    background: var(--background-modifier-border);
    border-radius: 3px;
    cursor: pointer;
    position: relative;
    margin-bottom: 0.1rem;
}

.sm-audio-progress__fill {
    height: 100%;
    background: var(--interactive-accent);
    border-radius: 3px;
    transition: width 200ms linear;
}

.sm-audio-progress:hover .sm-audio-progress__fill {
    background: var(--interactive-accent-hover);
}

/* Playback Controls (icon-only, compact) */
.sm-audio-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.05rem;
    margin-bottom: 0.1rem;
}

.sm-audio-controls__button {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: var(--interactive-normal);
    border: none;
    transition: background 120ms ease, opacity 120ms ease;
}

.sm-audio-controls__button:hover {
    background: var(--interactive-hover);
}

.sm-audio-controls__button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.sm-audio-controls__button--primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

.sm-audio-controls__button--primary:hover {
    background: var(--interactive-accent-hover);
}

/* Auto-Select Toggle in Header */
.sm-panel-card__header-toggle {
    padding: 0.2rem 0.4rem;
    font-size: 0.7rem;
    margin-left: auto;
    margin-right: 0.5rem;
}

/* Playback Status Indicator (⏵ animated) */
.sm-audio-status {
    font-size: 0.85rem;
    opacity: 0.5;
    margin-left: 0.25rem;
}

.sm-audio-status--playing {
    opacity: 1;
    animation: sm-audio-pulse 1.5s ease-in-out infinite;
}

@keyframes sm-audio-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* Expanded Section (collapsible controls) */
.sm-audio-expanded {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--background-modifier-border);
}

.sm-audio-expanded__row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.sm-audio-expanded__controls {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.3rem;
    justify-content: space-between;
}

.sm-audio-expanded__label {
    font-size: 0.8rem;
    color: var(--text-muted);
    min-width: 60px;
}

.sm-audio-expanded__dropdown {
    flex: 1;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
    font-size: 0.85rem;
}

.sm-audio-expanded__toggle {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
    background: var(--interactive-normal);
    border: none;
    color: var(--text-normal);
    transition: background 120ms ease;
}

.sm-audio-expanded__toggle:hover {
    background: var(--interactive-hover);
}

.sm-audio-expanded__toggle.is-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

.sm-audio-expanded__button {
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.85rem;
    cursor: pointer;
    background: var(--interactive-normal);
    border: none;
    color: var(--text-normal);
    transition: background 120ms ease;
}

.sm-audio-expanded__button:hover {
    background: var(--interactive-hover);
}

.sm-audio-expanded__button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.sm-audio-expanded__button--stop {
    background: var(--background-modifier-error);
    color: var(--text-normal);
}

.sm-audio-expanded__button--stop:hover {
    background: var(--background-modifier-error-hover);
}

/* Volume Popup */
.sm-audio-volume {
    position: relative;
}

.sm-audio-volume__popup {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    display: none;
    z-index: 100;
}

.sm-audio-volume__popup.is-visible {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    align-items: center;
}

.sm-audio-volume__slider {
    width: 120px;
    cursor: pointer;
}

.sm-audio-volume__label {
    font-size: 0.75rem;
    color: var(--text-muted);
}

/* Initiative Tracker */
.sm-initiative-tracker {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.sm-initiative-tracker__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
}

.sm-initiative-tracker__title {
    font-weight: 600;
    font-size: 1rem;
    color: var(--text-normal);
    margin: 0;
}

.sm-initiative-tracker__next-turn {
    padding: 0.35rem 0.75rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    transition: background 120ms ease;
}

.sm-initiative-tracker__next-turn:hover {
    background: var(--interactive-accent-hover);
}

.sm-initiative-tracker__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.sm-initiative-tracker__empty {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--text-muted);
    font-style: italic;
}

.sm-initiative-tracker__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    background: var(--background-secondary);
    border-radius: 6px;
    border: 2px solid transparent;
    transition: border-color 120ms ease, background 120ms ease;
}

.sm-initiative-tracker__item--active {
    border-color: var(--interactive-accent);
    background: var(--background-modifier-active-hover);
}

.sm-initiative-tracker__item--defeated {
    opacity: 0.5;
    text-decoration: line-through;
}

.sm-initiative-tracker__initiative {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-weight: 700;
    font-size: 0.95rem;
    flex-shrink: 0;
}

.sm-initiative-tracker__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
}

.sm-initiative-tracker__name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sm-initiative-tracker__stats {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.sm-initiative-tracker__hp-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.sm-initiative-tracker__hp {
    font-size: 0.85rem;
    color: var(--text-muted);
    cursor: pointer;
}

.sm-initiative-tracker__hp:hover {
    color: var(--text-normal);
}

.sm-initiative-tracker__hp-bar {
    width: 100%;
    height: 6px;
    background: var(--background-modifier-border);
    border-radius: 3px;
    overflow: hidden;
}

.sm-initiative-tracker__hp-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-green), var(--color-yellow), var(--color-red));
    transition: width 200ms ease;
}

.sm-initiative-tracker__ac {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: var(--background-primary);
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-normal);
}

.sm-initiative-tracker__actions {
    display: flex;
    gap: 0.35rem;
}

.sm-initiative-tracker__action-btn {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    background: var(--background-primary);
    color: var(--text-muted);
    border: 1px solid var(--background-modifier-border);
    transition: all 120ms ease;
}

.sm-initiative-tracker__action-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    border-color: var(--text-muted);
}

/* === Session Runner Travel Styles === */

.sm-session--travel {
    --tg-color-token: var(--color-purple, #9c6dfb);
    --tg-color-user-anchor: var(--color-orange, #f59e0b);
    --tg-color-auto-point: var(--color-blue, #3b82f6);
}

.sm-session--travel .tg-token__circle {
    fill: var(--tg-color-token);
    opacity: 0.95;
    stroke: var(--background-modifier-border);
    stroke-width: 3;
    transition: opacity 120ms ease;
}

.sm-session--travel .tg-route-dot {
    transition: opacity 120ms ease, r 120ms ease, stroke 120ms ease;
}

.sm-session--travel .tg-route-dot--user {
    fill: var(--tg-color-user-anchor);
    opacity: 0.95;
}

.sm-session--travel .tg-route-dot--auto {
    fill: var(--tg-color-auto-point);
    opacity: 0.7;
}

.sm-session--travel .tg-route-dot--user.is-highlighted {
    opacity: 1;
}

.sm-session--travel .tg-route-dot--auto.is-highlighted {
    opacity: 0.9;
}

.sm-session--travel .sm-hex-map-svg circle[data-token] {
    opacity: .95;
}

.sm-session--travel .sm-hex-map-svg polyline {
    pointer-events: none;
}

/* Travel Controls inside Panel Cards */
.sm-session__travel-controls {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
}

.sm-session__travel-buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.15rem;
}

.sm-session__travel-clock {
    font-weight: 600;
    margin-right: .15rem;
}

.sm-session__travel-tempo {
    display: flex;
    align-items: center;
    gap: .1rem;
    margin-left: auto;
}

.sm-session__travel-button {
    font-weight: 600;
}

.sm-session__travel-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.15rem;
}

.sm-session__travel-label {
    font-size: 0.9rem;
    color: var(--text-muted);
}

.sm-session__travel-value {
    font-size: 1rem;
    font-weight: 600;
}

.sm-session__travel-input {
    width: 100%;
    padding: 0.2rem 0.3rem;
    border-radius: 6px;
}

/* === Party Management (Session Runner) === */

.sm-party-form {
    margin-bottom: 0.25rem;
}

.sm-party-form__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.15rem;
    margin-bottom: 0.15rem;
}

.sm-party-form__field {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
}

.sm-party-form__field label {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-weight: 500;
}

.sm-party-form__field--button {
    grid-column: 1 / -1;
}

.sm-party-form__error {
    color: var(--text-error);
    font-size: 0.85rem;
    min-height: 1.2em;
    margin-top: 0.1rem;
}

.sm-button {
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: background-color 120ms ease, opacity 120ms ease;
}

.sm-button--primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

.sm-button--primary:hover {
    background: var(--interactive-accent-hover);
}

.sm-button--danger {
    background: var(--text-error);
    color: #fff;
}

.sm-button--danger:hover {
    opacity: 0.9;
}

.sm-party-list {
    margin: 0.25rem 0;
}

.sm-party-list__items {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
}

.sm-party-list__empty {
    padding: 1rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.9rem;
    background: var(--background-secondary);
    border-radius: 6px;
    border: 1px dashed var(--background-modifier-border);
}

.sm-party-list__item {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr auto;
    gap: 0.15rem;
    align-items: end;
    padding: 0.25rem;
    background: var(--background-secondary);
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
}

.sm-party-list__field {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
}

.sm-party-list__label {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-weight: 500;
}

.sm-party-list__remove {
    padding: 0.35rem 0.5rem;
    font-size: 0.85rem;
}

.sm-party-list__remove--icon {
    padding: 0.25rem 0.4rem;
    font-size: 1.2rem;
    line-height: 1;
    min-width: auto;
}

.sm-party-summary {
    margin-top: 0.15rem;
    padding: 0.25rem 0.35rem;
    background: var(--background-primary-alt);
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-normal);
    text-align: center;
}
`;
