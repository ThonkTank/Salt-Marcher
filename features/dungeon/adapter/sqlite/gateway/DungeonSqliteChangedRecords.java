package features.dungeon.adapter.sqlite.gateway;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.ToLongFunction;

final class DungeonSqliteChangedRecords {
    private DungeonSqliteChangedRecords() {
    }

    static <T> List<T> changed(List<T> before, List<T> after, ToLongFunction<T> identity) {
        Map<Long, T> previous = new LinkedHashMap<>();
        for (T value : before == null ? List.<T>of() : before) {
            previous.put(identity.applyAsLong(value), value);
        }
        List<T> changed = new ArrayList<>();
        for (T value : after == null ? List.<T>of() : after) {
            if (!value.equals(previous.get(identity.applyAsLong(value)))) {
                changed.add(value);
            }
        }
        return List.copyOf(changed);
    }

    static <T> Set<Long> identities(List<T> values, ToLongFunction<T> identity) {
        Set<Long> identities = new LinkedHashSet<>();
        for (T value : values == null ? List.<T>of() : values) {
            identities.add(identity.applyAsLong(value));
        }
        return Set.copyOf(identities);
    }
}
