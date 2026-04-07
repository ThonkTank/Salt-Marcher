package features.world.dungeonmap.map.corridor.model;

import features.world.dungeonmap.geometry.GridPath;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridSegment;
import features.world.dungeonmap.geometry.GridTranslation;

import java.util.List;

public record CorridorPathTrace(
        Long traceId,
        Long startNodeId,
        Long endNodeId,
        GridPath path
) {
    public CorridorPathTrace {
        path = path == null ? GridPath.empty() : path;
    }

    public static CorridorPathTrace of(
            Long traceId,
            Long startNodeId,
            Long endNodeId,
            List<GridPoint> points
    ) {
        return new CorridorPathTrace(traceId, startNodeId, endNodeId, GridPath.of(points));
    }

    public List<GridPoint> points() {
        return path.points();
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

    public CorridorPathTrace translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        return resolvedTranslation.isZero()
                ? this
                : new CorridorPathTrace(traceId, startNodeId, endNodeId, path.translated(resolvedTranslation));
    }
}
