package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeatureTile;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonEdgeRules;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWall;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.model.PassageDirection;
import features.world.dungeonmap.repository.DungeonEndpointRepository;
import features.world.dungeonmap.repository.DungeonFeatureRepository;
import features.world.dungeonmap.repository.DungeonLinkRepository;
import features.world.dungeonmap.repository.DungeonMapRepository;
import features.world.dungeonmap.repository.DungeonPassageRepository;
import features.world.dungeonmap.repository.DungeonSquareRepository;
import features.world.dungeonmap.repository.DungeonWallRepository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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

    public static void validatePassageForSave(Connection conn, DungeonPassage passage) throws SQLException {
        if (!isPassageEdgeValid(conn, passage.mapId(), passage.x(), passage.y(), passage.direction())) {
            throw new IllegalArgumentException("Passage edge is no longer valid for map " + passage.mapId());
        }
        if (passage.endpointId() == null) {
            return;
        }
        Optional<DungeonEndpoint> endpoint = DungeonEndpointRepository.findEndpoint(conn, passage.endpointId());
        if (endpoint.isEmpty() || endpoint.get().mapId() == null || endpoint.get().mapId() != passage.mapId()) {
            throw new IllegalArgumentException("Passage endpoint does not belong to map " + passage.mapId());
        }
    }

    public static void deleteInvalidPassages(Connection conn, long mapId) throws SQLException {
        List<DungeonSquare> squares = DungeonSquareRepository.getSquares(conn, mapId);
        List<DungeonWall> walls = DungeonWallRepository.getWalls(conn, mapId);
        Map<String, DungeonSquare> squaresByCoord = squaresByCoord(squares);
        Set<String> manualWallsByEdge = wallEdges(walls);
        Set<Long> endpointIds = endpointIds(conn, mapId);
        for (DungeonPassage passage : DungeonPassageRepository.getPassages(conn, mapId)) {
            if (!isPassageEdgeValid(squaresByCoord, manualWallsByEdge, passage)
                    || passage.endpointId() != null && !endpointIds.contains(passage.endpointId())) {
                DungeonPassageRepository.deletePassage(conn, passage.passageId());
            }
        }
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

    private static void reconcileTopology(Connection conn, long mapId, TopologyIntent intent) throws SQLException {
        DungeonWallRepository.deleteDerivedBoundaryWallsAndOrphans(conn, mapId);
        DungeonFeatureRepository.deleteEmptyFeatures(conn, mapId);

        TopologyWorkspace workspace = TopologyWorkspace.load(conn, mapId, intent.previousSquares());
        TopologyIntent effectiveIntent = RoomTopologyReconciler.reconcile(conn, mapId, intent, workspace);
        if (!effectiveIntent.squareEdits().isEmpty()) {
            reconcileSquarePaintTopology(conn, mapId, effectiveIntent, workspace);
        }
        deleteInvalidPassages(conn, mapId);
        DungeonLinkRepository.deleteLinksWithMissingAnchors(conn, mapId);
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

    private static boolean isPassageEdgeValid(Connection conn, long mapId, int x, int y, PassageDirection direction) throws SQLException {
        List<DungeonSquare> squares = DungeonSquareRepository.getSquares(conn, mapId);
        List<DungeonWall> walls = DungeonWallRepository.getWalls(conn, mapId);
        return isPassageEdgeValid(
                squaresByCoord(squares),
                wallEdges(walls),
                new DungeonPassage(null, mapId, x, y, direction, null, null, null));
    }

    private static boolean isWallEdgeValid(Connection conn, long mapId, int x, int y, PassageDirection direction) throws SQLException {
        boolean sideA = squareExists(conn, mapId, x, y);
        boolean sideB = direction == PassageDirection.EAST
                ? squareExists(conn, mapId, x + 1, y)
                : squareExists(conn, mapId, x, y + 1);
        return sideA && sideB;
    }

    private static boolean squareExists(Connection conn, long mapId, int x, int y) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM dungeon_squares WHERE map_id=? AND x=? AND y=?")) {
            ps.setLong(1, mapId);
            ps.setInt(2, x);
            ps.setInt(3, y);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static boolean isPassageEdgeValid(
            Map<String, DungeonSquare> squaresByCoord,
            Set<String> manualWallsByEdge,
            DungeonPassage passage
    ) {
        DungeonSquare sideA = squaresByCoord.get(coordKey(passage.x(), passage.y()));
        DungeonSquare sideB = passage.direction() == PassageDirection.EAST
                ? squaresByCoord.get(coordKey(passage.x() + 1, passage.y()))
                : squaresByCoord.get(coordKey(passage.x(), passage.y() + 1));
        return DungeonEdgeRules.canCreatePassage(sideA, sideB, manualWallsByEdge.contains(passage.edgeKey()));
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

    private static Set<String> wallEdges(List<DungeonWall> walls) {
        Set<String> result = new HashSet<>();
        for (DungeonWall wall : walls) {
            result.add(wall.edgeKey());
        }
        return result;
    }

    private static Set<Long> endpointIds(Connection conn, long mapId) throws SQLException {
        Set<Long> result = new HashSet<>();
        for (DungeonEndpoint endpoint : DungeonEndpointRepository.getEndpoints(conn, mapId)) {
            result.add(endpoint.endpointId());
        }
        return result;
    }
}
