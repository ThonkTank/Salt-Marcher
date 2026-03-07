package shared.crawler.http;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public final class CrawlerHttpClient {
    private static final String USER_AGENT =
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    private static final String ALLOWED_HOST = "www.dndbeyond.com";
    private static final int MAX_REDIRECTS = 5;

    private CrawlerHttpClient() {
        throw new AssertionError("No instances");
    }

    /**
     * Performs an authenticated HTTP GET and returns the response body.
     * Follows redirects only within www.dndbeyond.com to prevent cookie leakage.
     */
    public static String get(String url, HttpClient client, String cobaltSession)
            throws IOException, InterruptedException {
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
}
