package features.world.hexmap.model;

import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public final class DbValueEnumLookup {
    private DbValueEnumLookup() {
        throw new AssertionError("No instances");
    }

    public static <E extends Enum<E>> Map<String, E> index(E[] values, Function<E, String> keyExtractor) {
        return Stream.of(values)
                .collect(Collectors.toUnmodifiableMap(keyExtractor, Function.identity()));
    }

    public static <E> Optional<E> fromKey(Map<String, E> lookup, String key) {
        if (key == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(lookup.get(key));
    }
}
