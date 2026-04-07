package features.world.dungeonmap.corridor.model;

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
        return path.segments();
    }

    public List<GridPoint> turnPoints() {
        return path.turnPoints();
    }

    public CorridorPathTrace translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        return resolvedTranslation.isZero()
                ? this
                : new CorridorPathTrace(traceId, startNodeId, endNodeId, path.translated(resolvedTranslation));
    }
}
