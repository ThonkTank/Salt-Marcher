package src.domain.worldplanner.model.world.usecase;

import java.util.Objects;
import src.domain.worldplanner.model.world.WorldLocation;
import src.domain.worldplanner.model.world.WorldPlannerState;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;

public final class AddWorldLocationFactionUseCase {

    private final WorldPlannerRepository repository;
    private final LoadWorldPlannerUseCase loadWorldPlannerUseCase;

    public AddWorldLocationFactionUseCase(
            WorldPlannerRepository repository,
            LoadWorldPlannerUseCase loadWorldPlannerUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadWorldPlannerUseCase = Objects.requireNonNull(loadWorldPlannerUseCase, "loadWorldPlannerUseCase");
    }

    public void execute(long locationId, long factionId) {
        WorldPlannerState state = loadWorldPlannerUseCase.execute();
        WorldLocation location = state.location(locationId);
        if (location == null || state.faction(factionId) == null) {
            repository.save(state.withStatus("Location oder Fraktion nicht gefunden."));
            return;
        }
        if (location.factionIds().contains(factionId)) {
            repository.save(state.withStatus("Fraktion ist bereits mit der Location verlinkt."));
            return;
        }
        repository.save(WorldPlannerStateChanges.replaceLocation(
                state,
                location.addFaction(factionId),
                "Fraktion zur Location hinzugefuegt."));
    }
}
