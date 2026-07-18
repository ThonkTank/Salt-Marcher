package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;

import features.dungeon.adapter.sqlite.model.DungeonFeatureMarkerRecord;
import features.dungeon.adapter.sqlite.model.DungeonGridBoundsRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonEntitySnapshot;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class DungeonSqliteReadSnapshotTest {

    private static final long MAP_ID = 88L;
    private static final long MARKER_ID = 901L;
    private static final long OLD_REVISION = 9L;

    @Test
    void windowCannotCombineOldHeaderWithConcurrentNewEntityFacts(@TempDir Path tempDir) throws Exception {
        Path path = tempDir.resolve("window-snapshot.db");
        try (SqliteDatabase database = savedDatabase(path)) {
            enableWal(path);
            ConcurrentUpdate update = new ConcurrentUpdate(path);
            DungeonSqliteWindowGateway gateway = new DungeonSqliteWindowGateway(database, update::afterHeaderRead);
            update.start();

            DungeonWindow window = gateway.loadWindow(new DungeonWindowRequest(
                    new DungeonMapIdentity(MAP_ID),
                    4L,
                    List.of(new DungeonChunkKey(MAP_ID, 0, 1, 0))))
                    .orElseThrow();
            update.joinAndAssert();

            assertEquals(OLD_REVISION, window.mapHeader().revision());
            DungeonWindowEntityFragment.FeatureMarker marker = assertInstanceOf(
                    DungeonWindowEntityFragment.FeatureMarker.class,
                    window.fragments().getFirst());
            assertEquals("old marker", marker.label());
            assertCommittedNewState(path);
        }
    }

    @Test
    void closureCannotCombineOldRevisionWithConcurrentNewEntityFacts(@TempDir Path tempDir) throws Exception {
        Path path = tempDir.resolve("closure-snapshot.db");
        try (SqliteDatabase database = savedDatabase(path)) {
            enableWal(path);
            ConcurrentUpdate update = new ConcurrentUpdate(path);
            DungeonSqliteWindowGateway gateway = new DungeonSqliteWindowGateway(database, update::afterHeaderRead);
            update.start();

            DungeonIdentityClosureResult.Complete closure = assertInstanceOf(
                    DungeonIdentityClosureResult.Complete.class,
                    gateway.loadIdentityClosure(new DungeonIdentityClosureRequest(
                            new DungeonMapIdentity(MAP_ID),
                            OLD_REVISION,
                            List.of(DungeonPatchEntityRef.featureMarker(MARKER_ID)))));
            update.joinAndAssert();

            assertEquals(OLD_REVISION, closure.mapHeader().revision());
            DungeonEntitySnapshot.FeatureMarkerSnapshot marker = assertInstanceOf(
                    DungeonEntitySnapshot.FeatureMarkerSnapshot.class,
                    closure.entities().getFirst());
            assertEquals("old marker", marker.value().label());
            assertCommittedNewState(path);
        }
    }

    private static SqliteDatabase savedDatabase(Path path) {
        SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE);
        new DungeonSqliteGateway(database).saveMaps(List.of(new DungeonMapRecord(
                MAP_ID,
                "Snapshot map",
                OLD_REVISION,
                DungeonGridBoundsRecord.defaultGrid(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(new DungeonFeatureMarkerRecord(
                        MARKER_ID, MAP_ID, "OBJECT", 64, 0, 0,
                        "old marker", "old description")))));
        return database;
    }

    private static void enableWal(Path path) throws SQLException {
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            try (ResultSet rows = statement.executeQuery("PRAGMA journal_mode=WAL")) {
                assertEquals("wal", rows.next() ? rows.getString(1).toLowerCase() : "");
            }
        }
    }

    private static void assertCommittedNewState(Path path) throws SQLException {
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            try (ResultSet rows = statement.executeQuery(
                    "SELECT revision FROM dungeon_maps WHERE dungeon_map_id=" + MAP_ID)) {
                assertEquals(10L, rows.next() ? rows.getLong(1) : 0L);
            }
            try (ResultSet rows = statement.executeQuery(
                    "SELECT label FROM dungeon_feature_markers WHERE feature_marker_id=" + MARKER_ID)) {
                assertEquals("new marker", rows.next() ? rows.getString(1) : "");
            }
        }
    }

    private static Connection open(Path path) throws SQLException {
        Connection connection = DriverManager.getConnection("jdbc:sqlite:" + path.toAbsolutePath());
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=ON");
            statement.execute("PRAGMA busy_timeout=10000");
        }
        return connection;
    }

    private static final class ConcurrentUpdate {
        private final Path path;
        private final CountDownLatch headerRead = new CountDownLatch(1);
        private final CountDownLatch writerCommitted = new CountDownLatch(1);
        private final AtomicReference<Throwable> failure = new AtomicReference<>();
        private Thread writer;

        private ConcurrentUpdate(Path path) {
            this.path = path;
        }

        private void start() {
            writer = new Thread(() -> {
                try {
                    if (!headerRead.await(10L, TimeUnit.SECONDS)) {
                        throw new AssertionError("reader never reached the header snapshot");
                    }
                    try (Connection connection = open(path)) {
                        connection.setAutoCommit(false);
                        try (Statement statement = connection.createStatement()) {
                            statement.executeUpdate(
                                    "UPDATE dungeon_maps SET revision=10 WHERE dungeon_map_id=" + MAP_ID);
                            statement.executeUpdate(
                                    "UPDATE dungeon_feature_markers SET label='new marker'"
                                            + " WHERE feature_marker_id=" + MARKER_ID);
                        }
                        connection.commit();
                    }
                } catch (Throwable exception) {
                    failure.set(exception);
                } finally {
                    writerCommitted.countDown();
                }
            }, "dungeon-window-concurrent-writer");
            writer.setDaemon(true);
            writer.start();
        }

        private void afterHeaderRead() {
            headerRead.countDown();
            try {
                if (!writerCommitted.await(10L, TimeUnit.SECONDS)) {
                    throw new AssertionError("concurrent writer did not commit");
                }
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new AssertionError("interrupted while waiting for concurrent writer", exception);
            }
        }

        private void joinAndAssert() throws InterruptedException {
            writer.join(10_000L);
            assertNull(failure.get(), () -> "concurrent writer failed: " + failure.get());
        }
    }
}
