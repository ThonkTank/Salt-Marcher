package ui.shell;

import javafx.scene.Node;

/**
 * Handle for a registered game-activity tab in the ScenePane.
 * Returned by {@link SceneRegistry#registerScene}; allows the registering view
 * to update the tab's content and activate it without knowing ScenePane internals.
 */
public interface SceneHandle {

    /** Replace the content shown inside this tab (e.g. Roster → Tracker on combat start). */
    void setContent(Node content);

    /** Make this tab the active (visible) tab. */
    void activate();
}
