package importer;

import java.net.http.HttpClient;
import java.util.Properties;
import java.util.Set;

/**
 * Validated crawler configuration: session token, HTTP client, and request delay.
 * Use {@link #fromProperties(Properties)} to build from crawler.properties.
 */
public record CrawlerConfig(HttpClient httpClient, String cobaltSession, long delayMs) {

    private static final String TOKEN_REGEX = "[A-Za-z0-9._=\\-]+";
    private static final Set<String> SENTINELS = Set.of(
            "YOUR_COBALT_SESSION_COOKIE_HERE",
            "DEIN_COBALT_SESSION_COOKIE_HIER");

    /**
     * Loads and validates {@code cobalt.session} from properties, then builds an HttpClient.
     * Exits with code 1 and a user-friendly message if the token is missing or a placeholder.
     * Throws {@link IllegalArgumentException} if the token format is invalid.
     */
    public static CrawlerConfig fromProperties(Properties props) {
        String session = props.getProperty("cobalt.session", "").trim();
        if (session.isEmpty() || SENTINELS.contains(session)) {
            System.err.println("ERROR: 'cobalt.session' missing in crawler.properties.");
            System.err.println("       Find the cookie in your browser:");
            System.err.println("       DevTools → Application → Cookies → www.dndbeyond.com → CobaltSession");
            System.exit(1);
            throw new AssertionError("unreachable");
        }
        if (!session.matches(TOKEN_REGEX)) {
            throw new IllegalArgumentException("Ungültiges Session-Token-Format");
        }
        long delayMs = CrawlerHttpUtils.parseDelayMs(props);
        HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        return new CrawlerConfig(client, session, delayMs);
    }
}
