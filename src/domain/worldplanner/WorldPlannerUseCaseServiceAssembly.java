package src.domain.worldplanner;

import java.util.Objects;
import src.domain.worldplanner.model.world.WorldPlannerIds;
import src.domain.worldplanner.model.world.port.WorldPlannerReferencePort;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;
import src.domain.worldplanner.model.world.usecase.AddWorldFactionNpcUseCase;
import src.domain.worldplanner.model.world.usecase.AddWorldLocationEncounterTableUseCase;
import src.domain.worldplanner.model.world.usecase.AddWorldLocationFactionUseCase;
import src.domain.worldplanner.model.world.usecase.CreateWorldFactionUseCase;
import src.domain.worldplanner.model.world.usecase.CreateWorldLocationUseCase;
import src.domain.worldplanner.model.world.usecase.CreateWorldNpcUseCase;
import src.domain.worldplanner.model.world.usecase.LoadWorldPlannerUseCase;
import src.domain.worldplanner.model.world.usecase.SetWorldFactionInventoryLimitUseCase;
import src.domain.worldplanner.model.world.usecase.SetWorldNpcLifecycleStatusUseCase;
import src.domain.worldplanner.model.world.usecase.UpdateWorldNpcNotesUseCase;

final class WorldPlannerUseCaseServiceAssembly {

    private final LoadWorldPlannerUseCase loadWorldPlannerUseCase;
    private final CreateWorldNpcUseCase createNpcUseCase;
    private final UpdateWorldNpcNotesUseCase updateNpcNotesUseCase;
    private final SetWorldNpcLifecycleStatusUseCase setNpcLifecycleStatusUseCase;
    private final CreateWorldFactionUseCase createFactionUseCase;
    private final AddWorldFactionNpcUseCase addFactionNpcUseCase;
    private final SetWorldFactionInventoryLimitUseCase setFactionInventoryLimitUseCase;
    private final CreateWorldLocationUseCase createLocationUseCase;
    private final AddWorldLocationFactionUseCase addLocationFactionUseCase;
    private final AddWorldLocationEncounterTableUseCase addLocationEncounterTableUseCase;

    WorldPlannerUseCaseServiceAssembly(
            WorldPlannerRepository repository,
            WorldPlannerReferencePort referenceValidator
    ) {
        WorldPlannerRepository safeRepository = Objects.requireNonNull(repository, "repository");
        WorldPlannerReferencePort safeReferenceValidator =
                referenceValidator == null ? new PositiveReferenceValidator() : referenceValidator;
        loadWorldPlannerUseCase = new LoadWorldPlannerUseCase(safeRepository);
        createNpcUseCase = new CreateWorldNpcUseCase(safeRepository, loadWorldPlannerUseCase, safeReferenceValidator);
        updateNpcNotesUseCase = new UpdateWorldNpcNotesUseCase(safeRepository, loadWorldPlannerUseCase);
        setNpcLifecycleStatusUseCase = new SetWorldNpcLifecycleStatusUseCase(safeRepository, loadWorldPlannerUseCase);
        createFactionUseCase = new CreateWorldFactionUseCase(
                safeRepository,
                loadWorldPlannerUseCase,
                safeReferenceValidator);
        addFactionNpcUseCase = new AddWorldFactionNpcUseCase(safeRepository, loadWorldPlannerUseCase);
        setFactionInventoryLimitUseCase = new SetWorldFactionInventoryLimitUseCase(
                safeRepository,
                loadWorldPlannerUseCase,
                safeReferenceValidator);
        createLocationUseCase = new CreateWorldLocationUseCase(safeRepository, loadWorldPlannerUseCase);
        addLocationFactionUseCase = new AddWorldLocationFactionUseCase(safeRepository, loadWorldPlannerUseCase);
        addLocationEncounterTableUseCase = new AddWorldLocationEncounterTableUseCase(
                safeRepository,
                loadWorldPlannerUseCase,
                safeReferenceValidator);
    }

    WorldPlannerApplicationService createApplicationService() {
        return new WorldPlannerApplicationService(new WorldPlannerApplicationService.Dependencies(
                loadWorldPlannerUseCase,
                createNpcUseCase,
                updateNpcNotesUseCase,
                setNpcLifecycleStatusUseCase,
                createFactionUseCase,
                addFactionNpcUseCase,
                setFactionInventoryLimitUseCase,
                createLocationUseCase,
                addLocationFactionUseCase,
                addLocationEncounterTableUseCase));
    }

    private static boolean positiveReference(long referenceId) {
        return WorldPlannerIds.isPositive(referenceId);
    }

    private static final class PositiveReferenceValidator implements WorldPlannerReferencePort {
        @Override
        public boolean creatureStatblockExists(long creatureStatblockId) {
            return positiveReference(creatureStatblockId);
        }

        @Override
        public boolean encounterTableExists(long encounterTableId) {
            return positiveReference(encounterTableId);
        }
    }
}
