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

    /** Single character shown in the sidebar nav button (e.g. "\u2694" for swords). */
    default String getIconText() { return ""; }

    /** Extra nodes placed right-aligned in the toolbar. */
    default List<Node> getToolbarItems() { return List.of(); }

    /** Content for the left control panel. Returns null to leave the panel empty. */
    default Node getControlPanel() { return null; }

    /** Called each time this view becomes the active view. Safe to call multiple times. */
    default void onShow() {}

    /** Called when navigating away from this view. */
    default void onHide() {}
}
