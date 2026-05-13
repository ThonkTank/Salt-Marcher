package src.domain.dungeon.application;

import src.domain.dungeon.model.map.model.DungeonEdgeDirection;
import src.domain.dungeon.model.map.model.DungeonRoomExitDescription;
import src.domain.dungeon.model.map.model.DungeonRoomNarration;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonInspectorSnapshot;

final class DungeonEditorOperationNarrationUseCase {

    private DungeonEditorOperationNarrationUseCase() {
    }

    static DungeonRoomNarration narration(DungeonEditorOperation.SaveRoomNarration saveRoomNarration) {
        return new DungeonRoomNarration(
                saveRoomNarration.visualDescription(),
                saveRoomNarration.exits().stream().map(DungeonEditorOperationNarrationUseCase::exit).toList());
    }

    private static DungeonRoomExitDescription exit(DungeonInspectorSnapshot.RoomExitNarration exitNarration) {
        return new DungeonRoomExitDescription(
                DungeonEditorOperationRefsUseCase.cell(exitNarration.cell()),
                DungeonEdgeDirection.parse(exitNarration.direction()),
                exitNarration.description());
    }
}
