package shared.crawler.config;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Properties;
import java.util.logging.Logger;

public final class CrawlerProperties {
    private static final Logger LOGGER = Logger.getLogger(CrawlerProperties.class.getName());

    private CrawlerProperties() {
        throw new AssertionError("No instances");
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
            LOGGER.warning("Invalid delay.ms in crawler.properties, using 1500ms");
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
            LOGGER.severe(
                    "crawler.properties not found.\n"
                            + "Create the file in the project root with this content:\n"
                            + "cobalt.session=YOUR_COBALT_SESSION_COOKIE_HERE\n"
                            + "delay.ms=1500\n"
                            + "output.dir=data/monsters");
            throw new IOException("crawler.properties not found: " + configPath.toAbsolutePath());
        }

        try (InputStream in = Files.newInputStream(configPath)) {
            props.load(in);
        }
        return props;
    }
}
