package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;

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

    record StretchEdge(
            Edge edge,
            DungeonBoundaryKey key,
            @Nullable DungeonClusterBoundary existing
    ) {
        BoundaryKind kind() {
            return existing == null ? BoundaryKind.WALL : existing.kind();
        }
    }

    record StretchSelection(
            int level,
            BoundaryStretchOrientation orientation,
            boolean outer,
            int movement,
            List<StretchEdge> edges,
            Set<DungeonBoundaryKey> sourceKeys,
            RoomClusterBoundaryStretchPlan.Selection coreSelection
    ) {
        StretchSelection {
            Objects.requireNonNull(coreSelection);
            edges = edges == null ? List.of() : List.copyOf(edges);
            sourceKeys = sourceKeys == null
                    ? Set.of()
                    : Collections.unmodifiableSet(new LinkedHashSet<>(sourceKeys));
        }

        static StretchSelection fromCore(
                RoomClusterBoundaryStretchPlan.Selection coreSelection,
                Map<EdgeKey, DungeonClusterBoundary> boundariesByKey
        ) {
            return new StretchSelection(
                    coreSelection.level(),
                    coreSelection.orientation(),
                    coreSelection.outer(),
                    coreSelection.movement(),
                    stretchEdges(coreSelection, boundariesByKey),
                    sourceKeys(coreSelection),
                    coreSelection);
        }

        @Override
        public List<StretchEdge> edges() {
            return Collections.unmodifiableList(new ArrayList<>(edges));
        }

        @Override
        public Set<DungeonBoundaryKey> sourceKeys() {
            return Collections.unmodifiableSet(new LinkedHashSet<>(sourceKeys));
        }

        boolean movesOutward() {
            return coreSelection.movesOutward();
        }

        List<RoomClusterBoundaryStretchPlan.BoundaryVertex> vertices() {
            return coreSelection.vertices();
        }

        List<Edge> connectorPath(RoomClusterBoundaryStretchPlan.BoundaryVertex vertex) {
            return coreSelection.connectorPath(vertex);
        }

        Set<Cell> stripCells() {
            return coreSelection.stripCells();
        }

        private static List<StretchEdge> stretchEdges(
                RoomClusterBoundaryStretchPlan.Selection coreSelection,
                Map<EdgeKey, DungeonClusterBoundary> boundariesByKey
        ) {
            List<StretchEdge> result = new ArrayList<>();
            for (RoomClusterBoundaryStretchPlan.StretchEdge edge : coreSelection.edges()) {
                result.add(new StretchEdge(
                        edge.edge(),
                        boundaryKey(edge.key()),
                        boundariesByKey.get(edge.key())));
            }
            return List.copyOf(result);
        }

        private static Set<DungeonBoundaryKey> sourceKeys(RoomClusterBoundaryStretchPlan.Selection coreSelection) {
            Set<DungeonBoundaryKey> result = new LinkedHashSet<>();
            for (EdgeKey key : coreSelection.sourceKeys()) {
                result.add(boundaryKey(key));
            }
            return result;
        }

        private static DungeonBoundaryKey boundaryKey(EdgeKey key) {
            return new DungeonBoundaryKey(key.lower(), key.upper());
        }
    }

    record StretchMutationResult(
            Map<Integer, List<Cell>> cellsByLevel,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        StretchMutationResult {
            cellsByLevel = copyListsByLevel(cellsByLevel);
            boundariesByLevel = copyListsByLevel(boundariesByLevel);
        }

        @Override
        public Map<Integer, List<Cell>> cellsByLevel() {
            return copyListsByLevel(cellsByLevel);
        }

        @Override
        public Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel() {
            return copyListsByLevel(boundariesByLevel);
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
