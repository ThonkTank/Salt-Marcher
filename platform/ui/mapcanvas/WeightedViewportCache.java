package platform.ui.mapcanvas;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.ToLongFunction;

/** Access-ordered viewport cache that never evicts currently protected keys. */
public final class WeightedViewportCache<K, V> {
    private final long maximumWeight;
    private final ToLongFunction<V> weightOf;
    private final Map<K, Entry<V>> entries = new LinkedHashMap<>(16, 0.75f, true);
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

    public synchronized void put(K key, V value, Set<K> protectedKeys) {
        K safeKey = Objects.requireNonNull(key, "key");
        V safeValue = Objects.requireNonNull(value, "value");
        Entry<V> previous = entries.remove(safeKey);
        if (previous != null) {
            weight -= previous.weight();
        }
        long entryWeight = Math.max(1L, weightOf.applyAsLong(safeValue));
        entries.put(safeKey, new Entry<>(safeValue, entryWeight));
        weight += entryWeight;
        evict(protectedKeys == null ? Set.of() : Set.copyOf(protectedKeys));
    }

    public synchronized int size() {
        return entries.size();
    }

    public synchronized long weight() {
        return weight;
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
}
