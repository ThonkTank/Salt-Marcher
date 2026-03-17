package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.ui.selector.DungeonMapCell;
import features.world.dungeonmap.ui.workspace.DungeonEditorTool;
import features.world.dungeonmap.ui.workspace.DungeonViewMode;
import javafx.animation.PauseTransition;
import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.Tooltip;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.Duration;
import ui.components.AnchoredDropdown;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonEditorControls extends VBox {

    public record MapActionRequest(DungeonMap map, Node anchor) {}

    private final ComboBox<DungeonMap> mapSelector = new ComboBox<>();
    private final Button newMapButton = new Button("Neuen Dungeon");
    private final Button editMapButton = new Button("Dungeon bearbeiten");
    private final ToggleGroup viewGroup = new ToggleGroup();
    private final ToggleButton gridButton = new ToggleButton(DungeonViewMode.GRID.label());
    private final ToggleButton graphButton = new ToggleButton(DungeonViewMode.GRAPH.label());
    private final ToggleGroup toolGroup = new ToggleGroup();
    private final ToggleButton selectButton = new ToggleButton(DungeonEditorTool.SELECT.label());
    private final Button roomButton = new Button("Raum");
    private final Button wallButton = new Button("Wand");
    private final Button doorButton = new Button("Tür");
    private final Button corridorButton = new Button("Korridor");
    private final Button primaryToolOption = new Button();
    private final Button secondaryToolOption = new Button();
    private final HBox toolDropdownPanel = new HBox(8, primaryToolOption, secondaryToolOption);
    private final AnchoredDropdown toolDropdown;
    private final DungeonToolModeState toolModeState;
    private Consumer<DungeonEditorTool> onSelectedToolChanged;
    private Consumer<Long> onMapSelected;
    private Consumer<DungeonViewMode> onViewModeChanged;
    private boolean updatingSelection;
    private boolean updatingViewMode;
    private boolean updatingToolMode;
    private final PauseTransition dropdownHideDelay = new PauseTransition(Duration.millis(120));
    private DungeonEditorTool activeTool = DungeonEditorTool.SELECT;
    private Node dropdownAnchor;

    public DungeonEditorControls(DungeonToolModeState toolModeState) {
        this.toolModeState = toolModeState;
        getStyleClass().add("dungeon-editor-toolbar");
        setSpacing(10);
        setPadding(new Insets(12));
        setFillWidth(true);
        setMaxWidth(Double.MAX_VALUE);
        mapSelector.setPrefWidth(220);
        mapSelector.setMaxWidth(Double.MAX_VALUE);
        mapSelector.setCellFactory(list -> new DungeonMapCell());
        mapSelector.setButtonCell(new DungeonMapCell());

        newMapButton.setTooltip(new Tooltip("Neuen Dungeon anlegen"));
        newMapButton.setAccessibleText("Neuen Dungeon anlegen");
        editMapButton.setTooltip(new Tooltip("Dungeon bearbeiten"));
        editMapButton.setAccessibleText("Dungeon bearbeiten");
        editMapButton.disableProperty().bind(mapSelector.valueProperty().isNull());
        gridButton.getStyleClass().add("tool-btn");
        graphButton.getStyleClass().add("tool-btn");
        newMapButton.setMinWidth(Region.USE_PREF_SIZE);
        editMapButton.setMinWidth(Region.USE_PREF_SIZE);
        gridButton.setMinWidth(Region.USE_PREF_SIZE);
        graphButton.setMinWidth(Region.USE_PREF_SIZE);
        gridButton.setToggleGroup(viewGroup);
        graphButton.setToggleGroup(viewGroup);
        gridButton.setSelected(true);
        selectButton.getStyleClass().add("tool-btn");
        roomButton.getStyleClass().add("tool-btn");
        wallButton.getStyleClass().add("tool-btn");
        doorButton.getStyleClass().add("tool-btn");
        corridorButton.getStyleClass().add("tool-btn");
        selectButton.setMinWidth(Region.USE_PREF_SIZE);
        roomButton.setMinWidth(Region.USE_PREF_SIZE);
        wallButton.setMinWidth(Region.USE_PREF_SIZE);
        doorButton.setMinWidth(Region.USE_PREF_SIZE);
        corridorButton.setMinWidth(Region.USE_PREF_SIZE);
        selectButton.setToggleGroup(toolGroup);
        selectButton.setSelected(true);
        toolDropdownPanel.getStyleClass().addAll("dropdown-window", "dropdown-form");
        toolDropdownPanel.setPadding(new Insets(10));
        toolDropdown = new AnchoredDropdown(toolDropdownPanel);
        toolDropdown.setOnHidden(() -> dropdownAnchor = null);
        toolDropdownPanel.setOnMouseEntered(event -> cancelDropdownHideCheck());
        toolDropdownPanel.setOnMouseExited(event -> scheduleDropdownHideCheck());
        dropdownHideDelay.setOnFinished(event -> hideDropdownIfPointerLeftToolSurface());

        Label mapLabel = sectionLabel("Dungeon");
        HBox mapRow = new HBox(8, mapSelector, newMapButton, editMapButton, gridButton, graphButton);
        mapRow.setAlignment(Pos.CENTER_LEFT);
        mapRow.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(mapSelector, Priority.ALWAYS);
        VBox mapGroup = new VBox(6, mapLabel, mapRow);
        mapGroup.setMaxWidth(Double.MAX_VALUE);
        mapGroup.getStyleClass().add("editor-toolbar-group");

        Label toolsLabel = sectionLabel("Werkzeug");
        HBox toolRow = new HBox(6, selectButton, roomButton, wallButton, doorButton, corridorButton);
        toolRow.setAlignment(Pos.CENTER_LEFT);
        VBox toolGroupBox = new VBox(6, toolsLabel, toolRow);
        toolGroupBox.getStyleClass().add("editor-toolbar-group");

        getChildren().addAll(mapGroup, toolGroupBox);

        mapSelector.setOnAction(event -> {
            if (updatingSelection || onMapSelected == null) {
                return;
            }
            DungeonMap map = mapSelector.getSelectionModel().getSelectedItem();
            if (map != null) {
                onMapSelected.accept(map.mapId());
            }
        });

        viewGroup.selectedToggleProperty().addListener((obs, oldToggle, newToggle) -> {
            if (updatingViewMode) {
                return;
            }
            if (newToggle == null) {
                updatingViewMode = true;
                if (oldToggle != null) {
                    oldToggle.setSelected(true);
                } else {
                    gridButton.setSelected(true);
                }
                updatingViewMode = false;
                return;
            }
            if (onViewModeChanged != null) {
                onViewModeChanged.accept(newToggle == graphButton ? DungeonViewMode.GRAPH : DungeonViewMode.GRID);
            }
        });

        toolGroup.selectedToggleProperty().addListener((obs, oldToggle, newToggle) -> {
            if (updatingToolMode) {
                return;
            }
            if (newToggle == null) {
                updatingToolMode = true;
                if (oldToggle != null) {
                    oldToggle.setSelected(true);
                } else {
                    selectButton.setSelected(true);
                }
                updatingToolMode = false;
                return;
            }
            if (onSelectedToolChanged != null && newToggle == selectButton) {
                onSelectedToolChanged.accept(DungeonEditorTool.SELECT);
            }
        });

        configureToolDropdownButton(roomButton);
        configureToolDropdownButton(wallButton);
        configureToolDropdownButton(doorButton);
        configureToolDropdownButton(corridorButton);
        roomButton.setOnAction(event -> activateToolFamily(
                roomButton,
                DungeonEditorTool.ROOM_PAINT.label(),
                DungeonEditorTool.ROOM_PAINT,
                DungeonEditorTool.ROOM_DELETE.label(),
                DungeonEditorTool.ROOM_DELETE,
                toolModeState.preferredToolFor(DungeonEditorTool.ROOM_PAINT)));
        wallButton.setOnAction(event -> activateToolFamily(
                wallButton,
                DungeonEditorTool.CLUSTER_WALL.label(),
                DungeonEditorTool.CLUSTER_WALL,
                DungeonEditorTool.CLUSTER_WALL_DELETE.label(),
                DungeonEditorTool.CLUSTER_WALL_DELETE,
                toolModeState.preferredToolFor(DungeonEditorTool.CLUSTER_WALL)));
        doorButton.setOnAction(event -> activateToolFamily(
                doorButton,
                DungeonEditorTool.CLUSTER_DOOR.label(),
                DungeonEditorTool.CLUSTER_DOOR,
                DungeonEditorTool.CLUSTER_DOOR_DELETE.label(),
                DungeonEditorTool.CLUSTER_DOOR_DELETE,
                toolModeState.preferredToolFor(DungeonEditorTool.CLUSTER_DOOR)));
        corridorButton.setOnAction(event -> activateToolFamily(
                corridorButton,
                DungeonEditorTool.CORRIDOR_CREATE.label(),
                DungeonEditorTool.CORRIDOR_CREATE,
                DungeonEditorTool.CORRIDOR_DELETE.label(),
                DungeonEditorTool.CORRIDOR_DELETE,
                toolModeState.preferredToolFor(DungeonEditorTool.CORRIDOR_CREATE)));
    }

    public void setMaps(List<DungeonMap> maps) {
        mapSelector.getItems().setAll(maps);
    }

    public void selectMap(Long mapId) {
        updatingSelection = true;
        if (mapId == null) {
            mapSelector.getSelectionModel().clearSelection();
            updatingSelection = false;
            return;
        }
        for (DungeonMap map : mapSelector.getItems()) {
            if (mapId.equals(map.mapId())) {
                mapSelector.getSelectionModel().select(map);
                updatingSelection = false;
                return;
            }
        }
        mapSelector.getSelectionModel().clearSelection();
        updatingSelection = false;
    }

    public void setOnMapSelected(Consumer<Long> onMapSelected) {
        this.onMapSelected = onMapSelected;
    }

    public void setOnNewMapRequested(Consumer<Node> onNewMapRequested) {
        newMapButton.setOnAction(event -> {
            if (onNewMapRequested != null) {
                onNewMapRequested.accept(newMapButton);
            }
        });
    }

    public void setOnEditMapRequested(Consumer<MapActionRequest> onEditMapRequested) {
        editMapButton.setOnAction(event -> {
            DungeonMap map = mapSelector.getSelectionModel().getSelectedItem();
            if (map != null && onEditMapRequested != null) {
                onEditMapRequested.accept(new MapActionRequest(map, editMapButton));
            }
        });
    }

    public void setOnViewModeChanged(Consumer<DungeonViewMode> onViewModeChanged) {
        this.onViewModeChanged = onViewModeChanged;
    }

    public void setOnToolChanged(Consumer<DungeonEditorTool> onSelectedToolChanged) {
        this.onSelectedToolChanged = onSelectedToolChanged;
    }

    public void showTemporaryTool(DungeonEditorTool tool) {
        applyDisplayedTool(tool, false);
    }

    public void selectViewMode(DungeonViewMode viewMode) {
        updatingViewMode = true;
        if (viewMode == DungeonViewMode.GRAPH) {
            graphButton.setSelected(true);
        } else {
            gridButton.setSelected(true);
        }
        updatingViewMode = false;
    }

    public void selectTool(DungeonEditorTool tool) {
        applyDisplayedTool(tool, true);
    }

    private void applyDisplayedTool(DungeonEditorTool tool, boolean rememberSelection) {
        activeTool = tool == null ? DungeonEditorTool.SELECT : tool;
        if (rememberSelection) {
            toolModeState.selectPersistentTool(activeTool);
        }
        updatingToolMode = true;
        if (activeTool == DungeonEditorTool.SELECT) {
            selectButton.setSelected(true);
            roomButton.getStyleClass().remove("selected");
            wallButton.getStyleClass().remove("selected");
            doorButton.getStyleClass().remove("selected");
            corridorButton.getStyleClass().remove("selected");
        } else {
            toolGroup.selectToggle(null);
            roomButton.getStyleClass().remove("selected");
            wallButton.getStyleClass().remove("selected");
            doorButton.getStyleClass().remove("selected");
            corridorButton.getStyleClass().remove("selected");
            if (activeTool.isCorridorTool()) {
                corridorButton.getStyleClass().add("selected");
            } else if (activeTool.isWallTool()) {
                wallButton.getStyleClass().add("selected");
            } else if (activeTool.isDoorTool()) {
                doorButton.getStyleClass().add("selected");
            } else {
                roomButton.getStyleClass().add("selected");
            }
        }
        updatingToolMode = false;
    }

    private void applyToolSelection(DungeonEditorTool tool) {
        if (tool == null || tool == DungeonEditorTool.SELECT) {
            return;
        }
        toolModeState.selectPersistentTool(tool);
        if (onSelectedToolChanged != null) {
            onSelectedToolChanged.accept(tool);
        }
    }

    private void showToolDropdown(
            Node anchor,
            String primaryLabel,
            DungeonEditorTool primaryTool,
            String secondaryLabel,
            DungeonEditorTool secondaryTool,
            DungeonEditorTool preferredTool,
            Consumer<DungeonEditorTool> onSelected
    ) {
        dropdownAnchor = anchor;
        primaryToolOption.setText(primaryLabel);
        secondaryToolOption.setText(secondaryLabel);
        primaryToolOption.setOnAction(event -> submitToolSelection(primaryTool, onSelected));
        secondaryToolOption.setOnAction(event -> submitToolSelection(secondaryTool, onSelected));
        toolDropdown.show(anchor);
        toolDropdown.requestFocus(preferredTool == secondaryTool ? secondaryToolOption : primaryToolOption);
    }

    private void activateToolFamily(
            Node anchor,
            String primaryLabel,
            DungeonEditorTool primaryTool,
            String secondaryLabel,
            DungeonEditorTool secondaryTool,
            DungeonEditorTool preferredTool
    ) {
        DungeonEditorTool defaultTool = preferredTool == null ? primaryTool : preferredTool;
        applyToolSelection(defaultTool);
        showToolDropdown(
                anchor,
                primaryLabel,
                primaryTool,
                secondaryLabel,
                secondaryTool,
                defaultTool,
                this::applyToolSelection);
    }

    private void submitToolSelection(DungeonEditorTool tool, Consumer<DungeonEditorTool> onSelected) {
        if (onSelected != null) {
            onSelected.accept(tool);
        }
        toolDropdown.hide();
    }

    private void configureToolDropdownButton(Button button) {
        button.setOnMouseEntered(event -> cancelDropdownHideCheck());
        button.setOnMouseExited(event -> scheduleDropdownHideCheck());
    }

    private void scheduleDropdownHideCheck() {
        dropdownHideDelay.playFromStart();
    }

    private void cancelDropdownHideCheck() {
        dropdownHideDelay.stop();
    }

    private void hideDropdownIfPointerLeftToolSurface() {
        Platform.runLater(() -> {
            if (!toolDropdown.isShowing()) {
                return;
            }
            if (dropdownAnchor != null && dropdownAnchor.isHover()) {
                return;
            }
            if (toolDropdownPanel.isHover()) {
                return;
            }
            toolDropdown.hide();
        });
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }
}
