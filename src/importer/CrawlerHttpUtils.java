package importer;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

public final class CrawlerHttpUtils {

    private CrawlerHttpUtils() {}

    public static final String USER_AGENT =
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    private static final String ALLOWED_HOST = "www.dndbeyond.com";
    private static final int MAX_REDIRECTS = 5;

    /**
     * Performs an authenticated HTTP GET and returns the response body.
     * Follows redirects only within {@code www.dndbeyond.com} to prevent session cookie leakage.
     * Throws IOException on HTTP errors (401/403, 404, 429, other non-200).
     */
    public static String get(String url, HttpClient client, String cobaltSession) throws IOException, InterruptedException {
        String currentUrl = url;
        for (int redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(currentUrl))
                    .header("User-Agent", USER_AGENT)
                    .header("Cookie", "CobaltSession=" + cobaltSession)
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                    .header("Accept-Language", "en-US,en;q=0.9")
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();

            // Handle same-origin redirects (prevents cookie leakage to third-party domains)
            if (status >= 300 && status < 400) {
                String location = response.headers().firstValue("Location").orElse(null);
                if (location == null) {
                    throw new IOException("Redirect (HTTP " + status + ") with no Location header for: " + currentUrl);
                }
                URI redirectUri = URI.create(currentUrl).resolve(location);
                if (!ALLOWED_HOST.equals(redirectUri.getHost())) {
                    throw new IOException("Blocked cross-origin redirect to " + redirectUri.getHost() + " from: " + currentUrl);
                }
                currentUrl = redirectUri.toString();
                continue;
            }

            if (status == 401 || status == 403) {
                throw new IOException("Access denied (HTTP " + status + "). CobaltSession cookie expired?");
            }
            if (status == 404) {
                throw new IOException("Not found (HTTP 404): " + url);
            }
            if (status == 429) {
                throw new IOException("Rate limit reached (HTTP 429). Increase delay.ms?");
            }
            if (status != 200) {
                throw new IOException("Unexpected HTTP status " + status + " for: " + url);
            }

            return response.body();
        }
        throw new IOException("Too many redirects (>" + MAX_REDIRECTS + ") for: " + url);
    }

    /**
     * Entfernt Duplikate bei Slugs mit gleichem Name-Suffix aber unterschiedlicher ID.
     * Behält die niedrigste ID (= älteste/2014 Version).
     * Beispiel: "16907-goblin" und "5195047-goblin"
     *         → behält "16907-goblin"
     */
    public static Set<String> deduplicateSlugs(Set<String> slugs) {
        Map<String, String> bestByName = new HashMap<>();
        Map<String, Long> bestIdByName = new HashMap<>();

        for (String slug : slugs) {
            int dash = slug.indexOf('-');
            if (dash <= 0) {
                bestByName.putIfAbsent(slug, slug);
                continue;
            }

            String idStr = slug.substring(0, dash);
            String nameSuffix = slug.substring(dash + 1);
            long id;
            try {
                id = Long.parseLong(idStr);
            } catch (NumberFormatException e) {
                bestByName.putIfAbsent(slug, slug);
                continue;
            }

            Long existingId = bestIdByName.get(nameSuffix);
            if (existingId == null || id < existingId) {
                bestByName.put(nameSuffix, slug);
                bestIdByName.put(nameSuffix, id);
            }
        }

        return new LinkedHashSet<>(bestByName.values());
    }

    /**
     * Derives the slug value stored in the database from a crawler-produced filename.
     * Convention: the crawler writes files as "{id}-{slug}.html"; the slug is the
     * filename without the ".html" extension (i.e. "{id}-{slug}").
     * Centralised here so both importers use the same convention.
     */
    public static String slugFromFilename(String filename) {
        return filename.replaceFirst("\\.html$", "");
    }

    /**
     * Extrahiert die numerische ID aus dem Dateinamen.
     * "16907-goblin.html" → 16907
     * "goblin.html"       → Hash-basierte ID (Fallback)
     */
    public static Long extractIdFromFilename(String filename) {
        String base = filename.replaceFirst("\\.html$", "");
        int dash = base.indexOf('-');
        if (dash > 0) {
            String prefix = base.substring(0, dash);
            try {
                return Long.parseLong(prefix);
            } catch (NumberFormatException ignored) {}
        }
        // Fallback for manually placed files or files from older crawl runs that used slug-only names.
        // The hash provides a stable ID within a process run but risks DB collisions on re-import
        // (UPSERT silently overwrites an existing row with the same hash). To detect collisions:
        // look for creatures whose stored name doesn't match the filename slug after import.
        // Prefer filenames in the "{id}-{slug}.html" format produced by the crawler.
        long hash = (long) (base.hashCode() & 0x7FFFFFFF);
        System.err.println("WARNING: No numeric ID prefix in filename '" + filename
                + "' — using hash-based ID " + hash + ". Check for DB collisions.");
        return hash;
    }

    /** Uppercases the first character of a single word, lowercases the rest. */
    public static String capitalizeFirst(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase();
    }

    /** Capitalizes the first letter of each whitespace-delimited word, lowercases the rest. */
    public static String toTitleCase(String s) {
        if (s == null || s.isEmpty()) return s;
        String[] parts = s.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (part.isEmpty()) continue; // guard against leading/trailing whitespace after split
            if (sb.length() > 0) sb.append(' ');
            sb.append(Character.toUpperCase(part.charAt(0)))
              .append(part.substring(1).toLowerCase());
        }
        return sb.toString();
    }

    /**
     * Parses delay.ms from properties with defensive error handling and a minimum floor.
     * Returns at least 500ms to prevent rate-limit bans from dndbeyond.com.
     */
    public static long parseDelayMs(Properties props) {
        long delayMs;
        try {
            delayMs = Long.parseLong(props.getProperty("delay.ms", "1500").trim());
        } catch (NumberFormatException e) {
            System.err.println("WARNING: invalid delay.ms in crawler.properties, using 1500ms");
            delayMs = 1500;
        }
        return Math.max(500, delayMs);
    }

    /**
     * Resolves an output directory from properties, ensuring it stays within the project root.
     * Throws IllegalArgumentException if the resolved path escapes the project directory.
     */
    public static Path resolveOutputDir(String dirPath) {
        Path projectRoot = Paths.get("").toAbsolutePath().normalize();
        Path outputDir = Paths.get(dirPath).toAbsolutePath().normalize();
        if (!outputDir.startsWith(projectRoot)) {
            throw new IllegalArgumentException(
                    "output.dir must be within the project directory: " + outputDir
                    + " (project root: " + projectRoot + ")");
        }
        return outputDir;
    }

    /**
     * Loads crawler.properties from the project directory.
     * Throws IOException with a help message if the file is not found.
     */
    public static Properties loadCrawlerProperties() throws IOException {
        Properties props = new Properties();
        Path configPath = Paths.get("crawler.properties");

        if (!Files.exists(configPath)) {
            System.err.println("ERROR: crawler.properties not found.");
            System.err.println("       Create the file in the project root with this content:");
            System.err.println();
            System.err.println("       cobalt.session=YOUR_COBALT_SESSION_COOKIE_HERE");
            System.err.println("       delay.ms=1500");
            System.err.println("       output.dir=data/monsters");
            throw new IOException("crawler.properties not found: " + configPath.toAbsolutePath());
        }

        try (InputStream in = Files.newInputStream(configPath)) {
            props.load(in);
        }
        return props;
    }
}
