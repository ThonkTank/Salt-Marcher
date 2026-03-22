package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.model.structures.corridor.Corridor;

final class DungeonEditorSelectionLabels {

    private DungeonEditorSelectionLabels() {
    }

    static String corridorLabel(String targetKey) {
        Long corridorId = Corridor.corridorIdFromKey(targetKey);
        return corridorId == null ? "Korridor" : "Korridor " + corridorId;
    }
}
