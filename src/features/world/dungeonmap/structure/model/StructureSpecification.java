package features.world.dungeonmap.structure.model;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeonmap.structure.model.boundary.wall.Wall;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Canonical full-structure creation payload.
 *
 * <p>All public structure creation workflows must reduce to this explicit runtime-shaped specification so callers do
 * not keep competing builder seams alive.</p>
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
            Set<GridPoint> surfaceCells,
            Set<GridPoint> floorCells,
            List<Door> doors,
            List<Wall> walls
    ) {
        public LevelSpecification {
            surfaceCells = normalizedCells(surfaceCells);
            floorCells = normalizedCells(floorCells);
            doors = doors == null ? List.of() : List.copyOf(doors.stream().filter(java.util.Objects::nonNull).toList());
            walls = walls == null ? List.of() : List.copyOf(walls.stream().filter(java.util.Objects::nonNull).toList());
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
                    normalizedCells(surfaceCells),
                    normalizedCells(floorCells),
                    doors == null ? List.of() : List.copyOf(doors.stream().filter(java.util.Objects::nonNull).toList()),
                    walls == null ? List.of() : List.copyOf(walls.stream().filter(java.util.Objects::nonNull).toList()));
        }

        public boolean isEmpty() {
            return surfaceCells.isEmpty();
        }

        private static Set<GridPoint> normalizedCells(Collection<GridPoint> cells) {
            if (cells == null || cells.isEmpty()) {
                return Set.of();
            }
            LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
            for (GridPoint cell : cells) {
                if (cell != null) {
                    result.add(cell);
                }
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }
    }
}
