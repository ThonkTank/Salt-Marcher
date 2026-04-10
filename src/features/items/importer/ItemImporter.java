package features.items.importer;

import importer.pipeline.PipelineObject;
import importer.pipeline.input.RunItemImportInput;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * CLI entry point: reads crawled HTML files from data/items/ and imports
 * them into the SQLite database via {@link ItemImportApplicationService}.
 *
 * Run after {@link ItemCrawler} or via {@code ./scripts/crawl-items.sh}.
 */
public class ItemImporter {

    public static void main(String[] args) throws Exception {
        // Must match items.output.dir in crawler.properties (default: data/items)
        Path equipmentDir  = Path.of("data/items/equipment");
        Path magicItemsDir = Path.of("data/items/magic-items");

        if (!Files.exists(equipmentDir) && !Files.exists(magicItemsDir)) {
            System.err.println("Directory not found: data/items/");
            System.err.println("Run ItemCrawler first (or ./scripts/crawl-items.sh).");
            System.exit(1);
        }

        new PipelineObject().runItemImport(new RunItemImportInput(equipmentDir, magicItemsDir));
    }
}
