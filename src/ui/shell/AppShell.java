package ui.shell;

import javafx.application.Platform;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.SplitPane;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.*;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Main application shell: sidebar + four-panel cockpit layout.
 * <pre>
 * +---toolbar------------------------------+
 * | side | Controls      | Details         |
 * | bar  | (top-left)    | (top-right)     |
 * |      |---------------+-----------------|
 * |      | Main          | State           |
 * |      | (bottom-left) | (bottom-right)  |
 * +------+---------------+-----------------+
 * </pre>
 * Left column is a VBox (Controls takes natural height, Main fills rest — not resizable).
 * Right column is a vertical SplitPane (Details / State — resizable).
 * <p>
 * Views leave State null → shell shows the shell-owned details pane + ScenePane.
 * The upper-right details pane is shell-owned for all views.
 * <p>
 * SplitPane items are set once in the constructor and never mutated.
 * Content is swapped inside StackPane containers only, which preserves divider positions.
 */
public class AppShell extends BorderPane {

    private final Map<ViewId, AppView> views = new EnumMap<>(ViewId.class);
    private final Map<ViewId, ToggleButton> navButtons = new EnumMap<>(ViewId.class);
    private final ToggleGroup navGroup = new ToggleGroup();

    // ---- Cockpit panels ----
    private final VBox controlsPanel = new VBox();               // Top-left: controls
    private final StackPane mainPanel = new StackPane();         // Bottom-left: main workspace
    private final StackPane detailsContainer = new StackPane(); // Top-right: always wraps shell-owned details pane
    private final StackPane stateContainer = new StackPane();   // Bottom-right: wraps ScenePane or view content

    // ---- Shell-owned panel defaults (used when views return null) ----
    private final InspectorPane inspectorPane;
    private final ScenePane scenePane = new ScenePane();

    // ---- Layout structure ----
    private final HBox toolbar = new HBox(8);
    private final HBox persistentToolbarItems = new HBox(8);
    private final VBox sidebar = new VBox(4);
    private final VBox leftColumn = new VBox();
    private final SplitPane mainSplit = new SplitPane();
    private final SplitPane rightSplit = new SplitPane();

    // ---- Divider persistence ----
    private final Map<ViewId, double[]> savedMainDividers = new EnumMap<>(ViewId.class);
    private final Map<ViewId, double[]> savedRightDividers = new EnumMap<>(ViewId.class);

    private ViewId activeViewId;
    private ViewCategory lastRegisteredCategory = null;

    public AppShell() {
        // ---- Sidebar (always far left) ----
        sidebar.getStyleClass().add("nav-sidebar");
        sidebar.setAlignment(Pos.TOP_CENTER);

        // ---- Controls panel ----
        controlsPanel.getStyleClass().add("control-panel");
        controlsPanel.setPrefWidth(240);
        controlsPanel.setMinWidth(200);
        controlsPanel.setMaxHeight(Double.MAX_VALUE);

        // ---- Toolbar ----
        toolbar.getStyleClass().add("toolbar");
        toolbar.setAlignment(Pos.CENTER_LEFT);
        setTop(toolbar);

        // ---- Details pane (shell-owned, default for Details panel) ----
        inspectorPane = new InspectorPane();

        // ---- Left column: Controls (content height) + Main (fills rest) ----
        VBox.setVgrow(controlsPanel, Priority.NEVER);
        VBox.setVgrow(mainPanel, Priority.ALWAYS);
        leftColumn.getChildren().addAll(controlsPanel, mainPanel);

        // ---- Right column: Details + State in vertical SplitPane ----
        // Items set once — never mutated. Content swapped inside containers.
        detailsContainer.getChildren().add(inspectorPane);
        stateContainer.getChildren().add(scenePane);
        rightSplit.setOrientation(javafx.geometry.Orientation.VERTICAL);
        rightSplit.getItems().addAll(detailsContainer, stateContainer);

        // ---- Main split: left column + right column ----
        // Items set once — never mutated.
        mainSplit.setOrientation(javafx.geometry.Orientation.HORIZONTAL);
        mainSplit.getItems().addAll(leftColumn, rightSplit);

        setLeft(sidebar);
        setCenter(mainSplit);
    }

    // ---- View management ----

    public void registerView(ViewId id, AppView view) {
        views.put(id, view);

        // Insert separator when switching from one category to another
        if (lastRegisteredCategory != null && id.getCategory() != lastRegisteredCategory) {
            Region sep = new Region();
            sep.getStyleClass().add("nav-separator");
            sep.setMinHeight(1);
            sep.setPrefHeight(1);
            sidebar.getChildren().add(sep);
        }
        lastRegisteredCategory = id.getCategory();

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

        applyViewContent(target);

        ToggleButton btn = navButtons.get(id);
        if (btn != null) btn.setSelected(true);

        rebuildToolbar(target);

        // Restore divider positions after layout pass
        ViewId targetViewId = activeViewId;
        Platform.runLater(() -> {
            if (targetViewId != activeViewId) {
                return;
            }
            double[] mainPos = savedMainDividers.get(targetViewId);
            mainSplit.setDividerPositions(mainPos != null ? mainPos[0] : 0.62);
            double[] rightPos = savedRightDividers.get(targetViewId);
            rightSplit.setDividerPositions(rightPos != null ? rightPos[0] : 0.45);
        });

        target.onShow();
    }

    /** Refresh all panels for the active view (called after mode changes).
     *  Content-only swap — SplitPane items are never touched, divider positions preserved. */
    public void refreshPanels() {
        if (activeViewId != null) {
            AppView target = views.get(activeViewId);
            if (target != null) {
                applyViewContent(target);
                rebuildToolbar(target);
            }
        }
    }

    /** Rebuild only the toolbar items for the active view. Does NOT touch panels. */
    public void refreshToolbar() {
        if (activeViewId != null) {
            AppView current = views.get(activeViewId);
            if (current != null) rebuildToolbar(current);
        }
    }

    /** Returns the shared upper-right details navigator. */
    public DetailsNavigator getDetailsNavigator() { return inspectorPane; }
    /** Returns the SceneRegistry for tab-based game-activity registration. */
    public SceneRegistry getSceneRegistry() { return scenePane; }

    /** Add a node to the persistent (right-aligned) toolbar zone. Survives navigation. */
    public void addPersistentToolbarItem(Node item) {
        persistentToolbarItems.getChildren().add(item);
    }

    // ---- Internal ----

    /**
     * Swaps content inside the four cockpit panel containers.
     * Never touches SplitPane items — divider positions are always preserved.
     * Safe to call on both navigation and mode switches.
     */
    private void applyViewContent(AppView target) {
        // Controls panel (top-left)
        Node controls = target.getControlsContent();
        controlsPanel.getChildren().clear();
        if (controls != null) {
            controlsPanel.getChildren().add(controls);
            VBox.setVgrow(controls, Priority.ALWAYS);
        }
        controlsPanel.setVisible(controls != null);
        controlsPanel.setManaged(controls != null);

        // Main panel (bottom-left) — guard preserves scroll/filter state
        Node main = target.getMainContent();
        if (!mainPanel.getChildren().contains(main)) {
            mainPanel.getChildren().setAll(main);
        }

        // Details panel (top-right) — always the shell-owned details pane
        if (!detailsContainer.getChildren().contains(inspectorPane)) {
            detailsContainer.getChildren().setAll(inspectorPane);
        }

        // State panel (bottom-right) — null = shell-owned ScenePane
        Node state = target.getStateContent();
        Node stateNode = state != null ? state : scenePane;
        if (!stateContainer.getChildren().contains(stateNode)) {
            stateContainer.getChildren().setAll(stateNode);
        }
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
