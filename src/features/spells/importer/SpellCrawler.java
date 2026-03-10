package features.spells.importer;

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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Properties;
import java.util.Set;
import java.util.regex.Pattern;

public final class SpellCrawler {
    private static final String BASE_URL = "https://www.dndbeyond.com";
    private static final Pattern SPELL_HREF_PATTERN =
            Pattern.compile("^/spells/(?:\\d+-)?[a-z0-9][a-z0-9-]*$");
    private static final Pattern SPELL_SLUG_PATTERN =
            Pattern.compile("^(?:\\d+-)?[a-z0-9][a-z0-9-]*$");

    private final HttpClient httpClient;
    private final String cobaltSession;
    private final Path outputDir;
    private final long delayMs;
    private final Path slugFile;

    public SpellCrawler(CrawlerConfig config, Path outputDir, Path slugFile) {
        this.httpClient = config.httpClient();
        this.cobaltSession = config.cobaltSession();
        this.outputDir = outputDir;
        this.delayMs = config.delayMs();
        this.slugFile = slugFile;
    }

    public static void main(String[] args) throws IOException, InterruptedException {
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
                props.getProperty("spells.output.dir", "data/spells"));
        Path slugFile = Paths.get(props.getProperty("spells.slugs.file", "data/spell-slugs.txt"));
        Files.createDirectories(outputDir);

        SpellCrawler crawler = new SpellCrawler(config, outputDir, slugFile);
        if (args.length > 0 && "--build-slugs".equals(args[0])) {
            crawler.buildSlugList();
            return;
        }
        crawler.crawl();
    }

    public void crawl() throws IOException, InterruptedException {
        System.out.println("Starting D&D Beyond Spell Crawler...");
        System.out.println("Output directory: " + outputDir.toAbsolutePath());

        Set<String> slugs = collectSlugs();
        if (slugs.isEmpty()) {
            System.err.println("WARNING: No spell slugs found.");
            System.err.println("Possible causes: expired session, changed listing HTML, or missing slug file fallback.");
            return;
        }

        List<String> slugList = new ArrayList<>(slugs);
        int total = slugList.size();
        int success = 0;
        int skipped = 0;
        int failed = 0;

        System.out.println("Starting sequential fetch (delay=" + delayMs + "ms between requests)...");
        for (int idx = 0; idx < total; idx++) {
            String slug = slugList.get(idx);
            Path outFile = outputDir.resolve(slug + ".html");
            if (Files.exists(outFile)) {
                System.out.printf("[%d/%d] %s -> skipped%n", idx + 1, total, slug);
                skipped++;
                continue;
            }
            try {
                System.out.printf("[%d/%d] %s%n", idx + 1, total, slug);
                fetchSpellDetail(slug, outFile);
                success++;
                Thread.sleep(delayMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (IOException e) {
                System.err.println("SpellCrawler.crawl() [" + slug + "]: " + e.getMessage());
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

    public void buildSlugList() throws IOException, InterruptedException {
        Set<String> slugs = collectSlugsFromListing();
        if (slugs.isEmpty()) {
            System.err.println("No spell slugs found on listing pages.");
            return;
        }
        Files.createDirectories(slugFile.getParent() == null ? Path.of(".") : slugFile.getParent());
        Files.write(slugFile, slugs, StandardCharsets.UTF_8);
        System.out.println("Saved spell slugs: " + slugFile.toAbsolutePath());
        System.out.println("Count: " + slugs.size());
    }

    private Set<String> collectSlugs() throws IOException, InterruptedException {
        Set<String> listingSlugs = collectSlugsFromListing();
        if (!listingSlugs.isEmpty()) {
            return listingSlugs;
        }
        return loadSlugsFromFile();
    }

    private Set<String> collectSlugsFromListing() throws IOException, InterruptedException {
        Set<String> rawSlugs = new LinkedHashSet<>();
        int page = 1;
        while (true) {
            System.out.println("Loading spell listing page " + page + "...");
            List<String> pageSlugs = fetchSpellSlugs(page);
            int sizeBefore = rawSlugs.size();
            rawSlugs.addAll(pageSlugs);
            int newlyAdded = rawSlugs.size() - sizeBefore;
            if (pageSlugs.isEmpty() || newlyAdded == 0) {
                System.out.println("No new spells on page " + page + " — listing complete.");
                break;
            }
            System.out.println("  +" + newlyAdded + " new spells (total: " + rawSlugs.size() + ")");
            page++;
            Thread.sleep(delayMs);
        }
        return SlugIdentity.deduplicateSlugs(rawSlugs);
    }

    private List<String> fetchSpellSlugs(int page) throws IOException, InterruptedException {
        String html = get(BASE_URL + "/spells?page=" + page);
        Document doc = Jsoup.parse(html, BASE_URL);
        LinkedHashSet<String> slugs = new LinkedHashSet<>();
        Elements links = doc.select("a[href]");
        for (Element link : links) {
            String href = link.attr("href");
            if (SPELL_HREF_PATTERN.matcher(href).matches()) {
                slugs.add(href.substring("/spells/".length()));
            }
        }
        return new ArrayList<>(slugs);
    }

    private Set<String> loadSlugsFromFile() {
        Set<String> slugs = new LinkedHashSet<>();
        if (!Files.exists(slugFile)) {
            return slugs;
        }
        try {
            for (String line : Files.readAllLines(slugFile, StandardCharsets.UTF_8)) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                if (!SPELL_SLUG_PATTERN.matcher(trimmed).matches()) {
                    System.err.println("Skipping invalid spell slug: " + trimmed);
                    continue;
                }
                slugs.add(trimmed);
            }
        } catch (IOException e) {
            System.err.println("Failed to read spell slug file: " + e.getMessage());
        }
        return SlugIdentity.deduplicateSlugs(slugs);
    }

    private void fetchSpellDetail(String slug, Path outFile) throws IOException, InterruptedException {
        if (!outFile.normalize().startsWith(outputDir.normalize())) {
            throw new SecurityException("Path traversal detected: " + slug);
        }
        String html = get(BASE_URL + "/spells/" + slug);
        Files.writeString(outFile, html);
        System.out.println("  -> Saved: " + outFile.getFileName());
    }

    private String get(String url) throws IOException, InterruptedException {
        return CrawlerHttpClient.get(url, httpClient, cobaltSession);
    }
}
