package src.view.featuretabs.dungeontravel;

import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonSnapshot;

public final class DungeonTravelViewModel {

    private final DungeonApplicationService dungeon;
    private final ReadOnlyObjectWrapper<DungeonSnapshot> snapshot = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");

    public DungeonTravelViewModel(DungeonApplicationService dungeon) {
        this.dungeon = Objects.requireNonNull(dungeon, "dungeon");
    }

    public ReadOnlyObjectProperty<DungeonSnapshot> snapshotProperty() {
        return snapshot.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public void refresh() {
        snapshot.set(dungeon.loadSnapshot());
        state.set("Travel projection refreshed.");
    }
}
