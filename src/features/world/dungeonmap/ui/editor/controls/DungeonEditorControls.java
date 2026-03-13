package features.world.dungeonmap.ui.editor.controls;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.ui.editor.state.DungeonEditorInteractionState;
import javafx.scene.Node;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

import java.util.EnumMap;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

public class DungeonEditorControls extends VBox {
    public record MapActionRequest(DungeonMap map, Node anchor) {}

    private final DungeonEditorInteractionState interactionState;
    private final ComboBox<DungeonMap> mapCombo = new ComboBox<>();
    private final DungeonToolModeDropdown<DungeonPaintMode> paintModeDropdown = new DungeonToolModeDropdown<>("Malmodus");
    private final DungeonToolModeDropdown<WallEditorMode> wallModeDropdown = new DungeonToolModeDropdown<>("Wandmodus");
    private final DungeonToolModeDropdown<PassageEditorMode> passageModeDropdown = new DungeonToolModeDropdown<>("Durchgangsmodus");
    private final EnumMap<DungeonEditorTool, ToggleButton> toolButtons = new EnumMap<>(DungeonEditorTool.class);
    private boolean updatingMapCombo = false;

    private Consumer<Long> onMapSelected;
    private Consumer<Node> onNewMapRequested;
    private Consumer<MapActionRequest> onEditMapRequested;

    public DungeonEditorControls(DungeonEditorInteractionState interactionState) {
        this.interactionState = Objects.requireNonNull(interactionState, "interactionState");
        getStyleClass().add("map-editor-toolbar");
        getStyleClass().add("dungeon-editor-toolbar");
        setSpacing(8);
        setPadding(new Insets(8, 10, 8, 10));
        paintModeDropdown.setOptions(List.of(
                new DungeonToolModeDropdown.Option<>(DungeonPaintMode.BRUSH, "Pinsel"),
                new DungeonToolModeDropdown.Option<>(DungeonPaintMode.SELECTION, "Auswahl")));
        wallModeDropdown.setOptions(List.of(
                new DungeonToolModeDropdown.Option<>(WallEditorMode.PAINT_WALL, WallEditorMode.PAINT_WALL.label()),
                new DungeonToolModeDropdown.Option<>(WallEditorMode.ERASE_WALL, WallEditorMode.ERASE_WALL.label())));
        passageModeDropdown.setOptions(List.of(
                new DungeonToolModeDropdown.Option<>(PassageEditorMode.PLACE_PASSAGE, PassageEditorMode.PLACE_PASSAGE.label()),
                new DungeonToolModeDropdown.Option<>(PassageEditorMode.DELETE_PASSAGE, PassageEditorMode.DELETE_PASSAGE.label())));

        mapCombo.setPrefWidth(180);
        mapCombo.setMaxWidth(Double.MAX_VALUE);
        mapCombo.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonMap map) {
                return map == null ? "" : map.name();
            }

            @Override
            public DungeonMap fromString(String string) {
                return null;
            }
        });
        mapCombo.setPromptText("Dungeon wählen…");
        mapCombo.setOnAction(event -> {
            if (!updatingMapCombo && onMapSelected != null && mapCombo.getValue() != null) {
                onMapSelected.accept(mapCombo.getValue().mapId());
            }
        });

        Button newMapButton = new Button("Neu");
        newMapButton.getStyleClass().addAll("button", "compact");
        newMapButton.setTooltip(new Tooltip("Neuen Dungeon anlegen"));
        newMapButton.setAccessibleText("Neuen Dungeon anlegen");
        newMapButton.setOnAction(event -> {
            if (onNewMapRequested != null) {
                onNewMapRequested.accept(newMapButton);
            }
        });

        Button editMapButton = new Button("Bearbeiten");
        editMapButton.getStyleClass().addAll("button", "compact");
        editMapButton.setTooltip(new Tooltip("Dungeon bearbeiten"));
        editMapButton.setAccessibleText("Ausgewählten Dungeon bearbeiten");
        editMapButton.setOnAction(event -> {
            if (onEditMapRequested != null && mapCombo.getValue() != null) {
                onEditMapRequested.accept(new MapActionRequest(mapCombo.getValue(), editMapButton));
            }
        });
        editMapButton.disableProperty().bind(mapCombo.valueProperty().isNull());

        ToggleGroup toolGroup = new ToggleGroup();
        ToggleButton selectButton = buildToolButton(DungeonEditorTool.SELECT, toolGroup, true);
        ToggleButton paintButton = buildToolButton(DungeonEditorTool.PAINT, toolGroup, false);
        ToggleButton eraseButton = buildToolButton(DungeonEditorTool.ERASE, toolGroup, false);
        ToggleButton wallButton = buildToolButton(DungeonEditorTool.WALL, toolGroup, false);
        ToggleButton passageButton = buildToolButton(DungeonEditorTool.PASSAGE, toolGroup, false);
        ToggleButton areaButton = buildToolButton(DungeonEditorTool.AREA_ASSIGN, toolGroup, false);
        ToggleButton featureButton = buildToolButton(DungeonEditorTool.FEATURE, toolGroup, false);
        ToggleButton endpointButton = buildToolButton(DungeonEditorTool.ENDPOINT, toolGroup, false);
        ToggleButton linkButton = buildToolButton(DungeonEditorTool.LINK, toolGroup, false);

        toolGroup.selectedToggleProperty().addListener((obs, oldValue, newValue) -> {
            if (newValue == null && oldValue != null) {
                oldValue.setSelected(true);
            }
        });

        Label mapLabel = sectionLabel("Dungeon");
        HBox mapRow = new HBox(8, mapCombo, newMapButton, editMapButton);
        mapRow.setAlignment(Pos.CENTER_LEFT);
        HBox.setHgrow(mapCombo, javafx.scene.layout.Priority.ALWAYS);
        mapRow.getStyleClass().add("editor-action-row");

        VBox mapGroup = new VBox(6, mapLabel, mapRow);
        mapGroup.getStyleClass().add("editor-toolbar-group");
        HBox.setHgrow(mapGroup, javafx.scene.layout.Priority.ALWAYS);

        Label toolsLabel = sectionLabel("Werkzeuge");
        FlowPane toolRow = new FlowPane();
        toolRow.setHgap(6);
        toolRow.setVgap(6);
        toolRow.getStyleClass().add("editor-tool-flow");
        toolRow.getChildren().addAll(
                selectButton,
                paintButton,
                eraseButton,
                wallButton,
                passageButton,
                areaButton,
                featureButton,
                endpointButton,
                linkButton);
        VBox toolsGroup = new VBox(6, toolsLabel, toolRow);
        toolsGroup.getStyleClass().add("editor-toolbar-group");
        getChildren().addAll(mapGroup, toolsGroup);

        this.interactionState.onActiveToolChanged(tool -> {
            ToggleButton button = toolButtons.get(tool);
            if (button != null && !button.isSelected()) {
                button.setSelected(true);
            }
            if (tool.modeDropdownTarget() == DungeonEditorTool.ModeDropdownTarget.NONE) {
                hideToolModeDropdowns();
            }
        });
    }

    private ToggleButton buildToolButton(DungeonEditorTool tool, ToggleGroup group, boolean selected) {
        ToggleButton button = new ToggleButton(tool.toolbarLabel());
        button.getStyleClass().add("tool-btn");
        button.setToggleGroup(group);
        button.setUserData(tool);
        button.setSelected(selected);
        toolButtons.put(tool, button);
        button.setOnAction(event -> {
            if (!button.isSelected()) {
                return;
            }
            interactionState.setActiveTool(tool);
            if (tool.modeDropdownTarget() == DungeonEditorTool.ModeDropdownTarget.NONE) {
                hideToolModeDropdowns();
                return;
            }
            showToolModeDropdown(tool, button);
        });
        return button;
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    public void setMaps(List<DungeonMap> maps) {
        updatingMapCombo = true;
        DungeonMap previous = mapCombo.getValue();
        mapCombo.getItems().setAll(maps);
        DungeonMap restored = null;
        if (previous != null) {
            for (DungeonMap map : maps) {
                if (map.mapId().equals(previous.mapId())) {
                    restored = map;
                    break;
                }
            }
        }
        mapCombo.setValue(restored);
        updatingMapCombo = false;
    }

    public void selectMap(Long mapId) {
        if (mapId == null) {
            return;
        }
        for (DungeonMap map : mapCombo.getItems()) {
            if (mapId.equals(map.mapId())) {
                mapCombo.setValue(map);
                return;
            }
        }
    }

    public void setOnMapSelected(Consumer<Long> onMapSelected) {
        this.onMapSelected = onMapSelected;
    }

    public void setOnNewMapRequested(Consumer<Node> onNewMapRequested) {
        this.onNewMapRequested = onNewMapRequested;
    }

    public void setOnEditMapRequested(Consumer<MapActionRequest> onEditMapRequested) {
        this.onEditMapRequested = onEditMapRequested;
    }

    private void showToolModeDropdown(DungeonEditorTool tool, ToggleButton button) {
        DungeonEditorTool.ModeDropdownTarget target = tool.modeDropdownTarget();
        if (target == DungeonEditorTool.ModeDropdownTarget.PAINT) {
            passageModeDropdown.hide();
            wallModeDropdown.hide();
            paintModeDropdown.show(button, interactionState.paintMode(), interactionState::setPaintMode);
            return;
        }
        if (target == DungeonEditorTool.ModeDropdownTarget.WALL) {
            passageModeDropdown.hide();
            paintModeDropdown.hide();
            wallModeDropdown.show(button, interactionState.wallEditorMode(), interactionState::setWallEditorMode);
            return;
        }
        if (target == DungeonEditorTool.ModeDropdownTarget.PASSAGE) {
            paintModeDropdown.hide();
            wallModeDropdown.hide();
            passageModeDropdown.show(button, interactionState.passageEditorMode(), interactionState::setPassageEditorMode);
        }
    }

    private void hideToolModeDropdowns() {
        paintModeDropdown.hide();
        wallModeDropdown.hide();
        passageModeDropdown.hide();
    }
}
