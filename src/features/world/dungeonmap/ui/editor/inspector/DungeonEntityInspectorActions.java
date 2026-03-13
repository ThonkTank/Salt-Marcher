package features.world.dungeonmap.ui.editor.inspector;

import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonRoom;

public interface DungeonEntityInspectorActions {

    void updateRoomMetadata(DungeonRoom room);

    void saveFeature(DungeonFeature feature);
}
