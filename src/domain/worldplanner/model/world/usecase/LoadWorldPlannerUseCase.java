package src.domain.worldplanner.model.world.usecase;

import java.util.Objects;
import src.domain.worldplanner.model.world.WorldPlannerState;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;

public final class LoadWorldPlannerUseCase {

    private final WorldPlannerRepository repository;

    public LoadWorldPlannerUseCase(WorldPlannerRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public WorldPlannerState execute() {
        return repository.load();
    }

    public void refresh() {
        repository.load();
    }
}
