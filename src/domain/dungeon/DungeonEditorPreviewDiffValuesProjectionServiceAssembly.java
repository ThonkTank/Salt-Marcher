package src.domain.dungeon;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

final class DungeonEditorPreviewDiffValuesProjectionServiceAssembly {

    private DungeonEditorPreviewDiffValuesProjectionServiceAssembly() {
    }

    static <T, K> DungeonEditorPreviewFactDiffProjectionServiceAssembly<T> diff(
            List<T> committedValues,
            List<T> previewValues,
            Function<T, K> key
    ) {
        Map<K, T> committedByKey = index(committedValues, key);
        List<T> changed = new ArrayList<>();
        for (T previewValue : previewValues == null ? List.<T>of() : previewValues) {
            T committedValue = committedByKey.remove(key.apply(previewValue));
            if (!previewValue.equals(committedValue)) {
                changed.add(previewValue);
            }
        }
        return new DungeonEditorPreviewFactDiffProjectionServiceAssembly<>(
                changed,
                List.copyOf(committedByKey.values()));
    }

    private static <T, K> Map<K, T> index(List<T> values, Function<T, K> key) {
        Map<K, T> result = new LinkedHashMap<>();
        for (T value : values == null ? List.<T>of() : values) {
            result.put(key.apply(value), value);
        }
        return result;
    }
}
