package importer;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

public class DndBeyondCrawler {

    private static final String BASE_URL = "https://www.dndbeyond.com";
    private static final Pattern SLUG_PATTERN =
            Pattern.compile("^/monsters/[a-z0-9][a-z0-9-]*[a-z][a-z0-9-]*$");
    public static final String USER_AGENT =
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    private final HttpClient httpClient;
    private final String cobaltSession;
    private final Path outputDir;
    private final long delayMs;

    public DndBeyondCrawler(String cobaltSession, Path outputDir, long delayMs) {
        if (!cobaltSession.matches("[A-Za-z0-9._\\-]+")) {
            throw new IllegalArgumentException("Ungültiges Session-Token-Format");
        }
        this.cobaltSession = cobaltSession;
        this.outputDir = outputDir;
        this.delayMs = delayMs;
        this.httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    // -------------------------------------------------------------------------
    // Main entry point
    // -------------------------------------------------------------------------

    public static void main(String[] args) throws Exception {
        Properties props = loadProperties();

        String cobaltSession = props.getProperty("cobalt.session", "").trim();
        if (cobaltSession.isEmpty() || cobaltSession.equals("DEIN_COBALT_SESSION_COOKIE_HIER")) {
            System.err.println("ERROR: Bitte 'cobalt.session' in crawler.properties eintragen.");
            System.err.println("       Den Cookie findest du im Browser unter:");
            System.err.println("       DevTools → Application → Cookies → www.dndbeyond.com → CobaltSession");
            System.exit(1);
        }

        long delayMs = Long.parseLong(props.getProperty("delay.ms", "1500"));
        Path outputDir = Paths.get(props.getProperty("output.dir", "data/monsters"));

        Files.createDirectories(outputDir);

        DndBeyondCrawler crawler = new DndBeyondCrawler(cobaltSession, outputDir, delayMs);
        crawler.crawl();
    }

    // -------------------------------------------------------------------------
    // Crawl orchestration
    // -------------------------------------------------------------------------

    public void crawl() throws Exception {
        System.out.println("Starte D&D Beyond Monster Crawler...");
        System.out.println("Ausgabeverzeichnis: " + outputDir.toAbsolutePath());

        // Collect all slugs from the listing pages first
        Set<String> rawSlugs = new LinkedHashSet<>();
        int page = 1;
        while (true) {
            System.out.println("Lade Listenseite " + page + "...");
            List<String> pageSlugs = fetchMonsterSlugs(page);
            int sizeBefore = rawSlugs.size();
            rawSlugs.addAll(pageSlugs);
            int newlyAdded = rawSlugs.size() - sizeBefore;

            if (pageSlugs.isEmpty() || newlyAdded == 0) {
                System.out.println("Keine neuen Monster auf Seite " + page + " — Listing abgeschlossen.");
                break;
            }
            System.out.println("  +" + newlyAdded + " neue Monster (gesamt: " + rawSlugs.size() + ")");
            page++;
            Thread.sleep(delayMs);
        }

        // Deduplizierung: Bei Slugs mit gleichem Name-Suffix die niedrigste ID behalten (2014)
        Set<String> slugs = deduplicateSlugs(rawSlugs);
        int removed = rawSlugs.size() - slugs.size();
        if (removed > 0) {
            System.out.println("Deduplizierung: " + removed + " neuere Duplikate entfernt"
                    + " (behalte 2014-Versionen)");
        }

        if (slugs.isEmpty()) {
            System.err.println("WARNUNG: Keine Monster-Slugs gefunden. Möglicherweise:");
            System.err.println("  - CobaltSession-Cookie abgelaufen oder falsch");
            System.err.println("  - D&D Beyond HTML-Struktur hat sich geändert");
            System.err.println("  - Listenseite wird per JavaScript gerendert (dann Selenium nötig)");
            return;
        }

        // Fetch each monster detail page (concurrent)
        List<String> slugList = new ArrayList<>(slugs);
        int total = slugList.size();
        AtomicInteger success = new AtomicInteger();
        AtomicInteger skipped = new AtomicInteger();
        AtomicInteger failed  = new AtomicInteger();
        AtomicInteger progress = new AtomicInteger();

        int threadCount = 3;
        ExecutorService pool = Executors.newFixedThreadPool(threadCount);
        System.out.println("Starte " + threadCount + " parallele Fetch-Threads...");

        for (String slug : slugList) {
            pool.submit(() -> {
                Path outFile = outputDir.resolve(slug + ".html");
                int idx = progress.incrementAndGet();

                if (Files.exists(outFile)) {
                    System.out.printf("[%d/%d] %s → übersprungen%n", idx, total, slug);
                    skipped.incrementAndGet();
                    return;
                }

                try {
                    System.out.printf("[%d/%d] %s%n", idx, total, slug);
                    fetchMonsterDetail(slug, outFile);
                    success.incrementAndGet();
                    Thread.sleep(delayMs);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } catch (Exception e) {
                    System.err.println("  FEHLER bei " + slug + ": " + e.getMessage());
                    failed.incrementAndGet();
                }
            });
        }

        pool.shutdown();
        pool.awaitTermination(Long.MAX_VALUE, TimeUnit.MILLISECONDS);

        System.out.println();
        System.out.println("=== Fertig ===");
        System.out.println("Erfolgreich: " + success.get());
        System.out.println("Übersprungen: " + skipped.get() + " (bereits vorhanden)");
        System.out.println("Fehlgeschlagen: " + failed.get());
        System.out.println("Ausgabe: " + outputDir.toAbsolutePath());
    }

    // -------------------------------------------------------------------------
    // Listing page: extract monster slugs
    // -------------------------------------------------------------------------

    List<String> fetchMonsterSlugs(int page) throws Exception {
        String url = BASE_URL + "/monsters?page=" + page;
        String html = get(url);
        Document doc = Jsoup.parse(html, BASE_URL);

        // Match links like /monsters/goblin or /monsters/12345-adult-black-dragon
        // but NOT /monsters?filter=... or /monsters/0 etc.
        Elements links = doc.select("a[href]");
        // LinkedHashSet: O(1) contains + insertion order preserved
        java.util.LinkedHashSet<String> slugSet = new java.util.LinkedHashSet<>();

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

    void fetchMonsterDetail(String slug, Path outFile) throws Exception {
        // Path traversal check
        if (!outFile.normalize().startsWith(outputDir.normalize())) {
            throw new SecurityException("Pfad-Traversal erkannt: " + slug);
        }
        String url = BASE_URL + "/monsters/" + slug;
        String html = get(url);
        Document doc = Jsoup.parse(html, BASE_URL);

        String text = extractStatBlock(doc);

        if (text.isBlank()) {
            throw new IOException("Kein Stat-Block-Inhalt gefunden. Seite möglicherweise nicht zugänglich.");
        }

        Files.writeString(outFile, text);
        System.out.println("  → Gespeichert: " + outFile.getFileName());
    }

    // -------------------------------------------------------------------------
    // HTML extraction: stat block text
    // -------------------------------------------------------------------------

    String extractStatBlock(Document doc) {
        Element block = importer.HtmlStatBlockParser.findStatBlock(doc);
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

    String get(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("User-Agent", USER_AGENT)
                .header("Cookie", "CobaltSession=" + cobaltSession)
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "en-US,en;q=0.9")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        int status = response.statusCode();
        if (status == 401 || status == 403) {
            throw new IOException("Zugriff verweigert (HTTP " + status + "). CobaltSession-Cookie abgelaufen?");
        }
        if (status == 404) {
            throw new IOException("Nicht gefunden (HTTP 404): " + url);
        }
        if (status == 429) {
            throw new IOException("Rate-Limit erreicht (HTTP 429). delay.ms erhöhen?");
        }
        if (status != 200) {
            throw new IOException("Unerwarteter HTTP-Status " + status + " für: " + url);
        }

        return response.body();
    }

    // -------------------------------------------------------------------------
    // Deduplizierung: 2014 vs 2024 Varianten
    // -------------------------------------------------------------------------

    /**
     * Entfernt Duplikate bei Slugs mit gleichem Name-Suffix aber unterschiedlicher ID.
     * Behält die niedrigste ID (= älteste/2014 Version).
     * Beispiel: "16907-goblin" und "5195047-goblin"
     *         → behält "16907-goblin"
     */
    static Set<String> deduplicateSlugs(Set<String> slugs) {
        return CrawlerUtils.deduplicateSlugs(slugs);
    }

    // -------------------------------------------------------------------------
    // Config loading
    // -------------------------------------------------------------------------

    private static Properties loadProperties() throws IOException {
        return CrawlerUtils.loadCrawlerProperties();
    }
}
