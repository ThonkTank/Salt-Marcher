package features.world.dungeon.dungeonmap.corridor.model;

import features.world.dungeon.geometry.GridPath;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegmentPath;
import features.world.dungeon.geometry.GridTranslatable;
import features.world.dungeon.geometry.GridTranslation;

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
        path.segmentPath();
    }

    public GridSegmentPath segmentPath() {
        return path.segmentPath();
    }

    public GridPoint canonicalPoint() {
        var points = path.points();
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
