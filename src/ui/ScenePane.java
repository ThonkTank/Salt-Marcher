package ui;

import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

import java.util.ArrayList;
import java.util.List;

/**
 * Persistent lower-right panel ("game state").
 * Provides a tab bar for independent game-activity switching (Encounter, Travel, etc.).
 * Views register tabs via {@link SceneRegistry}; the GM switches tabs independently
 * of sidebar navigation. Owned by AppShell, not by any view.
 */
public class ScenePane extends VBox implements SceneRegistry {

    private final HBox tabBar = new HBox(2);
    private final StackPane contentArea = new StackPane();
    private final ToggleGroup tabGroup = new ToggleGroup();
    private final List<TabEntry> tabs = new ArrayList<>();
    private final Label placeholder;
    private TabEntry activeTab;

    public ScenePane() {
        getStyleClass().add("scene-pane");
        setPrefWidth(380);
        setMinWidth(280);

        // Tab bar
        tabBar.getStyleClass().add("scene-tab-bar");
        tabBar.setAlignment(Pos.CENTER_LEFT);
        tabBar.setPadding(new Insets(4, 8, 4, 8));

        // Placeholder (shown when no tabs registered)
        placeholder = new Label("Keine aktive Szene");
        placeholder.getStyleClass().add("text-muted");
        placeholder.setMaxWidth(Double.MAX_VALUE);
        placeholder.setMaxHeight(Double.MAX_VALUE);
        placeholder.setAlignment(Pos.CENTER);

        contentArea.setAlignment(Pos.TOP_LEFT);
        VBox.setVgrow(contentArea, Priority.ALWAYS);

        contentArea.getChildren().setAll(placeholder);
        getChildren().addAll(tabBar, contentArea);
    }

    // ---- SceneRegistry ----

    @Override
    public SceneHandle registerScene(String label, Node initialContent) {
        TabEntry entry = new TabEntry(label, initialContent);
        tabs.add(entry);
        rebuildTabBar();
        if (activeTab == null) activateTab(entry);
        return entry;
    }

    // ---- Internal ----

    private void activateTab(TabEntry tab) {
        activeTab = tab;
        tab.button.setSelected(true);
        contentArea.getChildren().setAll(tab.content);
    }

    private void rebuildTabBar() {
        tabBar.getChildren().clear();
        for (TabEntry tab : tabs) {
            tabBar.getChildren().add(tab.button);
        }
        // Hide tab bar when only one tab — no switching needed yet
        tabBar.setVisible(tabs.size() > 1);
        tabBar.setManaged(tabs.size() > 1);
    }

    // ---- Tab entry (implements SceneHandle) ----

    private class TabEntry implements SceneHandle {
        final ToggleButton button;
        Node content;

        TabEntry(String label, Node initialContent) {
            this.content = initialContent;
            this.button = new ToggleButton(label);
            button.getStyleClass().add("scene-tab");
            button.setToggleGroup(tabGroup);
            button.setOnAction(e -> activateTab(this));
        }

        @Override
        public void setContent(Node newContent) {
            this.content = newContent;
            if (activeTab == this) {
                contentArea.getChildren().setAll(newContent);
            }
        }

        @Override
        public void activate() {
            activateTab(this);
        }
    }
}
