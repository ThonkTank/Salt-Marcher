package src.domain.dungeon.map.service;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.entity.DungeonStair;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonStairExit;

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
        occupiedCells(stair).stream()
                .map(DungeonCell::level)
                .sorted()
                .forEach(result::add);
        return Set.copyOf(result);
    }

    public static List<DungeonStairExit> exitsAtLevel(DungeonStair stair, int level) {
        return stair == null
                ? List.of()
                : stair.exits().stream()
                .filter(exit -> exit.position().level() == level)
                .toList();
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
