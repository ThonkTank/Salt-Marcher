package shell.host;

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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import shell.api.ContributionKey;

/**
 * Shared lower-right state panel with autonomous state-tab navigation.
 */
final class StateTabPane extends VBox {

    private final HBox tabBar = new HBox(2);
    private final StackPane contentArea = new StackPane();
    private final ToggleGroup tabGroup = new ToggleGroup();
    private final Label placeholder = new Label("Kein Zustand verfügbar");
    private final Node placeholderHost = ShellContentLayout.shellOwned(placeholder);
    private final Map<ContributionKey, StateTab> tabs = new LinkedHashMap<>();
    private boolean manualSelectionMade;

    StateTabPane() {
        getStyleClass().add("surface-root");
        setPrefWidth(380);
        setMinWidth(280);
        setMinHeight(0);
        setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);

        ShellFx.addStyleClass(tabBar, "scene-tab-bar");
        tabBar.setAlignment(Pos.CENTER_LEFT);
        tabBar.setPadding(new Insets(4, 8, 4, 8));

        ShellFx.addStyleClass(placeholder, "text-muted");
        placeholder.setMaxWidth(Double.MAX_VALUE);
        placeholder.setMaxHeight(Double.MAX_VALUE);
        placeholder.setAlignment(Pos.CENTER);

        contentArea.setAlignment(Pos.TOP_LEFT);
        ShellContentLayout.makeShrinkable(contentArea);
        setVgrow(contentArea, Priority.ALWAYS);
        ShellFx.setChildren(contentArea, placeholderHost);

        getChildren().addAll(tabBar, contentArea);
        rebuildTabBar();
    }

    void registerTab(ContributionKey key, String label, int itemOrder, Node content) {
        Objects.requireNonNull(key, "key");
        if (tabs.containsKey(key)) {
            throw new IllegalArgumentException("Duplicate state tab key: " + key.value());
        }
        tabs.put(key, new StateTab(key, label, itemOrder, content));
        rebuildTabBar();
        if (!manualSelectionMade) {
            List<StateTab> sortedTabs = getSortedTabs();
            if (!sortedTabs.isEmpty()) {
                activateTab(sortedTabs.getFirst().key);
            }
        }
    }

    void activateTab(ContributionKey key) {
        StateTab tab = tabs.get(key);
        if (tab == null) {
            return;
        }
        tab.select();
        ShellFx.setChildren(contentArea, tab.contentOr(placeholderHost));
    }

    boolean hasTabs() {
        return !tabs.isEmpty();
    }

    private void rebuildTabBar() {
        ShellFx.clearChildren(tabBar);
        for (StateTab tab : getSortedTabs()) {
            ShellFx.addChild(tabBar, tab.button);
        }
        tabBar.setVisible(tabs.size() > 1);
        tabBar.setManaged(tabs.size() > 1);
    }

    private List<StateTab> getSortedTabs() {
        List<StateTab> sorted = new ArrayList<>(tabs.values());
        sorted.sort(Comparator
                .comparingInt((StateTab tab) -> tab.itemOrder)
                .thenComparing(StateTab::label, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(tab -> tab.key.value()));
        return sorted;
    }

    private final class StateTab {
        private final ContributionKey key;
        private final String label;
        private final int itemOrder;
        private final ToggleButton button;
        private final Node content;

        private StateTab(ContributionKey key, String label, int itemOrder, Node content) {
            this.key = key;
            this.label = label;
            this.itemOrder = itemOrder;
            this.content = ShellContentLayout.shellOwned(content);
            this.button = new ToggleButton(label);
            ShellFx.addStyleClass(button, "scene-tab");
            button.setToggleGroup(tabGroup);
            button.setOnAction(event -> {
                manualSelectionMade = true;
                activateTab(key);
            });
        }

        private String label() {
            return label;
        }

        private void select() {
            button.setSelected(true);
        }

        private Node contentOr(Node fallback) {
            return content != null ? content : fallback;
        }
    }
}
