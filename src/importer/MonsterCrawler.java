package importer;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import shared.crawler.config.ConfigObject;
import shared.crawler.config.CrawlerConfigException;
import shared.crawler.config.input.LoadRuntimeConfigInput;
import shared.crawler.config.input.ResolveProjectPathInput;
import shared.crawler.http.HttpObject;
import shared.crawler.http.input.ComposeHttpInput;
import shared.crawler.slug.SlugObject;
import shared.crawler.slug.input.CollectListingSlugsInput;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Crawls all monster pages from DnD Beyond and saves each stat block as a
 * self-contained HTML fragment under data/monsters/{id}-{slug}.html.
 *
 * Prerequisites: crawler.properties with a valid CobaltSession cookie.
 * Run via: ./scripts/crawl.sh  (or: java importer.MonsterCrawler directly)
 *
 * Output is consumed by {@link MonsterImporter}.
 */
public class MonsterCrawler {

    private static final String BASE_URL = "https://www.dndbeyond.com";
    // Matches /monsters/{slug} paths. Requires at least one letter character (in addition to
    // the first char) to reject bare numeric IDs (/monsters/0) and filter/pagination URLs
    // (/monsters?page=2) that are not individual monster pages.
    private static final Pattern SLUG_PATTERN =
            Pattern.compile("^/monsters/[a-z0-9][a-z0-9-]*[a-z][a-z0-9-]*$");

    private final ComposeHttpInput.CrawlerHttpInput crawlerHttp;
    private final Path outputDir;

    public MonsterCrawler(ComposeHttpInput.CrawlerHttpInput crawlerHttp, Path outputDir) {
        this.crawlerHttp = crawlerHttp;
        this.outputDir = outputDir;
    }

    // -------------------------------------------------------------------------
    // Main entry point
    // -------------------------------------------------------------------------

    public static void main(String[] args) throws Exception {
        ConfigObject configObject = new ConfigObject();
        LoadRuntimeConfigInput.RuntimeConfigInput runtimeConfig;

        try {
            runtimeConfig = configObject.loadRuntimeConfig(new LoadRuntimeConfigInput());
        } catch (CrawlerConfigException e) {
            System.err.println(e.getMessage());
            System.exit(1);
            return;
        }
        Path outputDir = configObject.resolveProjectPath(new ResolveProjectPathInput(
                runtimeConfig.properties().getProperty("output.dir", "data/monsters"),
                "output.dir"
        )).path();
        ComposeHttpInput.CrawlerHttpInput crawlerHttp =
                new HttpObject().composeHttp(new ComposeHttpInput(runtimeConfig));

        Files.createDirectories(outputDir);

        new MonsterCrawler(crawlerHttp, outputDir).crawl();
    }

    // -------------------------------------------------------------------------
    // Crawl orchestration
    // -------------------------------------------------------------------------

    public void crawl() throws IOException, InterruptedException {
        System.out.println("Starting D&D Beyond Monster Crawler...");
        System.out.println("Output directory: " + outputDir.toAbsolutePath());

        Set<String> slugs = new SlugObject().collectListingSlugs(new CollectListingSlugsInput(
                crawlerHttp,
                BASE_URL + "/monsters?page=%d",
                "monster",
                "monsters",
                "/monsters/",
                SLUG_PATTERN,
                1,
                false
        )).slugs();

        if (slugs.isEmpty()) {
            System.err.println("WARNING: No monster slugs found. Possible causes:");
            System.err.println("  - CobaltSession cookie expired or invalid");
            System.err.println("  - D&D Beyond HTML structure changed");
            System.err.println("  - Listing page rendered via JavaScript (would need Selenium)");
            return;
        }

        // Fetch each monster detail page sequentially. The shared HTTP seam owns
        // the pacing and retry policy between requests.
        List<String> slugList = new ArrayList<>(slugs);
        int total   = slugList.size();
        int success = 0;
        int skipped = 0;
        int failed  = 0;

        System.out.println("Starting sequential fetch (delay=" + crawlerHttp.delayMs() + "ms between requests)...");

        for (int idx = 0; idx < total; idx++) {
            String slug = slugList.get(idx);
            Path outFile = outputDir.resolve(slug + ".html");

            if (Files.exists(outFile)) {
                System.out.printf("[%d/%d] %s → skipped%n", idx + 1, total, slug);
                skipped++;
                continue;
            }

            try {
                System.out.printf("[%d/%d] %s%n", idx + 1, total, slug);
                fetchMonsterDetail(slug, outFile);
                success++;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (IOException e) {
                System.err.println("MonsterCrawler.crawl() [" + slug + "]: " + e.getMessage());
                failed++;
            }
        }

        System.out.println();
        System.out.println("=== Done ===");
        System.out.println("Success: " + success);
        System.out.println("Skipped: " + skipped + " (already exists)");
        System.out.println("Failed: " + failed);
        System.out.println("Output: " + outputDir.toAbsolutePath());
    }

    // -------------------------------------------------------------------------
    // Detail page: fetch stat block and save as text
    // -------------------------------------------------------------------------

    private void fetchMonsterDetail(String slug, Path outFile) throws IOException, InterruptedException {
        // Path traversal check
        if (!outFile.normalize().startsWith(outputDir.normalize())) {
            throw new SecurityException("Path traversal detected: " + slug);
        }
        String url = BASE_URL + "/monsters/" + slug;
        String html = get(url);
        Document doc = Jsoup.parse(html, BASE_URL);

        String text = extractStatBlock(doc);

        if (text.isBlank()) {
            throw new IOException("No stat block content found. Page may not be accessible.");
        }

        Files.writeString(outFile, text);
        System.out.println("  → Saved: " + outFile.getFileName());
    }

    // -------------------------------------------------------------------------
    // HTML extraction: stat block text
    // -------------------------------------------------------------------------

    private String extractStatBlock(Document doc) {
        Element block = HtmlStatBlockParser.findStatBlock(doc);
        if (block == null) return "";

        // Habitat/Environment tags are outside the stat block in the page
        // <p class="tags environment-tags">Habitat: <span class="tag environment-tag">Forest</span>...
        StringBuilder sb = new StringBuilder(block.outerHtml());
        Element envTags = doc.selectFirst("p.environment-tags");
        if (envTags != null) {
            sb.append("\n").append(envTags.outerHtml());
        }
        return sb.toString();
    }

    // -------------------------------------------------------------------------
    // HTTP helper
    // -------------------------------------------------------------------------

    private String get(String url) throws IOException, InterruptedException {
        return crawlerHttp.fetchPageApi().fetchPage(new ComposeHttpInput.FetchPageInput(url));
    }

}
