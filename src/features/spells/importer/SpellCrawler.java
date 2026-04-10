package features.spells.importer;

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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

public final class SpellCrawler {
    private static final String BASE_URL = "https://www.dndbeyond.com";
    private static final Pattern SPELL_HREF_PATTERN =
            Pattern.compile("^/spells/(?:\\d+-)?[a-z0-9][a-z0-9-]*$");
    private static final Pattern SPELL_SLUG_PATTERN =
            Pattern.compile("^(?:\\d+-)?[a-z0-9][a-z0-9-]*$");

    private final ComposeHttpInput.CrawlerHttpInput crawlerHttp;
    private final Path outputDir;
    private final Path slugFile;

    public SpellCrawler(ComposeHttpInput.CrawlerHttpInput crawlerHttp, Path outputDir, Path slugFile) {
        this.crawlerHttp = crawlerHttp;
        this.outputDir = outputDir;
        this.slugFile = slugFile;
    }

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
                runtimeConfig.properties().getProperty("spells.output.dir", "data/spells"),
                "spells.output.dir"
        )).path();
        Path slugFile = configObject.resolveProjectPath(new ResolveProjectPathInput(
                runtimeConfig.properties().getProperty("spells.slugs.file", "data/spell-slugs.txt"),
                "spells.slugs.file"
        )).path();
        ComposeHttpInput.CrawlerHttpInput crawlerHttp =
                new HttpObject().composeHttp(new ComposeHttpInput(runtimeConfig));
        Files.createDirectories(outputDir);

        SpellCrawler crawler = new SpellCrawler(crawlerHttp, outputDir, slugFile);
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

        System.out.println("Starting sequential fetch (delay=" + crawlerHttp.delayMs() + "ms between requests)...");
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
        Set<String> slugs = new SlugObject().collectListingSlugs(new CollectListingSlugsInput(
                crawlerHttp,
                BASE_URL + "/spells?page=%d",
                "spell",
                "spells",
                "/spells/",
                SPELL_HREF_PATTERN,
                1,
                false
        )).slugs();
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
        SlugObject slugObject = new SlugObject();
        Set<String> listingSlugs = slugObject.collectListingSlugs(new CollectListingSlugsInput(
                crawlerHttp,
                BASE_URL + "/spells?page=%d",
                "spell",
                "spells",
                "/spells/",
                SPELL_HREF_PATTERN,
                1,
                false
        )).slugs();
        if (!listingSlugs.isEmpty()) {
            return listingSlugs;
        }
        return slugObject.loadSlugFile(new LoadSlugFileInput(
                slugFile,
                SPELL_SLUG_PATTERN,
                "spell slug"
        )).slugs();
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
        return crawlerHttp.fetchPageApi().fetchPage(new ComposeHttpInput.FetchPageInput(url));
    }
}
