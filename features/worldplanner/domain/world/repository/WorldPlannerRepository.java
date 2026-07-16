package features.worldplanner.domain.world.repository;

import features.worldplanner.domain.world.WorldPlannerState;

public interface WorldPlannerRepository {

    WorldPlannerState load();

    WorldPlannerState save(WorldPlannerState state);
}
