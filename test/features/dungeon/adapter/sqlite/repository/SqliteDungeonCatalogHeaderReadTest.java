package features.dungeon.adapter.sqlite.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;

import features.dungeon.application.authored.port.DungeonMapHeader;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

import java.nio.file.Path;

final class SqliteDungeonCatalogHeaderReadTest {

    @Test
    void findAndFirstReadOnlyMetadataInCatalogOrder(@TempDir Path directory) {
        Path path = directory.resolve("catalog-headers.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqliteDungeonCatalogStore catalog = new SqliteDungeonCatalogStore(
                            TestFeatureStores.store(
                                    database,
                                    features.dungeon.adapter.sqlite.gateway.DungeonStoreDefinition
                                            .create()));
            DungeonMapHeader zeta = catalog.create("Zeta");
            DungeonMapHeader alpha = catalog.create("Alpha");

            assertEquals(alpha, catalog.find(alpha.mapId()).orElseThrow());
            assertEquals("Alpha", catalog.first().orElseThrow().mapName());
            assertEquals(zeta.revision(), catalog.find(zeta.mapId()).orElseThrow().revision());
        }
    }
}
