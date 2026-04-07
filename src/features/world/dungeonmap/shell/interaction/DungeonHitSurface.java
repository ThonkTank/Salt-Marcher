package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridSegment;
import javafx.geometry.Point2D;
import javafx.geometry.Rectangle2D;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.Objects;

public sealed interface DungeonHitSurface permits DungeonHitSurface.CellSurface,
        DungeonHitSurface.SegmentSurface,
        DungeonHitSurface.PointSurface,
        DungeonHitSurface.LabelSurface {

    int levelZ();

    record CellSurface(Set<GridPoint> cells, int levelZ) implements DungeonHitSurface {
        public CellSurface {
            cells = normalizedMembers(cells);
        }
    }

    record SegmentSurface(Set<GridSegment> segments, int levelZ) implements DungeonHitSurface {
        public SegmentSurface {
            segments = normalizedMembers(segments);
        }
    }

    record PointSurface(Set<GridPoint> points, int levelZ) implements DungeonHitSurface {
        public PointSurface {
            points = normalizedMembers(points);
        }
    }

    record LabelSurface(Rectangle2D bounds, Point2D anchorPoint, int levelZ) implements DungeonHitSurface {
        public LabelSurface {
            bounds = Objects.requireNonNull(bounds, "bounds");
            anchorPoint = Objects.requireNonNull(anchorPoint, "anchorPoint");
        }
    }

    private static <T> Set<T> normalizedMembers(Collection<T> members) {
        if (members == null || members.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<T> result = new LinkedHashSet<>();
        for (T member : members) {
            if (member != null) {
                result.add(member);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
