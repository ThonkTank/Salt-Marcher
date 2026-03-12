package features.world.dungeonmap.service;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeatureTile;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWall;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.model.PassageDirection;
import features.world.dungeonmap.repository.DungeonEndpointRepository;
import features.world.dungeonmap.repository.DungeonFeatureRepository;
import features.world.dungeonmap.repository.DungeonFeatureTileRepository;
import features.world.dungeonmap.repository.DungeonMapRepository;
import features.world.dungeonmap.repository.DungeonPassageRepository;
import features.world.dungeonmap.repository.DungeonRoomRepository;
import features.world.dungeonmap.repository.DungeonSquareRepository;
import features.world.dungeonmap.repository.DungeonWallRepository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class DungeonTopologyService {

    private static final Pattern DEFAULT_ROOM_NAME = Pattern.compile("^Raum #(\\d+)$");

    private DungeonTopologyService() {
        throw new AssertionError("No instances");
    }

    public static void applySquareEdits(Connection conn, long mapId, List<DungeonSquarePaint> edits) throws SQLException {
        applySquareEdits(conn, mapId, edits, List.of());
    }

    public static void applySquareEdits(Connection conn, long mapId, List<DungeonSquarePaint> edits, List<Long> preferredPrimaryRoomIds)
            throws SQLException {
        DungeonSquareRepository.applySquareEdits(conn, mapId, edits);
        reconcileAfterGeometryChange(conn, mapId, preferredPrimaryRoomIds);
    }

    public static void shrinkMap(Connection conn, long mapId, int width, int height) throws SQLException {
        DungeonMapRepository.deleteSquaresOutsideBounds(conn, mapId, width, height);
        reconcileAfterGeometryChange(conn, mapId, List.of());
    }

    public static void validatePassageForSave(Connection conn, DungeonPassage passage) throws SQLException {
        if (!isPassageEdgeValid(conn, passage.mapId(), passage.x(), passage.y(), passage.direction())) {
            throw new IllegalArgumentException("Passage edge is no longer valid for map " + passage.mapId());
        }
        if (passage.passageId() == null && !wallExists(conn, passage.mapId(), passage.x(), passage.y(), passage.direction())) {
            throw new IllegalArgumentException("New passages require an existing wall on map " + passage.mapId());
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
        DungeonPassageRepository.deleteInvalidPassages(conn, mapId);
    }

    public static void applyWallEdits(Connection conn, long mapId, List<DungeonWallEdit> edits) throws SQLException {
        applyWallEdits(conn, mapId, edits, List.of());
    }

    public static void applyWallEdits(Connection conn, long mapId, List<DungeonWallEdit> edits, List<Long> preferredPrimaryRoomIds)
            throws SQLException {
        for (DungeonWallEdit edit : edits) {
            if (!isWallEdgeValid(conn, mapId, edit.x(), edit.y(), edit.direction())) {
                throw new IllegalArgumentException("Wall edge is no longer valid for map " + mapId);
            }
        }
        DungeonWallRepository.applyWallEdits(conn, mapId, edits);
        reconcileAfterGeometryChange(conn, mapId, preferredPrimaryRoomIds);
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

    private static void reconcileAfterGeometryChange(Connection conn, long mapId, List<Long> preferredPrimaryRoomIds) throws SQLException {
        deleteInvalidPassages(conn, mapId);
        DungeonWallRepository.deleteInvalidWalls(conn, mapId);
        DungeonFeatureRepository.deleteEmptyFeatures(conn, mapId);
        reconcileRooms(conn, mapId, preferredPrimaryRoomIds == null ? List.of() : preferredPrimaryRoomIds);
    }

    private static void reconcileRooms(Connection conn, long mapId, List<Long> preferredPrimaryRoomIds) throws SQLException {
        List<DungeonSquare> squares = DungeonSquareRepository.getSquares(conn, mapId);
        List<DungeonRoom> rooms = DungeonRoomRepository.getRooms(conn, mapId);
        Map<Long, DungeonRoom> roomsById = new HashMap<>();
        for (DungeonRoom room : rooms) {
            roomsById.put(room.roomId(), room);
        }
        if (squares.isEmpty()) {
            for (DungeonRoom room : rooms) {
                DungeonRoomRepository.deleteRoom(conn, room.roomId());
            }
            return;
        }

        Map<String, DungeonWall> wallsByEdge = new HashMap<>();
        for (DungeonWall wall : DungeonWallRepository.getWalls(conn, mapId)) {
            wallsByEdge.put(wall.edgeKey(), wall);
        }

        List<RoomComponent> components = buildRoomComponents(squares, wallsByEdge);
        Map<Long, Integer> largestComponentByRoomId = findLargestComponentByRoom(components);
        int nextDefaultRoomNumber = nextDefaultRoomNumber(rooms);
        Set<Long> retainedRoomIds = new HashSet<>();

        for (RoomComponent component : components) {
            List<Long> retainableRoomIds = retainableRoomIds(component, largestComponentByRoomId);
            Long primaryRoomId = selectPrimaryRoomId(retainableRoomIds, component.roomSquareCounts(), preferredPrimaryRoomIds);
            Long targetRoomId;
            if (primaryRoomId != null) {
                retainedRoomIds.add(primaryRoomId);
                targetRoomId = primaryRoomId;
                updatePrimaryRoom(conn, component, primaryRoomId, largestComponentByRoomId, roomsById, preferredPrimaryRoomIds);
            } else {
                DungeonRoom templateRoom = selectTemplateRoom(component, roomsById, preferredPrimaryRoomIds);
                DungeonRoom newRoom = new DungeonRoom(
                        null,
                        mapId,
                        "Raum #" + nextDefaultRoomNumber++,
                        "",
                        templateRoom == null ? null : templateRoom.areaId());
                targetRoomId = DungeonRoomRepository.upsertRoom(conn, newRoom);
            }

            for (DungeonSquare square : component.squares()) {
                if (!targetRoomIdEquals(square.roomId(), targetRoomId)) {
                    DungeonSquareRepository.assignSquareRoom(conn, square.squareId(), targetRoomId);
                }
            }
        }

        for (DungeonRoom room : rooms) {
            if (!retainedRoomIds.contains(room.roomId())) {
                DungeonRoomRepository.deleteRoom(conn, room.roomId());
            }
        }
    }

    private static void updatePrimaryRoom(
            Connection conn,
            RoomComponent component,
            long primaryRoomId,
            Map<Long, Integer> largestComponentByRoomId,
            Map<Long, DungeonRoom> roomsById,
            List<Long> preferredPrimaryRoomIds
    ) throws SQLException {
        DungeonRoom primaryRoom = roomsById.get(primaryRoomId);
        if (primaryRoom == null) {
            return;
        }

        List<DungeonRoom> mergedRooms = mergedRooms(component, primaryRoomId, largestComponentByRoomId, roomsById, preferredPrimaryRoomIds);
        String mergedDescription = mergeDescriptions(primaryRoom.description(), mergedRooms);
        if (sameText(primaryRoom.description(), mergedDescription)) {
            return;
        }
        DungeonRoomRepository.upsertRoom(conn, new DungeonRoom(
                primaryRoom.roomId(),
                primaryRoom.mapId(),
                primaryRoom.name(),
                mergedDescription,
                primaryRoom.areaId()));
    }

    private static List<DungeonRoom> mergedRooms(
            RoomComponent component,
            long primaryRoomId,
            Map<Long, Integer> largestComponentByRoomId,
            Map<Long, DungeonRoom> roomsById,
            List<Long> preferredPrimaryRoomIds
    ) {
        List<Long> mergedRoomIds = new ArrayList<>();
        for (Long roomId : component.roomIds()) {
            if (roomId == null || roomId == primaryRoomId) {
                continue;
            }
            if (largestComponentByRoomId.getOrDefault(roomId, -1) == component.index()) {
                mergedRoomIds.add(roomId);
            }
        }
        mergedRoomIds.sort(roomMergeComparator(component.roomSquareCounts(), preferredPrimaryRoomIds));

        List<DungeonRoom> result = new ArrayList<>();
        for (Long roomId : mergedRoomIds) {
            DungeonRoom room = roomsById.get(roomId);
            if (room != null) {
                result.add(room);
            }
        }
        return result;
    }

    private static Comparator<Long> roomMergeComparator(Map<Long, Integer> roomSquareCounts, List<Long> preferredPrimaryRoomIds) {
        Map<Long, Integer> preferredOrder = preferredOrder(preferredPrimaryRoomIds);
        return Comparator
                .comparingInt((Long roomId) -> preferredOrder.getOrDefault(roomId, Integer.MAX_VALUE))
                .thenComparing((Long roomId) -> -roomSquareCounts.getOrDefault(roomId, 0))
                .thenComparingLong(Long::longValue);
    }

    private static String mergeDescriptions(String primaryDescription, List<DungeonRoom> mergedRooms) {
        List<String> parts = new ArrayList<>();
        String base = normalizedText(primaryDescription);
        if (base != null) {
            parts.add(base);
        }

        Set<String> seen = new LinkedHashSet<>(parts);
        for (DungeonRoom room : mergedRooms) {
            String description = normalizedText(room.description());
            if (description != null && seen.add(description)) {
                parts.add(description);
            }
        }
        return parts.isEmpty() ? "" : String.join("\n\n", parts);
    }

    private static DungeonRoom selectTemplateRoom(
            RoomComponent component,
            Map<Long, DungeonRoom> roomsById,
            List<Long> preferredPrimaryRoomIds
    ) {
        Long templateRoomId = selectPreferredRoomId(List.copyOf(component.roomIds()), component.roomSquareCounts(), preferredPrimaryRoomIds);
        if (templateRoomId == null) {
            return null;
        }
        return roomsById.get(templateRoomId);
    }

    private static Long selectPrimaryRoomId(
            List<Long> retainableRoomIds,
            Map<Long, Integer> roomSquareCounts,
            List<Long> preferredPrimaryRoomIds
    ) {
        return selectPreferredRoomId(retainableRoomIds, roomSquareCounts, preferredPrimaryRoomIds);
    }

    private static Long selectPreferredRoomId(
            List<Long> candidateRoomIds,
            Map<Long, Integer> roomSquareCounts,
            List<Long> preferredPrimaryRoomIds
    ) {
        if (candidateRoomIds == null || candidateRoomIds.isEmpty()) {
            return null;
        }
        Map<Long, Integer> preferredOrder = preferredOrder(preferredPrimaryRoomIds);
        Long selected = null;
        for (Long roomId : candidateRoomIds) {
            if (roomId == null) {
                continue;
            }
            if (selected == null) {
                selected = roomId;
                continue;
            }
            int selectedOrder = preferredOrder.getOrDefault(selected, Integer.MAX_VALUE);
            int candidateOrder = preferredOrder.getOrDefault(roomId, Integer.MAX_VALUE);
            if (candidateOrder < selectedOrder) {
                selected = roomId;
                continue;
            }
            if (candidateOrder == selectedOrder) {
                int selectedCount = roomSquareCounts.getOrDefault(selected, 0);
                int candidateCount = roomSquareCounts.getOrDefault(roomId, 0);
                if (candidateCount > selectedCount || candidateCount == selectedCount && roomId < selected) {
                    selected = roomId;
                }
            }
        }
        return selected;
    }

    private static Map<Long, Integer> preferredOrder(List<Long> preferredPrimaryRoomIds) {
        Map<Long, Integer> order = new HashMap<>();
        if (preferredPrimaryRoomIds == null) {
            return order;
        }
        for (int i = 0; i < preferredPrimaryRoomIds.size(); i++) {
            Long roomId = preferredPrimaryRoomIds.get(i);
            if (roomId != null) {
                order.putIfAbsent(roomId, i);
            }
        }
        return order;
    }

    private static List<Long> retainableRoomIds(RoomComponent component, Map<Long, Integer> largestComponentByRoomId) {
        List<Long> result = new ArrayList<>();
        for (Long roomId : component.roomIds()) {
            if (roomId != null && largestComponentByRoomId.getOrDefault(roomId, -1) == component.index()) {
                result.add(roomId);
            }
        }
        return result;
    }

    private static Map<Long, Integer> findLargestComponentByRoom(List<RoomComponent> components) {
        Map<Long, Integer> result = new HashMap<>();
        Map<Long, Integer> bestSizeByRoom = new HashMap<>();
        for (RoomComponent component : components) {
            for (Map.Entry<Long, Integer> entry : component.roomSquareCounts().entrySet()) {
                Long roomId = entry.getKey();
                if (roomId == null) {
                    continue;
                }
                int componentSize = component.squares().size();
                int currentBestSize = bestSizeByRoom.getOrDefault(roomId, -1);
                if (componentSize > currentBestSize) {
                    bestSizeByRoom.put(roomId, componentSize);
                    result.put(roomId, component.index());
                    continue;
                }
                if (componentSize == currentBestSize) {
                    int currentBestIndex = result.get(roomId);
                    if (component.index() < currentBestIndex) {
                        result.put(roomId, component.index());
                    }
                }
            }
        }
        return result;
    }

    private static List<RoomComponent> buildRoomComponents(List<DungeonSquare> squares, Map<String, DungeonWall> wallsByEdge) {
        Map<String, DungeonSquare> squaresByCoord = new HashMap<>();
        for (DungeonSquare square : squares) {
            squaresByCoord.put(coordKey(square.x(), square.y()), square);
        }

        Set<String> visited = new HashSet<>();
        List<RoomComponent> components = new ArrayList<>();
        int componentIndex = 0;
        for (DungeonSquare start : squares) {
            String startKey = coordKey(start.x(), start.y());
            if (!visited.add(startKey)) {
                continue;
            }
            List<DungeonSquare> componentSquares = new ArrayList<>();
            Map<Long, Integer> roomSquareCounts = new HashMap<>();
            Set<Long> roomIds = new LinkedHashSet<>();
            Deque<DungeonSquare> queue = new ArrayDeque<>();
            queue.add(start);
            while (!queue.isEmpty()) {
                DungeonSquare current = queue.removeFirst();
                componentSquares.add(current);
                if (current.roomId() != null) {
                    roomIds.add(current.roomId());
                    roomSquareCounts.merge(current.roomId(), 1, Integer::sum);
                }
                enqueueRoomNeighbor(current, current.x() + 1, current.y(), squaresByCoord, wallsByEdge, visited, queue);
                enqueueRoomNeighbor(current, current.x() - 1, current.y(), squaresByCoord, wallsByEdge, visited, queue);
                enqueueRoomNeighbor(current, current.x(), current.y() + 1, squaresByCoord, wallsByEdge, visited, queue);
                enqueueRoomNeighbor(current, current.x(), current.y() - 1, squaresByCoord, wallsByEdge, visited, queue);
            }
            components.add(new RoomComponent(componentIndex++, componentSquares, roomSquareCounts, roomIds));
        }
        return components;
    }

    private static void enqueueRoomNeighbor(
            DungeonSquare current,
            int neighborX,
            int neighborY,
            Map<String, DungeonSquare> squaresByCoord,
            Map<String, DungeonWall> wallsByEdge,
            Set<String> visited,
            Deque<DungeonSquare> queue
    ) {
        DungeonSquare neighbor = squaresByCoord.get(coordKey(neighborX, neighborY));
        if (neighbor == null || wallSeparates(current.x(), current.y(), neighborX, neighborY, wallsByEdge)) {
            return;
        }
        String key = coordKey(neighborX, neighborY);
        if (visited.add(key)) {
            queue.addLast(neighbor);
        }
    }

    private static boolean wallSeparates(int x1, int y1, int x2, int y2, Map<String, DungeonWall> wallsByEdge) {
        if (x1 == x2) {
            int minY = Math.min(y1, y2);
            return wallsByEdge.containsKey(PassageDirection.SOUTH.edgeKey(x1, minY));
        }
        int minX = Math.min(x1, x2);
        return wallsByEdge.containsKey(PassageDirection.EAST.edgeKey(minX, y1));
    }

    private static int nextDefaultRoomNumber(List<DungeonRoom> rooms) {
        int next = 1;
        for (DungeonRoom room : rooms) {
            if (room == null || room.name() == null) {
                continue;
            }
            Matcher matcher = DEFAULT_ROOM_NAME.matcher(room.name().trim());
            if (matcher.matches()) {
                next = Math.max(next, Integer.parseInt(matcher.group(1)) + 1);
            }
        }
        return next;
    }

    private static boolean targetRoomIdEquals(Long currentRoomId, long targetRoomId) {
        return currentRoomId != null && currentRoomId == targetRoomId;
    }

    private static String normalizedText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static boolean sameText(String left, String right) {
        String normalizedLeft = normalizedText(left);
        String normalizedRight = normalizedText(right);
        if (normalizedLeft == null && normalizedRight == null) {
            return true;
        }
        if (normalizedLeft == null || normalizedRight == null) {
            return false;
        }
        return normalizedLeft.equals(normalizedRight);
    }

    private static boolean isPassageEdgeValid(Connection conn, long mapId, int x, int y, PassageDirection direction) throws SQLException {
        boolean sideA = squareExists(conn, mapId, x, y);
        boolean sideB = direction == PassageDirection.EAST
                ? squareExists(conn, mapId, x + 1, y)
                : squareExists(conn, mapId, x, y + 1);
        return sideA && sideB;
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

    private static boolean wallExists(Connection conn, long mapId, int x, int y, PassageDirection direction) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM dungeon_walls WHERE map_id=? AND x=? AND y=? AND direction=?")) {
            ps.setLong(1, mapId);
            ps.setInt(2, x);
            ps.setInt(3, y);
            ps.setString(4, direction.dbValue());
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
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

    private record RoomComponent(
            int index,
            List<DungeonSquare> squares,
            Map<Long, Integer> roomSquareCounts,
            Set<Long> roomIds
    ) {
    }
}
