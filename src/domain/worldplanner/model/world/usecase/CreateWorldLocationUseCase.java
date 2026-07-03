package src.domain.worldplanner.model.world.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.worldplanner.model.world.WorldLocation;
import src.domain.worldplanner.model.world.WorldPlannerState;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;

public final class CreateWorldLocationUseCase {

    private final WorldPlannerRepository repository;
    private final LoadWorldPlannerUseCase loadWorldPlannerUseCase;

    public CreateWorldLocationUseCase(
            WorldPlannerRepository repository,
            LoadWorldPlannerUseCase loadWorldPlannerUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadWorldPlannerUseCase = Objects.requireNonNull(loadWorldPlannerUseCase, "loadWorldPlannerUseCase");
    }

    public void execute(String displayName, String notes) {
        WorldPlannerState state = loadWorldPlannerUseCase.execute();
        WorldLocation location = new WorldLocation(state.nextLocationId(), displayName, notes, List.of(), List.of());
        repository.save(new WorldPlannerState(
                state.npcs(),
                state.factions(),
                WorldPlannerStateChanges.append(state.locations(), location),
                state.nextNpcId(),
                state.nextFactionId(),
                state.nextLocationId() + 1L,
                "Location erstellt."));
    }
}
