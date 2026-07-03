package src.features.dungeon.runtime;

import java.util.Objects;
import java.util.function.Function;

@FunctionalInterface
interface DungeonEditorSelector<T> {
    T select(DungeonEditorStoreState state);

    static <T> DungeonEditorSelector<T> of(Function<DungeonEditorStoreState, T> projection) {
        return new BasicSelector<>(projection);
    }

    record BasicSelector<T>(Function<DungeonEditorStoreState, T> projection) implements DungeonEditorSelector<T> {
        public BasicSelector {
            projection = Objects.requireNonNull(projection, "projection");
        }

        @Override
        public T select(DungeonEditorStoreState state) {
            return projection.apply(state == null ? DungeonEditorStoreState.empty() : state);
        }
    }
}
