package features.creatures.adapter.sqlite.query;

import static org.junit.jupiter.api.Assertions.assertEquals;

import features.creatures.CreaturesServiceAssembly;
import features.creatures.api.CreatureFactsQuery;
import features.creatures.api.CreatureFactsSnapshotResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;
import platform.ui.DirectUiDispatcher;

import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.List;

final class CreatureFactsSqliteTest {

    @TempDir
    Path directory;

    @Test
    void loadsCompleteSortedXpAndIdUnionsWithoutLimitOrPublishedState() throws Exception {
        Path path = directory.resolve("creature-facts.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            CreaturesServiceAssembly.Component creatures = CreaturesServiceAssembly.create(
                    TestFeatureStores.store(database, CreaturesServiceAssembly.storeDefinition()),
                    DirectExecutionLane.INSTANCE,
                    DirectExecutionLane.INSTANCE,
                    DirectUiDispatcher.INSTANCE,
                    NoopDiagnostics.INSTANCE);
            creatures.catalogQueries().loadFilterOptions().toCompletableFuture().join();
            insert(path, 31L, "Third", "1/2", 100);
            insert(path, 11L, "First", "1/4", 50);
            insert(path, 21L, "Second", "1/2", 100);
            insert(path, 41L, "Unrequested", "1", 200);

            CreatureFactsSnapshotResult xp = creatures.application().loadFacts(
                    CreatureFactsQuery.forXpValues(List.of(100L, 50L, 100L)))
                    .toCompletableFuture().join();
            assertEquals(CreatureFactsSnapshotResult.Status.SUCCESS, xp.status());
            assertEquals(List.of(11L, 21L, 31L), xp.creatures().stream()
                    .map(candidate -> candidate.id()).toList());

            CreatureFactsSnapshotResult ids = creatures.application().loadFacts(
                    CreatureFactsQuery.forCreatureIds(List.of(31L, 11L, 999L)))
                    .toCompletableFuture().join();
            assertEquals(CreatureFactsSnapshotResult.Status.SUCCESS, ids.status());
            assertEquals(List.of(11L, 31L), ids.creatures().stream()
                    .map(candidate -> candidate.id()).toList());
        }
    }

    private static void insert(Path path, long id, String name, String cr, int xp) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
                var statement = connection.prepareStatement(
                                "INSERT INTO creatures"
                                    + " (id,name,size,creature_type,alignment,cr,xp,hp,ac) VALUES"
                                    + " (?,?,?,?,?,?,?,?,?)")) {
            statement.setLong(1, id);
            statement.setString(2, name);
            statement.setString(3, "Medium");
            statement.setString(4, "humanoid");
            statement.setString(5, "neutral");
            statement.setString(6, cr);
            statement.setInt(7, xp);
            statement.setInt(8, 10);
            statement.setInt(9, 12);
            statement.executeUpdate();
        }
    }
}
