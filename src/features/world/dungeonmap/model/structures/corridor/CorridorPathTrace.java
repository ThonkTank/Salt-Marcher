package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridSegment;

import java.util.ArrayList;
import java.util.List;

public record CorridorPathTrace(
        Long traceId,
        Long startNodeId,
        Long endNodeId,
        List<GridPoint> path2x
) {
    public CorridorPathTrace {
        path2x = path2x == null ? List.of() : List.copyOf(path2x);
    }

    public List<GridSegment> segments2x() {
        if (path2x.size() < 2) {
            return List.of();
        }
        ArrayList<GridSegment> result = new ArrayList<>();
        for (int index = 1; index < path2x.size(); index++) {
            result.add(new GridSegment(path2x.get(index - 1), path2x.get(index)));
        }
        return List.copyOf(result);
    }

    public List<GridPoint> cornerPoints2x() {
        if (path2x.size() < 3) {
            return List.of();
        }
        ArrayList<GridPoint> result = new ArrayList<>();
        for (int index = 1; index < path2x.size() - 1; index++) {
            GridPoint previous = path2x.get(index - 1);
            GridPoint current = path2x.get(index);
            GridPoint next = path2x.get(index + 1);
            int incomingDx2 = current.x2() - previous.x2();
            int incomingDy2 = current.y2() - previous.y2();
            int outgoingDx2 = next.x2() - current.x2();
            int outgoingDy2 = next.y2() - current.y2();
            if (incomingDx2 != outgoingDx2 || incomingDy2 != outgoingDy2) {
                result.add(current);
            }
        }
        return List.copyOf(result);
    }

    public CorridorPathTrace translatedByCells(GridPoint delta) {
        GridPoint resolvedDelta = delta == null ? new GridPoint(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new CorridorPathTrace(
                traceId,
                startNodeId,
                endNodeId,
                path2x.stream().map(point -> point == null ? null : point.translatedByCells(resolvedDelta)).toList());
    }
}
