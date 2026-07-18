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
                requiredProviders.monsters().encounterPoolFilters(),
                requiredProviders.items().catalog(),
                requiredProviders.savedEncounters().plans(),
                requiredProviders.worldReferences().creatures(),
                requiredProviders.worldReferences().world(),
                requiredProviders.encounterTables().commands(),
                requiredProviders.encounterTables().catalog(),
                requiredProviders.publicationDispatcher());
        LegacyCatalogBindingAdapter legacy = new LegacyCatalogBindingAdapter(
                controller, requiredRoutes);
        return new Component(controller, legacy);
    }

    public static final class Component implements AutoCloseable {
        private final CatalogWorkspaceController controller;
        private final LegacyCatalogBindingAdapter legacy;
        private final AtomicBoolean closed = new AtomicBoolean();

        private Component(CatalogWorkspaceController controller, LegacyCatalogBindingAdapter legacy) {
            this.controller = controller;
            this.legacy = legacy;
        }

        CatalogWorkspaceController controller() {
            return controller;
        }

        public ShellContribution contribution() {
            return legacy.contribution();
        }

        @Override
        public void close() {
            if (!closed.compareAndSet(false, true)) {
                return;
            }
            legacy.close();
            controller.close();
        }
    }
}
