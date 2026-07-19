package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.repository.SqliteDungeonUnitOfWork;
import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.port.DungeonCompoundUnitOfWorkResult;
import features.dungeon.application.authored.port.DungeonUnitOfWorkResult;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.Objects;

/** Test-only setup through explicit map headers and the real patch unit of work. */
public final class DungeonSqliteFixtureSeeder {

    private DungeonSqliteFixtureSeeder() {
    }

    public static Fixture prepare(SqliteDatabase database) {
        return new Fixture(TestFeatureStores.store(
                Objects.requireNonNull(database, "database"), DungeonStoreDefinition.create()));
    }

    public static void insertHeader(
            SqliteDatabase database, long mapId, String name, long revision) {
        prepare(database).insertHeader(mapId, name, revision);
    }

    public static DungeonUnitOfWorkResult.Committed commit(
            SqliteDatabase database, DungeonPatch patch) {
        return prepare(database).commit(patch);
    }

    public static DungeonCompoundUnitOfWorkResult.Committed commit(
            SqliteDatabase database, DungeonCompoundPatch patch) {
        return prepare(database).commit(patch);
    }

    public record Fixture(FeatureStoreHandle store) {

        public Fixture {
            Objects.requireNonNull(store, "store");
        }

        public void insertHeader(
            long mapId,
            String name,
            long revision
        ) {
            if (mapId <= 0L || revision < 1L) {
                throw new IllegalArgumentException("fixture map identity and revision must be positive");
            }
            try (Connection connection = store.openConnection();
                 PreparedStatement statement = connection.prepareStatement(
                                    "INSERT INTO dungeon_maps(dungeon_map_id,name,revision)"
                                        + " VALUES(?,?,?)")) {
                statement.setLong(1, mapId);
                statement.setString(2, name == null || name.isBlank() ? "Dungeon " + mapId : name.trim());
                statement.setLong(3, revision);
                statement.executeUpdate();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to insert Dungeon fixture header.", exception);
            }
        }

        public DungeonUnitOfWorkResult.Committed commit(DungeonPatch patch) {
            DungeonUnitOfWorkResult result = new SqliteDungeonUnitOfWork(store)
                    .commit(Objects.requireNonNull(patch, "patch"));
            if (result instanceof DungeonUnitOfWorkResult.Committed committed) {
                return committed;
            }
            DungeonUnitOfWorkResult.Rejected rejected = (DungeonUnitOfWorkResult.Rejected) result;
            throw new IllegalStateException("Dungeon fixture patch was rejected: " + rejected.reason());
        }

        public DungeonCompoundUnitOfWorkResult.Committed commit(DungeonCompoundPatch patch) {
            DungeonCompoundUnitOfWorkResult result = new SqliteDungeonUnitOfWork(store)
                    .commit(Objects.requireNonNull(patch, "patch"));
            if (result instanceof DungeonCompoundUnitOfWorkResult.Committed committed) {
                return committed;
            }
            DungeonCompoundUnitOfWorkResult.Rejected rejected =
                    (DungeonCompoundUnitOfWorkResult.Rejected) result;
            throw new IllegalStateException(
                    "Dungeon compound fixture patch was rejected for map "
                            + rejected.mapId().value() + ": " + rejected.reason());
        }
    }
}
