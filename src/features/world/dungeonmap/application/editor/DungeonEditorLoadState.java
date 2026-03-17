package features.world.dungeonmap.application.editor;

import features.world.dungeonmap.domain.model.DungeonLayout;
import features.world.dungeonmap.domain.model.DungeonMap;

import java.util.List;

public record DungeonEditorLoadState(
        List<DungeonMap> maps,
        Long selectedMapId,
        DungeonLayout layout
) {
    public static DungeonEditorLoadState empty(List<DungeonMap> maps) {
        return new DungeonEditorLoadState(List.copyOf(maps), null, null);
    }
}
