package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonRoom;
import javafx.scene.control.ListCell;

final class DungeonRoomCell extends ListCell<DungeonRoom> {
    @Override
    protected void updateItem(DungeonRoom item, boolean empty) {
        super.updateItem(item, empty);
        setText(empty || item == null ? null : item.name());
    }
}
