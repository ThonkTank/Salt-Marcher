package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.canvas.base.DungeonViewMode;
import features.world.dungeonmap.loading.DungeonMapCatalogEntry;
import features.world.dungeonmap.shell.editor.controls.MapControls;
import features.world.dungeonmap.shell.editor.controls.ToolControls;
import features.world.dungeonmap.shell.editor.controls.ToolFamilyDropdownController;
import features.world.dungeonmap.shell.editor.controls.ViewModeControls;
import features.world.dungeonmap.state.DungeonLevelOverlayMode;
import features.world.dungeonmap.state.DungeonLevelOverlaySettings;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonEditorControls extends VBox {

    public record MapActionRequest(DungeonMapCatalogEntry map, Node anchor) {}

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

    public void selectViewMode(DungeonViewMode viewMode) {
        viewModeControls.selectViewMode(viewMode);
    }

    public void setOnViewModeChanged(Consumer<DungeonViewMode> onViewModeChanged) {
        viewModeControls.setOnViewModeChanged(onViewModeChanged);
    }

    public void showDisplayedTool(DungeonEditorTool tool) {
        toolControls.showDisplayedTool(tool);
    }

    public void setOnToolChanged(Consumer<DungeonEditorTool> onToolChanged) {
        toolControls.setOnToolChanged(onToolChanged);
    }

    public void setOnMapSelected(Consumer<DungeonMapCatalogEntry> onMapSelected) {
        mapControls.setOnMapSelected(onMapSelected);
    }

    public void setOnNewMapRequested(Consumer<Node> onNewMapRequested) {
        mapControls.setOnNewMapRequested(onNewMapRequested);
    }

    public void setOnEditMapRequested(Consumer<MapActionRequest> onEditMapRequested) {
        mapControls.setOnEditMapRequested(onEditMapRequested);
    }

    public void setOnPreviousLevelRequested(Runnable action) {
        mapControls.setOnPreviousLevelRequested(action);
    }

    public void setOnNextLevelRequested(Runnable action) {
        mapControls.setOnNextLevelRequested(action);
    }

    public void setOnOverlayModeChanged(Consumer<DungeonLevelOverlayMode> action) {
        mapControls.setOnOverlayModeChanged(action);
    }

    public void setOnOverlayRangeChanged(Consumer<Integer> action) {
        mapControls.setOnOverlayRangeChanged(action);
    }

    public void setOnOverlayOpacityChanged(Consumer<Double> action) {
        mapControls.setOnOverlayOpacityChanged(action);
    }

    public void setOnSelectedOverlayLevelsChanged(Consumer<List<Integer>> action) {
        mapControls.setOnSelectedOverlayLevelsChanged(action);
    }

    public void showMaps(List<DungeonMapCatalogEntry> maps, Long activeMapId, boolean loading) {
        mapControls.showMaps(maps, activeMapId, loading);
    }

    public void showLevels(List<Integer> levels, int activeLevel, boolean loading, boolean navigationEnabled) {
        mapControls.showLevels(levels, activeLevel, loading, navigationEnabled);
    }

    public void showOverlaySettings(DungeonLevelOverlaySettings settings, boolean disabled) {
        mapControls.showOverlaySettings(settings, disabled);
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }
}
