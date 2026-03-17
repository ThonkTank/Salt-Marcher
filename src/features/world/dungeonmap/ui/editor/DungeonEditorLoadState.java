package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.ui.workspace.render.DungeonWorkspaceRenderState;

import java.util.List;

record DungeonEditorLoadState(
        List<DungeonMap> maps,
        Long selectedMapId,
        DungeonWorkspaceRenderState renderState
) {
    static DungeonEditorLoadState empty(List<DungeonMap> maps) {
        return new DungeonEditorLoadState(List.copyOf(maps), null, null);
    }
}
