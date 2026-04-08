package features.world.dungeon.shell.interaction;

import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridBoundary;
import features.world.dungeon.geometry.GridPoint;
import javafx.geometry.Point2D;
import javafx.geometry.Rectangle2D;
import java.util.Objects;

public sealed interface DungeonHitSurface permits DungeonHitSurface.CellSurface,
        DungeonHitSurface.SegmentSurface,
        DungeonHitSurface.PointSurface,
        DungeonHitSurface.LabelSurface {

    int levelZ();

    record CellSurface(GridArea area, int levelZ) implements DungeonHitSurface {
        public CellSurface {
            area = area == null ? GridArea.empty() : area;
            if (!area.isEmpty() && (area.levels().size() != 1 || !area.occupiesLevel(levelZ))) {
                throw new IllegalArgumentException("CellSurface area must stay on the declared level");
            }
        }
    }

    record SegmentSurface(GridBoundary boundary, int levelZ) implements DungeonHitSurface {
        public SegmentSurface {
            boundary = boundary == null ? GridBoundary.empty() : boundary;
            if (!boundary.isEmpty() && (boundary.levels().size() != 1 || !boundary.occupiesLevel(levelZ))) {
                throw new IllegalArgumentException("SegmentSurface boundary must stay on the declared level");
            }
        }
    }

    record PointSurface(GridPoint point, int levelZ) implements DungeonHitSurface {
        public PointSurface {
            point = Objects.requireNonNull(point, "point");
            if (point.z() != levelZ) {
                throw new IllegalArgumentException("PointSurface point must stay on the declared level");
            }
        }
    }

    record LabelSurface(Rectangle2D bounds, Point2D anchorPoint, int levelZ) implements DungeonHitSurface {
        public LabelSurface {
            bounds = Objects.requireNonNull(bounds, "bounds");
            anchorPoint = Objects.requireNonNull(anchorPoint, "anchorPoint");
        }
    }
}
