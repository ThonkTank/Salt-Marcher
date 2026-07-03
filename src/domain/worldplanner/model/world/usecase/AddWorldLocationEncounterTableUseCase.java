package src.domain.worldplanner.model.world.usecase;

import java.util.Objects;
import src.domain.worldplanner.model.world.WorldLocation;
import src.domain.worldplanner.model.world.WorldPlannerIds;
import src.domain.worldplanner.model.world.WorldPlannerState;
import src.domain.worldplanner.model.world.port.WorldPlannerReferencePort;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;

public final class AddWorldLocationEncounterTableUseCase {
    private final WorldPlannerRepository repository;
    private final LoadWorldPlannerUseCase loadWorldPlannerUseCase;
    private final WorldPlannerReferencePort referenceValidator;

    public AddWorldLocationEncounterTableUseCase(
            WorldPlannerRepository repository,
            LoadWorldPlannerUseCase loadWorldPlannerUseCase,
            WorldPlannerReferencePort referenceValidator
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadWorldPlannerUseCase = Objects.requireNonNull(loadWorldPlannerUseCase, "loadWorldPlannerUseCase");
        this.referenceValidator = Objects.requireNonNull(referenceValidator, "referenceValidator");
    }

    public void execute(long locationId, long encounterTableId) {
        WorldPlannerState state = loadWorldPlannerUseCase.execute();
        WorldLocation location = state.location(locationId);
        if (location == null
                || !WorldPlannerIds.isPositive(encounterTableId)
                || !referenceValidator.encounterTableExists(encounterTableId)) {
            repository.save(state.withStatus("Location oder Encounter Table nicht gefunden."));
            return;
        }
        if (location.encounterTableIds().contains(encounterTableId)) {
            repository.save(state.withStatus("Encounter Table ist bereits mit der Location verlinkt."));
            return;
        }
        repository.save(WorldPlannerStateChanges.replaceLocation(
                state,
                location.addEncounterTable(encounterTableId),
                "Encounter Table zur Location hinzugefuegt."));
    }
}
