package features.dungeon.adapter.sqlite.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;

import features.dungeon.application.authored.port.DungeonIdentityKind;
import features.dungeon.application.authored.port.DungeonIdentityRange;
import java.nio.file.Path;
import java.sql.DriverManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class SqliteDungeonIdentityAllocatorTest {

    @Test
    void reservesTypedContiguousRangesWithoutPlaceholderAuthoredRows(@TempDir Path directory) throws Exception {
        Path path = directory.resolve("identity-ranges.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqliteDungeonIdentityAllocator allocator = new SqliteDungeonIdentityAllocator(database);

            for (DungeonIdentityKind kind : DungeonIdentityKind.values()) {
                DungeonIdentityRange first = allocator.reserve(kind, 3);
                DungeonIdentityRange second = allocator.reserve(kind, 2);
                assertEquals(1L, first.firstId(), kind.name());
                assertEquals(3L, first.idAt(2), kind.name());
                assertEquals(4L, second.firstId(), kind.name());
                assertEquals(5L, second.idAt(1), kind.name());
            }

            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_maps"));
            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_stairs"));
            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_transitions"));
            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_feature_markers"));
            assertEquals(DungeonIdentityKind.values().length,
                    scalar(path, "SELECT COUNT(*) FROM dungeon_identity_sequences"));
            assertEquals(6L, scalar(path, "SELECT MIN(next_id) FROM dungeon_identity_sequences"));
            assertEquals(6L, scalar(path, "SELECT MAX(next_id) FROM dungeon_identity_sequences"));
        }
    }

    private static long scalar(Path path, String sql) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
             var statement = connection.createStatement();
             var rows = statement.executeQuery(sql)) {
            return rows.getLong(1);
        }
    }
}
