package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.adapter.sqlite.model.DungeonGridBoundsRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.FeatureMarkerChange;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class DungeonSqlitePatchGatewayCleanupFailureTest {

    private static final long MAP_ID = 79L;
    private static final DungeonMapIdentity MAP = new DungeonMapIdentity(MAP_ID);

    @Test
    void returnsCommittedWhenRestoringAndClosingTheConnectionFailAfterCommit(@TempDir Path directory)
            throws Exception {
        Path path = directory.resolve("post-commit-cleanup.sqlite");
        AtomicBoolean restoreAttempted = new AtomicBoolean();
        AtomicBoolean closeAttempted = new AtomicBoolean();
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            DungeonSqliteFixtureSeeder.seed(database, List.of(
                    new DungeonMapRecord(MAP_ID, "Cleanup map", 1L, DungeonGridBoundsRecord.defaultGrid())));
            DungeonSqlitePatchGateway gateway = new DungeonSqlitePatchGateway(
                    () -> cleanupFailingConnection(
                            DriverManager.getConnection("jdbc:sqlite:" + path),
                            restoreAttempted,
                            closeAttempted),
                    DungeonSqlitePatchGateway.FailureHook.NONE);

            assertInstanceOf(DungeonSqlitePatchGateway.CommitOutcome.Committed.class,
                    gateway.commit(markerPatch()));
        }

        assertTrue(restoreAttempted.get());
        assertTrue(closeAttempted.get());
        assertEquals(2L, scalar(path, "SELECT revision FROM dungeon_maps WHERE dungeon_map_id=79"));
        assertEquals(1L, scalar(path, "SELECT COUNT(*) FROM dungeon_feature_markers"));
    }

    private static Connection cleanupFailingConnection(
            Connection delegate,
            AtomicBoolean restoreAttempted,
            AtomicBoolean closeAttempted
    ) {
        AtomicBoolean committed = new AtomicBoolean();
        return (Connection) Proxy.newProxyInstance(
                Connection.class.getClassLoader(),
                new Class<?>[]{Connection.class},
                (proxy, method, arguments) -> {
                    if (method.getName().equals("commit")) {
                        Object result = invoke(delegate, method, arguments);
                        committed.set(true);
                        return result;
                    }
                    if (method.getName().equals("setAutoCommit")
                            && committed.get()
                            && Boolean.TRUE.equals(arguments[0])) {
                        restoreAttempted.set(true);
                        throw new SQLException("injected post-commit auto-commit restore failure");
                    }
                    if (method.getName().equals("close") && committed.get()) {
                        closeAttempted.set(true);
                        delegate.close();
                        throw new SQLException("injected post-commit close failure");
                    }
                    return invoke(delegate, method, arguments);
                });
    }

    private static Object invoke(Connection delegate, java.lang.reflect.Method method, Object[] arguments)
            throws Throwable {
        try {
            return method.invoke(delegate, arguments);
        } catch (InvocationTargetException failure) {
            throw failure.getCause();
        }
    }

    private static DungeonPatch markerPatch() {
        FeatureMarker marker = new FeatureMarker(
                791L,
                MAP,
                FeatureMarkerKind.POI,
                new Cell(2, 3, 0),
                "Committed marker",
                "must remain");
        return DungeonPatch.of(MAP, 1L, List.of(new FeatureMarkerChange(null, marker)));
    }

    private static long scalar(Path path, String sql) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
             var statement = connection.createStatement();
             var rows = statement.executeQuery(sql)) {
            return rows.getLong(1);
        }
    }
}
