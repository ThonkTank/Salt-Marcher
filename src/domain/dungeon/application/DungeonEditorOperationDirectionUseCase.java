package src.domain.dungeon.application;

import src.domain.dungeon.model.map.model.DungeonEdgeDirection;

final class DungeonEditorOperationDirectionUseCase {

    private DungeonEditorOperationDirectionUseCase() {
    }

    static DungeonEdgeDirection direction(String direction) {
        return direction == null || direction.isBlank()
                ? DungeonEdgeDirection.NORTH
                : DungeonEdgeDirection.parse(direction);
    }
}
