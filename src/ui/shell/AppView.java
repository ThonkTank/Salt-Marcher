package ui.shell;

import javafx.scene.Node;

import java.util.List;

/**
 * A top-level view managed by {@link AppShell}.
 * <p>
 * The shell uses a four-panel "cockpit" layout. Views project content into the panels:
 * <pre>
 * +---toolbar------------------------------+
 * | side | Controls      | Details         |
 * | bar  | (top-left)    | (top-right)     |
 * |      |---------------+-----------------|
 * |      | Main          | State           |
 * |      | (bottom-left) | (bottom-right)  |
 * +------+---------------+-----------------+
 * </pre>
 * <ul>
 *   <li><b>Controls</b> — filters, sliders, tool palettes ({@link #getControlsContent()})</li>
 *   <li><b>Main</b> — primary workspace: monster table, hex map, canvas ({@link #getMainContent()})</li>
 *   <li><b>Details</b> — shared shell-owned, mostly static inspector with navigation/history</li>
 *   <li><b>State</b> — game state, tool-specific settings, and interactive editor UI ({@link #getStateContent()})</li>
 * </ul>
 * The Details pane is shell-owned and shared across all views. View-specific forms, editor controls,
 * and any interactive workflow UI belong in the State pane instead of replacing the shared inspector.
 * Views leave State as {@code null} to use the shell-owned ScenePane.
 */
public interface AppView {

    /** Main panel (bottom-left): primary workspace content. */
    Node getMainContent();

    /** Title shown in the toolbar when this view is active. */
    String getTitle();

    /** Short label for the sidebar nav button — typically a single emoji or symbol (e.g. "\u2694" ⚔ or "\uD83D\uDDFA" 🗺). */
    default String getIconText() { return ""; }

    /** Extra nodes placed right-aligned in the toolbar. */
    default List<Node> getToolbarItems() { return List.of(); }

    /** Controls panel (top-left): filters, sliders, tool palettes. Null = panel hidden. */
    default Node getControlsContent() { return null; }

    /**
     * State panel (bottom-right): game state / activity content.
     * Returns null (default) to use the shell-owned ScenePane (tabbed game activities).
     * EDITOR views override this to provide view-specific state content.
     */
    default Node getStateContent() { return null; }

    /** Called each time this view becomes the active view. Safe to call multiple times. */
    default void onShow() {}

    /** Called when navigating away from this view. */
    default void onHide() {}
}
