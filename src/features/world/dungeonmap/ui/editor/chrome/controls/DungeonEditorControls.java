package features.world.dungeonmap.ui.editor.chrome.controls;

import features.world.dungeonmap.model.domain.DungeonFeatureCategory;
import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.ui.editor.state.DungeonEditorInteractionState;
import features.world.dungeonmap.ui.editor.state.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.state.DungeonPaintMode;
import features.world.dungeonmap.ui.editor.state.WallEditorMode;
import features.world.dungeonmap.ui.shared.map.DungeonEditorToolbar;
import features.world.dungeonmap.ui.shared.map.DungeonMapControlsPane;
import javafx.scene.Node;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;

import java.util.EnumMap;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

public class DungeonEditorControls {
    private final DungeonEditorInteractionState interactionState;
    private final DungeonEditorToolbar toolbar = new DungeonEditorToolbar(new DungeonMapControlsPane());

    private final DungeonToolModeDropdown<DungeonPaintMode> paintModeDropdown = new DungeonToolModeDropdown<>("Malmodus");
    private final DungeonToolModeDropdown<DungeonFeatureCategory> featureCategoryDropdown = new DungeonToolModeDropdown<>("Feature-Art");
    private final DungeonToolModeDropdown<WallEditorMode> wallModeDropdown = new DungeonToolModeDropdown<>("Wandmodus");
    private final EnumMap<DungeonEditorTool, ToggleButton> toolButtons = new EnumMap<>(DungeonEditorTool.class);

    public DungeonEditorControls(DungeonEditorInteractionState interactionState) {
        this.interactionState = Objects.requireNonNull(interactionState, "interactionState");
        paintModeDropdown.setOptions(List.of(
                new DungeonToolModeDropdown.Option<>(DungeonPaintMode.BRUSH, DungeonPaintMode.BRUSH.label()),
                new DungeonToolModeDropdown.Option<>(DungeonPaintMode.SELECTION, DungeonPaintMode.SELECTION.label())));
        featureCategoryDropdown.setOptions(List.of(
                new DungeonToolModeDropdown.Option<>(DungeonFeatureCategory.HAZARD, DungeonFeatureCategory.HAZARD.label()),
                new DungeonToolModeDropdown.Option<>(DungeonFeatureCategory.ENCOUNTER, DungeonFeatureCategory.ENCOUNTER.label()),
                new DungeonToolModeDropdown.Option<>(DungeonFeatureCategory.TREASURE, DungeonFeatureCategory.TREASURE.label()),
                new DungeonToolModeDropdown.Option<>(DungeonFeatureCategory.CURIOSITY, DungeonFeatureCategory.CURIOSITY.label())));
        wallModeDropdown.setOptions(List.of(
                new DungeonToolModeDropdown.Option<>(WallEditorMode.PAINT_WALL, WallEditorMode.PAINT_WALL.label()),
                new DungeonToolModeDropdown.Option<>(WallEditorMode.ERASE_WALL, WallEditorMode.ERASE_WALL.label())));
        ToggleGroup toolGroup = new ToggleGroup();
        ToggleButton selectButton = buildToolButton(DungeonEditorTool.SELECT, toolGroup, true);
        ToggleButton paintButton = buildToolButton(DungeonEditorTool.PAINT, toolGroup, false);
        ToggleButton eraseButton = buildToolButton(DungeonEditorTool.ERASE, toolGroup, false);
        ToggleButton wallButton = buildToolButton(DungeonEditorTool.WALL, toolGroup, false);
        ToggleButton areaButton = buildToolButton(DungeonEditorTool.AREA_ASSIGN, toolGroup, false);
        ToggleButton featureButton = buildToolButton(DungeonEditorTool.FEATURE, toolGroup, false);

        toolGroup.selectedToggleProperty().addListener((obs, oldValue, newValue) -> {
            if (newValue == null && oldValue != null) {
                oldValue.setSelected(true);
            }
        });

        DungeonEditorToolbar.FlowGroup toolsGroup = toolbar.createFlowGroup("Werkzeuge");
        toolsGroup.flow().getChildren().addAll(
                selectButton,
                paintButton,
                eraseButton,
                wallButton,
                areaButton,
                featureButton);
        toolbar.setToolbarGroups(toolsGroup.container());

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

    public Node node() {
        return toolbar;
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

    public void setMaps(List<DungeonMap> maps) {
        toolbar.mapControls().setMaps(maps);
    }

    public void selectMap(Long mapId) {
        toolbar.mapControls().selectMap(mapId);
    }

    public void selectMap(Long mapId, boolean notifyListeners) {
        toolbar.mapControls().selectMap(mapId, notifyListeners);
    }

    public void clearMapSelection() {
        toolbar.mapControls().clearMapSelection();
    }

    public void setOnMapSelected(Consumer<Long> onMapSelected) {
        toolbar.mapControls().setOnMapSelected(onMapSelected);
    }

    public void setOnNewMapRequested(Consumer<Node> onNewMapRequested) {
        toolbar.mapControls().setOnNewMapRequested(onNewMapRequested);
    }

    public void setOnEditMapRequested(Consumer<DungeonMapControlsPane.MapActionRequest> onEditMapRequested) {
        toolbar.mapControls().setOnEditMapRequested(onEditMapRequested);
    }

    private void showToolModeDropdown(DungeonEditorTool tool, ToggleButton button) {
        DungeonEditorTool.ModeDropdownTarget target = tool.modeDropdownTarget();
        if (target == DungeonEditorTool.ModeDropdownTarget.PAINT) {
            featureCategoryDropdown.hide();
            wallModeDropdown.hide();
            paintModeDropdown.show(button, interactionState.paintMode(), interactionState::setPaintMode);
            return;
        }
        if (target == DungeonEditorTool.ModeDropdownTarget.FEATURE_CATEGORY) {
            wallModeDropdown.hide();
            paintModeDropdown.hide();
            featureCategoryDropdown.show(button, interactionState.activeFeatureCategory(), interactionState::setActiveFeatureCategory);
            return;
        }
        if (target == DungeonEditorTool.ModeDropdownTarget.WALL) {
            featureCategoryDropdown.hide();
            paintModeDropdown.hide();
            wallModeDropdown.show(button, interactionState.wallEditorMode(), interactionState::setWallEditorMode);
        }
    }

    private void hideToolModeDropdowns() {
        paintModeDropdown.hide();
        featureCategoryDropdown.hide();
        wallModeDropdown.hide();
    }
}
