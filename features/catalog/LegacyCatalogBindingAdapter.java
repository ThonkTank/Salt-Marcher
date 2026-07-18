package features.catalog;

import features.catalog.adapter.javafx.CatalogSection;
import java.util.List;

/** Empty M4 compatibility shell retained solely for the explicit M5 deletion gate. */
final class LegacyCatalogBindingAdapter implements AutoCloseable {

    List<CatalogSection> sections() {
        return List.of();
    }

    @Override
    public void close() {
        // No legacy resources remain after M4.
    }
}
