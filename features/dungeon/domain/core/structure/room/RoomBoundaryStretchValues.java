package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;

final class RoomBoundaryStretchValues {

    private RoomBoundaryStretchValues() {
    }

    static @Nullable BoundaryStretchOrientation orientationOf(@Nullable DungeonBoundaryKey key) {
        return BoundaryStretchOrientation.from(key);
    }

    record ConnectorAction(boolean removesBoundaries, List<Edge> path) {

        ConnectorAction {
            path = path == null ? List.of() : List.copyOf(path);
        }
    }

    static final class StretchMutationResult {

        private final Map<Integer, List<Cell>> stretchCellsByLevel;
        private final Map<Integer, List<DungeonClusterBoundary>> stretchBoundariesByLevel;

        StretchMutationResult(
                Map<Integer, List<Cell>> cellsByLevel,
                Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
        ) {
            this.stretchCellsByLevel = copyListsByLevel(cellsByLevel);
            this.stretchBoundariesByLevel = copyListsByLevel(boundariesByLevel);
        }

        Map<Integer, List<Cell>> cellsByLevel() {
            return stretchCellsByLevel;
        }

        Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel() {
            return stretchBoundariesByLevel;
        }

        private static <T> Map<Integer, List<T>> copyListsByLevel(Map<Integer, List<T>> source) {
            Map<Integer, List<T>> result = new LinkedHashMap<>();
            for (Map.Entry<Integer, List<T>> entry
                    : (source == null ? Map.<Integer, List<T>>of() : source).entrySet()) {
                result.put(entry.getKey(), entry.getValue() == null ? List.of() : List.copyOf(entry.getValue()));
            }
            return Map.copyOf(result);
        }
    }
}
