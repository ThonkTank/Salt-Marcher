package features.catalog.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.function.UnaryOperator;

/** Shared construction of independently removable filter tokens. */
final class CatalogFilterTokens {

    private CatalogFilterTokens() {
    }

    static <Q> List<CatalogFilterToken<Q>> single(String label, UnaryOperator<Q> remove) {
        return label == null || label.isBlank()
                ? List.of() : List.of(new CatalogFilterToken<>(label, remove));
    }

    static <Q, V> List<CatalogFilterToken<Q>> each(
            Q query,
            Function<Q, List<V>> selected,
            Function<V, String> label,
            BiFunction<Q, List<V>, Q> update
    ) {
        List<CatalogFilterToken<Q>> tokens = new ArrayList<>();
        for (V value : selected.apply(query)) {
            String tokenLabel = label.apply(value);
            if (tokenLabel == null || tokenLabel.isBlank()) {
                continue;
            }
            tokens.add(new CatalogFilterToken<>(tokenLabel, current -> {
                List<V> retained = new ArrayList<>(selected.apply(current));
                retained.removeIf(candidate -> Objects.equals(candidate, value));
                return update.apply(current, List.copyOf(retained));
            }));
        }
        return List.copyOf(tokens);
    }
}
