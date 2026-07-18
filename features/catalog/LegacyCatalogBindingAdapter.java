package features.catalog;

import features.catalog.adapter.javafx.CatalogContribution;
import features.catalog.application.CatalogApplicationRoutes;
import features.catalog.application.CatalogWorkspaceController;
import java.util.Objects;
import shell.api.ShellContribution;

/** Temporary M1 rendering bridge; deleted after the remaining vertical slices migrate. */
final class LegacyCatalogBindingAdapter implements AutoCloseable {

    private final CatalogContribution contribution;

    LegacyCatalogBindingAdapter(
            CatalogWorkspaceController controller,
            CatalogApplicationRoutes routes
    ) {
        contribution = new CatalogContribution(
                Objects.requireNonNull(controller, "controller"),
                controller.creatureQueries(),
                controller.itemCatalog(),
                Objects.requireNonNull(routes, "routes"));
    }

    ShellContribution contribution() {
        return contribution;
    }

    @Override
    public void close() {
        contribution.close();
    }
}
