package features.world.dungeon.dungeonmap.corridor.model;

import features.world.dungeon.geometry.GridPath;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridSegmentPath;
import features.world.dungeon.geometry.GridTranslatable;
import features.world.dungeon.geometry.GridTranslation;

import java.util.List;

public record CorridorPathTrace(
        Long segmentId,
        Long startNodeId,
        Long endNodeId,
        GridPath path
) implements GridTranslatable<CorridorPathTrace> {
    public CorridorPathTrace {
        if (segmentId == null) {
            throw new IllegalArgumentException("Corridor trace segment id is required");
        }
        path = path == null ? GridPath.empty() : path;
        segmentPathFrom(path);
    }

    public GridSegmentPath segmentPath() {
        return segmentPathFrom(path);
    }

    private static GridSegmentPath segmentPathFrom(GridPath path) {
        GridPath resolvedPath = path == null ? GridPath.empty() : path;
        List<GridPoint> points = resolvedPath.points();
        if (points.size() < 2) {
            return GridSegmentPath.empty();
        }
        java.util.ArrayList<GridSegment> result = new java.util.ArrayList<>();
        for (int index = 1; index < points.size(); index++) {
            GridPoint start = points.get(index - 1);
            GridPoint end = points.get(index);
            if (start.z() != end.z()) {
                throw new IllegalStateException("CorridorPathTrace requires same-level points");
            }
            result.add(new GridSegment(start, end));
        }
        return GridSegmentPath.of(result);
    }

    public GridPoint canonicalPoint() {
        List<GridPoint> points = path.points();
        return points.isEmpty() ? null : points.get(points.size() / 2);
    }
    @Override
    public CorridorPathTrace translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        return resolvedTranslation.isZero()
                ? this
                : new CorridorPathTrace(segmentId, startNodeId, endNodeId, path.translated(resolvedTranslation));
    }
}
