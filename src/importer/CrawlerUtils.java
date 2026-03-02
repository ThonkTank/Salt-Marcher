package importer;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

public final class CrawlerUtils {

    private CrawlerUtils() {}

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
        return (long) (base.hashCode() & 0x7FFFFFFF);
    }

    /**
     * Lädt crawler.properties aus dem Projektverzeichnis.
     * Beendet das Programm mit Fehlermeldung falls nicht gefunden.
     */
    public static Properties loadCrawlerProperties() throws IOException {
        Properties props = new Properties();
        Path configPath = Paths.get("crawler.properties");

        if (!Files.exists(configPath)) {
            System.err.println("ERROR: crawler.properties nicht gefunden.");
            System.err.println("       Erstelle die Datei im Projektverzeichnis mit folgendem Inhalt:");
            System.err.println();
            System.err.println("       cobalt.session=DEIN_COBALT_SESSION_COOKIE_HIER");
            System.err.println("       delay.ms=1500");
            System.err.println("       output.dir=data/monsters");
            System.exit(1);
        }

        try (InputStream in = Files.newInputStream(configPath)) {
            props.load(in);
        }
        return props;
    }
}
