package features.catalog;

import features.catalog.application.CatalogWorkspaceController;
import features.catalog.application.CatalogWorkspaceBinding;
import features.catalog.application.CatalogSectionDefinitions;
import features.catalog.application.EncounterTableCatalogDefinition;
import features.catalog.application.FactionCatalogDefinition;
import features.catalog.application.ItemsCatalogDefinition;
import features.catalog.application.LocationCatalogDefinition;
import features.catalog.application.MonsterCatalogDefinition;
import features.catalog.application.NpcCatalogDefinition;
import features.catalog.application.SavedEncounterCatalogDefinition;
import java.util.Objects;
import shell.api.ShellContribution;

/** The only production composition entry point for Catalog. */
public final class CatalogFeature {

    private CatalogFeature() {
    }

    public static Component create(CatalogProviders providers, CatalogRoutes routes) {
        CatalogProviders requiredProviders = Objects.requireNonNull(providers, "providers");
        CatalogRoutes requiredRoutes = Objects.requireNonNull(routes, "routes");
        CatalogSectionDefinitions definitions = new CatalogSectionDefinitions(
                new MonsterCatalogDefinition(
                        requiredProviders.monsters().queries(), requiredProviders.monsters().poolFilters(),
                        requiredProviders.worldReferences().world(), requiredProviders.encounterTables().catalog(),
                        requiredRoutes.creatureInspector(), requiredRoutes.encounter(), requiredRoutes.scene()),
                new ItemsCatalogDefinition(
                        requiredProviders.items().catalog(), requiredRoutes.itemInspector()),
                new SavedEncounterCatalogDefinition(
                        requiredProviders.savedEncounters().plans(), requiredRoutes.encounter()),
                new NpcCatalogDefinition(
                        requiredProviders.worldReferences().creatures(), requiredProviders.worldReferences().world(),
                        requiredRoutes.worldInspectors(), requiredRoutes.encounter(), requiredRoutes.scene()),
                new FactionCatalogDefinition(
                        requiredProviders.worldReferences().world(), requiredProviders.encounterTables().catalog(),
                        requiredRoutes.worldInspectors(), requiredRoutes.encounter()),
                new LocationCatalogDefinition(
                        requiredProviders.worldReferences().world(), requiredProviders.encounterTables().catalog(),
                        requiredRoutes.worldInspectors(), requiredRoutes.encounter(), requiredRoutes.scene()),
                new EncounterTableCatalogDefinition(
                        requiredProviders.encounterTables().commands(), requiredProviders.encounterTables().catalog(),
                        requiredRoutes.encounter()));
        CatalogWorkspaceController controller = new CatalogWorkspaceController(
                definitions, requiredProviders.publicationDispatcher());
        CatalogWorkspaceBinding binding = new CatalogWorkspaceBinding(controller.publication());
        features.catalog.adapter.javafx.CatalogContribution contribution =
                new features.catalog.adapter.javafx.CatalogContribution(controller, binding, definitions);
        return new Component(controller, binding, contribution);
    }

    public static final class Component implements AutoCloseable {
        private final CatalogWorkspaceController controller;
        private final CatalogWorkspaceBinding binding;
        private final features.catalog.adapter.javafx.CatalogContribution contribution;
        private boolean closed;

        private Component(
                CatalogWorkspaceController controller,
                CatalogWorkspaceBinding binding,
                features.catalog.adapter.javafx.CatalogContribution contribution
        ) {
            this.controller = controller;
            this.binding = binding;
            this.contribution = contribution;
        }

        CatalogWorkspaceController controller() {
            return controller;
        }

        public ShellContribution contribution() {
            return contribution;
        }

        @Override
        public synchronized void close() {
            if (closed) {
                return;
            }
            Throwable failure = null;
            try {
                try {
                    binding.close();
                } catch (RuntimeException | Error bindingFailure) {
                    failure = accumulate(failure, bindingFailure);
                }
                try {
                    contribution.close();
                } catch (RuntimeException | Error contributionFailure) {
                    failure = accumulate(failure, contributionFailure);
                }
                try {
                    controller.close();
                } catch (RuntimeException | Error controllerFailure) {
                    failure = accumulate(failure, controllerFailure);
                }
            } finally {
                closed = true;
            }
            rethrow(failure);
        }

        private static Throwable accumulate(Throwable current, Throwable next) {
            if (current == null) {
                return next;
            }
            current.addSuppressed(next);
            return current;
        }

        private static void rethrow(Throwable failure) {
            if (failure instanceof RuntimeException runtimeFailure) {
                throw runtimeFailure;
            }
            if (failure instanceof Error error) {
                throw error;
            }
        }
    }
}
