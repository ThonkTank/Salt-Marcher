package features.world.dungeonmap.editor.shell.ui;

import features.world.dungeonmap.editor.shell.ui.controls.MapControls;
import features.world.dungeonmap.editor.shell.ui.controls.ToolControls;
import features.world.dungeonmap.editor.shell.ui.controls.ToolFamilyDropdownController;
import features.world.dungeonmap.editor.shell.ui.controls.ViewModeControls;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonViewMode;
import features.world.dungeonmap.catalog.model.DungeonMap;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.UnaryOperator;

public final class DungeonEditorControls extends VBox {

    public record MapActionRequest(DungeonMap map, Node anchor) {}

    private final ViewModeControls viewModeControls = new ViewModeControls();
    private final MapControls mapControls = new MapControls(viewModeControls, DungeonEditorControls::sectionLabel);
    private final ToolControls toolControls = new ToolControls(
            new ToolFamilyDropdownController(),
            DungeonEditorControls::sectionLabel);

    public DungeonEditorControls() {
        getStyleClass().add("dungeon-editor-toolbar");
        setSpacing(10);
        setPadding(new Insets(12));
        setFillWidth(true);
        setMaxWidth(Double.MAX_VALUE);
        getChildren().addAll(mapControls.content(), toolControls.content());
    }

    public void setMaps(List<DungeonMap> maps) {
        mapControls.setMaps(maps);
    }

    public void selectMap(Long mapId) {
        mapControls.selectMap(mapId);
    }

    public void setOnMapSelected(Consumer<Long> onMapSelected) {
        mapControls.setOnMapSelected(onMapSelected);
    }

    public void setOnNewMapRequested(Consumer<Node> onNewMapRequested) {
        mapControls.setOnNewMapRequested(onNewMapRequested);
    }

    public void setOnEditMapRequested(Consumer<MapActionRequest> onEditMapRequested) {
        mapControls.setOnEditMapRequested(onEditMapRequested);
    }

    public void setOnViewModeChanged(Consumer<DungeonViewMode> onViewModeChanged) {
        viewModeControls.setOnViewModeChanged(onViewModeChanged);
    }

    public void setOnToolChanged(Consumer<DungeonEditorTool> onSelectedToolChanged) {
        toolControls.setOnToolChanged(onSelectedToolChanged);
    }

    public void setPreferredToolResolver(UnaryOperator<DungeonEditorTool> preferredToolResolver) {
        toolControls.setPreferredToolResolver(preferredToolResolver);
    }

    public void selectViewMode(DungeonViewMode viewMode) {
        viewModeControls.selectViewMode(viewMode);
    }

    public void showDisplayedTool(DungeonEditorTool tool) {
        toolControls.showDisplayedTool(tool);
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }
}
