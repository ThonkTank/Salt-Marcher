package importer;

import entities.Item;
import org.jsoup.Jsoup;
import repositories.ItemRepository;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

/**
 * CLI entry point: reads crawled HTML files from data/items/ and imports
 * them into the SQLite database via {@link repositories.ItemRepository}.
 *
 * Run after {@link ItemCrawler} or via {@code ./crawl-items.sh}.
 */
public class ItemImporter {

    public static void main(String[] args) throws Exception {
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
                (entry, conn) -> {
                    String filename = entry.path().getFileName().toString();
                    Item item = entry.isMagic()
                            ? HtmlItemParser.parseMagicItem(Jsoup.parse(Files.readString(entry.path())))
                            : HtmlItemParser.parseEquipment(Jsoup.parse(Files.readString(entry.path())));
                    item.Id     = CrawlerHttpUtils.extractIdFromFilename(filename);
                    item.Slug   = CrawlerHttpUtils.slugFromFilename(filename);
                    item.IsMagic = entry.isMagic();
                    if (item.Name == null || item.Name.isBlank()) {
                        throw new IllegalStateException("No name found");
                    }
                    ItemRepository.save(item, conn);
                });
    }

    private static void collectFiles(Path dir, boolean isMagic, List<ImportEntry> entries) throws java.io.IOException {
        if (!Files.exists(dir)) return;
        Files.walk(dir, 1)
                .filter(p -> p.toString().endsWith(".html"))
                .sorted()
                .forEach(p -> entries.add(new ImportEntry(p, isMagic)));
    }

    private record ImportEntry(Path path, boolean isMagic) {}
}
