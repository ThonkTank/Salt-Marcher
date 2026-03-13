package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.repository.feature.DungeonAreaRepository;
import features.world.dungeonmap.repository.map.DungeonMapRepository;
import features.world.dungeonmap.repository.map.DungeonRoomRepository;
import features.world.dungeonmap.repository.map.DungeonSquareRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class DungeonAreaNormalizationService {

    private DungeonAreaNormalizationService() {
        throw new AssertionError("No instances");
    }

    /*
     * Areas are normalized only from write workflows.
     * - A map only gets an initial fallback area once, when it still has no areas at all.
     * - Afterwards, every room must belong to an area.
     * - Reassignment uses only rooms that were already assigned when normalization started.
     */
    public static void normalizeMapAreas(Connection conn, long mapId) throws SQLException {
        DungeonMap map = DungeonMapRepository.findMap(conn, mapId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + mapId));
        if (map == null || map.mapId() == null) {
            throw new IllegalArgumentException("map must be persisted");
        }
        ensureInitialAreaExists(conn, map);
        assignUnassignedRooms(conn, map.mapId(), DungeonAreaRepository.getAreas(conn, map.mapId()));
    }

    private static void ensureInitialAreaExists(Connection conn, DungeonMap map) throws SQLException {
        if (map == null || map.mapId() == null) {
            throw new IllegalArgumentException("map must be persisted");
        }
        List<DungeonArea> areas = DungeonAreaRepository.getAreas(conn, map.mapId());
        if (!areas.isEmpty()) {
            return;
        }
        DungeonAreaRepository.upsertArea(conn, new DungeonArea(
                null,
                map.mapId(),
                map.name(),
                DungeonArea.DEFAULT_ENCOUNTER_EVERY_HOURS,
                List.of()));
    }

    private static void assignUnassignedRooms(Connection conn, long mapId, List<DungeonArea> areas) throws SQLException {
        if (areas == null || areas.isEmpty()) {
            return;
        }

        Long fallbackAreaId = oldestAreaId(areas);
        if (fallbackAreaId == null) {
            return;
        }

        List<DungeonRoom> rooms = DungeonRoomRepository.getRooms(conn, mapId);
        List<DungeonSquare> squares = DungeonSquareRepository.getSquares(conn, mapId);
        Map<Long, List<DungeonSquare>> squaresByRoomId = new HashMap<>();
        List<DungeonRoom> authoritativeRooms = new ArrayList<>();
        for (DungeonRoom room : rooms) {
            if (room != null && room.roomId() != null && room.areaId() != null) {
                authoritativeRooms.add(room);
            }
        }
        for (DungeonSquare square : squares) {
            if (square != null && square.roomId() != null) {
                squaresByRoomId.computeIfAbsent(square.roomId(), ignored -> new ArrayList<>()).add(square);
            }
        }

        List<DungeonRoom> unassignedRooms = new ArrayList<>();
        for (DungeonRoom room : rooms) {
            if (room != null && room.roomId() != null && room.areaId() == null) {
                unassignedRooms.add(room);
            }
        }
        unassignedRooms.sort(Comparator.comparing(DungeonRoom::roomId));

        for (DungeonRoom room : unassignedRooms) {
            Long resolvedAreaId = findNearestAssignedArea(room, authoritativeRooms, squaresByRoomId);
            if (resolvedAreaId == null) {
                resolvedAreaId = fallbackAreaId;
            }
            DungeonRoomRepository.assignRoomArea(conn, room.roomId(), resolvedAreaId);
        }
    }

    private static Long oldestAreaId(List<DungeonArea> areas) {
        for (DungeonArea area : areas) {
            if (area != null && area.areaId() != null) {
                return area.areaId();
            }
        }
        return null;
    }

    private static Long findNearestAssignedArea(
            DungeonRoom room,
            List<DungeonRoom> authoritativeRooms,
            Map<Long, List<DungeonSquare>> squaresByRoomId
    ) {
        if (room == null || room.roomId() == null) {
            return null;
        }
        List<DungeonSquare> sourceSquares = squaresByRoomId.get(room.roomId());
        if (sourceSquares == null || sourceSquares.isEmpty()) {
            return null;
        }

        long bestDistance = Long.MAX_VALUE;
        Long bestAreaId = null;
        Long bestRoomId = null;
        for (DungeonRoom candidate : authoritativeRooms) {
            if (candidate == null
                    || candidate.roomId() == null
                    || candidate.areaId() == null
                    || candidate.roomId().equals(room.roomId())) {
                continue;
            }
            List<DungeonSquare> candidateSquares = squaresByRoomId.get(candidate.roomId());
            if (candidateSquares == null || candidateSquares.isEmpty()) {
                continue;
            }
            long distance = minSquareDistance(sourceSquares, candidateSquares, bestDistance);
            if (distance < bestDistance
                    || (distance == bestDistance && (bestRoomId == null || candidate.roomId() < bestRoomId))) {
                bestDistance = distance;
                bestAreaId = candidate.areaId();
                bestRoomId = candidate.roomId();
            }
        }
        return bestAreaId;
    }

    private static long minSquareDistance(List<DungeonSquare> sourceSquares, List<DungeonSquare> candidateSquares, long currentBest) {
        long bestDistance = currentBest;
        for (DungeonSquare source : sourceSquares) {
            for (DungeonSquare candidate : candidateSquares) {
                long distance = Math.abs(source.x() - candidate.x()) + Math.abs(source.y() - candidate.y());
                if (distance < bestDistance) {
                    bestDistance = distance;
                    if (bestDistance <= 1) {
                        return bestDistance;
                    }
                }
            }
        }
        return bestDistance;
    }
}
