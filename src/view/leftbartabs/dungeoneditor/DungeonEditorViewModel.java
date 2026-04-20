package src.view.leftbartabs.dungeoneditor;

import java.util.Objects;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.LoadDungeonSnapshotQuery;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel;

public final class DungeonEditorViewModel {

    private final DungeonApplicationService dungeon;
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper status = new ReadOnlyStringWrapper("");
    private final ReadOnlyObjectWrapper<DungeonSnapshot> snapshot = new ReadOnlyObjectWrapper<>();
    private final ObjectProperty<DungeonMapDisplayModel.ViewMode> viewMode =
            new SimpleObjectProperty<>(DungeonMapDisplayModel.ViewMode.GRID);
    private final ObjectProperty<DungeonMapDisplayModel.OverlayMode> overlayMode =
            new SimpleObjectProperty<>(DungeonMapDisplayModel.OverlayMode.NEARBY);
    private final IntegerProperty projectionLevel = new SimpleIntegerProperty(0);
    private final StringProperty selectedTool = new SimpleStringProperty("Auswahl");

    public DungeonEditorViewModel(DungeonApplicationService dungeon) {
        this.dungeon = Objects.requireNonNull(dungeon, "dungeon");
        refreshStateText();
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty statusProperty() {
        return status.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<DungeonSnapshot> snapshotProperty() {
        return snapshot.getReadOnlyProperty();
    }

    public ObjectProperty<DungeonMapDisplayModel.ViewMode> viewModeProperty() {
        return viewMode;
    }

    public ObjectProperty<DungeonMapDisplayModel.OverlayMode> overlayModeProperty() {
        return overlayMode;
    }

    public IntegerProperty projectionLevelProperty() {
        return projectionLevel;
    }

    public StringProperty selectedToolProperty() {
        return selectedTool;
    }

    public void selectViewMode(DungeonMapDisplayModel.ViewMode nextViewMode) {
        viewMode.set(nextViewMode == null ? DungeonMapDisplayModel.ViewMode.GRID : nextViewMode);
        refreshStateText();
    }

    public void selectTool(String nextTool) {
        selectedTool.set(nextTool == null || nextTool.isBlank() ? "Auswahl" : nextTool);
        refreshStateText();
    }

    public void selectOverlayMode(DungeonMapDisplayModel.OverlayMode nextOverlayMode) {
        overlayMode.set(nextOverlayMode == null ? DungeonMapDisplayModel.OverlayMode.OFF : nextOverlayMode);
        refreshStateText();
    }

    public void previousLevel() {
        projectionLevel.set(projectionLevel.get() - 1);
        refreshStateText();
    }

    public void nextLevel() {
        projectionLevel.set(projectionLevel.get() + 1);
        refreshStateText();
    }

    public void refresh() {
        DungeonSnapshot loadedSnapshot = dungeon.loadSnapshot(new LoadDungeonSnapshotQuery());
        snapshot.set(loadedSnapshot);
        status.set("Mock-Dungeon geladen: " + loadedSnapshot.mapName());
        refreshStateText();
    }

    private void refreshStateText() {
        state.set("Werkzeug: " + selectedTool.get()
                + "\nAnsicht: " + viewMode.get().label()
                + "\nEbene: z=" + projectionLevel.get()
                + "\n" + overlayMode.get().label()
                + "\nUI-Mock: Interaktionen aktualisieren nur Praesentationszustand.");
    }
}
