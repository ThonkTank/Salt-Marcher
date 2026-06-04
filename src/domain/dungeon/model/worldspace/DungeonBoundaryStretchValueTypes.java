package src.domain.dungeon.model.worldspace;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryStretchPlan;

public final class DungeonBoundaryStretchValueTypes {

    private DungeonBoundaryStretchValueTypes() {
    }

    public static @Nullable StretchOrientation orientationOf(@Nullable DungeonBoundaryKey key) {
        return StretchOrientation.from(key);
    }

    public enum StretchOrientation {
        HORIZONTAL,
        VERTICAL;

        public static @Nullable StretchOrientation from(@Nullable DungeonBoundaryKey key) {
            if (key == null) {
                return null;
            }
            return key.lower().q() == key.upper().q() ? VERTICAL : HORIZONTAL;
        }

        public boolean perpendicularTo(@Nullable StretchOrientation other) {
            return other != null && this != other;
        }

        public DungeonEdge move(DungeonEdge edge, int movement) {
            if (this == VERTICAL) {
                return new DungeonEdge(
                        new DungeonCell(edge.from().q() + movement, edge.from().r(), edge.from().level()),
                        new DungeonCell(edge.to().q() + movement, edge.to().r(), edge.to().level()));
            }
            return new DungeonEdge(
                    new DungeonCell(edge.from().q(), edge.from().r() + movement, edge.from().level()),
                    new DungeonCell(edge.to().q(), edge.to().r() + movement, edge.to().level()));
        }
    }

    public record ConnectorAction(boolean removesBoundaries, List<DungeonEdge> path) {

        public ConnectorAction {
            path = path == null ? List.of() : List.copyOf(path);
        }
    }

    public record StretchEdge(
            DungeonEdge edge,
            DungeonBoundaryKey key,
            @Nullable DungeonClusterBoundary existing
    ) {
        public DungeonClusterBoundaryKind kind() {
            return existing == null ? DungeonClusterBoundaryKind.WALL : existing.kind();
        }
    }

    public static final class BoundaryVertex {
        private final int q;
        private final int r;
        private final int level;

        public BoundaryVertex(int q, int r, int level) {
            this.q = q;
            this.r = r;
            this.level = level;
        }

        public int q() {
            return q;
        }

        public int r() {
            return r;
        }

        public int level() {
            return level;
        }
    }

    record StretchSelection(
            int level,
            StretchOrientation orientation,
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
                List<StretchEdge> edges,
                Set<DungeonBoundaryKey> sourceKeys
        ) {
            return new StretchSelection(
                    coreSelection.level(),
                    StretchOrientation.valueOf(coreSelection.orientation().name()),
                    coreSelection.outer(),
                    coreSelection.movement(),
                    edges,
                    sourceKeys,
                    coreSelection);
        }

        @Override
        public List<StretchEdge> edges() {
            return Collections.unmodifiableList(new java.util.ArrayList<>(edges));
        }

        @Override
        public Set<DungeonBoundaryKey> sourceKeys() {
            return Collections.unmodifiableSet(new LinkedHashSet<>(sourceKeys));
        }
    }

    public record StretchMutationResult(
            Map<Integer, List<DungeonCell>> cellsByLevel,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        public StretchMutationResult {
            cellsByLevel = copyListsByLevel(cellsByLevel);
            boundariesByLevel = copyListsByLevel(boundariesByLevel);
        }

        @Override
        public Map<Integer, List<DungeonCell>> cellsByLevel() {
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
