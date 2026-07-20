package architecture.dungeon;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

final class DungeonWholeMapResidueTest {

    private static final List<String> FORBIDDEN = List.of(
            "DungeonMapRepository",
            "SqliteDungeonMapRepository",
            "DungeonMapRecord",
            "DungeonGridBoundsRecord",
            "DungeonMapRecordMapper",
            "DungeonSqliteMapRecordLoader",
            "DungeonSqliteMapRecordWriter",
            "DungeonSqliteChunkWriter",
            "DungeonSqliteIdentityReservation",
            "DungeonSqliteFixtureSpatialIndex");

    @Test
    void productionAndDungeonFixturesContainNoWholeMapCompatibilityResidue() throws Exception {
        List<String> findings = new ArrayList<>();
        scan(Path.of("features/dungeon"), findings);
        scan(Path.of("test/features/dungeon"), findings);
        assertEquals(List.of(), findings);
    }

    private static void scan(Path root, List<String> findings) throws Exception {
        try (var files = Files.walk(root)) {
            for (Path file : files.filter(path -> path.toString().endsWith(".java")).toList()) {
                if (file.getFileName().toString().equals("DungeonWholeMapResidueTest.java")) {
                    continue;
                }
                String source = Files.readString(file);
                for (String forbidden : FORBIDDEN) {
                    if (source.contains(forbidden)) {
                        findings.add(file + " contains " + forbidden);
                    }
                }
            }
        }
    }
}
