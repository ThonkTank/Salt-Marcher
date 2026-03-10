package importer;

import features.creatures.repository.CreatureRepository;

/**
 * CLI entry point: reads crawled HTML files from data/monsters/ and imports
 * them into the SQLite database via {@link CreatureRepository}.
 *
 * Run after {@link MonsterCrawler} or via {@code ./scripts/crawl.sh}.
 */
public final class MonsterImporter {
    private MonsterImporter() {
        throw new AssertionError("No instances");
    }

    public static void main(String[] args) throws Exception {
        try {
            MonsterImportApplicationService.importFromDefaultDirectory();
        } catch (java.io.IOException e) {
            System.err.println(e.getMessage());
            System.err.println("Run MonsterCrawler first (or ./scripts/crawl.sh).");
            System.exit(1);
        }
    }
}
