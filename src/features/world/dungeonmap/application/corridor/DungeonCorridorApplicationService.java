package features.world.dungeonmap.application.corridor;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.repository.DungeonCorridorRepository;
import features.world.dungeonmap.repository.DungeonLayoutRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public final class DungeonCorridorApplicationService {

    private final DungeonLayoutRepository layoutRepository;
    private final DungeonCorridorRepository corridorRepository;

    public DungeonCorridorApplicationService(
            DungeonLayoutRepository layoutRepository,
            DungeonCorridorRepository corridorRepository
    ) {
        this.layoutRepository = Objects.requireNonNull(layoutRepository, "layoutRepository");
        this.corridorRepository = Objects.requireNonNull(corridorRepository, "corridorRepository");
    }

    public long create(long mapId, Corridor corridor) throws SQLException {
        if (mapId <= 0 || corridor == null) {
            throw new IllegalArgumentException("Corridor create requires map and corridor");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                Corridor persisted = corridorRepository.save(conn, mapId, corridor, layout.rooms());
                if (persisted.corridorId() == null) {
                    throw new SQLException("No id returned for persisted corridor");
                }
                return persisted.corridorId();
            });
        }
    }

    public void update(long mapId, Corridor corridor) throws SQLException {
        if (mapId <= 0 || corridor == null || corridor.corridorId() == null) {
            throw new IllegalArgumentException("Corridor update requires persisted corridor");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                if (layout.findCorridor(corridor.corridorId()) == null) {
                    throw new SQLException("Corridor " + corridor.corridorId() + " existiert nicht");
                }
                corridorRepository.save(conn, mapId, corridor, layout.rooms());
            });
        }
    }

    public void delete(long mapId, long corridorId) throws SQLException {
        if (mapId <= 0 || corridorId <= 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                if (layout.findCorridor(corridorId) == null) {
                    return;
                }
                corridorRepository.deleteCorridor(conn, corridorId);
            });
        }
    }

    private DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        DungeonLayout layout = layoutRepository.loadLayout(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }
}
