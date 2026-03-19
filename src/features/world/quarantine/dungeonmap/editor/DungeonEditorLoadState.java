package features.world.quarantine.dungeonmap.editor.quarantine.loading;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.catalog.model.DungeonMap;

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
