package importer;

import importer.pipeline.PipelineObject;
import importer.pipeline.input.RunMonsterImportInput;

/**
 * CLI entry point: reads crawled HTML files from data/monsters/ and imports
 * them into the SQLite database via the shared import pipeline.
 *
 * Run after {@link MonsterCrawler} or via {@code ./scripts/crawl.sh}.
 */
public final class MonsterImporter {
    private MonsterImporter() {
        throw new AssertionError("No instances");
    }

    public static void main(String[] args) throws Exception {
        try {
            new PipelineObject().runMonsterImport(new RunMonsterImportInput(
                    MonsterImportApplicationService.DEFAULT_MONSTER_DATA_DIR
            ));
        } catch (java.io.IOException e) {
            System.err.println(e.getMessage());
            System.err.println("Run MonsterCrawler first (or ./scripts/crawl.sh).");
            System.exit(1);
        }
    }
}
