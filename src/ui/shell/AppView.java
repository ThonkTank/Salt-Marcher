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
 *   <li><b>Details</b> — detail inspector: stat blocks, tile properties ({@link #getDetailsContent()})</li>
 *   <li><b>State</b> — game state: encounter roster/tracker, travel info ({@link #getStateContent()})</li>
 * </ul>
 * SESSION views leave Details/State as {@code null} to use the shell-owned InspectorPane and ScenePane,
 * which persist across SESSION view switches. EDITOR views override Details/State to provide
 * view-specific content.
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
     * Details panel (top-right): detail inspector content.
     * Returns null (default) to use the shell-owned InspectorPane (stat blocks, arbitrary content).
     * EDITOR views override this to provide view-specific detail content (e.g. tile properties).
     */
    default Node getDetailsContent() { return null; }

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
