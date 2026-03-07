package features.items.importer;

import importer.CrawlerConfig;
import importer.CrawlerHttpUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.io.IOException;
import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Properties;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Crawls equipment and magic item pages from DnD Beyond and saves each as an
 * HTML file under data/items/equipment/ or data/items/magic-items/.
 *
 * Prerequisites: crawler.properties with a valid CobaltSession cookie.
 * Magic items require a slug file (data/magic-item-slugs.txt) — build it first
 * with: ./crawl-items.sh --build-slugs   (or: java features.items.importer.ItemCrawler --build-slugs)
 * Normal run: ./crawl-items.sh
 *
 * Output is consumed by {@link ItemImporter}.
 */
public class ItemCrawler {

    private static final String BASE_URL = "https://www.dndbeyond.com";
    private static final Pattern EQUIPMENT_SLUG_PATTERN =
            Pattern.compile("^/equipment/\\d+-[a-z0-9][a-z0-9-]*$");

    private final HttpClient httpClient;
    private final String cobaltSession;
    private final Path outputDir;
    private final long delayMs;
    private final Path magicItemSlugsFile;

    public ItemCrawler(CrawlerConfig config, Path outputDir, Path magicItemSlugsFile) {
        this.httpClient = config.httpClient();
        this.cobaltSession = config.cobaltSession();
        this.outputDir = outputDir;
        this.delayMs = config.delayMs();
        this.magicItemSlugsFile = magicItemSlugsFile;
    }

    // -------------------------------------------------------------------------
    // Main entry point
    // -------------------------------------------------------------------------

    public static void main(String[] args) throws IOException, InterruptedException {
        Properties props = CrawlerHttpUtils.loadCrawlerProperties();

        CrawlerConfig config = CrawlerConfig.fromProperties(props);
        Path outputDir = CrawlerHttpUtils.resolveOutputDir(
                props.getProperty("items.output.dir", "data/items"));
        Path slugsFile = Paths.get(props.getProperty("magic-items.slugs.file",
                "data/magic-item-slugs.txt"));

        Files.createDirectories(outputDir.resolve("equipment"));
        Files.createDirectories(outputDir.resolve("magic-items"));

        ItemCrawler crawler = new ItemCrawler(config, outputDir, slugsFile);

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

        // 1. Collect equipment slugs via pagination
        Set<String> rawEquipmentSlugs = new LinkedHashSet<>();
        int page = 1;
        while (true) {
            System.out.println("Loading equipment listing page " + page + "...");
            List<String> pageSlugs = fetchEquipmentSlugs(page);
            int sizeBefore = rawEquipmentSlugs.size();
            rawEquipmentSlugs.addAll(pageSlugs);
            int newlyAdded = rawEquipmentSlugs.size() - sizeBefore;

            if (pageSlugs.isEmpty() || newlyAdded == 0) {
                System.out.println("No new items on page " + page
                        + " — equipment listing complete.");
                break;
            }
            System.out.println("  +" + newlyAdded + " new items (total: " + rawEquipmentSlugs.size() + ")");
            page++;
            Thread.sleep(delayMs);
        }

        // Deduplication: for slugs with the same name suffix, keep the lowest ID (2014 version)
        Set<String> equipmentSlugs = CrawlerHttpUtils.deduplicateSlugs(rawEquipmentSlugs);
        int removed = rawEquipmentSlugs.size() - equipmentSlugs.size();
        if (removed > 0) {
            System.out.println("Deduplication: " + removed + " newer duplicates removed"
                    + " (keeping 2014 versions)");
        }

        Set<CrawlEntry> entries = new LinkedHashSet<>();
        for (String slug : equipmentSlugs) {
            entries.add(new CrawlEntry(slug, false));
        }

        // 2. Load magic-item slugs from file
        Set<String> rawMagicSlugs = loadMagicItemSlugs();
        Set<String> magicSlugs = CrawlerHttpUtils.deduplicateSlugs(rawMagicSlugs);
        if (!magicSlugs.isEmpty()) {
            int sizeBefore = entries.size();
            for (String slug : magicSlugs) {
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

        // 3. Sequential detail fetch.
        // DnD Beyond rate-limits aggressively; a single thread with delayMs between
        // requests is the only safe strategy.
        List<CrawlEntry> entryList = new ArrayList<>(entries);
        int total   = entryList.size();
        int success = 0;
        int skipped = 0;
        int failed  = 0;

        System.out.println("Starting sequential fetch (delay=" + delayMs + "ms between requests)...");

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
                Thread.sleep(delayMs);
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

    // -------------------------------------------------------------------------
    // Equipment listing: extract slugs via pagination
    // -------------------------------------------------------------------------

    private List<String> fetchEquipmentSlugs(int page) throws IOException, InterruptedException {
        String url = BASE_URL + "/equipment?page=" + page;
        String html = get(url);
        Document doc = Jsoup.parse(html, BASE_URL);

        LinkedHashSet<String> slugSet = new LinkedHashSet<>();
        Elements links = doc.select("a[href]");
        for (Element link : links) {
            String href = link.attr("href");
            if (EQUIPMENT_SLUG_PATTERN.matcher(href).matches()) {
                slugSet.add(href.substring("/equipment/".length()));
            }
        }

        return new ArrayList<>(slugSet);
    }

    // -------------------------------------------------------------------------
    // Magic item slugs from file
    // -------------------------------------------------------------------------

    // Security: this regex is the trust boundary for slug file content — it prevents
    // path traversal (no '/' or '..') and URL injection (no special characters).
    private static final Pattern MAGIC_SLUG_PATTERN =
            Pattern.compile("^\\d+-[a-z0-9][a-z0-9-]*$");

    /** Matches full /magic-items/{id}-{slug} hrefs as they appear in listing pages. */
    private static final Pattern MAGIC_ITEMS_HREF_PATTERN =
            Pattern.compile("^/magic-items/\\d+-[a-z0-9][a-z0-9-]*$");

    private Set<String> loadMagicItemSlugs() {
        Set<String> slugs = new LinkedHashSet<>();
        if (!Files.exists(magicItemSlugsFile)) return slugs;

        try {
            for (String line : Files.readAllLines(magicItemSlugsFile, java.nio.charset.StandardCharsets.UTF_8)) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) continue;
                if (!MAGIC_SLUG_PATTERN.matcher(trimmed).matches()) {
                    System.err.println("Skipping invalid slug: " + trimmed);
                    continue;
                }
                slugs.add(trimmed);
            }
        } catch (IOException e) {
            System.err.println("ItemCrawler.loadMagicItemSlugs(): " + e.getMessage());
        }
        return slugs;
    }

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

        // Paginate /magic-items?page=X and extract static links.
        Set<String> slugs = new LinkedHashSet<>();
        int page = 1;
        int emptyPages = 0;

        // Two-strike sentinel: stop after two consecutive pages with no new slugs.
        // Tolerates a single transient empty page before giving up.
        while (emptyPages < 2) {
            String url = BASE_URL + "/magic-items?page=" + page;
            System.out.println("  Page " + page + "...");

            try {
                String html = get(url);
                Document doc = Jsoup.parse(html, BASE_URL);

                int sizeBefore = slugs.size();
                for (Element link : doc.select("a[href]")) {
                    String href = link.attr("href");
                    if (MAGIC_ITEMS_HREF_PATTERN.matcher(href).matches()) {
                        slugs.add(href.substring("/magic-items/".length()));
                    }
                }

                if (slugs.size() == sizeBefore) {
                    emptyPages++;
                } else {
                    emptyPages = 0;
                    System.out.println("    +" + (slugs.size() - sizeBefore)
                            + " slugs (total: " + slugs.size() + ")");
                }
            } catch (IOException e) {
                System.err.println("ItemCrawler.buildMagicItemSlugList(): " + e.getMessage());
                emptyPages++;
            }

            page++;
            Thread.sleep(delayMs);
        }

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
        return CrawlerHttpUtils.get(url, httpClient, cobaltSession);
    }

    // -------------------------------------------------------------------------
    // Internal entry type
    // -------------------------------------------------------------------------

    private record CrawlEntry(String slug, boolean isMagic) {}
}
