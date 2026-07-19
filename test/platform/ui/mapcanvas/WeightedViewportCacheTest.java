package platform.ui.mapcanvas;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

    @Test
    void batchAccessProtectionLeaseAndTargetedInvalidationAreAtomic() {
        WeightedViewportCache<String, String> cache = new WeightedViewportCache<>(4L, String::length);
        Map<String, String> initial = new LinkedHashMap<>();
        initial.put("visible", "1234");
        initial.put("edit", "12");
        cache.replaceProtectedKeys(Set.of("visible"));
        WeightedViewportCache.Lease editLease = cache.protect(Set.of("edit"));
        cache.putAll(initial);

        assertEquals(Map.of("visible", "1234", "edit", "12"),
                cache.getAll(List.of("visible", "edit", "missing")));
        assertEquals(6L, cache.weight(), "protected entries may be temporarily overweight");

        editLease.close();
        assertNull(cache.get("edit"), "release immediately evicts newly unprotected excess");
        assertEquals("1234", cache.get("visible"));

        cache.invalidateAll(Set.of("visible"));
        assertEquals(0, cache.size());
        assertEquals(0L, cache.weight());
    }

    @Test
    void replacingProtectionEvictsExcessAndPredicateInvalidationIsTargeted() {
        WeightedViewportCache<String, String> cache = new WeightedViewportCache<>(2L, ignored -> 2L);
        cache.replaceProtectedKeys(Set.of("a", "b"));
        cache.putAll(Map.of("a", "A", "b", "B"));
        assertEquals(4L, cache.weight());

        cache.replaceProtectedKeys(Set.of("b"));
        assertNull(cache.get("a"));
        assertEquals("B", cache.get("b"));

        cache.invalidateIf(key -> key.startsWith("b"));
        assertEquals(0, cache.size());
    }
}
