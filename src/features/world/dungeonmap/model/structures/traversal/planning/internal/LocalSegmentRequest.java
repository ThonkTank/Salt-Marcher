package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

record LocalSegmentRequest(
        LocalTerminal source,
        LocalTerminal target,
        Set<CubePoint> obstacles
) {
    LocalSegmentRequest {
        Objects.requireNonNull(source, "source");
        Objects.requireNonNull(target, "target");
        obstacles = normalizePoints(obstacles);
    }

    sealed interface LocalTerminal permits RoomPortalTerminal, FixedCellsTerminal {
        Set<CubePoint> boundsPoints();
    }

    record RoomPortalTerminal(
            TraversalNode portal
    ) implements LocalTerminal {
        RoomPortalTerminal {
            Objects.requireNonNull(portal, "portal");
        }

        @Override
        public Set<CubePoint> boundsPoints() {
            if (portal.occupiedCells().isEmpty()) {
                return Set.of(portal.anchor());
            }
            return portal.occupiedCells();
        }
    }

    record FixedCellsTerminal(
            Set<CubePoint> cells
    ) implements LocalTerminal {
        FixedCellsTerminal {
            cells = normalizePoints(cells);
        }

        static FixedCellsTerminal of(Collection<CubePoint> cells) {
            return new FixedCellsTerminal(cells == null ? Set.of() : Set.copyOf(cells));
        }

        @Override
        public Set<CubePoint> boundsPoints() {
            return cells;
        }
    }

    private static Set<CubePoint> normalizePoints(Collection<CubePoint> points) {
        if (points == null || points.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (CubePoint point : points) {
            if (point != null) {
                result.add(point);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
