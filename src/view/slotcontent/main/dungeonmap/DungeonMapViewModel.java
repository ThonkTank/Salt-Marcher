package src.view.slotcontent.main.dungeonmap;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonSnapshot;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel.DragPreview;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel.PaintPreview;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel.PartyToken;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel.Selection;

public final class DungeonMapViewModel {

    private final String placeholderTitle;
    private final boolean editorMode;
    private final ReadOnlyObjectWrapper<DungeonMapDisplayModel> displayModel;
    private @Nullable DungeonSnapshot snapshot;
    private DungeonMapDisplayModel.ViewMode viewMode = DungeonMapDisplayModel.ViewMode.GRID;
    private DungeonMapDisplayModel.LevelOverlaySettings overlaySettings =
            DungeonMapDisplayModel.LevelOverlaySettings.defaults();
    private int projectionLevel;
    private String selectedTool = "Auswahl";
    private @Nullable PartyToken partyToken;
    private @Nullable Selection selection;
    private @Nullable DragPreview dragPreview;
    private @Nullable PaintPreview paintPreview;

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
        overlaySettings = new DungeonMapDisplayModel.LevelOverlaySettings(
                nextOverlayMode,
                overlaySettings.levelRange(),
                overlaySettings.opacity(),
                overlaySettings.selectedLevels());
        rebuildDisplayModel();
    }

    public void showOverlaySettings(DungeonMapDisplayModel.LevelOverlaySettings nextOverlaySettings) {
        overlaySettings = nextOverlaySettings == null
                ? DungeonMapDisplayModel.LevelOverlaySettings.off()
                : nextOverlaySettings;
        rebuildDisplayModel();
    }

    public void showProjectionLevel(int nextProjectionLevel) {
        projectionLevel = nextProjectionLevel;
        rebuildDisplayModel();
    }

    public void showPartyToken(@Nullable PartyToken nextPartyToken) {
        partyToken = nextPartyToken;
        rebuildDisplayModel();
    }

    public void showSelectedTool(String nextSelectedTool) {
        selectedTool = nextSelectedTool == null || nextSelectedTool.isBlank() ? "Auswahl" : nextSelectedTool;
        rebuildDisplayModel();
    }

    public void showSelection(@Nullable Selection nextSelection) {
        selection = nextSelection;
        rebuildDisplayModel();
    }

    public void showDragPreview(@Nullable DragPreview nextDragPreview) {
        dragPreview = nextDragPreview;
        rebuildDisplayModel();
    }

    public void showPaintPreview(@Nullable PaintPreview nextPaintPreview) {
        paintPreview = nextPaintPreview;
        rebuildDisplayModel();
    }

    private void rebuildDisplayModel() {
        displayModel.set(DungeonMapDisplayModel.fromDungeonSnapshot(
                snapshot,
                placeholderTitle,
                editorMode,
                viewMode,
                overlaySettings,
                projectionLevel,
                selectedTool,
                selection,
                dragPreview,
                paintPreview,
                partyToken));
    }
}
