package ui;

import javafx.scene.Node;

import java.util.List;

/**
 * A top-level view managed by {@link AppShell}.
 * The shell calls {@link #onShow()} each time this view becomes the active content,
 * and {@link #onHide()} when the user navigates away.
 */
public interface AppView {

    /** The root node placed in the shell's content area. */
    Node getRoot();

    /** Title shown in the toolbar when this view is active. */
    String getTitle();

    /** Short label for the sidebar nav button — typically a single emoji or symbol (e.g. "\u2694" ⚔ or "\uD83D\uDDFA" 🗺). */
    default String getIconText() { return ""; }

    /** Extra nodes placed right-aligned in the toolbar. */
    default List<Node> getToolbarItems() { return List.of(); }

    /** Content for the left control panel. Returns null to leave the panel empty. */
    default Node getControlPanel() { return null; }

    /** Called each time this view becomes the active view. Safe to call multiple times. */
    default void onShow() {}

    /** Called when navigating away from this view. */
    default void onHide() {}

    /**
     * Custom right-column content. Returns null (default) to use the standard
     * InspectorPane + ScenePane layout. Editor views ({@link ui.ViewCategory#EDITOR})
     * may override to provide a properties panel or other editing-specific layout.
     * <p>
     * <strong>SESSION views must return null.</strong> Returning a non-null node from a
     * SESSION view removes ScenePane from the scene graph, silently breaking any
     * {@link SceneHandle} tab registrations made at construction time.
     */
    default Node getRightColumn() { return null; }
}
