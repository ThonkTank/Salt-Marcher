package src.view.tabs.dungeontravel;

import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonSnapshot;
import src.view.views.DungeonMapDisplayModel;

public final class DungeonTravelViewModel {

    private final DungeonApplicationService dungeon;
    private final ReadOnlyObjectWrapper<DungeonMapDisplayModel> displayModel =
            new ReadOnlyObjectWrapper<>(travelPlaceholder());
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");

    public DungeonTravelViewModel(DungeonApplicationService dungeon) {
        this.dungeon = Objects.requireNonNull(dungeon, "dungeon");
    }

    public ReadOnlyObjectProperty<DungeonMapDisplayModel> displayModelProperty() {
        return displayModel.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public void refresh() {
        displayModel.set(toDisplayModel(dungeon.loadSnapshot()));
        state.set("Travel projection refreshed.");
    }

    private static DungeonMapDisplayModel toDisplayModel(DungeonSnapshot snapshot) {
        return DungeonMapDisplayModel.fromDungeonSnapshot(snapshot, "Travel workspace");
    }

    private static DungeonMapDisplayModel travelPlaceholder() {
        return DungeonMapDisplayModel.empty("Travel workspace");
    }
}
