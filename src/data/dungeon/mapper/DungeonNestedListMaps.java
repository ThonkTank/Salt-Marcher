package src.data.dungeon.mapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class DungeonNestedListMaps {

    private DungeonNestedListMaps() {
    }

    static <T> Map<Integer, List<T>> immutableCopy(Map<Integer, List<T>> source) {
        Map<Integer, List<T>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<T>> entry : source.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }
}
