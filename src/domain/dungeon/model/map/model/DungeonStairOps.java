package src.domain.dungeon.model.map.model;

import org.jspecify.annotations.Nullable;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class DungeonStairOps {

    private DungeonStairOps() {
    }

    public static Set<DungeonCell> occupiedCells(DungeonStair stair) {
        if (stair == null) {
            return Set.of();
        }
        Set<DungeonCell> result = new LinkedHashSet<>(stair.path());
        for (DungeonStairExit exit : stair.exits()) {
            result.add(exit.position());
        }
        return Set.copyOf(result);
    }

    public static Set<Integer> reachableLevels(DungeonStair stair) {
        Set<Integer> result = new LinkedHashSet<>();
        for (DungeonCell cell : occupiedCells(stair)) {
            if (cell != null) {
                result.add(cell.level());
            }
        }
        return Set.copyOf(result);
    }

    public static List<DungeonStairExit> exitsAtLevel(DungeonStair stair, int level) {
        if (stair == null) {
            return List.of();
        }
        List<DungeonStairExit> result = new ArrayList<>();
        for (DungeonStairExit exit : stair.exits()) {
            if (exit != null && exit.position().level() == level) {
                result.add(exit);
            }
        }
        return List.copyOf(result);
    }

    public static boolean isReadable(DungeonStair stair) {
        return !occupiedCells(stair).isEmpty();
    }

    public static DungeonStair withCorridorId(DungeonStair stair, @Nullable Long nextCorridorId) {
        if (stair == null) {
            return null;
        }
        return new DungeonStair(
                stair.stairId(),
                stair.mapId(),
                stair.name(),
                new DungeonStair.Geometry(
                        stair.shape(),
                        stair.direction(),
                        stair.dimension1(),
                        stair.dimension2(),
                        stair.path(),
                        stair.exits(),
                        nextCorridorId));
    }
}
