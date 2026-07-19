package platform.ui.mapcanvas;

import java.util.Iterator;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Predicate;
import java.util.function.ToLongFunction;

/** Access-ordered viewport cache that never evicts currently protected keys. */
public final class WeightedViewportCache<K, V> {
    private final long maximumWeight;
    private final ToLongFunction<V> weightOf;
    private final Map<K, Entry<V>> entries = new LinkedHashMap<>(16, 0.75f, true);
    private final Map<K, Integer> leasedKeys = new LinkedHashMap<>();
    private Set<K> protectedKeys = Set.of();
    private long weight;

    public WeightedViewportCache(long maximumWeight, ToLongFunction<V> weightOf) {
        if (maximumWeight <= 0L) {
            throw new IllegalArgumentException("maximumWeight must be positive");
        }
        this.maximumWeight = maximumWeight;
        this.weightOf = Objects.requireNonNull(weightOf, "weightOf");
    }

    public synchronized V get(K key) {
        Entry<V> entry = entries.get(key);
        return entry == null ? null : entry.value();
    }

    /** Returns all present values in caller order as one synchronized access. */
    public synchronized Map<K, V> getAll(Collection<K> keys) {
        Map<K, V> result = new LinkedHashMap<>();
        for (K key : keys == null ? Set.<K>of() : keys) {
            Entry<V> entry = entries.get(key);
            if (entry != null) {
                result.put(key, entry.value());
            }
        }
        return Map.copyOf(result);
    }

    public synchronized void put(K key, V value, Set<K> protectedKeys) {
        putWithoutEviction(key, value);
        evict(combinedProtection(protectedKeys));
    }

    /** Adds a batch atomically and applies eviction only after the entire batch is visible. */
    public synchronized void putAll(Map<K, V> values) {
        for (Map.Entry<K, V> value : values == null
                ? Map.<K, V>of().entrySet() : values.entrySet()) {
            putWithoutEviction(value.getKey(), value.getValue());
        }
        evict(combinedProtection(null));
    }

    /** Replaces the long-lived protected set, then immediately evicts newly unprotected excess. */
    public synchronized void replaceProtectedKeys(Set<K> keys) {
        protectedKeys = keys == null ? Set.of() : Set.copyOf(keys);
        evict(combinedProtection(null));
    }

    /** Temporarily protects keys. Nested leases are reference counted. */
    public synchronized Lease protect(Set<K> keys) {
        Set<K> safeKeys = keys == null ? Set.of() : Set.copyOf(keys);
        safeKeys.forEach(key -> leasedKeys.merge(key, 1, Integer::sum));
        return new Lease() {
            private boolean closed;

            @Override
            public void close() {
                synchronized (WeightedViewportCache.this) {
                    if (closed) {
                        return;
                    }
                    closed = true;
                    for (K key : safeKeys) {
                        leasedKeys.computeIfPresent(key, (ignored, count) -> count == 1 ? null : count - 1);
                    }
                    evict(combinedProtection(null));
                }
            }
        };
    }

    public synchronized void invalidateAll(Collection<K> keys) {
        for (K key : keys == null ? Set.<K>of() : keys) {
            remove(key);
        }
    }

    public synchronized void invalidateIf(Predicate<K> predicate) {
        Objects.requireNonNull(predicate, "predicate");
        Iterator<Map.Entry<K, Entry<V>>> iterator = entries.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<K, Entry<V>> entry = iterator.next();
            if (predicate.test(entry.getKey())) {
                weight -= entry.getValue().weight();
                iterator.remove();
            }
        }
    }

    public synchronized int size() {
        return entries.size();
    }

    public synchronized long weight() {
        return weight;
    }

    private void putWithoutEviction(K key, V value) {
        K safeKey = Objects.requireNonNull(key, "key");
        V safeValue = Objects.requireNonNull(value, "value");
        Entry<V> previous = entries.remove(safeKey);
        if (previous != null) {
            weight -= previous.weight();
        }
        long entryWeight = Math.max(1L, weightOf.applyAsLong(safeValue));
        entries.put(safeKey, new Entry<>(safeValue, entryWeight));
        weight = saturatedAdd(weight, entryWeight);
    }

    private void remove(K key) {
        Entry<V> removed = entries.remove(key);
        if (removed != null) {
            weight -= removed.weight();
        }
    }

    private Set<K> combinedProtection(Set<K> additional) {
        Set<K> result = new LinkedHashSet<>(protectedKeys);
        result.addAll(leasedKeys.keySet());
        if (additional != null) {
            result.addAll(additional);
        }
        return Set.copyOf(result);
    }

    private static long saturatedAdd(long left, long right) {
        return Long.MAX_VALUE - left < right ? Long.MAX_VALUE : left + right;
    }

    private void evict(Set<K> protectedKeys) {
        boolean removed;
        do {
            removed = false;
            Iterator<Map.Entry<K, Entry<V>>> iterator = entries.entrySet().iterator();
            while (weight > maximumWeight && iterator.hasNext()) {
                Map.Entry<K, Entry<V>> candidate = iterator.next();
                if (protectedKeys.contains(candidate.getKey())) {
                    continue;
                }
                weight -= candidate.getValue().weight();
                iterator.remove();
                removed = true;
                break;
            }
        } while (weight > maximumWeight && removed);
    }

    private record Entry<V>(V value, long weight) {
    }

    @FunctionalInterface
    public interface Lease extends AutoCloseable {
        @Override
        void close();
    }
}
