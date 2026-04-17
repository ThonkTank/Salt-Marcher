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
import org.jspecify.annotations.Nullable;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Shared lower-right runtime-state panel with autonomous tab navigation.
 */
public final class RuntimeStatePane extends VBox {

    private final HBox tabBar = new HBox(2);
    private final StackPane contentArea = new StackPane();
    private final ToggleGroup tabGroup = new ToggleGroup();
    private final Label placeholder = new Label("Kein Runtime-Zustand verfügbar");
    private final Map<ContributionKey, StateTab> tabs = new LinkedHashMap<>();

    private @Nullable ContributionKey activeKey;

    public RuntimeStatePane() {
        getStyleClass().add("scene-pane");
        setPrefWidth(380);
        setMinWidth(280);

        tabBar.getStyleClass().add("scene-tab-bar");
        tabBar.setAlignment(Pos.CENTER_LEFT);
        tabBar.setPadding(new Insets(4, 8, 4, 8));

        placeholder.getStyleClass().add("text-muted");
        placeholder.setMaxWidth(Double.MAX_VALUE);
        placeholder.setMaxHeight(Double.MAX_VALUE);
        placeholder.setAlignment(Pos.CENTER);

        contentArea.setAlignment(Pos.TOP_LEFT);
        VBox.setVgrow(contentArea, Priority.ALWAYS);
        contentArea.getChildren().setAll(placeholder);

        getChildren().addAll(tabBar, contentArea);
        rebuildTabBar();
    }

    public void registerTab(ContributionKey key, String label, int itemOrder, Node content) {
        Objects.requireNonNull(key, "key");
        if (tabs.containsKey(key)) {
            throw new IllegalArgumentException("Duplicate runtime state key: " + key.value());
        }
        tabs.put(key, new StateTab(key, label, itemOrder, content));
        rebuildTabBar();
        if (activeKey == null) {
            activateTab(key);
        }
    }

    public void activateTab(ContributionKey key) {
        StateTab tab = tabs.get(key);
        if (tab == null) {
            return;
        }
        activeKey = key;
        tab.select();
        contentArea.getChildren().setAll(tab.contentOr(placeholder));
    }

    public boolean hasTabs() {
        return !tabs.isEmpty();
    }

    private void rebuildTabBar() {
        tabBar.getChildren().clear();
        for (StateTab tab : getSortedTabs()) {
            tabBar.getChildren().add(tab.button);
        }
        tabBar.setVisible(tabs.size() > 1);
        tabBar.setManaged(tabs.size() > 1);
    }

    private List<StateTab> getSortedTabs() {
        List<StateTab> sorted = new ArrayList<>(tabs.values());
        sorted.sort(Comparator
                .comparingInt((StateTab tab) -> tab.itemOrder)
                .thenComparing(tab -> tab.label, String.CASE_INSENSITIVE_ORDER)
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
            this.content = content;
            this.button = new ToggleButton(label);
            button.getStyleClass().add("scene-tab");
            button.setToggleGroup(tabGroup);
            button.setOnAction(event -> activateTab(key));
        }

        private void select() {
            button.setSelected(true);
        }

        private Node contentOr(Node fallback) {
            return content != null ? content : fallback;
        }
    }
}
