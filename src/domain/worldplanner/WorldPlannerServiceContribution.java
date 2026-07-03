package src.domain.worldplanner;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.SelectCreatureDetailCommand;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.RefreshEncounterTableCatalogCommand;
import src.domain.worldplanner.model.world.WorldPlannerIds;
import src.domain.worldplanner.model.world.port.WorldPlannerReferencePort;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

public final class WorldPlannerServiceContribution implements ServiceContribution {

    @Override
    public void register(ServiceRegistry.Builder services) {
        AtomicReference<WorldPlannerServiceAssembly> assembly = new AtomicReference<>();
        Function<ServiceRegistry, WorldPlannerServiceAssembly> resolver = registry -> resolveAssembly(assembly, registry);
        services.registerFactory(
                WorldPlannerApplicationService.class,
                registry -> resolver.apply(registry).createApplicationService());
        services.registerFactory(
                WorldPlannerSnapshotModel.class,
                registry -> resolver.apply(registry).snapshotModel());
    }

    private static WorldPlannerServiceAssembly resolveAssembly(
            AtomicReference<WorldPlannerServiceAssembly> assembly,
            ServiceRegistry registry
    ) {
        WorldPlannerServiceAssembly existing = assembly.get();
        if (existing != null) {
            return existing;
        }
        WorldPlannerServiceAssembly candidate =
                new WorldPlannerServiceAssembly(
                        registry.require(WorldPlannerRepository.class),
                        referenceValidator(registry));
        return assembly.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(assembly.get(), "assembly");
    }

    private static WorldPlannerReferencePort referenceValidator(ServiceRegistry registry) {
        WorldPlannerReferencePort explicitPort = registry.find(WorldPlannerReferencePort.class).orElse(null);
        if (explicitPort != null) {
            return explicitPort;
        }
        CreaturesApplicationService creatures = registry.find(CreaturesApplicationService.class).orElse(null);
        CreatureDetailModel creatureDetails = registry.find(CreatureDetailModel.class).orElse(null);
        EncounterTableApplicationService encounterTables =
                registry.find(EncounterTableApplicationService.class).orElse(null);
        EncounterTableCatalogModel encounterTableCatalog = registry.find(EncounterTableCatalogModel.class).orElse(null);
        return new PublishedReferenceValidator(creatures, creatureDetails, encounterTables, encounterTableCatalog);
    }

    private record PublishedReferenceValidator(
            CreaturesApplicationService creatures,
            CreatureDetailModel creatureDetails,
            EncounterTableApplicationService encounterTables,
            EncounterTableCatalogModel encounterTableCatalog
    ) implements WorldPlannerReferencePort {

        @Override
        public boolean creatureStatblockExists(long creatureStatblockId) {
            if (!WorldPlannerIds.isPositive(creatureStatblockId)) {
                return false;
            }
            if (creatures == null || creatureDetails == null) {
                return false;
            }
            creatures.selectCreatureDetail(new SelectCreatureDetailCommand(creatureStatblockId));
            var result = creatureDetails.current();
            return result != null
                    && result.status() == CreatureLookupStatus.SUCCESS
                    && result.detail() != null
                    && result.detail().id() == creatureStatblockId;
        }

        @Override
        public boolean encounterTableExists(long encounterTableId) {
            if (!WorldPlannerIds.isPositive(encounterTableId)) {
                return false;
            }
            if (encounterTables == null || encounterTableCatalog == null) {
                return false;
            }
            encounterTables.refreshCatalog(new RefreshEncounterTableCatalogCommand());
            var result = encounterTableCatalog.current();
            if (result == null || result.status() != EncounterTableReadStatus.SUCCESS) {
                return false;
            }
            return result.tables().stream().anyMatch(table -> table.tableId() == encounterTableId);
        }
    }
}
