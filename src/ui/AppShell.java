package ui;

import javafx.application.Platform;
import javafx.geometry.Orientation;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.SplitPane;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.*;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Main application shell supporting two layout modes:
 *   Layout A ("3 columns"): [Sidebar | SplitPane(ControlPanel, Center, Inspector)]
 *   Layout B ("stacked"):   [Sidebar | SplitPane(VBox(ControlPanel, Center), Inspector)]
 *
 * All content zones are resizable via SplitPane dividers. Divider positions are
 * preserved during mode switches within a view (BUILDER → INITIATIVE → COMBAT).
 * Toggle via {@link #toggleLayout()}.
 */
public class AppShell extends BorderPane {

    private final Map<ViewId, AppView> views = new EnumMap<>(ViewId.class);
    private final Map<ViewId, ToggleButton> navButtons = new EnumMap<>(ViewId.class);
    private final ToggleGroup navGroup = new ToggleGroup();

    private final StackPane contentArea = new StackPane();
    private final HBox toolbar = new HBox(8);
    private final VBox sidebar = new VBox(4);
    private final VBox controlPanelContainer = new VBox();
    private final InspectorPane inspectorPane;
    private final SplitPane mainSplit = new SplitPane();
    private final VBox stackedCenter = new VBox();

    // Layout mode
    private boolean stackedLayout = false;

    // Track which panels the current view provides (to avoid SplitPane reconfig on mode switch)
    private boolean currentViewHasControl = false;
    private boolean currentViewHasInspector = false;

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

        // ---- Main SplitPane (resizable content zones) ----
        mainSplit.setOrientation(Orientation.HORIZONTAL);

        setLeft(sidebar);
        setCenter(mainSplit);
    }

    // ---- Layout toggle ----

    public void toggleLayout() {
        stackedLayout = !stackedLayout;
        configureSplitItems();
        if (activeViewId != null) {
            AppView target = views.get(activeViewId);
            if (target != null) {
                target.onLayoutChanged(stackedLayout);
                applyViewContent(target);
            }
        }
    }

    public boolean isStackedLayout() { return stackedLayout; }

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

        if (activeViewId != null) {
            AppView current = views.get(activeViewId);
            if (current != null) current.onHide();
        }

        activeViewId = id;

        // Determine which panels this view provides
        currentViewHasControl = target.getControlPanel() != null;
        currentViewHasInspector = target.getInspectorContent() != null;

        applyViewContent(target);
        configureSplitItems();

        ToggleButton btn = navButtons.get(id);
        if (btn != null) btn.setSelected(true);

        rebuildToolbar(target);
        target.onShow();
    }

    /** Refresh all panels for the active view (called after mode/layout changes).
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

    public void refreshToolbar() {
        if (activeViewId != null) {
            AppView current = views.get(activeViewId);
            if (current != null) rebuildToolbar(current);
        }
    }

    public InspectorPane getInspectorPane() { return inspectorPane; }

    // ---- Internal ----

    /** Swap content inside containers without touching SplitPane structure. */
    private void applyViewContent(AppView target) {
        Node centerContent = target.getRoot();
        Node controlPanel = target.getControlPanel();
        Node inspectorContent = target.getInspectorContent();

        // Control panel content
        controlPanelContainer.getChildren().clear();
        if (controlPanel != null) {
            controlPanelContainer.getChildren().add(controlPanel);
            VBox.setVgrow(controlPanel, Priority.ALWAYS);
        }

        // Center content
        contentArea.getChildren().setAll(centerContent);

        // Stacked layout: rebuild stackedCenter children
        if (stackedLayout) {
            stackedCenter.getChildren().clear();
            if (controlPanel != null) stackedCenter.getChildren().add(controlPanelContainer);
            stackedCenter.getChildren().add(contentArea);
            VBox.setVgrow(contentArea, Priority.ALWAYS);
        }

        // Inspector content
        if (inspectorContent != null) {
            inspectorPane.setContextContent(inspectorContent);
        }
    }

    /** Configure SplitPane items based on current view's panels and layout mode.
     *  Called on view navigation and layout toggle (NOT on mode switch). */
    private void configureSplitItems() {
        if (stackedLayout) {
            // Layout B: [stacked(controlPanel+content), inspector]
            controlPanelContainer.setMaxWidth(Double.MAX_VALUE);
            List<Node> items = new ArrayList<>();
            items.add(stackedCenter);
            if (currentViewHasInspector) items.add(inspectorPane);
            mainSplit.getItems().setAll(items);
            if (currentViewHasInspector) {
                Platform.runLater(() -> mainSplit.setDividerPositions(0.65));
            }
        } else {
            // Layout A: [controlPanel, content, inspector]
            controlPanelContainer.setMaxWidth(Double.MAX_VALUE);
            List<Node> items = new ArrayList<>();
            if (currentViewHasControl) items.add(controlPanelContainer);
            items.add(contentArea);
            if (currentViewHasInspector) items.add(inspectorPane);
            mainSplit.getItems().setAll(items);
            Platform.runLater(() -> {
                if (currentViewHasControl && currentViewHasInspector) {
                    mainSplit.setDividerPositions(0.20, 0.65);
                } else if (currentViewHasControl) {
                    mainSplit.setDividerPositions(0.25);
                } else if (currentViewHasInspector) {
                    mainSplit.setDividerPositions(0.65);
                }
            });
        }
    }

    private void rebuildToolbar(AppView view) {
        toolbar.getChildren().clear();

        Label title = new Label(view.getTitle());
        title.getStyleClass().add("large");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        toolbar.getChildren().addAll(title, spacer);

        List<Node> items = view.getToolbarItems();
        toolbar.getChildren().addAll(items);
    }
}
