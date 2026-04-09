package features.appshell.scene;

import features.appshell.scene.input.ComposeSceneInput;
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
import java.util.Objects;

/**
 * Clean shell-owned lower-right scene pane with persistent tab registration.
 */
@SuppressWarnings("unused")
public final class SceneObject {

    private final ComposeSceneInput.SceneInput scene;

    public SceneObject(ComposeSceneInput input) {
        ComposeSceneInput resolvedInput = Objects.requireNonNull(input, "input");
        this.scene = new SceneAssembly(resolvedInput).composeScene();
    }

    public ComposeSceneInput.SceneInput composeScene(ComposeSceneInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return scene;
    }

    private static final class SceneAssembly {

        private final List<TabEntry> tabs = new ArrayList<>();
        private final HBox tabBar = new HBox(2);
        private final StackPane contentHost = new StackPane();
        private final ToggleGroup toggleGroup = new ToggleGroup();
        private final VBox root = new VBox();
        private final Label placeholder = new Label("Keine aktive Szene");
        private TabEntry activeTab;

        private SceneAssembly(ComposeSceneInput input) {
        }

        private ComposeSceneInput.SceneInput composeScene() {
            root.getStyleClass().add("scene-pane");
            root.setPrefWidth(380);
            root.setMinWidth(280);

            tabBar.getStyleClass().add("scene-tab-bar");
            tabBar.setAlignment(Pos.CENTER_LEFT);
            tabBar.setPadding(new Insets(4, 8, 4, 8));

            placeholder.getStyleClass().add("text-muted");
            placeholder.setMaxWidth(Double.MAX_VALUE);
            placeholder.setMaxHeight(Double.MAX_VALUE);
            placeholder.setAlignment(Pos.CENTER);

            contentHost.setAlignment(Pos.TOP_LEFT);
            VBox.setVgrow(contentHost, Priority.ALWAYS);
            contentHost.getChildren().setAll(placeholder);

            root.getChildren().setAll(tabBar, contentHost);
            rebuildTabBar();

            ComposeSceneInput.RegistryInput registry = new ComposeSceneInput.RegistryInput(this::registerScene);
            return new ComposeSceneInput.SceneInput(root, registry);
        }

        private ComposeSceneInput.HandleInput registerScene(ComposeSceneInput.RegistrationInput input) {
            if (input == null) {
                return new ComposeSceneInput.HandleInput(content -> { }, () -> { });
            }
            String label = normalizeText(input.label());
            if (label.isEmpty()) {
                return new ComposeSceneInput.HandleInput(content -> { }, () -> { });
            }

            Node initialContent = input.initialContent() == null ? createPlaceholderContent(label) : input.initialContent();
            TabEntry existingTab = findTab(label);
            if (existingTab != null) {
                existingTab.setContent(initialContent);
                return existingTab.handle();
            }

            TabEntry tab = new TabEntry(label, initialContent);
            tabs.add(tab);
            rebuildTabBar();
            if (activeTab == null) {
                activateTab(tab);
            }
            return tab.handle();
        }

        private void activateTab(TabEntry tab) {
            activeTab = tab;
            tab.button.setSelected(true);
            contentHost.getChildren().setAll(tab.content);
        }

        private void rebuildTabBar() {
            tabBar.getChildren().clear();
            for (TabEntry tab : tabs) {
                tabBar.getChildren().add(tab.button);
            }
            boolean showTabs = tabs.size() > 1;
            tabBar.setVisible(showTabs);
            tabBar.setManaged(showTabs);
        }

        private TabEntry findTab(String label) {
            for (TabEntry tab : tabs) {
                if (tab.label.equals(label)) {
                    return tab;
                }
            }
            return null;
        }

        private static Node createPlaceholderContent(String label) {
            Label labelNode = new Label("Szene \"" + label + "\" ist aktiv.");
            labelNode.setWrapText(true);
            VBox content = new VBox(labelNode);
            content.setPadding(new Insets(12));
            return content;
        }

        private static String normalizeText(String value) {
            return value == null ? "" : value.trim();
        }

        private final class TabEntry {
            private final String label;
            private final ToggleButton button;
            private Node content;

            private TabEntry(String label, Node initialContent) {
                this.label = label;
                this.button = new ToggleButton(label);
                this.button.getStyleClass().add("scene-tab");
                this.button.setToggleGroup(toggleGroup);
                this.button.setOnAction(event -> activateTab(this));
                this.content = initialContent;
            }

            private void setContent(Node content) {
                this.content = content == null ? createPlaceholderContent(label) : content;
                if (activeTab == this) {
                    contentHost.getChildren().setAll(this.content);
                }
            }

            private ComposeSceneInput.HandleInput handle() {
                return new ComposeSceneInput.HandleInput(this::setContent, () -> activateTab(this));
            }
        }
    }
}
