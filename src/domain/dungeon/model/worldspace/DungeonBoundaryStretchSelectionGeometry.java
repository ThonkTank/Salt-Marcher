package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryStretchPlan;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.BoundaryVertex;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.StretchSelection;

final class DungeonBoundaryStretchSelectionGeometry {

    private DungeonBoundaryStretchSelectionGeometry() {
    }

    static boolean movesOutward(StretchSelection stretch) {
        return stretch.coreSelection().movesOutward();
    }

    static List<BoundaryVertex> vertices(StretchSelection stretch) {
        List<BoundaryVertex> result = new ArrayList<>();
        for (RoomClusterBoundaryStretchPlan.BoundaryVertex vertex : stretch.coreSelection().vertices()) {
            result.add(new BoundaryVertex(vertex.q(), vertex.r(), vertex.level()));
        }
        return List.copyOf(result);
    }

    static List<DungeonEdge> connectorPath(StretchSelection stretch, BoundaryVertex vertex) {
        List<DungeonEdge> result = new ArrayList<>();
        for (Edge edge : stretch.coreSelection().connectorPath(
                new RoomClusterBoundaryStretchPlan.BoundaryVertex(vertex.q(), vertex.r(), vertex.level()))) {
            result.add(new DungeonEdge(DungeonCell.fromGeometry(edge.from()), DungeonCell.fromGeometry(edge.to())));
        }
        return List.copyOf(result);
    }

    static Set<DungeonCell> stripCells(StretchSelection stretch) {
        Set<DungeonCell> result = new LinkedHashSet<>();
        for (Cell cell : stretch.coreSelection().stripCells()) {
            result.add(DungeonCell.fromGeometry(cell));
        }
        return Set.copyOf(result);
    }
}
