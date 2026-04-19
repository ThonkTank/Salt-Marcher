package src.view.tabs.dungeoneditor;

import java.util.Objects;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import src.domain.dungeon.DungeonApplicationService;

public final class DungeonEditorViewModel {

    private final DungeonApplicationService dungeon;
    private final ReadOnlyStringWrapper status = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");

    public DungeonEditorViewModel(DungeonApplicationService dungeon) {
        this.dungeon = Objects.requireNonNull(dungeon, "dungeon");
    }

    public ReadOnlyStringProperty statusProperty() {
        return status.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public void refresh() {
        status.set(String.valueOf(dungeon.loadSnapshot()));
        state.set("Snapshot loaded through DungeonApplicationService.");
    }
}
