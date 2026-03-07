package shared.crawler.config;

/**
 * Signals an invalid crawler configuration with a user-safe message.
 */
public final class CrawlerConfigException extends Exception {
    public CrawlerConfigException(String message) {
        super(message);
    }
}
