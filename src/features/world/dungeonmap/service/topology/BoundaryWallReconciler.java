package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.repository.DungeonWallRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
        for (EdgeRef edge : SquarePaintEdgeTransitions.touchedEdges(intent.squareEdits())) {
            DungeonSquare currentA = workspace.currentSquaresByCoord().get(TopologyWorkspace.coordKey(edge.x(), edge.y()));
            DungeonSquare currentB = workspace.currentSquaresByCoord().get(TopologyWorkspace.coordKey(edge.adjacentX(), edge.adjacentY()));
            /*
             * Square paint still persists a shared wall when the touched edge separates two current
             * rooms. That keeps adjacent paint operations as distinct rooms until the GM explicitly
             * removes the barrier, instead of auto-merging on adjacency alone.
             */
            if (currentA != null && currentB != null && !sameRoom(currentA, currentB)) {
                wallEdits.add(new DungeonWallEdit(edge.x(), edge.y(), edge.direction(), true));
                continue;
            }
            wallEdits.add(new DungeonWallEdit(edge.x(), edge.y(), edge.direction(), false));
        }

        applyWallEdits(conn, mapId, workspace, wallEdits);
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

    private static boolean sameRoom(DungeonSquare left, DungeonSquare right) {
        return left.roomId() != null && left.roomId().equals(right.roomId());
    }
}
