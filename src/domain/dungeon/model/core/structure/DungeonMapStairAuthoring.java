package src.domain.dungeon.model.core.structure;

import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.stair.StairMapAuthoring;

final class DungeonMapStairAuthoring {
    private final StairMapAuthoring stairAuthoring = new StairMapAuthoring();

    DungeonMap moveStairAnchor(DungeonMap dungeonMap, long stairId, int handleIndex, int deltaQ, int deltaR, int deltaLevel) {
        return stairAuthoring.moveAnchor(dungeonMap, stairId, handleIndex, deltaQ, deltaR, deltaLevel);
    }

    DungeonMap createStair(
            DungeonMap dungeonMap,
            long stairId,
            Cell anchor,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        var nextStairs = stairAuthoring.withAuthoredStair(
                dungeonMap,
                stairId,
                anchor,
                shapeName,
                directionName,
                dimension1,
                dimension2);
        return nextStairs.equals(dungeonMap.stairs()) ? dungeonMap : dungeonMap.withStairs(nextStairs);
    }

    boolean canCreateStair(
            DungeonMap dungeonMap,
            Cell anchor,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        return stairAuthoring.canCreateAuthoredStair(
                dungeonMap,
                anchor,
                shapeName,
                directionName,
                dimension1,
                dimension2);
    }

    boolean canSaveStairGeometry(
            DungeonMap dungeonMap,
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        return stairAuthoring.canSaveStairGeometry(
                dungeonMap,
                stairId,
                shapeName,
                directionName,
                dimension1,
                dimension2);
    }

    DungeonMap saveStairGeometry(
            DungeonMap dungeonMap,
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        var nextStairs = stairAuthoring.withSavedStairGeometry(
                dungeonMap,
                stairId,
                shapeName,
                directionName,
                dimension1,
                dimension2);
        return nextStairs.equals(dungeonMap.stairs()) ? dungeonMap : dungeonMap.withStairs(nextStairs);
    }
}
