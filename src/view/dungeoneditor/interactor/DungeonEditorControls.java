package src.view.dungeoneditor.interactor;

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
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.DungeonMapSummary;
import src.view.dungeonshared.interactor.DungeonMapSurfaceController;
import src.view.dungeonshared.interactor.DungeonOverlayControls;
import src.view.mapshared.interactor.MapWorkspaceSupport;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

final class DungeonEditorControls extends VBox {

    private final DungeonMapSurfaceController controller;
    private final Supplier<src.domain.dungeon.api.Viewport> viewportSupplier;
    private final ComboBox<DungeonMapSummary> selector = new ComboBox<>();
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

    DungeonEditorControls(
            DungeonMapSurfaceController controller,
            Supplier<src.domain.dungeon.api.Viewport> viewportSupplier
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.viewportSupplier = Objects.requireNonNull(viewportSupplier, "viewportSupplier");
        getStyleClass().add("dungeon-editor-toolbar");
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
        overlayControls.setOnModeChanged(mode -> controller.updateOverlayMode(mode, this.viewportSupplier.get()));
        overlayControls.setOnRangeChanged(range -> controller.updateOverlayRange(range, this.viewportSupplier.get()));
        overlayControls.setOnOpacityChanged(opacity -> controller.updateOverlayOpacity(opacity, this.viewportSupplier.get()));
        overlayControls.setOnSelectedLevelsChanged(levels -> controller.updateSelectedOverlayLevels(levels, this.viewportSupplier.get()));

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
        dungeonGroup.getStyleClass().add("editor-toolbar-group");

        HBox toolsRow = new HBox(6);
        toolsRow.setAlignment(Pos.CENTER_LEFT);
        for (DungeonEditorTool tool : DungeonEditorTool.values()) {
            ToggleButton button = toolToggle(tool.label());
            button.setToggleGroup(toolGroup);
            button.setOnAction(event -> {
                if (syncingToolSelection) {
                    return;
                }
                onToolChanged.accept(tool);
            });
            toolButtons.put(tool, button);
            toolsRow.getChildren().add(button);
        }

        VBox toolGroupBox = new VBox(6, MapWorkspaceSupport.sectionLabel("Werkzeug"), toolsRow);
        toolGroupBox.getStyleClass().add("editor-toolbar-group");

        getChildren().addAll(dungeonGroup, toolGroupBox);
        controller.addListener(this::refresh);
        refresh();
    }

    void setOnToolChanged(Consumer<DungeonEditorTool> onToolChanged) {
        this.onToolChanged = onToolChanged == null ? ignored -> { } : onToolChanged;
    }

    void showActiveTool(DungeonEditorTool tool) {
        syncingToolSelection = true;
        ToggleButton button = toolButtons.get(tool == null ? DungeonEditorTool.SELECT : tool);
        if (button != null) {
            toolGroup.selectToggle(button);
        }
        syncingToolSelection = false;
    }

    void refresh() {
        syncingSelection = true;
        selector.getItems().setAll(controller.visibleMaps());
        DungeonMapSummary selected = controller.selectedSummary();
        if (selected == null) {
            selector.getSelectionModel().clearSelection();
        } else {
            selector.getSelectionModel().select(selected);
        }
        syncingSelection = false;

        BaseMapSnapshot snapshot = controller.loadedSnapshot();
        selector.setDisable(controller.visibleMaps().isEmpty());
        previousLevelButton.setDisable(!controller.hasLoadedMap());
        nextLevelButton.setDisable(!controller.hasLoadedMap());
        overlayControls.showSettings(controller.overlaySettings(), !controller.hasLoadedMap());
        statusLabel.setText(controller.statusText());
        levelLabel.setText("Ebene z=" + (snapshot == null ? controller.currentFloor() : snapshot.currentFloor()));
    }

    private void configureSelector() {
        selector.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonMapSummary summary) {
                return summary == null ? "" : summary.mapName();
            }

            @Override
            public DungeonMapSummary fromString(String string) {
                throw new UnsupportedOperationException("ComboBox conversion is view-only.");
            }
        });
        selector.setCellFactory(ignored -> new ListCell<>() {
            @Override
            protected void updateItem(DungeonMapSummary item, boolean empty) {
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
