package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.DungeonEdgeRules;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.model.PassageDirection;
import features.world.dungeonmap.repository.DungeonWallRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class BoundaryWallReconciler {

    private BoundaryWallReconciler() {
    }

    static void ensureBoundaryWallsForSquarePaint(
            Connection conn,
            long mapId,
            TopologyIntent intent,
            TopologyWorkspace workspace
    ) throws SQLException {
        if (intent.squareEdits().isEmpty()) {
            return;
        }

        List<DungeonWallEdit> wallEdits = new ArrayList<>();
        for (EdgeRef edge : touchedEdges(intent.squareEdits())) {
            DungeonSquare currentA = workspace.currentSquaresByCoord().get(TopologyWorkspace.coordKey(edge.x(), edge.y()));
            DungeonSquare currentB = workspace.currentSquaresByCoord().get(TopologyWorkspace.coordKey(edge.adjacentX(), edge.adjacentY()));
            if (DungeonEdgeRules.requiresTopologyWall(currentA, currentB)) {
                wallEdits.add(new DungeonWallEdit(edge.x(), edge.y(), edge.direction(), true));
            }
        }

        applyWallEdits(conn, mapId, workspace, wallEdits);
    }

    static void removeInternalWallsForSquarePaint(
            Connection conn,
            long mapId,
            TopologyIntent intent,
            TopologyWorkspace workspace
    ) throws SQLException {
        if (intent.squareEdits().isEmpty()) {
            return;
        }

        List<DungeonWallEdit> wallEdits = new ArrayList<>();
        for (EdgeRef edge : touchedEdges(intent.squareEdits())) {
            DungeonSquare currentA = workspace.currentSquaresByCoord().get(TopologyWorkspace.coordKey(edge.x(), edge.y()));
            DungeonSquare currentB = workspace.currentSquaresByCoord().get(TopologyWorkspace.coordKey(edge.adjacentX(), edge.adjacentY()));
            boolean currentRequiresWall = DungeonEdgeRules.requiresTopologyWall(currentA, currentB);
            boolean previousRequiresWall = requiredTopologyWall(workspace.previousSquaresByCoord(), edge);
            if (previousRequiresWall && !currentRequiresWall) {
                wallEdits.add(new DungeonWallEdit(edge.x(), edge.y(), edge.direction(), false));
            }
        }

        applyWallEdits(conn, mapId, workspace, wallEdits);
    }

    private static Set<EdgeRef> touchedEdges(List<DungeonSquarePaint> edits) {
        Set<EdgeRef> result = new LinkedHashSet<>();
        for (DungeonSquarePaint edit : edits) {
            result.add(new EdgeRef(edit.x(), edit.y(), PassageDirection.EAST));
            result.add(new EdgeRef(edit.x() - 1, edit.y(), PassageDirection.EAST));
            result.add(new EdgeRef(edit.x(), edit.y(), PassageDirection.SOUTH));
            result.add(new EdgeRef(edit.x(), edit.y() - 1, PassageDirection.SOUTH));
        }
        return result;
    }

    private static boolean requiredTopologyWall(Map<String, DungeonSquare> squaresByCoord, EdgeRef edge) {
        DungeonSquare sideA = squaresByCoord.get(TopologyWorkspace.coordKey(edge.x(), edge.y()));
        DungeonSquare sideB = squaresByCoord.get(TopologyWorkspace.coordKey(edge.adjacentX(), edge.adjacentY()));
        return DungeonEdgeRules.requiresTopologyWall(sideA, sideB);
    }

    private static List<DungeonWallEdit> dedupeWallEdits(List<DungeonWallEdit> edits) {
        Map<String, DungeonWallEdit> deduped = new HashMap<>();
        for (DungeonWallEdit edit : edits) {
            deduped.put(edit.edgeKey(), edit);
        }
        return List.copyOf(deduped.values());
    }

    private static void applyWallEdits(
            Connection conn,
            long mapId,
            TopologyWorkspace workspace,
            List<DungeonWallEdit> wallEdits
    ) throws SQLException {
        if (wallEdits.isEmpty()) {
            return;
        }
        DungeonWallRepository.applyWallEdits(conn, mapId, dedupeWallEdits(wallEdits));
        workspace.reload(conn);
    }
}
