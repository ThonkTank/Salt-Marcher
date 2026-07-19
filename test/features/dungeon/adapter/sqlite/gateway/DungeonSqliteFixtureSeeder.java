package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.repository.SqliteDungeonUnitOfWork;
import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.port.DungeonCompoundUnitOfWorkResult;
import features.dungeon.application.authored.port.DungeonUnitOfWorkResult;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.Objects;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;

/** Test-only setup through explicit map headers and the real patch unit of work. */
public final class DungeonSqliteFixtureSeeder {

    private DungeonSqliteFixtureSeeder() {
    }

    public static void insertHeader(
            SqliteDatabase database,
            long mapId,
            String name,
            long revision
    ) {
        if (mapId <= 0L || revision < 1L) {
            throw new IllegalArgumentException("fixture map identity and revision must be positive");
        }
        try (Connection connection = connections(database).openConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "INSERT INTO dungeon_maps(dungeon_map_id,name,revision) VALUES(?,?,?)")) {
            statement.setLong(1, mapId);
            statement.setString(2, name == null || name.isBlank() ? "Dungeon " + mapId : name.trim());
            statement.setLong(3, revision);
            statement.executeUpdate();
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to insert Dungeon fixture header.", exception);
        }
    }

    public static DungeonUnitOfWorkResult.Committed commit(
            SqliteDatabase database,
            DungeonPatch patch
    ) {
        DungeonUnitOfWorkResult result = new SqliteDungeonUnitOfWork(
                Objects.requireNonNull(database, "database")).commit(Objects.requireNonNull(patch, "patch"));
        if (result instanceof DungeonUnitOfWorkResult.Committed committed) {
            return committed;
        }
        DungeonUnitOfWorkResult.Rejected rejected = (DungeonUnitOfWorkResult.Rejected) result;
        throw new IllegalStateException("Dungeon fixture patch was rejected: " + rejected.reason());
    }

    public static DungeonCompoundUnitOfWorkResult.Committed commit(
            SqliteDatabase database,
            DungeonCompoundPatch patch
    ) {
        DungeonCompoundUnitOfWorkResult result = new SqliteDungeonUnitOfWork(
                Objects.requireNonNull(database, "database")).commit(Objects.requireNonNull(patch, "patch"));
        if (result instanceof DungeonCompoundUnitOfWorkResult.Committed committed) {
            return committed;
        }
        DungeonCompoundUnitOfWorkResult.Rejected rejected = (DungeonCompoundUnitOfWorkResult.Rejected) result;
        throw new IllegalStateException(
                "Dungeon compound fixture patch was rejected for map "
                        + rejected.mapId().value() + ": " + rejected.reason());
    }

    private static SqliteConnectionSource connections(SqliteDatabase database) {
        DungeonSqliteSchemaManager schema = new DungeonSqliteSchemaManager();
        return Objects.requireNonNull(database, "database").connections(
                "dungeon",
                new SqliteMigration(1, schema::ensureSchema),
                new SqliteMigration(2, schema::ensureSchema),
                new SqliteMigration(3, schema::replaceWithCanonicalSchema),
                new SqliteMigration(4, schema::addCorridorDoorLevel),
                new SqliteMigration(5, schema::addCorridorRouteCellIndex),
                new SqliteMigration(6, schema::addCorridorRouteDependencyIndex));
    }
}
