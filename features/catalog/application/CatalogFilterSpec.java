package features.catalog.application;

import java.util.List;
import java.util.Objects;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.function.UnaryOperator;

/** Sealed typed Catalog filter grammar consumed by the single renderer. */
public sealed interface CatalogFilterSpec<Q>
        permits CatalogFilterSpec.Text, CatalogFilterSpec.Choice, CatalogFilterSpec.MultiChoice,
                CatalogFilterSpec.ChoiceRange, CatalogFilterSpec.TextRange, CatalogFilterSpec.TriState {

    String prompt();
    String accessibleText();
    Function<Q, List<CatalogFilterToken<Q>>> activeTokens();
    UnaryOperator<Q> clear();

    record Text<Q>(
            String prompt,
            String accessibleText,
            Function<Q, String> value,
            BiFunction<Q, String, Q> update,
            Function<Q, List<CatalogFilterToken<Q>>> activeTokens,
            UnaryOperator<Q> clear
    ) implements CatalogFilterSpec<Q> {
        public Text {
            requireCommon(prompt, accessibleText, activeTokens, clear);
            value = Objects.requireNonNull(value, "value");
            update = Objects.requireNonNull(update, "update");
        }
    }

    record Choice<Q, V>(
            String prompt,
            String accessibleText,
            Function<Q, List<CatalogChoice<V>>> choices,
            Function<Q, V> value,
            BiFunction<Q, V, Q> update,
            Function<Q, List<CatalogFilterToken<Q>>> activeTokens,
            UnaryOperator<Q> clear
    ) implements CatalogFilterSpec<Q> {
        public Choice {
            requireCommon(prompt, accessibleText, activeTokens, clear);
            choices = Objects.requireNonNull(choices, "choices");
            value = Objects.requireNonNull(value, "value");
            update = Objects.requireNonNull(update, "update");
        }
    }

    record MultiChoice<Q, V>(
            String prompt,
            String accessibleText,
            Function<Q, List<CatalogChoice<V>>> choices,
            Function<Q, List<V>> values,
            BiFunction<Q, List<V>, Q> update,
            Function<Q, List<CatalogFilterToken<Q>>> activeTokens,
            UnaryOperator<Q> clear
    ) implements CatalogFilterSpec<Q> {
        public MultiChoice {
            requireCommon(prompt, accessibleText, activeTokens, clear);
            choices = Objects.requireNonNull(choices, "choices");
            values = Objects.requireNonNull(values, "values");
            update = Objects.requireNonNull(update, "update");
        }
    }

    record ChoiceRange<Q, V>(
            String prompt,
            String accessibleText,
            Function<Q, List<CatalogChoice<V>>> choices,
            Function<Q, V> minimum,
            Function<Q, V> maximum,
            RangeUpdater<Q, V> update,
            Function<Q, List<CatalogFilterToken<Q>>> activeTokens,
            UnaryOperator<Q> clear
    ) implements CatalogFilterSpec<Q> {
        public ChoiceRange {
            requireCommon(prompt, accessibleText, activeTokens, clear);
            choices = Objects.requireNonNull(choices, "choices");
            minimum = Objects.requireNonNull(minimum, "minimum");
            maximum = Objects.requireNonNull(maximum, "maximum");
            update = Objects.requireNonNull(update, "update");
        }
    }

    record TextRange<Q>(
            String prompt,
            String accessibleText,
            Function<Q, String> minimum,
            Function<Q, String> maximum,
            RangeUpdater<Q, String> update,
            Function<Q, List<CatalogFilterToken<Q>>> activeTokens,
            UnaryOperator<Q> clear
    ) implements CatalogFilterSpec<Q> {
        public TextRange {
            requireCommon(prompt, accessibleText, activeTokens, clear);
            minimum = Objects.requireNonNull(minimum, "minimum");
            maximum = Objects.requireNonNull(maximum, "maximum");
            update = Objects.requireNonNull(update, "update");
        }
    }

    record TriState<Q>(
            String prompt,
            String accessibleText,
            Function<Q, Boolean> value,
            BiFunction<Q, Boolean, Q> update,
            Function<Q, List<CatalogFilterToken<Q>>> activeTokens,
            UnaryOperator<Q> clear
    ) implements CatalogFilterSpec<Q> {
        public TriState {
            requireCommon(prompt, accessibleText, activeTokens, clear);
            value = Objects.requireNonNull(value, "value");
            update = Objects.requireNonNull(update, "update");
        }
    }

    @FunctionalInterface
    interface RangeUpdater<Q, V> {
        Q apply(Q query, V minimum, V maximum);
    }

    private static <Q> void requireCommon(
            String prompt,
            String accessibleText,
            Function<Q, List<CatalogFilterToken<Q>>> activeTokens,
            UnaryOperator<Q> clear
    ) {
        Objects.requireNonNull(prompt, "prompt");
        Objects.requireNonNull(accessibleText, "accessibleText");
        Objects.requireNonNull(activeTokens, "activeTokens");
        Objects.requireNonNull(clear, "clear");
    }
}
