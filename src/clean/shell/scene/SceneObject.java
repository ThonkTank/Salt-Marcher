package clean.shell.scene;

import clean.shell.scene.input.ComposeSceneInput;
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

/**
 * Clean shell-owned lower-right scene owner.
 */
@SuppressWarnings("unused")
public final class SceneObject {

    private final ComposeSceneInput.SceneInput scene;

    public SceneObject(ComposeSceneInput input) {
        ComposeSceneInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.scene = new SceneAssembly(resolvedInput).composeScene();
    }

    public ComposeSceneInput.SceneInput composeScene(ComposeSceneInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return scene;
    }

    private static final class SceneAssembly {

        private final java.util.List<TabEntry> tabs = new java.util.ArrayList<>();
        private final HBox tabBar = new HBox(8);
        private final StackPane contentHost = new StackPane();
        private final ToggleGroup toggleGroup = new ToggleGroup();
        private final VBox root = new VBox();
        private final Label placeholderLabel = new Label("Keine aktive Szene");
        private TabEntry activeTab;

        private SceneAssembly(ComposeSceneInput input) {
        }

        private ComposeSceneInput.SceneInput composeScene() {
            tabBar.setAlignment(Pos.CENTER_LEFT);
            tabBar.setPadding(new Insets(4, 8, 0, 8));
            tabBar.getStyleClass().add("shell-chrome");

            placeholderLabel.getStyleClass().add("text-muted");
            placeholderLabel.setWrapText(true);

            VBox placeholder = new VBox(placeholderLabel);
            contentHost.getChildren().setAll(placeholder);
            VBox.setVgrow(contentHost, Priority.ALWAYS);

            root.getStyleClass().add("shell-pane");
            root.getChildren().setAll(tabBar, contentHost);
            rebuildTabBar();

            return new ComposeSceneInput.SceneInput(root, new ComposeSceneInput.RegistryInput(this::registerScene));
        }

        private ComposeSceneInput.HandleInput registerScene(ComposeSceneInput.RegistrationInput input) {
            if (input == null) {
                return new ComposeSceneInput.HandleInput(node -> { }, () -> { });
            }
            String label = normalizeText(input.label());
            if (label.isEmpty()) {
                return new ComposeSceneInput.HandleInput(node -> { }, () -> { });
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
            labelNode.getStyleClass().add("text-muted");
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
                this.button.getStyleClass().add("toggle-control");
                this.button.setPadding(new Insets(4, 10, 4, 10));
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
