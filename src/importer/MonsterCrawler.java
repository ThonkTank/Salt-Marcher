package importer;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import shared.crawler.config.CrawlerConfig;
import shared.crawler.config.CrawlerConfigException;
import shared.crawler.config.CrawlerProperties;
import shared.crawler.http.CrawlerHttpClient;
import shared.crawler.slug.SlugIdentity;

import java.io.IOException;
import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Properties;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Crawls all monster pages from DnD Beyond and saves each stat block as a
 * self-contained HTML fragment under data/monsters/{id}-{slug}.html.
 *
 * Prerequisites: crawler.properties with a valid CobaltSession cookie.
 * Run via: ./crawl.sh  (or: java importer.MonsterCrawler directly)
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

    private final HttpClient httpClient;
    private final String cobaltSession;
    private final Path outputDir;
    private final long delayMs;

    public MonsterCrawler(CrawlerConfig config, Path outputDir) {
        this.httpClient = config.httpClient();
        this.cobaltSession = config.cobaltSession();
        this.outputDir = outputDir;
        this.delayMs = config.delayMs();
    }

    // -------------------------------------------------------------------------
    // Main entry point
    // -------------------------------------------------------------------------

    public static void main(String[] args) throws Exception {
        Properties props = CrawlerProperties.loadCrawlerProperties();

        CrawlerConfig config;
        try {
            config = CrawlerConfig.fromProperties(props);
        } catch (CrawlerConfigException e) {
            System.err.println(e.getMessage());
            System.exit(1);
            return;
        }
        Path outputDir = CrawlerProperties.resolveOutputDir(
                props.getProperty("output.dir", "data/monsters"));

        Files.createDirectories(outputDir);

        new MonsterCrawler(config, outputDir).crawl();
    }

    // -------------------------------------------------------------------------
    // Crawl orchestration
    // -------------------------------------------------------------------------

    public void crawl() throws IOException, InterruptedException {
        System.out.println("Starting D&D Beyond Monster Crawler...");
        System.out.println("Output directory: " + outputDir.toAbsolutePath());

        // Collect all slugs from the listing pages first
        Set<String> rawSlugs = new LinkedHashSet<>();
        int page = 1;
        while (true) {
            System.out.println("Loading listing page " + page + "...");
            List<String> pageSlugs = fetchMonsterSlugs(page);
            int sizeBefore = rawSlugs.size();
            rawSlugs.addAll(pageSlugs);
            int newlyAdded = rawSlugs.size() - sizeBefore;

            if (pageSlugs.isEmpty() || newlyAdded == 0) {
                System.out.println("No new monsters on page " + page + " — listing complete.");
                break;
            }
            System.out.println("  +" + newlyAdded + " new monsters (total: " + rawSlugs.size() + ")");
            page++;
            Thread.sleep(delayMs);
        }

        // Deduplication: for slugs with the same name suffix, keep the lowest ID (2014 version)
        Set<String> slugs = SlugIdentity.deduplicateSlugs(rawSlugs);
        int removed = rawSlugs.size() - slugs.size();
        if (removed > 0) {
            System.out.println("Deduplication: " + removed + " newer duplicates removed"
                    + " (keeping 2014 versions)");
        }

        if (slugs.isEmpty()) {
            System.err.println("WARNING: No monster slugs found. Possible causes:");
            System.err.println("  - CobaltSession cookie expired or invalid");
            System.err.println("  - D&D Beyond HTML structure changed");
            System.err.println("  - Listing page rendered via JavaScript (would need Selenium)");
            return;
        }

        // Fetch each monster detail page sequentially.
        // DnD Beyond rate-limits aggressively; a single thread with delayMs between
        // requests is the only safe strategy.
        List<String> slugList = new ArrayList<>(slugs);
        int total   = slugList.size();
        int success = 0;
        int skipped = 0;
        int failed  = 0;

        System.out.println("Starting sequential fetch (delay=" + delayMs + "ms between requests)...");

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
                Thread.sleep(delayMs);
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
    // Listing page: extract monster slugs
    // -------------------------------------------------------------------------

    private List<String> fetchMonsterSlugs(int page) throws IOException, InterruptedException {
        String url = BASE_URL + "/monsters?page=" + page;
        String html = get(url);
        Document doc = Jsoup.parse(html, BASE_URL);

        // Match links like /monsters/goblin or /monsters/12345-adult-black-dragon
        // but NOT /monsters?filter=... or /monsters/0 etc.
        Elements links = doc.select("a[href]");
        // LinkedHashSet: O(1) contains + insertion order preserved
        LinkedHashSet<String> slugSet = new LinkedHashSet<>();

        for (Element link : links) {
            String href = link.attr("href");
            if (SLUG_PATTERN.matcher(href).matches()) {
                slugSet.add(href.substring("/monsters/".length()));
            }
        }

        return new ArrayList<>(slugSet);
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
        return CrawlerHttpClient.get(url, httpClient, cobaltSession);
    }

}
