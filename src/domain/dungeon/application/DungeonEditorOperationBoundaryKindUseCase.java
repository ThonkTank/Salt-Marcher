package src.domain.dungeon.application;

import src.domain.dungeon.model.map.model.DungeonClusterBoundaryKind;
import src.domain.dungeon.published.DungeonBoundaryKind;

final class DungeonEditorOperationBoundaryKindUseCase {

    private DungeonEditorOperationBoundaryKindUseCase() {
    }

    static DungeonClusterBoundaryKind kind(DungeonBoundaryKind kind) {
        return kind != null && kind.isDoor() ? DungeonClusterBoundaryKind.DOOR : DungeonClusterBoundaryKind.WALL;
    }
}
