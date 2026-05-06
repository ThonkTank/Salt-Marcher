package src.view.slotcontent.main.dungeonmap;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
import src.domain.travel.published.TravelDungeonSnapshot;

public final class DungeonMapContentModel {

    private final String placeholderTitle;
    private final ReadOnlyObjectWrapper<DungeonMapRenderState> renderState;

    public DungeonMapContentModel(String placeholderTitle, boolean editorMode) {
        this.placeholderTitle = normalizePlaceholderTitle(placeholderTitle);
        renderState = new ReadOnlyObjectWrapper<>(DungeonMapRenderState.empty(this.placeholderTitle, editorMode));
    }

    public ReadOnlyObjectProperty<DungeonMapRenderState> renderStateProperty() {
        return renderState.getReadOnlyProperty();
    }

    public void selectViewMode(DungeonMapRenderState.ViewMode nextViewMode) {
        renderState.set(renderState.get().withViewMode(nextViewMode));
    }

    public void selectOverlayMode(DungeonMapRenderState.OverlayMode nextOverlayMode) {
        DungeonMapRenderState current = renderState.get();
        DungeonMapRenderState.LevelOverlaySettings currentSettings = current.overlaySettings();
        renderState.set(current.withOverlaySettings(new DungeonMapRenderState.LevelOverlaySettings(
                nextOverlayMode,
                currentSettings.levelRange(),
                currentSettings.opacity(),
                currentSettings.selectedLevels())));
    }

    public void showOverlaySettings(DungeonMapRenderState.LevelOverlaySettings nextOverlaySettings) {
        renderState.set(renderState.get().withOverlaySettings(nextOverlaySettings));
    }

    public void showProjectionLevel(int nextProjectionLevel) {
        renderState.set(renderState.get().withProjectionLevel(nextProjectionLevel));
    }

    public void showSelectedTool(String nextSelectedTool) {
        renderState.set(renderState.get().withSelectedTool(nextSelectedTool));
    }

    public void applyEditorSnapshot(DungeonEditorSnapshot editorSnapshot) {
        renderState.set(DungeonMapEditorRenderStateMapper.map(placeholderTitle, editorSnapshot));
    }

    public void applyTravelSnapshot(TravelDungeonSnapshot travelSnapshot) {
        renderState.set(DungeonMapTravelRenderStateMapper.map(placeholderTitle, travelSnapshot));
    }

    private static String normalizePlaceholderTitle(String placeholderTitle) {
        return placeholderTitle == null || placeholderTitle.isBlank()
                ? "Dungeon Map"
                : placeholderTitle;
    }
}
