package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonWall;
import features.world.dungeonmap.model.PassageDirection;
import features.world.dungeonmap.repository.DungeonRoomRepository;
import features.world.dungeonmap.repository.DungeonSquareRepository;

import java.sql.Connection;
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
import java.util.Set;

final class RoomTopologyReconciler {

    private RoomTopologyReconciler() {
    }

    static TopologyIntent reconcile(
            Connection conn,
            long mapId,
            TopologyIntent intent,
            TopologyWorkspace workspace
    ) throws SQLException {
        TopologyIntent effectiveIntent = PaintedSquareRoomAssigner.assignPaintedSquaresToRooms(conn, mapId, intent, workspace);
        workspace.reload(conn);
        effectiveIntent = derivePrimaryRoomPriority(workspace, effectiveIntent);
        if (effectiveIntent.squareEdits().isEmpty()) {
            reconcileRoomComponents(conn, mapId, effectiveIntent, workspace);
            workspace.reload(conn);
        }
        return effectiveIntent;
    }

    static void reconcileRoomComponentsAfterBoundaryWalls(
            Connection conn,
            long mapId,
            TopologyIntent intent,
            TopologyWorkspace workspace
    ) throws SQLException {
        reconcileRoomComponents(conn, mapId, intent, workspace);
        workspace.reload(conn);
    }

    static Long selectPreferredRoomId(
            List<Long> candidateRoomIds,
            Map<Long, Integer> roomSquareCounts,
            TopologyIntent intent
    ) {
        if (candidateRoomIds == null || candidateRoomIds.isEmpty()) {
            return null;
        }
        Map<Long, Integer> preferredOrder = preferredOrder(intent);
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

    static void updateMergedRoomMetadata(
            Connection conn,
            long primaryRoomId,
            List<Long> mergedRoomIds,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, Integer> roomSquareCounts,
            TopologyIntent intent
    ) throws SQLException {
        DungeonRoom primaryRoom = roomsById.get(primaryRoomId);
        if (primaryRoom == null) {
            return;
        }

        List<Long> secondaryRoomIds = new ArrayList<>();
        for (Long roomId : mergedRoomIds) {
            if (roomId != null && roomId != primaryRoomId) {
                secondaryRoomIds.add(roomId);
            }
        }
        secondaryRoomIds.sort(roomMergeComparator(roomSquareCounts, intent));

        List<DungeonRoom> secondaryRooms = new ArrayList<>();
        for (Long roomId : secondaryRoomIds) {
            DungeonRoom room = roomsById.get(roomId);
            if (room != null) {
                secondaryRooms.add(room);
            }
        }
        upsertMergedMetadata(conn, primaryRoom, secondaryRooms);
    }

    static String coalesceText(String value) {
        return value == null ? "" : value;
    }

    private static TopologyIntent derivePrimaryRoomPriority(TopologyWorkspace workspace, TopologyIntent intent) {
        if (!intent.primaryRoomPriority().isEmpty() || intent.editedCells().isEmpty()) {
            return intent;
        }
        LinkedHashSet<Long> roomIds = new LinkedHashSet<>();
        for (EditedCell editedCell : intent.editedCells()) {
            DungeonSquare square = workspace.currentSquaresByCoord().get(TopologyWorkspace.coordKey(editedCell.x(), editedCell.y()));
            if (square != null && square.roomId() != null) {
                roomIds.add(square.roomId());
            }
        }
        return roomIds.isEmpty() ? intent : intent.withPrimaryRoomPriority(List.copyOf(roomIds));
    }

    private static void reconcileRoomComponents(
            Connection conn,
            long mapId,
            TopologyIntent intent,
            TopologyWorkspace workspace
    ) throws SQLException {
        List<DungeonSquare> squares = workspace.currentSquares();
        List<DungeonRoom> rooms = workspace.rooms();
        if (squares.isEmpty()) {
            deleteAllRooms(conn, rooms);
            return;
        }

        List<RoomComponent> components = buildRoomComponents(squares, workspace.wallsByEdge(), workspace.passageEdges());
        Map<Long, Integer> largestComponentByRoomId = findLargestComponentByRoom(components, intent);
        int nextDefaultRoomNumber = PaintedSquareRoomAssigner.nextDefaultRoomNumber(rooms);
        Set<Long> retainedRoomIds = new HashSet<>();

        for (RoomComponent component : components) {
            ComponentAssignment assignment =
                    assignComponentRoom(conn, mapId, component, workspace.roomsById(), largestComponentByRoomId, intent, nextDefaultRoomNumber);
            retainedRoomIds.add(assignment.targetRoomId());
            if (assignment.createdNewRoom()) {
                nextDefaultRoomNumber++;
            }
            assignComponentSquares(conn, component.squares(), assignment.targetRoomId());
        }

        deleteUnretainedRooms(conn, rooms, retainedRoomIds);
    }

    private static ComponentAssignment assignComponentRoom(
            Connection conn,
            long mapId,
            RoomComponent component,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, Integer> largestComponentByRoomId,
            TopologyIntent intent,
            int nextDefaultRoomNumber
    ) throws SQLException {
        List<Long> retainableRoomIds = retainableRoomIds(component, largestComponentByRoomId);
        Long primaryRoomId = selectPreferredRoomId(retainableRoomIds, component.roomSquareCounts(), intent);
        if (primaryRoomId != null) {
            updatePrimaryRoom(conn, component, primaryRoomId, largestComponentByRoomId, roomsById, intent);
            return new ComponentAssignment(primaryRoomId, false);
        }

        DungeonRoom templateRoom = selectTemplateRoom(component, roomsById, intent);
        DungeonRoom newRoom = new DungeonRoom(
                null,
                mapId,
                "Raum #" + nextDefaultRoomNumber,
                templateRoom == null ? "" : coalesceText(templateRoom.description()),
                templateRoom == null ? null : templateRoom.areaId());
        return new ComponentAssignment(DungeonRoomRepository.upsertRoom(conn, newRoom), true);
    }

    private static void updatePrimaryRoom(
            Connection conn,
            RoomComponent component,
            long primaryRoomId,
            Map<Long, Integer> largestComponentByRoomId,
            Map<Long, DungeonRoom> roomsById,
            TopologyIntent intent
    ) throws SQLException {
        DungeonRoom primaryRoom = roomsById.get(primaryRoomId);
        if (primaryRoom == null) {
            return;
        }

        List<DungeonRoom> mergedRooms = mergedRooms(component, primaryRoomId, largestComponentByRoomId, roomsById, intent);
        upsertMergedMetadata(conn, primaryRoom, mergedRooms);
    }

    private static DungeonRoom selectTemplateRoom(
            RoomComponent component,
            Map<Long, DungeonRoom> roomsById,
            TopologyIntent intent
    ) {
        Long templateRoomId = selectPreferredRoomId(
                List.copyOf(component.roomIds()),
                component.roomSquareCounts(),
                intent);
        return templateRoomId == null ? null : roomsById.get(templateRoomId);
    }

    private static void upsertMergedMetadata(Connection conn, DungeonRoom primaryRoom, List<DungeonRoom> secondaryRooms) throws SQLException {
        String mergedDescription = mergeDescriptions(primaryRoom.description(), secondaryRooms);
        Long mergedAreaId = mergeAreaAssignment(primaryRoom.areaId(), secondaryRooms);
        if (sameText(primaryRoom.description(), mergedDescription) && sameNullableId(primaryRoom.areaId(), mergedAreaId)) {
            return;
        }
        DungeonRoomRepository.upsertRoom(conn, new DungeonRoom(
                primaryRoom.roomId(),
                primaryRoom.mapId(),
                primaryRoom.name(),
                mergedDescription,
                mergedAreaId));
    }

    private static List<DungeonRoom> mergedRooms(
            RoomComponent component,
            long primaryRoomId,
            Map<Long, Integer> largestComponentByRoomId,
            Map<Long, DungeonRoom> roomsById,
            TopologyIntent intent
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
        mergedRoomIds.sort(roomMergeComparator(component.roomSquareCounts(), intent));

        List<DungeonRoom> result = new ArrayList<>();
        for (Long roomId : mergedRoomIds) {
            DungeonRoom room = roomsById.get(roomId);
            if (room != null) {
                result.add(room);
            }
        }
        return result;
    }

    private static Long mergeAreaAssignment(Long primaryAreaId, List<DungeonRoom> mergedRooms) {
        if (primaryAreaId != null) {
            return primaryAreaId;
        }
        Long resolvedAreaId = null;
        for (DungeonRoom room : mergedRooms) {
            if (room == null || room.areaId() == null) {
                continue;
            }
            if (resolvedAreaId == null) {
                resolvedAreaId = room.areaId();
                continue;
            }
            if (!resolvedAreaId.equals(room.areaId())) {
                return null;
            }
        }
        return resolvedAreaId;
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

    private static boolean sameNullableId(Long left, Long right) {
        if (left == null && right == null) {
            return true;
        }
        if (left == null || right == null) {
            return false;
        }
        return left.equals(right);
    }

    private static List<RoomComponent> buildRoomComponents(
            List<DungeonSquare> squares,
            Map<String, DungeonWall> wallsByEdge,
            Set<String> passageEdges
    ) {
        Map<String, DungeonSquare> squaresByCoord = new HashMap<>();
        for (DungeonSquare square : squares) {
            squaresByCoord.put(TopologyWorkspace.coordKey(square.x(), square.y()), square);
        }

        Set<String> visited = new HashSet<>();
        List<RoomComponent> components = new ArrayList<>();
        int componentIndex = 0;
        for (DungeonSquare start : squares) {
            String startKey = TopologyWorkspace.coordKey(start.x(), start.y());
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
                enqueueRoomNeighbor(current, current.x() + 1, current.y(), squaresByCoord, wallsByEdge, passageEdges, visited, queue);
                enqueueRoomNeighbor(current, current.x() - 1, current.y(), squaresByCoord, wallsByEdge, passageEdges, visited, queue);
                enqueueRoomNeighbor(current, current.x(), current.y() + 1, squaresByCoord, wallsByEdge, passageEdges, visited, queue);
                enqueueRoomNeighbor(current, current.x(), current.y() - 1, squaresByCoord, wallsByEdge, passageEdges, visited, queue);
            }
            int minX = Integer.MAX_VALUE;
            int minY = Integer.MAX_VALUE;
            Set<String> squareCoords = new HashSet<>();
            for (DungeonSquare square : componentSquares) {
                minX = Math.min(minX, square.x());
                minY = Math.min(minY, square.y());
                squareCoords.add(TopologyWorkspace.coordKey(square.x(), square.y()));
            }
            components.add(new RoomComponent(componentIndex++, componentSquares, roomSquareCounts, roomIds, squareCoords, minX, minY));
        }
        return components;
    }

    private static void enqueueRoomNeighbor(
            DungeonSquare current,
            int neighborX,
            int neighborY,
            Map<String, DungeonSquare> squaresByCoord,
            Map<String, DungeonWall> wallsByEdge,
            Set<String> passageEdges,
            Set<String> visited,
            Deque<DungeonSquare> queue
    ) {
        DungeonSquare neighbor = squaresByCoord.get(TopologyWorkspace.coordKey(neighborX, neighborY));
        if (neighbor == null || edgeSeparates(current.x(), current.y(), neighborX, neighborY, wallsByEdge, passageEdges)) {
            return;
        }
        String key = TopologyWorkspace.coordKey(neighborX, neighborY);
        if (visited.add(key)) {
            queue.addLast(neighbor);
        }
    }

    private static boolean edgeSeparates(
            int x1,
            int y1,
            int x2,
            int y2,
            Map<String, DungeonWall> wallsByEdge,
            Set<String> passageEdges
    ) {
        if (x1 == x2) {
            int minY = Math.min(y1, y2);
            String edgeKey = PassageDirection.SOUTH.edgeKey(x1, minY);
            return wallsByEdge.containsKey(edgeKey) || passageEdges.contains(edgeKey);
        }
        int minX = Math.min(x1, x2);
        String edgeKey = PassageDirection.EAST.edgeKey(minX, y1);
        return wallsByEdge.containsKey(edgeKey) || passageEdges.contains(edgeKey);
    }

    private static Map<Long, Integer> findLargestComponentByRoom(
            List<RoomComponent> components,
            TopologyIntent intent
    ) {
        Map<Long, Integer> result = new HashMap<>();
        Map<Long, Integer> bestSizeByRoom = new HashMap<>();
        for (RoomComponent component : components) {
            for (Map.Entry<Long, Integer> entry : component.roomSquareCounts().entrySet()) {
                Long roomId = entry.getKey();
                if (roomId == null) {
                    continue;
                }
                int componentSize = entry.getValue();
                int currentBestSize = bestSizeByRoom.getOrDefault(roomId, -1);
                if (componentSize > currentBestSize) {
                    bestSizeByRoom.put(roomId, componentSize);
                    result.put(roomId, component.index());
                    continue;
                }
                if (componentSize == currentBestSize) {
                    RoomComponent currentBestComponent = components.get(result.get(roomId));
                    if (componentWinsTie(component, currentBestComponent, intent)) {
                        result.put(roomId, component.index());
                    }
                }
            }
        }
        return result;
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

    private static Comparator<Long> roomMergeComparator(Map<Long, Integer> roomSquareCounts, TopologyIntent intent) {
        Map<Long, Integer> preferredOrder = preferredOrder(intent);
        return Comparator
                .comparingInt((Long roomId) -> preferredOrder.getOrDefault(roomId, Integer.MAX_VALUE))
                .thenComparing((Long roomId) -> -roomSquareCounts.getOrDefault(roomId, 0))
                .thenComparingLong(Long::longValue);
    }

    private static Map<Long, Integer> preferredOrder(TopologyIntent intent) {
        Map<Long, Integer> order = new HashMap<>();
        if (intent == null) {
            return order;
        }
        List<Long> preferredPrimaryRoomIds = intent.primaryRoomPriority();
        for (int i = 0; i < preferredPrimaryRoomIds.size(); i++) {
            Long roomId = preferredPrimaryRoomIds.get(i);
            if (roomId != null) {
                order.putIfAbsent(roomId, i);
            }
        }
        return order;
    }

    private static boolean componentWinsTie(
            RoomComponent candidate,
            RoomComponent currentBest,
            TopologyIntent intent
    ) {
        int candidateEditedOrder = firstEditedCellOrder(candidate, intent);
        int currentEditedOrder = firstEditedCellOrder(currentBest, intent);
        if (candidateEditedOrder != currentEditedOrder) {
            return candidateEditedOrder < currentEditedOrder;
        }
        if (candidate.minY() != currentBest.minY()) {
            return candidate.minY() < currentBest.minY();
        }
        if (candidate.minX() != currentBest.minX()) {
            return candidate.minX() < currentBest.minX();
        }
        return candidate.index() < currentBest.index();
    }

    private static int firstEditedCellOrder(RoomComponent component, TopologyIntent intent) {
        if (intent == null || intent.componentPriorityCells().isEmpty()) {
            return Integer.MAX_VALUE;
        }
        for (int i = 0; i < intent.componentPriorityCells().size(); i++) {
            EditedCell editedCell = intent.componentPriorityCells().get(i);
            if (component.contains(editedCell.x(), editedCell.y())) {
                return i;
            }
        }
        return Integer.MAX_VALUE;
    }

    private static void assignComponentSquares(Connection conn, List<DungeonSquare> squares, long targetRoomId) throws SQLException {
        for (DungeonSquare square : squares) {
            if (square.roomId() == null || square.roomId() != targetRoomId) {
                DungeonSquareRepository.assignSquareRoom(conn, square.squareId(), targetRoomId);
            }
        }
    }

    private static void deleteUnretainedRooms(Connection conn, List<DungeonRoom> rooms, Set<Long> retainedRoomIds) throws SQLException {
        for (DungeonRoom room : rooms) {
            if (!retainedRoomIds.contains(room.roomId())) {
                DungeonRoomRepository.deleteRoom(conn, room.roomId());
            }
        }
    }

    private static void deleteAllRooms(Connection conn, List<DungeonRoom> rooms) throws SQLException {
        for (DungeonRoom room : rooms) {
            DungeonRoomRepository.deleteRoom(conn, room.roomId());
        }
    }

    private record ComponentAssignment(
            long targetRoomId,
            boolean createdNewRoom
    ) {
    }

    private record RoomComponent(
            int index,
            List<DungeonSquare> squares,
            Map<Long, Integer> roomSquareCounts,
            Set<Long> roomIds,
            Set<String> squareCoords,
            int minX,
            int minY
    ) {
        boolean contains(int x, int y) {
            return squareCoords.contains(TopologyWorkspace.coordKey(x, y));
        }
    }
}
