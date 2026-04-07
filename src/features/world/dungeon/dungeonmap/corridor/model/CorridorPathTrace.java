package features.world.dungeon.dungeonmap.corridor.model;

import features.world.dungeon.geometry.GridPath;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
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
    }

    public List<GridSegment> segments() {
        List<GridPoint> points = path.points();
        if (points.size() < 2) {
            return List.of();
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
        return List.copyOf(result);
    }

    public GridPoint canonicalPoint() {
        List<GridPoint> points = path.points();
        return points.isEmpty() ? null : points.get(points.size() / 2);
    }

    public List<GridPoint> turnPoints() {
        List<GridSegment> segments = segments();
        if (segments.size() < 2) {
            return List.of();
        }
        java.util.ArrayList<GridPoint> result = new java.util.ArrayList<>();
        for (int index = 1; index < segments.size(); index++) {
            GridSegment previous = segments.get(index - 1);
            GridSegment current = segments.get(index);
            if (previous.orientation() != current.orientation()) {
                result.add(current.start());
            }
        }
        return List.copyOf(result);
    }

    @Override
    public CorridorPathTrace translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        return resolvedTranslation.isZero()
                ? this
                : new CorridorPathTrace(segmentId, startNodeId, endNodeId, path.translated(resolvedTranslation));
    }
}
