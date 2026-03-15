package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonCorridor;
import javafx.scene.control.ListCell;

final class DungeonCorridorCell extends ListCell<DungeonCorridor> {
    @Override
    protected void updateItem(DungeonCorridor item, boolean empty) {
        super.updateItem(item, empty);
        setText(empty || item == null ? null : item.fromRoomId() + " -> " + item.toRoomId());
    }
}
