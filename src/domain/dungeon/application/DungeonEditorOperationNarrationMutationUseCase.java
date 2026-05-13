package src.domain.dungeon.application;

import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonMapTopologyOps;
import src.domain.dungeon.published.DungeonEditorOperation;

final class DungeonEditorOperationNarrationMutationUseCase {

    private DungeonEditorOperationNarrationMutationUseCase() {
    }

    static DungeonMap apply(DungeonMap current, DungeonEditorOperation operation) {
        if (operation instanceof DungeonEditorOperation.SaveRoomNarration save) {
            return DungeonMapTopologyOps.saveRoomNarration(
                    current,
                    save.roomId(),
                    DungeonEditorOperationNarrationUseCase.narration(save));
        }
        return current;
    }
}
