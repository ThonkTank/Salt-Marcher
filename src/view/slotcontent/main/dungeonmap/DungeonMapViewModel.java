package src.view.slotcontent.main.dungeonmap;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.dungeon.published.DungeonSnapshot;

public final class DungeonMapViewModel {

    private final String placeholderTitle;
    private final ReadOnlyObjectWrapper<DungeonMapDisplayModel> displayModel;

    public DungeonMapViewModel(String placeholderTitle) {
        this.placeholderTitle = placeholderTitle == null || placeholderTitle.isBlank()
                ? "Dungeon Map"
                : placeholderTitle;
        displayModel = new ReadOnlyObjectWrapper<>(DungeonMapDisplayModel.empty(this.placeholderTitle));
    }

    public ReadOnlyObjectProperty<DungeonMapDisplayModel> displayModelProperty() {
        return displayModel.getReadOnlyProperty();
    }

    public void showSnapshot(DungeonSnapshot snapshot) {
        displayModel.set(DungeonMapDisplayModel.fromDungeonSnapshot(snapshot, placeholderTitle));
    }
}
