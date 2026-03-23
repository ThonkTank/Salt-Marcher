package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

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

    static String transitionLabel(String targetKey) {
        Long transitionId = DungeonTransition.transitionIdFromKey(targetKey);
        return transitionId == null ? "Übergang" : "Übergang " + transitionId;
    }
}
