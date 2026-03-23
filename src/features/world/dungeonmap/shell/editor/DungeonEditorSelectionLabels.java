package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

final class DungeonEditorSelectionLabels {

    private DungeonEditorSelectionLabels() {
    }

    static String corridorLabel(String targetKey) {
        Long corridorId = Corridor.corridorIdFromKey(targetKey);
        return corridorId == null ? "Korridor" : "Korridor " + corridorId;
    }

    static String stairLabel(String targetKey) {
        Long stairId = DungeonStair.stairIdFromKey(targetKey);
        return stairId == null ? "Treppe" : "Treppe " + stairId;
    }
}
