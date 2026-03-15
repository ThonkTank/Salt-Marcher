package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonMap;
import javafx.scene.control.ListCell;

public final class DungeonMapCell extends ListCell<DungeonMap> {
    @Override
    protected void updateItem(DungeonMap item, boolean empty) {
        super.updateItem(item, empty);
        setText(empty || item == null ? null : item.name());
    }
}
