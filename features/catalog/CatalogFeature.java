package features.catalog;

import features.catalog.application.CatalogWorkspaceController;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import shell.api.ShellContribution;

/** The only production composition entry point for Catalog. */
public final class CatalogFeature {

    private CatalogFeature() {
    }

    public static Component create(CatalogProviders providers, CatalogRoutes routes) {
        CatalogProviders requiredProviders = Objects.requireNonNull(providers, "providers");
        CatalogRoutes requiredRoutes = Objects.requireNonNull(routes, "routes");
        CatalogWorkspaceController controller = new CatalogWorkspaceController(
                requiredProviders.monsters().queries(),
                requiredProviders.monsters().poolFilters(),
                requiredProviders.items().catalog(),
                requiredProviders.savedEncounters().plans(),
                requiredProviders.worldReferences().creatures(),
                requiredProviders.worldReferences().world(),
                requiredProviders.encounterTables().commands(),
                requiredProviders.encounterTables().catalog(),
                requiredProviders.publicationDispatcher(),
                requiredRoutes);
        features.catalog.adapter.javafx.CatalogContribution contribution =
                new features.catalog.adapter.javafx.CatalogContribution(controller);
        return new Component(controller, contribution);
    }

    public static final class Component implements AutoCloseable {
        private final CatalogWorkspaceController controller;
        private final features.catalog.adapter.javafx.CatalogContribution contribution;
        private final AtomicBoolean closed = new AtomicBoolean();

        private Component(
                CatalogWorkspaceController controller,
                features.catalog.adapter.javafx.CatalogContribution contribution
        ) {
            this.controller = controller;
            this.contribution = contribution;
        }

        CatalogWorkspaceController controller() {
            return controller;
        }

        public ShellContribution contribution() {
            return contribution;
        }

        @Override
        public void close() {
            if (!closed.compareAndSet(false, true)) {
                return;
            }
            contribution.close();
            controller.close();
        }
    }
}
