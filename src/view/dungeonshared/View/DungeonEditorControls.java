package src.view.dungeonshared.View;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import src.view.dungeonshared.ViewModel.DungeonEditorTool;
import src.view.dungeonshared.ViewModel.DungeonLoadedMapViewModel;
import src.view.dungeonshared.ViewModel.DungeonMapSurfaceViewModel;
import src.view.dungeonshared.ViewModel.DungeonMapSummaryViewModel;
import src.view.dungeonshared.ViewModel.DungeonViewportViewModel;
import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;
public final class DungeonEditorControls extends VBox {
    private final DungeonMapSurfaceViewModel controller;
    private final Supplier<DungeonViewportViewModel> viewportSupplier;
    private final ComboBox<DungeonMapSummaryViewModel> selector = new ComboBox<>();
    private final Label statusLabel = new Label();
    private final Label levelLabel = new Label("Ebene z=0");
    private final Button previousLevelButton = actionButton("Ebene -");
    private final Button nextLevelButton = actionButton("Ebene +");
    private final DungeonOverlayControls overlayControls = new DungeonOverlayControls();
    private final ToggleGroup toolGroup = new ToggleGroup();
    private final Map<DungeonEditorTool, ToggleButton> toolButtons = new EnumMap<>(DungeonEditorTool.class);
    private Consumer<DungeonEditorTool> onToolChanged = ignored -> { };
    private boolean syncingSelection;
    private boolean syncingToolSelection;
    public DungeonEditorControls(
            DungeonMapSurfaceViewModel controller,
            Supplier<DungeonViewportViewModel> viewportSupplier
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.viewportSupplier = Objects.requireNonNull(viewportSupplier, "viewportSupplier");
        getStyleClass().add("control-toolbar");
        setSpacing(10);
        setPadding(new Insets(12));
        setFillWidth(true);
        setMaxWidth(Double.MAX_VALUE);
        configureSelector();
        Button newMapButton = actionButton("Neuen Dungeon");
        newMapButton.setOnAction(event -> controller.createMap(controller.defaultMapName(), this.viewportSupplier.get()));
        Button editMapButton = actionButton("Dungeon bearbeiten");
        editMapButton.setOnAction(event -> controller.loadSelected(this.viewportSupplier.get()));
        Button graphButton = actionButton("Graph");
        graphButton.setDisable(true);
        statusLabel.getStyleClass().add("text-muted");
        statusLabel.setWrapText(true);
        previousLevelButton.setOnAction(event -> controller.stepFloor(-1, this.viewportSupplier.get()));
        nextLevelButton.setOnAction(event -> controller.stepFloor(1, this.viewportSupplier.get()));
        DungeonOverlayBindings.bind(overlayControls, controller, this.viewportSupplier);
        getChildren().addAll(
                buildDungeonGroup(newMapButton, editMapButton, graphButton),
                buildToolGroup());
        controller.addListener(this::refresh);
        refresh();
    }
    public void setOnToolChanged(Consumer<DungeonEditorTool> onToolChanged) {
        this.onToolChanged = onToolChanged == null ? ignored -> { } : onToolChanged;
    }
    public void showActiveTool(DungeonEditorTool tool) {
        withToolSelectionSync(() -> {
            ToggleButton button = toolButtons.get(tool == null ? DungeonEditorTool.defaultTool() : tool);
            if (button != null) {
                toolGroup.selectToggle(button);
            }
        });
    }
    public void refresh() {
        var state = controller.viewState();
        withSelectionSync(() -> {
            selector.getItems().setAll(state.visibleMaps());
            DungeonMapSummaryViewModel selected = state.selectedSummary();
            if (selected == null) {
                selector.getSelectionModel().clearSelection();
            } else {
                selector.getSelectionModel().select(selected);
            }
        });
        DungeonLoadedMapViewModel snapshot = state.loadedMap();
        selector.setDisable(state.visibleMaps().isEmpty());
        previousLevelButton.setDisable(!state.hasLoadedMap());
        nextLevelButton.setDisable(!state.hasLoadedMap());
        overlayControls.showSettings(state.overlaySettings(), !state.hasLoadedMap());
        statusLabel.setText(state.statusText());
        levelLabel.setText("Ebene z=" + (snapshot == null ? state.currentFloor() : snapshot.currentFloor()));
    }
    private void configureSelector() {
        selector.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonMapSummaryViewModel summary) {
                return summary == null ? "" : summary.mapName();
            }
            @Override
            public DungeonMapSummaryViewModel fromString(String string) {
                throw new UnsupportedOperationException("ComboBox conversion is view-only.");
            }
        });
        selector.setCellFactory(ignored -> new ListCell<>() {
            @Override
            protected void updateItem(DungeonMapSummaryViewModel item, boolean empty) {
                super.updateItem(item, empty);
                setText(empty || item == null ? null : item.mapName());
            }
        });
        selector.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(selector, Priority.ALWAYS);
        selector.getSelectionModel().selectedItemProperty().addListener((ignored, before, after) -> {
            if (syncingSelection || after == null) {
                return;
            }
            controller.selectMap(after.mapId());
        });
    }
    @SuppressWarnings("PMD.UnusedAssignment")
    private void withSelectionSync(Runnable action) {
        syncingSelection = true;
        try {
            action.run();
        } finally {
            syncingSelection = false;
        }
    }
    @SuppressWarnings("PMD.UnusedAssignment")
    private void withToolSelectionSync(Runnable action) {
        syncingToolSelection = true;
        try {
            action.run();
        } finally {
            syncingToolSelection = false;
        }
    }
    private VBox buildDungeonGroup(Button newMapButton, Button editMapButton, Button graphButton) {
        HBox mapRow = new HBox(8, selector, newMapButton, editMapButton, graphButton);
        mapRow.setAlignment(Pos.CENTER_LEFT);
        mapRow.setMaxWidth(Double.MAX_VALUE);
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox levelRow = new HBox(8, levelLabel, previousLevelButton, nextLevelButton, spacer, overlayControls.trigger());
        levelRow.setAlignment(Pos.CENTER_LEFT);
        levelRow.setMaxWidth(Double.MAX_VALUE);
        VBox dungeonGroup = new VBox(6,
                MapWorkspaceSupport.sectionLabel("Dungeon"),
                mapRow,
                statusLabel,
                levelRow);
        dungeonGroup.getStyleClass().add("control-group");
        return dungeonGroup;
    }
    private VBox buildToolGroup() {
        HBox toolsRow = new HBox(6);
        toolsRow.setAlignment(Pos.CENTER_LEFT);
        for (DungeonEditorTool tool : DungeonEditorTool.values()) {
            toolsRow.getChildren().add(buildToolButton(tool));
        }
        VBox toolGroupBox = new VBox(6, MapWorkspaceSupport.sectionLabel("Werkzeug"), toolsRow);
        toolGroupBox.getStyleClass().add("control-group");
        return toolGroupBox;
    }
    private ToggleButton buildToolButton(DungeonEditorTool tool) {
        ToggleButton button = toolToggle(tool.label());
        button.setToggleGroup(toolGroup);
        button.setOnAction(event -> {
            if (!syncingToolSelection) {
                onToolChanged.accept(tool);
            }
        });
        toolButtons.put(tool, button);
        return button;
    }
    private static Button actionButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("toolbar-action-button");
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }
    private static ToggleButton toolToggle(String text) {
        ToggleButton button = new ToggleButton(text);
        button.getStyleClass().add("tool-btn");
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }
}
