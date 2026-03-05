package importer;

import entities.Creature;
import org.jsoup.Jsoup;
import repositories.CreatureRepository;
import services.RoleClassifier;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

/**
 * CLI entry point: reads crawled HTML files from data/monsters/ and imports
 * them into the SQLite database via {@link repositories.CreatureRepository}.
 *
 * Run after {@link MonsterCrawler} or via {@code ./crawl.sh}.
 */
public class MonsterImporter {

    public static void main(String[] args) throws Exception {
        // Default crawl output directory — change only if crawl.sh uses a custom output.dir.
        Path dataDir = Paths.get("data/monsters");

        if (!Files.exists(dataDir)) {
            System.err.println("Directory not found: " + dataDir.toAbsolutePath());
            System.err.println("Run MonsterCrawler first (or ./crawl.sh).");
            System.exit(1);
        }

        List<Path> files = Files.walk(dataDir, 1)
                .filter(p -> p.toString().endsWith(".html"))
                .sorted()
                .toList();

        BulkImporter.run(files, "monsters",
                path -> path.getFileName().toString(),
                (path, conn) -> {
                    String filename = path.getFileName().toString();
                    Creature creature = HtmlStatBlockParser.parse(Jsoup.parse(Files.readString(path)));
                    creature.Id = CrawlerHttpUtils.extractIdFromFilename(filename);
                    if (creature.Name == null || creature.Name.isBlank()) {
                        throw new IllegalStateException("No name found");
                    }
                    creature.Role = creature.CR != null ? RoleClassifier.classify(creature).name() : null;
                    CreatureRepository.save(creature, conn);
                });
    }
}
