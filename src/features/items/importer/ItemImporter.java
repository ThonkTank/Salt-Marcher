package features.items.importer;

import importer.BulkImporter;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/**
 * CLI entry point: reads crawled HTML files from data/items/ and imports
 * them into the SQLite database via {@link ItemImportApplicationService}.
 *
 * Run after {@link ItemCrawler} or via {@code ./crawl-items.sh}.
 */
public class ItemImporter {

    public static void main(String[] args) throws IOException {
        // Must match items.output.dir in crawler.properties (default: data/items)
        Path equipmentDir  = Paths.get("data/items/equipment");
        Path magicItemsDir = Paths.get("data/items/magic-items");

        if (!Files.exists(equipmentDir) && !Files.exists(magicItemsDir)) {
            System.err.println("Directory not found: data/items/");
            System.err.println("Run ItemCrawler first (or ./crawl-items.sh).");
            System.exit(1);
        }

        // Collect HTML files from both directories
        List<ImportEntry> entries = new ArrayList<>();
        collectFiles(equipmentDir, false, entries);
        collectFiles(magicItemsDir, true, entries);

        BulkImporter.run(entries, "items",
                entry -> entry.path().getFileName().toString(),
                (entry, conn) -> ItemImportApplicationService.importFile(entry.path(), entry.isMagic(), conn));
    }

    private static void collectFiles(Path dir, boolean isMagic, List<ImportEntry> entries) throws IOException {
        if (!Files.exists(dir)) return;
        try (Stream<Path> paths = Files.walk(dir, 1)) {
            paths.filter(p -> p.toString().endsWith(".html"))
                    .sorted()
                    .forEach(p -> entries.add(new ImportEntry(p, isMagic)));
        }
    }

    private record ImportEntry(Path path, boolean isMagic) {}
}
