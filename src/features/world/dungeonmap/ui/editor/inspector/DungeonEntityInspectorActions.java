package features.world.dungeonmap.ui.editor.inspector;

import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonRoom;

public interface DungeonEntityInspectorActions {

    void updateRoomMetadata(DungeonRoom room);

    void saveFeature(DungeonFeature feature);
}
