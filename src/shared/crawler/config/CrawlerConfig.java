package shared.crawler.config;

import java.net.http.HttpClient;
import java.util.Properties;
import java.util.Set;

/**
 * Validated crawler configuration: session token, HTTP client, and request delay.
 */
public record CrawlerConfig(HttpClient httpClient, String cobaltSession, long delayMs) {

    private static final String TOKEN_REGEX = "[A-Za-z0-9._=\\-]+";
    private static final Set<String> SENTINELS = Set.of(
            "YOUR_COBALT_SESSION_COOKIE_HERE",
            "DEIN_COBALT_SESSION_COOKIE_HIER");

    public static CrawlerConfig fromProperties(Properties props) throws CrawlerConfigException {
        String session = props.getProperty("cobalt.session", "").trim();
        if (session.isEmpty() || SENTINELS.contains(session)) {
            throw new CrawlerConfigException(
                    "ERROR: 'cobalt.session' missing in crawler.properties.\n"
                            + "       Find the cookie in your browser:\n"
                            + "       DevTools -> Application -> Cookies -> www.dndbeyond.com -> CobaltSession");
        }
        if (!session.matches(TOKEN_REGEX)) {
            throw new CrawlerConfigException("Invalid session token format in crawler.properties (cobalt.session)");
        }
        long delayMs = CrawlerProperties.parseDelayMs(props);
        HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        return new CrawlerConfig(client, session, delayMs);
    }
}
