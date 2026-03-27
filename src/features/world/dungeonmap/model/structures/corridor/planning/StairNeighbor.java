package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.StairShape;

import java.util.List;

// Ein möglicher Treppenschritt, den StairExpansion als Dijkstra-Nachbar generiert.
// exitCell ist die Zelle, an der man die Treppe verlässt (am anderen Z-Ende).
// footprint sind ALLE Zellen, die die Treppe belegt (inkl. Entry und Exit).
// cost ist der Gesamtpreis dieses einen Treppenschritts für die Dijkstra-Queue.
record StairNeighbor(
        CubePoint exitCell,
        List<CubePoint> footprint,
        StairShape shape,
        CardinalDirection direction,
        int dimension1,
        int dimension2,
        int minZ,
        int maxZ,
        int entryDirectionIndex,
        int exitDirectionIndex,
        int cost
) {
    StairNeighbor {
        footprint = footprint == null ? List.of() : List.copyOf(footprint);
    }

    Point2i anchor() {
        return footprint.isEmpty() ? exitCell.projectedCell() : footprint.getFirst().projectedCell();
    }
}
