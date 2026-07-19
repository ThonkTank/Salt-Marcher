package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.FeatureMarkerChange;
import features.dungeon.application.authored.port.DungeonAuthoredLevelBounds;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class DungeonAuthoredLevelBoundsPatchTest {

    @Test
    void realPatchesMoveAndDeleteExtremaWithoutChangingOtherLevels(@TempDir Path tempDir) {
        DungeonMapIdentity mapId = new DungeonMapIdentity(41L);
        FeatureMarker minimum = marker(mapId, 101L, new Cell(-130, -70, 0));
        FeatureMarker maximum = marker(mapId, 102L, new Cell(140, 90, 0));
        FeatureMarker otherLevel = marker(mapId, 103L, new Cell(-999, 999, 1));
        FeatureMarker movedMinimum = marker(mapId, 101L, new Cell(-20, -10, 0));

        try (SqliteDatabase database = new SqliteDatabase(
                tempDir.resolve("level-bounds.db"), NoopDiagnostics.INSTANCE)) {
            DungeonSqliteFixtureSeeder.insertHeader(database, mapId.value(), "Bounds", 1L);
            DungeonSqliteFixtureSeeder.commit(database, DungeonPatch.of(mapId, 1L, List.of(
                    new FeatureMarkerChange(null, minimum),
                    new FeatureMarkerChange(null, maximum),
                    new FeatureMarkerChange(null, otherLevel))));
            DungeonSqliteWindowGateway gateway = new DungeonSqliteWindowGateway(database);

            assertEquals(new DungeonAuthoredLevelBounds(0, true, -130, -70, 140, 90),
                    bounds(gateway, mapId, 2L, 0));
            assertEquals(new DungeonAuthoredLevelBounds(1, true, -999, 999, -999, 999),
                    bounds(gateway, mapId, 2L, 1));

            DungeonSqliteFixtureSeeder.commit(database, DungeonPatch.of(mapId, 2L,
                    List.of(new FeatureMarkerChange(minimum, movedMinimum))));
            assertEquals(new DungeonAuthoredLevelBounds(0, true, -20, -10, 140, 90),
                    bounds(gateway, mapId, 3L, 0));
            assertEquals(new DungeonAuthoredLevelBounds(1, true, -999, 999, -999, 999),
                    bounds(gateway, mapId, 3L, 1));

            DungeonSqliteFixtureSeeder.commit(database, DungeonPatch.of(mapId, 3L,
                    List.of(new FeatureMarkerChange(maximum, null))));
            assertEquals(new DungeonAuthoredLevelBounds(0, true, -20, -10, -20, -10),
                    bounds(gateway, mapId, 4L, 0));

            DungeonSqliteFixtureSeeder.commit(database, DungeonPatch.of(mapId, 4L,
                    List.of(new FeatureMarkerChange(movedMinimum, null))));
            DungeonAuthoredLevelBounds empty = bounds(gateway, mapId, 5L, 0);
            assertFalse(empty.present());
            assertEquals(DungeonAuthoredLevelBounds.empty(0), empty);
            assertEquals(new DungeonAuthoredLevelBounds(1, true, -999, 999, -999, 999),
                    bounds(gateway, mapId, 5L, 1));
        }
    }

    private static DungeonAuthoredLevelBounds bounds(
            DungeonSqliteWindowGateway gateway,
            DungeonMapIdentity mapId,
            long generation,
            int level
    ) {
        return gateway.loadIndex(new DungeonWindowRequest(
                        mapId, generation, List.of(new DungeonChunkKey(mapId.value(), level, 0, 0))))
                .orElseThrow().authoredBounds().getFirst();
    }

    private static FeatureMarker marker(DungeonMapIdentity mapId, long id, Cell cell) {
        return new FeatureMarker(id, mapId, FeatureMarkerKind.OBJECT, cell, "Marker " + id, "");
    }
}
