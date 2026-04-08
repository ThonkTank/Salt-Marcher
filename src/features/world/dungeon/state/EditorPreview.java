package features.world.dungeon.state;

import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegmentPath;

public sealed interface EditorPreview permits EditorPreview.LayoutPreview, EditorPreview.PaintPreview, EditorPreview.BoundaryPreview {

    record LayoutPreview(DungeonMap layout) implements EditorPreview {
    }

    record PaintPreview(GridArea area, int levelZ, boolean deleteMode) implements EditorPreview {
        public PaintPreview {
            area = area == null ? GridArea.empty() : area.onLevel(levelZ);
        }
    }

    record BoundaryPreview(
            GridSegmentPath path,
            GridPoint startVertex,
            GridPoint currentVertex,
            boolean deleteMode
    ) implements EditorPreview {
        public BoundaryPreview {
            path = path == null ? GridSegmentPath.empty() : path;
        }
    }
}
