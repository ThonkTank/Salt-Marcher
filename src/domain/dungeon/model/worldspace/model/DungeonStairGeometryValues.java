package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;

final class DungeonStairGeometryValues {
    private DungeonStairGeometryValues() {
    }

    static @Nullable Long positiveCorridorId(@Nullable Long corridorId) {
        if (corridorId == null || corridorId <= 0L) {
            return null;
        }
        return corridorId;
    }

    static List<DungeonCell> sortedUniquePath(List<DungeonCell> source) {
        return DungeonCellOrdering.sortedCells(source);
    }

    static List<DungeonStairExit> sortedExits(List<DungeonStairExit> source) {
        List<DungeonStairExit> result = new ArrayList<>();
        for (DungeonStairExit exit : source == null ? List.<DungeonStairExit>of() : source) {
            if (exit != null) {
                result.add(exit);
            }
        }
        result.sort(DungeonStairGeometryValues::compareStairExits);
        return List.copyOf(result);
    }

    private static int compareStairExits(DungeonStairExit left, DungeonStairExit right) {
        int levelComparison = Integer.compare(left.position().level(), right.position().level());
        if (levelComparison != 0) {
            return levelComparison;
        }
        int rowComparison = Integer.compare(left.position().r(), right.position().r());
        if (rowComparison != 0) {
            return rowComparison;
        }
        int columnComparison = Integer.compare(left.position().q(), right.position().q());
        if (columnComparison != 0) {
            return columnComparison;
        }
        return Long.compare(left.exitId(), right.exitId());
    }
}
