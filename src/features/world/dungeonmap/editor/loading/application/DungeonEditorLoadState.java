package features.world.dungeonmap.editor.loading.application;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.catalog.model.DungeonMap;

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
