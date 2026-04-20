package src.view.slotcontent.main.dungeonmap;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonSnapshot;

public final class DungeonMapViewModel {

    private final String placeholderTitle;
    private final boolean editorMode;
    private final ReadOnlyObjectWrapper<DungeonMapDisplayModel> displayModel;
    private @Nullable DungeonSnapshot snapshot;
    private DungeonMapDisplayModel.ViewMode viewMode = DungeonMapDisplayModel.ViewMode.GRID;
    private DungeonMapDisplayModel.OverlayMode overlayMode = DungeonMapDisplayModel.OverlayMode.NEARBY;
    private int projectionLevel;
    private String selectedTool = "Auswahl";

    public DungeonMapViewModel(String placeholderTitle, boolean editorMode) {
        this.placeholderTitle = placeholderTitle == null || placeholderTitle.isBlank()
                ? "Dungeon Map"
                : placeholderTitle;
        this.editorMode = editorMode;
        displayModel = new ReadOnlyObjectWrapper<>(DungeonMapDisplayModel.empty(this.placeholderTitle));
    }

    public ReadOnlyObjectProperty<DungeonMapDisplayModel> displayModelProperty() {
        return displayModel.getReadOnlyProperty();
    }

    public void showSnapshot(DungeonSnapshot nextSnapshot) {
        snapshot = nextSnapshot;
        rebuildDisplayModel();
    }

    public void selectViewMode(DungeonMapDisplayModel.ViewMode nextViewMode) {
        viewMode = nextViewMode == null ? DungeonMapDisplayModel.ViewMode.GRID : nextViewMode;
        rebuildDisplayModel();
    }

    public void selectOverlayMode(DungeonMapDisplayModel.OverlayMode nextOverlayMode) {
        overlayMode = nextOverlayMode == null ? DungeonMapDisplayModel.OverlayMode.OFF : nextOverlayMode;
        rebuildDisplayModel();
    }

    public void showProjectionLevel(int nextProjectionLevel) {
        projectionLevel = nextProjectionLevel;
        rebuildDisplayModel();
    }

    public void showSelectedTool(String nextSelectedTool) {
        selectedTool = nextSelectedTool == null || nextSelectedTool.isBlank() ? "Auswahl" : nextSelectedTool;
        rebuildDisplayModel();
    }

    private void rebuildDisplayModel() {
        displayModel.set(DungeonMapDisplayModel.fromDungeonSnapshot(
                snapshot,
                placeholderTitle,
                editorMode,
                viewMode,
                overlayMode,
                projectionLevel,
                selectedTool));
    }
}
