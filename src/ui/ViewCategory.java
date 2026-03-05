package ui;

/**
 * Groups {@link ViewId}s into sidebar sections.
 * Session views (live-play tools) appear above a separator;
 * Editor views (preparation/world-building) appear below.
 */
public enum ViewCategory {
    SESSION,
    EDITOR
}
