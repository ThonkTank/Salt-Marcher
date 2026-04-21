package src.view.leftbartabs.dungeontravel;

import java.util.Objects;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleObjectProperty;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.LoadDungeonSnapshotQuery;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel;

public final class DungeonTravelViewModel {

    private final DungeonApplicationService dungeon;
    private final ReadOnlyObjectWrapper<DungeonSnapshot> snapshot = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper mapName = new ReadOnlyStringWrapper("Dungeon");
    private final ObjectProperty<DungeonMapDisplayModel.OverlayMode> overlayMode =
            new SimpleObjectProperty<>(DungeonMapDisplayModel.OverlayMode.NEARBY);
    private final IntegerProperty projectionLevel = new SimpleIntegerProperty(0);

    public DungeonTravelViewModel(DungeonApplicationService dungeon) {
        this.dungeon = Objects.requireNonNull(dungeon, "dungeon");
        refreshStateText();
    }

    public ReadOnlyObjectProperty<DungeonSnapshot> snapshotProperty() {
        return snapshot.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty mapNameProperty() {
        return mapName.getReadOnlyProperty();
    }

    public ObjectProperty<DungeonMapDisplayModel.OverlayMode> overlayModeProperty() {
        return overlayMode;
    }

    public IntegerProperty projectionLevelProperty() {
        return projectionLevel;
    }

    public void selectOverlayMode(DungeonMapDisplayModel.OverlayMode nextOverlayMode) {
        updateOverlay(nextOverlayMode);
    }

    public void previousLevel() {
        moveProjectionLevel(-1);
    }

    public void nextLevel() {
        moveProjectionLevel(1);
    }

    public void refresh() {
        DungeonSnapshot loaded = dungeon.loadSnapshot(new LoadDungeonSnapshotQuery());
        snapshot.set(loaded);
        mapName.set(loaded.mapName());
        refreshStateText();
    }

    private void updateOverlay(DungeonMapDisplayModel.OverlayMode nextOverlayMode) {
        DungeonMapDisplayModel.OverlayMode resolved =
                nextOverlayMode == null ? DungeonMapDisplayModel.OverlayMode.OFF : nextOverlayMode;
        overlayMode.set(resolved);
        refreshStateText();
    }

    private void moveProjectionLevel(int delta) {
        projectionLevel.set(projectionLevel.get() + delta);
        refreshStateText();
    }

    private void refreshStateText() {
        state.set("Position: Entry Hall\n"
                + "Tile: x=3 y=3 z=" + projectionLevel.get() + "\n"
                + "Heading: South\n"
                + "Status: Token auf der Karte ziehen\n"
                + overlayMode.get().label());
    }
}
