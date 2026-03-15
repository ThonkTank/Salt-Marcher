package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.domain.DungeonFeatureCategory;
import features.world.dungeonmap.model.domain.DungeonFeatureTile;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.editing.DungeonSquarePaint;
import features.world.dungeonmap.model.domain.DungeonWall;
import features.world.dungeonmap.model.editing.DungeonWallEdit;
import features.world.dungeonmap.model.domain.PassageDirection;
import features.world.dungeonmap.repository.feature.DungeonFeatureRepository;
import features.world.dungeonmap.repository.map.DungeonMapRepository;
import features.world.dungeonmap.repository.map.DungeonSquareRepository;
import features.world.dungeonmap.repository.topology.DungeonWallRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonTopologyService {

    /*
     * Topology owns which edges require persisted walls during writes, and the derived edge builder
     * mirrors the same boundary rule for read-model and preview reconstruction.
     *
     * Square paint rules:
     * - Painting isolated empty space creates a new room and walls on every exposed edge.
     * - Painting empty space directly adjacent to one or more rooms still creates a new room and only adds boundary walls
     *   where an edge does not already have one.
     * - Painting over empty space plus exactly one existing room extends the overlapped room, adds walls on the new outer
     *   edges, and removes walls that become internal to that room.
     * - Painting over empty space plus multiple existing rooms merges all overlapped rooms into one room, keeps walls on
     *   the full outer perimeter, and removes walls that become internal to the merged room.
     */
    private DungeonTopologyService() {
        throw new AssertionError("No instances");
    }

    public static void applySquareEdits(
            Connection conn,
            long mapId,
            List<DungeonSquarePaint> edits
    ) throws SQLException {
        List<DungeonSquare> previousSquares = DungeonSquareRepository.getSquares(conn, mapId);
        DungeonSquareRepository.applySquareEdits(conn, mapId, edits);
        reconcileTopology(conn, mapId, TopologyIntent.forSquareEdits(edits, previousSquares));
    }

    public static void shrinkMap(Connection conn, long mapId, int width, int height) throws SQLException {
        DungeonMapRepository.deleteSquaresOutsideBounds(conn, mapId, width, height);
        reconcileTopology(conn, mapId, TopologyIntent.geometryChange());
    }

    public static void applyWallEdits(
            Connection conn,
            long mapId,
            List<DungeonWallEdit> edits
    ) throws SQLException {
        // Manual wall edits stay available between two occupied squares so shared walls can merge rooms.
        // One-sided boundary walls are derived from squares and never persisted as manual edits.
        for (DungeonWallEdit edit : edits) {
            if (!isWallEdgeValid(conn, mapId, edit.x(), edit.y(), edit.direction())) {
                throw new IllegalArgumentException("Wall edge is no longer valid for map " + mapId);
            }
        }
        DungeonWallRepository.applyWallEdits(conn, mapId, edits);
        reconcileTopology(conn, mapId, TopologyIntent.forWallEdits(edits));
    }

    public static void validateFeatureFootprintConnected(List<DungeonFeatureTile> featureTiles) {
        if (featureTiles == null || featureTiles.size() <= 1) {
            return;
        }
        Map<String, DungeonFeatureTile> tilesByCoord = new HashMap<>();
        for (DungeonFeatureTile tile : featureTiles) {
            tilesByCoord.put(coordKey(tile.x(), tile.y()), tile);
        }
        Set<String> visited = new HashSet<>();
        Deque<DungeonFeatureTile> queue = new ArrayDeque<>();
        DungeonFeatureTile start = featureTiles.get(0);
        queue.add(start);
        visited.add(coordKey(start.x(), start.y()));
        while (!queue.isEmpty()) {
            DungeonFeatureTile current = queue.removeFirst();
            enqueueFeatureNeighbor(current.x() + 1, current.y(), tilesByCoord, visited, queue);
            enqueueFeatureNeighbor(current.x() - 1, current.y(), tilesByCoord, visited, queue);
            enqueueFeatureNeighbor(current.x(), current.y() + 1, tilesByCoord, visited, queue);
            enqueueFeatureNeighbor(current.x(), current.y() - 1, tilesByCoord, visited, queue);
        }
        if (visited.size() != featureTiles.size()) {
            throw new IllegalArgumentException("Feature footprint must stay contiguous");
        }
    }

    public static Long applyFeaturePaints(
            Connection conn,
            long mapId,
            DungeonFeatureCategory category,
            List<DungeonSquarePaint> edits
    ) throws SQLException {
        return DungeonFeatureTopologyService.applyFeaturePaints(conn, mapId, category, edits);
    }

    public static void reconcilePersistedTopologyState(Connection conn) throws SQLException {
        for (var map : DungeonMapRepository.getAllMaps(conn)) {
            reconcilePersistedTopologyState(conn, map.mapId());
        }
    }

    private static void reconcileTopology(Connection conn, long mapId, TopologyIntent intent) throws SQLException {
        // Write-side topology reconciliation owns persisted wall cleanup after mutating map geometry.
        DungeonWallRepository.deleteDerivedBoundaryWallsAndOrphans(conn, mapId);
        DungeonFeatureRepository.deleteEmptyFeatures(conn, mapId);

        TopologyWorkspace workspace = TopologyWorkspace.load(conn, mapId, intent.previousSquares());
        TopologyIntent effectiveIntent = RoomTopologyReconciler.reconcile(conn, mapId, intent, workspace);
        if (!effectiveIntent.squareEdits().isEmpty()) {
            reconcileSquarePaintTopology(conn, mapId, effectiveIntent, workspace);
        }
    }

    private static void reconcilePersistedTopologyState(Connection conn, long mapId) throws SQLException {
        DungeonWallRepository.deleteDerivedBoundaryWallsAndOrphans(conn, mapId);
        DungeonFeatureRepository.deleteEmptyFeatures(conn, mapId);
    }

    private static void reconcileSquarePaintTopology(
            Connection conn,
            long mapId,
            TopologyIntent intent,
            TopologyWorkspace workspace
    ) throws SQLException {
        BoundaryWallReconciler.ensureBoundaryWallsForSquarePaint(conn, mapId, intent, workspace);
        RoomTopologyReconciler.reconcileRoomComponentsAfterBoundaryWalls(conn, mapId, intent, workspace);
    }

    private static boolean isWallEdgeValid(Connection conn, long mapId, int x, int y, PassageDirection direction) throws SQLException {
        boolean sideA = DungeonSquareRepository.existsAt(conn, mapId, x, y);
        boolean sideB = direction == PassageDirection.EAST
                ? DungeonSquareRepository.existsAt(conn, mapId, x + 1, y)
                : DungeonSquareRepository.existsAt(conn, mapId, x, y + 1);
        return sideA && sideB;
    }

    private static void enqueueFeatureNeighbor(
            int x,
            int y,
            Map<String, DungeonFeatureTile> tilesByCoord,
            Set<String> visited,
            Deque<DungeonFeatureTile> queue
    ) {
        String key = coordKey(x, y);
        DungeonFeatureTile neighbor = tilesByCoord.get(key);
        if (neighbor != null && visited.add(key)) {
            queue.addLast(neighbor);
        }
    }

    private static String coordKey(int x, int y) {
        return x + ":" + y;
    }

    private static Map<String, DungeonSquare> squaresByCoord(List<DungeonSquare> squares) {
        Map<String, DungeonSquare> result = new HashMap<>();
        for (DungeonSquare square : squares) {
            result.put(coordKey(square.x(), square.y()), square);
        }
        return result;
    }

}
