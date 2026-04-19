package src.view.tabs.dungeontravel;

import java.util.Objects;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import src.domain.dungeon.DungeonApplicationService;

public final class DungeonTravelViewModel {

    private final DungeonApplicationService dungeon;
    private final StringProperty status = new SimpleStringProperty("");
    private final StringProperty state = new SimpleStringProperty("");

    public DungeonTravelViewModel(DungeonApplicationService dungeon) {
        this.dungeon = Objects.requireNonNull(dungeon, "dungeon");
    }

    public ReadOnlyStringProperty statusProperty() {
        return status;
    }

    public ReadOnlyStringProperty stateProperty() {
        return state;
    }

    public void refresh() {
        status.set(String.valueOf(dungeon.loadSnapshot()));
        state.set("Travel projection refreshed.");
    }
}
