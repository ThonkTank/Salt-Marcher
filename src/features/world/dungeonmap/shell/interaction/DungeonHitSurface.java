package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import javafx.geometry.Point2D;
import javafx.geometry.Rectangle2D;

import java.util.Objects;

public sealed interface DungeonHitSurface permits DungeonHitSurface.TileCellSurface,
        DungeonHitSurface.TileShapeSurface,
        DungeonHitSurface.EdgeSurface,
        DungeonHitSurface.DoubledPointSurface,
        DungeonHitSurface.DoubledEdgeSurface,
        DungeonHitSurface.LabelSurface {

    int levelZ();

    record TileCellSurface(Point2i cell, int levelZ) implements DungeonHitSurface {
        public TileCellSurface {
            cell = Objects.requireNonNull(cell, "cell");
        }
    }

    record TileShapeSurface(TileShape shape, int levelZ) implements DungeonHitSurface {
        public TileShapeSurface {
            shape = Objects.requireNonNull(shape, "shape");
        }
    }

    record EdgeSurface(VertexEdge edge, int levelZ) implements DungeonHitSurface {
        public EdgeSurface {
            edge = Objects.requireNonNull(edge, "edge");
        }
    }

    record DoubledPointSurface(Point2i point, int levelZ) implements DungeonHitSurface {
        public DoubledPointSurface {
            point = Objects.requireNonNull(point, "point");
        }
    }

    record DoubledEdgeSurface(VertexEdge edge, int levelZ) implements DungeonHitSurface {
        public DoubledEdgeSurface {
            edge = Objects.requireNonNull(edge, "edge");
        }
    }

    record LabelSurface(Rectangle2D bounds, Point2D anchorPoint, int levelZ) implements DungeonHitSurface {
        public LabelSurface {
            bounds = Objects.requireNonNull(bounds, "bounds");
            anchorPoint = Objects.requireNonNull(anchorPoint, "anchorPoint");
        }
    }
}
