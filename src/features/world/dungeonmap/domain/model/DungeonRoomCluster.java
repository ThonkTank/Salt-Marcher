package features.world.dungeonmap.domain.model;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record DungeonRoomCluster(
        Long clusterId,
        long mapId,
        Point2i center,
        List<Point2i> relativeVertices,
        List<EdgeOverride> edgeOverrides
) implements DungeonShape {
    public DungeonRoomCluster {
        relativeVertices = relativeVertices == null ? List.of() : List.copyOf(relativeVertices);
        edgeOverrides = canonicalizeEdgeOverrides(edgeOverrides);
    }

    public static List<EdgeOverride> canonicalizeEdgeOverrides(List<EdgeOverride> edgeOverrides) {
        if (edgeOverrides == null || edgeOverrides.isEmpty()) {
            return List.of();
        }
        Map<EdgeKey, EdgeOverride> canonical = new LinkedHashMap<>();
        for (EdgeOverride edgeOverride : edgeOverrides) {
            if (edgeOverride == null || edgeOverride.cell() == null || edgeOverride.direction() == null || edgeOverride.type() == null) {
                continue;
            }
            EdgeOverride normalized = EdgeOverride.of(edgeOverride.cell(), edgeOverride.direction(), edgeOverride.type());
            canonical.put(new EdgeKey(normalized.cell(), normalized.direction()), normalized);
        }
        return List.copyOf(canonical.values());
    }

    public static List<EdgeOverride> sanitizeInternalEdges(
            Point2i clusterCenter,
            Collection<Point2i> clusterCells,
            List<EdgeOverride> edgeOverrides
    ) {
        Set<Point2i> normalizedCells = clusterCells == null ? Set.of() : Set.copyOf(clusterCells);
        return canonicalizeEdgeOverrides(edgeOverrides).stream()
                .filter(edge -> edge.isInternalTo(clusterCenter, normalizedCells))
                .toList();
    }

    private static int compareCells(Point2i left, Point2i right) {
        int yCompare = Integer.compare(left.y(), right.y());
        if (yCompare != 0) {
            return yCompare;
        }
        return Integer.compare(left.x(), right.x());
    }

    public record EdgeOverride(
            Point2i cell,
            EdgeDirection direction,
            EdgeType type
    ) {
        public EdgeOverride {
            if (cell == null || direction == null || type == null) {
                throw new IllegalArgumentException("Cluster-Kanten brauchen Zelle, Richtung und Typ");
            }
        }

        public static EdgeOverride of(Point2i cell, EdgeDirection direction, EdgeType type) {
            Point2i neighbor = cell.add(direction.delta());
            if (compareCells(neighbor, cell) < 0) {
                return new EdgeOverride(neighbor, direction.opposite(), type);
            }
            return new EdgeOverride(cell, direction, type);
        }

        public static EdgeOverride relativeToCluster(
                DungeonRoomCluster cluster,
                Point2i absoluteCell,
                EdgeDirection direction,
                EdgeType type
        ) {
            if (cluster == null) {
                throw new IllegalArgumentException("cluster darf nicht null sein");
            }
            return of(absoluteCell.subtract(cluster.center()), direction, type);
        }

        public EdgeKey key() {
            return new EdgeKey(cell, direction);
        }

        public Point2i absoluteCell(Point2i clusterCenter) {
            return clusterCenter == null ? cell : clusterCenter.add(cell);
        }

        public EdgeOverride translated(Point2i delta) {
            return delta == null ? this : of(cell.add(delta), direction, type);
        }

        public boolean isInternalTo(Point2i clusterCenter, Set<Point2i> clusterCells) {
            Point2i absoluteCell = absoluteCell(clusterCenter);
            return clusterCells.contains(absoluteCell)
                    && clusterCells.contains(absoluteCell.add(direction.delta()));
        }
    }

    public enum EdgeType {
        WALL,
        DOOR
    }

    public enum EdgeDirection {
        NORTH(0, -1),
        EAST(1, 0),
        SOUTH(0, 1),
        WEST(-1, 0);

        private final Point2i delta;

        EdgeDirection(int dx, int dy) {
            this.delta = new Point2i(dx, dy);
        }

        public Point2i delta() {
            return delta;
        }

        public EdgeDirection opposite() {
            return switch (this) {
                case NORTH -> SOUTH;
                case EAST -> WEST;
                case SOUTH -> NORTH;
                case WEST -> EAST;
            };
        }
    }

    public record EdgeKey(Point2i cell, EdgeDirection direction) {
    }
}
