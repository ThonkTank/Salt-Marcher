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

public class ItemCrawler {

    private static final String BASE_URL = "https://www.dndbeyond.com";
    private static final Pattern EQUIPMENT_SLUG_PATTERN =
            Pattern.compile("^/equipment/\\d+-[a-z0-9][a-z0-9-]*$");

    private final HttpClient httpClient;
    private final String cobaltSession;
    private final Path outputDir;
    private final long delayMs;
    private final Path magicItemSlugsFile;

    public ItemCrawler(String cobaltSession, Path outputDir, long delayMs,
                       Path magicItemSlugsFile) {
        if (!cobaltSession.matches("[A-Za-z0-9._\\-]+")) {
            throw new IllegalArgumentException("Ungültiges Session-Token-Format");
        }
        this.cobaltSession = cobaltSession;
        this.outputDir = outputDir;
        this.delayMs = delayMs;
        this.magicItemSlugsFile = magicItemSlugsFile;
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
        Path outputDir = Paths.get(props.getProperty("items.output.dir", "data/items"));
        Path slugsFile = Paths.get(props.getProperty("magic-items.slugs.file",
                "data/magic-item-slugs.txt"));

        Files.createDirectories(outputDir.resolve("equipment"));
        Files.createDirectories(outputDir.resolve("magic-items"));

        ItemCrawler crawler = new ItemCrawler(cobaltSession, outputDir, delayMs, slugsFile);

        if (args.length > 0 && "--build-slugs".equals(args[0])) {
            crawler.buildMagicItemSlugList();
            return;
        }

        crawler.crawl();
    }

    // -------------------------------------------------------------------------
    // Crawl orchestration
    // -------------------------------------------------------------------------

    public void crawl() throws Exception {
        System.out.println("Starte D&D Beyond Item Crawler...");
        System.out.println("Ausgabeverzeichnis: " + outputDir.toAbsolutePath());

        // 1. Equipment-Slugs via Pagination sammeln
        Set<String> rawEquipmentSlugs = new LinkedHashSet<>();
        int page = 1;
        while (true) {
            System.out.println("Lade Equipment-Listenseite " + page + "...");
            List<String> pageSlugs = fetchEquipmentSlugs(page);
            int sizeBefore = rawEquipmentSlugs.size();
            rawEquipmentSlugs.addAll(pageSlugs);
            int newlyAdded = rawEquipmentSlugs.size() - sizeBefore;

            if (pageSlugs.isEmpty() || newlyAdded == 0) {
                System.out.println("Keine neuen Items auf Seite " + page
                        + " — Equipment-Listing abgeschlossen.");
                break;
            }
            System.out.println("  +" + newlyAdded + " neue Items (gesamt: " + rawEquipmentSlugs.size() + ")");
            page++;
            Thread.sleep(delayMs);
        }

        // Deduplizierung: Bei Slugs mit gleichem Name-Suffix die niedrigste ID behalten (2014)
        Set<String> equipmentSlugs = deduplicateSlugs(rawEquipmentSlugs);
        int removed = rawEquipmentSlugs.size() - equipmentSlugs.size();
        if (removed > 0) {
            System.out.println("Deduplizierung: " + removed + " neuere Duplikate entfernt"
                    + " (behalte 2014-Versionen)");
        }

        Set<CrawlEntry> entries = new LinkedHashSet<>();
        for (String slug : equipmentSlugs) {
            entries.add(new CrawlEntry(slug, false));
        }

        // 2. Magic-Item-Slugs aus Datei laden
        Set<String> rawMagicSlugs = loadMagicItemSlugs();
        Set<String> magicSlugs = deduplicateSlugs(rawMagicSlugs);
        if (!magicSlugs.isEmpty()) {
            int sizeBefore = entries.size();
            for (String slug : magicSlugs) {
                entries.add(new CrawlEntry(slug, true));
            }
            System.out.println("Magic Items aus Slug-Datei: +" + (entries.size() - sizeBefore)
                    + " (gesamt: " + entries.size() + ")");
        } else {
            System.out.println("Keine Magic-Item-Slug-Datei gefunden oder leer: "
                    + magicItemSlugsFile);
        }

        if (entries.isEmpty()) {
            System.err.println("WARNUNG: Keine Item-Slugs gefunden. Möglicherweise:");
            System.err.println("  - CobaltSession-Cookie abgelaufen oder falsch");
            System.err.println("  - D&D Beyond HTML-Struktur hat sich geändert");
            return;
        }

        // 3. Concurrent Detail-Fetch
        List<CrawlEntry> entryList = new ArrayList<>(entries);
        int total = entryList.size();
        AtomicInteger success  = new AtomicInteger();
        AtomicInteger skipped  = new AtomicInteger();
        AtomicInteger failed   = new AtomicInteger();
        AtomicInteger progress = new AtomicInteger();

        int threadCount = 3;
        ExecutorService pool = Executors.newFixedThreadPool(threadCount);
        System.out.println("Starte " + threadCount + " parallele Fetch-Threads...");

        for (CrawlEntry entry : entryList) {
            pool.submit(() -> {
                String subdir = entry.isMagic ? "magic-items" : "equipment";
                Path outFile = outputDir.resolve(subdir).resolve(entry.slug + ".html");
                int idx = progress.incrementAndGet();

                if (Files.exists(outFile)) {
                    System.out.printf("[%d/%d] %s/%s → übersprungen%n",
                            idx, total, subdir, entry.slug);
                    skipped.incrementAndGet();
                    return;
                }

                // Path traversal check
                if (!outFile.normalize().startsWith(outputDir.normalize())) {
                    System.err.println("Pfad-Traversal erkannt: " + entry.slug);
                    failed.incrementAndGet();
                    return;
                }

                try {
                    System.out.printf("[%d/%d] %s/%s%n", idx, total, subdir, entry.slug);
                    fetchItemDetail(entry.slug, entry.isMagic, outFile);
                    success.incrementAndGet();
                    Thread.sleep(delayMs);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } catch (Exception e) {
                    System.err.println("  FEHLER bei " + entry.slug + ": " + e.getMessage());
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
    // Equipment listing: extract slugs via pagination
    // -------------------------------------------------------------------------

    List<String> fetchEquipmentSlugs(int page) throws Exception {
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

    private static final Pattern MAGIC_SLUG_PATTERN =
            Pattern.compile("^\\d+-[a-z0-9][a-z0-9-]*$");

    Set<String> loadMagicItemSlugs() {
        Set<String> slugs = new LinkedHashSet<>();
        if (!Files.exists(magicItemSlugsFile)) return slugs;

        try {
            for (String line : Files.readAllLines(magicItemSlugsFile)) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) continue;
                if (!MAGIC_SLUG_PATTERN.matcher(trimmed).matches()) {
                    System.err.println("Ungültiger Slug übersprungen: " + trimmed);
                    continue;
                }
                slugs.add(trimmed);
            }
        } catch (IOException e) {
            System.err.println("Fehler beim Lesen der Slug-Datei: " + e.getMessage());
        }
        return slugs;
    }

    // -------------------------------------------------------------------------
    // Detail page: fetch and save item content
    // -------------------------------------------------------------------------

    void fetchItemDetail(String slug, boolean isMagic, Path outFile) throws Exception {
        if (!outFile.normalize().startsWith(outputDir.normalize())) {
            throw new SecurityException("Pfad-Traversal erkannt: " + slug);
        }
        String section = isMagic ? "magic-items" : "equipment";
        String url = BASE_URL + "/" + section + "/" + slug;
        String html = get(url);
        Document doc = Jsoup.parse(html, BASE_URL);

        Element content = HtmlItemParser.findItemContent(doc);
        if (content == null) {
            throw new IOException("Kein Item-Content gefunden. Seite möglicherweise nicht zugänglich.");
        }

        StringBuilder sb = new StringBuilder();

        // Item-Name (h1.page-title) mitspeichern falls außerhalb des Content-Bereichs
        // NICHT h1#logo (das ist das Site-Logo "D&D Beyond")
        Element title = doc.selectFirst("h1.page-title");
        if (title != null) {
            sb.append(title.outerHtml()).append("\n");
        }

        // Magic Items: Typ/Rarity-Span steht außerhalb von .more-info-content
        if (isMagic) {
            for (Element span : doc.select("span")) {
                String text = span.text().trim();
                if (text.length() > 5 && text.length() < 200
                        && text.toLowerCase().matches(".*(common|uncommon|rare|legendary|artifact).*")) {
                    sb.append(span.outerHtml()).append("\n");
                    break;
                }
            }
        }

        sb.append(content.outerHtml());

        String text = sb.toString();
        if (text.isBlank()) {
            throw new IOException("Kein Item-Inhalt gefunden.");
        }

        Files.writeString(outFile, text);
        System.out.println("  → Gespeichert: " + outFile.getFileName());
    }

    // -------------------------------------------------------------------------
    // Build magic item slug list from DnD Beyond search API
    // -------------------------------------------------------------------------

    /**
     * Versucht die interne DnD Beyond Magic-Items-API zu paginieren
     * und schreibt alle gefundenen Slugs in die Slug-Datei.
     */
    public void buildMagicItemSlugList() throws Exception {
        System.out.println("Baue Magic-Item-Slug-Liste...");
        System.out.println("Versuche DnD Beyond Magic-Items-Listing zu scrapen...");

        // Strategie: Versuche /magic-items?page=X — falls statische Links vorhanden
        Set<String> slugs = new LinkedHashSet<>();
        Pattern magicSlugPattern = Pattern.compile("^/magic-items/\\d+-[a-z0-9][a-z0-9-]*$");

        int page = 1;
        int emptyPages = 0;

        while (emptyPages < 2) {
            String url = BASE_URL + "/magic-items?page=" + page;
            System.out.println("  Seite " + page + "...");

            try {
                String html = get(url);
                Document doc = Jsoup.parse(html, BASE_URL);

                int sizeBefore = slugs.size();
                for (Element link : doc.select("a[href]")) {
                    String href = link.attr("href");
                    if (magicSlugPattern.matcher(href).matches()) {
                        slugs.add(href.substring("/magic-items/".length()));
                    }
                }

                if (slugs.size() == sizeBefore) {
                    emptyPages++;
                } else {
                    emptyPages = 0;
                    System.out.println("    +" + (slugs.size() - sizeBefore)
                            + " Slugs (gesamt: " + slugs.size() + ")");
                }
            } catch (Exception e) {
                System.err.println("    Fehler: " + e.getMessage());
                emptyPages++;
            }

            page++;
            Thread.sleep(delayMs);
        }

        if (slugs.isEmpty()) {
            System.err.println("WARNUNG: Keine Magic-Item-Slugs gefunden.");
            System.err.println("Die Magic-Items-Listenseite ist möglicherweise JS-gerendert.");
            System.err.println("Alternative: Slug-Datei manuell erstellen.");
            System.err.println("Format: Eine Slug pro Zeile, z.B.: 9228356-bag-of-holding");
            return;
        }

        Files.createDirectories(magicItemSlugsFile.getParent());
        Files.write(magicItemSlugsFile, slugs);
        System.out.println("Slug-Datei geschrieben: " + magicItemSlugsFile.toAbsolutePath());
        System.out.println("Gefundene Slugs: " + slugs.size());
    }

    // -------------------------------------------------------------------------
    // HTTP helper
    // -------------------------------------------------------------------------

    String get(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("User-Agent", DndBeyondCrawler.USER_AGENT)
                .header("Cookie", "CobaltSession=" + cobaltSession)
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "en-US,en;q=0.9")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request,
                HttpResponse.BodyHandlers.ofString());

        int status = response.statusCode();
        if (status == 401 || status == 403) {
            throw new IOException("Zugriff verweigert (HTTP " + status
                    + "). CobaltSession-Cookie abgelaufen?");
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
    // Config loading
    // -------------------------------------------------------------------------

    private static Properties loadProperties() throws IOException {
        return CrawlerUtils.loadCrawlerProperties();
    }

    // -------------------------------------------------------------------------
    // Deduplizierung: 2014 vs 2024 Varianten
    // -------------------------------------------------------------------------

    static Set<String> deduplicateSlugs(Set<String> slugs) {
        return CrawlerUtils.deduplicateSlugs(slugs);
    }

    // -------------------------------------------------------------------------
    // Internal entry type
    // -------------------------------------------------------------------------

    private record CrawlEntry(String slug, boolean isMagic) {}
}
