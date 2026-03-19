package features.world.quarantine.dungeonmap.corridors.application;
import features.world.quarantine.dungeonmap.layout.application.DungeonTopologyEditResultLoader;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayoutEditResult;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.persistence.DungeonCorridorPersistenceRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

public final class DungeonCorridorCommandService {

    public DungeonLayoutEditResult createCorridor(Connection conn, DungeonLayout layout, long mapId, List<Long> roomIds) throws SQLException {
        List<Long> normalizedRoomIds = roomIds == null ? List.of() : roomIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (normalizedRoomIds.size() == 2) {
            Long existingCorridorId = findCorridorContainingAllRooms(layout, normalizedRoomIds);
            if (existingCorridorId != null) {
                return DungeonTopologyEditResultLoader.loadCorridorEditResult(conn, mapId, existingCorridorId);
            }
        }
        long corridorId = DungeonCorridorPersistenceRepository.insertCorridor(conn, mapId, roomIds);
        return DungeonTopologyEditResultLoader.loadCorridorEditResult(conn, mapId, corridorId);
    }

    public DungeonLayoutEditResult addRoomToCorridor(Connection conn, DungeonLayout layout, long mapId, long corridorId, long roomId) throws SQLException {
        DungeonCorridorPersistenceRepository.addRoomToCorridor(conn, mapId, corridorId, roomId);
        return DungeonTopologyEditResultLoader.loadCorridorEditResult(conn, mapId, corridorId);
    }

    public DungeonLayoutEditResult mergeCorridors(Connection conn, DungeonLayout layout, long mapId, long keptCorridorId, long mergedCorridorId) throws SQLException {
        if (keptCorridorId == mergedCorridorId) {
            return DungeonTopologyEditResultLoader.loadCorridorEditResult(conn, mapId, keptCorridorId);
        }
        DungeonCorridor keptCorridor = DungeonTopologyEditResultLoader.requireCorridor(layout, keptCorridorId);
        DungeonCorridor mergedCorridor = DungeonTopologyEditResultLoader.requireCorridor(layout, mergedCorridorId);
        LinkedHashSet<Long> mergedRoomIds = new LinkedHashSet<>(keptCorridor.roomIds());
        mergedRoomIds.addAll(mergedCorridor.roomIds());
        DungeonCorridorPersistenceRepository.replaceCorridorRooms(conn, mapId, keptCorridorId, List.copyOf(mergedRoomIds));
        DungeonCorridorPersistenceRepository.deleteCorridor(conn, mapId, mergedCorridorId);
        return DungeonTopologyEditResultLoader.loadCorridorEditResult(conn, mapId, keptCorridorId);
    }

    public DungeonLayoutEditResult removeRoomFromCorridor(Connection conn, DungeonLayout layout, long mapId, long corridorId, long roomId) throws SQLException {
        DungeonCorridorPersistenceRepository.removeRoomFromCorridor(conn, mapId, corridorId, roomId);
        return DungeonTopologyEditResultLoader.loadCorridorEditResult(conn, mapId, corridorId);
    }

    public DungeonLayoutEditResult removeRoomFromCorridors(Connection conn, DungeonLayout layout, long mapId, List<Long> corridorIds, long roomId) throws SQLException {
        Long focusCorridorId = corridorIds == null || corridorIds.isEmpty() ? null : corridorIds.get(0);
        if (corridorIds != null) {
            for (Long corridorId : corridorIds) {
                if (corridorId != null) {
                    DungeonCorridorPersistenceRepository.removeRoomFromCorridor(conn, mapId, corridorId, roomId);
                }
            }
        }
        return DungeonTopologyEditResultLoader.loadCorridorEditResult(conn, mapId, focusCorridorId);
    }

    public DungeonLayoutEditResult deleteCorridor(Connection conn, DungeonLayout layout, long mapId, long corridorId) throws SQLException {
        DungeonCorridorPersistenceRepository.deleteCorridor(conn, mapId, corridorId);
        return DungeonTopologyEditResultLoader.loadCorridorEditResult(conn, mapId, null);
    }

    private static Long findCorridorContainingAllRooms(DungeonLayout layout, List<Long> roomIds) {
        if (layout == null || roomIds == null || roomIds.size() < 2) {
            return null;
        }
        return layout.corridors().stream()
                .filter(corridor -> corridor.corridorId() != null)
                .filter(corridor -> corridor.roomIds().containsAll(roomIds))
                .map(DungeonCorridor::corridorId)
                .findFirst()
                .orElse(null);
    }
}
