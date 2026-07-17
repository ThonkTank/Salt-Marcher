package platform.ui.mapcanvas;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Set;
import org.junit.jupiter.api.Test;

final class WeightedViewportCacheTest {
    @Test
    void evictsLeastRecentlyUsedUnprotectedEntry() {
        WeightedViewportCache<String, String> cache = new WeightedViewportCache<>(6L, String::length);
        cache.put("visible", "1234", Set.of("visible"));
        cache.put("old", "12", Set.of("visible"));
        cache.put("new", "12", Set.of("visible"));

        assertEquals("1234", cache.get("visible"));
        assertNull(cache.get("old"));
        assertEquals("12", cache.get("new"));
    }
}
