package src.view.tabs.dungeoneditor;

import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonSnapshot;

public final class DungeonEditorViewModel {

    private final DungeonApplicationService dungeon;
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyObjectWrapper<DungeonSnapshot> snapshot = new ReadOnlyObjectWrapper<>();

    public DungeonEditorViewModel(DungeonApplicationService dungeon) {
        this.dungeon = Objects.requireNonNull(dungeon, "dungeon");
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<DungeonSnapshot> snapshotProperty() {
        return snapshot.getReadOnlyProperty();
    }

    public void refresh() {
        DungeonSnapshot loadedSnapshot = dungeon.loadSnapshot();
        snapshot.set(loadedSnapshot);
        state.set("Snapshot loaded through DungeonApplicationService.");
    }
}
