package features.items.importer;

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
import shared.crawler.slug.input.LoadSlugFileInput;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Crawls equipment and magic item pages from DnD Beyond and saves each as an
 * HTML file under data/items/equipment/ or data/items/magic-items/.
 *
 * Prerequisites: crawler.properties with a valid CobaltSession cookie.
 * Magic items require a slug file (data/magic-item-slugs.txt) — build it first
 * with: ./scripts/crawl-items.sh --build-slugs   (or: java features.items.importer.ItemCrawler --build-slugs)
 * Normal run: ./scripts/crawl-items.sh
 *
 * Output is consumed by {@link ItemImporter}.
 */
public class ItemCrawler {

    private static final String BASE_URL = "https://www.dndbeyond.com";
    private static final Pattern EQUIPMENT_SLUG_PATTERN =
            Pattern.compile("^/equipment/\\d+-[a-z0-9][a-z0-9-]*$");

    private final ComposeHttpInput.CrawlerHttpInput crawlerHttp;
    private final Path outputDir;
    private final Path magicItemSlugsFile;

    public ItemCrawler(ComposeHttpInput.CrawlerHttpInput crawlerHttp, Path outputDir, Path magicItemSlugsFile) {
        this.crawlerHttp = crawlerHttp;
        this.outputDir = outputDir;
        this.magicItemSlugsFile = magicItemSlugsFile;
    }

    // -------------------------------------------------------------------------
    // Main entry point
    // -------------------------------------------------------------------------

    public static void main(String[] args) throws IOException, InterruptedException {
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
                runtimeConfig.properties().getProperty("items.output.dir", "data/items"),
                "items.output.dir"
        )).path();
        Path slugsFile = configObject.resolveProjectPath(new ResolveProjectPathInput(
                runtimeConfig.properties().getProperty("magic-items.slugs.file", "data/magic-item-slugs.txt"),
                "magic-items.slugs.file"
        )).path();
        ComposeHttpInput.CrawlerHttpInput crawlerHttp =
                new HttpObject().composeHttp(new ComposeHttpInput(runtimeConfig));

        Files.createDirectories(outputDir.resolve("equipment"));
        Files.createDirectories(outputDir.resolve("magic-items"));

        ItemCrawler crawler = new ItemCrawler(crawlerHttp, outputDir, slugsFile);

        if (args.length > 0 && "--build-slugs".equals(args[0])) {
            crawler.buildMagicItemSlugList();
            return;
        }

        crawler.crawl();
    }

    // -------------------------------------------------------------------------
    // Crawl orchestration
    // -------------------------------------------------------------------------

    public void crawl() throws IOException, InterruptedException {
        System.out.println("Starting D&D Beyond Item Crawler...");
        System.out.println("Output directory: " + outputDir.toAbsolutePath());

        SlugObject slugObject = new SlugObject();
        Set<String> equipmentSlugs = slugObject.collectListingSlugs(new CollectListingSlugsInput(
                crawlerHttp,
                BASE_URL + "/equipment?page=%d",
                "equipment item",
                "equipment items",
                "/equipment/",
                EQUIPMENT_SLUG_PATTERN,
                1,
                false
        )).slugs();

        Set<CrawlEntry> entries = new LinkedHashSet<>();
        for (String slug : equipmentSlugs) {
            entries.add(new CrawlEntry(slug, false));
        }

        // 2. Load magic-item slugs from file
        LoadSlugFileInput.LoadedSlugFileInput loadedMagicSlugs = slugObject.loadSlugFile(new LoadSlugFileInput(
                magicItemSlugsFile,
                MAGIC_SLUG_PATTERN,
                "magic item slug"
        ));
        if (!loadedMagicSlugs.slugs().isEmpty()) {
            int sizeBefore = entries.size();
            for (String slug : loadedMagicSlugs.slugs()) {
                entries.add(new CrawlEntry(slug, true));
            }
            System.out.println("Magic items from slug file: +" + (entries.size() - sizeBefore)
                    + " (total: " + entries.size() + ")");
        } else {
            System.out.println("No magic-item slug file found or empty: "
                    + magicItemSlugsFile);
        }

        if (entries.isEmpty()) {
            System.err.println("WARNING: No item slugs found. Possible causes:");
            System.err.println("  - CobaltSession cookie expired or invalid");
            System.err.println("  - D&D Beyond HTML structure changed");
            return;
        }

        // 3. Sequential detail fetch. The shared HTTP seam owns request pacing
        // and retry behavior between raw fetches.
        List<CrawlEntry> entryList = new ArrayList<>(entries);
        int total   = entryList.size();
        int success = 0;
        int skipped = 0;
        int failed  = 0;

        System.out.println("Starting sequential fetch (delay=" + crawlerHttp.delayMs() + "ms between requests)...");

        for (int idx = 0; idx < total; idx++) {
            CrawlEntry entry = entryList.get(idx);
            String subdir  = entry.isMagic ? "magic-items" : "equipment";
            Path outFile   = outputDir.resolve(subdir).resolve(entry.slug + ".html");

            if (Files.exists(outFile)) {
                System.out.printf("[%d/%d] %s/%s → skipped%n",
                        idx + 1, total, subdir, entry.slug);
                skipped++;
                continue;
            }

            try {
                System.out.printf("[%d/%d] %s/%s%n", idx + 1, total, subdir, entry.slug);
                fetchItemDetail(entry.slug, entry.isMagic, outFile);
                success++;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (IOException e) {
                System.err.println("ItemCrawler.crawl() [" + entry.slug + "]: " + e.getMessage());
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

    // Security: this regex is the trust boundary for slug file content — it prevents
    // path traversal (no '/' or '..') and URL injection (no special characters).
    private static final Pattern MAGIC_SLUG_PATTERN =
            Pattern.compile("^\\d+-[a-z0-9][a-z0-9-]*$");

    /** Matches full /magic-items/{id}-{slug} hrefs as they appear in listing pages. */
    private static final Pattern MAGIC_ITEMS_HREF_PATTERN =
            Pattern.compile("^/magic-items/\\d+-[a-z0-9][a-z0-9-]*$");

    // -------------------------------------------------------------------------
    // Detail page: fetch and save item content
    // -------------------------------------------------------------------------

    private void fetchItemDetail(String slug, boolean isMagic, Path outFile) throws IOException, InterruptedException {
        if (!outFile.normalize().startsWith(outputDir.normalize())) {
            throw new SecurityException("Path traversal detected: " + slug);
        }
        String section = isMagic ? "magic-items" : "equipment";
        String url = BASE_URL + "/" + section + "/" + slug;
        String html = get(url);
        Document doc = Jsoup.parse(html, BASE_URL);

        Element content = HtmlItemParser.findItemContent(doc);
        if (content == null) {
            throw new IOException("No item content found. Page may not be accessible.");
        }

        StringBuilder sb = new StringBuilder();

        // Save item name (h1.page-title) if it's outside the content area.
        // NOT h1#logo (that's the site logo "D&D Beyond")
        Element title = doc.selectFirst("h1.page-title");
        if (title != null) {
            sb.append(title.outerHtml()).append("\n");
        }

        // Magic Items: type/rarity span sits outside .more-info-content
        // Pre-capture the rarity span here because it sits outside .more-info-content
        // in the live page but inside the saved HTML after ItemCrawler appends it.
        // HtmlItemParser.parseMagicItemTypeLine handles the same extraction from saved HTML.
        if (isMagic) {
            for (Element span : doc.select("span")) {
                String text = span.text().trim();
                // Skip trivially short spans (stray labels, length <= 5) and oversized spans
                // (page prose, length >= 200). The rarity keyword appears in a compact type-line
                // like "Wondrous Item, rare" or "Weapon (any sword), very rare".
                if (text.length() > 5 && text.length() < 200 && HtmlItemParser.isRaritySpan(text)) {
                    sb.append(span.outerHtml()).append("\n");
                    break;
                }
            }
        }

        sb.append(content.outerHtml());

        String text = sb.toString();
        if (text.isBlank()) {
            throw new IOException("No item content found.");
        }

        Files.writeString(outFile, text);
        System.out.println("  → Saved: " + outFile.getFileName());
    }

    // -------------------------------------------------------------------------
    // Build magic item slug list from DnD Beyond search API
    // -------------------------------------------------------------------------

    /**
     * Scrapes the DnD Beyond magic-items HTML listing (/magic-items?page=X) and writes
     * found slugs to the slug file. Stops after two consecutive pages with no new slugs
     * (two-strike tolerance for transient empty results).
     *
     * <p>Note: The listing may be JS-rendered on the live site, in which case no slugs are
     * found and the method exits with a manual-fallback hint. In that case, build the
     * slug file by hand — one slug per line, format: "{id}-{name-slug}".
     */
    public void buildMagicItemSlugList() throws IOException, InterruptedException {
        System.out.println("Building magic-item slug list...");
        System.out.println("Attempting to scrape DnD Beyond magic-items listing...");

        Set<String> slugs = new SlugObject().collectListingSlugs(new CollectListingSlugsInput(
                crawlerHttp,
                BASE_URL + "/magic-items?page=%d",
                "magic item",
                "magic items",
                "/magic-items/",
                MAGIC_ITEMS_HREF_PATTERN,
                2,
                true
        )).slugs();

        if (slugs.isEmpty()) {
            System.err.println("WARNING: No magic item slugs found.");
            System.err.println("The magic items listing may be JS-rendered and require Selenium.");
            System.err.println("Alternative: build the slug file manually.");
            System.err.println("Format: one slug per line, e.g.: 9228356-bag-of-holding");
            return;
        }

        Files.createDirectories(magicItemSlugsFile.getParent());
        Files.write(magicItemSlugsFile, slugs);
        System.out.println("Slug file written: " + magicItemSlugsFile.toAbsolutePath());
        System.out.println("Slugs found: " + slugs.size());
    }

    // -------------------------------------------------------------------------
    // HTTP helper
    // -------------------------------------------------------------------------

    private String get(String url) throws IOException, InterruptedException {
        return crawlerHttp.fetchPageApi().fetchPage(new ComposeHttpInput.FetchPageInput(url));
    }

    // -------------------------------------------------------------------------
    // Internal entry type
    // -------------------------------------------------------------------------

    private record CrawlEntry(String slug, boolean isMagic) {}
}
