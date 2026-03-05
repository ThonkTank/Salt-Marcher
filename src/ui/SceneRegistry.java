package ui;

import javafx.scene.Node;

/**
 * Registration interface for game-activity tabs in the ScenePane (bottom-right panel).
 * Views register their game-state content via this interface; the ScenePane provides
 * a tab bar for the GM to switch independently of sidebar navigation.
 * Implemented by {@link ScenePane}.
 */
public interface SceneRegistry {

    /**
     * Register a new game-activity tab. The returned handle allows the caller
     * to update the tab's content (e.g. Roster → Tracker) and activate it.
     * The first registered tab is auto-activated.
     *
     * @param label          tab display label (e.g. "⚔ Encounter")
     * @param initialContent initial content node for the tab
     * @return handle for subsequent content updates and activation
     */
    SceneHandle registerScene(String label, Node initialContent);
}
