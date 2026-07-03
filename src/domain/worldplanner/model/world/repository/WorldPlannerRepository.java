package src.domain.worldplanner.model.world.repository;

import src.domain.worldplanner.model.world.WorldPlannerState;

public interface WorldPlannerRepository {

    WorldPlannerState load();

    WorldPlannerState save(WorldPlannerState state);
}
