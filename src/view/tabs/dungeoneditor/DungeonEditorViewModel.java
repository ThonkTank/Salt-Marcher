package src.view.tabs.dungeoneditor;

import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonSnapshot;
import src.view.views.DungeonMapDisplayModel;

public final class DungeonEditorViewModel {

    private final DungeonApplicationService dungeon;
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyObjectWrapper<DungeonMapDisplayModel> displayModel =
            new ReadOnlyObjectWrapper<>(editorPlaceholder());

    public DungeonEditorViewModel(DungeonApplicationService dungeon) {
        this.dungeon = Objects.requireNonNull(dungeon, "dungeon");
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<DungeonMapDisplayModel> displayModelProperty() {
        return displayModel.getReadOnlyProperty();
    }

    public void refresh() {
        DungeonSnapshot loadedSnapshot = dungeon.loadSnapshot();
        displayModel.set(toDisplayModel(loadedSnapshot));
        state.set("Snapshot loaded through DungeonApplicationService.");
    }

    private static DungeonMapDisplayModel toDisplayModel(DungeonSnapshot snapshot) {
        return DungeonMapDisplayModel.fromDungeonSnapshot(snapshot, "Dungeon workspace");
    }

    private static DungeonMapDisplayModel editorPlaceholder() {
        return DungeonMapDisplayModel.empty("Dungeon workspace");
    }
}
