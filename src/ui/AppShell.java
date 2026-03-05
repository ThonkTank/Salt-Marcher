package ui;

import javafx.application.Platform;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.SplitPane;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.*;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Main application shell: sidebar + nested SplitPane layout.
 *   Sidebar | mainSplit [ leftColumn(VBox: ControlPanel/Center) | rightSplit(vertical: Context/StatBlock) ]
 *
 * Dividers (mainSplit, rightSplit) are independently resizable.
 * Divider positions are preserved during mode switches within a view.
 */
public class AppShell extends BorderPane {

    private final Map<ViewId, AppView> views = new EnumMap<>(ViewId.class);
    private final Map<ViewId, ToggleButton> navButtons = new EnumMap<>(ViewId.class);
    private final ToggleGroup navGroup = new ToggleGroup();

    private final StackPane contentArea = new StackPane();
    private final HBox toolbar = new HBox(8);
    private final HBox persistentToolbarItems = new HBox(8);
    private final VBox sidebar = new VBox(4);
    private final VBox controlPanelContainer = new VBox();
    private final InspectorPane inspectorPane;
    private final SplitPane mainSplit = new SplitPane();
    private final VBox leftColumn = new VBox();
    private final SplitPane rightSplit = new SplitPane();
    private final ScenePane scenePane = new ScenePane();

    // JavaFX SplitPane resets divider positions whenever getItems() is mutated.
    // configureSplitItems() sets the SplitPane items (resets dividers) and is called ONLY on navigation (navigateTo).
    // applyViewContent() swaps content inside existing containers without touching SplitPane items
    // and is called on both navigation and mode switches (refreshPanels).
    // currentViewHasControl caches whether the active view provides a control panel so that
    // refreshPanels() can call applyViewContent() safely without re-running configureSplitItems().
    private boolean currentViewHasControl = false;
    private final Map<ViewId, double[]> savedMainDividers = new EnumMap<>(ViewId.class);
    private final Map<ViewId, double[]> savedRightDividers = new EnumMap<>(ViewId.class);

    private ViewId activeViewId;

    public AppShell() {
        // ---- Sidebar (always far left) ----
        sidebar.getStyleClass().add("nav-sidebar");
        sidebar.setAlignment(Pos.TOP_CENTER);

        // ---- Control panel container ----
        controlPanelContainer.getStyleClass().add("control-panel");
        controlPanelContainer.setPrefWidth(240);
        controlPanelContainer.setMinWidth(200);
        controlPanelContainer.setMaxHeight(Double.MAX_VALUE);

        // ---- Toolbar ----
        toolbar.getStyleClass().add("toolbar");
        toolbar.setAlignment(Pos.CENTER_LEFT);
        setTop(toolbar);

        // ---- Inspector ----
        inspectorPane = new InspectorPane();

        // ---- Left column: control panel (content height) + center (fills rest) ----
        VBox.setVgrow(controlPanelContainer, Priority.NEVER);
        VBox.setVgrow(contentArea, Priority.ALWAYS);

        // ---- Split panes ----
        mainSplit.setOrientation(javafx.geometry.Orientation.HORIZONTAL);
        rightSplit.setOrientation(javafx.geometry.Orientation.VERTICAL);

        setLeft(sidebar);
        setCenter(mainSplit);
    }

    // ---- View management ----

    public void registerView(ViewId id, AppView view) {
        views.put(id, view);

        ToggleButton btn = new ToggleButton(view.getIconText());
        btn.getStyleClass().add("nav-btn");
        btn.setToggleGroup(navGroup);
        btn.setTooltip(new Tooltip(view.getTitle()));
        btn.setAccessibleText(view.getTitle());
        btn.setOnAction(e -> navigateTo(id));
        navButtons.put(id, btn);
        sidebar.getChildren().add(btn);
    }

    public void navigateTo(ViewId id) {
        AppView target = views.get(id);
        if (target == null) return;
        if (id.equals(activeViewId)) return;

        if (activeViewId != null) {
            // Save divider positions for the view we're leaving
            if (mainSplit.getDividerPositions().length > 0)
                savedMainDividers.put(activeViewId, mainSplit.getDividerPositions().clone());
            if (rightSplit.getDividerPositions().length > 0)
                savedRightDividers.put(activeViewId, rightSplit.getDividerPositions().clone());

            AppView current = views.get(activeViewId);
            if (current != null) current.onHide();
        }

        activeViewId = id;

        currentViewHasControl = target.getControlPanel() != null;

        applyViewContent(target);
        configureSplitItems();

        ToggleButton btn = navButtons.get(id);
        if (btn != null) btn.setSelected(true);

        rebuildToolbar(target);
        target.onShow();
    }

    /** Refresh all panels for the active view (called after mode changes).
     *  Does NOT reconfigure SplitPane items — preserves divider positions. */
    public void refreshPanels() {
        if (activeViewId != null) {
            AppView target = views.get(activeViewId);
            if (target != null) {
                applyViewContent(target);
                rebuildToolbar(target);
            }
        }
    }

    /** Rebuild only the toolbar items for the active view. Does NOT touch panels or SplitPane items. */
    public void refreshToolbar() {
        if (activeViewId != null) {
            AppView current = views.get(activeViewId);
            if (current != null) rebuildToolbar(current);
        }
    }

    /** Returns a method reference to {@link InspectorPane#showStatBlock(Long)} — toggles the stat block panel. */
    public Consumer<Long> getShowStatBlockHandler() { return inspectorPane::showStatBlock; }
    /** Returns a method reference to {@link InspectorPane#ensureStatBlock(Long)} — shows without toggling. */
    public Consumer<Long> getEnsureStatBlockHandler() { return inspectorPane::ensureStatBlock; }
    /** Returns the SceneRegistry for tab-based game-activity registration. */
    public SceneRegistry getSceneRegistry() { return scenePane; }
    /** Returns a handler for showing arbitrary content in the inspector panel. */
    public BiConsumer<String, Node> getShowContentHandler() { return inspectorPane::showContent; }

    /** Add a node to the persistent (right-aligned) toolbar zone. Survives navigation. */
    public void addPersistentToolbarItem(Node item) {
        persistentToolbarItems.getChildren().add(item);
    }

    // ---- Internal ----

    /**
     * Swaps content inside existing containers. MUST NOT touch {@code mainSplit.getItems()}
     * or {@code rightSplit.getItems()} — mutating SplitPane items resets divider positions.
     * Item configuration is the exclusive responsibility of {@link #configureSplitItems()},
     * which is called on navigation only. This method is safe to call on mode switches.
     */
    private void applyViewContent(AppView target) {
        Node controlPanel = target.getControlPanel();

        // Control panel content
        controlPanelContainer.getChildren().clear();
        if (controlPanel != null) {
            controlPanelContainer.getChildren().add(controlPanel);
            VBox.setVgrow(controlPanel, Priority.ALWAYS);
        }

        // Center content — guard against re-inserting the same node (preserves scroll/filter state)
        Node root = target.getRoot();
        if (!contentArea.getChildren().contains(root)) {
            contentArea.getChildren().setAll(root);
        }
    }

    /** Configure SplitPane items based on current view's panels.
     *  Called on view navigation only — not on mode switches — to preserve divider positions. */
    private void configureSplitItems() {
        if (currentViewHasControl) {
            leftColumn.getChildren().setAll(controlPanelContainer, contentArea);
        } else {
            leftColumn.getChildren().setAll(contentArea);
        }

        rightSplit.getItems().setAll(inspectorPane, scenePane);
        mainSplit.getItems().setAll(leftColumn, rightSplit);

        Platform.runLater(() -> {
            double[] mainPos = savedMainDividers.get(activeViewId);
            double[] rightPos = savedRightDividers.get(activeViewId);
            mainSplit.setDividerPositions(mainPos != null ? mainPos[0] : 0.62);
            rightSplit.setDividerPositions(rightPos != null ? rightPos[0] : 0.45);
        });
    }

    private void rebuildToolbar(AppView view) {
        toolbar.getChildren().clear();

        Label title = new Label(view.getTitle());
        title.getStyleClass().add("large");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        // Keep nav button tooltip in sync with the active view's current title (e.g. after mode switch)
        ToggleButton activeBtn = navButtons.get(activeViewId);
        if (activeBtn != null) {
            activeBtn.setTooltip(new Tooltip(view.getTitle()));
            activeBtn.setAccessibleText(view.getTitle());
        }

        toolbar.getChildren().addAll(title, spacer);

        List<Node> items = view.getToolbarItems();
        toolbar.getChildren().addAll(items);

        // Persistent items (e.g. PartyPopup) — always present, rightmost
        toolbar.getChildren().add(persistentToolbarItems);
    }
}
