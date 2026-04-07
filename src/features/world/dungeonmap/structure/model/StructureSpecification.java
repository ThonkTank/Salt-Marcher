package features.world.dungeonmap.structure.model;

import features.world.dungeonmap.geometry.GridArea;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeonmap.structure.model.boundary.wall.Wall;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Canonical full-structure creation payload.
 */
public record StructureSpecification(Map<Integer, LevelSpecification> levelsByZ) {

    public StructureSpecification {
        if (levelsByZ == null || levelsByZ.isEmpty()) {
            levelsByZ = Map.of();
        } else {
            Map<Integer, LevelSpecification> normalized = new LinkedHashMap<>();
            levelsByZ.entrySet().stream()
                    .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null && !entry.getValue().isEmpty())
                    .sorted(Map.Entry.comparingByKey())
                    .forEach(entry -> normalized.put(entry.getKey(), entry.getValue()));
            levelsByZ = normalized.isEmpty() ? Map.of() : Map.copyOf(normalized);
        }
    }

    public static StructureSpecification empty() {
        return new StructureSpecification(Map.of());
    }

    public static StructureSpecification ofLevel(int levelZ, LevelSpecification level) {
        return level == null || level.isEmpty()
                ? empty()
                : new StructureSpecification(Map.of(levelZ, level));
    }

    public boolean isEmpty() {
        return levelsByZ.isEmpty();
    }

    public record LevelSpecification(
            GridPoint anchorCell,
            GridArea surfaceArea,
            GridArea floorArea,
            List<Door> doors,
            List<Wall> walls
    ) {
        public LevelSpecification {
            surfaceArea = surfaceArea == null ? GridArea.empty() : surfaceArea;
            floorArea = floorArea == null ? GridArea.empty() : floorArea.intersection(surfaceArea);
            doors = normalizeObjects(doors);
            walls = normalizeObjects(walls);
        }

        public static LevelSpecification of(
                GridPoint anchorCell,
                Collection<GridPoint> surfaceCells,
                Collection<GridPoint> floorCells,
                Collection<Door> doors,
                Collection<Wall> walls
        ) {
            return new LevelSpecification(
                    anchorCell,
                    GridArea.of(surfaceCells),
                    GridArea.of(floorCells),
                    normalizeObjects(doors),
                    normalizeObjects(walls));
        }

        public boolean isEmpty() {
            return surfaceArea.isEmpty();
        }

        private static <T> List<T> normalizeObjects(Collection<T> objects) {
            if (objects == null || objects.isEmpty()) {
                return List.of();
            }
            return objects.stream().filter(Objects::nonNull).toList();
        }
    }
}
