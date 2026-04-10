package shared.crawler.http;

import shared.crawler.config.input.LoadRuntimeConfigInput;
import shared.crawler.http.input.ComposeHttpInput;

import java.io.IOException;
import java.net.http.HttpClient;

/**
 * Canonical raw fetch seam for crawler HTTP.
 * It owns client construction plus the shared throttling/retry behavior that
 * individual crawler mains should not duplicate.
 */
@SuppressWarnings("unused")
public final class HttpObject {

    private static final int MAX_ATTEMPTS = 3;

    public ComposeHttpInput.CrawlerHttpInput composeHttp(ComposeHttpInput input) {
        HttpClient httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        return new ComposeHttpInput.CrawlerHttpInput(
                input.runtimeConfig().delayMs(),
                new FetchGateway(httpClient, input.runtimeConfig().cobaltSession(), input.runtimeConfig().delayMs())::fetchPage
        );
    }

    private static final class FetchGateway {
        private final HttpClient httpClient;
        private final String cobaltSession;
        private final long delayMs;
        private long nextAllowedRequestAtMs;

        private FetchGateway(HttpClient httpClient, String cobaltSession, long delayMs) {
            this.httpClient = httpClient;
            this.cobaltSession = cobaltSession;
            this.delayMs = delayMs;
        }

        private synchronized String fetchPage(ComposeHttpInput.FetchPageInput input)
                throws IOException, InterruptedException {
            return fetchPage(input, 1);
        }

        private String fetchPage(ComposeHttpInput.FetchPageInput input, int attempt)
                throws IOException, InterruptedException {
            throttleBeforeRequest();
            try {
                return CrawlerHttpClient.get(input.url(), httpClient, cobaltSession);
            } catch (IOException e) {
                if (!shouldRetry(e) || attempt >= MAX_ATTEMPTS) {
                    throw e;
                }
                return fetchPage(input, attempt + 1);
            }
        }

        private void throttleBeforeRequest() throws InterruptedException {
            long now = System.currentTimeMillis();
            long waitMs = nextAllowedRequestAtMs - now;
            if (waitMs > 0) {
                Thread.sleep(waitMs);
            }
            nextAllowedRequestAtMs = System.currentTimeMillis() + delayMs;
        }

        private static boolean shouldRetry(IOException exception) {
            String message = exception.getMessage();
            if (message == null || message.isBlank()) {
                return true;
            }
            return !(message.contains("Access denied")
                    || message.contains("Not found (HTTP 404)")
                    || message.contains("Blocked cross-origin redirect")
                    || message.contains("Invalid session token"));
        }
    }
}
