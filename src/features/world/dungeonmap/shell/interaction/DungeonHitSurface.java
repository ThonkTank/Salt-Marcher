package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.LegacyGridPoint2x;
import features.world.dungeonmap.model.geometry.LegacyGridSegment2x;
import javafx.geometry.Point2D;
import javafx.geometry.Rectangle2D;

import java.util.Set;
import java.util.Objects;

public sealed interface DungeonHitSurface permits DungeonHitSurface.TileSurface,
        DungeonHitSurface.SegmentSurface,
        DungeonHitSurface.PointSurface,
        DungeonHitSurface.LabelSurface {

    int levelZ();

    record TileSurface(Set<CellCoord> cells, int levelZ) implements DungeonHitSurface {
        public TileSurface {
            cells = cells == null ? Set.of() : Set.copyOf(cells);
        }
    }

    record SegmentSurface(LegacyGridSegment2x segment2x, int levelZ) implements DungeonHitSurface {
        public SegmentSurface {
            segment2x = Objects.requireNonNull(segment2x, "segment2x");
        }
    }

    record PointSurface(LegacyGridPoint2x point2x, int levelZ) implements DungeonHitSurface {
        public PointSurface {
            point2x = Objects.requireNonNull(point2x, "point2x");
        }
    }

    record LabelSurface(Rectangle2D bounds, Point2D anchorPoint, int levelZ) implements DungeonHitSurface {
        public LabelSurface {
            bounds = Objects.requireNonNull(bounds, "bounds");
            anchorPoint = Objects.requireNonNull(anchorPoint, "anchorPoint");
        }
    }
}
