package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.DungeonEdgeRules;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.PassageDirection;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class SquarePaintEdgeTransitions {

    private SquarePaintEdgeTransitions() {
    }

    static Set<EdgeRef> touchedEdges(List<DungeonSquarePaint> edits) {
        Set<EdgeRef> result = new LinkedHashSet<>();
        for (DungeonSquarePaint edit : edits) {
            result.add(new EdgeRef(edit.x(), edit.y(), PassageDirection.EAST));
            result.add(new EdgeRef(edit.x() - 1, edit.y(), PassageDirection.EAST));
            result.add(new EdgeRef(edit.x(), edit.y(), PassageDirection.SOUTH));
            result.add(new EdgeRef(edit.x(), edit.y() - 1, PassageDirection.SOUTH));
        }
        return result;
    }

    static boolean becameInternal(TopologyWorkspace workspace, EdgeRef edge) {
        DungeonSquare previousA = workspace.previousSquaresByCoord().get(TopologyWorkspace.coordKey(edge.x(), edge.y()));
        DungeonSquare previousB = workspace.previousSquaresByCoord().get(TopologyWorkspace.coordKey(edge.adjacentX(), edge.adjacentY()));
        DungeonSquare currentA = workspace.currentSquaresByCoord().get(TopologyWorkspace.coordKey(edge.x(), edge.y()));
        DungeonSquare currentB = workspace.currentSquaresByCoord().get(TopologyWorkspace.coordKey(edge.adjacentX(), edge.adjacentY()));
        boolean previousRequiresWall = DungeonEdgeRules.requiresTopologyWall(previousA, previousB);
        boolean currentRequiresWall = DungeonEdgeRules.requiresTopologyWall(currentA, currentB);
        /*
         * Square-paint topology is overlap-driven. If a touched edge became internal because the paint
         * extended or merged rooms, stale persisted boundary walls must not split the component again.
         */
        return previousRequiresWall && !currentRequiresWall;
    }
}
