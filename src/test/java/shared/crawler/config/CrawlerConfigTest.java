package shared.crawler.config;

import org.junit.jupiter.api.Test;

import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CrawlerConfigTest {

    @Test
    void fromPropertiesThrowsForMissingSession() {
        Properties props = new Properties();

        CrawlerConfigException ex = assertThrows(
                CrawlerConfigException.class,
                () -> CrawlerConfig.fromProperties(props));

        assertTrue(ex.getMessage().contains("cobalt.session"));
    }

    @Test
    void fromPropertiesThrowsForSentinelSession() {
        Properties props = new Properties();
        props.setProperty("cobalt.session", "YOUR_COBALT_SESSION_COOKIE_HERE");

        CrawlerConfigException ex = assertThrows(
                CrawlerConfigException.class,
                () -> CrawlerConfig.fromProperties(props));

        assertTrue(ex.getMessage().contains("cobalt.session"));
    }

    @Test
    void fromPropertiesThrowsForInvalidTokenFormat() {
        Properties props = new Properties();
        props.setProperty("cobalt.session", "invalid token with space");

        CrawlerConfigException ex = assertThrows(
                CrawlerConfigException.class,
                () -> CrawlerConfig.fromProperties(props));

        assertTrue(ex.getMessage().contains("Invalid session token format"));
    }

    @Test
    void fromPropertiesBuildsValidatedConfig() throws Exception {
        Properties props = new Properties();
        props.setProperty("cobalt.session", "abc_DEF-123.=");
        props.setProperty("delay.ms", "100");

        CrawlerConfig config = CrawlerConfig.fromProperties(props);

        assertEquals("abc_DEF-123.=", config.cobaltSession());
        assertEquals(500L, config.delayMs());
        assertNotNull(config.httpClient());
    }
}
