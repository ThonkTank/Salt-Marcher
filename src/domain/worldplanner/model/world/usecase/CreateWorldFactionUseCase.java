package src.domain.worldplanner.model.world.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.worldplanner.model.world.WorldFaction;
import src.domain.worldplanner.model.world.WorldPlannerIds;
import src.domain.worldplanner.model.world.WorldPlannerState;
import src.domain.worldplanner.model.world.port.WorldPlannerReferencePort;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;

public final class CreateWorldFactionUseCase {
    private final WorldPlannerRepository repository;
    private final LoadWorldPlannerUseCase loadWorldPlannerUseCase;
    private final WorldPlannerReferencePort referenceValidator;

    public CreateWorldFactionUseCase(
            WorldPlannerRepository repository,
            LoadWorldPlannerUseCase loadWorldPlannerUseCase,
            WorldPlannerReferencePort referenceValidator
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadWorldPlannerUseCase = Objects.requireNonNull(loadWorldPlannerUseCase, "loadWorldPlannerUseCase");
        this.referenceValidator = Objects.requireNonNull(referenceValidator, "referenceValidator");
    }

    public void execute(String displayName, String notes, long primaryEncounterTableId) {
        WorldPlannerState state = loadWorldPlannerUseCase.execute();
        if (!WorldPlannerIds.isPositive(primaryEncounterTableId)
                || !referenceValidator.encounterTableExists(primaryEncounterTableId)) {
            repository.save(state.withStatus("Encounter Table nicht gefunden."));
            return;
        }
        WorldFaction faction = new WorldFaction(
                state.nextFactionId(),
                displayName,
                notes,
                primaryEncounterTableId,
                List.of(),
                List.of());
        repository.save(new WorldPlannerState(
                state.npcs(),
                WorldPlannerStateChanges.append(state.factions(), faction),
                state.locations(),
                state.nextNpcId(),
                state.nextFactionId() + 1L,
                state.nextLocationId(),
                "Fraktion erstellt."));
    }
}
