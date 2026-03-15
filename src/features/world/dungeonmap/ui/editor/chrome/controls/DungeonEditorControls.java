package features.world.dungeonmap.ui.editor.chrome.controls;

import features.world.dungeonmap.model.domain.DungeonFeatureCategory;
import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.ui.editor.chrome.map.DungeonMapControlsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorInteractionState;
import features.world.dungeonmap.ui.editor.state.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.state.DungeonPaintMode;
import features.world.dungeonmap.ui.editor.state.PassageEditorMode;
import features.world.dungeonmap.ui.editor.state.WallEditorMode;
import javafx.scene.Node;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

import java.util.EnumMap;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

public class DungeonEditorControls extends VBox {
    private final DungeonEditorInteractionState interactionState;
    private final DungeonMapControlsPane mapControls = new DungeonMapControlsPane();
    private final DungeonToolModeDropdown<DungeonPaintMode> paintModeDropdown = new DungeonToolModeDropdown<>("Malmodus");
    private final DungeonToolModeDropdown<DungeonFeatureCategory> featureCategoryDropdown = new DungeonToolModeDropdown<>("Feature-Art");
    private final DungeonToolModeDropdown<WallEditorMode> wallModeDropdown = new DungeonToolModeDropdown<>("Wandmodus");
    private final DungeonToolModeDropdown<PassageEditorMode> passageModeDropdown = new DungeonToolModeDropdown<>("Durchgangsmodus");
    private final EnumMap<DungeonEditorTool, ToggleButton> toolButtons = new EnumMap<>(DungeonEditorTool.class);
    public DungeonEditorControls(DungeonEditorInteractionState interactionState) {
        this.interactionState = Objects.requireNonNull(interactionState, "interactionState");
        getStyleClass().add("map-editor-toolbar");
        getStyleClass().add("dungeon-editor-toolbar");
        setSpacing(8);
        setPadding(new Insets(8, 10, 8, 10));
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
        passageModeDropdown.setOptions(List.of(
                new DungeonToolModeDropdown.Option<>(PassageEditorMode.PLACE_PASSAGE, PassageEditorMode.PLACE_PASSAGE.label()),
                new DungeonToolModeDropdown.Option<>(PassageEditorMode.DELETE_PASSAGE, PassageEditorMode.DELETE_PASSAGE.label())));

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
        getChildren().addAll(mapControls, toolsGroup);

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
        mapControls.setMaps(maps);
    }

    public void selectMap(Long mapId) {
        mapControls.selectMap(mapId);
    }

    public void selectMap(Long mapId, boolean notifyListeners) {
        mapControls.selectMap(mapId, notifyListeners);
    }

    public void setOnMapSelected(Consumer<Long> onMapSelected) {
        mapControls.setOnMapSelected(onMapSelected);
    }

    public void setOnNewMapRequested(Consumer<Node> onNewMapRequested) {
        mapControls.setOnNewMapRequested(onNewMapRequested);
    }

    public void setOnEditMapRequested(Consumer<DungeonMapControlsPane.MapActionRequest> onEditMapRequested) {
        mapControls.setOnEditMapRequested(onEditMapRequested);
    }

    public void setInlineTrailingNode(Node node) {
        mapControls.setInlineTrailingNode(node);
    }

    private void showToolModeDropdown(DungeonEditorTool tool, ToggleButton button) {
        DungeonEditorTool.ModeDropdownTarget target = tool.modeDropdownTarget();
        if (target == DungeonEditorTool.ModeDropdownTarget.PAINT) {
            featureCategoryDropdown.hide();
            passageModeDropdown.hide();
            wallModeDropdown.hide();
            paintModeDropdown.show(button, interactionState.paintMode(), interactionState::setPaintMode);
            return;
        }
        if (target == DungeonEditorTool.ModeDropdownTarget.FEATURE_CATEGORY) {
            passageModeDropdown.hide();
            wallModeDropdown.hide();
            paintModeDropdown.hide();
            featureCategoryDropdown.show(button, interactionState.activeFeatureCategory(), interactionState::setActiveFeatureCategory);
            return;
        }
        if (target == DungeonEditorTool.ModeDropdownTarget.WALL) {
            passageModeDropdown.hide();
            featureCategoryDropdown.hide();
            paintModeDropdown.hide();
            wallModeDropdown.show(button, interactionState.wallEditorMode(), interactionState::setWallEditorMode);
            return;
        }
        if (target == DungeonEditorTool.ModeDropdownTarget.PASSAGE) {
            featureCategoryDropdown.hide();
            paintModeDropdown.hide();
            wallModeDropdown.hide();
            passageModeDropdown.show(button, interactionState.passageEditorMode(), interactionState::setPassageEditorMode);
        }
    }

    private void hideToolModeDropdowns() {
        paintModeDropdown.hide();
        featureCategoryDropdown.hide();
        wallModeDropdown.hide();
        passageModeDropdown.hide();
    }
}
