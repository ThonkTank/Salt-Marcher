package features.spells.importer;

import features.partyanalysis.api.CreatureAnalysisMaintenanceService;
import importer.BulkImporter;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

public final class SpellImporter {

    private SpellImporter() {
        throw new AssertionError("No instances");
    }

    public static void main(String[] args) throws IOException {
        Path spellDir = Path.of("data", "spells");
        if (!Files.exists(spellDir)) {
            System.err.println("Directory not found: data/spells/");
            System.err.println("Run SpellCrawler first.");
            System.exit(1);
        }

        List<Path> files;
        try (Stream<Path> paths = Files.walk(spellDir, 1)) {
            files = paths
                    .filter(path -> path.toString().endsWith(".html"))
                    .sorted()
                    .toList();
        }

        BulkImporter.run(files, "spells",
                path -> path.getFileName().toString(),
                SpellImportApplicationService::importFile);

        CreatureAnalysisMaintenanceService.AnalysisInputRefreshStatus refreshStatus =
                CreatureAnalysisMaintenanceService.refreshForAnalysisInputChange();
        if (refreshStatus == CreatureAnalysisMaintenanceService.AnalysisInputRefreshStatus.STORAGE_ERROR) {
            throw new IllegalStateException("Spell import completed, but analysis invalidation failed");
        }
    }
}
