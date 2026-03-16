package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonMap;

import java.util.List;

record DungeonEditorLoadState(
        List<DungeonMap> maps,
        Long selectedMapId,
        DungeonLayout layout
) {
    static DungeonEditorLoadState empty(List<DungeonMap> maps) {
        return new DungeonEditorLoadState(List.copyOf(maps), null, null);
    }
}
