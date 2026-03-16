package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonLayoutEditResult;
import features.world.dungeonmap.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.model.DungeonClusterGeometry;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomGeometry;
import features.world.dungeonmap.model.DungeonRoomNaming;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.RoomShape;
import features.world.dungeonmap.repository.DungeonRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonRoomTopologySupport {

    private DungeonRoomTopologySupport() {
    }

    public static DungeonLayoutEditResult moveCluster(Connection conn, long mapId, long clusterId, Point2i center) throws SQLException {
        DungeonLayout layout = requireLayout(conn, mapId);
        DungeonRoomCluster cluster = layout.clusterById(clusterId);
        if (cluster == null) {
            throw new IllegalArgumentException("Unbekannter Cluster: " + clusterId);
        }
        Point2i delta = center.subtract(cluster.center());
        Set<Point2i> movedClusterCells = translate(layout.clusterCells(cluster.clusterId()), delta);
        boolean overlapsExistingCluster = layout.clusters().stream()
                .filter(candidate -> !Objects.equals(candidate.clusterId(), cluster.clusterId()))
                .anyMatch(candidate -> overlapsCluster(candidate, movedClusterCells));
        if (overlapsExistingCluster) {
            return new DungeonLayoutEditResult(layout, DungeonSelection.roomCluster(cluster.clusterId()));
        }

        DungeonRepository.updateClusterGeometry(conn, cluster.clusterId(), cluster.center().add(delta), cluster.relativeVertices());
        for (DungeonRoom member : roomsForCluster(layout, cluster.clusterId())) {
            DungeonRepository.updateRoomPosition(conn, member.roomId(), member.componentAnchor().add(delta));
        }
        return loadEditResult(conn, mapId, DungeonSelection.roomCluster(cluster.clusterId()));
    }

    public static DungeonLayoutEditResult paintRoomCells(Connection conn, long mapId, Set<Point2i> cells) throws Exception {
        if (cells == null || cells.isEmpty()) {
            throw new IllegalArgumentException("cells darf nicht leer sein");
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        return applyPaintClusterCells(conn, layout, Set.copyOf(cells));
    }

    public static DungeonLayoutEditResult createGraphRoom(Connection conn, long mapId, Point2i center) throws Exception {
        if (center == null) {
            throw new IllegalArgumentException("center darf nicht null sein");
        }
        return paintRoomCells(conn, mapId, DungeonRoomGeometry.graphRoomCells(center));
    }

    public static DungeonLayoutEditResult deleteRoomsAtCells(Connection conn, long mapId, Set<Point2i> cells) throws Exception {
        if (cells == null || cells.isEmpty()) {
            throw new IllegalArgumentException("cells darf nicht leer sein");
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        for (DungeonRoomCluster cluster : layout.clusters()) {
            Set<Point2i> remainingCells = new LinkedHashSet<>(layout.clusterCells(cluster.clusterId()));
            if (!remainingCells.removeAll(cells)) {
                continue;
            }
            if (remainingCells.isEmpty()) {
                DungeonRepository.deleteCluster(conn, cluster.clusterId());
                continue;
            }
            RoomShape shape = DungeonRoomGeometry.roomShapeForCells(remainingCells);
            writeClusterGeometry(conn, cluster.clusterId(), remainingCells);
            List<DungeonRoomCluster.EdgeOverride> shiftedEdges = shiftEdges(cluster.center(), shape.center(), cluster.edgeOverrides());
            List<DungeonRoomCluster.EdgeOverride> sanitizedEdges = DungeonRoomCluster.sanitizeInternalEdges(shape.center(), remainingCells, shiftedEdges);
            persistClusterState(
                    conn,
                    mapId,
                    cluster.clusterId(),
                    shape.center(),
                    remainingCells,
                    sanitizedEdges,
                    roomsForCluster(layout, cluster.clusterId()));
        }
        return loadEditResult(conn, mapId, null);
    }

    public static DungeonLayoutEditResult deleteGraphCluster(Connection conn, long mapId, long clusterId) throws Exception {
        DungeonRepository.deleteCluster(conn, clusterId);
        return loadEditResult(conn, mapId, null);
    }

    public static void createDefaultRoom(Connection conn, long mapId) throws SQLException {
        Point2i center = new Point2i(0, 0);
        long clusterId = DungeonRepository.insertCluster(conn, mapId, center, DungeonRoomGeometry.standardRoomVertices());
        DungeonRepository.insertRoom(conn, mapId, clusterId, "Eingang", center);
    }

    public static DungeonLayoutEditResult paintClusterEdges(
            Connection conn,
            long mapId,
            Set<DungeonClusterEdgeRef> edgeRefs,
            DungeonRoomCluster.EdgeType edgeType
    ) throws Exception {
        if (edgeRefs == null || edgeRefs.isEmpty() || edgeType == null) {
            throw new IllegalArgumentException("edgeRefs darf nicht leer sein");
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        Map<Long, List<DungeonClusterEdgeRef>> refsByClusterId = new LinkedHashMap<>();
        for (DungeonClusterEdgeRef ref : edgeRefs) {
            refsByClusterId.computeIfAbsent(ref.clusterId(), ignored -> new ArrayList<>()).add(ref);
        }
        Long focusClusterId = null;
        for (Map.Entry<Long, List<DungeonClusterEdgeRef>> entry : refsByClusterId.entrySet()) {
            DungeonRoomCluster cluster = layout.clusterById(entry.getKey());
            if (cluster == null) {
                continue;
            }
            Set<Point2i> clusterCells = layout.clusterCells(cluster.clusterId());
            Map<DungeonRoomCluster.EdgeKey, DungeonRoomCluster.EdgeOverride> overrides = indexEdges(cluster.edgeOverrides());
            for (DungeonClusterEdgeRef ref : entry.getValue()) {
                DungeonRoomCluster.EdgeOverride override = ref.toEdgeOverride(cluster, edgeType);
                Point2i absoluteCell = override.absoluteCell(cluster.center());
                if (clusterCells.contains(absoluteCell) && clusterCells.contains(absoluteCell.add(override.direction().delta()))) {
                    overrides.put(override.key(), override);
                }
            }
            List<DungeonRoomCluster.EdgeOverride> persistedEdges = List.copyOf(overrides.values());
            persistClusterState(
                    conn,
                    mapId,
                    cluster.clusterId(),
                    cluster.center(),
                    clusterCells,
                    persistedEdges,
                    roomsForCluster(layout, cluster.clusterId()));
            if (focusClusterId == null) {
                focusClusterId = cluster.clusterId();
            }
        }
        return loadEditResult(conn, mapId, focusClusterId == null ? null : DungeonSelection.roomCluster(focusClusterId));
    }

    private static DungeonLayoutEditResult applyPaintClusterCells(Connection conn, DungeonLayout layout, Set<Point2i> paintedCells) throws SQLException {
        List<DungeonRoomCluster> overlappingClusters = layout.clusters().stream()
                .filter(cluster -> overlapsCluster(cluster, paintedCells))
                .sorted(Comparator.comparing(cluster -> cluster.clusterId() == null ? Long.MAX_VALUE : cluster.clusterId()))
                .toList();
        if (overlappingClusters.isEmpty()) {
            return createNewCluster(conn, layout, paintedCells);
        }

        DungeonRoomCluster primaryCluster = overlappingClusters.get(0);
        Set<Point2i> mergedCells = new LinkedHashSet<>(paintedCells);
        List<DungeonRoom> mergedRooms = new ArrayList<>();
        for (DungeonRoomCluster cluster : overlappingClusters) {
            mergedCells.addAll(layout.clusterCells(cluster.clusterId()));
            mergedRooms.addAll(roomsForCluster(layout, cluster.clusterId()));
        }

        RoomShape mergedShape = DungeonRoomGeometry.roomShapeForCells(mergedCells);
        writeClusterGeometry(conn, primaryCluster.clusterId(), mergedCells);
        for (DungeonRoom room : mergedRooms) {
            if (!Objects.equals(room.clusterId(), primaryCluster.clusterId())) {
                DungeonRepository.reassignRoomCluster(conn, room.roomId(), primaryCluster.clusterId());
            }
        }
        for (int i = 1; i < overlappingClusters.size(); i++) {
            DungeonRepository.deleteCluster(conn, overlappingClusters.get(i).clusterId());
        }

        List<DungeonRoomCluster.EdgeOverride> shiftedMergedEdges = new ArrayList<>();
        for (DungeonRoomCluster cluster : overlappingClusters) {
            shiftedMergedEdges.addAll(shiftEdges(cluster.center(), mergedShape.center(), cluster.edgeOverrides()));
        }
        List<DungeonRoomCluster.EdgeOverride> persistedEdges = DungeonRoomCluster.sanitizeInternalEdges(
                mergedShape.center(),
                mergedCells,
                List.copyOf(shiftedMergedEdges));
        persistClusterState(
                conn,
                layout.map().mapId(),
                primaryCluster.clusterId(),
                mergedShape.center(),
                mergedCells,
                persistedEdges,
                mergedRooms);
        return loadEditResult(conn, layout.map().mapId(), DungeonSelection.roomCluster(primaryCluster.clusterId()));
    }

    private static DungeonLayoutEditResult createNewCluster(Connection conn, DungeonLayout layout, Set<Point2i> cells) throws SQLException {
        RoomShape shape = DungeonRoomGeometry.roomShapeForCells(cells);
        long clusterId = DungeonRepository.insertCluster(conn, layout.map().mapId(), shape.center(), shape.relativeVertices());
        DungeonRepository.insertRoom(
                conn,
                layout.map().mapId(),
                clusterId,
                DungeonRoomNaming.nextRoomName(layout.rooms()),
                componentAnchor(shape, shape.center()));
        DungeonRepository.replaceClusterEdges(conn, clusterId, List.of());
        return loadEditResult(conn, layout.map().mapId(), DungeonSelection.roomCluster(clusterId));
    }

    private static void writeClusterGeometry(Connection conn, long clusterId, Set<Point2i> cells) throws SQLException {
        RoomShape shape = DungeonRoomGeometry.roomShapeForCells(cells);
        DungeonRepository.updateClusterGeometry(conn, clusterId, shape.center(), shape.relativeVertices());
    }

    private static List<DungeonRoom> persistClusterState(
            Connection conn,
            long mapId,
            long clusterId,
            Point2i clusterCenter,
            Set<Point2i> clusterCells,
            List<DungeonRoomCluster.EdgeOverride> edgeOverrides,
            List<DungeonRoom> existingRooms
    ) throws SQLException {
        DungeonRepository.replaceClusterEdges(conn, clusterId, edgeOverrides);
        return reconcileClusterRooms(conn, mapId, clusterId, clusterCenter, existingRooms, clusterCells, edgeOverrides);
    }

    private static List<DungeonRoom> reconcileClusterRooms(
            Connection conn,
            long mapId,
            long clusterId,
            Point2i clusterCenter,
            List<DungeonRoom> existingRooms,
            Set<Point2i> clusterCells,
            List<DungeonRoomCluster.EdgeOverride> edgeOverrides
    ) throws SQLException {
        List<RoomShape> components = DungeonClusterGeometry.clusterComponentShapes(clusterCenter, clusterCells, edgeOverrides);
        List<DungeonRoom> sortedExistingRooms = existingRooms.stream()
                .filter(room -> room.roomId() != null)
                .sorted(Comparator.comparing(DungeonRoom::roomId))
                .toList();
        List<DungeonRoom> results = new ArrayList<>();
        Set<Long> usedRoomIds = new LinkedHashSet<>();
        Map<Long, String> usedNames = new HashMap<>();
        for (DungeonRoom room : sortedExistingRooms) {
            usedNames.put(room.roomId(), room.name());
        }

        for (RoomShape shape : components) {
            DungeonRoom match = bestMatchingRoom(shape, sortedExistingRooms, usedRoomIds);
            if (match != null) {
                Point2i componentAnchor = componentAnchor(shape, match.componentAnchor());
                DungeonRepository.updateRoom(conn, match.roomId(), match.name(), componentAnchor);
                results.add(new DungeonRoom(match.roomId(), mapId, clusterId, match.name(), componentAnchor));
                usedRoomIds.add(match.roomId());
                continue;
            }
            String roomName = nextAvailableRoomName(sortedExistingRooms, usedNames);
            Point2i componentAnchor = componentAnchor(shape, shape.center());
            long roomId = DungeonRepository.insertRoom(conn, mapId, clusterId, roomName, componentAnchor);
            usedNames.put(roomId, roomName);
            results.add(new DungeonRoom(roomId, mapId, clusterId, roomName, componentAnchor));
        }

        for (DungeonRoom room : sortedExistingRooms) {
            if (!usedRoomIds.contains(room.roomId())) {
                DungeonCorridorTopologySupport.reconcileRoomCorridors(conn, mapId, room.roomId(), results);
                DungeonRepository.deleteRoom(conn, mapId, room.roomId());
            }
        }
        return List.copyOf(results);
    }

    private static DungeonRoom bestMatchingRoom(
            RoomShape component,
            List<DungeonRoom> rooms,
            Set<Long> usedRoomIds
    ) {
        DungeonRoom best = null;
        int bestOverlap = 0;
        int bestDistance = Integer.MAX_VALUE;
        for (DungeonRoom room : rooms) {
            if (usedRoomIds.contains(room.roomId())) {
                continue;
            }
            int overlap = component.cells().contains(room.componentAnchor()) ? 1 : 0;
            int distance = componentDistance(room, component.center());
            if (best == null || overlap > bestOverlap || (overlap == bestOverlap && distance < bestDistance)) {
                best = room;
                bestOverlap = overlap;
                bestDistance = distance;
            }
        }
        return best;
    }

    private static Map<DungeonRoomCluster.EdgeKey, DungeonRoomCluster.EdgeOverride> indexEdges(List<DungeonRoomCluster.EdgeOverride> edgeOverrides) {
        Map<DungeonRoomCluster.EdgeKey, DungeonRoomCluster.EdgeOverride> result = new LinkedHashMap<>();
        if (edgeOverrides == null) {
            return result;
        }
        for (DungeonRoomCluster.EdgeOverride edge : edgeOverrides) {
            DungeonRoomCluster.EdgeOverride canonical = DungeonRoomCluster.EdgeOverride.of(edge.cell(), edge.direction(), edge.type());
            result.put(canonical.key(), canonical);
        }
        return result;
    }

    private static String nextAvailableRoomName(List<DungeonRoom> existingRooms, Map<Long, String> usedNames) {
        List<DungeonRoom> syntheticRooms = new ArrayList<>(existingRooms);
        for (Map.Entry<Long, String> entry : usedNames.entrySet()) {
            if (existingRooms.stream().anyMatch(room -> room.roomId() != null && room.roomId().equals(entry.getKey()))) {
                continue;
            }
            syntheticRooms.add(new DungeonRoom(entry.getKey(), 0L, 0L, entry.getValue(), new Point2i(0, 0)));
        }
        return DungeonRoomNaming.nextRoomName(syntheticRooms);
    }

    private static List<DungeonRoomCluster.EdgeOverride> shiftEdges(
            Point2i previousCenter,
            Point2i nextCenter,
            List<DungeonRoomCluster.EdgeOverride> edgeOverrides
    ) {
        if (edgeOverrides == null || edgeOverrides.isEmpty() || Objects.equals(previousCenter, nextCenter)) {
            return edgeOverrides == null ? List.of() : List.copyOf(edgeOverrides);
        }
        Point2i delta = previousCenter.subtract(nextCenter);
        return edgeOverrides.stream()
                .map(edge -> edge.translated(delta))
                .toList();
    }

    private static List<DungeonRoom> roomsForCluster(DungeonLayout layout, Long clusterId) {
        return layout == null ? List.of() : layout.roomsForCluster(clusterId);
    }

    private static boolean overlapsCluster(DungeonRoomCluster cluster, Set<Point2i> cells) {
        Set<Point2i> clusterCells = DungeonRoomGeometry.cells(cluster);
        for (Point2i cell : cells) {
            if (clusterCells.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    private static Set<Point2i> translate(Set<Point2i> cells, Point2i delta) {
        Set<Point2i> translated = new LinkedHashSet<>();
        for (Point2i cell : cells) {
            translated.add(cell.add(delta));
        }
        return translated;
    }

    static int manhattan(Point2i a, Point2i b) {
        return Math.abs(a.x() - b.x()) + Math.abs(a.y() - b.y());
    }

    static int componentDistance(DungeonRoom room, Point2i cell) {
        return room == null || cell == null ? Integer.MAX_VALUE : manhattan(room.componentAnchor(), cell);
    }

    static int componentDistance(DungeonRoom left, DungeonRoom right) {
        return left == null || right == null ? Integer.MAX_VALUE : componentDistance(left, right.componentAnchor());
    }

    private static DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        return DungeonRepository.loadLayout(conn, mapId)
                .orElseThrow(() -> new IllegalArgumentException("Unbekannte Dungeon-Map: " + mapId));
    }

    private static DungeonLayoutEditResult loadEditResult(Connection conn, long mapId, DungeonSelection focusSelection) throws SQLException {
        DungeonLayout layout = requireLayout(conn, mapId);
        return new DungeonLayoutEditResult(layout, focusSelection);
    }

    private static Point2i componentAnchor(RoomShape shape, Point2i preferredAnchor) {
        if (shape.cells().contains(preferredAnchor)) {
            return preferredAnchor;
        }
        return shape.cells().stream()
                .min(Comparator
                        .comparingInt((Point2i cell) -> manhattan(cell, preferredAnchor))
                        .thenComparing(Point2i::x)
                        .thenComparing(Point2i::y))
                .orElse(shape.center());
    }

}
