package features.catalog.application;

import java.util.ArrayList;
import java.util.List;

final class CatalogPresentationChoices {

    private CatalogPresentationChoices() {
    }

    static List<CatalogChoice<String>> strings(List<String> values) {
        List<CatalogChoice<String>> choices = new ArrayList<>();
        choices.add(new CatalogChoice<>("", "Alle"));
        values.forEach(value -> choices.add(new CatalogChoice<>(value, value)));
        return List.copyOf(choices);
    }

    static List<CatalogChoice<String>> requiredStrings(List<String> values) {
        return values.stream().map(value -> new CatalogChoice<>(value, value)).toList();
    }

    static List<CatalogChoice<Long>> references(List<CatalogReferenceOption> values) {
        List<CatalogChoice<Long>> choices = new ArrayList<>();
        choices.add(new CatalogChoice<>(0L, "Alle"));
        values.forEach(value -> choices.add(new CatalogChoice<>(value.id(), value.label())));
        return List.copyOf(choices);
    }

    static String count(String label, int count) {
        return count <= 0 ? "" : label + ": " + count;
    }
}
