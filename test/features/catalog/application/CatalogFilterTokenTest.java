package features.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;

final class CatalogFilterTokenTest {

    @Test
    void multiChoiceValuesProduceIndependentTokensAndRemoveOnlyTheirOwnValue() {
        Draft draft = new Draft(List.of("Huge", "Tiny"));

        List<CatalogFilterToken<Draft>> tokens = CatalogFilterTokens.each(
                draft, Draft::sizes, value -> value, (current, sizes) -> new Draft(sizes));

        assertEquals(List.of("Huge", "Tiny"), tokens.stream().map(CatalogFilterToken::label).toList());
        assertEquals(List.of("Tiny"), tokens.getFirst().remove().apply(draft).sizes());
        assertEquals(List.of("Huge"), tokens.getLast().remove().apply(draft).sizes());
    }

    private record Draft(List<String> sizes) {
        private Draft {
            sizes = List.copyOf(sizes);
        }
    }
}
