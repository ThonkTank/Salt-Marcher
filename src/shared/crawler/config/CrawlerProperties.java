package shared.crawler.config;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Properties;
import java.util.logging.Logger;

@SuppressWarnings("unused")
public final class CrawlerProperties {
    private static final Logger LOGGER = Logger.getLogger(CrawlerProperties.class.getName());

    private CrawlerProperties() {
        throw new AssertionError("No instances");
    }

    /**
     * Parses delay.ms from properties with defensive error handling and a minimum floor.
     * Returns at least 500ms to prevent rate-limit bans from dndbeyond.com.
     */
    static long parseDelayMs(Properties props) {
        try {
            return Math.max(500, Long.parseLong(props.getProperty("delay.ms", "1500").trim()));
        } catch (NumberFormatException e) {
            LOGGER.warning("Invalid delay.ms in crawler.properties, using 1500ms");
            return 1500;
        }
    }

    /**
     * Validates the shared crawler session token and rejects placeholder values.
     */
    static String parseCobaltSession(Properties props) throws CrawlerConfigException {
        String session = props.getProperty("cobalt.session", "").trim();
        if (session.isEmpty()
                || "YOUR_COBALT_SESSION_COOKIE_HERE".equals(session)
                || "DEIN_COBALT_SESSION_COOKIE_HIER".equals(session)) {
            throw new CrawlerConfigException(
                    "ERROR: 'cobalt.session' missing in crawler.properties.\n"
                            + "       Find the cookie in your browser:\n"
                            + "       DevTools -> Application -> Cookies -> www.dndbeyond.com -> CobaltSession");
        }
        if (!session.matches("[A-Za-z0-9._=\\-]+")) {
            throw new CrawlerConfigException("Invalid session token format in crawler.properties (cobalt.session)");
        }
        return session;
    }

    /**
     * Resolves one configured crawler path, ensuring it stays within the project root.
     * Throws IllegalArgumentException if the resolved path escapes the project directory.
     */
    static Path resolveProjectPath(String configuredPath, String propertyName) {
        Path projectRoot = Paths.get("").toAbsolutePath().normalize();
        Path resolvedPath = Paths.get(configuredPath).toAbsolutePath().normalize();
        if (!resolvedPath.startsWith(projectRoot)) {
            throw new IllegalArgumentException(
                    propertyName + " must be within the project directory: " + resolvedPath
                            + " (project root: " + projectRoot + ")");
        }
        return resolvedPath;
    }

    /**
     * Loads crawler.properties from the project directory.
     * Throws IOException with a help message if the file is not found.
     */
    static Properties loadCrawlerProperties() throws IOException {
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
