package features.dungeon.domain.core.structure;

import features.dungeon.domain.core.structure.stair.StairGeometrySpec;
import features.dungeon.domain.core.structure.stair.StairMapAuthoring;

final class DungeonMapStairAuthoring {
    private final StairMapAuthoring stairAuthoring = new StairMapAuthoring();

    DungeonMap moveStairAnchor(DungeonMap dungeonMap, long stairId, int handleIndex, int deltaQ, int deltaR, int deltaLevel) {
        return stairAuthoring.moveAnchor(dungeonMap, stairId, handleIndex, deltaQ, deltaR, deltaLevel);
    }

    boolean canCreateStair(
            DungeonMap dungeonMap,
            StairGeometrySpec spec
    ) {
        return stairAuthoring.canCreateAuthoredStair(dungeonMap, spec);
    }

    boolean canSaveStairGeometry(
            DungeonMap dungeonMap,
            long stairId,
            StairGeometrySpec spec
    ) {
        return stairAuthoring.canSaveStairGeometry(
                dungeonMap,
                stairId,
                spec);
    }

}
