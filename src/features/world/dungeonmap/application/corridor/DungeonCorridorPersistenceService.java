package features.world.dungeonmap.application.corridor;

import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;
import java.util.Objects;

public final class DungeonCorridorPersistenceService {

    private final DungeonCorridorWriteRepository corridorWriteRepository;

    public DungeonCorridorPersistenceService(DungeonCorridorWriteRepository corridorWriteRepository) {
        this.corridorWriteRepository = Objects.requireNonNull(corridorWriteRepository, "corridorWriteRepository");
    }

    public void persistCorridor(Connection conn, Corridor corridor) throws SQLException {
        if (corridor == null || corridor.corridorId() == null) {
            return;
        }
        if (!corridor.isPersistable()) {
            corridorWriteRepository.deleteCorridor(conn, corridor.corridorId());
            return;
        }
        corridorWriteRepository.replaceCorridorRooms(conn, corridor.corridorId(), corridor.roomIds());
        corridorWriteRepository.replaceCorridorWaypoints(conn, corridor.corridorId(), corridor.bindings().waypoints());
        corridorWriteRepository.replaceCorridorDoorBindings(conn, corridor.corridorId(), corridor.bindings().doorBindings());
    }

    public void persistCorridors(Connection conn, Map<Long, Corridor> corridorsById) throws SQLException {
        if (corridorsById == null || corridorsById.isEmpty()) {
            return;
        }
        for (Corridor corridor : corridorsById.values()) {
            persistCorridor(conn, corridor);
        }
    }
}
