package features.world.dungeonmap.state;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.LinkedHashSet;
import java.util.Set;

public sealed interface EditorPreview permits EditorPreview.LayoutPreview, EditorPreview.PaintPreview, EditorPreview.BoundaryPreview {

    record LayoutPreview(DungeonLayout layout) implements EditorPreview {
    }

    record PaintPreview(Set<CellCoord> cells, int levelZ, boolean deleteMode) implements EditorPreview {
        public PaintPreview {
            cells = cells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(cells));
        }
    }

    record BoundaryPreview(
            Set<GridSegment2x> edges,
            Set<GridSegment2x> skippedConnectionEdges,
            GridPoint2x startVertex2x,
            GridPoint2x currentVertex2x,
            boolean deleteMode
    ) implements EditorPreview {
        public BoundaryPreview {
            edges = edges == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(edges));
            skippedConnectionEdges = skippedConnectionEdges == null
                    ? Set.of()
                    : Set.copyOf(new LinkedHashSet<>(skippedConnectionEdges));
        }
    }
}
